const idm_p = require('./idm-protocol');
const idm_u = require('./idm-utils');


describe('test the data definitions', dataDefTest);
describe('test parsing the data definition',dataDefTest2);
describe('test the parsing of data for version idm701100',dataParseTest_idm701100);
describe('test the parsing of data for version S_H726100',dataParseTest_S_H726100);
describe('test the parsing of data for version idm722100',dataParseTest_idm722100);
describe('test the parsing of data for version EVR752101',dataParseTest_EVR752101);
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
        text = idm_p.create_set_value_message(i*17, i, 1, 1);
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

function dataParseTest_idm701100() {

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
    text = idm_p.parseProtocol(data03,definition03);
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

function dataParseTest_EVR752101() {

    const data03 = '000030000D000114000000010B2701000200080202000000';
    const data04 = '00000104001800140001000030000000190064000203030A0001050000200001010000030003000303000005000500010100001E001E00320032000A000A00100010006400640002020A000A0014001400';
    const data05 = '0000000132000A00140010000300000A00640002010500001E00';
    const data06 = '00000101040039000A000A000002001E000000';
    const data07 = '00000000000000000000000000000000000000000B2700000000010000000000000000';
    const data08 = '0000F00A';
    const data09 = '000023000A0014001E00B400280A65000000';
    const data0A = '000000002D00';
    const data0B = '0000280078002D0000000000620C22025F0800';
    const data0C = '000037280C0105E707';
    const data0D = '00000B003000300019000A002A00260000000000190000002000C401000000000A000A0014001400';
    const data0E = '000000000000000000000000000000';

    console.log(idm_u.get_hex_from_byte(10));
    let text = 'empty';
    const definition03 = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('03')));
    text = idm_p.parseProtocol(data03,definition03);
    console.log(text);
    const definition04 = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('04')));
    text = idm_p.parseProtocol(data04,definition04);
    console.log(text);
    const definition05 = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('05')));
    text = idm_p.parseProtocol(data05,definition05);
    console.log(text);
    const definition06 = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('06')));
    text = idm_p.parseProtocol(data06,definition06);
    console.log(text);
    const definition07 = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('07')));
    text = idm_p.parseProtocol(data07,definition07);
    console.log(text);
    const definition08 = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('08')));
    if (definition08 != null) {
        text = idm_p.parseProtocol(data08,definition08);
        console.log(text);
    }
    const definition09 = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('09')));
    text = idm_p.parseProtocol(data09,definition09);
    console.log(text);
    const definition0A = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('0A')));
    if (definition0A != null) {
        text = idm_p.parseProtocol(data0A,definition0A);
        console.log(text);
    }
    const definition0B = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('0B')));
    text = idm_p.parseProtocol(data0B,definition0B);
    console.log(text);
    const definition0C = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('0C')));
    text = idm_p.parseProtocol(data0C,definition0C);
    console.log(text);
    const definition0D = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('0D')));
    text = idm_p.parseProtocol(data0D,definition0D);
    console.log(text);
    const definition0E = idm_p.getDefinition('EVR752101', idm_u.get_hex_from_byte(idm_u.get_byte('0E')));
    text = idm_p.parseProtocol(data0E,definition0E);
    console.log(text);

    console.log(idm_u.get_hex_from_byte(9));
}

