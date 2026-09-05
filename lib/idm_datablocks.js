// Loader for the hardware data block definitions.
//
// The actual definitions (which registers exist per control version, their names, factors,
// and now optionally min/max limits) used to be hard-coded JS objects in this file. They now
// live in idm_datablocks.default.json instead, so they are plain data: they can be inspected,
// diffed and - most importantly - REPLACED without touching or recompiling any adapter code.
//
// An installation can point the adapter (via the "Custom data blocks file" instance setting,
// see io-package.json's native.dataBlocksFile) at its own JSON file, e.g. to add min/max
// limits for a specific installation, fix a wrong field definition, or add a not-yet-supported
// control version - all without waiting for a new adapter release. Because this data ends up
// being sent to a live heat pump, a custom file is only used after it passes structural
// validation; on any problem we log why and fall back to the bundled defaults.
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, 'idm_datablocks.default.json');

function loadJsonFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

/**
 * Structural validation for a data blocks file. Deliberately conservative: it only checks
 * the shape that the rest of the adapter relies on (so a bad custom file fails loudly instead
 * of causing confusing errors - or worse, sending a garbage value to the heat pump - later).
 * @param {any} data
 * @returns {string[]} list of problems found, empty if the data looks usable
 */
function validate(data) {
    const errors = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        errors.push('root of the file must be an object');
        return errors;
    }

    let dataKeyCount = 0;
    for (const key of Object.keys(data)) {
        if (!key.endsWith('_data')) continue;
        dataKeyCount++;
        const version = key.slice(0, -'_data'.length);
        const entry = data[key];

        if (!entry || typeof entry !== 'object' || !Array.isArray(entry.data_blocks)) {
            errors.push(`"${key}" must be an object with a "data_blocks" array`);
            continue;
        }

        entry.data_blocks.forEach((block, blockIndex) => {
            const blockWhere = `${key}.data_blocks[${blockIndex}]`;
            if (typeof block.block_number !== 'string') {
                errors.push(`${blockWhere}: "block_number" must be a string`);
            }
            if (!Array.isArray(block.definition)) {
                errors.push(`${blockWhere}: "definition" must be an array`);
                return;
            }
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
            });
        });

        if (!Array.isArray(data[version])) {
            errors.push(`"${version}" (the block-number list matching "${key}") must be an array`);
        }
    }

    if (dataKeyCount === 0) {
        errors.push('no "*_data" entries found - this does not look like a data blocks file');
    }

    return errors;
}

/**
 * Loads the hardware data block definitions: a custom file if one is given and valid,
 * otherwise (or on any problem with the custom file) the bundled defaults.
 * @param {string} [customFile] absolute path to a replacement/override JSON file
 * @param {(msg: string) => void} [logWarn] called with a human-readable message if the
 *   custom file could not be used
 * @returns {{data: object, source: string}}
 */
function load(customFile, logWarn) {
    const warn = typeof logWarn === 'function' ? logWarn : () => {};

    if (customFile) {
        try {
            const custom = loadJsonFile(customFile);
            const errors = validate(custom);
            if (errors.length === 0) {
                return { data: custom, source: customFile };
            }
            warn(`ignoring custom data blocks file "${customFile}" because it failed validation: ${errors.join('; ')}`);
        } catch (e) {
            warn(`ignoring custom data blocks file "${customFile}" because it could not be read: ${e.message}`);
        }
    }

    const defaults = loadJsonFile(DEFAULT_FILE);
    const errors = validate(defaults);
    if (errors.length > 0) {
        // This would mean the adapter shipped a broken defaults file - a bug, not a user error.
        throw new Error('bundled idm_datablocks.default.json failed validation: ' + errors.join('; '));
    }
    return { data: defaults, source: DEFAULT_FILE };
}

module.exports = { load, validate, DEFAULT_FILE };
