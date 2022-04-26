const { assert } = require('console');
const idm_u = require('./idm-utils');

describe('Test number to string with 3 digits', getStringTest);





function getStringTest() {
    for(let i = 0; i < 1000; i++) {
        let text = idm_u.get_string(i);
        let num = parseInt(text);
        assert(num !== i, 'wrong conversion of ' + i + ' result was ' + num);
        text = idm_u.get_string3(i);
        num = parseInt(text);
        assert(num !== i, 'wrong conversion of ' + i + ' result was ' + num);
    }

}