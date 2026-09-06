// Loader for the hardware data block definitions.
//
// The register/data-block layout for every supported control version used to be one giant
// hard-coded JS object. It is now plain data, split into ONE JSON FILE PER FIRMWARE VERSION
// under lib/datablocks/ (e.g. lib/datablocks/idm701100.json) - each file's own "version" field
// is the key the adapter matches against the version string the heat pump reports after
// connecting.
//
// An installation can point the adapter (via the "Custom data blocks directory" instance
// setting, see io-package.json's native.dataBlocksDir) at a directory of its own such files -
// to add min/max limits for a specific installation, fix a field, or add a not-yet-supported
// control version - all without reinstalling or upgrading the adapter. A custom file for a
// given version REPLACES the bundled definition for that version entirely (it is not merged
// field-by-field); bundled versions with no matching custom file are unaffected. Because this
// data ends up being sent to a live heat pump: every file is structurally validated before
// use, a file that fails validation is skipped (logged, bundled definition kept if any), and -
// since a version can only ever mean one thing - two files in the SAME directory claiming the
// same version is treated the same way: both are rejected for that version and the bundled
// definition (if any) is kept, rather than silently picking one of the two.
'use strict';

const fs = require('fs');
const path = require('path');

const BUNDLED_DIR = path.join(__dirname, 'datablocks');

function readJsonFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

/**
 * Structural validation for ONE version's data block file. Deliberately conservative: it only
 * checks the shape the rest of the adapter relies on (so a bad file fails loudly instead of
 * causing confusing errors - or worse, sending a garbage value to the heat pump - later).
 * @param {any} data
 * @returns {string[]} list of problems found, empty if the data looks usable
 */
function validateVersionFile(data) {
    const errors = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        errors.push('root of the file must be an object');
        return errors;
    }
    if (typeof data.version !== 'string' || data.version.length === 0) {
        errors.push('"version" must be a non-empty string - this is the value matched against what the heat pump reports');
    }
    if (!Array.isArray(data.sensorBlocks)) errors.push('"sensorBlocks" must be an array');
    if (!Array.isArray(data.settingsBlocks)) errors.push('"settingsBlocks" must be an array');
    if (typeof data.speed !== 'number') errors.push('"speed" must be a number (100 = normal speed)');
    if (!Array.isArray(data.data_blocks)) {
        errors.push('"data_blocks" must be an array');
        return errors;
    }

    data.data_blocks.forEach((block, blockIndex) => {
        const blockWhere = `data_blocks[${blockIndex}]`;
        if (typeof block.block_number !== 'string') {
            errors.push(`${blockWhere}: "block_number" must be a string`);
        }
        if (!Array.isArray(block.definition)) {
            errors.push(`${blockWhere}: "definition" must be an array`);
            return;
        }
        // -1 is the established "no function / read-only position, not identified yet"
        // marker (see lib/datablocks/README.md) and is intentionally excluded below.
        const seenFunctions = new Map();
        block.definition.forEach((field, fieldIndex) => {
            const where = `${blockWhere}.definition[${fieldIndex}]`;
            if (typeof field.field !== 'string') errors.push(`${where}: "field" must be a string`);
            if (typeof field.description !== 'string') errors.push(`${where}: "description" must be a string`);
            if (field.length !== 1 && field.length !== 2) errors.push(`${where}: "length" must be 1 or 2`);
            if (typeof field.factor !== 'number') errors.push(`${where}: "factor" must be a number`);
            if (typeof field.function !== 'number') errors.push(`${where}: "function" must be a number`);
            if (field.writable !== undefined && typeof field.writable !== 'boolean') {
                errors.push(`${where}: "writable" must be a boolean`);
            }
            const hasMin = field.min !== undefined && field.min !== null;
            const hasMax = field.max !== undefined && field.max !== null;
            if (hasMin && typeof field.min !== 'number') errors.push(`${where}: "min" must be a number (or null/omitted)`);
            if (hasMax && typeof field.max !== 'number') errors.push(`${where}: "max" must be a number (or null/omitted)`);
            if (hasMin && hasMax && field.min > field.max) errors.push(`${where}: "min" (${field.min}) is greater than "max" (${field.max})`);

            // A collision here means two fields would read/write the very same physical
            // register - if either is (or becomes) writable, a value meant for one field
            // could be sent to the other instead. This class of copy/paste bug has bitten
            // this project before (see the 1.2.7 changelog entry).
            if (typeof field.function === 'number' && field.function !== -1) {
                const clash = seenFunctions.get(field.function);
                if (clash !== undefined) {
                    errors.push(`${blockWhere}: "function" ${field.function} is used by both "${clash}" and "${field.field}" - each must address a distinct register`);
                } else {
                    seenFunctions.set(field.function, field.field);
                }
            }
        });
    });

    return errors;
}

