const idm_p = require('./idm-protocol');
const idm_u = require('./idm-utils');


describe('test the data definitions', dataDefTest);
describe('test parsing the data definition',dataDefTest2);
describe('test the parsing of data',dataParseTest);
describe('test the set value message creation', dataWriteTest1);
describe('test int to hex and hex to int util functions', getIntTest1);

function dataDefTest() {
    console.log('test the data definitions');
    idm_p.initialize();
    const definition = idm_p.getDefinition('idm701100', '09');
    console.log(idm_p.dataDefinitions.toString());
    if (definition) {
        for (let j = 0; j < definition.length; j++) {
            console.log(definition[j].field);
        }
    }
}


function dataDefTest2() {
    console.log('test parsing the data definition');
    const definitions = idm_p.dataDefinitions.get('idm701100');
    if (definitions) {
        const dataBlocks = definitions.data_blocks;
        for (let i = 0; i < dataBlocks.length; i++) {
            console.log(dataBlocks[i].block_number);
            const definition = dataBlocks[i].definition;
            for (let j = 0; j < definition.length; j++) {
                console.log(definition[j].field);
            }
        }
    }

}

function dataWriteTest1() {
    let text;
    for(let i=0; i<19; i++) {
        text = idm_u.get_hex_from_word(i*17);
        console.log(' ' + i*17 + ' === ' + text);
        text = idm_p.create_set_value_message(i*17, i, 1);
        console.log(idm_p.get_protocol_string(text));
    }

}

function intToHex(value) {
    if (value < 0) value = value + 65536;
    let text = value.toString(16);
    while (text.length < 4) text = '0' + text;
    return text.slice(2,4) + text.slice(0,2);
}

function getIntTest1() {
    console.log('32767 -> ' + intToHex(32767));
    let text = 'EEFF';
    console.log(text + ' -> ' + idm_u.get_int(text));
    text = '00FF';
    console.log(text + ' -> ' + idm_u.get_int(text));
    text = '10FF';
    console.log(text + ' -> ' + idm_u.get_int(text));
    text = 'FF00';
    console.log(text + ' -> ' + idm_u.get_int(text));
    text = '02FF';
    console.log(text + ' -> ' + idm_u.get_int(text));
    text = '00FF';
    console.log(text + ' -> ' + idm_u.get_int(text));
    text = '10EF';
    console.log(text + ' -> ' + idm_u.get_int(text));
    for( let i = 0; i < 20; i++) {
        const v = Math.floor(Math.random() * 65536 - 32768);
        console.log( v.toString() + ' -> ' + v.toString(16) + ' -> ' + intToHex(v) + ' -> ' + idm_u.get_int(intToHex(v)));
    }
}

function dataParseTest() {
    const testData = [
        { block:'03', data: '00002D001300010F00000001000A000B27010005001C0200000A00000000'},
        { block:'04', data: '0000000400150014000102002D00010014002D000100030A0000FA000500012800'},
        { block:'05', data: '000000012D000200120010000300000A00640002000500001E000600FA00'},
        { block:'06', data: '00000101020039000A000A00ECFFECFF12000002001E0000001200'},
        { block:'07', data: '00000000000000000000000000000000000000000B270000000000000000'},
        { block:'08', data: '0000B80B'},
        { block:'09', data: '00002538110204E607'},
        { block:'0A', data: '000004002F00330018000A0022001C00EC000000190000001E007D010000'},
        { block:'0B', data: '0000000000000000000000000000'}
    ];
    const data03 = '00002D001300010F00000001000A000B27010005001C0200000A00000000';
    const data04 = '0000000400150014000102002D000100140032000100030A0000FA000500012800';
    const data05 = '000000012D000200120010000300000A00640002000500001E000600FA00';
    const data06 = '00000101020039000A000A00ECFFECFF12000002001E0000001200';
    const data07 = '00000000000000000000000000000000000000000B270000000000000000';
    const data08 = '0000B80B';
    const data09 = '00001727130D02E607';
    const data0A = '0000000031001E0019000A001F001A00F0000000190000001E0042010000';
    const data0B = '0000000000000000000000000000';

    console.log(idm_u.get_hex_from_byte(10));
    let text = 'empty';
    const definition03 = idm_p.getDefinition('idm701100', idm_u.get_hex_from_byte(idm_u.get_byte('03')));
    if (definition03) {text = idm_p.parseProtocol(data03,definition03);}
    console.log(text);
    const definition04 = idm_p.getDefinition('idm701100', idm_u.get_hex_from_byte(idm_u.get_byte('04')));
    text = idm_p.parseProtocol(data04,definition04);
    console.log(text);
    const definition05 = idm_p.getDefinition('idm701100', idm_u.get_hex_from_byte(idm_u.get_byte('05')));
    text = idm_p.parseProtocol(data05,definition05);
    console.log(text);
    const definition06 = idm_p.getDefinition('idm701100', idm_u.get_hex_from_byte(idm_u.get_byte('06')));
    text = idm_p.parseProtocol(data06,definition06);
    console.log(text);
    const definition07 = idm_p.getDefinition('idm701100', idm_u.get_hex_from_byte(idm_u.get_byte('07')));
    text = idm_p.parseProtocol(data07,definition07);
    console.log(text);
    const definition08 = idm_p.getDefinition('idm701100', idm_u.get_hex_from_byte(idm_u.get_byte('08')));
    text = idm_p.parseProtocol(data08,definition08);
    console.log(text);
    const definition09 = idm_p.getDefinition('idm701100', idm_u.get_hex_from_byte(idm_u.get_byte('09')));
    text = idm_p.parseProtocol(data09,definition09);
    console.log(text);
    const definition0A = idm_p.getDefinition('idm701100', idm_u.get_hex_from_byte(idm_u.get_byte('0A')));
    text = idm_p.parseProtocol(data0A,definition0A);
    console.log(text);
    const definition0B = idm_p.getDefinition('idm701100', idm_u.get_hex_from_byte(idm_u.get_byte('0B')));
    text = idm_p.parseProtocol(data0B,definition0B);
    console.log(text);

    console.log(idm_u.get_hex_from_byte(9));
}