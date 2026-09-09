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

    describe('full poll cycle logging (removed)', () => {
        it('no longer logs a per-sweep "completed one full poll cycle" line - only the full-coverage cycle line remains', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm701100')); // sensor block 07 (sweep 1)

            // Drive through several sweeps worth of blocks directly via request_data() - this used
            // to log "completed one full poll cycle" every time a sweep completed (every ~5
            // blocks). It fired far too often for a heat pump with many settings blocks (every
            // ~14s on real hardware) and has been dropped in favor of only the much less frequent
            // full-coverage cycle line (every sensor AND settings block actually read once).
            for (let i = 0; i < 30; i++) {
                clock.tick(500);
                session.request_data();
            }

            expect(log.info.getCalls().some(c => /completed one full poll cycle/.test(c.args[0])),
                'this log line should no longer exist at all').to.be.false;
        });
    });

    describe('full-coverage cycle timing (every sensor AND settings block actually READ at least once)', () => {
        const dataBlock07 = '00000000000000000000000000000000000000000B270000000000000000';

        // Fully drives the currently in-flight data block request to a successful completion (R1
        // ack, then its content) and then re-establishes the connection (init resend + version
        // reply) the way the real protocol does before every subsequent block request - which
        // triggers request_data() again for the next block. Deliberately going through real R1/
        // Data responses here (unlike the old version of this test, which called
        // session.request_data() directly in a loop) - see the next test for why that distinction
        // is exactly what used to make this log line fire far too often on real hardware.
        function completeCurrentBlockAndAdvance(socket) {
            clock.tick(session.requestDataBlockDelay);
            socket.emit('data', idm.create_message('01F10000')); // R1 ack
            clock.tick(session.contentDelayForCurrentBlock());
            socket.emit('data', idm.create_message('01F20007' + dataBlock07)); // content actually arrives - block read
            clock.tick(session.requestInitDelay);
            socket.emit('data', versionResponse('idm701100')); // re-init roundtrip -> next block's request_data()
        }

        it('logs the elapsed time and a running total only once every distinct data block has actually been read, each time the lap completes', () => {
            const socket = connect();
            // idm701100 has 4 sensor blocks (read every single sweep) and 5 settings blocks (one
            // per sweep, round-robin) - 9 distinct block ids total, so a full-coverage cycle spans
            // 5 sweeps (gated by the slower settings side).
            const fullCoverageLogs = () => log.info.getCalls().filter(c => /^full-coverage cycle #/.test(c.args[0]));

            socket.emit('data', versionResponse('idm701100')); // sensor block 07 in flight (sweep 1)

            for (let i = 0; i < 5; i++) completeCurrentBlockAndAdvance(socket); // sweep 1: 07,09,0A,0B,03
            expect(fullCoverageLogs(), 'only 1 of 5 settings blocks read so far').to.have.lengthOf(0);

            for (let sweep = 0; sweep < 3; sweep++) { // sweeps 2-4: settings 04, 05, 06
                for (let i = 0; i < 5; i++) completeCurrentBlockAndAdvance(socket);
            }
            expect(fullCoverageLogs(), 'only 4 of 5 settings blocks read so far').to.have.lengthOf(0);

            for (let i = 0; i < 5; i++) completeCurrentBlockAndAdvance(socket); // sweep 5: settings 08 - the last one

            // All 9 distinct ids have now been read once, completing the very first lap - but there's
            // no predecessor to time yet, so this isn't logged until the *next* lap completes.
            expect(fullCoverageLogs(), 'the very first lap has no predecessor to time yet').to.have.lengthOf(0);

            // Second lap - now there's a predecessor, so this one does get logged.
            for (let sweep = 0; sweep < 5; sweep++) {
                for (let i = 0; i < 5; i++) completeCurrentBlockAndAdvance(socket);
            }
            let logs = fullCoverageLogs();
            expect(logs, 'expected a log call once the second lap completes').to.have.lengthOf(1);
            // idm701100's 4 sensor + 5 settings blocks, all still at the normalDataContentDelay
            // floor (no retries happened in this test) - listed sensor-blocks-first, matching
            // allDataBlockIds().
            expect(logs[0].args[0]).to.match(/^full-coverage cycle #1 done in \d+ms, delays\(ms\): 07=650,09=650,0A=650,0B=650,03=650,04=650,05=650,06=650,08=650$/);

            // A third lap - the running total should go up, not reset.
            for (let sweep = 0; sweep < 5; sweep++) {
                for (let i = 0; i < 5; i++) completeCurrentBlockAndAdvance(socket);
            }
            logs = fullCoverageLogs();
            expect(logs, 'expected a second log call once the next lap completes').to.have.lengthOf(2);
            expect(logs[1].args[0]).to.match(/^full-coverage cycle #2 done in \d+ms, delays\(ms\): /);
        });

        it('blockDelaysSummary() reflects a grown per-block delay, not just the default', () => {
            session.currentDataBlock = '07';
            session.contentDelayByBlock.set('07', session.normalDataContentDelay + session.contentDelayIncreaseStep);
            session.version = 'idm701100';

            expect(session.blockDelaysSummary()).to.equal(
                '07=' + (session.normalDataContentDelay + session.contentDelayIncreaseStep) +
                ',09=' + session.normalDataContentDelay +
                ',0A=' + session.normalDataContentDelay +
                ',0B=' + session.normalDataContentDelay +
                ',03=' + session.normalDataContentDelay +
                ',04=' + session.normalDataContentDelay +
                ',05=' + session.normalDataContentDelay +
                ',06=' + session.normalDataContentDelay +
                ',08=' + session.normalDataContentDelay
            );
        });

        it('only counts a block once its content has actually been received - not merely once requested', () => {
            // This is the historical bug, fixed this release: the round-robin index used to
            // advance (and could wrap a "lap") the moment a block was picked to request, whether
            // or not that request ever actually succeeded - a retry, a response-watchdog reset, or
            // the unconditional periodic resync could all abandon a block mid-request while the
            // index moved on regardless. On a flaky real connection that let this log fire far more
            // often than every block had truly been read even once.
            const socket = connect();
            socket.emit('data', versionResponse('idm701100')); // sensor block 07 in flight

            clock.tick(session.requestDataBlockDelay);
            socket.emit('data', idm.create_message('01F10000')); // R1 ack - block 07 requested, not yet read

            expect(session.blocksReadThisCoverageCycle.has('07'), 'acking the request must not by itself count as having read it').to.be.false;

            clock.tick(session.contentDelayForCurrentBlock());
            socket.emit('data', idm.create_message('01F20007' + dataBlock07)); // content actually arrives

            expect(session.blocksReadThisCoverageCycle.has('07'), 'counts only once the content has actually come back').to.be.true;
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
});
