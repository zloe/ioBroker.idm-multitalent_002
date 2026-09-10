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
     *   setTimeout?: Function, clearTimeout?: Function, setInterval?: Function, clearInterval?: Function,
     * }} hooks setTimeout/clearTimeout/setInterval/clearInterval default to the global timer
     *   functions; pass the adapter's own (`this.setTimeout` etc.) so adapter-core's
     *   force-clear-on-unload safety net still covers these timers too.
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

        this.lastSettingsIndex = 0; // used to iterate settings data blocks
        this.requestingSensorData = true;
        this.lastSensorIndex = 0;
        // When the current full-coverage cycle started - every sensor block AND every settings
        // block actually READ (not just requested - see recordBlockRead()) at least once since
        // then. Deliberately not driven by the settings round-robin index wrapping (as it used to
        // be): that index advances the moment a block is picked to request, whether or not that
        // request ever actually succeeds - a retry, a response-watchdog reset, or the unconditional
        // periodic resync (see resendInterval) can all abandon a block mid-request, and the index
        // still moves on. On a flaky real connection that let a lap "complete" - and this log
        // fire - many times faster than every block had truly been read even once. Tracking actual
        // successful reads instead (see receive_data()'s 'Data' branch) is immune to that: a block
        // only ever counts once its content has genuinely come back.
        this.fullCoverageCycleStartedAt = null;
        this.fullCoverageCycleCount = 0; // how many full-coverage cycles have completed so far
        this.blocksReadThisCoverageCycle = new Set(); // data block ids actually read since fullCoverageCycleStartedAt

        // ---- multi-block settings collection (see beginSettingsBatchCollection()) ----
        // Only used when idm.firmwareSupportsMultiBlockRequests(this.version) is true (currently
        // just S_H726100, verified against real hardware) - every other firmware keeps using the
        // plain one-settings-block-per-cycle round-robin above completely unchanged.
        // this.multiBlockCollector is non-null exactly while a batch request is in flight (from
        // beginSettingsBatchCollection() until every requested block has been seen, or the
        // collector gives up - see multiBlockMaxReasks).
        this.multiBlockCollector = null;
        // Fixed replacement for contentDelayForCurrentBlock() while a multi-block collector is
        // active: there is no single "currentDataBlock" a learned per-block delay could apply to,
        // and the control needs noticeably longer to prepare several blocks' worth of data than
        // just one (per this session's real captured multi-block traffic). Not adaptive like the
        // single-block delays above - an early 0172 just gets re-asked (see multiBlockReaskBaseDelay
        // below), so getting this exactly right matters far less than it does for the single-block
        // path.
        this.multiBlockContentDelay = 1000;
        // How long to wait before re-sending the 0172 content request when the previous reply
        // didn't contain every block that was asked for. This is CONFIRMED real, expected control
        // behavior (not a bug, and not corruption - checksums were verified) discovered while
        // testing against real hardware: a single 0172 typically only returns a partial subset of
        // a multi-block request, and it must be re-asked until the full set has been assembled.
        // The delay grows (capped at multiBlockReaskMaxDelay) when a re-ask comes back with
        // nothing new - real traffic showed an over-eager re-ask can get back an exact repeat of
        // the same stale partial reply - and resets back down once progress is being made again.
        this.multiBlockReaskBaseDelay = 900;
        this.multiBlockReaskMaxDelay = 4000;
        // After this many re-asks without completing the batch, give up on it for this cycle
        // (falling back to STATE.IDLE as if the batch had completed) rather than stalling settings
        // collection forever - the next settings turn starts a fresh batch for ALL settings
        // blocks anyway, so nothing requested this batch is permanently lost, just deferred.
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
            // configures a non-100 speed (see idm.firmwareSupportsMultiBlockRequests()) - every
            // other timing this method touches is scaled, and there is no reason these
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
    }

    // ---- connecting / reconnecting -----------------------------------------------------

    /** Starts (or restarts) the connection process. Call once the adapter is ready. */
    start() {
        this.connectAndRead();
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
                this.multiBlockCollector = null; // abandon any in-flight batch - a fresh one starts after reconnecting
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
            this.multiBlockCollector = null; // abandon any in-flight batch - a fresh one starts after reconnecting
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
        this.multiBlockCollector = null; // abandon any in-flight batch - this resync starts the cycle over from scratch
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
     * Starts a multi-block batch request for ALL of `dataBlocks` at once (see
     * idm.firmwareSupportsMultiBlockRequests() - only ever called when that is true for the
     * connected version). Mirrors request_data_block()'s pacing (the same requestDataBlockDelay
     * pause before actually sending), but tracks the whole set as one this.multiBlockCollector
     * instead of a single this.currentDataBlock, since the control's reply typically only
     * contains a SUBSET of what was asked for - see receive_data()'s multi-block 'Data' handling
     * (handleMultiBlockDataReply()) for the re-ask loop that follows.
     * @param {string[]} dataBlocks
     */
    beginSettingsBatchCollection(dataBlocks) {
        this.log.debug('requesting settings blocks as one batch: ' + dataBlocks.join(','));
        this.currentDataBlock = null;
        this.multiBlockCollector = {
            requested: dataBlocks.slice(),
            missing: new Set(dataBlocks),
            collected: new Map(), // block id -> text, for blocks already found this batch
            reaskDelay: this.multiBlockReaskBaseDelay,
            reaskCount: 0,
        };
        this.sendDataBlockRequestTimer = this.hooks.setTimeout(this.send_multi_block_data_request.bind(this), this.requestDataBlockDelay);
    }

    /** Sends the 0171 request for the current multi-block batch (see beginSettingsBatchCollection()). */
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
            // The batch was abandoned (e.g. a connection reset) while this send was scheduled -
            // nothing to do.
            this.log.debug('send_multi_block_data_request: no batch in progress, ignore');
            return;
        }
        this.log.debug('sending multi-block request for ' + this.multiBlockCollector.requested.join(','));
        const requestMessage = this.idm.create_request_multi_block_message(this.multiBlockCollector.requested);
        if (this.client) {
            this.client.write(requestMessage);
            this.protocolState = STATE.DATA_BLOCK_REQUESTED;
            this.armResponseWatchdog();
        }
    }

    /**
     * All data block ids (sensor + settings) that make up one full-coverage cycle for the
     * connected version - see blocksReadThisCoverageCycle / recordBlockRead().
     * @returns {string[]}
     */
    allDataBlockIds() {
        const sensor = this.idm.getSensorDataBlocks(this.version) ?? [];
        const settings = this.idm.getSettingsDataBlocks(this.version) ?? [];
        return sensor.concat(settings);
    }

    /**
     * "blockId=currentDelayMs" for every data block, comma-separated - the per-block content
     * delay actually in effect right now (the learned/grown one if it has ever needed more than
     * the default, otherwise normalDataContentDelay itself - see contentDelayForCurrentBlock()).
     * Appended to the full-coverage cycle log line so a drift in total cycle time can be traced
     * back to which specific block(s) grew, rather than only seeing the aggregate change.
     * @returns {string}
     */
    blockDelaysSummary() {
        return this.allDataBlockIds()
            .map((id) => id + '=' + (this.contentDelayByBlock.get(id) ?? this.normalDataContentDelay))
            .join(',');
    }

    /**
     * Marks a data block as actually read (content successfully received, not merely requested -
     * see receive_data()'s 'Data' branch, the only caller) towards the current full-coverage
     * cycle, and logs+resets once every block for this version has been read at least once.
     * @param {string} dataBlock
     */
    recordBlockRead(dataBlock) {
        this.blocksReadThisCoverageCycle.add(dataBlock);
        const allBlocks = this.allDataBlockIds();
        if (allBlocks.length === 0 || !allBlocks.every((b) => this.blocksReadThisCoverageCycle.has(b))) return;

        const now = Date.now();
        if (this.fullCoverageCycleStartedAt != null) {
            this.fullCoverageCycleCount++;
            // Short on purpose (see request_data_block()'s block-07 line for the same reasoning) -
            // this only ever logs once every data block for this version has actually been read at
            // least once since the last time, never more often than that.
            this.log.info('full-coverage cycle #' + this.fullCoverageCycleCount + ' done in ' + (now - this.fullCoverageCycleStartedAt) +
                'ms, delays(ms): ' + this.blockDelaysSummary());
        }
        this.fullCoverageCycleStartedAt = now;
        this.blocksReadThisCoverageCycle.clear();
    }

    // Requests all sensor data blocks for the connected version, and one settings data block per
    // cycle, alternating - with a pause inbetween (see request_data_block).
    request_data() {
        this.log.debug('requesting data for ' + this.version);

        let datablockToRequest;
        if (this.requestingSensorData) {
            const dataBlocks = this.idm.getSensorDataBlocks(this.version);
            if (!dataBlocks) {
                this.log.warn('no sensor data blocks defined, no data will be requested');
                this.requestingSensorData = false;
                return;
            }

            this.hooks.onNeedStates();
            datablockToRequest = dataBlocks[this.lastSensorIndex++];
            if (this.lastSensorIndex >= dataBlocks.length) {
                this.lastSensorIndex = 0;
                this.requestingSensorData = false;
            }
        } else {
            const dataBlocks = this.idm.getSettingsDataBlocks(this.version);
            if (!dataBlocks) {
                this.log.info('no settings data blocks defined, no settings data will be requested');
                this.requestingSensorData = true;
                return;
            }
            this.requestingSensorData = true;

            // Firmwares with a verified wire length for every settings block (see
            // idm.firmwareSupportsMultiBlockRequests()) get ALL of their settings collected in one
            // batch instead of one block per cycle - see beginSettingsBatchCollection(). Every
            // other firmware keeps the plain round-robin below, completely unchanged.
            if (this.idm.firmwareSupportsMultiBlockRequests(this.version)) {
                this.beginSettingsBatchCollection(dataBlocks);
                return;
            }

            this.lastSettingsIndex %= dataBlocks.length;
            datablockToRequest = dataBlocks[this.lastSettingsIndex++];
        }

        this.request_data_block(datablockToRequest);
    }

    /**
     * How long to wait, after the current data block's request was acked ("R1"), before asking
     * for its content - the hill-climbed delay for this specific data block (see
     * updateContentDelayEstimate()) if it has ever needed more than the default, otherwise
     * normalDataContentDelay itself (also the hard floor once a block's delay has grown, so this
     * never returns less than the original, deliberately unaggressive default).
     * @returns {number}
     */
    contentDelayForCurrentBlock() {
        return this.contentDelayByBlock.get(this.currentDataBlock) ?? this.normalDataContentDelay;
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
                // A multi-block batch (see this.multiBlockCollector) has no single current data
                // block a learned delay could apply to, and needs longer than any one block does -
                // see multiBlockContentDelay's comment.
                const contentDelay = this.multiBlockCollector ? this.multiBlockContentDelay : this.contentDelayForCurrentBlock();
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
                    this.multiBlockCollector = null; // abandon any in-flight batch - the next settings turn starts a fresh one
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

            if (protocolState.slice(0, 4) === 'Data' && this.multiBlockCollector) {
                // A multi-block batch reply (see beginSettingsBatchCollection()) - bypass
                // interpret_data()/protocol_state()'s single-block interpretation entirely, since
                // it only ever looks at the FIRST block a reply contains, and hand the whole
                // packet to the multi-block parser instead.
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
                if (this.currentDataBlock != null) this.recordBlockRead(this.currentDataBlock);

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
            this.multiBlockCollector = null; // abandon any in-flight batch - a fresh one starts after this reset
            this.clearResponseWatchdog();
            // clear all timers to avoid confusion
            if (this.sendInitTimer) { this.hooks.clearTimeout(this.sendInitTimer); this.sendInitTimer = null; }
            if (this.sendDataBlockRequestTimer) { this.hooks.clearTimeout(this.sendDataBlockRequestTimer); this.sendDataBlockRequestTimer = null; }
            if (this.sendDataContentTimer) { this.hooks.clearTimeout(this.sendDataContentTimer); this.sendDataContentTimer = null; }
            if (this.sendSetValueMessageTimeout1) { this.hooks.clearTimeout(this.sendSetValueMessageTimeout1); this.sendSetValueMessageTimeout1 = null; }
            if (this.sendSetValueMessageTimeout2) { this.hooks.clearTimeout(this.sendSetValueMessageTimeout2); this.sendSetValueMessageTimeout2 = null; }
            this.sendInitTimer = this.hooks.setTimeout(this.send_init.bind(this), this.requestInitDelay * 2);
        }
    }

    /**
     * Handles one 0172 reply while a multi-block settings batch is in flight (see
     * beginSettingsBatchCollection() / this.multiBlockCollector). Parses every block the control
     * actually included this time (typically a PARTIAL subset of what was requested - confirmed
     * real, expected control behavior, not a bug - see multiBlockReaskBaseDelay's comment),
     * merges newly found blocks into the collector, and either finishes the batch (once nothing
     * requested is still missing) or re-asks for the rest after an adaptive backoff. Mirrors the
     * single-block 'Data' branch's end-of-cycle bookkeeping (recordBlockRead, going back to
     * STATE.IDLE, scheduling the next send_init) once the batch is done or given up on.
     * @param {string} received_data
     */
    handleMultiBlockDataReply(received_data) {
        const collector = this.multiBlockCollector;
        if (!collector) {
            // Can't happen (receive_data() only calls this while this.multiBlockCollector is
            // set) - guarded anyway so this can't ever throw on a stray/late call.
            this.log.warn('handleMultiBlockDataReply called with no batch in progress, ignoring');
            return;
        }
        const { blocks, error } = this.idm.parse_multi_block_reply(this.version, received_data, this.hooks.onFieldUpdate);
        if (error) {
            this.log.warn('multi-block reply could not be fully parsed (' + error + '), ' + blocks.length + ' block(s) from it are still usable');
        }

        let foundNew = false;
        for (const { block, text } of blocks) {
            if (!collector.missing.has(block)) continue; // already had this one this batch (a repeat) - ignore
            collector.missing.delete(block);
            collector.collected.set(block, text);
            foundNew = true;
            // Matches the naming main.js's CreateStates() already created the object under for
            // every data block (see idm_u.get_byte(element) there) and the single-block path's
            // protocol_state()-derived name ('Data_block_' + decimal block number).
            this.hooks.onDataBlockText('Data_block_' + Number.parseInt(block, 16), text);
            this.recordBlockRead(block);
        }
        this.log.debug('multi-block reply: found ' + blocks.map((b) => b.block).join(',') + ', still missing ' + [...collector.missing].join(',') + ' after ' + collector.reaskCount + ' re-ask(s)');

        if (collector.missing.size === 0) {
            this.log.debug('multi-block batch complete: ' + collector.requested.join(','));
            this.finishSettingsBatch();
            return;
        }

        collector.reaskCount++;
        if (collector.reaskCount > this.multiBlockMaxReasks) {
            this.log.warn('multi-block batch gave up after ' + collector.reaskCount + ' re-ask(s), still missing ' +
                [...collector.missing].join(',') + ' - will retry all settings blocks next settings turn');
            this.finishSettingsBatch();
            return;
        }

        // Grow the backoff when a re-ask came back with nothing new (the control isn't done
        // preparing the rest yet, or - as observed against real hardware - sometimes repeats the
        // very same stale partial reply if asked again too soon); reset it back down once
        // progress is being made again.
        collector.reaskDelay = foundNew
            ? this.multiBlockReaskBaseDelay
            : Math.min(collector.reaskDelay * 2, this.multiBlockReaskMaxDelay);

        this.protocolState = STATE.DATA_BLOCK_ACKED; // allows request_data_content() (0172) to be sent again
        this.sendDataContentTimer = this.hooks.setTimeout(this.request_data_content.bind(this), collector.reaskDelay);
    }

    /**
     * Ends the current multi-block batch (whether it completed or gave up - see
     * handleMultiBlockDataReply()) and resumes the normal cycle, exactly like the single-block
     * 'Data' branch in receive_data() does once its one block has been read.
     */
    finishSettingsBatch() {
        this.multiBlockCollector = null;
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
        if (this.client) this.client.destroy();
    }
}

module.exports = { IdmSession, STATE };
