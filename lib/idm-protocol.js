// definition of the protocol with the iDM multitalent.002 control
'use strict';

const idm_datablocks = require('./idm_datablocks');
const idm_utils = require('./idm-utils');

// Generous upper bound on how many characters add_to_packet() will accumulate between a SOH
// and the next ETX/EOT before giving up on the frame. The largest real data block payload is a
// few hundred hex characters, so this is purely defensive: without it, a stream that never
// sends a terminating ETX (line noise on the RS422/TCP path, a misbehaving serial-to-TCP
// converter, ...) would grow received_data_packet/receive_chksum forever, since only a
// genuine SOH/ETX/EOT byte - never plain length - used to trigger a state change or error.
const MAX_FRAME_LENGTH = 2048;

/**
 * Protocol/data-block state for ONE heat pump connection.
 *
 * This used to be a single module-level object (i.e. a process-wide singleton). That was
 * merely awkward for tests (which had to call reset()+initialize() between cases to avoid
 * bleeding state into each other - see idm_protocol.reset()) as long as the data block
 * definitions were fixed at require-time. It became an actual correctness risk once
 * definitions became loadable per adapter instance (see idm_datablocks.js's "Custom data
 * blocks directory" support) and, more importantly, because of received_data_packet/
 * receive_state/receive_chksum/remaining_data: these track the byte-by-byte parse of ONE
 * incoming TCP stream. Two adapter instances talking to two different heat pumps in the same
 * process (e.g. ioBroker "compact mode") would otherwise interleave and corrupt each other's
 * parser state and data block definitions. Each adapter instance must therefore create its own
 * `new IdmProtocol()`.
 */
class IdmProtocol {
    constructor() {
        this.dataBlocks = new Map();
        this.dataDefinitions = new Map();
        this.sensorDataBlocks = new Map();
        this.settingsDataBlocks = new Map();
        this.speed = new Map();
        /** @type {Map<string, string>} version -> absolute path of the file it was actually loaded from (set by initialize()) */
        this.dataSources = new Map();

        this.received_data_packet = '';
        this.receive_state = 0;
        this.receive_chksum = '';
        this.remaining_data = '';
    }

    /**
     * Loads the hardware data block definitions (see idm_datablocks.js) and populates the
     * lookup Maps used by the rest of this class, one entry per firmware version.
     * @param {string} [customDir] absolute path to a directory of custom per-version data
     *   blocks files, e.g. from the adapter's "dataBlocksDir" setting - a version with no
     *   matching (and valid) file there keeps using its bundled definition
     * @param {(msg: string) => void} [logWarn] called with a message for anything in customDir
     *   that could not be used
     */
    initialize(customDir, logWarn) {
        const { byVersion, sources } = idm_datablocks.resolve(customDir, logWarn);
        this.dataSources = sources;

        this.dataDefinitions.clear();
        this.dataBlocks.clear();
        this.sensorDataBlocks.clear();
        this.settingsDataBlocks.clear();
        this.speed.clear();

        for (const [version, data] of byVersion) {
            this.dataDefinitions.set(version, data);
            this.dataBlocks.set(version, data.data_blocks.map(block => block.block_number));
            this.sensorDataBlocks.set(version, data.sensorBlocks);
            this.settingsDataBlocks.set(version, data.settingsBlocks);
            this.speed.set(version, data.speed);
        }
    }

    /**
     * Whether the definition currently loaded for `version` (see initialize()) came from a
     * custom data blocks directory rather than the ones bundled with the adapter - so callers
     * (e.g. the "which definition was actually used" log line) can say so explicitly instead of
     * just printing a file path.
     * @param {string} version
     * @returns {boolean}
     */
    isCustomDefinition(version) {
        const file = this.dataSources.get(version);
        if (!file) return false;
        return !file.startsWith(idm_datablocks.BUNDLED_DIR);
    }

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
    checkValueRange(definition, value) {
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
    }

