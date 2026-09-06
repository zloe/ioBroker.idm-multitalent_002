'use strict';

// Unit tests for the communication state machine in main.js.
//
// main.js talks to the heatpump over a plain TCP socket (net.Socket) and extends the real
// ioBroker adapter base class (@iobroker/adapter-core). Both are replaced here via proxyquire
// with small fakes we fully control, so these tests can drive the protocol state machine
// (init -> data block request -> data content request -> retries -> next cycle) without any
// real network connection or ioBroker installation.
//
// lib/idm-protocol.js keeps its parsing/framing state as module-level singletons (see the
// review notes), so each test resets it explicitly instead of relying on a fresh require.

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noPreserveCache();
const { EventEmitter } = require('events');

const IdmProtocol = require('./lib/idm-protocol');
const idm_u = require('./lib/idm-utils');
// idm-protocol.js now exports the class rather than a singleton instance (each adapter
// instance under test creates its own, just like the real adapter does - see main.js). This
// module-level instance is only used by tests to build the expected wire bytes for
// comparison (create_message/create_init_message etc. don't depend on any loaded state), not
// as the adapter's own protocol state.
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

/** A minimal stand-in for the @iobroker/adapter-core Adapter base class. */
class FakeAdapterBase extends EventEmitter {
    constructor(options) {
        super();
        this.name = options.name;
        this.instance = 0;
        this.namespace = `${options.name}.0`;
        this.config = options.config || {};
        this.objects = new Map();
        this.states = new Map();
        this.log = {
            silly: sinon.stub(), debug: sinon.stub(), info: sinon.stub(),
            warn: sinon.stub(), error: sinon.stub(),
        };
        this.subscribeStates = sinon.stub();
        // Real adapter-core fires 'ready' asynchronously, after the subclass constructor
        // (and its event registrations) has finished running.
        process.nextTick(() => this.emit('ready'));
    }
    _fullId(id) {
        return id.startsWith(this.namespace + '.') ? id : `${this.namespace}.${id}`;
    }
    async setObjectNotExistsAsync(id, obj) {
        const fullId = this._fullId(id);
        if (!this.objects.has(fullId)) this.objects.set(fullId, obj);
        return { id: fullId };
    }
    async setStateAsync(id, value, ack) {
        const fullId = this._fullId(id);
        const val = (value && typeof value === 'object' && 'val' in value) ? value.val : value;
        const ackFlag = (value && typeof value === 'object' && 'ack' in value) ? value.ack : ack;
        this.states.set(fullId, { val, ack: ackFlag });
        return {};
    }
    setState(id, value, ack, callback) {
        if (typeof ack === 'function') {
            callback = ack;
            ack = undefined;
        }
        this.setStateAsync(id, value, ack).then(() => callback && callback(null)).catch(err => callback && callback(err));
    }
    // Real adapter-core wraps the global timer functions so it can force-clear anything left
    // running on unload. These fakes just delegate to the (possibly sinon-faked) globals.
    setTimeout(fn, ms, ...args) { return setTimeout(fn, ms, ...args); }
    clearTimeout(t) { return clearTimeout(t); }
    setInterval(fn, ms, ...args) { return setInterval(fn, ms, ...args); }
    clearInterval(t) { return clearInterval(t); }
}

function hexEncodeAscii(str) {
    return [...str].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join('');
}

