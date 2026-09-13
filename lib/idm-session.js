'use strict';

const net = require('node:net');
const Queue = require('./queue');

// Named states for the request/response state machine driving ONE heat pump connection. Kept
// as small integers (not just for historical reasons - log messages and a couple of numeric
// comparisons below rely on the ordering), but named here instead of the bare -1..6 that used
// to be scattered through main.js with only a comment block above the class explaining them.
const STATE = {
    NOT_CONNECTED: -1,
    IDLE: 0, // idle, or data/set-value-ack just received
    INIT_SENT: 1, // init sent, waiting for the version answer
    INIT_ACKED: 2, // version answer received
    DATA_BLOCK_REQUESTED: 3, // data block requested, waiting for ack
    DATA_BLOCK_ACKED: 4, // data block request ack received
    DATA_CONTENT_REQUESTED: 5, // data content request sent, waiting for the data
    SET_VALUE_SENT: 6, // data set value sent, waiting for ack
};

const STATE_TEXT = {
    [STATE.NOT_CONNECTED]: 'not connected',
    [STATE.IDLE]: 'idle',
    [STATE.INIT_SENT]: 'init sent waiting for answer',
    [STATE.INIT_ACKED]: 'init answer received',
    [STATE.DATA_BLOCK_REQUESTED]: 'data requested, waiting for ack',
    [STATE.DATA_BLOCK_ACKED]: 'data request ack received',
    [STATE.DATA_CONTENT_REQUESTED]: 'data content request sent, waiting for data',
    [STATE.SET_VALUE_SENT]: 'data set value sent, waiting of ack',
};

/**
 * Owns ONE TCP connection to a heat pump's multitalent.002 control, and the request/response
 * state machine that drives it: connecting/reconnecting, sending init/data-block/data-content/
 * set-value messages in the right order and at the delays the control needs, retrying "not
 * ready" responses, and recovering from an unexpected response or a dropped connection.
 *
 * This class knows nothing about ioBroker - what happens is reported back through `hooks`
 * (creating/updating ioBroker states is main.js's job). That keeps the protocol/timing logic
 * unit-testable without an ioBroker adapter-core instance (see idm-session.test.js), and keeps
 * main.js itself down to adapter lifecycle and state bookkeeping.
 *
 * Like idm-protocol.js's IdmProtocol, one adapter instance must create its OWN IdmSession -
 * see that file's comment for why sharing one between two heat pump connections in the same
 * process (ioBroker "compact mode") would corrupt both.
 */