    getDefinition(version, block) {
        try {
            const definitions = this.dataDefinitions.get(version);
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
    }

    getDataBlocks(version) {
        if (this.dataBlocks && this.dataBlocks.has(version)) {
            return this.dataBlocks.get(version);
        }
        return null;
    }

    getSensorDataBlocks(version) {
        if (this.sensorDataBlocks && this.sensorDataBlocks.has(version)) {
            return this.sensorDataBlocks.get(version);
        }
        return null;
    }

    getSettingsDataBlocks(version) {
        if (this.settingsDataBlocks && this.settingsDataBlocks.has(version)) {
            return this.settingsDataBlocks.get(version);
        }
        return null;
    }

    create_message(data) {
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
    }

    create_init_message() {
        return this.create_message('0160');
    }

    create_request_data_block_message(dataBlock) {
        return this.create_message('0171' + dataBlock + '00');
    }

    create_request_data_content_message() {
        return this.create_message('0172');
    }

    create_set_value_message(valueId, value, size, factor) {
        if(factor !== 0) {
            value = value / factor;
        }
        return this.create_message('0161' + idm_utils.get_hex_from_word(valueId) + '01' + idm_utils.get_value_string(value, size));
    }

    reset() {
        this.received_data_packet = '';
        this.receive_state = 0;
        this.receive_chksum = '';
    }

    add_to_packet(received_data) {
        let chksum_c, chksum_r;

        received_data = idm_utils.get_string_uint8array(received_data);
        received_data = this.remaining_data + received_data;
        this.remaining_data = '';

        for (let i = 0; i < received_data.length; i += 1) {
            const ch = received_data[i];

            if (idm_utils.ord(ch) === 1) {
                if (this.receive_state !== 0) {
                    return 11 + this.receive_state * 100;
                }

                this.receive_state = 1;
            } else {
                if (idm_utils.ord(ch) === 3) {
                    if (this.receive_state !== 1) {
                        return 13 + this.receive_state * 100;
                    }

                    this.receive_state = 2;
                } else {
                    if (idm_utils.ord(ch) === 4) {
                        if (this.receive_state == 0) { continue; } // ignore end end of text at the start
                        if (this.receive_state !== 2) {
                            return 14 + this.receive_state * 100;
                        }

                        if (this.receive_chksum.length !== 3) {
                            return 15 + this.receive_state * 100;
                        }

                        chksum_c = idm_utils.calc_checksum(this.received_data_packet);
                        chksum_r = idm_utils.read_val(3, this.receive_chksum);

                        if (chksum_c !== chksum_r) {
                            return 16 + this.receive_state * 100;
                        }

                        this.receive_state = 3;
                        if (i < (received_data.length - 1)) this.remaining_data = received_data.slice(i + 1);
                        return this.receive_state;
                    } else {
                        if (this.receive_state === 1) {
                            this.received_data_packet = this.received_data_packet + ch;
                            if (this.received_data_packet.length > MAX_FRAME_LENGTH) {
                                this.reset();
                                return 500; // frame too long without a terminating ETX - likely line noise
                            }
                        }

                        if (this.receive_state === 2) {
                            this.receive_chksum = this.receive_chksum + ch;
                            if (this.receive_chksum.length > MAX_FRAME_LENGTH) {
                                this.reset();
                                return 501; // checksum too long without a terminating EOT - likely line noise
                            }
                        }

                        if (this.receive_state === 3) {
                            return 20 + this.receive_state * 100;
                        }
                    }
                }
            }
        }

        return this.receive_state;
    }

    get_protocol_string(data) {
        let text = '';
        for (let i = 0; i < data.length; i += 1)
            switch (data[i]) {
                case 1: text = text + '-SOH-'; break;
                case 3: text = text + '-ETX-'; break;
                case 4: text = text + '-EOT-'; break;
                default: text = text + String.fromCharCode(data[i]);
            }
        return text;
    }

    get_data_packet() {
        if (this.receive_state == 3) {
            return this.received_data_packet;
        } else {
            return '';
        }
    }

    protocol_state(data) {
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
    }

    // Calls stateFunction(...) once per named state and collects its return values so
    // callers can `await` completion (stateFunction is typically async, e.g. it creates an
    // ioBroker object). Returns a Promise that resolves once every call has settled.
    mapStatenames(version, stateFunction) {
        const dataBlocks = this.getDataBlocks(version);
        const results = [];
        if (dataBlocks) dataBlocks.forEach(block => {
            const definitions = this.getDefinition(version, block);
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
    }

    parseProtocol(data, definition, setStateFunction) {
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

    }

    interpret_data(version, data, setStateFunction) {
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

        const definition = this.getDefinition(version, idm_utils.get_hex_from_byte(block));
        if (definition) {
            text = this.parseProtocol(data.slice(8), definition, setStateFunction);
        } else  {
            text = text + ' unknown';
        }
        return text;
    }
}

module.exports = IdmProtocol;
