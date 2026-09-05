// definition of the protocol with the iDM multitalent.002 control
const idm_datablocks = require('./idm_datablocks');
const idm_utils = require('./idm-utils');
const idm_protocol = {

    dataBlocks: new Map(),
    dataDefinitions: new Map(),
    sensorDataBlocks: new Map(),
    settingsDataBlocks: new Map(),
    speed: new Map(),
    /** @type {string | null} absolute path of the data blocks file actually in use (set by initialize()) */
    dataSource: null,

    // Maps the version identifier reported by the heat pump (used as the Map key
    // throughout this module) to the property prefix used in the data blocks file. These
    // differ in case for EVR752101/evr752101 - this table is the single place that needs
    // to know that, instead of it being repeated (and easy to get wrong, as it previously
    // was for "*_speed") at every lookup.
    versionKeys: [
        ['idm701100', 'idm701100'],
        ['idm712100', 'idm712100'],
        ['idm722100', 'idm722100'],
        ['S_H726100', 'S_H726100'],
        ['idm750100', 'idm750100'],
        ['EVR752101', 'evr752101'],
    ],

    /**
     * Loads the hardware data block definitions (see idm_datablocks.js) and populates the
     * lookup Maps used by the rest of this module.
     * @param {string} [customFile] absolute path to a custom data blocks JSON file, e.g. from
     *   the adapter's "dataBlocksFile" setting - falls back to the bundled defaults if not
     *   given, not readable, or not valid
     * @param {(msg: string) => void} [logWarn] called with a message if the custom file could
     *   not be used
     */
    initialize: function (customFile, logWarn) {
        const { data, source } = idm_datablocks.load(customFile, logWarn);
        idm_protocol.dataSource = source;

        idm_protocol.dataDefinitions.clear();
        idm_protocol.dataBlocks.clear();
        idm_protocol.sensorDataBlocks.clear();
        idm_protocol.settingsDataBlocks.clear();
        idm_protocol.speed.clear();

        for (const [versionKey, dataKey] of idm_protocol.versionKeys) {
            idm_protocol.dataDefinitions.set(versionKey, data[dataKey + '_data']);
            idm_protocol.dataBlocks.set(versionKey, data[dataKey]);
            idm_protocol.sensorDataBlocks.set(versionKey, data[dataKey + '_sensors']);
            idm_protocol.settingsDataBlocks.set(versionKey, data[dataKey + '_settings']);
            idm_protocol.speed.set(versionKey, data[dataKey + '_speed']);
        }
    },

    /**
     * Checks a value about to be written to the heat pump against the min/max limits (if any)
     * carried by its data block definition. This is the enforcement point for the "min"/"max"
     * fields that can be set per-field in the data blocks file/JSON - fields without either
     * are accepted as before (no limit configured/known).
     * @param {any} definition the field's data block definition (or the stateNameMap entry
     *   derived from it) - only its optional "min"/"max" are used here
     * @param {string | number | boolean | null | undefined} value
     * @returns {{ok: boolean, value?: number, reason?: string}}
     */
    checkValueRange: function (definition, value) {
        if (!definition) return { ok: false, reason: 'no data block definition found for this state' };

        const numericValue = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(numericValue)) {
            return { ok: false, reason: `value "${value}" is not a number` };
        }
        if (definition.min !== undefined && definition.min !== null && numericValue < definition.min) {
            return { ok: false, reason: `${numericValue} is below the minimum allowed value ${definition.min}` };
        }
        if (definition.max !== undefined && definition.max !== null && numericValue > definition.max) {
            return { ok: false, reason: `${numericValue} is above the maximum allowed value ${definition.max}` };
        }
        return { ok: true, value: numericValue };
    },


    getDefinition: function( version, block) {
        try {
            const definitions = idm_protocol.dataDefinitions.get(version);
            if (definitions) {
                const dataBlocks = definitions.data_blocks;
                for (let i = 0; i < dataBlocks.length; i++) {
                    if (dataBlocks[i].block_number === block) {
                        return dataBlocks[i].definition;
                    }
                }
            }
            return null;
        }
        catch {
            return null;
        }
    },

    getDataBlocks: function (version) {
        if (idm_protocol.dataBlocks && idm_protocol.dataBlocks.has(version)) {
            return idm_protocol.dataBlocks.get(version);
        }
        return null;
    },

    getSensorDataBlocks: function (version) {
        if (idm_protocol.sensorDataBlocks && idm_protocol.sensorDataBlocks.has(version)) {
            return idm_protocol.sensorDataBlocks.get(version);
        }
        return null;
    },

    getSettingsDataBlocks: function (version) {
        if (idm_protocol.settingsDataBlocks && idm_protocol.settingsDataBlocks.has(version)) {
            return idm_protocol.settingsDataBlocks.get(version);
        }
        return null;
    },

    create_message: function (data) {
        let checksum, i;
        const message = new Uint8Array(data.length + 6);
        message[0] = 1;
        i = 1;
        checksum = 0;

        for (let ch, idx = 0; idx < data.length; idx += 1) {
            ch = data[idx];
            message[i] = idm_utils.ord(ch);
            i = i + 1;
            checksum = checksum ^ idm_utils.ord(ch);
        }

        message[i] = 3;
        const checksumText = idm_utils.get_string(checksum);
        message[i + 1] = idm_utils.ord(checksumText[0]);
        message[i + 2] = idm_utils.ord(checksumText[1]);
        message[i + 3] = idm_utils.ord(checksumText[2]);
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


    create_set_value_message: function (valueId, value, size, factor) {
        if(factor !== 0) {
            value = value / factor;
        }
        return idm_protocol.create_message('0161' + idm_utils.get_hex_from_word(valueId) + '01' + idm_utils.get_value_string(value, size));
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

        received_data = idm_utils.get_string_uint8array(received_data);
        received_data = idm_protocol.remaining_data + received_data;
        idm_protocol.remaining_data = '';

        for (let i = 0; i < received_data.length; i += 1) {
            const ch = received_data[i];

            if (idm_utils.ord(ch) === 1) {
                if (idm_protocol.receive_state !== 0) {
                    return 11 + idm_protocol.receive_state * 100;
                }

                idm_protocol.receive_state = 1;
            } else {
                if (idm_utils.ord(ch) === 3) {
                    if (idm_protocol.receive_state !== 1) {
                        return 13 + idm_protocol.receive_state * 100;
                    }

                    idm_protocol.receive_state = 2;
                } else {
                    if (idm_utils.ord(ch) === 4) {
                        if (idm_protocol.receive_state == 0) { continue; } // ignore end end of text at the start
                        if (idm_protocol.receive_state !== 2) {
                            return 14 + idm_protocol.receive_state * 100;
                        }

                        if (idm_protocol.receive_chksum.length !== 3) {
                            return 15 + idm_protocol.receive_state * 100;
                        }

                        chksum_c = idm_utils.calc_checksum(idm_protocol.received_data_packet);
                        chksum_r = idm_utils.read_val(3, idm_protocol.receive_chksum);

                        if (chksum_c !== chksum_r) {
                            return 16 + idm_protocol.receive_state * 100;
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
                            return 20 + idm_protocol.receive_state * 100;
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

    protocol_state: function (data) {
        if (!data || data.length < 4) return 'E0';
        if (data.slice(0, 4) === '01F2') {
            if (data.length >= 6 && data.slice(0, 6) === '01F201') return 'NR'; // data request not ready!
            if (data.length < 8) return 'E1'; // request data error
            if (data.slice(4, 6) !== '00') return 'E2'; // request data - invalid response
            const block = idm_utils.get_byte(data.slice(6, 8));
            return 'Data_block_' + block.toString();
        }
        if (data.slice(0, 4) === '01E0') return 'I1'; // init ok
        if (data.length >= 6) {
            if (data.slice(0, 6) === '01F100') return 'R1'; // request data ok
            if (data.slice(0, 6) === '01E100') return 'S1'; // set value OK
        }
        return 'U1'; // unknown response
    },

    // Calls stateFunction(...) once per named state and collects its return values so
    // callers can `await` completion (stateFunction is typically async, e.g. it creates an
    // ioBroker object). Returns a Promise that resolves once every call has settled.
    mapStatenames: function(version, stateFunction) {
        const dataBlocks = idm_protocol.getDataBlocks(version);
        const results = [];
        if (dataBlocks) dataBlocks.forEach(block => {
            const definitions = idm_protocol.getDefinition(version,block);
            if (definitions) definitions.forEach(definition => {
                if (definition.statename && definition.statename.length > 0)  {
                    results.push(stateFunction(
                        definition.statename,
                        definition.writable,
                        definition.description,
                        definition.function,
                        definition.length,
                        definition.factor,
                        definition.unit,
                        definition.min,
                        definition.max,
                        block));
                }
            });
        });
        return Promise.all(results);
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

            if (entry.length === 1) valueText = idm_utils.get_byte(data.slice(pos,nextPos)).toString();
            if (entry.length === 2) valueText = idm_utils.get_int(data.slice(pos,nextPos)).toString();
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
        let text;

        if (data.slice(0, 4) === '01E0') {
            // initial response message with version info
            text = 'Version: ' + idm_utils.get_text(data.slice(4));
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
            return 'error in data response: ' + data;
        }


        const block = idm_utils.get_byte(data.slice(6, 8));
        text = 'B:' + block.toString();

        const definition = idm_protocol.getDefinition(version, idm_utils.get_hex_from_byte(block));
        if (definition) {
            text = idm_protocol.parseProtocol(data.slice(8), definition, setStateFunction);
        } else  {
            text = text + ' unknown';
        }
        return text;
    }

};

module.exports = idm_protocol;