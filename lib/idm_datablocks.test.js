const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const idm_datablocks = require('./idm_datablocks');

describe('idm_datablocks (data blocks loader)', () => {

    describe('bundled defaults', () => {
        it('loads and validates without a custom file', () => {
            const { data, source } = idm_datablocks.load();
            expect(source).to.equal(idm_datablocks.DEFAULT_FILE);
            expect(idm_datablocks.validate(data)).to.deep.equal([]);
        });

        it('defines data for every control version referenced elsewhere in the adapter', () => {
            const { data } = idm_datablocks.load();
            for (const key of ['idm701100', 'idm712100', 'idm722100', 'S_H726100', 'idm750100', 'evr752101']) {
                expect(data[key + '_data'], key + '_data').to.be.an('object');
                expect(data[key], key).to.be.an('array').that.is.not.empty;
                expect(data[key + '_speed'], key + '_speed').to.be.a('number');
            }
        });
    });

    describe('validate', () => {
        it('rejects a non-object root', () => {
            expect(idm_datablocks.validate(null)).to.not.be.empty;
            expect(idm_datablocks.validate('nope')).to.not.be.empty;
            expect(idm_datablocks.validate([])).to.not.be.empty;
        });

        it('rejects a file with no "*_data" entries at all', () => {
            expect(idm_datablocks.validate({ foo: 'bar' })).to.not.be.empty;
        });

        it('accepts a minimal well-formed data set', () => {
            const minimal = {
                foo_data: { data_blocks: [{ block_number: '03', definition: [
                    { field: 'x', description: 'x', length: 1, factor: 1, writable: true, function: 1, min: 0, max: 10 },
                ] }] },
                foo: ['03'],
                foo_sensors: [],
                foo_settings: ['03'],
                foo_speed: 100,
            };
            expect(idm_datablocks.validate(minimal)).to.deep.equal([]);
        });

        it('flags a field with min greater than max', () => {
            const bad = {
                foo_data: { data_blocks: [{ block_number: '03', definition: [
                    { field: 'x', description: 'x', length: 1, factor: 1, writable: true, function: 1, min: 10, max: 0 },
                ] }] },
                foo: ['03'],
            };
            const errors = idm_datablocks.validate(bad);
            expect(errors).to.not.be.empty;
            expect(errors.join(' ')).to.match(/min.*greater than.*max/);
        });

        it('flags a missing block-number list for a "*_data" entry', () => {
            const bad = {
                foo_data: { data_blocks: [] },
                // "foo" array is missing entirely
            };
            const errors = idm_datablocks.validate(bad);
            expect(errors.join(' ')).to.match(/must be an array/);
        });

        it('flags fields with the wrong types instead of silently accepting them', () => {
            const bad = {
                foo_data: { data_blocks: [{ block_number: '03', definition: [
                    { field: 123, description: 'x', length: 3, factor: 'oops', writable: 'yes', function: 'nope' },
                ] }] },
                foo: ['03'],
            };
            const errors = idm_datablocks.validate(bad);
            expect(errors.length).to.be.greaterThan(3);
        });
    });

    describe('load with a custom file', () => {
        let tmpDir;

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idm-datablocks-test-'));
        });

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('uses a valid custom file instead of the bundled defaults', () => {
            const customFile = path.join(tmpDir, 'custom.json');
            const custom = {
                myversion_data: { data_blocks: [{ block_number: '03', definition: [
                    { field: 'x', description: 'x', length: 1, factor: 1, writable: true, function: 1, min: 5, max: 25 },
                ] }] },
                myversion: ['03'],
                myversion_sensors: [],
                myversion_settings: ['03'],
                myversion_speed: 100,
            };
            fs.writeFileSync(customFile, JSON.stringify(custom));

            const { data, source } = idm_datablocks.load(customFile);
            expect(source).to.equal(customFile);
            expect(data.myversion_data.data_blocks[0].definition[0].min).to.equal(5);
        });

        it('falls back to bundled defaults and warns when the custom file fails validation', () => {
            const customFile = path.join(tmpDir, 'invalid.json');
            fs.writeFileSync(customFile, JSON.stringify({ not_data_at_all: true }));

            const warnings = [];
            const { source } = idm_datablocks.load(customFile, msg => warnings.push(msg));

            expect(source).to.equal(idm_datablocks.DEFAULT_FILE);
            expect(warnings).to.have.lengthOf(1);
            expect(warnings[0]).to.include(customFile);
        });

        it('falls back to bundled defaults and warns when the custom file does not exist', () => {
            const missingFile = path.join(tmpDir, 'does-not-exist.json');

            const warnings = [];
            const { source } = idm_datablocks.load(missingFile, msg => warnings.push(msg));

            expect(source).to.equal(idm_datablocks.DEFAULT_FILE);
            expect(warnings).to.have.lengthOf(1);
        });

        it('falls back to bundled defaults and warns when the custom file is not valid JSON', () => {
            const customFile = path.join(tmpDir, 'broken.json');
            fs.writeFileSync(customFile, '{ this is not json');

            const warnings = [];
            const { source } = idm_datablocks.load(customFile, msg => warnings.push(msg));

            expect(source).to.equal(idm_datablocks.DEFAULT_FILE);
            expect(warnings).to.have.lengthOf(1);
        });

        it('does not throw if no logWarn callback is given for an invalid custom file', () => {
            const customFile = path.join(tmpDir, 'invalid.json');
            fs.writeFileSync(customFile, JSON.stringify({ nope: true }));
            expect(() => idm_datablocks.load(customFile)).to.not.throw();
        });
    });
});
