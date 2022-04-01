const idm = require('./idm-protocol');


describe('test the data definitions', dataDefTest);
describe('test parsing the data definition',dataDefTest2);


function dataDefTest() {
    console.log('test the data definitions');
    idm.initialize();
    const definition = idm.getDefinition('idm701100', '09');
    console.log(idm.dataDefinitions.toString());
    console.log(JSON.stringify(idm.dataDefinitions));
    if (definition) console.log(definition.toString());
}

function dataDefTest2() {
    console.log('test parsing the data definition');
    const definitions = idm.dataDefinitions.get('idm701100');
    if (definitions) {
        const definition = definitions.data_blocks;
        for (let i = 0; i < definition.length; i++) {
            console.log(definition.stringify());
        }
    }

}