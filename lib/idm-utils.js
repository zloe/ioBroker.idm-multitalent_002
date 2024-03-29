const idm_utils = {

    ord: function (chr) { return chr.charCodeAt(0); },

    calc_checksum: function (data) {
        let checksum = 0;

        for (let idx = 0; idx < data.length; idx += 1) {
            checksum = checksum ^ idm_utils.ord(data[idx]);
        }

        return checksum;
    },

    get_string: function(num) {
        if (num < 0) num = 0;
        let text = num.toString();
        while (text.length < 3) text = '0' + text;
        return text;
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
    },/*
    get_value_string: function (value, size) {
        let text = value.toString(16).toUpperCase();
        text = text.padStart(size * 2, '0');
        return text;
    },*/

    stringToUInt8Array: function(text) {
        if (!text) return [];
        const array = new Uint8Array(text.length);
        for(let i = 0; i < text.length; i++) {
            array[i] = idm_utils.ord(text[i]);
        }
        return array;
    },

    get_hex_from_byte: function (byte) {
        let text = byte.toString(16).toUpperCase();
        while (text.length < 2) text = '0' + text;
        return text;
    },

    get_hex_from_word: function (word) {
        if (word < 0) word = word + 65536; // correct negative numbers
        let text = word.toString(16).toUpperCase();
        while (text.length < 4) text = '0' + text;
        return text.slice(2,4) + text.slice(0,2);
    },

    get_byte: function (data) {
        if (data.length < 2) {
            return -1;
        }
        return parseInt(data.slice(0,2), 16);
    },

    get_int: function (data) {
        if (data.length < 4) {
            return -1;
        }
        let value = idm_utils.get_byte(data) + 256 * idm_utils.get_byte(data.slice(2, 4));
        if (value > 32767) value -=65536;
        return value;
    },

    get_text: function (data) {
        let text = '';
        const length = data.length / 2;

        for (let i = 0; i < length; i += 1) {
            text = text + String.fromCharCode(idm_utils.get_byte(data.slice(2 * i, 2 * i + 2)));
        }

        return text;
    },

    /*read_val: function (length, data) {
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
    },*/

    read_val: function (length, data) {
        if (length === 0) {
            return 0;
        }

        if (data.length < length) {
            return 0;
        }
        const value = parseInt(data.slice(0, length), 10);
        return isNaN(value) ? 0 : value;
    }


};

module.exports = idm_utils;