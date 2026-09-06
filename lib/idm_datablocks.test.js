const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const idm_datablocks = require('./idm_datablocks');

/** Writes `data` as JSON to `dir/name` and returns the full path. */
function writeVersionFile(dir, name, data) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify(data));
    return file;
}

/** A minimal, valid version file for the given version string. */
function minimalVersionFile(version, overrides = {}) {
    return Object.assign({
        version,
        sensorBlocks: [],
        settingsBlocks: ['03'],
        speed: 100,
        data_blocks: [{ block_number: '03', definition: [
            { field: 'x', description: 'x', length: 1, factor: 1, writable: true, function: 1, min: 0, max: 10 },
        ] }],
    }, overrides);
}

describe('idm_datablocks (data blocks loader)', () => {

    describe('bundled defaults', () => {
        it('resolves and validates without a custom directory', () => {
            const { byVersion, sources } = idm_datablocks.resolve();
            expect(byVersion.size).to.be.greaterThan(0);
            expect(sources.size).to.equal(byVersion.size);
        });

        it('defines data for every control version referenced elsewhere in the adapter', () => {
            const { byVersion } = idm_datablocks.resolve();
            for (const version of ['idm701100', 'idm712100', 'idm722100', 'S_H726100', 'idm750100', 'EVR752101']) {
                const data = byVersion.get(version);
                expect(data, version).to.be.an('object');
                expect(data.data_blocks, version).to.be.an('array').that.is.not.empty;
                expect(data.speed, version).to.be.a('number');
                expect(idm_datablocks.validateVersionFile(data), version).to.deep.equal([]);
            }
        });

        it('every bundled file is self-consistent: its own "version" field matches its lookup key', () => {
            for (const { version, file, data, errors } of idm_datablocks.readVersionFilesFrom(idm_datablocks.BUNDLED_DIR)) {
                expect(errors, file).to.deep.equal([]);
                expect(data.version).to.equal(version);
            }
        });
    });

    describe('validateVersionFile', () => {
        it('rejects a non-object root', () => {
            expect(idm_datablocks.validateVersionFile(null)).to.not.be.empty;
            expect(idm_datablocks.validateVersionFile('nope')).to.not.be.empty;
            expect(idm_datablocks.validateVersionFile([])).to.not.be.empty;
        });

        it('requires a non-empty "version" string', () => {
            expect(idm_datablocks.validateVersionFile(minimalVersionFile(''))).to.not.be.empty;
            expect(idm_datablocks.validateVersionFile(minimalVersionFile(undefined))).to.not.be.empty;
        });

        it('accepts a minimal well-formed version file', () => {
            expect(idm_datablocks.validateVersionFile(minimalVersionFile('foo'))).to.deep.equal([]);
        });

        it('requires sensorBlocks/settingsBlocks arrays and a numeric speed', () => {
            const bad = minimalVersionFile('foo', { sensorBlocks: 'nope', settingsBlocks: undefined, speed: '100' });
            const errors = idm_datablocks.validateVersionFile(bad);
            expect(errors.join(' ')).to.match(/sensorBlocks/);
            expect(errors.join(' ')).to.match(/settingsBlocks/);
            expect(errors.join(' ')).to.match(/speed/);
        });

        it('flags a field with min greater than max', () => {
            const bad = minimalVersionFile('foo', { data_blocks: [{ block_number: '03', definition: [
                { field: 'x', description: 'x', length: 1, factor: 1, writable: true, function: 1, min: 10, max: 0 },
            ] }] });
            const errors = idm_datablocks.validateVersionFile(bad);
            expect(errors.join(' ')).to.match(/min.*greater than.*max/);
        });

        it('flags two fields in the same block claiming the same "function" (register) id', () => {
            const bad = minimalVersionFile('foo', { data_blocks: [{ block_number: '03', definition: [
                { field: 'a', description: 'a', length: 1, factor: 1, writable: false, function: 5 },
                { field: 'b', description: 'b', length: 1, factor: 1, writable: true, function: 5 },
            ] }] });
            const errors = idm_datablocks.validateVersionFile(bad);
            expect(errors.join(' ')).to.match(/function.*5.*used by both.*"a".*"b"/);
        });

        it('does not flag repeated "function: -1" (the padding/unidentified marker)', () => {
            const ok = minimalVersionFile('foo', { data_blocks: [{ block_number: '03', definition: [
                { field: 'padding', description: 'padding', length: 1, factor: 1, writable: false, function: -1 },
                { field: 'padding2', description: 'padding2', length: 1, factor: 1, writable: false, function: -1 },
            ] }] });
            expect(idm_datablocks.validateVersionFile(ok)).to.deep.equal([]);
        });

        it('does not flag the same function id reused across different blocks', () => {
            const ok = minimalVersionFile('foo', { data_blocks: [
                { block_number: '03', definition: [{ field: 'a', description: 'a', length: 1, factor: 1, writable: false, function: 5 }] },
                { block_number: '04', definition: [{ field: 'b', description: 'b', length: 1, factor: 1, writable: false, function: 5 }] },
            ] });
            expect(idm_datablocks.validateVersionFile(ok)).to.deep.equal([]);
        });

        it('flags fields with the wrong types instead of silently accepting them', () => {
            const bad = minimalVersionFile('foo', { data_blocks: [{ block_number: '03', definition: [
                { field: 123, description: 'x', length: 3, factor: 'oops', writable: 'yes', function: 'nope' },
            ] }] });
            expect(idm_datablocks.validateVersionFile(bad).length).to.be.greaterThan(3);
        });
    });

    describe('resolve() with a custom directory', () => {
        let tmpDir;

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idm-datablocks-test-'));
        });

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('overrides one bundled version and leaves the others untouched', () => {
            const customFile = writeVersionFile(tmpDir, 'custom.json', minimalVersionFile('idm701100', {
                data_blocks: [{ block_number: '03', definition: [
                    { field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1, writable: true, function: 1, min: 30, max: 65 },
                ] }],
            }));

            const { byVersion, sources } = idm_datablocks.resolve(tmpDir);

            expect(sources.get('idm701100')).to.equal(customFile);
            expect(byVersion.get('idm701100').data_blocks[0].definition[0].min).to.equal(30);
            // an unrelated bundled version is unaffected
            expect(sources.get('idm712100')).to.equal(idm_datablocks.BUNDLED_DIR + path.sep + 'idm712100.json');
        });

        it('adds a not-yet-supported version instead of only overriding existing ones', () => {
            writeVersionFile(tmpDir, 'brandnew.json', minimalVersionFile('idmBrandNew'));
            const { byVersion } = idm_datablocks.resolve(tmpDir);
            expect(byVersion.has('idmBrandNew')).to.be.true;
        });

        it('rejects (with a warning) two custom files claiming the same version, keeping the bundled one', () => {
            writeVersionFile(tmpDir, 'a.json', minimalVersionFile('idm701100'));
            writeVersionFile(tmpDir, 'b.json', minimalVersionFile('idm701100'));

            const warnings = [];
            const { byVersion, sources } = idm_datablocks.resolve(tmpDir, msg => warnings.push(msg));

            expect(warnings.some(w => w.includes('idm701100') && w.includes('a.json') && w.includes('b.json'))).to.be.true;
            // falls back to the bundled definition for that version rather than picking one
            expect(sources.get('idm701100')).to.equal(idm_datablocks.BUNDLED_DIR + path.sep + 'idm701100.json');
            expect(byVersion.get('idm701100').data_blocks[0].definition.some(f => f.field === 'WW_soll')).to.be.true;
        });

        it('rejects two custom files claiming the same brand-new (not bundled) version too', () => {
            writeVersionFile(tmpDir, 'a.json', minimalVersionFile('totallyNew'));
            writeVersionFile(tmpDir, 'b.json', minimalVersionFile('totallyNew'));

            const warnings = [];
            const { byVersion } = idm_datablocks.resolve(tmpDir, msg => warnings.push(msg));

            expect(warnings).to.not.be.empty;
            expect(byVersion.has('totallyNew')).to.be.false;
        });

        it('ignores (with a warning) an individual custom file that fails validation, keeping the rest', () => {
            writeVersionFile(tmpDir, 'broken.json', { version: 'idm701100' }); // missing everything else
            writeVersionFile(tmpDir, 'ok.json', minimalVersionFile('brandnewok'));

            const warnings = [];
            const { byVersion, sources } = idm_datablocks.resolve(tmpDir, msg => warnings.push(msg));

            expect(warnings.some(w => w.includes('broken.json'))).to.be.true;
            expect(byVersion.has('brandnewok')).to.be.true;
            // idm701100 keeps its bundled definition since the custom one for it was invalid
            expect(sources.get('idm701100')).to.equal(idm_datablocks.BUNDLED_DIR + path.sep + 'idm701100.json');
        });

        it('ignores non-JSON files in the custom directory', () => {
            fs.writeFileSync(path.join(tmpDir, 'README.md'), '# not a data file');
            const { byVersion } = idm_datablocks.resolve(tmpDir);
            // just proves resolve() didn't throw trying to parse it, and defaults still load
            expect(byVersion.size).to.be.greaterThan(0);
        });

        it('falls back to bundled-only and warns when the custom directory does not exist', () => {
            const missingDir = path.join(tmpDir, 'does-not-exist');
            const warnings = [];
            const { byVersion } = idm_datablocks.resolve(missingDir, msg => warnings.push(msg));

            expect(warnings).to.have.lengthOf(1);
            expect(byVersion.size).to.be.greaterThan(0);
        });

        it('does not throw if no logWarn callback is given for a problematic custom directory', () => {
            writeVersionFile(tmpDir, 'a.json', minimalVersionFile('idm701100'));
            writeVersionFile(tmpDir, 'b.json', minimalVersionFile('idm701100'));
            expect(() => idm_datablocks.resolve(tmpDir)).to.not.throw();
        });
    });
});
