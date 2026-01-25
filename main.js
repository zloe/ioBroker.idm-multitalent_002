'use strict';

/*
 * Created with @iobroker/create-adapter v2.0.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { time } = require('console');
const net = require('net');
const { isFunction } = require('util');

// Load your modules here, e.g.:
// const fs = require("fs");
const idm = require('./lib/idm-protocol');
const idm_u = require('./lib/idm-utils');
const Queue = require('./lib/queue');

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
        idm.initialize();
        this.connectedToIDM = false;
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    statesCreated;
    statesSubscribed;
    version;
    connectedToIDM;
    sendQueue = new Queue();
    maxWrites = 5; // max values to be set in one "loop"
    requestInitDelay = 600;
    requestDataBlockDelay = 1000;
    normalDataContentDelay = 1000; // for all datablocks
    retryDataContentDelay = 300; // for all datablocks
    currentRequests = 0;
    currentRetries = 0;
    maxRetries = 20; //after that many retries we start requesting data from scratch
    totalRetries = 0;
    totalRequests = 0;
    stateNameMap = new Map();

    idmProtocolState = -1;

    idmProtocolStateToText() {
        switch (this.idmProtocolState) {
            case -1:
                return 'not connected';
            case 0:
                return 'idle';
            case 1:
                return 'init sent waiting for answer';
            case 2:
                return 'init answer received';
            case 3:
                return 'data requested, waiting for ack';
            case 4:
                return 'data request ack received';
            case 5:
                return 'data content request sent, waiting for data';
            case 6:
                return 'data set value sent, waiting of ack';
            default:
                return 'unknown';
        }
    }

    speedAdjusted = false;
    AdjustSpeed() {
        if (this.speedAdjusted) return;
        const factor = idm.speed[this.version];
        if (factor != null && factor !== 100 && factor > 0) {
            this.log.info(`adjusting speed to ${factor}%`);
            const scale = 100 / factor;
            this.requestInitDelay = Math.round(this.requestInitDelay * scale);
            this.requestDataBlockDelay = Math.round(this.requestDataBlockDelay * scale);
            this.normalDataContentDelay = Math.round(this.normalDataContentDelay * scale);
            this.retryDataContentDelay = Math.round(this.retryDataContentDelay * scale);
            this.speedAdjusted = true;
        }
    }

    setIDMState(stateName, value) {
        this.setStateAsync(stateName, value, true);
    }

    /**
     * Creates a state for an IDM data point.
     *
     * @param {string} stateName - The name of the state
     * @param {boolean} [writable=false] - Whether the state is writable
     * @param {string} description - The state description
     * @param {number} functionNr - The function number of the state
     * @param {number} length - The length of the state
     * @param {number|null} factor - The factor for the state
     * @param {string} unitOfMeasure - The unit of measure for the state
     * @param {number} minVal - The minimum value
     * @param {number} maxVal - The maximum value
     * @param {any} block - Additional data block information
     */
    async createIDMState(stateName, writable = false, description, functionNr, length, factor, unitOfMeasure, minVal, maxVal, block) {
        const common = {
            name: stateName,
            type: 'number',
            role: 'value',
            read: true,
            write: !!writable,
            min: minVal,
            max: maxVal,
            unit: unitOfMeasure,
            desc: description,
        };

        await this.setObjectNotExistsAsync(stateName, {
            type: 'state',
            common,
            native: {},
        });

        this.stateNameMap.set(stateName, {
            function: functionNr,
            writable: !!writable,
            length,
            factor,
            unit: unitOfMeasure,
            min: minVal,
            max: maxVal,
            block,
        });

        const msg = writable
            ? `subscribing to state ${stateName}`
            : `not subscribing to state ${stateName}`;

        this.log.silly(msg);
        if (writable) this.subscribeStates(stateName);
    }

    // create the states
    async createStates() {
        this.log.debug('creating states');
        const dataBlocks = idm.getDataBlocks(this.version); // get the known data blocks for the connected version

        if (!dataBlocks) {
            this.log.warn('no data blocks defined, no states will be created');
            return;
        }

        // map state names with the adapter bound function as before
        idm.mapStatenames(this.version, this.createIDMState.bind(this));

        // preserve previous behavior: creation of block states is asynchronous and not awaited
        // but add small catch to surface unexpected errors.
        dataBlocks.forEach(element => {
            const stateName = `Data_block_${idm_u.get_byte(element)}`;
            this.setObjectNotExistsAsync(stateName, {
                type: 'state',
                common: {
                    name: stateName,
                    type: 'string',
                    role: 'value',
                    read: true,
                    write: false,
                },
                native: {},
            }).catch(err => {
                this.log.warn(`Failed to create state ${stateName}: ${err && err.message ? err.message : err}`);
            });
        });

        this.statesSubscribed = true;
        this.statesCreated = true;
        this.log.debug('states created');
    }

    // ... rest of file unchanged ...
