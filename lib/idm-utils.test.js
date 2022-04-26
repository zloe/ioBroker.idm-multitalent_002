const { assert } = require('console');
const idm_u = require('./idm-utils');

describe('Test number to string with 3 digits', getStringTest);
describe('Test checksum calculation', calcChecksumTest123);
describe('Test checksum calculation', calcChecksumTest456);
describe('Test checksum calculation', calcChecksumTest789);




function getStringTest() {
    for(let i = -5; i < 1002; i++) {
        const text = idm_u.get_string(i);
        const num = parseInt(text);
        assert(text.length == 3, 'wrong length get_string of ' + i + ' text was:' + text);
        assert(num == i, 'wrong conversion get_String of ' + i + ' result was ' + num + ' text was:' + text);
    }
}

function calcChecksumTest123() {
    const ui8a = new Uint8Array([1,2,3]);
    const data = idm_u.get_string_uint8array(ui8a);
    const chkSum = idm_u.calc_checksum(data);
    assert(chkSum == 0, 'Checksum wrong of ' + data + ', should be 0 was ' + chkSum);
}

function calcChecksumTest456() {
    const ui8a = new Uint8Array([4,5,6]);
    const data = idm_u.get_string_uint8array(ui8a);
    const chkSum = idm_u.calc_checksum(data);
    assert(chkSum == 7, 'Checksum wrong of ' + data + ', should be 7 was ' + chkSum);
}

function calcChecksumTest789() {
    const ui8a = new Uint8Array([7,8,9]);
    const data = idm_u.get_string_uint8array(ui8a);
    const chkSum = idm_u.calc_checksum(data);
    assert(chkSum == 6, 'Checksum wrong of ' + data + ', should be 6 was ' + chkSum);
}