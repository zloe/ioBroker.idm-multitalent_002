'use strict';

// Unit tests for the connection + request/response state machine extracted into IdmSession
// (previously part of main.js - see the class comment in idm-session.js for why). These tests
// drive it directly, with net.Socket replaced by a fully test-controlled fake and every
// ioBroker-facing side effect (setting a state, creating states, ...) observed through the
// `hooks` IdmSession reports back through, instead of needing a real or faked ioBroker adapter.

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noPreserveCache();
const { EventEmitter } = require('events');

const IdmProtocol = require('./idm-protocol');
const idm_u = require('./idm-utils');
const { STATE } = require('./idm-session');

// Only used to build the expected wire bytes for comparisons (create_message/create_init_message
// etc. don't depend on any loaded state), not as the session's own protocol state.
const idm = new IdmProtocol();

/** A minimal stand-in for a TCP net.Socket, fully driven by the test. */
class FakeSocket extends EventEmitter {
    constructor() {
        super();
        this.written = [];
        this.destroyed = false;
    }
    connect(port, host, onConnect) {
        this.connectedTo = { port, host };
        if (onConnect) this.once('connect', onConnect);
        return this;
    }
    write(data) {
        this.written.push(Buffer.from(data));
        return true;
    }
    destroy() {
        this.destroyed = true;
    }
}

function hexEncodeAscii(str) {
    return [...str].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join('');
}

function makeHooks() {
    return {
        onConnectionChange: sinon.stub(),
        onVersion: sinon.stub(),
        onNeedStates: sinon.stub(),
        onDataBlockText: sinon.stub(),
        onFieldUpdate: sinon.stub(),
        onWireLengthLearned: sinon.stub(),
    };
}

function makeLog() {
    return {
        silly: sinon.stub(), debug: sinon.stub(), info: sinon.stub(),
        warn: sinon.stub(), error: sinon.stub(),
    };
}

