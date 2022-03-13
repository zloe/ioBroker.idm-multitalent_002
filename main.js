'use strict';

/*
 * Created with @iobroker/create-adapter v2.0.2
 */

function ord(chr) { return chr.charCodeAt(0);}

function get_string(num) {
  var e, h, z;
  h = Math.round(num / 100);
  z = Math.round((num - h * 100) / 10);
  e = num % 10;
  return h.toString() + z.toString() + e.toString();
}

function get_string_uint8array(data) {
    var text = "";
    for(var i = 0; i < data.byteLength; i++) {
        switch(data[i]) {
          case 1: 
            text.concat("-START-");
            break;
          case 3:
            text.concat("-CHKSUM-");
            break;
          case 4:
            text.concat("-END-");
            break;      
          default:
            text.concat(data[i].toString());
        }
    }
    return text;
}

function calc_checksum(data) {
  var checksum;
  checksum = 0;

  for (var ch, idx = 0, len = data.length; idx < len; idx += 1) {
    ch = data[idx];
    checksum = checksum ^ ord(ch);
  }

  return checksum;
}

function read_val(length, data) {
  var factor, value;

  if (length === 0) {
    return 0;
  }

  if (data.length < length) {
    return 0;
  }

  factor = Math.pow(10, length - 1);
  value = 0;

  for (var i = 0; i < length; i += 1) {
    value = value + factor * Number.parseInt(data[i]);
    factor = factor / 10;
  }

  return value;
}

function create_message(data) {
  var checksum, checksumText, i, message;
  message = new Uint8Array(data.length + 6);
  message[0] = 1;
  i = 1;
  checksum = 0;

  for (var ch, idx = 0, data, len = data.length; idx < len; idx += 1) {
    ch = data[idx];
    message[i] = ord(ch);
    i = i + 1;
    checksum = checksum ^ ord(ch);
  }

  message[i] = 3;
  checksumText = get_string(checksum);
  message[i + 1] = ord(checksumText[0]);
  message[i + 2] = ord(checksumText[1]);
  message[i + 3] = ord(checksumText[2]);
  message[i + 4] = 4;
  return message;
}

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const net = require('net');

// Load your modules here, e.g.:
// const fs = require("fs");

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

    

    write_init() {
        var init_message = create_message('0160');
        this.log.debug("init message: " + get_string_uint8array(init_message));
        if(this.client) this.client.write(init_message);
    }

    receive_hello(data) {
        this.setStateAsync('received_message', get_string_uint8array(data));
        if (this.client) this.client.destroy();
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
        this.subscribeStates('received_message');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');

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

        this.client = new net.Socket();

        //this.write_init_callback = this.write_init(this);
        //this.receive_hello_callback = this.receive_hello(this);

        this.client.connect(this.config.tcpserverport, this.config.tcpserverip, this.write_init.bind(this));
        this.client.on('data', this.receive_hello.bind(this));

        
    
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