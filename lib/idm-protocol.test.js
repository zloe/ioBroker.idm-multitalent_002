const idm = require('./idm-protocol');


describe('test the data definitions', dataDefTest);



function dataDefTest() {
    const definition = idm.getDefinition('idm701100', '09');
    console.log(idm.dataDefinitions.toString());
    console.log(definition.toString());
}