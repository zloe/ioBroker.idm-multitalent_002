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
        //this.log.info('created');
        this.statesCreated = false;
        this.statesSubscribed = false;
        idm.initialize();
        this.connectedToIDM = false;
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
    sendQueue = new Queue();
    maxWrites = 5;  // max values to be set in one "loop"
    requestInitDelay = 700;
    requestDataBlockDelay = 700;
    requestDataContentDelay = 1500;
    maxRequestDataContentDelay = 2500;
    stateNameMap = new Map();

    idmProtocolState = -1; 
    // -1 for not connected
    // 0 for idle, or data received, or data set value ack received
    // 1 for init sent waiting for answer
    // 2 for init answer received
    // 3 for data requested, waiting for ack
    // 4 for data request ack received
    // 5 for data content request sent, waiting for data 
    // 6 for data set value sent, waiting of ack

    idmProtocolStateToText() {
        switch(this.idmProtocolState) {
            case -1: return 'not connected';
            case 0: return 'idle';
            case 1: return 'init sent waiting for answer';
            case 2: return 'init answer received';
            case 3: return 'data requested, waiting for ack';
            case 4: return 'data request ack received';
            case 5: return 'data content request sent, waiting for data';
            case 6: return 'data set value sent, waiting of ack';
        }
    }

    setIDMState(stateName, value) {
        this.setStateAsync(stateName, value, true);
    }

    /**
     * @param {string} stateName
     * @param {any} description
     * @param {any} functionNr
     * @param {any} length
     * @param {any} unitOfMeasure
     * @param {any} minVal
     * @param {any} maxVal
     * @param {any} block
     */
    async createIDMState(stateName, writable = false, description, functionNr, length, unitOfMeasure, minVal, maxVal, block) {
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

        this.stateNameMap.set(stateName, { function: functionNr, writable: writable, length: length, unit: unitOfMeasure, min: minVal, max: maxVal, block: block});
        //this.log.debug('added to stateNameMap: ' + this.namespace + '.' + stateName + ' === ' + JSON.stringify(this.stateNameMap.get(stateName)));
        if (writable) {
            this.log.silly('subscribing to state ' + stateName + ' ***************');
            this.subscribeStates(stateName);
        }  else {
            this.log.silly('not subscribing to state ' + stateName + (writable ? ' but was writable' : ''));        
        }
    }



    // create the states
    async CreateStates() {
        this.log.debug('creating states');
        var dataBlocks = idm.getDataBlocks(this.version); // get the known data blocks for the connected version

        if (!dataBlocks) {
          this.log.warn('no data blocks defined, no states will be created'); 
          return;
        }
  
        idm.mapStatenames(this.version, this.createIDMState.bind(this));
        await dataBlocks.forEach(async element => {
            var stateName = 'Data_block_' + idm_u.get_byte(element);
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
        });
        this.statesSubscribed = true;
        this.statesCreated = true;
        this.log.debug('states created');
    }

    sendSetValueMessage(item) {
        if (this.idmProtocolState !== 2 && this.idmProtocolState !== 0) {
            this.log.warn('wrong state, should be in 2 but we are in ' + this.idmProtocolState + ' resetting connection');
            this.setConnected(false, true);
            return;
        }
        var message = new Uint8Array(item.length);
        for(let i = 0; i < item.length; i++) {
            message[i] = item[i];
        }

        if (this.client) {
           this.client.write(message);
           this.log.info('sent: ' + idm.get_protocol_string(message));
           this.idmProtocolState = 6;
        }
    }
    
    setValueDelay = 1000;
    secondSetValueOffset = 1000; // after which delay a value is set the second time (seems to be required in most cases)
    send_count = 0;
    send_state = 0;
    itemToBeSent;
    // returns true if something was written (init or set value message)
    // returns false if nothing has been written
    write_data_to_heatpump(first_call) {

        this.log.debug('********* check if data has to be sent, max sent at once: ' + this.maxWrites);

        if (first_call) {
            this.send_count = 0;
            this.send_state = 0;
        }
        if ((this.send_count < this.maxWrites && this.sendQueue.hasItems) || this.send_state > 0) {
            this.log.debug('********* found data to be sent, state: ' + this.send_state);
            if (this.send_state === 0) {
                this.itemToBeSent = this.sendQueue.dequeue();
                this.log.info('setting values: ' + idm.get_protocol_string(this.itemToBeSent));
                if (this.client) setTimeout(this.send_init.bind(this), this.setValueDelay);
                this.send_state++;
            } else if (this.send_state === 1) {
                if (this.client) setTimeout(this.sendSetValueMessage.bind(this, this.itemToBeSent), this.setValueDelay);
                this.send_state++;
            } else if (this.send_state === 2) {
                if (this.client) setTimeout(this.sendSetValueMessage.bind(this, this.itemToBeSent), this.secondSetValueOffset);
                this.send_state=0;
                this.send_count++;
            }
            return true;
           } else {
            return false;
           }
    }

    // first contact, ... set the correct state and go 
    send_first_init() {
        this.idmProtocolState = -1;
        this.send_init();
    }

    // send the init message to the control
    send_init() {
        if (this.connectedToIDM === false) {
            this.log.info('sending initial init message to heatpump');
        }
        if (this.idmProtocolState > 0) {
            this.log.warn('send_init: wrong state, should be in -1 or 0 but we are in ' + this.idmProtocolState + ' resetting connection');
            this.setConnected(false, true);
            return;
        }

        var init_message = idm.create_init_message();
        this.log.silly('init message: ' + idm.get_protocol_string(init_message));
        if(this.client) {
            this.client.write(init_message);
            this.idmProtocolState = 1;
        }

        
    }

    // send a data block request to the control
    /**
     * @param {string} dataBlock
     */
    send_data_block_request(dataBlock) {
        if (this.idmProtocolState !== 2) {
            if (this.idmProtocolState == -1) { this.log.info('send_data_block_request: not connected, ignore'); return;}
            this.log.warn('send_data_block_request: wrong state, should be in 2 but we are in ' + this.idmProtocolState + ' resetting connection');
            this.setConnected(false, true);
            return;
        }
        this.log.debug('sending request');
        var requestMessage = idm.create_request_data_block_message(dataBlock);
        if (this.client) {
            this.client.write(requestMessage);
            this.idmProtocolState = 3;
        }
    }

    // request a particular data block
    /**
     * @param {string} dataBlock
     */
     request_data_block(dataBlock) {
        if (dataBlock === '07') {
            this.log.info('requesting data block ' + dataBlock + ' requestDataContentDelay currently ' + this.requestDataContentDelay);
        } else {
            this.log.debug('requesting data block ' + dataBlock);
        }
        // this.send_init(); // directly send init, no delay needed
        // assume that the answer is sent within one second
        // TODO: this needs to be done in receive data, ...
        setTimeout(this.send_data_block_request.bind(this, dataBlock), this.requestDataBlockDelay);
        
    }

    lastSettingsIndex = 0; // used to iterate settings data blocks
    requestingSensorData = true;
    lastSensorIndex = 0;
    // request all sensor data blocks for a particular version and one set of settings data blocks in a loop, ... with a pause inbetween 
    request_data() {
        this.log.debug('requesting data for ' + this.version);
        this.haveData = true;
        let datablockToRequest = "";
        // request loop for all known sensor data blocks
        if (this.requestingSensorData) {
            var dataBlocks = idm.getSensorDataBlocks(this.version); // get the known data blocks for the connected version
            if (!dataBlocks) {
                this.log.warn('no sensor data blocks defined, no data will be requested'); 
                this.requestingSensorData = false;
                return;
            }

            if (!this.statesCreated) {
                this.CreateStates(); // create the states according to the connected version
            }
            datablockToRequest = dataBlocks[this.lastSensorIndex++];
            if (this.lastSensorIndex >= dataBlocks.length) {
                this.lastSensorIndex = 0;
                this.requestingSensorData = false;
            }

        } else {

            // request the next settings datablock
            var dataBlocks = idm.getSettingsDataBlocks(this.version);
            if (!dataBlocks) {
                this.log.info('no settings data blocks defined, no settings data will be requested'); 
                this.requestingSensorData = true;
                return;
            }
            this.lastSettingsIndex %= dataBlocks.length;
            datablockToRequest = dataBlocks[this.lastSettingsIndex++];
            this.requestingSensorData = true;
        }

        setTimeout(this.request_data_block.bind(this, datablockToRequest), this.requestInitDelay);

    }

    // send a data content request to the control
    request_data_content() {
        if (this.idmProtocolState !== 4) {
            if (this.idmProtocolState == -1) { this.log.info('request_data_content: not connected, ignore'); return;}
            this.log.warn('request_data_content: wrong state, should be in 4 but we are in ' + this.idmProtocolState + ' resetting connection');
            this.setConnected(false, true);
            return;
        }
        var message = idm.create_request_data_content_message();
        this.log.debug('requesting data content');
        if (this.client) {
            this.client.write(message);
            this.idmProtocolState = 5;
        }
    }

    need_to_send_data = false;
    // callback for data received from control
    // this will be the main method for handling the state machine and communication with the heatpump
    // we have the "internal" receiving state ( 1.. receiving data, 2.. receiving checksum, 3.. finished, all above 3 are error states)
    // then the protocolState ( 
    //      E0.. too short packet, 
    //      E1.. request data error, 
    //      E2.. request data - invalid response, 
    //      I1.. init ok, 
    //      R1.. request data ok, 
    //      S1.. set value ok, 
    //      U1.. unknown response)
    // and the idmProtocolState 
    //      -1.. not connected
    //       0.. idle or data received --> 1 or 6
    //       1.. init sent, waiting for answer --> 2
    //       2.. init answer received --> 3 or 0 on initial contact or 6 on data to be sent
    //       3.. data requested, waiting for ack --> 4
    //       4.. data request ack received --> 5
    //       5.. data content request sent, waiting for data --> 0 
    //       6.. data set value sent, waiting for ack  --> 0
    receive_data(data) {
      var state = idm.add_to_packet(data);
      this.log.silly('************* receiving **************** state ' + state + ' data=' + idm.get_protocol_string(data));
      if (state == 3) { // data packed received completely, let's check what we've got
        var received_data = idm.get_data_packet();
        idm.reset();   // reset the packet reader to be ready for the next packet
        var protocolState = idm.protocol_state(received_data);
        this.log.debug('protocol state ' + protocolState);
        if (protocolState === 'R1') {// successful data request, we have to be in state 3 and move to 4  
            if (this.idmProtocolState !== 3) {
                this.log.warn('receive_data: wrong state, should be in 3 but we are in ' + this.idmProtocolState + ' resetting connection');
                this.setConnected(false, true);
                return;
            }
            this.idmProtocolState = 4;
            setTimeout(this.request_data_content.bind(this), this.requestDataContentDelay); // request the data content
            return;
        }
        if (protocolState === 'S1') { // have to be in idmProtocolState 6
            if (this.idmProtocolState !== 6) {
                this.log.warn('receive_data: wrong state, should be in 6 but we are in ' + this.idmProtocolState + ' resetting connection');
                this.setConnected(false, true);
                return;
            }
            this.idmProtocolState = 0;
            this.need_to_send_data = this.write_data_to_heatpump(!this.need_to_send_data);
            if (!this.need_to_send_data) this.setTimeout(this.send_init.bind(this), this.requestInitDelay);
            return;
        }
        var text = idm.interpret_data(this.version, received_data, this.setIDMState.bind(this));
        this.log.debug('received data: ' + received_data.length + ' - ' + text);
        if (protocolState.slice(0,4) == 'Data') { // received a data block, setting the according state
            if (this.idmProtocolState !== 5) {
                this.log.warn('receive_data: wrong state, shold be in 5 but we are in ' + this.idmProtocolState + ' resetting connection');
                this.setConnected(false, true);
                return;
            } 
            this.setStateAsync(protocolState, text, true);

            this.idmProtocolState = 0;
            this.need_to_send_data= this.write_data_to_heatpump(!this.need_to_send_data);
            if (!this.need_to_send_data) this.setTimeout(this.send_init.bind(this), this.requestInitDelay);
            return;
        }
        if (text.slice(0,1) ==="V") { // received answer to init message, if the first one after connection set the state
            if (this.idmProtocolState !== 1) {
                this.log.warn('receive_data: wrong state, should be in 1 but we are in ' + this.idmProtocolState + ' resetting connection');
                this.setConnected(false, true);
                return;
            }
            this.idmProtocolState = 2;
            if (!this.connectedToIDM) {
                this.version = text.slice(9);
                this.setStateAsync('idm_control_version', this.version, true);
                this.setConnected(true);
                this.CreateStates();
            }
            if (this.need_to_send_data) {
                this.need_to_send_data = this.write_data_to_heatpump(false);
            }
            if (!this.need_to_send_data) {
                this.request_data();                
            }
        } else {
            if (protocolState ==='E1' || protocolState === 'E2') {
                this.log.warn('data content request error, trying to increase wait time. Now: ' + this.requestDataContentDelay +
                                ', Max: ' + this.maxRequestDataContentDelay + ', New: ' + (this.requestDataContentDelay + 50));
                this.requestDataContentDelay = Math.min(this.requestDataContentDelay + 50, this.maxRequestDataContentDelay);
                this.idmProtocolState = 0;
                this.setTimeout(this.send_init.bind(this), this.requestInitDelay);
                return;
            }
            this.log.warn('not sure what to do, idm-protocol-state ' + this.idmProtocolStateToText());
            this.log.warn('unknown protocol state ' + protocolState + ' data=' + text);
            this.log.warn('trying to send init message to restart communication');
            this.idmProtocolState = 0;
            this.setTimeout(this.send_init.bind(this), this.requestInitDelay * 2);
        }
      } else if (state > 3) {
        idm.reset();
      }

    }

    /**
     * when connected, then we start the data readout from the heatpump here with a call to "handle_communication"
     * @param {boolean} isConnected
     */
    setConnected(isConnected, reconnect = false) {
      this.log.info('setConnected, current state ' + this.connectedToIDM + '  new state ' + isConnected);

      if (this.connectedToIDM !== isConnected) {
        this.connectedToIDM = isConnected;
        this.log.debug('setting connected state to: ' + this.connectedToIDM);

        if (isConnected === false) {
          if (this.client) this.client.destroy();
          this.client = null;
          this.idmProtocolState = -1;
          if (reconnect) {
            this.log.info('reconnection requested');
            if (this.resendInterval) {
                clearInterval(this.resendInterval);
                this.resendInterval = undefined;
            }
            if(!this.reconnectTimer) {
                this.reconnectTimer = this.setTimeout(this.connectAndRead.bind(this), this.config.reconnectinterval * 1000);
                this.log.info('reconnect timer set to ' + this.config.reconnectinterval + ' sec');
            }
          }
        }
        this.setState('info.connection', this.connectedToIDM, true, (err) => {
          // analyse if the state could be set (because of permissions)
          if (err && this.log) this.log.error('Can not update connected state: ' + err);
          else if (this.log) this.log.debug('connected set to ' + this.connectedToIDM);
        });
        if (this.connectedToIDM && this.version) { // connected, set interval for data readout

          if(this.resendInterval) {
              clearInterval(this.resendInterval);
              this.resendInterval = undefined;
          }
          if (this.reconnectTimer) {
            this.log.debug('clearing reconnect timeout as we are connected');
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
          }
        }
      } else {
          if (isConnected === false && this.resendInterval) {
              this.idmProtocolState = -1;
              this.log.info('waiting for answer from heatpump, got disconnected from TCP to SERIAL adapter, stopping resend and try to reconnect');
              clearInterval(this.resendInterval);
              this.resendInterval = undefined;
              if(!this.reconnectTimer) {
                this.reconnectTimer = this.setTimeout(this.connectAndRead.bind(this), this.config.reconnectinterval * 1000);
                this.log.info('reconnect timer set to ' + this.config.reconnectinterval + ' sec');
            }
          }
      }

    }

    initialConnectionDelay = 2000;
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        
    
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

        setTimeout(this.connectAndRead.bind(this), this.initialConnectionDelay);
       
    
    }

    reconnectTimer; // timer for tcp connection retries
    resendInterval;    // time for missing answers from heatpump

    socketRecycleTime = 5000;
    // at start connect and send the init message to get the version number of the Multitalent control
    connectAndRead() {
        this.log.debug('trying to connect to ' + this.config.tcpserverip + ':' + this.config.tcpserverport);
        this.client = new net.Socket();
        setTimeout(this.startConnection.bind(this),this.socketRecycleTime);
    }

    startConnection() {
        if (this.client) this.client.connect(this.config.tcpserverport, this.config.tcpserverip, this.socketConnectHandler.bind(this));

        // create an timeout if connection does not get established after specified timeout
        this.reconnectTimer = setTimeout(this.connectAndRead.bind(this), this.config.reconnectinterval * 1000);
    }

    socketConnectHandler() {
        this.log.debug('connection established');
        if (this.client) {
            this.client.on('data', this.receive_data.bind(this));
            this.client.on('close', this.socketCloseHandler.bind(this));
            this.client.on('disconnect', this.socketDisconnectHandler.bind(this));
            this.client.on('error', this.socketErrorHandler.bind(this));
        }
        if (this.reconnectTimer) {
            this.log.debug('clearing reconnect timer as we are connected');
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    // now all is prepared we can start "talking" to our heatpump
        this.resendInterval = setInterval(this.send_first_init.bind(this), this.config.reconnectinterval * 1000);
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
        this.idmProtocolState = -1;
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.setConnected(false);
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = undefined;
            }
            if (this.resendInterval) {
                clearInterval(this.resendInterval);
                this.resendInterval = undefined;
            }

            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
            this.client && this.client.destroy();
            callback();
        } catch (e) {
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
     * @param {{ function: any; length: any; writable: any; factor: any}} definition
     * @param {string | number | boolean | null} value
     */
    sendValue(definition, value) {
        if (definition.writable) {
        //this.log.debug('********* all prerequisites met, enqueuing data to be sent');
        this.sendQueue.enqueue(idm.create_set_value_message(definition.function, value, definition.length, definition.factor));
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
                    if (definition.writable ) {
                        this.sendValue(definition, state.val);
                        this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack}), will be sent`);
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