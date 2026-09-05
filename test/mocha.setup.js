// Don't silently swallow unhandled rejections
process.on('unhandledRejection', (e) => {
    throw e;
});

// enable the should interface with sinon
// and load chai-as-promised and sinon-chai by default
//
// sinon-chai and chai-as-promised are published as pure ESM packages. When
// required from CommonJS (as here), Node wraps them in a module namespace
// object and the actual plugin function ends up on `.default` instead of
// being the object itself - so unwrap it defensively (this also keeps
// working if a future version goes back to a plain CJS export).
const sinonChaiModule = require('sinon-chai');
const chaiAsPromisedModule = require('chai-as-promised');
const sinonChai = sinonChaiModule.default || sinonChaiModule;
const chaiAsPromised = chaiAsPromisedModule.default || chaiAsPromisedModule;
const { should, use } = require('chai');

should();
use(sinonChai);
use(chaiAsPromised);