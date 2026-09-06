'use strict';

/*
 * Created with @iobroker/create-adapter v2.0.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");
const IdmProtocol = require('./lib/idm-protocol');
const idm_u = require('./lib/idm-utils');
const { IdmSession } = require('./lib/idm-session');

class IdmMultitalent002 extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'idm-multitalent_002'
        });
        this.statesCreated = false;
        this.statesSubscribed = false;
        // Each adapter instance gets its OWN IdmProtocol and IdmSession. They hold per-
        // connection state (the incoming-byte parser buffer, the request/response state
        // machine) as well as the data block definitions, which can now differ per instance
        // (see the "Custom data blocks directory" setting) - none of it may be shared with
        // another instance running in the same process, e.g. two heat pumps under ioBroker
        // "compact mode" would otherwise corrupt each other's incoming data. See lib/idm-
        // session.js and lib/idm-protocol.js for why.
        this.idm = new IdmProtocol();
        // Load the bundled defaults now, so this.idm.* is usable even before onReady/config are
        // available. onReady() re-runs this with the configured custom directory (if any).
        this.idm.initialize();
        this.connectedToIDM = false;
        /** @type {IdmSession | null} created in onReady(), once this.config is available */
        this.session = null;
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    statesCreated;
    statesSubscribed;
    version;
    connectedToIDM;
    stateNameMap = new Map();
    // Last value actually confirmed for a state - either read from the heat pump, or a write
    // to it that was accepted and enqueued. Used to restore the displayed value if a write is
    // rejected by sendValue() (out of range), so the UI doesn't keep showing a value that was
    // never actually sent.
    lastAckedValue = new Map();

    setIDMState(stateName, value) {
        this.lastAckedValue.set(stateName, value);
        this.setStateAsync(stateName, value, true).catch(e => this.log.error('failed to set state ' + stateName + ': ' + e));
    }

    /**
     * @param {string} stateName
     * @param {any} description
     * @param {any} functionNr
     * @param {any} length
     * @param {any} factor
     * @param {any} unitOfMeasure
     * @param {any} minVal
     * @param {any} maxVal
     * @param {any} block
     */
    async createIDMState(stateName, writable = false, description, functionNr, length, factor, unitOfMeasure, minVal, maxVal, block) {
        await this.setObjectNotExistsAsync(stateName, {
            type: 'state',
            common: {
                name: stateName,
                type: 'number',
                role: 'value',
                read: true,
                write: writable,
                min: minVal,
                max: maxVal,
                unit: unitOfMeasure,
                desc: description,

            },
            native: {},
        });

        this.stateNameMap.set(stateName, {
            function : functionNr, writable: writable, length: length, factor: factor, unit: unitOfMeasure, min: minVal, max: maxVal, block: block
        });
        //this.log.debug('added to stateNameMap: ' + this.namespace + '.' + stateName + ' === ' + JSON.stringify(this.stateNameMap.get(stateName)));
        if (writable) {
            this.log.silly('subscribing to state ' + stateName + ' ***************');
            this.subscribeStates(stateName);
        } else {
            this.log.silly('not subscribing to state ' + stateName + (writable ? ' but was writable' : ''));
        }
    }

    // create the states
    async CreateStates() {
        this.log.debug('creating states');
        const dataBlocks = this.idm.getDataBlocks(this.version); // get the known data blocks for the connected version

        if (!dataBlocks) {
            this.log.warn('no data blocks defined, no states will be created');
            return;
        }

        // Wait for every state to actually be created before flagging statesCreated/statesSubscribed -
        // Array.prototype.forEach does not await its (async) callback, so this used to mark the states
        // as created while most of the setObjectNotExistsAsync calls were still in flight.
        await this.idm.mapStatenames(this.version, this.createIDMState.bind(this));
        for (const element of dataBlocks) {
            const stateName = 'Data_block_' + idm_u.get_byte(element);
            await this.setObjectNotExistsAsync(stateName, {
                type: 'state',
                common: {
                    name: stateName,
                    type: 'string',
                    role: 'value',
                    read: true,
                    write: false,
                },
                native: {},
            });
        }
        this.statesSubscribed = true;
        this.statesCreated = true;
        this.log.debug('states created');
    }

    initialConnectionDelay = 2000;
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // Reload the hardware data block definitions now that this.config is available: if
        // "Custom data blocks directory" is set in the instance configuration, any per-version
        // file in there (see lib/datablocks/README.md for the format) replaces the matching
        // bundled definition after validation, so device support, field fixes or min/max
        // limits can be added/changed without an adapter update.
        this.idm.initialize(this.config.dataBlocksDir, msg => this.log.warn(msg));
        this.log.info('data block definitions available for: ' + [...this.idm.dataDefinitions.keys()].sort().join(', '));
        if (this.config.dataBlocksDir) {
            const overridden = [...this.idm.dataSources]
                .filter(([, file]) => file.startsWith(this.config.dataBlocksDir))
                .map(([version]) => version);
            if (overridden.length > 0) {
                this.log.info('using custom data block definitions from ' + this.config.dataBlocksDir + ' for: ' + overridden.join(', '));
            } else {
                this.log.info('"Custom data blocks directory" is set (' + this.config.dataBlocksDir + '), but none of its files were used - check the warnings above and the bundled definitions are being used for every version');
            }
        }

        // The session owns the TCP connection and the request/response state machine (see
        // lib/idm-session.js); it knows nothing about ioBroker, so everything it needs to
        // report - a connection change, the version, a parsed data block, a single field's
        // value - comes back through these hooks instead.
        this.session = new IdmSession(
            this.idm,
            {
                tcpserverip: this.config.tcpserverip,
                tcpserverport: this.config.tcpserverport,
                reconnectinterval: this.config.reconnectinterval,
            },
            this.log,
            {
                onConnectionChange: (connected) => {
                    this.connectedToIDM = connected;
                    this.setState('info.connection', connected, true, (err) => {
                        // analyse if the state could be set (because of permissions)
                        if (err && this.log) this.log.error('Can not update connected state: ' + err);
                        else if (this.log) this.log.debug('connected set to ' + connected);
                    });
                },
                onVersion: (version) => {
                    this.version = version;
                    if (this.idm.dataDefinitions.has(version)) {
                        this.log.info('heat pump reports version "' + version + '" - using its data block definition (' + this.idm.dataSources.get(version) + ')');
                    } else {
                        this.log.warn('heat pump reports version "' + version + '", but no data block definition is available for it (see the list logged above) - no sensor/settings data can be read or written');
                    }
                    this.setStateAsync('idm_control_version', version, true)
                        .catch(e => this.log.error('failed to set idm_control_version: ' + e));
                    this.CreateStates().catch(e => this.log.error('failed to create states: ' + e));
                },
                onNeedStates: () => {
                    if (!this.statesCreated) {
                        // not awaited here (this hook is not async) - catch so a rejection
                        // doesn't surface as an unhandled promise rejection
                        this.CreateStates().catch(e => this.log.error('failed to create states: ' + e));
                    }
                },
                onDataBlockText: (stateName, text) => {
                    this.setStateAsync(stateName, text, true).catch(e => this.log.error('failed to set state ' + stateName + ': ' + e));
                },
                onFieldUpdate: this.setIDMState.bind(this),
                setTimeout: this.setTimeout.bind(this),
                clearTimeout: this.clearTimeout.bind(this),
                setInterval: this.setInterval.bind(this),
                clearInterval: this.clearInterval.bind(this),
            }
        );

        this.subscribeStates('idm_control_version');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');

        /*
        For every state in the system there has to be also an object of type state
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
         */
        await this.setObjectNotExistsAsync('idm_control_version', {
            type: 'state',
            common: {
                name: 'idm_control_version',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });

        /*
        setState examples
        you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
         */
        // the variable config is set to true as command (ack=false)
        //await this.setStateAsync('configuration_text', this.config.tcpserverip);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync('config', { val: config.tcpserverip, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        //await this.setStateAsync('config', { val: config.tcpserverip, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync('admin', 'iobroker');
        //this.log.info('check user admin pw iobroker: ' + result);

        //result = await this.checkGroupAsync('admin', 'admin');
        //this.log.info('check group user admin group admin: ' + result);

        // limit restart frequencies to acceptable values

        this.setTimeout(() => { if (this.session) this.session.start(); }, this.initialConnectionDelay);

    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Tears down the TCP connection and every pending communication timer - leaving
            // any of these running past unload means they could still fire on a destroyed
            // socket / a terminated adapter instance afterwards.
            if (this.session) this.session.stop();
            callback();
        } catch (e) {
            if (this.log) this.log.error('error during unload: ' + e);
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //    }
    // }
    /**
     * Validates a value against the field's min/max (if configured) and, if it passes,
     * enqueues it to be sent to the heat pump. A value that fails validation is never sent;
     * the state is instead reverted to the last value we actually saw acknowledged, so the
     * UI does not keep showing a value the heat pump never received.
     * @param {string} stateName
     * @param {{ function: any; length: any; writable: any; factor: any; min?: number|null; max?: number|null }} definition
     * @param {string | number | boolean | null} value
     */
    async sendValue(stateName, definition, value) {
        if (!definition.writable) return;

        const check = this.idm.checkValueRange(definition, value);
        if (!check.ok) {
            this.log.error(`refusing to send ${stateName} = ${value}: ${check.reason} - nothing was sent to the heatpump`);
            if (this.lastAckedValue.has(stateName)) {
                this.setIDMState(stateName, this.lastAckedValue.get(stateName));
            }
            return;
        }

        this.log.info('********* all prerequisites met, enqueuing data to be sent, value = ' + check.value + ' factor = ' + definition.factor);
        if (this.session) {
            this.session.enqueueWrite(this.idm.create_set_value_message(definition.function, check.value, definition.length, definition.factor));
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            // if the state is still not acknowledged and the state is one of interrest then we enqueue the change
            if (state.ack === false) {
                const stateName = id.slice(this.namespace.length + 1);
                //this.log.debug('checking for state "' + stateName + '" in stateMap, ...' + (this.stateNameMap.has(stateName)?' found' : 'not found'));

                if (this.stateNameMap.has(stateName)) {
                    const definition = this.stateNameMap.get(stateName);
                    if (definition.writable) {
                        this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack}), checking before sending`);
                        this.sendValue(stateName, definition, state.val).catch(e => this.log.error('failed to process write to ' + stateName + ': ' + e));
                    }
                }
            }
            //this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }

}

if (require.main !== module) {
    // Export the constructor in compact mode
    //this.log.info("using constructor with parameters");
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new IdmMultitalent002(options);
} else {
    // otherwise start the instance directly
    //this.log.info("using default constructor");
    new IdmMultitalent002();
}
