const { expect } = require('chai');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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

    // Catches transcription bugs like the one fixed in 2.2.3 (and again in 2.2.4): a field
    // was accidentally copy-pasted with the wrong "writable" flag into exactly one of the six
    // bundled files, so "Heizkreis B" could be read but never changed on that control version.
    // A field is the "same" field across firmware files when it shares both a statename AND a
    // function (register) id there - the protocol has no other way to say "this register is
    // the same thing on every control version". writable/length/factor MUST then match: they
    // describe how the register is framed on the wire and whether writes are even attempted,
    // none of which plausibly differs by firmware revision for the same physical register.
    // min/max are treated more leniently: today only S_H726100 (and partially EVR752101) has
    // hand-verified limits (see README - "neither source documents official min/max limits"),
    // so one side being undocumented (undefined) while the other has a real value is expected,
    // not a bug. Two DIFFERENT non-undefined bounds for the same register would still fail.
    describe('cross-firmware consistency of the bundled definitions', () => {
        // Each entry: a (statename, function) pair that genuinely differs across firmware files
        // as of 2026-10. One other that used to be listed here (Heizkreis-A.Absenkfaktor) was
        // confirmed and fixed in 2.2.5: makki's original idm712/idm750 source data (Klaus found
        // and shared both idm712-datatype.txt and idm750_Datatypes.csv - our bundled
        // idm712100.json and idm750100.json already matched them with 0 discrepancies out of
        // 120/142 fields each) said Absenkfaktor A is 2 bytes everywhere, and S_H726100's block
        // 04 had an unexplained 1-byte "padding5" entry (function: -1, i.e. nobody had ever
        // identified what that byte was for) sitting immediately AFTER a 1-byte Absenkfaktor A.
        // That byte was never padding - it was Absenkfaktor's own second byte, misclassified as
        // unknown filler. Widening Absenkfaktor to 2 bytes and removing the adjacent padding5
        // entry keeps block 04's hardware-confirmed wireLength (87) exactly satisfied while
        // every later field lands at the same offset as before. Klaus independently spotted the
        // same fix by reading fresh values straight off his running adapter: with the old 1-byte
        // field, Absenkfaktor A read 5 and the very next (phantom) padding5 read 0 - exactly the
        // low/high byte pair you'd expect for a 2-byte value of 5, matching Absenkfaktor C/D
        // (already 2 bytes) which also read 5 on his hardware.
        //
        // Heizung.PufferVorhanden and Heizung.SchichttrennplatteVorhanden were the INVERSE
        // lesson, and are listed below rather than fixed: the same source documents say both are
        // 1 byte, and idm712100/idm722100/idm750100/EVR752101 do use 1 byte - but shrinking them
        // on idm701100 and S_H726100 (both currently 2 bytes) does NOT produce sane output. Live
        // block 03 reads from Klaus's actual S_H726100 hardware, and this project's own
        // regression-snapshot captures (lib/idm-protocol.test.js) for both idm701100 and
        // S_H726100, decode to sensible values (booleans 0/1, small Laufzeit Zirkulation,
        // plausible min. Drehzahl HZK-Pumpe) ONLY with the current 2-byte lengths; shrinking
        // either field by 1 byte shifts every subsequent field in the block and turns all of
        // them into nonsense (e.g. Puffer vorhanden reading 39, Laufzeit Zirkulation reading
        // 2560). Unlike Absenkfaktor, no adjacent misclassified padding field was found that
        // would absorb a 1-byte shrink here - so, exactly like Heizkreis-A.Absenkfaktor before it
        // was understood, treat the source documents as describing idm712100/idm750100 correctly
        // but NOT idm701100/S_H726100 for this specific pair of fields, until a live capture
        // (not just another reference document) proves otherwise.
        //
        // Waermepumpe.MinimaleLaufzeit remains unresolved for a different reason: neither
        // reference file has a "writable" column (they only cover Id/Block-Id/Beschreibung/
        // Name/Groesse/Faktor), so they cannot adjudicate a writable-flag disagreement at all.
        const KNOWN_UNRESOLVED_DIFFERENCES = new Set([
            'Waermepumpe.MinimaleLaufzeit/38',        // writable: true on idm712100/idm722100, false elsewhere
            'Heizung.SchichttrennplatteVorhanden/55', // length: 2 on idm701100/S_H726100, 1 everywhere else (incl. source docs)
            'Heizung.PufferVorhanden/56',             // length: 2 on idm701100/S_H726100, 1 everywhere else (incl. source docs)
        ]);

        it('keeps writable/length/factor identical for the same (statename, function) across every firmware', () => {
            /** @type {Map<string, {file: string, writable: boolean, length: number, factor: number, min?: number, max?: number}[]>} */
            const byKey = new Map();
            for (const { file, data } of idm_datablocks.readVersionFilesFrom(idm_datablocks.BUNDLED_DIR)) {
                for (const block of data.data_blocks) {
                    for (const field of block.definition) {
                        if (!field.statename || field.function === -1) continue; // padding/unidentified
                        const key = field.statename + '/' + field.function;
                        let list = byKey.get(key);
                        if (!list) {
                            list = [];
                            byKey.set(key, list);
                        }
                        list.push({ file, writable: field.writable, length: field.length, factor: field.factor, min: field.min, max: field.max });
                    }
                }
            }

            const problems = [];
            for (const [key, entries] of byKey) {
                if (entries.length < 2 || KNOWN_UNRESOLVED_DIFFERENCES.has(key)) continue;

                for (const attr of ['writable', 'length', 'factor']) {
                    const values = new Set(entries.map(e => e[attr]));
                    if (values.size > 1) {
                        problems.push(key + ': ' + attr + ' differs - ' + entries.map(e => e.file.split('/').pop() + '=' + e[attr]).join(', '));
                    }
                }
                for (const attr of ['min', 'max']) {
                    const defined = entries.map(e => e[attr]).filter(v => v !== undefined);
                    if (new Set(defined).size > 1) {
                        problems.push(key + ': ' + attr + ' disagrees (not just undocumented) - ' + entries.map(e => e.file.split('/').pop() + '=' + e[attr]).join(', '));
                    }
                }
            }

            expect(problems, 'found inconsistent field definitions for what should be the same register - see KNOWN_UNRESOLVED_DIFFERENCES above if this is an intentional, confirmed difference').to.deep.equal([]);
        });

        it('fails loudly if a KNOWN_UNRESOLVED_DIFFERENCES entry stops being a real difference (so it gets removed, not forgotten)', () => {
            /** @type {Map<string, Set<string>>} */
            const byKey = new Map();
            for (const { data } of idm_datablocks.readVersionFilesFrom(idm_datablocks.BUNDLED_DIR)) {
                for (const block of data.data_blocks) {
                    for (const field of block.definition) {
                        if (!field.statename || field.function === -1) continue;
                        const key = field.statename + '/' + field.function;
                        if (!KNOWN_UNRESOLVED_DIFFERENCES.has(key)) continue;
                        let seen = byKey.get(key);
                        if (!seen) {
                            seen = new Set();
                            byKey.set(key, seen);
                        }
                        seen.add(JSON.stringify({ writable: field.writable, length: field.length, factor: field.factor }));
                    }
                }
            }
            for (const key of KNOWN_UNRESOLVED_DIFFERENCES) {
                const seen = byKey.get(key);
                expect(seen, key + ' is listed as unresolved but no longer appears in the bundled files - remove it from the list').to.not.be.undefined;
                expect(seen ? seen.size : 0, key + ' is listed as unresolved but all bundled files now agree - remove it from the list').to.be.greaterThan(1);
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