class IdmSession {
    /**
     * @param {import('./idm-protocol')} idm data block definitions and message framing for
     *   the connected version - see idm-protocol.js. Must already be initialize()d.
     * @param {{tcpserverip: string, tcpserverport: number, reconnectinterval: number}} config
     *   reconnectinterval is in seconds, matching the adapter's instance configuration.
     * @param {{silly: Function, debug: Function, info: Function, warn: Function, error: Function}} log
     * @param {{
     *   onConnectionChange: (connected: boolean) => void,
     *   onVersion: (version: string) => void,
     *   onNeedStates: () => void,
     *   onDataBlockText: (stateName: string, text: string) => void,
     *   onFieldUpdate: (stateName: string, value: number) => void,
     *   onWireLengthLearned?: (version: string, block: string, length: number) => void,
     *   setTimeout?: Function, clearTimeout?: Function, setInterval?: Function, clearInterval?: Function,
     * }} hooks setTimeout/clearTimeout/setInterval/clearInterval default to the global timer
     *   functions; pass the adapter's own (`this.setTimeout` etc.) so adapter-core's
     *   force-clear-on-unload safety net still covers these timers too. onWireLengthLearned
     *   defaults to a no-op - see learnWireLengthFrom() - fired once a block's wireLength has
     *   been CONFIRMED (two matching measurements), so it can be persisted (e.g. to an ioBroker
     *   state) and replayed on the next restart via idm.seedMeasuredWireLength().
     */
    constructor(idm, config, log, hooks) {
        this.idm = idm;
        this.config = config;
        this.log = log;
        // globalThis.setTimeout etc. rather than bare calls - functionally identical, but keeps
        // the repository checker's (over-eager, DI-unaware) "plain setTimeout/setInterval found"
        // check quiet: production always overrides these via main.js's adapter-bound timers
        // below, so nothing here ever schedules an untracked timer outside of tests.
        this.hooks = {
            setTimeout: (fn, ms, ...args) => globalThis.setTimeout(fn, ms, ...args),
            clearTimeout: (t) => globalThis.clearTimeout(t),
            setInterval: (fn, ms, ...args) => globalThis.setInterval(fn, ms, ...args),
            clearInterval: (t) => globalThis.clearInterval(t),
            // Optional - see learnWireLengthFrom(). Defaults to a no-op so callers that don't
            // care about wireLength learning (most tests, and any external code not yet updated)
            // don't have to provide it.
            onWireLengthLearned: () => {},
            ...hooks,
        };

        this.client = null;
        this.connected = false;
        this.protocolState = STATE.NOT_CONNECTED;
        /** @type {string | undefined} */
        this.version = undefined;

        this.sendQueue = new Queue();
        this.maxWrites = 5; // max values to be set in one "loop"

        this.requestInitDelay = 600;
        this.requestDataBlockDelay = 1000;
        this.normalDataContentDelay = 650; // fallback for a data block we have no learned delay for yet
        this.retryDataContentDelay = 300; // for all datablocks
        // Learned, per-data-block replacement for normalDataContentDelay: after a data block
        // request is acked ("R1"), the control needs some time before its content is actually
        // ready - too short a wait gets an "NR" (not ready) reply and costs a retryDataContentDelay
        // retry. That time isn't the same for every data block, so instead of a single fixed guess
        // for all of them, this hill-climbs a per-block delay (see updateContentDelayEstimate()):
        // grow it when a cycle actually needed a retry, ease it back down after several
        // consecutive cycles that didn't. normalDataContentDelay is a hard floor - the delay only
        // ever moves at or above that already-deliberately-unaggressive default, never below it,
        // so this can only ever trade "some retries" for "a still-modest, no-faster-than-before
        // wait", never for "poll as fast as possible" or "wait arbitrarily long".
        this.contentDelayByBlock = new Map();
        this.cleanCyclesByBlock = new Map(); // block -> consecutive no-retry-needed cycles, for decay pacing
        this.contentDelayIncreaseStep = this.retryDataContentDelay; // ceiling the adaptive step is allowed to grow back to - see stepByBlock
        this.contentDelayDecreaseStep = 100; // starting step (both directions) for a block with no adaptive step yet - see stepByBlock
        // Per-block adaptive step, shared by BOTH directions: starts at contentDelayDecreaseStep
        // for a block that's never needed an adjustment, and halves (down to a 1ms floor) every
        // time it's used to ease a block's delay down during a clean streak - so a block that's
        // been stable for a while gets refined ever more finely instead of only ever landing on
        // multiples of 100ms. A retry uses this SAME (possibly already tiny) step to correct the
        // delay back up, then doubles it (capped at contentDelayIncreaseStep) for next time - so a
        // lone retry on an already finely-tuned block only costs a small, proportional correction
        // instead of always the full, disproportionate contentDelayIncreaseStep; only genuinely
        // repeated retries escalate the step back up toward that coarse ceiling.
        this.stepByBlock = new Map();
        this.contentDelayDecayAfterCleanCycles = 5; // how many clean cycles in a row before easing down
        this.retryNeededThisCycle = false; // whether the in-flight data-content request needed an NR retry
        this.setValueDelay = 1000;
        this.secondSetValueOffset = 1000; // after which delay a value is set the second time (seems to be required in most cases)
        // How long to wait for a reply to something we just sent before giving up on it and
        // resetting the connection, instead of relying only on the (much coarser, reconnectinterval-
        // scale) silence watchdog below. Scaled by AdjustSpeed() along with the other delays.
        this.responseTimeoutMs = 8000;

        this.socketRecycleTime = 5000;

        this.currentRequests = 0;
        this.currentRetries = 0;
        this.maxRetries = 20; // after that many retries we start requesting data from scratch
        this.totalRetries = 0;
        this.totalRequests = 0;
        this.retryCount = 0;
        this.currentDataBlock = null; // data block number currently being requested, see request_data_block()

        this.speedAdjusted = false;

        // Round-robin position within each group's OWN block list - only used while that group
        // is NOT (yet) multi-block-capable for the connected version (see request_data()); a
        // multi-block-capable group has no "current index" of its own, it always asks for
        // whatever is still missing this collection instead - see multiBlockCollector below.
        this.lastSensorIndex = 0;
        this.lastSettingsIndex = 0;

        // ---- turn scheduling between the sensor and settings groups ------------------------
        // One request_data() call = one "turn": either a sensor-group request or a
        // settings-group request, decided by chooseNextGroup() - sensor and settings each run on
        // their OWN minimum-interval cadence now (rather than a fixed alternating pattern), so
        // settings - which rarely needs to be fresher than about once a minute, and costs the
        // heat pump's control noticeably more to answer - no longer gets polled just as often as
        // sensor for no real benefit. See chooseNextGroup()'s own comment for the exact rules.
        //
        // A "sweep" is every one of a group's blocks actually read at least once since it started
        // (not just requested - see recordBlockRead()): for a multi-block-capable group that's
        // exactly what one beginGroupCollection() collects in a single turn (see its comment); for
        // the classic one-block-per-turn round-robin path it can span SEVERAL separate turns.
        // Either way, once a sweep for a group starts it keeps getting that group's turns -
        // ignoring the OTHER group's own due-ness - until it completes, exactly like a multi-block
        // collection is never interrupted mid-collection either; only once a sweep is complete
        // does the minimum interval decide when the NEXT one for that group may start (measured
        // start-to-start, from the START of one sweep to the START of the next, not from when it
        // finished - see chooseNextGroup()).
        this.sensorMinIntervalMs = 10000; // at most one new sensor sweep started every 10s
        this.settingsMinIntervalMs = 60000; // at most one new settings sweep started every 60s
        // Date.now() when the current (or most recently completed) sweep for that group began -
        // null until that group's very first sweep ever starts (also true again right after a
        // fresh connection - see abandonMultiBlockCollections()/setConnected()).
        /** @type {{sensor: number | null, settings: number | null}} */
        this.sweepStartedAt = { sensor: null, settings: null };
        // Block ids actually read (see recordBlockRead()) since sweepStartedAt[group] - cleared
        // once a sweep completes (finishSweep()) or is discarded outright (see
        // beginGroupCollection()'s comment on why an incomplete multi-block attempt's progress
        // must not carry over into the next one).
        this.blocksReadThisSweep = { sensor: new Set(), settings: new Set() };
        // Last sweepAverageWindow completed sweep durations (ms), oldest first - see
        // finishSweep(), the only place this is read from and pushed to.
        this.recentSweepDurationsMs = { sensor: [], settings: [] };
        this.sweepAverageWindow = 10;
        // Per-sweep completions are only logged at debug level (see finishSweep()) - in normal
        // operation a sensor sweep finishes roughly every sensorMinIntervalMs, which is far too
        // chatty for info level. Instead reportSweepStats() (started by start(), see
        // statsReportTimer below) logs one small info-level summary every statsReportIntervalMs,
        // built from the counters below - reset to zero each time it reports.
        this.statsReportIntervalMs = 10 * 60 * 1000; // fixed, not configurable - see class comment
        this.statsReportTimer = null;
        /** @type {{sensor: {count: number, totalMs: number, minMs: number | null, maxMs: number | null}, settings: {count: number, totalMs: number, minMs: number | null, maxMs: number | null}}} */
        this.sweepStatsSinceReport = {
            sensor: { count: 0, totalMs: 0, minMs: null, maxMs: null },
            settings: { count: 0, totalMs: 0, minMs: null, maxMs: null },
        };
        // Set by enqueueWrite(); consumed (and cleared) the next time chooseNextGroup() is asked -
        // forces a settings turn right after the WHOLE write queue has fully drained (request_data()
        // is only ever reached once nothing is left to send - see write_data_to_heatpump()'s
        // callers), so a just-written value shows up in the settings states promptly instead of
        // waiting out the rest of settingsMinIntervalMs. A single flag rather than per-write:
        // several writes queued together (a whole "set" of settings submitted at once) still drain
        // completely, uninterrupted, before this triggers exactly ONE refresh afterwards - never a
        // pause between the individual writes themselves.
        this.settingsRefreshNeededAfterWrite = false;
        // Pending "check again" timer while chooseNextGroup() found neither group due yet - see
        // scheduleNextGroupCheck(), the only place this is set.
        this.pollScheduleTimer = null;

        // ---- multi-block collection, sensor and/or settings (see beginGroupCollection()) ----
        // Only used for a group ('sensor' or 'settings') once
        // idm.firmwareSupportsMultiBlockRequestsForBlocks() is true for ALL of that group's
        // blocks (JSON-verified, e.g. S_H726100's settings blocks - or learned, see the
        // wireLength-learning fields below) - a group that doesn't qualify yet keeps using the
        // plain one-block-per-turn round-robin above, completely unchanged.
        //
        // {missing: Set<string>, collected: Map<string,string>, reaskDelay: number, reaskCount:
        // number} - exists only while a collection for activeMultiBlockGroup is in progress, from
        // beginGroupCollection() until it completes or gives up (see multiBlockMaxReasks) - see
        // finishGroupCollection(), the only place it's cleared. Only one collection is ever in
        // flight at a time: a group's collection holds the connection until every one of its
        // blocks has actually been found (or it gives up), re-asking with a bare 0172 (the control
        // already knows what was requested from the initial 0171 - no need to repeat the list)
        // after an adaptive backoff - this is deliberately the original (2.0.0) mechanism, built
        // directly from this feature's own captured real traffic, which needs several re-asks per
        // collection since the real control usually only returns a partial reply at first. Because
        // a collection is never interrupted by an unrelated (other-group) request in between, this
        // doesn't require any assumption about whether the control could resume a partial reply
        // across such an interruption - that situation simply never arises here.
        this.multiBlockCollector = null;
        // Which group's request is currently in flight (DATA_BLOCK_REQUESTED/
        // DATA_CONTENT_REQUESTED) - null when the in-flight request is a classic single
        // (non-multi-block) block request instead. Set by beginGroupCollection(), read by
        // receive_data() to decide whether an incoming reply is this group's.
        this.activeMultiBlockGroup = null;
        // Fixed replacement for contentDelayForCurrentBlock() while a multi-block request is in
        // flight: there is no single "currentDataBlock" a learned per-block delay could apply to,
        // and the control needs noticeably longer to prepare several blocks' worth of data than
        // just one (per this feature's real captured multi-block traffic). Only applies to the
        // FIRST 0172 of a collection - re-asks use multiBlockReaskBaseDelay/reaskMaxDelay instead.
        this.multiBlockContentDelay = 1000;
        // Delay before the first re-ask (bare 0172) after a reply that didn't complete the
        // collection; doubles (capped at multiBlockReaskMaxDelay) each time a re-ask comes back
        // with nothing new - the control isn't done preparing the rest yet, or, as observed
        // against real hardware, sometimes repeats the very same stale partial reply if asked
        // again too soon - and resets back down to the base once progress is made again.
        this.multiBlockReaskBaseDelay = 900;
        this.multiBlockReaskMaxDelay = 4000;
        // After this many re-asks without completing a group's collection, give up on it for now
        // (falling back to STATE.IDLE as if it had completed) rather than stalling that group
        // forever - its next turn starts a fresh collection for ALL of that group's blocks anyway,
        // so nothing is permanently lost, just deferred.
        this.multiBlockMaxReasks = 20;

        this.sendCount = 0;
        this.sendState = 0;
        this.itemToBeSent = undefined;
        this.needToSendData = false;

        this.sendInitTimer = null;
        this.sendDataBlockRequestTimer = null;
        this.sendDataContentTimer = null;
        this.sendSetValueMessageTimeout1 = null;
        this.sendSetValueMessageTimeout2 = null;
        this.reconnectTimer = null;
        this.resendInterval = null;
        this.responseWatchdogTimer = null;
    }

    protocolStateText() {
        return STATE_TEXT[this.protocolState] ?? `unknown (${this.protocolState})`;
    }

    /**
     * Logs the standard "wrong state, resetting connection" warning and resets the connection.
     * Every state-machine guard below used to copy-paste these same three lines (which is how
     * one of them ended up saying "shold" instead of "should" - a harmless but telling sign of
     * what copy-pasting seven near-identical blocks costs over time).
     * @param {string} methodName
     * @param {string | number} expectedDescription e.g. 2, or "-1 or 0"
     */
    failWrongState(methodName, expectedDescription) {
        this.log.warn(`${methodName}: wrong state, should be in ${expectedDescription} but we are in ${this.protocolState}, resetting connection`);
        this.setConnected(false, true);
    }

    // ---- response watchdog -------------------------------------------------------------
    // Every request we send expects a reply. Previously the ONLY thing that noticed a reply
    // never arriving was the much coarser setReconnectHandlerTimeout() below (silence for a
    // whole reconnectinterval, 90s by default) or the periodic full resync - so a single
    // dropped response could leave the state machine stalled for up to that long. This arms a
    // short-lived timer right after each such write and clears it once a complete, checksum-
    // valid frame comes back (not on every byte - see receive_data), so a genuinely missing
    // reply is noticed and recovered from much faster.

    armResponseWatchdog() {
        this.clearResponseWatchdog();
        this.responseWatchdogTimer = this.hooks.setTimeout(() => {
            this.responseWatchdogTimer = null;
            this.log.warn(`no response from the heatpump within ${this.responseTimeoutMs}ms while in state ${this.protocolState} (${this.protocolStateText()}), resetting connection`);
            this.setConnected(false, true);
        }, this.responseTimeoutMs);
    }

    clearResponseWatchdog() {
        if (this.responseWatchdogTimer) {
            this.hooks.clearTimeout(this.responseWatchdogTimer);
            this.responseWatchdogTimer = null;
        }
    }

