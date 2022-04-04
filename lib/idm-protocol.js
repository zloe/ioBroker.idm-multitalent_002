// definition of the protocol with the iDM multitalent.002 control
const idm_datablocks = require('./idm_datablocks');
const idm_protocol = {

    dataBlocks: new Map(),
    dataDefinitions: new Map(),

    initialize: function () {
        idm_protocol.dataDefinitions.set('idm701100', idm_datablocks.idm701100_data);
        idm_protocol.dataBlocks.set('idm701100', idm_datablocks.idm701100);

        idm_protocol.dataDefinitions.set('idm712100', idm_datablocks.idm712100_data);
        idm_protocol.dataBlocks.set('idm712100', idm_datablocks.idm712100);

    },

    getDefinition: function( version, block) {
        try {
            const definitions = idm_protocol.dataDefinitions.get(version);
            if (definitions) {
                const dataBlocks = definitions.data_blocks;
                for (let i = 0; i < dataBlocks.length; i++) {
                    //console.log('is ' + dataBlocks[i].block_number + ' === ' + block );
                    if (dataBlocks[i].block_number === block) {
                        return dataBlocks[i].definition;
                    }
                }
            }
            return null;
        }
        catch(err) {
            return null;
        }
    },

    getDataBlocks: function (version) {
        if (idm_protocol.dataBlocks && idm_protocol.dataBlocks.has(version)) {
            return idm_protocol.dataBlocks.get(version);
        }
        return null;
    },

    ord: function (chr) { return chr.charCodeAt(0); },

    get_string: function (num) {
        const h = Math.floor(num / 100);
        const z = Math.floor((num - h * 100) / 10);
        const e = num % 10;
        return h.toString() + z.toString() + e.toString();
    },

    get_string_uint8array: function (data) {
        let text = '';
        for (let i = 0; i < data.byteLength; i++) {
            text = text + String.fromCharCode(data[i]);
        }
        return text;
    },

    get_value_string: function (value, size) {
        const digits = new Int8Array(size * 2);
        for (let i = 0; i < size * 2; i += 1) {
            digits[i] = value % 16;
            value = Math.floor(value / 16);
        }
        let text = '';
        for (let i = 0; i < size * 2; i += 2) {
            text = text + digits[i + 1].toString(16).toUpperCase() + digits[i].toString(16).toUpperCase();
        }
        return text;
    },

    calc_checksum: function (data) {
        let checksum = 0;


        for (let idx = 0; idx < data.length; idx += 1) {
            checksum = checksum ^ idm_protocol.ord(data[idx]);
        }

        return checksum;
    },

    read_val: function (length, data) {
        let factor, value;

        if (length === 0) {
            return 0;
        }

        if (data.length < length) {
            return 0;
        }

        factor = Math.pow(10, length - 1);
        value = 0;

        for (let i = 0; i < length; i += 1) {
            value = value + factor * Number.parseInt(data[i]);
            factor = factor / 10;
        }

        return value;
    },

    stringToUInt8Array: function(text) {
        if (!text) return [];
        const array = new Uint8Array(text.length);
        for(let i = 0; i < text.length; i++) {
            array[i] = idm_protocol.ord(text[i]);
        }
        return array;
    },

    create_message: function (data) {
        let checksum, i;
        const message = new Uint8Array(data.length + 6);
        message[0] = 1;
        i = 1;
        checksum = 0;

        for (let ch, idx = 0; idx < data.length; idx += 1) {
            ch = data[idx];
            message[i] = idm_protocol.ord(ch);
            i = i + 1;
            checksum = checksum ^ idm_protocol.ord(ch);
        }

        message[i] = 3;
        const checksumText = idm_protocol.get_string(checksum);
        message[i + 1] = idm_protocol.ord(checksumText[0]);
        message[i + 2] = idm_protocol.ord(checksumText[1]);
        message[i + 3] = idm_protocol.ord(checksumText[2]);
        message[i + 4] = 4;
        return message;
    },

    create_init_message: function () {
        return idm_protocol.create_message('0160');
    },

    create_request_data_block_message: function (dataBlock) {
        return idm_protocol.create_message('0171' + dataBlock + '00');
    },

    create_request_data_content_message: function () {
        return idm_protocol.create_message('0172');
    },


    create_set_value_message: function (valueId, value, size) {
        return idm_protocol.create_message('0161' + idm_protocol.get_hex_from_byte(valueId) + '00' + '01' + idm_protocol.get_value_string(value, size));
    },

    received_data_packet: '',
    receive_state: 0,
    receive_chksum: '',
    remaining_data: String(''),

    reset: function () {
        idm_protocol.received_data_packet = '';
        idm_protocol.receive_state = 0;
        idm_protocol.receive_chksum = '';
    },

    add_to_packet: function (received_data) {
        let chksum_c, chksum_r;

        received_data = idm_protocol.get_string_uint8array(received_data);
        received_data = idm_protocol.remaining_data + received_data;
        idm_protocol.remaining_data = '';

        for (let i = 0; i < received_data.length; i += 1) {
            const ch = received_data[i];

            if (idm_protocol.ord(ch) === 1) {
                if (idm_protocol.receive_state !== 0) {
                    return 11;
                }

                idm_protocol.receive_state = 1;
            } else {
                if (idm_protocol.ord(ch) === 3) {
                    if (idm_protocol.receive_state !== 1) {
                        return 13;
                    }

                    idm_protocol.receive_state = 2;
                } else {
                    if (idm_protocol.ord(ch) === 4) {
                        if (idm_protocol.receive_state !== 2) {
                            return 14;
                        }

                        if (idm_protocol.receive_chksum.length !== 3) {
                            return 15;
                        }

                        chksum_c = idm_protocol.calc_checksum(idm_protocol.received_data_packet);
                        chksum_r = idm_protocol.read_val(3, idm_protocol.receive_chksum);

                        if (chksum_c !== chksum_r) {
                            return 16;
                        }

                        idm_protocol.receive_state = 3;
                        if (i < (received_data.length - 1)) idm_protocol.remaining_data = received_data.slice(i + 1);
                        return idm_protocol.receive_state;
                    } else {
                        if (idm_protocol.receive_state === 1) {
                            idm_protocol.received_data_packet = idm_protocol.received_data_packet + ch;
                        }

                        if (idm_protocol.receive_state === 2) {
                            idm_protocol.receive_chksum = idm_protocol.receive_chksum + ch;
                        }

                        if (idm_protocol.receive_state === 3) {
                            return 20;
                        }
                    }
                }
            }
        }

        return idm_protocol.receive_state;
    },

    get_protocol_string: function (data) {
        let text = '';
        for (let i = 0; i < data.length; i += 1)
            switch (data[i]) {
                case 1: text = text + '-SOH-'; break;
                case 3: text = text + '-ETX-'; break;
                case 4: text = text + '-EOT-'; break;
                default: text = text + String.fromCharCode(data[i]);
            }
        return text;
    },

    get_data_packet: function () {
        if (idm_protocol.receive_state == 3) {
            return idm_protocol.received_data_packet;
        } else {
            return '';
        }
    },

    get_dec_from_hex: function (ch) {
        if (ch >= '0' && ch <= '9') {
            return idm_protocol.ord(ch) - idm_protocol.ord('0');
        }

        if (ch >= 'A' && ch <= 'F') {
            return idm_protocol.ord(ch) - idm_protocol.ord('A') + 10;
        }

        return -1;
    },

    get_hex_from_byte: function (byte) {
        let text = byte.toString(16).toUpperCase();
        while (text.length < 2) text = '0' + text;
        return text;
    },

    get_byte: function (data) {
        if (data.length < 2) {
            return -1;
        }

        return 16 * idm_protocol.get_dec_from_hex(data[0]) + idm_protocol.get_dec_from_hex(data[1]);
    },

    get_byte_string: function (data, length) {
        const num = idm_protocol.get_byte(data);
        let text = num.toString();
        while (text.length < length) text = '0' + text;
        return text;
    },

    get_int: function (data) {
        if (data.length < 4) {
            return -1;
        }

        return idm_protocol.get_byte(data) + 256 * idm_protocol.get_byte(data.slice(2, 4));
    },

    get_int_string: function (data, length) {
        const num = idm_protocol.get_int(data);
        let text = num.toString();
        while (text.length < length) text = '0' + text;
        return text;
    },

    get_text: function (data) {
        let text = '';
        const length = data.length / 2;

        for (let i = 0; i < length; i += 1) {
            text = text + String.fromCharCode(idm_protocol.get_byte(data.slice(2 * i, 2 * i + 2)));
        }

        return text;
    },

    protocol_state: function (data) {
        if (!data || data.length < 4) return 'E0';
        if (data.slice(0, 4) === '01F2') {
            if (data.length < 8) return 'E1'; // request data error
            if (data.slice(4, 6) !== '00') return 'E2'; // request data - invalid response
            const block = idm_protocol.get_byte(data.slice(6, 8));
            return 'Data_block_' + block.toString();
        }
        if (data.slice(0, 4) === '01E0') return 'I1'; // init ok
        if (data.length >= 6) {
            if (data.slice(0, 6) === '01F100') return 'R1'; // request data ok
            if (data.slice(0, 6) === '01E100') return 'S1'; // set value OK
        }
        return 'U1'; // unknown response
    },

    mapStatenames: function(version, stateFunction) {
        const dataBlocks = idm_protocol.getDataBlocks(version);
        if (dataBlocks) dataBlocks.forEach(block => {
            const definitions = idm_protocol.getDefinition(version,block);
            if (definitions) definitions.forEach(definition => {
                if (definition.statename && definition.statename.length > 0) stateFunction(definition.statename);
            });
        });

    },

    parseProtocol: function (data, definition, setStateFunction) {
        let text = '';
        let pos = 0;
        let nextPos = 0;
        //console.log('num entries: ' + definition.length);
        for (let i = 0; i < definition.length; i++) {
            const entry = definition[i];
            nextPos = pos + entry.length * 2;
            //console.log('field: ' + entry.field + ' from pos: ' + pos + ' to pos: ' + nextPos + ' data: ' + data.slice(pos, nextPos));
            if (data.length < nextPos) return text + ' * miss data';
            let valueText = 'ERROR';

            if (entry.length === 1) valueText = idm_protocol.get_byte_string(data.slice(pos,nextPos),2);
            if (entry.length === 2) valueText = idm_protocol.get_int_string(data.slice(pos,nextPos), 4);
            text = text + entry.description + ':' + Number.parseFloat(valueText) * entry.factor + '; ';
            if (setStateFunction && entry.statename && entry.statename.length > 0) {
                setStateFunction(entry.statename, Number.parseFloat(valueText) * entry.factor);
            }
            pos = nextPos;
        }
        if (data.length > nextPos) text = text + ' * add data: ' + data.slice(nextPos);
        return text;

    },

    interpret_data: function (version, data, setStateFunction) {
        let text = '';

        if (data.slice(0, 4) === '01E0') {
            // initial response message with version info
            text = 'Version: ' + idm_protocol.get_text(data.slice(4));
            return text;
        }

        if (data.slice(0, 6) === '01F100') { // data request response
            return 'dataRequestOk';
        }

        if (data.slice(0, 4) === '01E1') { // data set response
            if (data.slice(4,6) ==='00') {
                return 'setDataOk';
            } else {
                return 'error set data: ' + data.slice(4);
            }
        }

        if (data.slice(0, 4) !== '01F2') { // data block header
            return 'invalid response: ' + data;
        }

        if (data.slice(4, 6) !== '00') {
            return 'error: ' + data.slice(4);
        }


        const block = idm_protocol.get_byte(data.slice(6, 8));
        text = 'B:' + block.toString();

        if(block !== 2) {
            const definition = idm_protocol.getDefinition(version, idm_protocol.get_hex_from_byte(block));
            if (definition) {
                text = idm_protocol.parseProtocol(data.slice(8), definition, setStateFunction);
            } else  {
                text = text + ' ' + idm_protocol.get_byte_string(data.slice(16, 18), 2) + ':' + idm_protocol.get_byte_string(data.slice(14, 16), 2) + ':' + idm_protocol.get_byte_string(data.slice(12, 14), 2);
                text = text + ' ' + idm_protocol.get_byte_string(data.slice(18, 20), 2) + '.' + idm_protocol.get_byte_string(data.slice(20, 22), 2) + '.' + idm_protocol.get_int_string(data.slice(22, 26), 4);
                text = text + ' min.Drehzahl Ladepumpe: ' + idm_protocol.get_int(data.slice(8, 12)).toString();
            }
        } else {
            text = text + ' ' + data.slice(8);
        }

        return text;
    }

};

module.exports = idm_protocol;