function dataParseTest_S_H726100() {

    const data03 = '00002E001200010F00000001000B2701000100260200000000000000';
    const data04 = '0000010400150013000102002D00010012002D000100030A0001FA0005000014000101000003000300FA00FA000001000005000500010100001E001E00320032000A000A00100010006400640001010A000A0014001400';
    const data05 = '0000000132000A00140010000300000A00640002010500001E000600FA00';
    const data06 = '00000101040039000A000A00F1FFEEFF0002001E000000';
    const data07 = '000000000000000000000000000000000000000000000000000001000000000000000000';
    const data08 = '00000A001200000000001200120012000A000A000A0023000A0014001E00B400C4096400';
    const data09 = '0000D80E';
    const data0A = '000000002D00';
    const data0B = '000001002D270A020BE707';
    const data0C = '00000E003000300015000A001D001C00D30000001C0019001E00D0010000000000000A000A0000000000';
    const data0D = '0000000000000000000000000000';

    console.log('*** TESTING S_H726100 ***\n');
    let text = 'empty';
    const definition03 = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('03')));
    text = idm_p.parseProtocol(data03,definition03);
    console.log('03: ' + text + '\n');
    const definition04 = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('04')));
    text = idm_p.parseProtocol(data04,definition04);
    console.log('04: ' + text + '\n');
    const definition05 = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('05')));
    text = idm_p.parseProtocol(data05,definition05);
    console.log('05: ' + text + '\n');
    const definition06 = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('06')));
    text = idm_p.parseProtocol(data06,definition06);
    console.log('06: ' + text + '\n');
    const definition07 = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('07')));
    text = idm_p.parseProtocol(data07,definition07);
    console.log('07: ' + text + '\n');
    const definition08 = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('08')));
    if (definition08 != null) {
        text = idm_p.parseProtocol(data08,definition08);
        console.log('08: ' + text + '\n');
    }
    const definition09 = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('09')));
    text = idm_p.parseProtocol(data09,definition09);
    console.log('09: ' + text + '\n');
    const definition0A = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('0A')));
    if (definition0A != null) {
        text = idm_p.parseProtocol(data0A,definition0A);
        console.log('0A: ' + text + '\n');
    }
    const definition0B = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('0B')));
    text = idm_p.parseProtocol(data0B,definition0B);
    console.log('0B: ' + text + '\n');
    const definition0C = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('0C')));
    text = idm_p.parseProtocol(data0C,definition0C);
    console.log('0C: ' + text + '\n');
    const definition0D = idm_p.getDefinition('S_H726100', idm_u.get_hex_from_byte(idm_u.get_byte('0D')));
    text = idm_p.parseProtocol(data0D,definition0D);
    console.log('0D: ' + text + '\n');

    console.log(idm_u.get_hex_from_byte(9));
}

function dataParseTest_idm722100() {

    const data03 = '0000300014000105000000010B2701000000';
    const data04 = '0000000700180010000004002D0000001E00640002000A0001050000280000';
    const data05 = '000000011E00050017001000040000170064000201010500001C00';
    const data06 = '000001010400370005000A00F4FFF1FF00060002001E0000000103000000050001001E0028000A0010006400020A001400';
    const data07 = '000000010101000000000000000000000000102710270100000000000000010000000000';
    const data08 = '000001001C0200004B00';
    const data09 = '0000F00A';
    const data0A = '000023000A001E00C4096400';
    const data0B = '00002913081401E807';
    const data0C = '0000FDFF2D00370028001C00270024000000000025001C0028001B02000000000A000000';
    const data0D = '0000000000000000000000000000';
    const data0E = '00009643EF415204CB02';

    console.log('*** TESTING idm722100 ***\n');
    let text = 'empty';
    const definition03 = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('03')));
    text = idm_p.parseProtocol(data03,definition03);
    console.log('03: ' + text + '\n');
    const definition04 = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('04')));
    text = idm_p.parseProtocol(data04,definition04);
    console.log('04: ' + text + '\n');
    const definition05 = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('05')));
    text = idm_p.parseProtocol(data05,definition05);
    console.log('05: ' + text + '\n');
    const definition06 = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('06')));
    text = idm_p.parseProtocol(data06,definition06);
    console.log('06: ' + text + '\n');
    const definition07 = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('07')));
    text = idm_p.parseProtocol(data07,definition07);
    console.log('07: ' + text + '\n');
    const definition08 = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('08')));
    if (definition08 != null) {
        text = idm_p.parseProtocol(data08,definition08);
        console.log('08: ' + text + '\n');
    }
    const definition09 = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('09')));
    text = idm_p.parseProtocol(data09,definition09);
    console.log('09: ' + text + '\n');
    const definition0A = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('0A')));
    if (definition0A != null) {
        text = idm_p.parseProtocol(data0A,definition0A);
        console.log('0A: ' + text + '\n');
    }
    const definition0B = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('0B')));
    text = idm_p.parseProtocol(data0B,definition0B);
    console.log('0B: ' + text + '\n');
    const definition0C = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('0C')));
    text = idm_p.parseProtocol(data0C,definition0C);
    console.log('0C: ' + text + '\n');
    const definition0D = idm_p.getDefinition('idm722100', idm_u.get_hex_from_byte(idm_u.get_byte('0D')));
    text = idm_p.parseProtocol(data0D,definition0D);
    console.log('0D: ' + text + '\n');

    console.log(idm_u.get_hex_from_byte(9));
}