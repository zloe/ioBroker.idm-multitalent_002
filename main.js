'use strict';

/*
 * Created with @iobroker/create-adapter v2.0.2
 */


// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const net = require('net');

// Load your modules here, e.g.:
// const fs = require("fs");
const idm = require('./lib/idm-protocol');


class IdmMultitalent002 extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'idm-multitalent_002',
        });
        //this.log.info('created');
        idm.initialize();
        this.connectedToIDM = false;
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }



    cyclicReader;
    statesCreated = false;
    version;


    async CreateStates(states) {
        this.log.debug('creating states');
        await states.forEach(async element => {
            var stateName = 'Data_block_' + Number.parseInt(element);
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

    send_init() {
        var init_message = idm.create_init_message();
        this.log.silly('init message: ' + idm.get_protocol_string(init_message));
        if(this.client) this.client.write(init_message);
    }

    send_data_block_request(dataBlock) {
        this.log.debug('sending request');
        var requestMessage = idm.create_request_data_block_message(dataBlock);
        if (this.client) this.client.write(requestMessage);
    }

    request_data_block(dataBlock) {
        this.log.debug('requesting data block ' + dataBlock);
        setTimeout(this.send_init.bind(this), 900);
        setTimeout(this.send_data_block_request.bind(this, dataBlock), 1800);
        
    }

    request_data(version) {
      this.log.debug('requesting data for ' + version);
      this.haveData = true;
      var dataBlocks = idm.getDataBlocks(version);
      if (!this.statesCreated) {
          this.CreateStates(dataBlocks);
      }

      if (!dataBlocks) {
          this.log.debug('no data blocks defined, no data will be requested'); 
          return;
      }
      for (var i = 0; i < dataBlocks.length; i +=1 ) {
          setTimeout(this.request_data_block.bind(this, dataBlocks[i]), (i+1) * 3110);
      }

    }

    request_data_content() {
        var message = idm.create_request_data_content_message();
        this.log.debug('requesting data content');
        if (this.client) this.client.write(message);
    }

    receive_data(data) {
      var state = idm.add_to_packet(data);
      this.log.debug('************* receiving **************** state ' + state + ' data=' + idm.get_protocol_string(data));
      if (state == 3) {
        var received_data = idm.get_data_packet();
        idm.reset();
        var protocolState = idm.protocol_state(received_data);
        this.log.debug('protocol state ' + protocolState);
        if (protocolState === "R1") {// successful data request, we can request the real data now  
          setTimeout(this.request_data_content.bind(this), 900);
          return;
        }
        var text = idm.interpret_data(received_data);
        this.log.debug('received data: ' + received_data.length + ' - ' + text);
        if (protocolState.slice(0,4) == 'Data') { // received a data block, setting the according state
            this.setStateAsync(protocolState, text, true);
            return;
        }
        if (text.slice(0,1) ==="V") {
            if (!this.connectedToIDM) {
                this.version = text.slice(9);
                this.setStateAsync('idm_control_version', this.version, true);
                this.setConnected(true);
            }
        } else {
          this.log.debug('not sure what to do');
        }
      } else if (state > 3) {
        idm.reset();
      }

    }

    connectedToIDM;

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
          if(this.connectedToIDM && this.version && !this.cyclicReader) {
              this.log.debug('creating cyclic timer to request data every ' + this.config.pollinterval + ' seconds');
              this.cyclicReader = setInterval(this.request_data.bind(this), this.config.pollinterval * 1000, this.version);
              this.log.debug('timer id ' + this.cyclicReader);
          }
          if(!this.connectedToIDM && this.cyclicReader) {
              this.log.debug('clear cyclic timer');
              clearInterval(this.cyclicReader);
              this.cyclicReader = undefined;
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
            if (this.cyclicReader) {
                clearInterval(this.cyclicReader);
                this.cyclicReader = undefined;
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
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
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