describe('idm-session (connection + request/response state machine)', () => {
    let clock, sockets, session, hooks, log;

    beforeEach(() => {
        idm.reset();
        idm.initialize();
        sockets = [];

        class TrackedFakeSocket extends FakeSocket {
            constructor() {
                super();
                sockets.push(this);
            }
        }

        const { IdmSession } = proxyquire('./idm-session', {
            'node:net': { Socket: TrackedFakeSocket, '@noCallThru': true },
        });

        clock = sinon.useFakeTimers();
        hooks = makeHooks();
        log = makeLog();
        session = new IdmSession(idm, { tcpserverip: '10.0.0.1', tcpserverport: 4001, reconnectinterval: 90 }, log, hooks);
        // Stubbed out by default: most tests below reuse the same fixed-length payload (e.g.
        // dataBlock07) for whatever block they're driving, which - with the real
        // learnWireLengthFrom() active - would passively CONFIRM that block's wireLength after
        // just two reads and could flip a version like idm701100 into multi-block mode mid-test,
        // even though these tests are not about wireLength learning at all and never asked for
        // that. The "wireLength learning" describe block below restores the real implementation
        // (session.learnWireLengthFrom.restore()) to test it deliberately and in isolation.
        sinon.stub(session, 'learnWireLengthFrom');
    });

    afterEach(() => {
        clock.restore();
    });

    /** Drives the session from start() through a live (fake) TCP connection. Returns the socket. */
    function connect() {
        session.start(); // connectAndRead -> (after socketRecycleTime) startConnection -> net.Socket#connect
        clock.tick(session.socketRecycleTime);
        const socket = sockets[sockets.length - 1];
        socket.emit('connect'); // socketConnectHandler -> send_first_init()
        return socket;
    }

    /** Builds the raw wire bytes for a successful version/init response. */
    function versionResponse(version) {
        return idm.create_message('01E0' + hexEncodeAscii(version));
    }

    it('sends an init message once the socket connects', () => {
        const socket = connect();
        expect(socket.written).to.have.lengthOf(1);
        expect(idm_u.get_string_uint8array(socket.written[0])).to.equal(
            idm_u.get_string_uint8array(idm.create_init_message())
        );
        expect(session.protocolState).to.equal(STATE.INIT_SENT);
    });

    it('reports the version and connection, and starts requesting data after a valid init reply', () => {
        const socket = connect();

        socket.emit('data', versionResponse('idm701100'));

        expect(session.version).to.equal('idm701100');
        expect(hooks.onVersion.calledOnceWith('idm701100')).to.be.true;
        expect(hooks.onConnectionChange.calledWith(true)).to.be.true;
        expect(session.connected).to.equal(true);
        expect(session.protocolState).to.equal(STATE.INIT_ACKED);

        clock.tick(session.requestDataBlockDelay);
        expect(socket.written).to.have.lengthOf(2); // init + first data block request
        expect(session.protocolState).to.equal(STATE.DATA_BLOCK_REQUESTED);
    });

    it('runs a full successful cycle: init -> data block ack -> data content -> parsed data', () => {
        const socket = connect();
        socket.emit('data', versionResponse('idm701100'));
        clock.tick(session.requestDataBlockDelay); // sends the data block request, state -> 3

        // Control acknowledges the data block request ("R1")
        socket.emit('data', idm.create_message('01F10000'));
        expect(session.protocolState).to.equal(STATE.DATA_BLOCK_ACKED);

        clock.tick(session.normalDataContentDelay); // sends the data content request, state -> 5
        expect(session.protocolState).to.equal(STATE.DATA_CONTENT_REQUESTED);

        // Control sends back a real, previously-captured data block 07 payload
        const dataBlock07 = '00000000000000000000000000000000000000000B270000000000000000';
        socket.emit('data', idm.create_message('01F20007' + dataBlock07));

        // back to idle, and a new init was scheduled to fetch the next data block
        expect(session.protocolState).to.equal(STATE.IDLE);
        expect(hooks.onDataBlockText.calledOnce).to.be.true;
        expect(hooks.onDataBlockText.firstCall.args[0]).to.equal('Data_block_7');
        expect(hooks.onDataBlockText.firstCall.args[1]).to.be.a('string').and.not.empty;
    });

    it('retries on "NR" (not ready) up to the retry limit before giving up and restarting', () => {
        const socket = connect();
        socket.emit('data', versionResponse('idm701100'));
        clock.tick(session.requestDataBlockDelay);
        socket.emit('data', idm.create_message('01F10000')); // R1 ack
        clock.tick(session.normalDataContentDelay); // -> state 5, data content requested

        // Respond with "not ready" a few times - each retry should re-request the content
        // without resetting the whole connection.
        for (let i = 1; i <= 3; i++) {
            const writesBefore = socket.written.length;
            socket.emit('data', idm.create_message('01F201'));
            expect(session.protocolState, `after retry ${i}`).to.equal(STATE.DATA_BLOCK_ACKED);
            clock.tick(session.retryDataContentDelay);
            expect(socket.written.length, `retry ${i} should have sent another data content request`).to.equal(writesBefore + 1);
            expect(session.protocolState, `after retry ${i} request sent`).to.equal(STATE.DATA_CONTENT_REQUESTED);
        }
        expect(session.retryCount).to.equal(3);
    });

    it('resets the connection when a response arrives in an unexpected protocol state', () => {
        const socket = connect();
        // We are in state 1 (init sent, waiting for the version reply). An "R1" response is
        // only valid in state 3, so this should be treated as a protocol error and trigger a
        // reconnect instead of silently being accepted.
        sockets.length = 0;
        socket.emit('data', idm.create_message('01F10000'));

        expect(session.protocolState).to.equal(STATE.NOT_CONNECTED);
        // We were never fully connected yet, so there is nothing to tear down beyond
        // resetting the protocol state and scheduling a fresh connection attempt.
        expect(session.connected).to.equal(false);
        expect(session.reconnectTimer).to.exist;

        clock.tick(session.config.reconnectinterval * 1000);
        expect(sockets, 'a new connection attempt should have been started').to.have.lengthOf(1);
    });

    it('clears every pending timer on stop(), not just reconnect/resend', () => {
        const socket = connect();
        socket.emit('data', versionResponse('idm701100'));
        clock.tick(session.requestDataBlockDelay);
        socket.emit('data', idm.create_message('01F10000')); // -> state 4, schedules sendDataContentTimer

        expect(session.sendDataContentTimer, 'sendDataContentTimer should be pending').to.be.ok;
        expect(clock.countTimers()).to.be.greaterThan(0);

        session.stop();

        expect(session.sendInitTimer, 'sendInitTimer').to.not.be.ok;
        expect(session.sendDataBlockRequestTimer, 'sendDataBlockRequestTimer').to.not.be.ok;
        expect(session.sendDataContentTimer, 'sendDataContentTimer').to.not.be.ok;
        expect(session.sendSetValueMessageTimeout1, 'sendSetValueMessageTimeout1').to.not.be.ok;
        expect(session.sendSetValueMessageTimeout2, 'sendSetValueMessageTimeout2').to.not.be.ok;
        expect(session.responseWatchdogTimer, 'responseWatchdogTimer').to.not.be.ok;
        // No timer should still be scheduled after stop() - previously (in main.js) several of
        // these were left running and could still fire against the (by then destroyed) socket.
        expect(clock.countTimers()).to.equal(0);
    });

    it('also clears a pending pollScheduleTimer (the idle "neither group due yet" recheck) on stop()', () => {
        connect();
        session.sweepStartedAt = { sensor: Date.now(), settings: Date.now() }; // neither due right now
        session.scheduleNextGroupCheck();
        expect(session.pollScheduleTimer, 'a recheck should have been scheduled').to.be.ok;

        session.stop();

        expect(session.pollScheduleTimer, 'pollScheduleTimer').to.not.be.ok;
        expect(clock.countTimers()).to.equal(0);
    });

    it('also clears the periodic statsReportTimer started by start() on stop()', () => {
        connect();
        expect(session.statsReportTimer, 'start() should have scheduled the periodic stats report').to.be.ok;

        session.stop();

        expect(session.statsReportTimer, 'statsReportTimer').to.not.be.ok;
        expect(clock.countTimers()).to.equal(0);
    });

    describe('sweep tracking reset on disconnect (see setConnected())', () => {
        it('resets both groups\' sweepStartedAt and cancels a pending idle recheck when the connection drops', () => {
            connect();
            session.sweepStartedAt = { sensor: Date.now(), settings: Date.now() };
            session.scheduleNextGroupCheck();
            expect(session.pollScheduleTimer).to.be.ok;

            session.setConnected(false, false);

            expect(session.sweepStartedAt).to.deep.equal({ sensor: null, settings: null });
            expect(session.pollScheduleTimer).to.not.be.ok;
        });
    });

    describe('sweep timing (per-group actual read time + rolling average, see finishSweep())', () => {
        const dataBlock07 = '00000000000000000000000000000000000000000B270000000000000000';

        // Fully drives the currently in-flight data block request to a successful completion (R1
        // ack, then its content) and then re-establishes the connection (init resend + version
        // reply) the way the real protocol does before every subsequent block request - which
        // triggers request_data() again for the next block.
        function completeCurrentBlockAndAdvance(socket) {
            clock.tick(session.requestDataBlockDelay);
            socket.emit('data', idm.create_message('01F10000')); // R1 ack
            clock.tick(session.contentDelayForCurrentBlock());
            socket.emit('data', idm.create_message('01F20007' + dataBlock07)); // content actually arrives - block read
            clock.tick(session.requestInitDelay);
            socket.emit('data', versionResponse('idm701100')); // re-init roundtrip -> next block's request_data()
        }

        it('logs the sensor sweep\'s elapsed time once all 4 distinct sensor blocks have actually been read, not any sooner', () => {
            const socket = connect();
            // idm701100 has 4 sensor blocks (07,09,0A,0B) - sweepIncomplete() keeps every turn on
            // sensor until all 4 have been read at least once (see the constructor's "sweep"
            // comment), regardless of settings' own due-ness in the meantime.
            const sensorSweepLogs = () => log.debug.getCalls().filter(c => /^sensor sweep done in /.test(c.args[0]));

            socket.emit('data', versionResponse('idm701100')); // sensor block 07 in flight (1st of 4)

            for (let i = 0; i < 3; i++) completeCurrentBlockAndAdvance(socket); // reads 09, 0A - 3rd call requests the 4th (0B)
            expect(sensorSweepLogs(), 'only 3 of 4 sensor blocks read so far').to.have.lengthOf(0);

            completeCurrentBlockAndAdvance(socket); // reads 0B - the 4th and last distinct sensor block
            const logs = sensorSweepLogs();
            expect(logs, 'expected exactly one log call once the sweep completes').to.have.lengthOf(1);
            expect(logs[0].args[0]).to.match(/^sensor sweep done in \d+ms \(avg of last 1: \d+ms\)$/);

            // The very next turn should be settings (never yet swept, so immediately due) - sensor
            // itself is not due again yet (its own 4-block sweep took less than sensorMinIntervalMs).
            expect(session.currentDataBlock, 'the next turn should have moved on to settings').to.equal('03');
        });

        it('only counts a block once its content has actually been received - not merely once requested', () => {
            // This is the historical bug, fixed in 2.1.0: the round-robin index used to advance
            // (and could wrap a "lap") the moment a block was picked to request, whether or not
            // that request ever actually succeeded - a retry, a response-watchdog reset, or the
            // unconditional periodic resync could all abandon a block mid-request while the index
            // moved on regardless. On a flaky real connection that let a sweep appear "complete"
            // far more often than every block had truly been read even once.
            const socket = connect();
            socket.emit('data', versionResponse('idm701100')); // sensor block 07 in flight

            clock.tick(session.requestDataBlockDelay);
            socket.emit('data', idm.create_message('01F10000')); // R1 ack - block 07 requested, not yet read

            expect(session.blocksReadThisSweep.sensor.has('07'), 'acking the request must not by itself count as having read it').to.be.false;

            clock.tick(session.contentDelayForCurrentBlock());
            socket.emit('data', idm.create_message('01F20007' + dataBlock07)); // content actually arrives

            expect(session.blocksReadThisSweep.sensor.has('07'), 'counts only once the content has actually come back').to.be.true;
        });

        it('logs the settings sweep the same way, and its rolling average reflects multiple completed sweeps', () => {
            session.version = 'idm701100'; // 5 settings blocks: 03,04,05,06,08
            const settingsBlocks = ['03', '04', '05', '06', '08'];
            const settingsSweepLogs = () => log.debug.getCalls().filter(c => /^settings sweep done in /.test(c.args[0]));

            session.sweepStartedAt.settings = Date.now();
            clock.tick(1000);
            for (const b of settingsBlocks) session.recordBlockRead('settings', b);
            expect(settingsSweepLogs()).to.have.lengthOf(1);
            expect(settingsSweepLogs()[0].args[0]).to.equal('settings sweep done in 1000ms (avg of last 1: 1000ms)');

            session.sweepStartedAt.settings = Date.now();
            clock.tick(3000);
            for (const b of settingsBlocks) session.recordBlockRead('settings', b);
            const logs = settingsSweepLogs();
            expect(logs).to.have.lengthOf(2);
            expect(logs[1].args[0]).to.equal('settings sweep done in 3000ms (avg of last 2: 2000ms)');
        });

        it('caps the rolling average window at the last 10 completed sweeps', () => {
            session.version = 'idm701100';
            const settingsBlocks = ['03', '04', '05', '06', '08'];
            const settingsSweepLogs = () => log.debug.getCalls().filter(c => /^settings sweep done in /.test(c.args[0]));
            const doSweep = (ms) => {
                session.sweepStartedAt.settings = Date.now();
                clock.tick(ms);
                for (const b of settingsBlocks) session.recordBlockRead('settings', b);
            };

            for (let i = 0; i < 10; i++) doSweep(1000); // 10 sweeps of 1000ms each - average stays 1000
            doSweep(11000); // an 11th, much longer sweep - should push the OLDEST 1000ms sweep out of the window

            // Window is now nine 1000ms sweeps + one 11000ms sweep = (9000 + 11000) / 10 = 2000ms.
            expect(settingsSweepLogs().slice(-1)[0].args[0]).to.equal('settings sweep done in 11000ms (avg of last 10: 2000ms)');
        });
    });

    describe('periodic sweep stats summary (info level, every statsReportIntervalMs, see reportSweepStats())', () => {
        const statsLogs = () => log.info.getCalls().filter(c => /^last \d+min - /.test(c.args[0]));

        it('is started by start() and logs nothing until statsReportIntervalMs has actually elapsed', () => {
            session.start();
            expect(session.statsReportTimer, 'start() should schedule the periodic report').to.be.ok;

            clock.tick(session.statsReportIntervalMs - 1);
            expect(statsLogs()).to.have.lengthOf(0);

            clock.tick(1);
            expect(statsLogs()).to.have.lengthOf(1);
        });

        it('reports "0 sweeps" for a group that never completed a sweep in the window', () => {
            session.start();
            clock.tick(session.statsReportIntervalMs);

            expect(statsLogs()[0].args[0]).to.equal('last 10min - sensor: 0 sweeps; settings: 0 sweeps');
        });

        it('summarizes count/min/avg/max per group and resets the counters afterwards', () => {
            session.version = 'idm701100'; // 5 settings blocks: 03,04,05,06,08
            const settingsBlocks = ['03', '04', '05', '06', '08'];
            session.start();

            session.sweepStartedAt.settings = Date.now();
            clock.tick(1000);
            for (const b of settingsBlocks) session.recordBlockRead('settings', b);

            session.sweepStartedAt.settings = Date.now();
            clock.tick(3000);
            for (const b of settingsBlocks) session.recordBlockRead('settings', b);

            clock.tick(session.statsReportIntervalMs - 4000);
            const logs = statsLogs();
            expect(logs).to.have.lengthOf(1);
            expect(logs[0].args[0]).to.equal('last 10min - sensor: 0 sweeps; settings: 2 sweep(s), 2000ms avg (min 1000ms, max 3000ms)');

            // Counters must have been reset - a second full window with no further sweeps reports
            // "0 sweeps" again rather than carrying the previous window's numbers forward.
            clock.tick(session.statsReportIntervalMs);
            expect(statsLogs()[1].args[0]).to.equal('last 10min - sensor: 0 sweeps; settings: 0 sweeps');
        });

        it('keeps firing every statsReportIntervalMs for as long as the session runs', () => {
            session.start();
            clock.tick(session.statsReportIntervalMs * 3);
            expect(statsLogs()).to.have.lengthOf(3);
        });
    });

    describe('adaptive per-data-block content delay (hill-climbs a sweet spot, not "wait forever")', () => {
        const dataBlock07 = '00000000000000000000000000000000000000000B270000000000000000';

        it('grows the delay for a block that needed an NR retry, and uses the grown delay next time', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm701100'));
            clock.tick(session.requestDataBlockDelay);
            socket.emit('data', idm.create_message('01F10000')); // R1 ack for data block 07 (first requested for idm701100)

            expect(session.contentDelayByBlock.has('07'), 'nothing grown yet').to.be.false;

            // No grown delay yet, so the fixed normalDataContentDelay is used - but the control
            // isn't ready yet, costing one NR retry.
            clock.tick(session.normalDataContentDelay);
            socket.emit('data', idm.create_message('01F201')); // NR
            clock.tick(session.retryDataContentDelay);
            socket.emit('data', idm.create_message('01F20007' + dataBlock07)); // now succeeds

            const grownDelay = session.contentDelayByBlock.get('07');
            expect(grownDelay, 'a block with no adaptive step yet grows by the coarse starting step, not modeled on how long the cycle took')
                .to.equal(session.normalDataContentDelay + session.contentDelayDecreaseStep);

            // Drive a second request for the very same data block directly (the natural sensor/
            // settings round-robin would move on to the next block instead) - cancelling the
            // sendInitTimer the successful cycle above just scheduled and forcing the state
            // request_data_block() normally gets called in (INIT_ACKED, via the init-reply
            // handler), the same way the "writing values" tests isolate a manually-forced cycle
            // from a pending natural one.
            session.hooks.clearTimeout(session.sendInitTimer);
            session.sendInitTimer = null;
            session.protocolState = STATE.INIT_ACKED;
            session.request_data_block('07');
            clock.tick(session.requestDataBlockDelay);
            socket.emit('data', idm.create_message('01F10000')); // R1 ack again

            expect(session.contentDelayForCurrentBlock(), 'the delay used should now be the grown one').to.equal(grownDelay);

            const writesBefore = socket.written.length;
            clock.tick(session.normalDataContentDelay);
            expect(socket.written.length, 'must not request content yet at the old fixed delay').to.equal(writesBefore);

            clock.tick(grownDelay - session.normalDataContentDelay);
            expect(socket.written.length, 'should request content once the grown delay has elapsed').to.equal(writesBefore + 1);
            expect(session.protocolState).to.equal(STATE.DATA_CONTENT_REQUESTED);

            // The control is ready this time - no NR needed.
            socket.emit('data', idm.create_message('01F20007' + dataBlock07));
            expect(session.protocolState).to.equal(STATE.IDLE);
        });

        it('contentDelayForCurrentBlock() falls back to normalDataContentDelay for a block that has never needed more', () => {
            session.currentDataBlock = '09';
            expect(session.contentDelayByBlock.has('09')).to.be.false;
            expect(session.contentDelayForCurrentBlock()).to.equal(session.normalDataContentDelay);
        });

        it('caps growth at 4x the base delay even after many consecutive retry-needing cycles', () => {
            session.currentDataBlock = '07';
            for (let i = 0; i < 50; i++) {
                session.retryNeededThisCycle = true;
                session.updateContentDelayEstimate();
            }
            expect(session.contentDelayByBlock.get('07')).to.equal(session.normalDataContentDelay * 4);
        });

        it('eases the delay back down only after several consecutive clean cycles, starting with the coarse step, and never below normalDataContentDelay', () => {
            session.currentDataBlock = '07';
            session.contentDelayByBlock.set('07', session.normalDataContentDelay + 3 * session.contentDelayDecreaseStep);

            // Fewer clean cycles than the threshold: no change yet - a single lucky cycle must
            // not immediately undo a delay that was grown for a good reason.
            for (let i = 0; i < session.contentDelayDecayAfterCleanCycles - 1; i++) {
                session.retryNeededThisCycle = false;
                session.updateContentDelayEstimate();
            }
            expect(session.contentDelayByBlock.get('07')).to.equal(session.normalDataContentDelay + 3 * session.contentDelayDecreaseStep);

            // The cycle that reaches the threshold eases the delay down by exactly one (coarse,
            // first-ever) step for this block.
            session.retryNeededThisCycle = false;
            session.updateContentDelayEstimate();
            expect(session.contentDelayByBlock.get('07')).to.equal(session.normalDataContentDelay + 2 * session.contentDelayDecreaseStep);

            // Enough further clean streaks eventually bring it all the way back down to the floor
            // (via ever-finer steps - see the next test) - and it stays there, never below the
            // original, deliberately unaggressive default. Loop generously since the shrinking
            // step means this takes many more decreases than it would at a fixed 100ms.
            for (let i = 0; i < 500; i++) {
                for (let j = 0; j < session.contentDelayDecayAfterCleanCycles; j++) {
                    session.retryNeededThisCycle = false;
                    session.updateContentDelayEstimate();
                }
            }
            expect(session.contentDelayByBlock.get('07')).to.equal(session.normalDataContentDelay);
        });

        it('shrinks the ease-down step every time it eases a block down, converging on ever finer adjustments (down to a 1ms floor)', () => {
            session.currentDataBlock = '07';
            session.contentDelayByBlock.set('07', session.normalDataContentDelay + 10 * session.contentDelayDecreaseStep);

            const easeOnce = () => {
                for (let j = 0; j < session.contentDelayDecayAfterCleanCycles; j++) {
                    session.retryNeededThisCycle = false;
                    session.updateContentDelayEstimate();
                }
            };

            // First ease-down for this block uses the coarse starting step (100ms), and halves the
            // step for next time.
            easeOnce();
            expect(session.stepByBlock.get('07'), 'step halved after its first use').to.equal(50);

            // Successive ease-downs keep halving (rounding down), never going below 1ms.
            const expectedSteps = [25, 12, 6, 3, 1, 1, 1];
            for (const expectedStep of expectedSteps) {
                easeOnce();
                expect(session.stepByBlock.get('07')).to.equal(expectedStep);
            }

            // Once at the 1ms floor, every further ease-down actually moves the delay by just 1ms -
            // the fine-grained values (not just multiples of 100) the user asked for.
            const before = session.contentDelayByBlock.get('07');
            easeOnce();
            expect(session.contentDelayByBlock.get('07')).to.equal(before - 1);
        });

        it('a retry corrects a finely-tuned block by its current (small) step, not a jump back to the coarse starting point', () => {
            session.currentDataBlock = '07';
            session.contentDelayByBlock.set('07', session.normalDataContentDelay + 10 * session.contentDelayDecreaseStep);

            // Ease down twice so the step has shrunk well below the coarse starting value.
            for (let i = 0; i < 2; i++) {
                for (let j = 0; j < session.contentDelayDecayAfterCleanCycles; j++) {
                    session.retryNeededThisCycle = false;
                    session.updateContentDelayEstimate();
                }
            }
            expect(session.stepByBlock.get('07')).to.equal(25);
            const delayBeforeRetry = session.contentDelayByBlock.get('07');

            session.retryNeededThisCycle = true;
            session.updateContentDelayEstimate();
            expect(session.contentDelayByBlock.get('07'), 'the correction should be proportional to how fine the step already was, not a fixed jump')
                .to.equal(delayBeforeRetry + 25);
            expect(session.stepByBlock.get('07'), 'the step doubles after a retry, escalating gradually rather than resetting to the coarse starting point')
                .to.equal(50);
        });

        it('repeated retries in a row escalate a block\'s step back up, capped at contentDelayIncreaseStep', () => {
            session.currentDataBlock = '07';
            session.contentDelayByBlock.set('07', session.normalDataContentDelay);
            session.stepByBlock.set('07', 1); // as if fully converged to the finest step already

            const expectedSteps = [2, 4, 8, 16, 32, 64, 128, 256, 300, 300];
            for (const expectedStep of expectedSteps) {
                session.retryNeededThisCycle = true;
                session.updateContentDelayEstimate();
                expect(session.stepByBlock.get('07')).to.equal(expectedStep);
            }
        });

        it('a retry resets the clean-cycle streak, so decay only starts counting again afterwards', () => {
            session.currentDataBlock = '07';
            session.contentDelayByBlock.set('07', session.normalDataContentDelay + session.contentDelayIncreaseStep);

            for (let i = 0; i < session.contentDelayDecayAfterCleanCycles - 1; i++) {
                session.retryNeededThisCycle = false;
                session.updateContentDelayEstimate();
            }
            expect(session.cleanCyclesByBlock.get('07')).to.equal(session.contentDelayDecayAfterCleanCycles - 1);

            session.retryNeededThisCycle = true;
            session.updateContentDelayEstimate();
            expect(session.cleanCyclesByBlock.get('07'), 'the streak should have been reset by the retry').to.equal(0);
        });

        it('updateContentDelayEstimate() does nothing without a current data block', () => {
            session.currentDataBlock = null;
            session.updateContentDelayEstimate();
            expect(session.contentDelayByBlock.size).to.equal(0);
        });
    });

    describe('AdjustSpeed', () => {
        it('actually applies the configured speed factor for a version slower than 100%', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm722100')); // idm722100_speed is 75 in the data blocks file

            const factor = 100 / 75;
            expect(session.speedAdjusted).to.be.true;
            expect(session.requestInitDelay).to.equal(Math.round(600 * factor));
            expect(session.requestDataBlockDelay).to.equal(Math.round(1000 * factor));
            expect(session.normalDataContentDelay).to.equal(Math.round(650 * factor));
            expect(session.retryDataContentDelay).to.equal(Math.round(300 * factor));
            expect(session.responseTimeoutMs).to.equal(Math.round(8000 * factor));
        });

        it('leaves the default delays alone for a version at 100% speed', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm701100')); // idm701100_speed is 100

            expect(session.speedAdjusted).to.be.false;
            expect(session.requestInitDelay).to.equal(600);
            expect(session.responseTimeoutMs).to.equal(8000);
        });
    });

    describe('response watchdog (resilience: a dropped reply used to stall until the next reconnectinterval)', () => {
        it('resets the connection if nothing at all comes back for a sent request', () => {
            connect(); // sends init, state -> 1, arms the response watchdog

            clock.tick(session.responseTimeoutMs);

            expect(log.warn.calledWithMatch(/no response from the heatpump/)).to.be.true;
            // setConnected(false, true) was invoked: a fresh reconnect attempt got scheduled
            expect(session.reconnectTimer, 'a reconnect should have been scheduled').to.exist;

            clock.tick(session.config.reconnectinterval * 1000);
            expect(sockets, 'a new connection attempt should have been started').to.have.lengthOf(2);
        });

        it('does not fire once a valid reply has arrived in time', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm701100')); // clears the watchdog armed for init

            sockets.length = 0;
            // Comfortably past the (now-cleared) init watchdog's original 8s deadline, but
            // before the *next* legitimate request (the data block request request_data()
            // just scheduled) gets a chance to time out too - this is only checking that the
            // cleared watchdog itself does not fire, not that the session waits forever.
            clock.tick(session.responseTimeoutMs + 500);

            expect(log.warn.calledWithMatch(/no response from the heatpump/)).to.be.false;
            expect(sockets, 'no spurious reconnect should have happened').to.have.lengthOf(0);
        });

        it('is cleared on stop() so it cannot fire after the session has been torn down', () => {
            connect(); // arms the watchdog for the init message
            session.stop();

            clock.tick(100000);
            expect(log.warn.calledWithMatch(/no response from the heatpump/)).to.be.false;
        });
    });

    describe('writing values', () => {
        it('enqueue + the send-twice cycle produces two identical writes with the expected delays', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm701100')); // first connection: sets connected=true

            // The version reply also scheduled the normal data-polling cycle (request_data() ->
            // sendDataBlockRequestTimer) - cancel it so it doesn't interleave with the write
            // cycle below; this test only cares about the enqueue/send-twice mechanics, which
            // in reality run alongside that polling rather than instead of it.
            session.hooks.clearTimeout(session.sendDataBlockRequestTimer);
            session.sendDataBlockRequestTimer = null;
            // Model reaching an idle point the way receive_data normally does at the end of a cycle.
            session.protocolState = STATE.IDLE;

            const message = idm.create_set_value_message(17, 3, 1, 1);
            session.enqueueWrite(message);
            expect(session.sendQueue.hasItems).to.be.true;

            // The write only actually happens the next time the state machine reaches idle and
            // checks the queue - simulate that the way receive_data does after a completed cycle.
            session.needToSendData = session.write_data_to_heatpump(true);
            expect(session.needToSendData).to.be.true;

            const writesBefore = socket.written.length;
            clock.tick(session.setValueDelay); // send_init (re-syncs with a version request first)
            expect(socket.written.length).to.equal(writesBefore + 1);
            expect(session.protocolState).to.equal(STATE.INIT_SENT);

            socket.emit('data', versionResponse('idm701100')); // heat pump always replies with the version
            expect(session.protocolState).to.equal(STATE.INIT_ACKED);

            clock.tick(session.setValueDelay); // sendSetValueMessage - first write
            expect(socket.written.length).to.equal(writesBefore + 2);
            expect(session.protocolState).to.equal(STATE.SET_VALUE_SENT);
            const firstWrite = socket.written[socket.written.length - 1];

            socket.emit('data', idm.create_message('01E100')); // "S1" - set value acknowledged
            expect(session.protocolState).to.equal(STATE.IDLE);

            clock.tick(session.secondSetValueOffset); // sendSetValueMessage - second write (the heatpump seems to need it twice)
            expect(socket.written.length).to.equal(writesBefore + 3);
            const secondWrite = socket.written[socket.written.length - 1];
            expect(idm_u.get_string_uint8array(secondWrite)).to.equal(idm_u.get_string_uint8array(firstWrite));
        });
    });

    describe('multi-block collection, sensor and settings (S_H726100 - see chooseNextGroup() / beginGroupCollection())', () => {
        // Real payloads captured from a running S_H726100 control - same bytes (and same
        // block-by-block parseProtocol() output) as the regression snapshots in
        // idm-protocol.test.js. Their lengths are exactly the verified "wireLength" values in
        // lib/datablocks/S_H726100.json, for BOTH groups - so both qualify for multi-block
        // requests from the very first turn, with no wireLength learning needed here (that gets
        // its own describe block below).
        const SENSOR_PAYLOADS = {
            '07': '000000000000000000000000000000000000000000000000000001000000000000000000',
            '0B': '000001002D270A020BE707',
            '0C': '00000E003000300015000A001D001C00D30000001C0019001E00D0010000000000000A000A0000000000',
            '0D': '0000000000000000000000000000',
        };
        const SETTINGS_PAYLOADS = {
            '03': '00002E001200010F00000001000B2701000100260200000000000000',
            '04': '0000010400150013000102002D00010012002D000100030A0001FA0005000014000101000003000300FA00FA000001000005000500010100001E001E00320032000A000A00100010006400640001010A000A0014001400',
            '05': '0000000132000A00140010000300000A00640002010500001E000600FA00',
            '06': '00000101040039000A000A00F1FFEEFF0002001E000000',
            '08': '00000A001200000000001200120012000A000A000A0023000A0014001E00B400C4096400',
            '09': '0000D80E',
            '0A': '000000002D00',
        };
        const PAYLOADS = { ...SENSOR_PAYLOADS, ...SETTINGS_PAYLOADS };
        const ALL_SENSOR_BLOCKS = ['07', '0B', '0C', '0D']; // must match S_H726100.json's sensorBlocks
        const ALL_SETTINGS_BLOCKS = ['03', '04', '05', '06', '08', '09', '0A']; // must match S_H726100.json's settingsBlocks

        // A JSON-declared "wireLength" is only a seeded CANDIDATE now (see
        // getVerifiedBlockWireLength()'s comment), not an instant grant - it still needs one fresh
        // confirming measurement before its group qualifies for multi-block requests. Every test in
        // this describe block is about the multi-block REQUEST/REPLY mechanics themselves (that
        // transition has its own dedicated tests, in the "wireLength learning" describe block below),
        // and assumes S_H726100 is ALREADY fully multi-block-capable for both groups from turn 1 - so
        // this confirms every one of its blocks directly via recordMeasuredWireLength(), bypassing the
        // learnWireLengthFrom() stub the outer beforeEach installs (recordMeasuredWireLength is called
        // straight on `idm`, not through the stubbed session method), exactly what one real confirming
        // read per block would do. PAYLOADS' lengths are exactly S_H726100.json's declared wireLengths
        // (see the comment above), so the first (and only) call for each block always matches its seed
        // and confirms immediately.
        beforeEach(() => {
            for (const [block, payload] of Object.entries(PAYLOADS)) {
                idm.recordMeasuredWireLength('S_H726100', block, payload.length / 2);
            }
        });

        /**
         * A small test double for the REAL S_H726100 control's observed multi-block behavior,
         * built directly from this feature's own captured real traffic: acks a 0171 multi-block
         * request with "R1", then answers each subsequent 0172 content request with the next
         * scripted step for whichever group is currently active (session.activeMultiBlockGroup)
         * - an array of block ids to include (real traffic showed this is typically a PARTIAL
         * subset of what was asked for, needing several re-asks across turns), 'NR' (control not
         * ready yet), or 'REPEAT' (resend the exact same bytes as the previous data reply for
         * that group - real traffic showed an over-eager re-ask can get back an identical stale
         * partial reply). Each group's script has its own step counter and repeats its last
         * entry forever once exhausted, so a test doesn't need to spell out "and it just stays
         * incomplete" 20 times over. A group with no explicit script always replies with its
         * complete real payload set on its very first attempt - most tests only care about
         * scripting ONE group and want the other to just get out of the way.
         *
         * Reacts only while session.activeMultiBlockGroup is set (i.e. only to 0171/0172 traffic
         * that is actually part of a multi-block collection) - a plain single-block request (as
         * used by every OTHER firmware, see the "other firmwares" test below) is left completely
         * alone, exactly like an un-instrumented FakeSocket.
         */
        class MultiBlockControllerSim {
            /**
             * @param {FakeSocket} socket
             * @param {{activeMultiBlockGroup: string | null}} session
             * @param {{sensor?: (string[] | 'NR' | 'REPEAT')[], settings?: (string[] | 'NR' | 'REPEAT')[]}} scripts
             */
            constructor(socket, session, scripts) {
                this.socket = socket;
                this.scripts = scripts;
                this.step = { sensor: 0, settings: 0 };
                this.lastDataReply = { sensor: null, settings: null };
                this.contentRequestCount = { sensor: 0, settings: 0 };

                const decoder = new IdmProtocol();
                const originalWrite = socket.write.bind(socket);
                socket.write = (data) => {
                    const result = originalWrite(data);
                    const group = session.activeMultiBlockGroup;
                    if (!group) return result; // not part of any active collection - leave it alone
                    // Deferred (0ms) rather than answered synchronously inside write(): the
                    // session's own send_*() methods still have bookkeeping (protocolState,
                    // armResponseWatchdog()) to do AFTER this write() call returns, so replying
                    // from inside it would race that bookkeeping. A 0ms fake-timer callback runs
                    // once the current call stack has fully unwound instead, exactly like a real
                    // reply arriving "shortly after" the write, and still resolves within the
                    // same clock.tick() that triggered the write.
                    const state = decoder.add_to_packet(data);
                    if (state !== 3) return result;
                    const payload = decoder.get_data_packet();
                    decoder.reset();
                    if (payload.slice(0, 4) === '0171') {
                        global.setTimeout(() => socket.emit('data', idm.create_message('01F10000')), 0);
                    } else if (payload === '0172') {
                        this.contentRequestCount[group]++;
                        global.setTimeout(() => this.respond(group), 0);
                    }
                    return result;
                };
            }

            respond(group) {
                const defaultScript = [group === 'sensor' ? ALL_SENSOR_BLOCKS : ALL_SETTINGS_BLOCKS];
                const script = this.scripts[group] ?? defaultScript;
                const entry = script[Math.min(this.step[group], script.length - 1)];
                this.step[group]++;
                if (entry === 'NR') {
                    this.socket.emit('data', idm.create_message('01F201'));
                    return;
                }
                if (entry === 'REPEAT') {
                    this.socket.emit('data', this.lastDataReply[group]);
                    return;
                }
                const message = idm.create_message('01F200' + entry.map((id) => id + PAYLOADS[id]).join(''));
                this.lastDataReply[group] = message;
                this.socket.emit('data', message);
            }
        }

        /** Connects and reports S_H726100 - the very first turn (sensor - see chooseNextGroup()) is about to begin. */
        function connectAsH726100() {
            const socket = connect();
            socket.emit('data', versionResponse('S_H726100'));
            return socket;
        }

        /**
         * Fully drives exactly ONE turn (whatever group chooseNextGroup() selects next) to
         * completion and re-syncs (init/version roundtrip), the same way every turn - single-block
         * or multi-block - ends. The 4s tick comfortably covers a request/ack/content-reply
         * roundtrip plus any scripted 'NR' retries within this turn (each only costs
         * session.retryDataContentDelay, 300ms by default) without ever reaching anywhere near the
         * 8s response watchdog that gets (re-)armed once send_init actually writes the init
         * message at the end of the turn - but is deliberately kept well UNDER sensorMinIntervalMs
         * (10s) too, so completing sensor's turn here never makes it look due again ahead of
         * settings, which most of these tests rely on getting turn 2 (see chooseNextGroup()'s
         * comment: with both groups due, sensor - checked first - would otherwise win again).
         */
        function completeGroupTurn(socket) {
            clock.tick(4000);
            socket.emit('data', versionResponse('S_H726100'));
        }

        /**
         * Forces `group` to be picked by chooseNextGroup() on the very next turn, sidestepping the
         * minimum-interval gating entirely - used by tests below that are about the multi-block
         * REPLY mechanics (re-asks, backoff, giving up, ...) and want a specific group's turn next
         * without coupling the test to exactly how much fake-clock time a preceding turn consumed.
         * The gating itself has its own dedicated tests (see "group scheduling" below).
         * @param {'sensor'|'settings'} group
         */
        function forceGroupDue(group) {
            session.sweepStartedAt[group] = null;
        }

        it('firmwareSupportsMultiBlockRequestsForSensors and firmwareSupportsMultiBlockRequests are both true for S_H726100 (each group independently)', () => {
            expect(idm.firmwareSupportsMultiBlockRequestsForSensors('S_H726100')).to.be.true;
            expect(idm.firmwareSupportsMultiBlockRequests('S_H726100')).to.be.true;
        });

        it('the first turn after connecting requests the full SENSOR group as one batch (sensor is checked first by chooseNextGroup())', () => {
            const socket = connectAsH726100();
            const writesBefore = socket.written.length;

            clock.tick(session.requestDataBlockDelay);

            expect(socket.written.length).to.equal(writesBefore + 1);
            expect(idm_u.get_string_uint8array(socket.written[socket.written.length - 1])).to.equal(
                idm_u.get_string_uint8array(idm.create_request_multi_block_message(ALL_SENSOR_BLOCKS))
            );
            expect(session.protocolState).to.equal(STATE.DATA_BLOCK_REQUESTED);
            expect(session.activeMultiBlockGroup).to.equal('sensor');
        });

        it('happy path: one full pattern cycle (sensor, settings), each group completing on its first content reply', () => {
            const socket = connectAsH726100();
            new MultiBlockControllerSim(socket, session, {}); // both groups use their default (complete) reply

            completeGroupTurn(socket); // turn 1: sensor
            // Turn 2 (settings) is driven WITHOUT the trailing version reply, so the state can be
            // inspected right at the end of this pattern cycle, before turn 3 (the version reply
            // completeGroupTurn() would otherwise supply immediately begins the next cycle's
            // sensor collection and reassigns activeMultiBlockGroup again).
            clock.tick(10000); // turn 2: settings

            // Both groups qualify for multi-block requests, so each group's sweep completes in
            // exactly one turn - sensor first (chooseNextGroup() checks it first when neither
            // group has swept yet), then settings, since sensor isn't due again this soon:
            // 4 + 7 = 11, one read of every distinct block.
            expect(hooks.onDataBlockText.callCount).to.equal(11);
            for (const id of [...ALL_SENSOR_BLOCKS, ...ALL_SETTINGS_BLOCKS]) {
                expect(hooks.onDataBlockText.calledWith('Data_block_' + Number.parseInt(id, 16)),
                    'expected a call for block ' + id).to.be.true;
            }
            expect(session.activeMultiBlockGroup).to.be.null;
            expect(session.multiBlockCollector).to.be.null;
            // All 11 distinct blocks have now been read at least once - exactly one full-coverage
            // cycle's worth - but there's no predecessor lap yet to time, so nothing is logged for
            // it either (same as the single-block behavior tested in "full-coverage cycle timing" above).
            expect(log.info.getCalls().some(c => /^full-coverage cycle #/.test(c.args[0]))).to.be.false;
        });

        it('a partial reply is followed by a bare 0172 re-ask (no new 0171), and the same collection completes', () => {
            const socket = connectAsH726100();
            new MultiBlockControllerSim(socket, session, { settings: [['03', '04'], ['05', '06', '08', '09', '0A']] });

            completeGroupTurn(socket); // turn 1: sensor - turn 2 (settings) is about to begin

            const writesBeforeSettingsTurn = socket.written.length;
            // A little slack (+50ms) beyond the exact sum of delays: sinon's fake timers don't
            // run a timer that gets (re-)scheduled for EXACTLY the current tick's target until a
            // later tick, so ticking the bare sum can leave the last hop of a request/reply chain
            // unprocessed - see completeGroupTurn()'s own generous 10s for the same reason.
            clock.tick(session.requestDataBlockDelay + session.multiBlockContentDelay + 50); // initial 0171 + its first (partial) 0172 reply
            expect(socket.written.length, 'the initial 0171 plus one 0172 content request').to.equal(writesBeforeSettingsTurn + 2);
            expect(idm_u.get_string_uint8array(socket.written[writesBeforeSettingsTurn])).to.equal(
                idm_u.get_string_uint8array(idm.create_request_multi_block_message(ALL_SETTINGS_BLOCKS))
            );
            expect(session.multiBlockCollector.missing).to.deep.equal(new Set(['05', '06', '08', '09', '0A']));
            expect(session.activeMultiBlockGroup, 'the collection must not be interrupted while incomplete').to.equal('settings');

            const writesBeforeReask = socket.written.length;
            clock.tick(session.multiBlockReaskBaseDelay + 50); // the re-ask itself: a bare 0172, no fresh 0171, plus its reply

            expect(socket.written.length, 'the re-ask must be a single new write').to.equal(writesBeforeReask + 1);
            expect(idm_u.get_string_uint8array(socket.written[writesBeforeReask])).to.equal(
                idm_u.get_string_uint8array(idm.create_request_data_content_message())
            );
            expect(session.multiBlockCollector, 'the re-ask\'s reply completed the collection').to.be.null;
            expect(session.activeMultiBlockGroup).to.be.null;
        });

        it('a block repeated in a later reply is not double-reported (the collector ignores blocks it already has)', () => {
            const socket = connectAsH726100();
            new MultiBlockControllerSim(socket, session, {
                settings: [
                    ['03', '04'],
                    ['03', '05', '06', '08', '09', '0A'], // 03 again, alongside the rest
                ],
            });

            completeGroupTurn(socket); // turn 1: sensor - turn 2 (settings) is about to begin
            // Driven without the trailing version reply (unlike completeGroupTurn), so this stays
            // on turn 2's own collection rather than also kicking off turn 3.
            clock.tick(20000); // settings: both content requests happen within this one collection

            expect(hooks.onDataBlockText.withArgs('Data_block_3').callCount, 'block 03 must only be reported once').to.equal(1);
            expect(session.multiBlockCollector).to.be.null; // completed and cleared
        });

        it('an exact stale repeat (control answered again too soon) does not lose progress or stall the collection', () => {
            const socket = connectAsH726100();
            new MultiBlockControllerSim(socket, session, {
                settings: [
                    ['03', '04'],
                    'REPEAT',
                    'REPEAT',
                    ['05', '06', '08', '09', '0A'],
                ],
            });

            completeGroupTurn(socket); // turn 1: sensor - turn 2 (settings) is about to begin
            // All 4 content requests (03+04, REPEAT, REPEAT, the rest) happen within this ONE
            // settings collection - the backoff between them (900, 1800, 3600ms) comfortably fits.
            // Driven without the trailing version reply (unlike completeGroupTurn), so this stays
            // on turn 2's own collection rather than also kicking off turn 3.
            clock.tick(20000); // settings

            expect(session.multiBlockCollector).to.be.null;
            for (const id of ALL_SETTINGS_BLOCKS) {
                expect(hooks.onDataBlockText.calledWith('Data_block_' + Number.parseInt(id, 16))).to.be.true;
            }
        });

        it('while a collection is mid-reask, the OTHER group does not get an interleaved turn', () => {
            const socket = connectAsH726100();
            new MultiBlockControllerSim(socket, session, { settings: [['03', '04'], ['05', '06', '08', '09', '0A']] });

            completeGroupTurn(socket); // turn 1: sensor - turn 2 (settings) is about to begin
            clock.tick(session.requestDataBlockDelay + session.multiBlockContentDelay + 50); // settings: 0171 + first (partial) 0172 reply

            expect(session.activeMultiBlockGroup, 'settings collection has not finished yet').to.equal('settings');
            expect(session.multiBlockCollector.missing).to.deep.equal(new Set(['05', '06', '08', '09', '0A']));

            const writesBeforeReask = socket.written.length;
            clock.tick(session.multiBlockReaskBaseDelay - 100); // comfortably short of when the re-ask is due

            // No new write yet - in particular, no fresh sensor 0171 sneaking in ahead of the re-ask.
            expect(socket.written.length).to.equal(writesBeforeReask);
            expect(session.activeMultiBlockGroup, 'settings must still hold the connection').to.equal('settings');

            clock.tick(200); // the re-ask fires now and its reply completes the collection
            expect(session.multiBlockCollector).to.be.null;
            expect(session.activeMultiBlockGroup).to.be.null;
        });

        it('"NR" (not ready) before a group has anything ready is handled by the normal retry path, not counted as a multi-block re-ask', () => {
            const socket = connectAsH726100();
            new MultiBlockControllerSim(socket, session, { settings: ['NR', 'NR', [...ALL_SETTINGS_BLOCKS]] });

            completeGroupTurn(socket); // turn 1: sensor - turn 2 (settings) is about to begin
            // Driven without the trailing version reply (unlike completeGroupTurn), so the state
            // can be inspected right as this collection completes, before the next one begins.
            clock.tick(10000); // settings - two NRs then the full reply, all within this one collection

            expect(session.multiBlockCollector).to.be.null;
            expect(session.activeMultiBlockGroup).to.be.null;
            for (const id of ALL_SETTINGS_BLOCKS) {
                expect(hooks.onDataBlockText.calledWith('Data_block_' + Number.parseInt(id, 16))).to.be.true;
            }
            expect(log.warn.calledWithMatch(/too many data content request retries/)).to.be.false;
        });

        it('gives up after multiBlockMaxReasks re-asks (all within one collection) and resumes normally instead of stalling forever', () => {
            const socket = connectAsH726100();
            // Finds block 03 right away, then repeats that SAME reply forever - a group that
            // makes some progress but (for whatever reason) never completes the rest.
            new MultiBlockControllerSim(socket, session, { settings: [['03']] });

            completeGroupTurn(socket); // turn 1: sensor - turn 2 (settings) is about to begin
            // All multiBlockMaxReasks (20) re-asks happen inside this single settings collection:
            // the adaptive backoff grows to multiBlockReaskMaxDelay (4000ms) after a few repeats,
            // so the worst case (900+1800+3600+17*4000ms, plus the initial request delays) is
            // comfortably under 100s.
            clock.tick(100000);

            expect(session.multiBlockCollector, 'should have given up and cleared the collector').to.be.null;
            expect(session.activeMultiBlockGroup).to.be.null;
            // Block 03's partial progress must not linger as a stale "sweep in progress" marker -
            // otherwise sweepIncomplete('settings') would keep forcing settings' turn again and
            // again, potentially starving sensor forever, instead of letting the normal minimum-
            // interval gating decide when settings' next attempt should happen (see
            // finishGroupCollection()'s comment).
            expect(session.blocksReadThisSweep.settings.size, 'gave-up progress must not persist as a stale in-progress sweep').to.equal(0);
            expect(log.warn.calledWithMatch(/multi-block collection for settings gave up after/)).to.be.true;
            expect(hooks.onDataBlockText.calledWith('Data_block_3')).to.be.true;
            for (const id of ALL_SETTINGS_BLOCKS.filter((b) => b !== '03')) {
                expect(hooks.onDataBlockText.calledWith('Data_block_' + Number.parseInt(id, 16)),
                    'block ' + id + ' was never actually found, so must never have been reported').to.be.false;
            }
            // The state machine should have moved on (back towards idle / the next turn), not be
            // stuck waiting forever in the content-requested state.
            expect(session.protocolState).to.not.equal(STATE.DATA_CONTENT_REQUESTED);
        });

        it('other firmwares are completely unaffected - still exactly one data block per turn, classic single-block path', () => {
            expect(idm.firmwareSupportsMultiBlockRequests('idm701100')).to.be.false;
            expect(idm.firmwareSupportsMultiBlockRequestsForSensors('idm701100')).to.be.false;

            const socket = connect();
            socket.emit('data', versionResponse('idm701100'));
            clock.tick(session.requestDataBlockDelay);

            expect(session.activeMultiBlockGroup, 'idm701100 must never enter a multi-block collection').to.be.null;
            expect(session.multiBlockCollector).to.be.null;
            expect(session.currentDataBlock, 'the plain single-block path should be in use instead').to.equal('07');
            expect(socket.written.length).to.equal(2); // init + exactly one single-block request, not a batch
        });

        it('a reply that cannot be fully parsed (lost sync) abandons the collection and forgets the whole group\'s wireLengths, falling back to round-robin', () => {
            // Driven entirely by hand (no MultiBlockControllerSim) - this needs to inject one
            // deliberately malformed reply at an exact point, which the sim (real block ids/NR/
            // REPEAT scripts only) cannot produce.
            const socket = connectAsH726100();
            expect(idm.firmwareSupportsMultiBlockRequests('S_H726100'), 'settings starts out multi-block-capable').to.be.true;

            // Turn 1 (sensor) - completes normally, using a real full reply.
            clock.tick(session.requestDataBlockDelay); // sends the sensor 0171
            socket.emit('data', idm.create_message('01F10000')); // R1 ack
            clock.tick(session.multiBlockContentDelay); // sends the sensor 0172
            socket.emit('data', idm.create_message('01F200' + ALL_SENSOR_BLOCKS.map((id) => id + SENSOR_PAYLOADS[id]).join('')));
            clock.tick(session.requestInitDelay); // re-init roundtrip -> turn 2 (settings) begins
            socket.emit('data', versionResponse('S_H726100'));

            // Turn 2 (settings) - a lost-sync reply.
            clock.tick(session.requestDataBlockDelay); // sends the settings 0171
            expect(session.activeMultiBlockGroup).to.equal('settings');
            socket.emit('data', idm.create_message('01F10000')); // R1 ack
            clock.tick(session.multiBlockContentDelay); // sends the settings 0172

            // A reply idm.parse_multi_block_reply() can't make sense of (an unknown block id,
            // 'ZZ', after a real block 09) - lost sync, exactly like the dedicated
            // idm-protocol.test.js regression for this same payload shape.
            socket.emit('data', idm.create_message('01F200' + '09' + SETTINGS_PAYLOADS['09'] + 'ZZ' + '00'));

            expect(log.warn.calledWithMatch(/multi-block reply for settings could not be fully parsed/)).to.be.true;
            // The collection is abandoned outright (not left waiting for more re-asks that could
            // never resolve the mismatch), and every one of settings' wireLengths is gone - not
            // just block 09's - since a lost-sync error doesn't say which one was actually wrong.
            expect(session.activeMultiBlockGroup).to.be.null;
            expect(session.multiBlockCollector).to.be.null;
            expect(idm.firmwareSupportsMultiBlockRequests('S_H726100'), 'every settings wireLength was forgotten').to.be.false;
            // Block 09 itself WAS parsed cleanly before the error, so it's still reported once.
            expect(hooks.onDataBlockText.calledWith('Data_block_9')).to.be.true;

            // Turn 3 (sensor again) - unaffected, still multi-block-capable, completes normally.
            // forceGroupDue() sidesteps the minimum-interval gating here on purpose - this test is
            // about the lost-sync/fallback MECHANIC, not about exactly how much fake-clock time
            // the turns above consumed (see forceGroupDue()'s own comment).
            forceGroupDue('sensor');
            clock.tick(session.requestInitDelay); // re-init roundtrip -> turn 3 begins
            socket.emit('data', versionResponse('S_H726100'));
            expect(session.activeMultiBlockGroup, 'sensor is untouched by settings\' forgotten wireLengths').to.equal('sensor');
            clock.tick(session.requestDataBlockDelay);
            socket.emit('data', idm.create_message('01F10000'));
            clock.tick(session.multiBlockContentDelay);
            socket.emit('data', idm.create_message('01F200' + ALL_SENSOR_BLOCKS.map((id) => id + SENSOR_PAYLOADS[id]).join('')));
            forceGroupDue('settings');
            clock.tick(session.requestInitDelay); // re-init roundtrip -> turn 4 (settings) begins
            socket.emit('data', versionResponse('S_H726100'));

            // Turn 4 (settings) - falls back to the classic one-block-at-a-time path instead of
            // trying (and failing) to send another multi-block request.
            expect(session.activeMultiBlockGroup, 'settings must not attempt multi-block again until re-confirmed').to.be.null;
            clock.tick(session.requestDataBlockDelay);
            expect(ALL_SETTINGS_BLOCKS, 'a plain single-block request for one of settings\' own blocks').to.include(session.currentDataBlock);
        });
    });

    describe('wireLength learning (see IdmSession#learnWireLengthFrom / IdmProtocol#recordMeasuredWireLength)', () => {
        // idm701100 has no JSON-declared "wireLength" for any of its blocks (unlike S_H726100),
        // so every measurement here really does come from learnWireLengthFrom() itself, not a
        // pre-existing hand-verified value it would otherwise short-circuit on.
        beforeEach(() => {
            session.learnWireLengthFrom.restore(); // use the real implementation - see the outer beforeEach's comment
        });

        it('a real single-block reply passively learns that block\'s wireLength - logged, but not yet trusted after only one measurement', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm701100')); // block 07 request in flight

            clock.tick(session.requestDataBlockDelay);
            socket.emit('data', idm.create_message('01F10000')); // R1 ack
            clock.tick(session.contentDelayForCurrentBlock());
            socket.emit('data', idm.create_message('01F20007' + '00'.repeat(30))); // 30-byte content actually arrives

            expect(idm.getVerifiedBlockWireLength('idm701100', '07'), 'one measurement alone is never enough to trust').to.be.null;
            expect(log.info.calledWithMatch(/wireLength learning: block 07 \(idm701100\) measured 30 byte\(s\) - needs one more matching measurement/)).to.be.true;
            expect(hooks.onWireLengthLearned.called).to.be.false;
        });

        it('two matching replies for the same block confirm it and fire onWireLengthLearned exactly once, with the right arguments', () => {
            session.version = 'idm701100';

            session.learnWireLengthFrom('01F20007' + '00'.repeat(30), '07');
            expect(hooks.onWireLengthLearned.called).to.be.false;

            session.learnWireLengthFrom('01F20007' + '00'.repeat(30), '07');

            expect(idm.getVerifiedBlockWireLength('idm701100', '07')).to.equal(30);
            expect(log.info.calledWithMatch(/wireLength learning: block 07 \(idm701100\) confirmed at 30 byte\(s\)/)).to.be.true;
            expect(hooks.onWireLengthLearned.calledOnceWith('idm701100', '07', 30)).to.be.true;

            // Once trusted, learnWireLengthFrom is a no-op for this block from now on - a third,
            // even different-length "measurement" must not un-confirm it or fire the hook again.
            session.learnWireLengthFrom('01F20007' + '00'.repeat(99), '07');
            expect(idm.getVerifiedBlockWireLength('idm701100', '07')).to.equal(30);
            expect(hooks.onWireLengthLearned.callCount).to.equal(1);
        });

        it('a disagreeing second measurement logs a warning and restarts the confirmation count instead of averaging or trusting either value', () => {
            session.version = 'idm701100';

            session.learnWireLengthFrom('01F20007' + '00'.repeat(30), '07'); // 30 bytes
            session.learnWireLengthFrom('01F20007' + '00'.repeat(31), '07'); // 31 bytes - disagrees

            expect(log.warn.calledWithMatch(/wireLength learning: block 07 \(idm701100\) measured 31 byte\(s\), disagreeing with the previous measurement/)).to.be.true;
            expect(idm.getVerifiedBlockWireLength('idm701100', '07')).to.be.null;
            expect(hooks.onWireLengthLearned.called).to.be.false;

            session.learnWireLengthFrom('01F20007' + '00'.repeat(31), '07'); // matches the second value -> confirms at 31, not 30

            expect(idm.getVerifiedBlockWireLength('idm701100', '07')).to.equal(31);
            expect(hooks.onWireLengthLearned.calledOnceWith('idm701100', '07', 31)).to.be.true;
        });

        it('a length seeded from a previous run (idm.seedMeasuredWireLength()) is only a candidate - one more matching measurement is still required', () => {
            session.version = 'idm701100';
            idm.seedMeasuredWireLength('idm701100', '07', 30); // what main.js does on startup, from the persisted state

            expect(idm.getVerifiedBlockWireLength('idm701100', '07'), 'a seeded value is not yet trusted').to.be.null;

            session.learnWireLengthFrom('01F20007' + '00'.repeat(30), '07'); // the one fresh confirming read every restart still needs

            expect(idm.getVerifiedBlockWireLength('idm701100', '07')).to.equal(30);
            expect(hooks.onWireLengthLearned.calledOnceWith('idm701100', '07', 30)).to.be.true;
        });

        it('once every sensor block for a firmware is confirmed, that group becomes multi-block-capable - logged once, exactly when it happens', () => {
            session.version = 'idm701100';
            const sensorBlocks = ['07', '09', '0A', '0B'];
            const graduationLogged = () => log.info.calledWithMatch(
                /wireLength learning: every sensor block for idm701100 now has a trusted wireLength - multi-block sensor requests start from its next turn/);

            for (const block of sensorBlocks) session.learnWireLengthFrom('01F200' + block + '00'.repeat(10), block); // 1st measurement, all 4
            expect(idm.firmwareSupportsMultiBlockRequestsForSensors('idm701100')).to.be.false;
            expect(graduationLogged()).to.be.false;

            for (const block of sensorBlocks.slice(0, -1)) session.learnWireLengthFrom('01F200' + block + '00'.repeat(10), block); // confirm all but '0B'
            expect(idm.firmwareSupportsMultiBlockRequestsForSensors('idm701100'), 'block 0B is still unconfirmed').to.be.false;
            expect(graduationLogged()).to.be.false;

            session.learnWireLengthFrom('01F2000B' + '00'.repeat(10), '0B'); // 0B's confirming measurement - the last one needed

            expect(idm.firmwareSupportsMultiBlockRequestsForSensors('idm701100')).to.be.true;
            expect(graduationLogged()).to.be.true;
            expect(hooks.onWireLengthLearned.callCount, 'once per block, each on its own confirmation').to.equal(4);
            // The settings group is a completely separate gate - it has 5 blocks of its own, none
            // of which were ever measured here, so it must still be exactly as unqualified as before.
            expect(idm.firmwareSupportsMultiBlockRequests('idm701100')).to.be.false;
        });

        it('a group that graduates mid-run switches from round-robin to multi-block requests starting with its very next turn - even one that continues the same, not-yet-finished, sweep', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm701100')); // turn 1 (sensor, block 07) already in flight - classic single-block

            const sensorBlocks = ['07', '09', '0A', '0B'];
            for (const block of sensorBlocks) session.learnWireLengthFrom('01F200' + block + '00'.repeat(10), block);
            for (const block of sensorBlocks) session.learnWireLengthFrom('01F200' + block + '00'.repeat(10), block);
            expect(idm.firmwareSupportsMultiBlockRequestsForSensors('idm701100'), 'every sensor block confirmed by now').to.be.true;

            // Finish turn 1 - it was already committed to the classic single-block path before
            // graduation happened, so it must complete normally, not switch mid-flight. Only block
            // 07 of sensor's 4 blocks has been read so far this sweep (1 of 4), so per
            // sweepIncomplete()'s rule sensor's round-robin lap is NOT finished yet - meaning
            // sensor, not settings, gets the very next turn too (settings hasn't even started its
            // own first sweep - it simply isn't due to interrupt an unfinished sensor lap either
            // way, see chooseNextGroup()'s comment).
            clock.tick(session.requestDataBlockDelay);
            socket.emit('data', idm.create_message('01F10000'));
            clock.tick(session.contentDelayForCurrentBlock());
            socket.emit('data', idm.create_message('01F20007' + '00'.repeat(10)));
            clock.tick(session.requestInitDelay);
            const writesBefore = socket.written.length;
            socket.emit('data', versionResponse('idm701100')); // -> turn 2 begins

            // Turn 2 goes straight to ONE multi-block collection for the WHOLE sensor group
            // (07,09,0A,0B) - not a round-robin continuation for just 09/0A/0B (beginGroupCollection()
            // always re-asks a fresh collection from scratch, see its own comment) - confirming the
            // switch takes effect on sensor's very next turn, whichever turn that happens to be.
            expect(session.activeMultiBlockGroup, 'turn 2 should go straight to a multi-block collection').to.equal('sensor');
            clock.tick(session.requestDataBlockDelay);
            expect(idm_u.get_string_uint8array(socket.written[writesBefore])).to.equal(
                idm_u.get_string_uint8array(idm.create_request_multi_block_message(sensorBlocks))
            );
        });
    });

    describe('group scheduling (chooseNextGroup / sweepIncomplete / scheduleNextGroupCheck - see the constructor\'s turn-scheduling comment)', () => {
        beforeEach(() => {
            session.version = 'idm701100'; // 4 sensor blocks, 5 settings blocks - these tests never actually connect()
        });

        it('picks sensor first when neither group has ever swept', () => {
            expect(session.chooseNextGroup()).to.equal('sensor');
        });

        it('a round-robin lap already partway done keeps its turns, even while the OTHER group is also (or more) due', () => {
            session.blocksReadThisSweep.settings = new Set(['03']); // 1 of 5 - lap started, not finished
            session.sweepStartedAt.settings = Date.now();
            session.sweepStartedAt.sensor = null; // sensor has never swept - "due" by the plain rule too

            expect(session.chooseNextGroup(), 'the in-progress settings lap must win, not sensor').to.equal('settings');
        });

        it('sensor is not due again until its own 10s minimum interval has passed since ITS sweep started', () => {
            session.sweepStartedAt.sensor = Date.now();
            session.sweepStartedAt.settings = Date.now(); // also just swept, so it can't win by default either

            expect(session.chooseNextGroup(), 'neither is due yet').to.be.null;

            clock.tick(session.sensorMinIntervalMs - 1);
            expect(session.chooseNextGroup(), 'not quite due yet').to.be.null;

            clock.tick(1);
            expect(session.chooseNextGroup()).to.equal('sensor');
        });

        it('settings is not due again until its own 60s minimum interval has passed since ITS sweep started', () => {
            session.sweepStartedAt.sensor = Date.now();
            session.sweepStartedAt.settings = Date.now();

            clock.tick(session.settingsMinIntervalMs - 1);
            // Sensor's own (much shorter) interval has long since re-elapsed by now and would
            // otherwise win first (it's checked first) - re-stamp it "just swept" to isolate
            // settings' own gating, which is what this test is actually about.
            session.sweepStartedAt.sensor = Date.now();
            expect(session.chooseNextGroup()).to.be.null;

            clock.tick(1);
            expect(session.chooseNextGroup()).to.equal('settings');
        });

        it('a completed write forces exactly one settings turn right away, consumed after that one turn', () => {
            session.sweepStartedAt.sensor = Date.now();
            session.sweepStartedAt.settings = Date.now(); // both just swept - neither otherwise due
            session.enqueueWrite('dummy-message'); // sets settingsRefreshNeededAfterWrite

            expect(session.chooseNextGroup(), 'the write drain forces a settings turn despite settings not being otherwise due')
                .to.equal('settings');
            expect(session.settingsRefreshNeededAfterWrite, 'consumed by the call above').to.be.false;
            expect(session.chooseNextGroup(), 'nothing else is due now that the flag is consumed').to.be.null;
        });

        it('never selects a group with no data blocks defined for the connected version', () => {
            const stub = sinon.stub(idm, 'getSettingsDataBlocks').returns([]);
            try {
                session.settingsRefreshNeededAfterWrite = true;
                session.sweepStartedAt.sensor = Date.now(); // sensor not due either, so it can't win by default
                expect(session.chooseNextGroup(), 'settings has no blocks - never selected, whatever else is true about it').to.be.null;
            } finally {
                stub.restore();
            }
        });

        it('an end-to-end turn: request_data() parks (nothing sent) while neither group is due, and resumes once the shorter wait elapses', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm701100')); // turn 1 (sensor block 07) already in flight - cancel it
            session.hooks.clearTimeout(session.sendDataBlockRequestTimer);
            session.sendDataBlockRequestTimer = null;
            session.protocolState = STATE.INIT_ACKED;

            // Pretend both groups just swept a moment ago - neither is due right now.
            session.sweepStartedAt = { sensor: Date.now(), settings: Date.now() };
            session.blocksReadThisSweep = { sensor: new Set(), settings: new Set() };

            const writesBefore = socket.written.length;
            session.request_data();
            expect(socket.written.length, 'nothing requested while parked').to.equal(writesBefore);
            expect(session.pollScheduleTimer, 'a recheck should be scheduled').to.be.ok;

            clock.tick(session.sensorMinIntervalMs); // sensor's own (shorter) interval elapses first
            // '09', not '07': turn 1's already-cancelled request still advanced the round-robin
            // index before we cancelled its TIMER - this is only checking that the parked recheck
            // picked sensor (not settings) the moment it became due, not which exact block.
            expect(session.groupOfBlock(session.currentDataBlock), 'the parked recheck should have picked sensor as soon as it became due').to.equal('sensor');

            clock.tick(session.requestDataBlockDelay); // the request itself is still paced normally from there
            expect(socket.written.length).to.equal(writesBefore + 1);
        });

        describe('scheduleNextGroupCheck()', () => {
            it('waits for the SHORTER of the two groups\' remaining time, then asks request_data() again', () => {
                session.sweepStartedAt.sensor = Date.now();
                clock.tick(4000); // 6s left on sensor's 10s interval
                session.sweepStartedAt.settings = Date.now(); // 60s left on settings - sensor's 6s is the shorter one

                const requestDataStub = sinon.stub(session, 'request_data');
                session.scheduleNextGroupCheck();
                clock.tick(5999);
                expect(requestDataStub.called, 'not due yet').to.be.false;
                clock.tick(1);
                expect(requestDataStub.calledOnce, 'fires once the shorter remaining wait elapses').to.be.true;
            });
        });
    });

    describe('write-triggered settings refresh, end to end (see enqueueWrite() / settingsRefreshNeededAfterWrite)', () => {
        it('a completed write forces a prompt settings read on the very next turn, even when settings was not otherwise due', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm701100')); // sets connected=true

            session.hooks.clearTimeout(session.sendDataBlockRequestTimer);
            session.sendDataBlockRequestTimer = null;
            session.protocolState = STATE.IDLE;

            // Both groups "just swept" - settings would NOT otherwise be due again for a long time.
            session.sweepStartedAt = { sensor: Date.now(), settings: Date.now() };
            session.blocksReadThisSweep = { sensor: new Set(), settings: new Set() };

            const message = idm.create_set_value_message(17, 3, 1, 1);
            session.enqueueWrite(message);
            expect(session.settingsRefreshNeededAfterWrite, 'enqueueWrite() sets the flag').to.be.true;
            session.needToSendData = session.write_data_to_heatpump(true);

            clock.tick(session.setValueDelay); // send_init (re-syncs with a version request first)
            socket.emit('data', versionResponse('idm701100'));
            clock.tick(session.setValueDelay); // first write
            socket.emit('data', idm.create_message('01E100')); // S1 - first write acknowledged
            clock.tick(session.secondSetValueOffset); // second (identical) write - the heatpump seems to need it twice
            socket.emit('data', idm.create_message('01E100')); // S1 - second write acknowledged, queue now empty

            expect(session.needToSendData, 'the queue should be fully drained now').to.be.false;
            clock.tick(session.requestInitDelay); // re-init roundtrip -> request_data() finally runs
            socket.emit('data', versionResponse('idm701100'));

            const chosenGroup = session.activeMultiBlockGroup ?? session.groupOfBlock(session.currentDataBlock);
            expect(chosenGroup, 'the pending write-triggered refresh should have won settings its turn').to.equal('settings');
            expect(session.settingsRefreshNeededAfterWrite, 'consumed by that turn').to.be.false;
        });
    });
});
