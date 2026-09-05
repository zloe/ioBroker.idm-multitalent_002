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

const idm = require('./lib/idm-protocol');
const idm_u = require('./lib/idm-utils');

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
});
