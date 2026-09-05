const { expect } = require('chai');
const idm_u = require('./idm-utils');

describe('idm-utils', () => {

    describe('get_string', () => {
        // get_string() is only ever used to encode an XOR checksum byte (0..255) into the
        // 3-digit decimal string the protocol expects, so that is the domain we test - not
        // arbitrary integers. (It previously also ran against negative numbers and numbers
        // above 999, which don't occur in real usage and don't round-trip: get_string()
        // clamps negative input to 0 and does not limit the output to 3 digits above 999.)
        it('always returns a 3-digit, zero-padded decimal string for a checksum byte', () => {
            for (let i = 0; i <= 255; i++) {
                const text = idm_u.get_string(i);
                expect(text).to.have.lengthOf(3);
                expect(parseInt(text, 10)).to.equal(i);
            }
        });

        it('clamps negative numbers to 0 instead of producing a negative string', () => {
            expect(idm_u.get_string(-1)).to.equal('000');
            expect(idm_u.get_string(-5)).to.equal('000');
        });
    });

    describe('calc_checksum', () => {
        // calc_checksum XORs the character codes of a string together, byte by byte.
        it('XORs the given bytes together', () => {
            const data123 = idm_u.get_string_uint8array(new Uint8Array([1, 2, 3]));
            expect(idm_u.calc_checksum(data123)).to.equal(1 ^ 2 ^ 3); // 0

            const data456 = idm_u.get_string_uint8array(new Uint8Array([4, 5, 6]));
            expect(idm_u.calc_checksum(data456)).to.equal(4 ^ 5 ^ 6); // 7

            const data789 = idm_u.get_string_uint8array(new Uint8Array([7, 8, 9]));
            expect(idm_u.calc_checksum(data789)).to.equal(7 ^ 8 ^ 9); // 6
        });

        it('returns 0 for an empty input', () => {
            expect(idm_u.calc_checksum('')).to.equal(0);
        });
    });

    describe('get_hex_from_byte / get_byte', () => {
        it('round-trips every byte value through hex and back', () => {
            for (let i = 0; i <= 255; i++) {
                expect(idm_u.get_byte(idm_u.get_hex_from_byte(i))).to.equal(i);
            }
        });

        it('always produces exactly 2 hex digits, upper case', () => {
            expect(idm_u.get_hex_from_byte(0)).to.equal('00');
            expect(idm_u.get_hex_from_byte(10)).to.equal('0A');
            expect(idm_u.get_hex_from_byte(255)).to.equal('FF');
        });
    });

    describe('get_hex_from_word / get_int', () => {
        it('round-trips positive and negative 16-bit values', () => {
            for (const value of [0, 1, -1, 17, -17, 1000, -1000, 32767, -32768]) {
                expect(idm_u.get_int(idm_u.get_hex_from_word(value))).to.equal(value);
            }
        });

        // These pin down the exact little-endian, signed-16-bit decoding get_int performs,
        // using fixed (not random) inputs so the test is deterministic and reproducible.
        it('decodes known raw hex words to the expected signed values', () => {
            expect(idm_u.get_int('EEFF')).to.equal(-18);
            expect(idm_u.get_int('00FF')).to.equal(-256);
            expect(idm_u.get_int('10FF')).to.equal(-240);
            expect(idm_u.get_int('FF00')).to.equal(255);
            expect(idm_u.get_int('02FF')).to.equal(-254);
            expect(idm_u.get_int('10EF')).to.equal(-4336);
        });
    });

    describe('get_value_string', () => {
        it('encodes positive values as little-endian nibble-swapped hex', () => {
            expect(idm_u.get_value_string(10, 2)).to.equal('0A00');
            expect(idm_u.get_value_string(0, 1)).to.equal('00');
        });

        it('wraps negative values into the unsigned range instead of producing invalid hex', () => {
            // Regression test: this used to return garbage like "-1-1-1-1" for negative input.
            expect(idm_u.get_value_string(-1, 2)).to.equal('FFFF');
            expect(idm_u.get_value_string(-1, 1)).to.equal('FF');
        });

        it('rounds away floating point error from dividing by a scaling factor', () => {
            // Regression test: 10.1 / 0.1 === 100.99999999999999 in JS, which used to get
            // truncated down to raw value 100 (=10.0) instead of rounding to 101 (=10.1).
            const raw = 10.1 / 0.1;
            expect(idm_u.get_value_string(raw, 2)).to.equal(idm_u.get_value_string(101, 2));
        });
    });

    describe('read_val', () => {
        it('parses a fixed-length leading decimal number', () => {
            expect(idm_u.read_val(3, '007abc')).to.equal(7);
            expect(idm_u.read_val(0, '007')).to.equal(0);
        });

        it('returns 0 for input shorter than the requested length or non-numeric input', () => {
            expect(idm_u.read_val(5, '12')).to.equal(0);
            expect(idm_u.read_val(3, 'abc')).to.equal(0);
        });
    });

});
