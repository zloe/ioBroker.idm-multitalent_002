'use strict';

const net = require('net');
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
        this.hooks = {
            setTimeout: (fn, ms, ...args) => setTimeout(fn, ms, ...args),
            clearTimeout: (t) => clearTimeout(t),
            setInterval: (fn, ms, ...args) => setInterval(fn, ms, ...args),
            clearInterval: (t) => clearInterval(t),
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
        this.normalDataContentDelay = 1000; // for all datablocks
        this.retryDataContentDelay = 300; // for all datablocks
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

        this.speedAdjusted = false;

        this.lastSettingsIndex = 0; // used to iterate settings data blocks
        this.requestingSensorData = true;
        this.lastSensorIndex = 0;

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
        if (dataBlock === '07') {
            this.log.info('requesting data block ' + dataBlock + ', total requests ' + this.totalRequests +
                ', current retries ' + this.currentRetries + ' for ' + this.currentRequests + ' requests' +
                ', average retries ' + (this.totalRequests > 0 ? Math.round(this.totalRetries / this.totalRequests * 100) / 100 : 0));
            this.currentRequests = 0;
            this.currentRetries = 0;
        } else {
            this.log.debug('requesting data block ' + dataBlock);
        }
        this.sendDataBlockRequestTimer = this.hooks.setTimeout(this.send_data_block_request.bind(this, dataBlock), this.requestDataBlockDelay);
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
            this.lastSettingsIndex %= dataBlocks.length;
            datablockToRequest = dataBlocks[this.lastSettingsIndex++];
            this.requestingSensorData = true;
        }

        this.request_data_block(datablockToRequest);
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
                this.totalRequests++;
                this.currentRequests++;
                this.sendDataContentTimer = this.hooks.setTimeout(this.request_data_content.bind(this), this.normalDataContentDelay);
                return;
            }
            if (protocolState === 'NR') {
                if (this.protocolState !== STATE.DATA_CONTENT_REQUESTED) {
                    this.failWrongState('receive_data', STATE.DATA_CONTENT_REQUESTED);
                    return;
                }
                if (this.retryCount > this.maxRetries) {
                    this.log.warn('too many data content request retries (' + this.retryCount + '), retry whole request.');
                    this.protocolState = STATE.IDLE;
                    this.sendInitTimer = this.hooks.setTimeout(this.send_init.bind(this), this.requestInitDelay);
                    return;
                }
                this.retryCount++;
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

            const text = this.idm.interpret_data(this.version, received_data, this.hooks.onFieldUpdate);
            this.log.debug('received data: ' + received_data.length + ' - ' + text);

            if (protocolState.slice(0, 4) == 'Data') { // received a data block
                if (this.protocolState !== STATE.DATA_CONTENT_REQUESTED) {
                    this.failWrongState('receive_data', STATE.DATA_CONTENT_REQUESTED);
                    return;
                }
                this.hooks.onDataBlockText(protocolState, text);

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
                    this.version = text.slice(9);
                    this.setConnected(true);
                    this.AdjustSpeed();
                    this.hooks.onVersion(this.version);
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
