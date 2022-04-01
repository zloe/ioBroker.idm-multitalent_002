const idm = require('./idm-protocol');


describe('test the data definitions', dataDefTest);



function dataDefTest() {
    idm.initialize();
    const definition = idm.getDefinition('idm701100', '09');
    console.log(idm.dataDefinitions.toString());
    console.log(JSON.stringify(idm.dataDefinitions));
    if (definition) console.log(definition.toString());
}