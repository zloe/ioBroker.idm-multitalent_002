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
    cyclicDataHandler;
    version;
    connectedToIDM;
    sendQueue = new Queue();
    maxWrites = 10;  // max values to be set in one "loop"
    requestInterval = 3200;
    requestInitDelay = 600;
    requestDataBlockDelay = 600;
    requestDataContentDelay = 1500;
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
          this.log.debug('no data blocks defined, no states will be created'); 
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

    create_update_time_messages(action) {
        if (action) {
            let dateNow = new Date();
            let waitTime = 0;
            dateNow.setTime(dateNow.getTime() + 1000); // add 1 second as it takes some time to transmit the change
            let second = (dateNow.getMilliseconds()/10) % 20;
            if (second > 40) second = 40;

            this.sendQueue.enqueue(idm.create_set_value_message(17,second,2));

        }
        else return 1;
    }

    sendSetValueMessage(item) {
        if (this.idmProtocolState !== 2 && this.idmProtocolState !== 0) {
            this.log.info('wrong state, should be in 2 but we are in ' + this.idmProtocolState + ' resetting connection');
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
    
    setValueDelay = 1100;
    secondSetValueOffset = 600; // after which delay a value is set the second time (seems to be required in most cases)

    handle_communication() {
        // first send from the sendQueue, but not more than 10 items at once
        let count = 0;
        this.maxWrites = this.config.pollinterval - (this.requestInterval * 6 + this.secondSetValueOffset)/1000;
        this.maxWrites = Math.floor(this.maxWrites / (2 * this.setValueDelay / 1000 ));  

        this.log.debug('********* check if data has to be sent, max sent at once: ' + this.maxWrites);

        while(count++ < this.maxWrites && this.sendQueue.hasItems) {
            this.log.debug('********* found data to be sent');
            let item = this.sendQueue.peek(); 
            if (isFunction(item)) {
                const numItems = item(false); // get the number of items to be generated 
                if (count + numItems <= this.maxWrites) {
                    count --;
                    item = this.sendQueue.dequeue();
                    item(true); // call the function that creates the messages to be sent
                    continue;
                } else {
                    break; // not enough slots free to be sent at once, so skip it this time
                }
            }
            item = this.sendQueue.dequeue();
            this.log.info('setting values: ' + idm.get_protocol_string(item));

            if (this.client) setTimeout(this.send_init.bind(this), 2*count * this.setValueDelay)
            if (this.client) setTimeout(this.sendSetValueMessage.bind(this, item), (2*count+1) * this.setValueDelay);
            if (this.client) setTimeout(this.sendSetValueMessage.bind(this, item), (2*count+1) * this.setValueDelay + this.secondSetValueOffset);
 
           }


        // now request the data
        setTimeout(this.request_data.bind(this), 2*count * this.setValueDelay + this.secondSetValueOffset);
    }


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
            this.log.info('wrong state, should be in -1 or 0 but we are in ' + this.idmProtocolState + ' resetting connection');
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
            this.log.info('wrong state, should be in 2 but we are in ' + this.idmProtocolState + ' resetting connection');
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
        this.log.debug('requesting data block ' + dataBlock);
        this.send_init(); // directly send init, no delay needed
        // assume that the answer is sent within one second
        setTimeout(this.send_data_block_request.bind(this, dataBlock), this.requestDataBlockDelay);
        
    }

    lastSettingsIndex = 0; // used to iterate settings data blocks
    
    // request all sensor data blocks for a particular version and one set of settings data blocks in a loop, ... with a pause inbetween 
    request_data() {
        this.log.debug('requesting data for ' + this.version);
        this.haveData = true;
        var dataBlocks = idm.getSensorDataBlocks(this.version); // get the known data blocks for the connected version
        if (!dataBlocks) {
            this.log.debug('no sensor data blocks defined, no data will be requested'); 
            return;
        }

        if (!this.statesCreated) {
            this.CreateStates(); // create the states according to the connected version
        }

        // request loop for all known sensor data blocks
        let i, delayMultiplier = 0;
        for (i = 0; i < dataBlocks.length; i++, delayMultiplier++ ) {
            setTimeout(this.request_data_block.bind(this, dataBlocks[i]), delayMultiplier * this.requestInterval + this.requestInitDelay);
        }

        // request the next settings datablock
        var dataBlocksArray = idm.getSettingsDataBlocks(this.version);
        if (!dataBlocksArray) {
            this.log.debug('no settings data blocks defined, no settings data will be requested'); 
            return;
        }
        this.lastSettingsIndex %= dataBlocksArray.length;
        dataBlocks = dataBlocksArray[this.lastSettingsIndex++];
        if (!dataBlocks) {
            this.log.debug('no sensor data blocks defined, no data will be requested'); 
            return;
        }
        for (i = 0; i < dataBlocks.length; i++, delayMultiplier++ ) {
            setTimeout(this.request_data_block.bind(this, dataBlocks[i]), delayMultiplier * this.requestInterval + this.requestInitDelay);
        }        

    }

    // send a data content request to the control
    request_data_content() {
        if (this.idmProtocolState !== 4) {
            this.log.info('wrong state, should be in 4 but we are in ' + this.idmProtocolState + ' resetting connection');
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

    // callback for data received from control
    receive_data(data) {
      var state = idm.add_to_packet(data);
      this.log.silly('************* receiving **************** state ' + state + ' data=' + idm.get_protocol_string(data));
      if (state == 3) { // data packed received completely, let's check what we've got
        var received_data = idm.get_data_packet();
        idm.reset();   // reset the packet reader to be ready for the next packet
        var protocolState = idm.protocol_state(received_data);
        this.log.debug('protocol state ' + protocolState);
        if (protocolState === 'R1') {// successful data request, we can request the real data now, after a short pause ofc.  
            if (this.idmProtocolState !== 3) {
                this.log.info('wrong state, should be in 3 but we are in ' + this.idmProtocolState + ' resetting connection');
                this.setConnected(false, true);
                return;
            }
            this.idmProtocolState = 4;
            setTimeout(this.request_data_content.bind(this), this.requestDataContentDelay);
            return;
        }
        if (protocolState === 'S1') {
            if (this.idmProtocolState !== 6) {
                this.log.info('wrong state, should be in 6 but we are in ' + this.idmProtocolState + ' resetting connection');
                this.setConnected(false, true);
                return;
            }
            this.idmProtocolState = 0;
            return;
        }
        var text = idm.interpret_data(this.version, received_data, this.setIDMState.bind(this));
        this.log.debug('received data: ' + received_data.length + ' - ' + text);
        if (protocolState.slice(0,4) == 'Data') { // received a data block, setting the according state
            if (this.idmProtocolState !== 5) {
                this.log.info('wrong state, shold be in 5 but we are in ' + this.idmProtocolState + ' resetting connection');
                this.setConnected(false, true);
                return;
            }
            this.idmProtocolState = 0; 
            this.setStateAsync(protocolState, text, true);
            return;
        }
        if (text.slice(0,1) ==="V") { // received answer to init message, if the first one after connection set the state
            if (this.idmProtocolState !== 1) {
                this.log.info('wrong state, should be in 1 but we are in ' + this.idmProtocolState + ' resetting connection');
                this.setConnected(false, true);
                return;
            }
            this.idmProtocolState = 2;
            if (!this.connectedToIDM) {
                this.version = text.slice(9);
                this.setStateAsync('idm_control_version', this.version, true);
                this.setConnected(true);
                this.CreateStates();
                this.idmProtocolState = 0; // this is the first contact to get the verison, we are back to idle
            }
        } else {
          this.log.info('not sure what to do, idm-protocol-state' + this.idmProtocolStateToText());
          this.log.info('unknown protocol state ' + protocolState + ' data=' + text);
        }
      } else if (state > 3) {
        idm.reset();
      }

    }

    /**
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
                this.log.debug('reconnect timer set to ' + this.config.reconnectinterval + ' sec');
            }
          }
        }
        this.setState('info.connection', this.connectedToIDM, true, (err) => {
          // analyse if the state could be set (because of permissions)
          if (err && this.log) this.log.error('Can not update connected state: ' + err);
          else if (this.log) this.log.debug('connected set to ' + this.connectedToIDM);
        });
        if(this.connectedToIDM && this.version && !this.cyclicDataHandler) { // connected, set interval for data readout
          this.log.debug('creating cyclic timer to request data every ' + Math.max(this.config.pollinterval, this.requestInterval*7/1000) + ' seconds');
          this.cyclicDataHandler = setInterval(this.handle_communication.bind(this), Math.max(this.config.pollinterval * 1000, this.requestInterval*7));
          this.log.debug('timer id ' + this.cyclicDataHandler);
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
        if(!this.connectedToIDM && this.cyclicDataHandler) { // disconnectd, clear interval
          this.log.debug('clear cyclic timer');
          clearInterval(this.cyclicDataHandler);
          this.cyclicDataHandler = undefined;
        }
      } else {
          if (isConnected === false && this.resendInterval) {
              this.idmProtocolState = -1;
              this.log.debug('waiting for answer from heatpump, got disconnected from TCP to SERIAL adapter, stopping resend and try to reconnect');
              clearInterval(this.resendInterval);
              this.resendInterval = undefined;
              if(!this.reconnectTimer) {
                this.reconnectTimer = this.setTimeout(this.connectAndRead.bind(this), this.config.reconnectinterval * 1000);
                this.log.debug('reconnect timer set to ' + this.config.reconnectinterval + ' sec');
            }
          }
      }

    }
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

        // limit the poll and restart frequencies to acceptable values
        this.config.pollinterval = Math.max(this.config.pollinterval, this.requestInterval*7/1000); // 
        this.config.reconnectinterval = Math.max(this.config.reconnectinterval, this.config.pollinterval * 2);

        this.connectAndRead();
       
    
    }

    reconnectTimer; // timer for tcp connection retries
    resendInterval;    // time for missing answers from heatpump

    socketRecycleTime = 2000;
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
        this.send_first_init();
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
            if (this.cyclicDataHandler) {
                clearInterval(this.cyclicDataHandler);
                this.cyclicDataHandler = undefined;               
            }
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
     * @param {{ function: any; length: any; writable: any}} definition
     * @param {string | number | boolean | null} value
     */
    sendValue(definition, value) {
        if (definition.writable) {
        //this.log.debug('********* all prerequisites met, enqueuing data to be sent');
        this.sendQueue.enqueue(idm.create_set_value_message(definition.function, value, definition.length));
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