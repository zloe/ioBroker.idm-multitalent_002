const idm = require('./idm-protocol');


describe('test the data definitions', dataDefTest);
describe('test parsing the data definition',dataDefTest2);
describe('test the parsing of data',dataParseTest);

function dataDefTest() {
    console.log('test the data definitions');
    idm.initialize();
    const definition = idm.getDefinition('idm701100', '09');
    console.log(idm.dataDefinitions.toString());
    if (definition) {
        for (let j = 0; j < definition.length; j++) {
            console.log(definition[j].field);
        }
    }
}


function dataDefTest2() {
    console.log('test parsing the data definition');
    const definitions = idm.dataDefinitions.get('idm701100');
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


function dataParseTest() {
    const data03 = '00002D001300010F00000001000A000B27010005001C0200000A00000000';
    const data04 = '0000000400150014000102002D000100140032000100030A0000FA000500012800';
    const data05 = '000000012D000200120010000300000A00640002000500001E000600FA00';
    const data06 = '00000101020039000A000A00ECFFECFF12000002001E0000001200';
    const data07 = '00000000000000000000000000000000000000000B270000000000000000';
    const data08 = '0000B80B';
    const data09 = '00001727130D02E607';
    const data0A = '0000000031001E0019000A001F001A00F0000000190000001E0042010000';
    const data0B = '0000000000000000000000000000';

    const definition03 = idm.getDefinition('idm701100', '03');
    let text = idm.parseProtocol(data03,definition03);
    console.log(text);
    const definition04 = idm.getDefinition('idm701100', '04');
    text = idm.parseProtocol(data04,definition04);
    console.log(text);
    const definition05 = idm.getDefinition('idm701100', '05');
    text = idm.parseProtocol(data05,definition05);
    console.log(text);
    const definition06 = idm.getDefinition('idm701100', '06');
    text = idm.parseProtocol(data06,definition06);
    console.log(text);
    const definition07 = idm.getDefinition('idm701100', '07');
    text = idm.parseProtocol(data07,definition07);
    console.log(text);
    const definition08 = idm.getDefinition('idm701100', '08');
    text = idm.parseProtocol(data08,definition08);
    console.log(text);
    const definition09 = idm.getDefinition('idm701100', '09');
    text = idm.parseProtocol(data09,definition09);
    console.log(text);
    const definition0A = idm.getDefinition('idm701100', '0A');
    text = idm.parseProtocol(data0A,definition0A);
    console.log(text);
    const definition0B = idm.getDefinition('idm701100', '0B');
    text = idm.parseProtocol(data0B,definition0B);
    console.log(text);

    console.log(idm.get_hex_from_byte(9));

}