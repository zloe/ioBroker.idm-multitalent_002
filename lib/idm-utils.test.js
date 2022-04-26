const { assert } = require('console');
const idm_u = require('./idm-utils');

describe('Test number to string with 3 digits', getStringTest);





function getStringTest() {
    for(let i = -5; i < 1002; i++) {
        let text = idm_u.get_string(i);
        const num = parseInt(text);
        assert(text.length == 3, 'wrong length get_string of ' + i + ' text was:' + text);
        assert(num == i, 'wrong conversion get_String of ' + i + ' result was ' + num + ' text was:' + text);
        text = idm_u.get_string3(i);
        const num3 = parseInt(text);
        assert(text.length == 3, 'wrong length get_string3 of ' + i + ' text was:' + text);
        assert(num3 == i, 'wrong conversion get_string3 of ' + i + ' result was ' + num3 + ' text was:' + text);
        assert(num == num3, 'difference get_string and get_string3');
    }

}