    /**
     * Abandons any in-progress multi-block collection (see multiBlockCollector) - called wherever
     * the connection is about to be reset/resynced from scratch, so a collection with some blocks
     * already found doesn't silently keep counting them towards a collection that, from the
     * control's point of view, never happened. The next time that group's turn comes up it starts
     * a completely fresh collection, asking for all of its blocks again - nothing worse than that,
     * exactly like the single-block path already re-asks everything after a reset.
     */
    abandonMultiBlockCollections() {
        // Every call site of this method is, per its own comment there, a moment where "a fresh
        // lap starts for each group" - not just the group that happened to have an active
        // multi-block collection - so whatever partial progress either group's CURRENT sweep had
        // made (multi-block collection or round-robin lap alike) doesn't count towards a fresh
        // attempt's coverage either (see the constructor's blocksReadThisSweep comment, and
        // beginGroupCollection()'s comment for the same reasoning on the multi-block side). The
        // round-robin path picks this up automatically next time it's that group's turn (see
        // request_data() - a sweep with nothing read yet always restamps sweepStartedAt fresh).
        this.blocksReadThisSweep.sensor.clear();
        this.blocksReadThisSweep.settings.clear();
        this.multiBlockCollector = null;
        this.activeMultiBlockGroup = null;
    }

    AdjustSpeed() {
        if (this.speedAdjusted) return;
        const factor = this.idm.speed.get(this.version);
        if (factor != null && factor != 100 && factor > 0) {
            this.log.info('adjusting speed to ' + factor + '%');
            const f = 100 / factor;
            this.requestInitDelay = Math.round(this.requestInitDelay * f);
            this.requestDataBlockDelay = Math.round(this.requestDataBlockDelay * f);
            this.normalDataContentDelay = Math.round(this.normalDataContentDelay * f);
            this.retryDataContentDelay = Math.round(this.retryDataContentDelay * f);
            this.responseTimeoutMs = Math.round(this.responseTimeoutMs * f);
            // Scaled for consistency even though no multi-block-capable firmware currently
            // configures a non-100 speed (see idm.firmwareSupportsMultiBlockRequestsForBlocks()) -
            // every other timing this method touches is scaled, and there is no reason these
            // shouldn't be too if that ever changes.
            this.multiBlockContentDelay = Math.round(this.multiBlockContentDelay * f);
            this.multiBlockReaskBaseDelay = Math.round(this.multiBlockReaskBaseDelay * f);
            this.multiBlockReaskMaxDelay = Math.round(this.multiBlockReaskMaxDelay * f);
            this.speedAdjusted = true;
        }
    }

    /** Enqueues a raw wire message (from IdmProtocol#create_set_value_message) to be written. */
    enqueueWrite(message) {
        this.sendQueue.enqueue(message);
        // See the constructor's comment on settingsRefreshNeededAfterWrite - request_data() is
        // only ever reached once the whole queue has drained, so this alone is enough to make
        // sure several writes queued together finish uninterrupted before the refresh happens.
        this.settingsRefreshNeededAfterWrite = true;
    }

    /**
     * Logs, once per connection (called right after onVersion(), see receive_data()'s 'V'
     * branch), how many of each group's blocks still need a confirming live measurement before
     * that group can switch to multi-block requests (see
     * idm.firmwareSupportsMultiBlockRequestsForBlocks() / getVerifiedBlockWireLength()) - 0 means
     * the group starts on multi-block requests right away (every block's wireLength was already
     * confirmed - either a JSON-declared one confirmed earlier, or one restored and reconfirmed
     * from a previous run's persisted state); anything more means the classic one-block-at-a-time
     * round-robin runs for a little while first, passively confirming each one from real traffic
     * (see learnWireLengthFrom()) before this group's turns switch over.
     */
    logWireLengthMeasurementStatus() {
        const groups = [
            ['sensor', this.idm.getSensorDataBlocks(this.version)],
            ['settings', this.idm.getSettingsDataBlocks(this.version)],
        ];
        for (const [group, dataBlocks] of groups) {
            if (!dataBlocks || dataBlocks.length === 0) {
                // Logged once here rather than on every request_data() turn that would otherwise
                // have picked this group (chooseNextGroup() simply never selects an empty group,
                // so there's nothing left to log there) - a real, expected case for some
                // firmwares' settings group, not a misconfiguration.
                this.log.info('no ' + group + ' data blocks defined for ' + this.version + ', no ' + group + ' data will be requested');
                continue;
            }
            const unconfirmed = dataBlocks.filter((b) => this.idm.getVerifiedBlockWireLength(this.version, b) === null);
            if (unconfirmed.length === 0) {
                this.log.info(group + ': every block\'s wireLength is already confirmed - starting on multi-block requests right away');
            } else {
                this.log.info(group + ': ' + unconfirmed.length + ' of ' + dataBlocks.length + ' block(s) (' + unconfirmed.join(',') +
                    ') still need a confirming measurement before switching to multi-block requests - reading them one at a time for now');
            }
        }
    }

    // ---- connecting / reconnecting -----------------------------------------------------

    /** Starts (or restarts) the connection process. Call once the adapter is ready. */
    start() {
        this.connectAndRead();
        if (this.statsReportTimer) this.hooks.clearInterval(this.statsReportTimer);
        this.statsReportTimer = this.hooks.setInterval(this.reportSweepStats.bind(this), this.statsReportIntervalMs);
    }

    connectAndRead() {
        this.log.debug('trying to connect to ' + this.config.tcpserverip + ':' + this.config.tcpserverport);
        this.client = new net.Socket();
        this.hooks.setTimeout(this.startConnection.bind(this), this.socketRecycleTime);
    }

    startConnection() {
        if (this.client) {
            this.client.connect(this.config.tcpserverport, this.config.tcpserverip, this.socketConnectHandler.bind(this));
            this.client.on('error', this.socketErrorHandler.bind(this));
        }
        // create a timeout in case the connection does not get established within the configured interval
        this.reconnectTimer = this.hooks.setTimeout(this.connectAndRead.bind(this), this.config.reconnectinterval * 1000);
    }