const flush = async () => {
    // Let already-resolved promise chains (setObjectNotExistsAsync, setStateAsync, ...) drain.
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('main.js - IdmMultitalent002 communication state machine', () => {
    let clock;
    let sockets;
    let adapter;

    beforeEach(async () => {
        idm.reset();
        idm.initialize();
        sockets = [];

        class TrackedFakeSocket extends FakeSocket {
            constructor() {
                super();
                sockets.push(this);
            }
        }

        const createAdapter = proxyquire('./main.js', {
            'net': { Socket: TrackedFakeSocket, '@noCallThru': true },
            // The real @iobroker/adapter-core calls process.exit() at require time when it
            // can't find a js-controller installation, so it must never actually be loaded
            // here - '@noCallThru' stops proxyquire from requiring it as a fallback.
            '@iobroker/adapter-core': { Adapter: FakeAdapterBase, '@noCallThru': true },
        });

        clock = sinon.useFakeTimers();
        adapter = createAdapter({
            config: { tcpserverip: '10.0.0.1', tcpserverport: 4001, reconnectinterval: 90 },
        });
        // sinon's fake timers also fake process.nextTick, which is how FakeAdapterBase
        // schedules the 'ready' event - so the fake clock (not a real microtask flush) is
        // what's needed to fire it.
        clock.runMicrotasks();
        await flush();
    });

    afterEach(() => {
        clock.restore();
    });

    /** Drives the adapter from "ready" through a live TCP connection. Returns the socket. */
    async function connect() {
        clock.tick(adapter.initialConnectionDelay); // onReady -> connectAndRead
        clock.tick(adapter.socketRecycleTime); // connectAndRead -> startConnection -> net.Socket#connect
        const socket = sockets[sockets.length - 1];
        socket.emit('connect'); // socketConnectHandler -> send_first_init()
        await flush();
        return socket;
    }

    /** Builds the raw wire bytes for a successful version/init response. */
    function versionResponse(version) {
        return idm.create_message('01E0' + hexEncodeAscii(version));
    }

    it('sends an init message once the socket connects', async () => {
        const socket = await connect();
        expect(socket.written).to.have.lengthOf(1);
        expect(idm_u.get_string_uint8array(socket.written[0])).to.equal(
            idm_u.get_string_uint8array(idm.create_init_message())
        );
        expect(adapter.idmProtocolState).to.equal(1); // init sent, waiting for answer
    });

    it('creates the version state, marks the adapter connected and starts requesting data after a valid init reply', async () => {
        const socket = await connect();

        socket.emit('data', versionResponse('idm701100'));
        await flush();

        expect(adapter.version).to.equal('idm701100');
        expect(adapter.states.get(`${adapter.namespace}.idm_control_version`)).to.deep.equal({ val: 'idm701100', ack: true });
        expect(adapter.states.get(`${adapter.namespace}.info.connection`)).to.deep.equal({ val: true, ack: true });
        expect(adapter.connectedToIDM).to.equal(true);
        // request_data() was called, which schedules a data block request after a delay
        expect(adapter.idmProtocolState).to.equal(2);

        clock.tick(adapter.requestDataBlockDelay);
        expect(socket.written).to.have.lengthOf(2); // init + first data block request
        expect(adapter.idmProtocolState).to.equal(3); // data requested, waiting for ack
    });

    it('runs a full successful cycle: init -> data block ack -> data content -> parsed data', async () => {
        const socket = await connect();
        socket.emit('data', versionResponse('idm701100'));
        await flush();
        clock.tick(adapter.requestDataBlockDelay); // sends the data block request, state -> 3

        // Control acknowledges the data block request ("R1")
        socket.emit('data', idm.create_message('01F10000'));
        await flush();
        expect(adapter.idmProtocolState).to.equal(4);

        clock.tick(adapter.normalDataContentDelay); // sends the data content request, state -> 5
        expect(adapter.idmProtocolState).to.equal(5);

        // Control sends back a real, previously-captured data block 07 payload
        const dataBlock07 = '00000000000000000000000000000000000000000B270000000000000000';
        socket.emit('data', idm.create_message('01F20007' + dataBlock07));
        await flush();

        // back to idle, and a new init was scheduled to fetch the next data block
        expect(adapter.idmProtocolState).to.equal(0);
        const stateEntry = adapter.states.get(`${adapter.namespace}.Data_block_7`);
        expect(stateEntry, 'Data_block_7 state should have been set').to.exist;
        expect(stateEntry.val).to.be.a('string').and.not.empty;
    });

    it('retries on "NR" (not ready) up to the retry limit before giving up and restarting', async () => {
        const socket = await connect();
        socket.emit('data', versionResponse('idm701100'));
        await flush();
        clock.tick(adapter.requestDataBlockDelay);
        socket.emit('data', idm.create_message('01F10000')); // R1 ack
        await flush();
        clock.tick(adapter.normalDataContentDelay); // -> state 5, data content requested

        // Respond with "not ready" a few times - each retry should re-request the content
        // without resetting the whole connection.
        for (let i = 1; i <= 3; i++) {
            const writesBefore = socket.written.length;
            socket.emit('data', idm.create_message('01F201'));
            await flush();
            expect(adapter.idmProtocolState, `after retry ${i}`).to.equal(4);
            clock.tick(adapter.retryDataContentDelay);
            expect(socket.written.length, `retry ${i} should have sent another data content request`).to.equal(writesBefore + 1);
            expect(adapter.idmProtocolState, `after retry ${i} request sent`).to.equal(5);
        }
        expect(adapter.retry_count).to.equal(3);
    });

    it('resets the connection when a response arrives in an unexpected protocol state', async () => {
        const socket = await connect();
        // We are in state 1 (init sent, waiting for the version reply). An "R1" response is
        // only valid in state 3, so this should be treated as a protocol error and trigger a
        // reconnect instead of silently being accepted.
        sockets.length = 0;
        socket.emit('data', idm.create_message('01F10000'));
        await flush();

        expect(adapter.idmProtocolState).to.equal(-1);
        // We were never fully connected yet, so there is nothing to tear down beyond
        // resetting the protocol state and scheduling a fresh connection attempt.
        expect(adapter.connectedToIDM).to.equal(false);
        expect(adapter.reconnectTimer).to.exist;

        clock.tick(adapter.config.reconnectinterval * 1000);
        expect(sockets, 'a new connection attempt should have been started').to.have.lengthOf(1);
    });

    it('clears every pending communication timer on unload, not just reconnect/resend', async () => {
        const socket = await connect();
        socket.emit('data', versionResponse('idm701100'));
        await flush();
        clock.tick(adapter.requestDataBlockDelay);
        socket.emit('data', idm.create_message('01F10000')); // -> state 4, schedules sendDataContentTimer
        await flush();

        // At this point sendDataContentTimer is pending (state 4 -> request_data_content scheduled).
        expect(adapter.sendDataContentTimer, 'sendDataContentTimer should be pending').to.be.ok;
        const pendingBefore = clock.countTimers();
        expect(pendingBefore).to.be.greaterThan(0);

        await new Promise(resolve => adapter.onUnload(resolve));

        // null or undefined both mean "no timer" here - the existing code isn't fully
        // consistent about which sentinel it uses, but what matters is that none of these
        // still reference a live timer handle after unload.
        expect(adapter.sendInitTimer, 'sendInitTimer').to.not.be.ok;
        expect(adapter.sendDataBlockRequestTimer, 'sendDataBlockRequestTimer').to.not.be.ok;
        expect(adapter.sendDataContentTimer, 'sendDataContentTimer').to.not.be.ok;
        expect(adapter.sendSetValueMessageTimeout1, 'sendSetValueMessageTimeout1').to.not.be.ok;
        expect(adapter.sendSetValueMessageTimeout2, 'sendSetValueMessageTimeout2').to.not.be.ok;
        // No timer should still be scheduled after unload - previously several of these were
        // left running and could still fire against the (by then destroyed) socket.
        expect(clock.countTimers()).to.equal(0);
    });

    describe('AdjustSpeed', () => {
        it('actually applies the configured speed factor for a version slower than 100% (regression: idm.speed is a Map, not a plain object)', async () => {
            const socket = await connect();
            socket.emit('data', versionResponse('idm722100')); // idm722100_speed is 75 in the data blocks file
            await flush();

            const factor = 100 / 75;
            expect(adapter.speedAdjusted).to.be.true;
            expect(adapter.requestInitDelay).to.equal(Math.round(600 * factor));
            expect(adapter.requestDataBlockDelay).to.equal(Math.round(1000 * factor));
            expect(adapter.normalDataContentDelay).to.equal(Math.round(1000 * factor));
            expect(adapter.retryDataContentDelay).to.equal(Math.round(300 * factor));
        });

        it('leaves the default delays alone for a version at 100% speed', async () => {
            const socket = await connect();
            socket.emit('data', versionResponse('idm701100')); // idm701100_speed is 100
            await flush();

            expect(adapter.speedAdjusted).to.be.false;
            expect(adapter.requestInitDelay).to.equal(600);
        });
    });

    describe('writing values: min/max enforcement', () => {
        /** Connects, reports idm701100, and waits for CreateStates() to finish populating stateNameMap. */
        async function connectAndCreateStates() {
            const socket = await connect();
            socket.emit('data', versionResponse('idm701100'));
            await flush();
            await flush(); // CreateStates() runs unawaited from the response handler; give its
            // internal chain (mapStatenames -> per-state setObjectNotExistsAsync) extra ticks
            // to finish populating stateNameMap before the test proceeds.
            return socket;
        }

        it('enqueues a write that is within the configured min/max range', async () => {
            await connectAndCreateStates();
            const id = `${adapter.namespace}.Heizkreis-A.Betriebsart`; // betrieb_A, min 0 / max 5

            adapter.onStateChange(id, { val: 2, ack: false });
            await flush();

            expect(adapter.sendQueue.hasItems, 'value within range should have been enqueued').to.be.true;
            expect(adapter.log.error.called, 'no error should have been logged').to.be.false;
        });

        it('rejects a write above the configured maximum and does not enqueue it', async () => {
            await connectAndCreateStates();
            const id = `${adapter.namespace}.Heizkreis-A.Betriebsart`; // betrieb_A, min 0 / max 5

            adapter.onStateChange(id, { val: 42, ack: false });
            await flush();

            expect(adapter.sendQueue.hasItems, 'out-of-range value must never reach the send queue').to.be.false;
            expect(adapter.log.error.calledOnce, 'an error should have been logged').to.be.true;
            expect(adapter.log.error.firstCall.args[0]).to.match(/above the maximum/);
        });

        it('rejects a write below the configured minimum and does not enqueue it', async () => {
            await connectAndCreateStates();
            const id = `${adapter.namespace}.Heizkreis-A.Betriebsart`; // betrieb_A, min 0 / max 5

            adapter.onStateChange(id, { val: -1, ack: false });
            await flush();

            expect(adapter.sendQueue.hasItems).to.be.false;
            expect(adapter.log.error.calledOnce).to.be.true;
            expect(adapter.log.error.firstCall.args[0]).to.match(/below the minimum/);
        });

        it('reverts the displayed value to the last acknowledged one after rejecting an out-of-range write', async () => {
            await connectAndCreateStates();
            const id = `${adapter.namespace}.Heizkreis-A.Betriebsart`;

            // Simulate a previously received/accepted value of 1 (ack = true), as if it had
            // come from the heat pump or from an earlier, accepted write.
            adapter.setIDMState('Heizkreis-A.Betriebsart', 1);
            await flush();
            expect(adapter.states.get(id)).to.deep.equal({ val: 1, ack: true });

            // The user (or a script) now writes an out-of-range value.
            adapter.onStateChange(id, { val: 42, ack: false });
            await flush();

            // The state should have been reverted back to the last known-good value, not left
            // showing 42 as if the heat pump had accepted it.
            expect(adapter.states.get(id)).to.deep.equal({ val: 1, ack: true });
            expect(adapter.sendQueue.hasItems).to.be.false;
        });

        it('still enqueues writes for fields with no configured min/max (unchanged behavior)', async () => {
            await connectAndCreateStates();
            const id = `${adapter.namespace}.Warmwasser.Sollwert`; // WW_soll - no min/max configured

            adapter.onStateChange(id, { val: 999999, ack: false });
            await flush();

            expect(adapter.sendQueue.hasItems, 'fields without configured limits are not restricted').to.be.true;
        });

        it('does nothing for a non-writable state even if it somehow arrives with ack=false', async () => {
            await connectAndCreateStates();
            // Frostschutz A (frost_A) is read-only (writable: false)
            const id = `${adapter.namespace}.Heizkreis-A.Frostschutz`;

            adapter.onStateChange(id, { val: 1, ack: false });
            await flush();

            expect(adapter.sendQueue.hasItems).to.be.false;
        });
    });
});
