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
            'net': { Socket: TrackedFakeSocket, '@noCallThru': true },
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

    describe('AdjustSpeed', () => {
        it('actually applies the configured speed factor for a version slower than 100%', () => {
            const socket = connect();
            socket.emit('data', versionResponse('idm722100')); // idm722100_speed is 75 in the data blocks file

            const factor = 100 / 75;
            expect(session.speedAdjusted).to.be.true;
            expect(session.requestInitDelay).to.equal(Math.round(600 * factor));
            expect(session.requestDataBlockDelay).to.equal(Math.round(1000 * factor));
            expect(session.normalDataContentDelay).to.equal(Math.round(1000 * factor));
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