    socketConnectHandler() {
        this.log.info('connection established');
        if (this.client) {
            this.client.on('data', this.receive_data.bind(this));
            this.client.on('close', this.socketCloseHandler.bind(this));
            this.client.on('disconnect', this.socketDisconnectHandler.bind(this));
        }
        if (this.reconnectTimer) {
            this.log.debug('clearing reconnect timer as we are connected');
            this.hooks.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        // now all is prepared we can start "talking" to our heatpump
        this.resendInterval = this.hooks.setInterval(this.send_first_init.bind(this), this.config.reconnectinterval * 1000);
        this.send_first_init(); // this triggers the first communication with the heatpump
    }

    socketDisconnectHandler() {
        this.client = null;
        this.log.info('disconnected from LAN to SERIAL adapter');
        this.setConnected(false, true);
    }

    socketCloseHandler() {
        this.client = null;
        this.log.info('socket closed from LAN to SERIAL adapter');
        this.setConnected(false, true);
    }

    socketErrorHandler() {
        this.protocolState = STATE.NOT_CONNECTED;
        this.log.info('connection error');
        this.setConnected(false, true);
    }

    setReconnectHandlerTimeout() {
        if (this.reconnectTimer) {
            this.hooks.clearTimeout(this.reconnectTimer);
            this.log.debug('cleared reconnect timer');
        }
        this.reconnectTimer = this.hooks.setTimeout(this.reconnectHandler.bind(this), this.config.reconnectinterval * 1000);
        this.log.debug('set new reconnect timer');
    }

    reconnectHandler() {
        this.log.info('reconnection attempt from reconnect-timer');
        this.setConnected(false, true);
    }

    /**
     * @param {boolean} isConnected
     * @param {boolean} [reconnect]
     */
    setConnected(isConnected, reconnect = false) {
        this.log.info('setConnected, current state ' + this.connected + '  new state ' + isConnected);

        if (this.connected !== isConnected) {
            this.connected = isConnected;
            this.log.debug('setting connected state to: ' + this.connected);

            if (isConnected === false) {
                this.clearResponseWatchdog();
                if (this.client) this.client.destroy();
                this.client = null;
                this.protocolState = STATE.NOT_CONNECTED;
                this.abandonMultiBlockCollections(); // a fresh lap starts for each group after reconnecting
                // A brand new connection means every group's minimum-interval clock starts over
                // too (see the constructor's sweepStartedAt comment) - there's no meaningful
                // "since when" to measure against a connection that no longer exists, and nothing
                // is lost by re-reading promptly once reconnected either.
                this.sweepStartedAt = { sensor: null, settings: null };
                if (this.pollScheduleTimer) { this.hooks.clearTimeout(this.pollScheduleTimer); this.pollScheduleTimer = null; }
                if (reconnect) {
                    this.log.info('reconnection requested');
                    if (this.resendInterval) {
                        this.hooks.clearInterval(this.resendInterval);
                        this.resendInterval = null;
                    }
                    if (!this.reconnectTimer) {
                        this.reconnectTimer = this.hooks.setTimeout(this.connectAndRead.bind(this), this.config.reconnectinterval * 1000);
                        this.log.info('reconnect timer set to ' + this.config.reconnectinterval + ' sec');
                    }
                }
            }

            this.hooks.onConnectionChange(this.connected);

            if (this.connected && this.version) { // connected, set interval for data readout
                if (this.resendInterval) {
                    this.hooks.clearInterval(this.resendInterval);
                    this.resendInterval = null;
                }
                if (this.reconnectTimer) {
                    this.log.debug('clearing reconnect timeout as we are connected');
                    this.hooks.clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
            }
        } else if (isConnected === false) {
            this.clearResponseWatchdog();
            this.protocolState = STATE.NOT_CONNECTED;
            this.abandonMultiBlockCollections(); // a fresh lap starts for each group after reconnecting
            this.sweepStartedAt = { sensor: null, settings: null }; // see the other branch's comment above
            if (this.pollScheduleTimer) { this.hooks.clearTimeout(this.pollScheduleTimer); this.pollScheduleTimer = null; }
            this.log.info('waiting for answer from heatpump, got disconnected from TCP to SERIAL adapter, stopping resend and try to reconnect');
            if (this.resendInterval) this.hooks.clearInterval(this.resendInterval);
            this.resendInterval = null;

            if (this.reconnectTimer) this.hooks.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = this.hooks.setTimeout(this.connectAndRead.bind(this), this.config.reconnectinterval * 1000);
            this.log.info('reconnect timer set to ' + this.config.reconnectinterval + ' sec');
        }
    }

    // ---- sending requests ----------------------------------------------------------------

    // First contact: force the state machine back to "not connected" and send init. Also
    // re-runs unconditionally every reconnectinterval seconds (see resendInterval above) as a
    // full protocol resync, regardless of what we were doing - this is existing, field-tested
    // behavior carried over as-is rather than "cleaned up", since changing it without testing
    // against real hardware could easily make things worse.
    send_first_init() {
        this.protocolState = STATE.NOT_CONNECTED;
        this.abandonMultiBlockCollections(); // this resync starts every group's lap over from scratch
        this.send_init();
    }

    send_init() {
        this.sendInitTimer = null;
        if (!this.connected) {
            this.log.info('sending initial init message to heatpump');
        }
        if (this.protocolState > STATE.IDLE) {
            this.failWrongState('send_init', `${STATE.NOT_CONNECTED} or ${STATE.IDLE}`);
            return;
        }

        const init_message = this.idm.create_init_message();
        this.log.silly('init message: ' + this.idm.get_protocol_string(init_message));
        if (this.client) {
            this.client.write(init_message);
            this.protocolState = STATE.INIT_SENT;
            this.armResponseWatchdog();
        }
    }

    /** @param {string} dataBlock */
    send_data_block_request(dataBlock) {
        this.sendDataBlockRequestTimer = null;
        if (this.protocolState !== STATE.INIT_ACKED) {
            if (this.protocolState === STATE.NOT_CONNECTED) {
                this.log.info('send_data_block_request: not connected, ignore');
                return;
            }
            this.failWrongState('send_data_block_request', STATE.INIT_ACKED);
            return;
        }
        this.log.debug('sending request');
        const requestMessage = this.idm.create_request_data_block_message(dataBlock);
        if (this.client) {
            this.client.write(requestMessage);
            this.protocolState = STATE.DATA_BLOCK_REQUESTED;
            this.armResponseWatchdog();
        }
    }

    /** @param {string} dataBlock */
    request_data_block(dataBlock) {
        this.currentDataBlock = dataBlock;
        if (dataBlock === '07') {
            this.log.info('data block ' + dataBlock + ': ' + this.totalRequests + ' total requests, ' +
                this.currentRetries + '/' + this.currentRequests + ' retries (avg ' +
                (this.totalRequests > 0 ? Math.round(this.totalRetries / this.totalRequests * 100) / 100 : 0) +
                '), delay ' + (this.contentDelayByBlock.get(dataBlock) ?? this.normalDataContentDelay) + 'ms');
            this.currentRequests = 0;
            this.currentRetries = 0;
        } else {
            this.log.debug('requesting data block ' + dataBlock);
        }
        this.sendDataBlockRequestTimer = this.hooks.setTimeout(this.send_data_block_request.bind(this, dataBlock), this.requestDataBlockDelay);
    }

    /**
     * All data block ids for `group` under the connected version.
     * @param {'sensor'|'settings'} group
     * @returns {string[]}
     */
    groupDataBlocks(group) {
        return (group === 'sensor' ? this.idm.getSensorDataBlocks(this.version) : this.idm.getSettingsDataBlocks(this.version)) ?? [];
    }

    /**
     * Which group `dataBlock` belongs to under the connected version - used by the classic
     * round-robin path (receive_data()'s single-block 'Data' branch) to know which group's sweep
     * a just-read block counts towards (see recordBlockRead()); the multi-block path already
     * knows this directly via activeMultiBlockGroup instead.
     * @param {string} dataBlock
     * @returns {'sensor'|'settings'|null}
     */
    groupOfBlock(dataBlock) {
        if (this.groupDataBlocks('sensor').includes(dataBlock)) return 'sensor';
        if (this.groupDataBlocks('settings').includes(dataBlock)) return 'settings';
        return null;
    }

    /**
     * Starts `group`'s multi-block collection - only ever called when
     * idm.firmwareSupportsMultiBlockRequestsForBlocks() is true for all of `group`'s blocks under
     * the connected version (see request_data()), and only when no other collection is already in
     * progress (a collection always runs to completion - or gives up - before the next one
     * starts, see request_data()'s comment). Mirrors request_data_block()'s pacing (the same
     * requestDataBlockDelay pause before actually sending) and sends one initial 0171 naming every
     * one of the group's blocks; any further blocks still missing after that are re-asked for via
     * bare 0172s from handleMultiBlockDataReply(), not another 0171 (see multiBlockCollector's
     * comment).
     *
     * Unconditionally starts a fresh sweep for `group` (clearing blocksReadThisSweep and
     * restamping sweepStartedAt) regardless of how any earlier attempt for this group ended -
     * a brand new collection always re-asks for the WHOLE group from scratch anyway, so whatever
     * partial progress (if any) a previous attempt made is no longer meaningful towards THIS
     * one's coverage. This also covers the two handleMultiBlockDataReply() paths that end a
     * collection without going through abandonMultiBlockCollections() (a parse error / "lost
     * sync", and giving up after multiBlockMaxReasks) - rather than having to reset
     * blocksReadThisSweep at every place a collection can end, it's simply reset here, the one
     * place a collection can ever START.
     * @param {'sensor'|'settings'} group
     */
    beginGroupCollection(group) {
        this.multiBlockCollector = {
            missing: new Set(this.groupDataBlocks(group)),
            collected: new Map(),
            reaskDelay: this.multiBlockReaskBaseDelay,
            reaskCount: 0,
        };
        this.currentDataBlock = null;
        this.activeMultiBlockGroup = group;
        this.blocksReadThisSweep[group].clear();
        this.sweepStartedAt[group] = Date.now();
        this.log.debug('requesting ' + group + ' blocks as one batch: ' + [...this.multiBlockCollector.missing].join(','));
        this.sendDataBlockRequestTimer = this.hooks.setTimeout(this.send_multi_block_data_request.bind(this), this.requestDataBlockDelay);
    }

    /** Sends the initial 0171 request for the active group's blocks (see beginGroupCollection()). */
    send_multi_block_data_request() {
        this.sendDataBlockRequestTimer = null;
        if (this.protocolState !== STATE.INIT_ACKED) {
            if (this.protocolState === STATE.NOT_CONNECTED) {
                this.log.info('send_multi_block_data_request: not connected, ignore');
                return;
            }
            this.failWrongState('send_multi_block_data_request', STATE.INIT_ACKED);
            return;
        }
        if (!this.multiBlockCollector) {
            // The collection was abandoned (e.g. a connection reset) while this send was
            // scheduled - nothing to do.
            this.log.debug('send_multi_block_data_request: no collection in progress, ignore');
            return;
        }
        const requested = [...this.multiBlockCollector.missing];
        this.log.debug('sending multi-block request for ' + this.activeMultiBlockGroup + ': ' + requested.join(','));
        const requestMessage = this.idm.create_request_multi_block_message(requested);
        if (this.client) {
            this.client.write(requestMessage);
            this.protocolState = STATE.DATA_BLOCK_REQUESTED;
            this.armResponseWatchdog();
        }
    }

    /**
     * The content delay actually in effect right now for `dataBlock`: the fixed
     * multiBlockContentDelay while it's part of an active multi-block-capable group (see
     * idm.firmwareSupportsMultiBlockRequestsForBlocks()), otherwise its own adaptively learned
     * delay (see updateContentDelayEstimate()) - normalDataContentDelay if it has never needed
     * more than that.
     *
     * Deliberately does NOT special-case a block whose wireLength isn't confirmed yet (see
     * idm.getVerifiedBlockWireLength()): learnWireLengthFrom()'s measurement is exactly as
     * correct regardless of how long this delay is (a single-block reply is fully checksum-framed
     * either way), and normalDataContentDelay is already the "deliberately unaggressive default"
     * (see its own comment) - there's nothing extra to be careful about, so nothing extra is done.
     *
     * Used by contentDelayForCurrentBlock() (via this.currentDataBlock).
     * @param {string} dataBlock
     * @returns {number}
     */
    currentDelayForBlock(dataBlock) {
        const inSensorGroup = (this.idm.getSensorDataBlocks(this.version) ?? []).includes(dataBlock);
        const groupIsMultiBlock = inSensorGroup
            ? this.idm.firmwareSupportsMultiBlockRequestsForSensors(this.version)
            : this.idm.firmwareSupportsMultiBlockRequests(this.version);
        if (groupIsMultiBlock) return this.multiBlockContentDelay;
        return this.contentDelayByBlock.get(dataBlock) ?? this.normalDataContentDelay;
    }

    /**
     * Marks a data block as actually read (content successfully received, not merely requested -
     * see receive_data()'s 'Data' branch and handleMultiBlockDataReply(), the only callers)
     * towards `group`'s current sweep, and finishes that sweep (see finishSweep()) once every one
     * of the group's blocks has been read at least once since it started.
     * @param {'sensor'|'settings'} group
     * @param {string} dataBlock
     */
    recordBlockRead(group, dataBlock) {
        this.blocksReadThisSweep[group].add(dataBlock);
        const allBlocks = this.groupDataBlocks(group);
        if (allBlocks.length === 0 || !allBlocks.every((b) => this.blocksReadThisSweep[group].has(b))) return;
        this.finishSweep(group);
    }

    /**
     * Called once `group`'s sweep has actually covered every one of its blocks (see
     * recordBlockRead(), the only caller) - logs the sweep's actual elapsed duration and a rolling
     * average over the last sweepAverageWindow sweeps at debug level (a sensor sweep normally
     * completes roughly every sensorMinIntervalMs, far too often for info - the periodic info-level
     * summary is reportSweepStats() instead), feeds sweepStatsSinceReport for that summary, and
     * clears blocksReadThisSweep so the NEXT sweep starts counting from zero. Does NOT touch
     * sweepStartedAt[group] itself - chooseNextGroup() restamps it fresh the moment this group's
     * next sweep actually begins (beginGroupCollection() for a multi-block group, or the first
     * block request of a new round-robin lap), since only then is "now" meaningful as that sweep's
     * start.
     * @param {'sensor'|'settings'} group
     */
    finishSweep(group) {
        const startedAt = this.sweepStartedAt[group];
        this.blocksReadThisSweep[group].clear();
        if (startedAt == null) return; // shouldn't happen, but nothing sane to log without it

        const elapsedMs = Date.now() - startedAt;
        const recent = this.recentSweepDurationsMs[group];
        recent.push(elapsedMs);
        if (recent.length > this.sweepAverageWindow) recent.shift();
        const avgMs = Math.round(recent.reduce((sum, ms) => sum + ms, 0) / recent.length);
        // Short on purpose (see request_data_block()'s block-07 line for the same reasoning) -
        // this only ever logs once per completed sweep, never more often than that group's own
        // sweep actually takes. debug level only (see reportSweepStats() for the info-level
        // summary) - too frequent for info in normal operation.
        this.log.debug(group + ' sweep done in ' + elapsedMs + 'ms (avg of last ' + recent.length + ': ' + avgMs + 'ms)');

        const stats = this.sweepStatsSinceReport[group];
        stats.count++;
        stats.totalMs += elapsedMs;
        stats.minMs = stats.minMs == null ? elapsedMs : Math.min(stats.minMs, elapsedMs);
        stats.maxMs = stats.maxMs == null ? elapsedMs : Math.max(stats.maxMs, elapsedMs);
    }

    /**
     * Logs one small info-level summary of both groups' sweep activity over the last
     * statsReportIntervalMs (fixed at 10 minutes - see the constructor), then resets
     * sweepStatsSinceReport so the next summary only covers the following window. Started as a
     * fixed interval by start() and cleared by stop(); this is the only info-level sweep-related
     * log in normal operation now that finishSweep() logs at debug level.
     */
    reportSweepStats() {
        const describe = (group) => {
            const stats = this.sweepStatsSinceReport[group];
            if (stats.count === 0) return group + ': 0 sweeps';
            const avgMs = Math.round(stats.totalMs / stats.count);
            return group + ': ' + stats.count + ' sweep(s), ' + avgMs + 'ms avg (min ' + stats.minMs + 'ms, max ' + stats.maxMs + 'ms)';
        };
        this.log.info('last ' + Math.round(this.statsReportIntervalMs / 60000) + 'min - ' + describe('sensor') + '; ' + describe('settings'));
        this.sweepStatsSinceReport.sensor = { count: 0, totalMs: 0, minMs: null, maxMs: null };
        this.sweepStatsSinceReport.settings = { count: 0, totalMs: 0, minMs: null, maxMs: null };
    }

    /**
     * True while `group`'s round-robin lap (see the constructor's "sweep" comment) has read SOME
     * but not yet ALL of its blocks - i.e. it's been started but not finished. A multi-block-
     * capable group's collection never reaches chooseNextGroup() mid-sweep at all (control
     * doesn't come back here until beginGroupCollection()'s single call either completes or gives
     * up - see finishGroupCollection()), so this only ever matters for the classic
     * one-block-per-turn path, which DOES return here between every individual block of the same
     * sweep - without this check, the OTHER group becoming due partway through a lap could
     * otherwise stretch that lap out indefinitely.
     * @param {'sensor'|'settings'} group
     * @returns {boolean}
     */
    sweepIncomplete(group) {
        const readSoFar = this.blocksReadThisSweep[group].size;
        return readSoFar > 0 && readSoFar < this.groupDataBlocks(group).length;
    }

    /**
     * Decides which group (if either) request_data() should serve this turn - see the
     * constructor's turn-scheduling comment for the rules this implements. Side-effect-free
     * except for consuming settingsRefreshNeededAfterWrite (see enqueueWrite()), so it's safe to
     * call again later (e.g. from scheduleNextGroupCheck()) without changing what an earlier call
     * already decided.
     *
     * Order of precedence: (1) a lap already in progress keeps its turns no matter what, (2) a
     * settings read forced by a just-drained write queue, since the whole point is to reflect
     * that write promptly, (3) sensor, once its own 10s minimum interval has passed, (4) settings,
     * once its own 60s minimum interval has passed. A group with no data blocks defined for the
     * connected version (settings, on some firmwares - see logWireLengthMeasurementStatus()) is
     * never selected.
     * @returns {'sensor'|'settings'|null} null when neither group is due yet
     */
    chooseNextGroup() {
        if (this.sweepIncomplete('sensor')) return 'sensor';
        if (this.sweepIncomplete('settings')) return 'settings';

        const sensorBlocks = this.groupDataBlocks('sensor');
        const settingsBlocks = this.groupDataBlocks('settings');

        if (settingsBlocks.length > 0 && this.settingsRefreshNeededAfterWrite) {
            this.settingsRefreshNeededAfterWrite = false;
            return 'settings';
        }

        const now = Date.now();
        if (sensorBlocks.length > 0 &&
            (this.sweepStartedAt.sensor == null || now - this.sweepStartedAt.sensor >= this.sensorMinIntervalMs)) {
            return 'sensor';
        }
        if (settingsBlocks.length > 0 &&
            (this.sweepStartedAt.settings == null || now - this.sweepStartedAt.settings >= this.settingsMinIntervalMs)) {
            return 'settings';
        }
        return null;
    }

    /**
     * Called by request_data() when chooseNextGroup() found neither group due yet - waits until
     * the earlier of the two groups' own remaining time, then asks again. Deliberately does NOT
     * go through another send_init/version handshake to do this: the connection is already
     * established and simply idle in the meantime, which is exactly what keeps this wait from
     * putting any extra load on the heat pump - the entire point of this feature.
     */
    scheduleNextGroupCheck() {
        const now = Date.now();
        const waits = [];
        if (this.groupDataBlocks('sensor').length > 0 && this.sweepStartedAt.sensor != null) {
            waits.push(this.sensorMinIntervalMs - (now - this.sweepStartedAt.sensor));
        }
        if (this.groupDataBlocks('settings').length > 0 && this.sweepStartedAt.settings != null) {
            waits.push(this.settingsMinIntervalMs - (now - this.sweepStartedAt.settings));
        }
        // Shouldn't happen - chooseNextGroup() only returns null once both groups have swept at
        // least once, so both waits above should exist - but fall back to the shorter interval
        // rather than parking forever on the off chance it ever does.
        const waitMs = waits.length > 0 ? Math.max(0, Math.min(...waits)) : this.sensorMinIntervalMs;
        this.pollScheduleTimer = this.hooks.setTimeout(() => {
            this.pollScheduleTimer = null;
            this.request_data();
        }, waitMs);
    }

    // Requests data for the connected version, one "turn" per call - see chooseNextGroup() for
    // what decides whether this turn is for the sensor or the settings group, or whether neither
    // is due yet (in which case this parks via scheduleNextGroupCheck() instead of requesting
    // anything). Within a group's turn: a multi-block-capable group (see
    // idm.firmwareSupportsMultiBlockRequestsForBlocks()) always collects the WHOLE group via
    // beginGroupCollection() before this turn is considered done; every other group keeps the
    // plain one-block-per-turn round-robin below, completely unchanged from before 2.1.0 except
    // that the start of a fresh lap now also stamps sweepStartedAt (mirroring what
    // beginGroupCollection() has always done for a multi-block group's collection).
    request_data() {
        if (this.groupDataBlocks('sensor').length === 0 && this.groupDataBlocks('settings').length === 0) {
            this.log.warn('no sensor or settings data blocks defined, no data will be requested');
            return;
        }

        const group = this.chooseNextGroup();
        if (!group) {
            this.scheduleNextGroupCheck();
            return;
        }
        this.log.debug('requesting data for ' + this.version + ' (' + group + ')');

        if (group === 'sensor') {
            const dataBlocks = this.groupDataBlocks('sensor');
            this.hooks.onNeedStates();
            if (this.idm.firmwareSupportsMultiBlockRequestsForSensors(this.version)) {
                this.beginGroupCollection('sensor');
                return;
            }
            if (this.blocksReadThisSweep.sensor.size === 0) this.sweepStartedAt.sensor = Date.now();
            this.lastSensorIndex %= dataBlocks.length;
            this.request_data_block(dataBlocks[this.lastSensorIndex++]);
            return;
        }

        const dataBlocks = this.groupDataBlocks('settings');
        if (this.idm.firmwareSupportsMultiBlockRequests(this.version)) {
            this.beginGroupCollection('settings');
            return;
        }
        if (this.blocksReadThisSweep.settings.size === 0) this.sweepStartedAt.settings = Date.now();
        this.lastSettingsIndex %= dataBlocks.length;
        this.request_data_block(dataBlocks[this.lastSettingsIndex++]);
    }

    /**
     * How long to wait, after the current data block's request was acked ("R1"), before asking
     * for its content - the hill-climbed delay for this specific data block (see
     * updateContentDelayEstimate()) if it has ever needed more than the default, otherwise
     * normalDataContentDelay itself (also the hard floor once a block's delay has grown, so this
     * never returns less than the original, deliberately unaggressive default). This is used
     * as-is while a block's wireLength is still being learned (see learnWireLengthFrom()) too -
     * that measurement's correctness doesn't depend on the delay at all (a single-block reply is
     * fully checksum-framed regardless of how long we waited before asking for it), and
     * normalDataContentDelay is already conservative, so there is nothing to special-case.
     *
     * Only ever called for a block NOT currently part of an active multi-block collection (see
     * receive_data()'s R1 branch, the only caller) - see currentDelayForBlock(), which this
     * delegates to.
     * @returns {number}
     */
    contentDelayForCurrentBlock() {
        if (this.currentDataBlock == null) return this.normalDataContentDelay;
        return this.currentDelayForBlock(this.currentDataBlock);
    }

    /**
     * Adjusts the delay for the current data block (this.currentDataBlock) based on whether THIS
     * cycle needed an "NR" retry (this.retryNeededThisCycle, set in receive_data()'s 'NR' branch,
     * cleared in the 'R1' branch): grow it (capped at 4x the default) if it did, since evidently
     * the delay we just used wasn't long enough for this block - or, after
     * contentDelayDecayAfterCleanCycles consecutive cycles that DIDN'T need a retry, ease it back
     * down a little (never below normalDataContentDelay). Called once the current cycle's content
     * was successfully received (receive_data()'s 'Data' branch).
     *
     * Deliberately not based on how long the cycle actually took: that time is mostly a
     * reflection of the delay we ourselves chose to wait before asking (if a block is ready well
     * before we ask, we still don't find out - we simply don't ask any earlier), so it can only
     * ever justify growing the delay, never discovering that a shorter one would also have
     * worked. Hill-climbing based on the plain "was a retry needed?" outcome instead lets the
     * delay for a block also come back down over time, converging on the actual sweet spot
     * instead of only ever ratcheting upward.
     *
     * The adaptive step itself isn't fixed - see stepByBlock: it starts coarse
     * (contentDelayDecreaseStep) and halves every time it's used to ease a block down, down to a
     * 1ms floor, so a block that's been stable for a while gets refined ever more finely instead
     * of only ever landing on multiples of 100ms. A retry corrects the delay back up by that SAME
     * step (however fine it had become), then doubles the step for next time (capped at
     * contentDelayIncreaseStep) - so a lone retry on an already finely-tuned block only costs a
     * small, proportional correction instead of always jumping by the full, disproportionate
     * contentDelayIncreaseStep; only genuinely repeated retries escalate the step back up toward
     * that coarse ceiling.
     */
    updateContentDelayEstimate() {
        if (this.currentDataBlock == null) return;
        const block = this.currentDataBlock;
        const current = this.contentDelayByBlock.get(block) ?? this.normalDataContentDelay;
        const cap = this.normalDataContentDelay * 4;

        if (this.retryNeededThisCycle) {
            const step = this.stepByBlock.get(block) ?? this.contentDelayDecreaseStep;
            this.contentDelayByBlock.set(block, Math.min(current + step, cap));
            this.cleanCyclesByBlock.set(block, 0);
            this.stepByBlock.set(block, Math.min(step * 2, this.contentDelayIncreaseStep));
            return;
        }

        const cleanCycles = (this.cleanCyclesByBlock.get(block) ?? 0) + 1;
        if (cleanCycles >= this.contentDelayDecayAfterCleanCycles && current > this.normalDataContentDelay) {
            const step = this.stepByBlock.get(block) ?? this.contentDelayDecreaseStep;
            this.contentDelayByBlock.set(block, Math.max(current - step, this.normalDataContentDelay));
            this.cleanCyclesByBlock.set(block, 0);
            this.stepByBlock.set(block, Math.max(1, Math.floor(step / 2)));
        } else {
            this.cleanCyclesByBlock.set(block, cleanCycles);
        }
    }

    /**
     * Passively learns `dataBlock`'s wireLength from one classic single-block reply (see
     * receive_data()'s single-block 'Data' branch, the only caller) - a no-op once the block
     * already has a trusted length (see idm.getVerifiedBlockWireLength()), whether JSON-declared
     * or already confirmed from an earlier measurement. Logs every outcome at a level matched to
     * how noteworthy it is: routine progress at info, a disagreement at warn (see
     * idm.recordMeasuredWireLength()'s comment for why that's worth a human's attention even
     * though it isn't a bug), and - the moment it happens - the group becoming multi-block-
     * capable, which is the actual point of all this.
     * @param {string} received_data the full received packet, as returned by get_data_packet()
     * @param {string} dataBlock the block this reply is for (this.currentDataBlock)
     */
    learnWireLengthFrom(received_data, dataBlock) {
        if (!this.version) return; // can't happen in practice (only called once a version is known), narrows this.version below
        if (this.idm.getVerifiedBlockWireLength(this.version, dataBlock) !== null) return; // nothing to learn
        const rawBlockId = received_data.slice(6, 8).toUpperCase();
        const measuredLength = (received_data.length - 8) / 2;

        const group = (this.idm.getSensorDataBlocks(this.version) ?? []).includes(rawBlockId) ? 'sensor'
            : (this.idm.getSettingsDataBlocks(this.version) ?? []).includes(rawBlockId) ? 'settings' : null;
        const wasGroupCapable = group === 'sensor' ? this.idm.firmwareSupportsMultiBlockRequestsForSensors(this.version)
            : group === 'settings' ? this.idm.firmwareSupportsMultiBlockRequests(this.version) : false;

        const result = this.idm.recordMeasuredWireLength(this.version, rawBlockId, measuredLength);
        if (result.status === 'first-measurement') {
            this.log.info('wireLength learning: block ' + rawBlockId + ' (' + this.version + ') measured ' + measuredLength +
                ' byte(s) - needs one more matching measurement before it is trusted for multi-block requests');
        } else if (result.status === 'mismatch') {
            this.log.warn('wireLength learning: block ' + rawBlockId + ' (' + this.version + ') measured ' + measuredLength +
                ' byte(s), disagreeing with the previous measurement - restarting its confirmation count from this new value');
        } else if (result.status === 'confirmed') {
            this.log.info('wireLength learning: block ' + rawBlockId + ' (' + this.version + ') confirmed at ' + measuredLength + ' byte(s)');
            this.hooks.onWireLengthLearned(this.version, rawBlockId, measuredLength);
            const nowGroupCapable = group === 'sensor' ? this.idm.firmwareSupportsMultiBlockRequestsForSensors(this.version)
                : group === 'settings' ? this.idm.firmwareSupportsMultiBlockRequests(this.version) : false;
            if (group && !wasGroupCapable && nowGroupCapable) {
                this.log.info('wireLength learning: every ' + group + ' block for ' + this.version +
                    ' now has a trusted wireLength - multi-block ' + group + ' requests start from its next turn');
            }
        }
    }

    request_data_content() {
        this.sendDataContentTimer = null;
        if (this.protocolState !== STATE.DATA_BLOCK_ACKED) {
            if (this.protocolState === STATE.NOT_CONNECTED) {
                this.log.info('request_data_content: not connected, ignore');
                return;
            }
            this.failWrongState('request_data_content', STATE.DATA_BLOCK_ACKED);
            return;
        }
        const message = this.idm.create_request_data_content_message();
        this.log.debug('requesting data content');
        if (this.client) {
            this.client.write(message);
            this.protocolState = STATE.DATA_CONTENT_REQUESTED;
            this.armResponseWatchdog();
        }
    }

    // Called twice for the same item: once from sendSetValueMessageTimeout1 and once (a bit
    // later) from sendSetValueMessageTimeout2, because the heatpump seems to need the value
    // sent a second time in most cases. We don't know which of the two timers fired here, so
    // we infer it from the fact that timer 1 is guaranteed to fire (and be nulled out) before
    // timer 2 ever does, and null out whichever timer just triggered this call.
    sendSetValueMessage(item) {
        if (this.sendSetValueMessageTimeout1 == null) {
            this.sendSetValueMessageTimeout2 = null;
        } else {
            this.sendSetValueMessageTimeout1 = null;
        }
        if (this.protocolState !== STATE.INIT_ACKED && this.protocolState !== STATE.IDLE) {
            this.failWrongState('sendSetValueMessage', `${STATE.INIT_ACKED} or ${STATE.IDLE}`);
            return;
        }
        const message = new Uint8Array(item.length);
        for (let i = 0; i < item.length; i++) message[i] = item[i];

        if (this.client) {
            this.client.write(message);
            this.log.debug('sent: ' + this.idm.get_protocol_string(message));
            this.protocolState = STATE.SET_VALUE_SENT;
            this.armResponseWatchdog();
        }
    }

    // Drains the send queue (up to maxWrites items per "loop"), sending each item twice with a
    // delay inbetween. Returns true if something was (or is about to be) written, false if
    // there is nothing left to send.
    write_data_to_heatpump(first_call) {
        this.log.debug('********* check if data has to be sent, max sent at once: ' + this.maxWrites);

        if (first_call) {
            this.sendCount = 0;
            this.sendState = 0;
        }
        if ((this.sendCount < this.maxWrites && this.sendQueue.hasItems) || this.sendState > 0) {
            this.log.debug('********* found data to be sent, state: ' + this.sendState);
            if (this.sendState === 0) {
                this.itemToBeSent = this.sendQueue.dequeue();
                this.log.debug('setting values: ' + this.idm.get_protocol_string(this.itemToBeSent));
                if (this.client) this.sendInitTimer = this.hooks.setTimeout(this.send_init.bind(this), this.setValueDelay);
                this.sendState++;
            } else if (this.sendState === 1) {
                if (this.client) this.sendSetValueMessageTimeout1 = this.hooks.setTimeout(this.sendSetValueMessage.bind(this, this.itemToBeSent), this.setValueDelay);
                this.sendState++;
            } else if (this.sendState === 2) {
                if (this.client) this.sendSetValueMessageTimeout2 = this.hooks.setTimeout(this.sendSetValueMessage.bind(this, this.itemToBeSent), this.secondSetValueOffset);
                this.sendState = 0;
                this.sendCount++;
            }
            return true;
        }
        return false;
    }

    // ---- receiving ------------------------------------------------------------------------

    // Main state-machine handler for data received from the control. See STATE/STATE_TEXT
    // above for idmProtocolState, and idm-protocol.js's protocol_state() for the possible
    // protocolState strings this reacts to (NR/E0/E1/E2/I1/R1/S1/Data_block_N/U1).
    receive_data(data) {
        // reset the "totally silent connection" watchdog on ANY data - this is deliberately
        // coarser than the response watchdog below (which only clears on a fully valid frame),
        // so it exists purely to notice a connection that has gone completely quiet.
        this.setReconnectHandlerTimeout();

        const state = this.idm.add_to_packet(data);
        if (state == 3) {
            this.clearResponseWatchdog(); // we got a complete, checksum-valid reply to something
            this.log.silly('************* receiving **************** state ' + state + ' data=' + this.idm.get_protocol_string(data));
            const received_data = this.idm.get_data_packet();
            this.idm.reset();
            const protocolState = this.idm.protocol_state(received_data);
            this.log.debug('protocol state ' + protocolState);

            if (protocolState === 'R1') { // successful data request, must be in state 3 -> 4
                if (this.protocolState !== STATE.DATA_BLOCK_REQUESTED) {
                    this.failWrongState('receive_data', STATE.DATA_BLOCK_REQUESTED);
                    return;
                }
                this.protocolState = STATE.DATA_BLOCK_ACKED;
                this.retryCount = 0;
                this.retryNeededThisCycle = false;
                this.totalRequests++;
                this.currentRequests++;
                // An active multi-block collection (see this.activeMultiBlockGroup) has no single
                // current data block a learned delay could apply to, and needs longer than any
                // one block does - see multiBlockContentDelay's comment.
                const contentDelay = this.activeMultiBlockGroup ? this.multiBlockContentDelay : this.contentDelayForCurrentBlock();
                this.sendDataContentTimer = this.hooks.setTimeout(this.request_data_content.bind(this), contentDelay);
                return;
            }
            if (protocolState === 'NR') {
                if (this.protocolState !== STATE.DATA_CONTENT_REQUESTED) {
                    this.failWrongState('receive_data', STATE.DATA_CONTENT_REQUESTED);
                    return;
                }
                if (this.retryCount > this.maxRetries) {
                    this.log.warn('too many data content request retries (' + this.retryCount + '), retry whole request.');
                    this.abandonMultiBlockCollections(); // a fresh lap starts for each group next time
                    this.protocolState = STATE.IDLE;
                    this.sendInitTimer = this.hooks.setTimeout(this.send_init.bind(this), this.requestInitDelay);
                    return;
                }
                this.retryCount++;
                this.retryNeededThisCycle = true;
                this.totalRetries++;
                this.currentRetries++;
                this.log.debug('retry data request ' + this.retryCount);
                this.protocolState = STATE.DATA_BLOCK_ACKED;
                this.sendDataContentTimer = this.hooks.setTimeout(this.request_data_content.bind(this), this.retryDataContentDelay);
                return;
            }
            if (protocolState === 'S1') { // must be in state 6
                if (this.protocolState !== STATE.SET_VALUE_SENT) {
                    this.failWrongState('receive_data', STATE.SET_VALUE_SENT);
                    return;
                }
                this.protocolState = STATE.IDLE;
                this.needToSendData = this.write_data_to_heatpump(!this.needToSendData);
                if (!this.needToSendData) {
                    this.sendInitTimer = this.hooks.setTimeout(this.send_init.bind(this), this.requestInitDelay);
                    this.log.debug('set timer to send init in order to request next data block');
                }
                return;
            }

            if (protocolState.slice(0, 4) === 'Data' && this.activeMultiBlockGroup) {
                // A multi-block reply for the active group's collection (see
                // beginGroupCollection()) - bypass interpret_data()/protocol_state()'s
                // single-block interpretation entirely, since it only ever looks at the FIRST
                // block a reply contains, and hand the whole packet to the multi-block parser
                // instead.
                if (this.protocolState !== STATE.DATA_CONTENT_REQUESTED) {
                    this.failWrongState('receive_data', STATE.DATA_CONTENT_REQUESTED);
                    return;
                }
                this.handleMultiBlockDataReply(received_data);
                return;
            }

            const text = this.idm.interpret_data(this.version, received_data, this.hooks.onFieldUpdate);
            this.log.debug('received data: ' + received_data.length + ' - ' + text);

            if (protocolState.slice(0, 4) == 'Data') { // received a data block
                if (this.protocolState !== STATE.DATA_CONTENT_REQUESTED) {
                    this.failWrongState('receive_data', STATE.DATA_CONTENT_REQUESTED);
                    return;
                }
                this.hooks.onDataBlockText(protocolState, text);
                this.updateContentDelayEstimate();
                if (this.currentDataBlock != null) {
                    this.learnWireLengthFrom(received_data, this.currentDataBlock);
                    const group = this.groupOfBlock(this.currentDataBlock);
                    if (group) this.recordBlockRead(group, this.currentDataBlock);
                }

                this.protocolState = STATE.IDLE;
                this.needToSendData = this.write_data_to_heatpump(!this.needToSendData);
                if (!this.needToSendData) {
                    this.sendInitTimer = this.hooks.setTimeout(this.send_init.bind(this), this.requestInitDelay);
                    this.log.debug('set time to send init in order to request next data block');
                }
                return;
            }

            if (text.slice(0, 1) === 'V') { // answer to the init message
                if (this.protocolState !== STATE.INIT_SENT) {
                    this.failWrongState('receive_data', STATE.INIT_SENT);
                    return;
                }
                this.protocolState = STATE.INIT_ACKED;
                if (!this.connected) {
                    const version = text.slice(9);
                    this.version = version;
                    this.setConnected(true);
                    this.AdjustSpeed();
                    this.hooks.onVersion(version);
                    this.logWireLengthMeasurementStatus();
                }
                if (this.needToSendData) {
                    this.needToSendData = this.write_data_to_heatpump(false);
                    this.log.debug('checked if we have to send data after init reply received');
                }
                if (!this.needToSendData) {
                    this.request_data();
                }
            } else {
                if (protocolState === 'E1' || protocolState === 'E2') {
                    this.log.warn('data content request error, retry whole request.');
                    this.protocolState = STATE.IDLE;
                    this.sendInitTimer = this.hooks.setTimeout(this.send_init.bind(this), this.requestInitDelay);
                    return;
                }
                this.log.warn('not sure what to do, idm-protocol-state ' + this.protocolStateText());
                this.log.warn('unknown protocol state ' + protocolState + ' data=' + text);
                this.log.warn('trying to send init message to restart communication');
                this.protocolState = STATE.IDLE;
                this.sendInitTimer = this.hooks.setTimeout(this.send_init.bind(this), this.requestInitDelay * 2);
            }
        } else if (state > 3) {
            this.log.debug('************* receiving **************** state ' + state + ' data=' + this.idm.get_protocol_string(data));
            this.log.warn('wrong state in receiving data, state is ' + state + ' resetting the transmission and retrying to continue communication');
            this.idm.reset();
            this.protocolState = STATE.IDLE;
            this.abandonMultiBlockCollections(); // a fresh lap starts for each group after this reset
            this.clearResponseWatchdog();
            // clear all timers to avoid confusion
            if (this.sendInitTimer) { this.hooks.clearTimeout(this.sendInitTimer); this.sendInitTimer = null; }
            if (this.sendDataBlockRequestTimer) { this.hooks.clearTimeout(this.sendDataBlockRequestTimer); this.sendDataBlockRequestTimer = null; }
            if (this.sendDataContentTimer) { this.hooks.clearTimeout(this.sendDataContentTimer); this.sendDataContentTimer = null; }
            if (this.sendSetValueMessageTimeout1) { this.hooks.clearTimeout(this.sendSetValueMessageTimeout1); this.sendSetValueMessageTimeout1 = null; }
            if (this.sendSetValueMessageTimeout2) { this.hooks.clearTimeout(this.sendSetValueMessageTimeout2); this.sendSetValueMessageTimeout2 = null; }
            if (this.pollScheduleTimer) { this.hooks.clearTimeout(this.pollScheduleTimer); this.pollScheduleTimer = null; }
            this.sendInitTimer = this.hooks.setTimeout(this.send_init.bind(this), this.requestInitDelay * 2);
        }
    }

    /**
     * Handles one 0172 reply for the ACTIVE group's multi-block collection (see
     * beginGroupCollection() / this.activeMultiBlockGroup). Parses every block the control
     * actually included this time (typically a PARTIAL subset of what was asked for - confirmed
     * real, expected control behavior, not a bug - see multiBlockCollector's comment), merges
     * newly found blocks into the collector, and either finishes the collection (complete, or
     * given up - see finishGroupCollection()) or schedules the next re-ask: a bare 0172, after an
     * adaptive backoff, WITHOUT sending another 0171 - the control already knows what was
     * requested from the initial one. Mirrors the single-block 'Data' branch's end-of-cycle
     * bookkeeping (recordBlockRead) as each block is found, not just at the end.
     *
     * A reply that couldn't be fully parsed (idm.parse_multi_block_reply()'s `error`) is treated
     * as a sign that one of the group's wireLengths is no longer correct - not a routine partial
     * reply - so on top of recording whatever blocks WERE successfully parsed before the error,
     * this immediately abandons the collection and forgets every one of the group's wireLengths
     * (see idm.forgetMeasuredWireLengths()), forcing a clean re-measurement rather than
     * continuing to (mis)use an assumption that just proved wrong.
     * @param {string} received_data
     */
    handleMultiBlockDataReply(received_data) {
        const group = this.activeMultiBlockGroup;
        const collector = this.multiBlockCollector;
        if (!group || !collector) {
            // Can't happen (receive_data() only calls this while both are set) - guarded anyway
            // so this can't ever throw on a stray/late call.
            this.log.warn('handleMultiBlockDataReply called with no collection in progress, ignoring');
            return;
        }
        const { blocks, error } = this.idm.parse_multi_block_reply(this.version, received_data, this.hooks.onFieldUpdate);

        let foundNew = false;
        for (const { block, text } of blocks) {
            if (!collector.missing.has(block)) continue; // already had this one this collection (a repeat) - ignore
            collector.missing.delete(block);
            collector.collected.set(block, text);
            foundNew = true;
            // Matches the naming main.js's CreateStates() already created the object under for
            // every data block (see idm_u.get_byte(element) there) and the single-block path's
            // protocol_state()-derived name ('Data_block_' + decimal block number).
            this.hooks.onDataBlockText('Data_block_' + Number.parseInt(block, 16), text);
            this.recordBlockRead(group, block);
        }

        if (error) {
            this.log.warn('multi-block reply for ' + group + ' could not be fully parsed (' + error + ') - a wireLength for one of its ' +
                'blocks is probably no longer correct; forcing re-measurement of every ' + group + ' block');
            this.idm.forgetMeasuredWireLengths(this.version, this.groupDataBlocks(group));
            this.finishGroupCollection();
            return;
        }

        this.log.debug('multi-block reply (' + group + '): found ' + blocks.map((b) => b.block).join(',') +
            ', still missing ' + [...collector.missing].join(',') + ' after ' + collector.reaskCount + ' re-ask(s)');

        if (collector.missing.size === 0) {
            this.log.debug('multi-block collection complete: ' + group);
            this.finishGroupCollection();
            return;
        }

        collector.reaskCount++;
        if (collector.reaskCount > this.multiBlockMaxReasks) {
            this.log.warn('multi-block collection for ' + group + ' gave up after ' + collector.reaskCount + ' re-ask(s), still missing ' +
                [...collector.missing].join(',') + ' - will retry all ' + group + ' blocks next turn');
            this.finishGroupCollection();
            return;
        }

        // Grow the backoff when a re-ask came back with nothing new (the control isn't done
        // preparing the rest yet, or - as observed against real hardware - sometimes repeats the
        // very same stale partial reply if asked again too soon); reset it back down once progress
        // is being made again (see multiBlockReaskBaseDelay/reaskMaxDelay's comment).
        collector.reaskDelay = foundNew
            ? this.multiBlockReaskBaseDelay
            : Math.min(collector.reaskDelay * 2, this.multiBlockReaskMaxDelay);

        this.protocolState = STATE.DATA_BLOCK_ACKED; // allows request_data_content() (0172) to be sent again
        this.sendDataContentTimer = this.hooks.setTimeout(this.request_data_content.bind(this), collector.reaskDelay);
    }

    /**
     * Ends the active group's collection (see handleMultiBlockDataReply(), the only caller) -
     * either complete or given up - and resumes the normal cycle (the NEXT turn's group is
     * decided fresh by chooseNextGroup(), same as always), exactly like the single-block 'Data'
     * branch in receive_data() does once its one block has been read. A completed collection has
     * already had finishSweep() fire for it via recordBlockRead() by the time this runs (its very
     * last block's recordBlockRead() call is what completes the sweep) - a given-up one hasn't,
     * so it logs nothing here, exactly like an incomplete round-robin lap never did either.
     */
    finishGroupCollection() {
        // A collection that GAVE UP partway (reaskCount exceeded multiBlockMaxReasks) or was
        // abandoned after an unparseable reply leaves behind whatever partial progress it DID
        // make (see recordBlockRead()) - clear it here rather than letting it linger: a completed
        // collection has already been cleared by finishSweep() (via its own last block's
        // recordBlockRead() call) by the time this runs, so this is a no-op in that case, but an
        // incomplete one would otherwise keep sweepIncomplete() reporting this group as "mid-sweep"
        // indefinitely - even though no collection is actually in progress any more - forcing
        // chooseNextGroup() to keep re-selecting it ahead of the OTHER group no matter how overdue
        // that one is, rather than letting the normal minimum-interval gating decide when this
        // group's next attempt should happen (which, after a whole failed collection's worth of
        // elapsed time, is usually right away anyway).
        if (this.activeMultiBlockGroup) this.blocksReadThisSweep[this.activeMultiBlockGroup].clear();
        this.multiBlockCollector = null;
        this.activeMultiBlockGroup = null;
        this.protocolState = STATE.IDLE;
        this.needToSendData = this.write_data_to_heatpump(!this.needToSendData);
        if (!this.needToSendData) {
            this.sendInitTimer = this.hooks.setTimeout(this.send_init.bind(this), this.requestInitDelay);
            this.log.debug('set time to send init in order to request next data block');
        }
    }

    // ---- shutdown ---------------------------------------------------------------------

    /** Tears everything down: sockets, all pending timers. Call from the adapter's onUnload. */
    stop() {
        this.setConnected(false);
        this.clearResponseWatchdog();
        if (this.reconnectTimer) { this.hooks.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        if (this.resendInterval) { this.hooks.clearInterval(this.resendInterval); this.resendInterval = null; }
        if (this.sendInitTimer) { this.hooks.clearTimeout(this.sendInitTimer); this.sendInitTimer = null; }
        if (this.sendDataBlockRequestTimer) { this.hooks.clearTimeout(this.sendDataBlockRequestTimer); this.sendDataBlockRequestTimer = null; }
        if (this.sendDataContentTimer) { this.hooks.clearTimeout(this.sendDataContentTimer); this.sendDataContentTimer = null; }
        if (this.sendSetValueMessageTimeout1) { this.hooks.clearTimeout(this.sendSetValueMessageTimeout1); this.sendSetValueMessageTimeout1 = null; }
        if (this.sendSetValueMessageTimeout2) { this.hooks.clearTimeout(this.sendSetValueMessageTimeout2); this.sendSetValueMessageTimeout2 = null; }
        if (this.pollScheduleTimer) { this.hooks.clearTimeout(this.pollScheduleTimer); this.pollScheduleTimer = null; }
        if (this.statsReportTimer) { this.hooks.clearInterval(this.statsReportTimer); this.statsReportTimer = null; }
        if (this.client) this.client.destroy();
    }
}

module.exports = { IdmSession, STATE };