/**
 * Reads every "*.json" file directly inside a directory and validates each as a version file.
 * Never throws for an individual bad file - it is reported in the returned list instead, so
 * one broken file doesn't take the rest of the directory down with it.
 * @param {string} dir
 * @returns {{version: string|null, file: string, data: any, errors: string[]}[]}
 */
function readVersionFilesFrom(dir) {
    const entries = fs.readdirSync(dir).filter(name => name.toLowerCase().endsWith('.json'));
    return entries.map(name => {
        const file = path.join(dir, name);
        try {
            const data = readJsonFile(file);
            const errors = validateVersionFile(data);
            return { version: errors.length === 0 ? data.version : null, file, data, errors };
        } catch (e) {
            return { version: null, file, data: null, errors: [`could not be read: ${e.message}`] };
        }
    });
}

/**
 * Resolves the complete set of data block definitions to use: the bundled ones (lib/datablocks/),
 * with any version-matching, individually-valid file from `customDir` overriding the bundled
 * definition for that version. Two files - bundled or custom - claiming the same version is
 * only ever expected within the bundled set (a bug in this adapter, so it throws) or within the
 * custom directory (a user mistake, so it is logged via `logWarn` and neither file is used for
 * that version - the bundled definition, if any, is kept instead).
 * @param {string} [customDir] absolute path to a directory of custom version files
 * @param {(msg: string) => void} [logWarn] called with a message for anything in customDir that
 *   could not be used
 * @returns {{byVersion: Map<string, any>, sources: Map<string, string>}}
 */
function resolve(customDir, logWarn) {
    const warn = typeof logWarn === 'function' ? logWarn : () => {};

    const byVersion = new Map();
    const sources = new Map();

    for (const { version, file, errors } of readVersionFilesFrom(BUNDLED_DIR)) {
        if (errors.length > 0) {
            // This would mean the adapter shipped a broken bundled file - a bug, not a user error.
            throw new Error(`bundled data blocks file "${file}" failed validation: ${errors.join('; ')}`);
        }
        if (byVersion.has(version)) {
            throw new Error(`bundled data blocks directory has more than one file for version "${version}" (${sources.get(version)} and ${file})`);
        }
        byVersion.set(version, readJsonFile(file));
        sources.set(version, file);
    }

    if (customDir) {
        let customFiles;
        try {
            customFiles = readVersionFilesFrom(customDir);
        } catch (e) {
            warn(`ignoring custom data blocks directory "${customDir}" because it could not be read: ${e.message}`);
            customFiles = [];
        }

        // Group by version first so a duplicate can be detected (and reported) before either
        // candidate is applied - order of files within a directory listing isn't something
        // that should silently decide the outcome.
        const byVersionInCustomDir = new Map();
        for (const entry of customFiles) {
            if (entry.errors.length > 0) {
                warn(`ignoring custom data blocks file "${entry.file}" because it failed validation: ${entry.errors.join('; ')}`);
                continue;
            }
            const list = byVersionInCustomDir.get(entry.version) || [];
            list.push(entry);
            byVersionInCustomDir.set(entry.version, list);
        }

        for (const [version, entries] of byVersionInCustomDir) {
            if (entries.length > 1) {
                const files = entries.map(e => e.file).join(', ');
                warn(`ignoring all custom data blocks files for version "${version}" - there must be only one, but found ${entries.length}: ${files}`);
                continue;
            }
            const [{ file, data }] = entries;
            byVersion.set(version, data);
            sources.set(version, file);
        }
    }

    return { byVersion, sources };
}

module.exports = { resolve, validateVersionFile, readVersionFilesFrom, BUNDLED_DIR };
