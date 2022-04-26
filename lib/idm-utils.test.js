const { assert } = require('console');
const idm_u = require('./idm-utils');

describe('Test number to string with 3 digits', getStringTest);
describe('Test checksum calculation', calcChecksumTest);




function getStringTest() {
    for(let i = -5; i < 1002; i++) {
        const text = idm_u.get_string(i);
        const num = parseInt(text);
        assert(text.length == 3, 'wrong length get_string of ' + i + ' text was:' + text);
        assert(num == i, 'wrong conversion get_String of ' + i + ' result was ' + num + ' text was:' + text);
    }
}

function calcChecksumTest() {
    const data = new String([1,2,3]);
    const chkSum = idm_u.calc_checksum(data);
    assert(chkSum == 0, 'Checksum wrong of ' + data + ', should be 0 was ' + chkSum);
}