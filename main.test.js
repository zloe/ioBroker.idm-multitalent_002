'use strict';

// Unit tests for main.js - now just the ioBroker glue around IdmSession (see lib/idm-session.js
// for the actual TCP connection + request/response state machine, tested independently in
// lib/idm-session.test.js). These tests replace IdmSession itself with a small fake that
// records what main.js does with it (config passed in, start()/stop()/enqueueWrite() calls)
// and lets the test invoke the hooks main.js wires up, the same way the real IdmSession would
// when something happens on the wire - so main.js's own responsibilities (creating ioBroker
// states/objects, the min/max write gate, wiring config through) can be tested in isolation.

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noPreserveCache();
const { EventEmitter } = require('events');

/** A small stand-in for IdmSession that just records what main.js does with it. */
class FakeIdmSession {
    /** @type {FakeIdmSession[]} */
    static instances = [];

    constructor(idm, config, log, hooks) {
        this.idm = idm;
        this.config = config;
        this.log = log;
        this.hooks = hooks;
        this.started = false;
        this.stopped = false;
        this.enqueued = [];
        FakeIdmSession.instances.push(this);
    }
    start() { this.started = true; }
    stop() { this.stopped = true; }
    enqueueWrite(message) { this.enqueued.push(message); }
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

const flush = async () => {
    // Let already-resolved promise chains (setObjectNotExistsAsync, setStateAsync, ...) drain.
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('main.js - IdmMultitalent002 (ioBroker glue around IdmSession)', () => {
    let clock, adapter, session;

    beforeEach(async () => {
        FakeIdmSession.instances = [];

        const createAdapter = proxyquire('./main.js', {
            '@iobroker/adapter-core': { Adapter: FakeAdapterBase, '@noCallThru': true },
            './lib/idm-session': { IdmSession: FakeIdmSession, '@noCallThru': true },
        });

        clock = sinon.useFakeTimers();
        adapter = createAdapter({
            config: { tcpserverip: '10.0.0.1', tcpserverport: 4001, reconnectinterval: 90 },
        });
        clock.runMicrotasks();
        await flush();
        session = FakeIdmSession.instances[0];
    });

    afterEach(() => {
        clock.restore();
    });

    it('creates exactly one session with the configured connection settings once ready', () => {
        expect(FakeIdmSession.instances).to.have.lengthOf(1);
        expect(session.config).to.deep.equal({ tcpserverip: '10.0.0.1', tcpserverport: 4001, reconnectinterval: 90 });
    });

    it('starts the session only after the initial connection delay', () => {
        expect(session.started).to.be.false;
        clock.tick(adapter.initialConnectionDelay - 1);
        expect(session.started).to.be.false;
        clock.tick(1);
        expect(session.started).to.be.true;
    });

    it('onConnectionChange hook mirrors the connection state to info.connection and adapter.connectedToIDM', async () => {
        session.hooks.onConnectionChange(true);
        await flush();
        expect(adapter.states.get(`${adapter.namespace}.info.connection`)).to.deep.equal({ val: true, ack: true });
        expect(adapter.connectedToIDM).to.equal(true);

        session.hooks.onConnectionChange(false);
        await flush();
        expect(adapter.states.get(`${adapter.namespace}.info.connection`)).to.deep.equal({ val: false, ack: true });
        expect(adapter.connectedToIDM).to.equal(false);
    });

    it('onVersion hook records the version, sets idm_control_version and creates the states for it', async () => {
        session.hooks.onVersion('idm701100');
        await flush();
        await flush(); // CreateStates -> mapStatenames -> per-state setObjectNotExistsAsync chain

        expect(adapter.version).to.equal('idm701100');
        expect(adapter.states.get(`${adapter.namespace}.idm_control_version`)).to.deep.equal({ val: 'idm701100', ack: true });
        expect(adapter.statesCreated).to.be.true;
        expect(adapter.stateNameMap.has('Heizkreis-A.Betriebsart')).to.be.true;
    });

    it('onNeedStates hook creates states once and is a no-op afterwards', async () => {
        const createStatesSpy = sinon.spy(adapter, 'CreateStates');

        session.hooks.onVersion('idm701100'); // first creation, via onVersion
        await flush();
        await flush();
        expect(createStatesSpy.callCount).to.equal(1);
        expect(adapter.statesCreated).to.be.true;

        session.hooks.onNeedStates(); // request_data()'s "just in case" call
        await flush();
        expect(createStatesSpy.callCount, 'should not re-run CreateStates once already created').to.equal(1);
    });

    it('onDataBlockText hook sets the named data block state', async () => {
        session.hooks.onDataBlockText('Data_block_7', 'padding:0; some:text; ');
        await flush();
        expect(adapter.states.get(`${adapter.namespace}.Data_block_7`)).to.deep.equal({ val: 'padding:0; some:text; ', ack: true });
    });

    it('onFieldUpdate hook (setIDMState) sets the state and tracks it as the last acknowledged value', async () => {
        session.hooks.onFieldUpdate('Heizkreis-A.Betriebsart', 3);
        await flush();
        expect(adapter.states.get(`${adapter.namespace}.Heizkreis-A.Betriebsart`)).to.deep.equal({ val: 3, ack: true });
        expect(adapter.lastAckedValue.get('Heizkreis-A.Betriebsart')).to.equal(3);
    });

    it('onUnload stops the session', async () => {
        expect(session.stopped).to.be.false;
        await new Promise(resolve => adapter.onUnload(resolve));
        expect(session.stopped).to.be.true;
    });

    it('onUnload does nothing (and does not throw) if called before the session was created', () => {
        const bareAdapter = Object.create(Object.getPrototypeOf(adapter));
        bareAdapter.session = null;
        bareAdapter.log = adapter.log;
        expect(() => bareAdapter.onUnload(() => {})).to.not.throw();
    });

    describe('writing values: min/max enforcement', () => {
        /** Reports idm701100 and waits for CreateStates() to finish populating stateNameMap. */
        async function reportVersionAndCreateStates() {
            session.hooks.onVersion('idm701100');
            await flush();
            await flush();
        }

        it('enqueues a write that is within the configured min/max range', async () => {
            await reportVersionAndCreateStates();
            const id = `${adapter.namespace}.Heizkreis-A.Betriebsart`; // betrieb_A, min 0 / max 5

            adapter.onStateChange(id, { val: 2, ack: false });
            await flush();

            expect(session.enqueued, 'value within range should have been enqueued').to.have.lengthOf(1);
            expect(adapter.log.error.called, 'no error should have been logged').to.be.false;
        });

        it('rejects a write above the configured maximum and does not enqueue it', async () => {
            await reportVersionAndCreateStates();
            const id = `${adapter.namespace}.Heizkreis-A.Betriebsart`; // betrieb_A, min 0 / max 5

            adapter.onStateChange(id, { val: 42, ack: false });
            await flush();

            expect(session.enqueued, 'out-of-range value must never reach the send queue').to.be.empty;
            expect(adapter.log.error.calledOnce, 'an error should have been logged').to.be.true;
            expect(adapter.log.error.firstCall.args[0]).to.match(/above the maximum/);
        });

        it('rejects a write below the configured minimum and does not enqueue it', async () => {
            await reportVersionAndCreateStates();
            const id = `${adapter.namespace}.Heizkreis-A.Betriebsart`; // betrieb_A, min 0 / max 5

            adapter.onStateChange(id, { val: -1, ack: false });
            await flush();

            expect(session.enqueued).to.be.empty;
            expect(adapter.log.error.calledOnce).to.be.true;
            expect(adapter.log.error.firstCall.args[0]).to.match(/below the minimum/);
        });

        it('reverts the displayed value to the last acknowledged one after rejecting an out-of-range write', async () => {
            await reportVersionAndCreateStates();
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
            expect(session.enqueued).to.be.empty;
        });

        it('still enqueues writes for fields with no configured min/max (unchanged behavior)', async () => {
            await reportVersionAndCreateStates();
            const id = `${adapter.namespace}.Warmwasser.Sollwert`; // WW_soll - no min/max configured

            adapter.onStateChange(id, { val: 999999, ack: false });
            await flush();

            expect(session.enqueued, 'fields without configured limits are not restricted').to.have.lengthOf(1);
        });

        it('does nothing for a non-writable state even if it somehow arrives with ack=false', async () => {
            await reportVersionAndCreateStates();
            // Frostschutz A (frost_A) is read-only (writable: false)
            const id = `${adapter.namespace}.Heizkreis-A.Frostschutz`;

            adapter.onStateChange(id, { val: 1, ack: false });
            await flush();

            expect(session.enqueued).to.be.empty;
        });
    });
});
