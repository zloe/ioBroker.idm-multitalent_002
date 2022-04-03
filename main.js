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
const Queue = require('./lib/queue');
const queue = require('./lib/queue');


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
        idm.initialize();
        this.connectedToIDM = false;
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }


    statesCreated;
    cyclicDataHandler;
    timeUpdater; // interval for updating the time on the iDM heatpump
    version;
    connectedToIDM;
    sendQueue = new Queue();
    maxWrites = 10;  // max values to be set in one "loop"


    // create the states
    async CreateStates(states) {
        this.log.debug('creating states');
        await states.forEach(async element => {
            var stateName = 'Data_block_' + idm.get_byte(element);
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
        this.statesCreated = true;
        this.log.debug('states created');
    }

    updateTime() {
        this.sendQueue.enqueue(this.create_update_time_messages.bind(this));
    }

    create_update_time_messages(action) {
        if (action) {
            let dateNow = new Date();
            let waitTime = 0;
            dateNow.setTime(dateNow.getTime() + 1000); // add 1 second as it takes some time to transmit the change
            let second = dateNow.getSeconds();
            if (second > 40) second = 40;
            const minute = dateNow.getMinutes();
            const hour = dateNow.getHours();
            const day = dateNow.getDate();
            const month = dateNow.getMonth() + 1;
            const year = dateNow.getFullYear();
            this.sendQueue.enqueue(idm.create_set_value_message(17,second/2,2));
            this.sendQueue.enqueue(idm.create_set_value_message(102, second, 1));
            this.sendQueue.enqueue(idm.create_set_value_message(103, minute, 1));
            this.sendQueue.enqueue(idm.create_set_value_message(104, hour, 1));
            this.sendQueue.enqueue(idm.create_set_value_message(105, day, 1));
            this.sendQueue.enqueue(idm.create_set_value_message(106, month, 1));
            this.sendQueue.enqueue(idm.create_set_value_message(136, year, 2));    
        }
        else return 6;
    }

    write(item) {
        var message = new Uint8Array(item.length);
        for(let i = 0; i < item.length; i++) {
            message[i] = item[i];
        }
        if (this.client) {
         this.client.write(message);
           this.log.info('would send: ' + idm.get_protocol_string(message));
        }
    }

    handle_communication() {
        // first send from the sendQueue, but not more than 10 items at once
        let count = 0;
        while(count++ < this.maxWrites && this.sendQueue.hasItems) {
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
            if (this.client) setTimeout(this.send_init.bind(this), 2*count * 1100)
            if (this.client) setTimeout(this.write.bind(this, item), (2*count+1) * 1100);
            if (this.client) setTimeout(this.write.bind(this, item), (2*count+1) * 1100 + 600);
        }


        // now request the data
        setTimeout(this.request_data.bind(this), 2*count * 1100 + 600);
    }

    // send the init message to the control
    send_init() {
        var init_message = idm.create_init_message();
        this.log.silly('init message: ' + idm.get_protocol_string(init_message));
        if(this.client) this.client.write(init_message);
    }

    // send a data block request to the control
    send_data_block_request(dataBlock) {
        this.log.debug('sending request');
        var requestMessage = idm.create_request_data_block_message(dataBlock);
        if (this.client) this.client.write(requestMessage);
    }

    // request a particular data block
    request_data_block(dataBlock) {
        this.log.debug('requesting data block ' + dataBlock);
        this.send_init(); // directly send init, no delay needed
        // assume that the answer is sent within one second
        setTimeout(this.send_data_block_request.bind(this, dataBlock), 1250);
        
    }

    // request all data blocks for a particular version in a loop, ... with a pause inbetween 
    request_data() {
      this.log.debug('requesting data for ' + this.version);
      this.haveData = true;
      var dataBlocks = idm.getDataBlocks(this.version); // get the known data blocks for the connected version

      if (!dataBlocks) {
        this.log.debug('no data blocks defined, no data will be requested'); 
        return;
    }

      if (!this.statesCreated) {
          this.CreateStates(dataBlocks); // create the states according to the connected version
      }

      // request loop for all known data blocks
      for (var i = 0; i < dataBlocks.length; i +=1 ) {
          setTimeout(this.request_data_block.bind(this, dataBlocks[i]), (i+1) * 3750);
      }

    }

    // send a data content request to the control
    request_data_content() {
        var message = idm.create_request_data_content_message();
        this.log.debug('requesting data content');
        if (this.client) this.client.write(message);
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
          setTimeout(this.request_data_content.bind(this), 1250);
          return;
        }
        if (protocolState === 'S1') {
            return;
        }
        var text = idm.interpret_data(this.version, received_data);
        this.log.debug('received data: ' + received_data.length + ' - ' + text);
        if (protocolState.slice(0,4) == 'Data') { // received a data block, setting the according state
            this.setStateAsync(protocolState, text, true);
            return;
        }
        if (text.slice(0,1) ==="V") { // received answer to init message, if the first one after connection set the state
            if (!this.connectedToIDM) {
                this.version = text.slice(9);
                this.setStateAsync('idm_control_version', this.version, true);
                this.setConnected(true);
            }
        } else {
          this.log.debug('not sure what to do');
          this.log.info('unknown protocol state ' + protocolState + ' data=' + text);

        }
      } else if (state > 3) {
        idm.reset();
      }

    }

    setConnected(isConnected) {
      this.log.info('setConnected, current state ' + this.connectedToIDM + '  new state ' + isConnected);
      if (this.connectedToIDM !== isConnected) {
          this.connectedToIDM = isConnected;
          this.log.debug('setting connected state to: ' + this.connectedToIDM);
          this.setState('info.connection', this.connectedToIDM, true, (err) => {
              // analyse if the state could be set (because of permissions)
              if (err && this.log) this.log.error('Can not update connected state: ' + err);
              else if (this.log) this.log.debug('connected set to ' + this.connectedToIDM);
          });
          if(this.connectedToIDM && this.version && !this.cyclicDataHandler) { // connected, set interval for data readout
              this.log.debug('creating cyclic timer to request data every ' + this.config.pollinterval + ' seconds');
              this.cyclicDataHandler = setInterval(this.handle_communication.bind(this), this.config.pollinterval * 1000);
              if (this.config.autoupdatetime) {
                  this.timeUpdater = setInterval(this.updateTime.bind(this), 47000);
              }
              this.log.debug('timer id ' + this.cyclicDataHandler);
          }
          if(!this.connectedToIDM && this.cyclicDataHandler) { // disconnectd, clear interval
              this.log.debug('clear cyclic timer');
              clearInterval(this.cyclicDataHandler);
              this.cyclicDataHandler = undefined;
              clearInterval(this.timeUpdater);
              this.timeUpdater = undefined;
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

      
        this.connectAndRead();
       
    
    }

    // at start connect and send the init message to get the version number of the Multitalent control
    connectAndRead() {
        this.client = new net.Socket();

        this.client.connect(this.config.tcpserverport, this.config.tcpserverip, this.send_init.bind(this));
        this.client.on('data', this.receive_data.bind(this));
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
            if (this.timeUpdater) {
                clearInterval(this.timeUpdater);
                this.timeUpdater = undefined;
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
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
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