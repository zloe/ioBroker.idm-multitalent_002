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
    const data09 = idm.stringToUInt8Array('00001727130D02E607');
    const definition09 = idm.getDefinition('idm701100', '09');
    const text = idm.parseProtocol(data09,definition09);
    console.log(text);

}