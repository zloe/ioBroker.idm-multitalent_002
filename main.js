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
idm.initialize();

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
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

  
    request_block(block) {
      var message = idm.create_message('0160');
      if (this.client) {
        this.client.write(message);
        message = idm.create_message('0171' + block + '00');

        message = idm.create_message('0172');
      }
    }

    write_init() {
        var init_message = idm.create_message('0160');
        var chksum = idm.calc_checksum('0160');
        this.log.debug('init message: ' + init_message.byteLength + ' - ' + idm.get_string_uint8array(init_message) + ' chksum:' + chksum + ' chrsumstr:' + idm.get_string(chksum));
        if(this.client) this.client.write(init_message);
    }

    async request_data(version) {
      this.log.debug('requesting data for ' + version);
      this.haveData = true;
      var dataBlocks = idm.getDataBlocks(version);
      
      if (!dataBlocks) return;
      var init_message = idm.create_message('0160');
      for (var i = 0; i < dataBlocks.length; i +=1 ) {
        this.log.debug('requesting data block ' + dataBlocks[i]);
        await this.sleep(1000);
        if (this.client) this.client.write(init_message);
        await this.sleep(1000);
        var requestMessage = idm.create_message(dataBlocks[i]);
        if(this.client) this.client.write(requestMessage);
        await this.sleep(1200);
      }
    }



    sleep(ms) {
        return new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
      }

    async receive_data(data) {
      var state = idm.add_to_packet(data);
      if (state == 3) {
        var received_data = idm.get_data_packet();
        var protocolState = idm.protocol_state(received_data);
        this.log.debug('protocol state ' + protocolState);
        if (protocolState === "R1") {// successful data request, we can request the real data now
          idm.reset();  
          await this.sleep(1000);
          var message = idm.create_message("0172");
          if (this.client) this.client.write(message);
          return;
        }
        var text = idm.interpret_data(received_data);
        if (protocolState.slice(0,4) == 'Data') {
            this.setStateAsync(protocolState, text, true);
            idm.reset();
            return;
        }
        this.log.debug('received data: ' + data.byteLength + ' - ' + text);
        if (text.slice(0,1) ==="V") {
          this.setConnected(true);
          this.setStateAsync('idm_control_version', text.slice(9), true);
          if (!this.haveData) {
              idm.reset();
              this.request_data(text.slice(9));
          }
        } else {
          this.setStateAsync('received_message', text);
        }
        idm.reset();
      } else if (state > 3) {
        idm.reset();
      }

    }

    connected = false;
    haveData = false;

    setConnected(isConnected) {
     // if (this.connected !== isConnected) {
          this.connected = isConnected;
          this.log.debug('setting connected state to: ' + this.connected);
          this.setState('info.connection', this.connected, true, (err) => {
              // analyse if the state could be set (because of permissions)
              if (err && this.log) this.log.error('Can not update connected state: ' + err);
              else if (this.log) this.log.debug('connected set to ' + this.connected);
          });
     // }
  }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        //this.log.info('config serialport: ' + this.config.serialport);
        //this.log.info('config tcpserverip: ' + this.config.tcpserverip);
        //this.log.info('config tcpserverport: ' + this.config.tcpserverport);
        //this.log.info('config pollinterval: ' + this.config.pollinterval);
        
        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "config"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        await this.setObjectNotExistsAsync('received_message', {
            type: 'state',
            common: {
                name: 'received_message',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates('idm_control_version');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "config"
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

      // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
      this.subscribeStates('received_message');


        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "config"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        await this.setObjectNotExistsAsync('configuration_text', {
            type: 'state',
            common: {
                name: 'configuration_text',
                type: 'string',
                role: 'value',
                read: true,
                write: true,
            },
            native: {},
        });

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates('configuration_text');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable config is set to true as command (ack=false)
        await this.setStateAsync('configuration_text', this.config.tcpserverip);

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

        await this.setObjectNotExistsAsync('Data_block_3', {
            type: 'state',
            common: {
                name: 'Data_block_3',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync('Data_block_4', {
            type: 'state',
            common: {
                name: 'Data_block_4',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync('Data_block_5', {
            type: 'state',
            common: {
                name: 'Data_block_5',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync('Data_block_6', {
            type: 'state',
            common: {
                name: 'Data_block_6',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync('Data_block_7', {
            type: 'state',
            common: {
                name: 'Data_block_7',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync('Data_block_8', {
            type: 'state',
            common: {
                name: 'Data_block_8',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync('Data_block_9', {
            type: 'state',
            common: {
                name: 'Data_block_9',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync('Data_block_10', {
            type: 'state',
            common: {
                name: 'Data_block_10',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync('Data_block_11', {
            type: 'state',
            common: {
                name: 'Data_block_11',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });



        this.client = new net.Socket();

        //this.write_init_callback = this.write_init(this);
        //this.receive_hello_callback = this.receive_hello(this);

        this.client.connect(this.config.tcpserverport, this.config.tcpserverip, this.write_init.bind(this));
        this.client.on('data', this.receive_data.bind(this));

        
    
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
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