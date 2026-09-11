// definition of the protocol with the iDM multitalent.002 control
'use strict';

const idm_datablocks = require('./idm_datablocks');
const idm_utils = require('./idm-utils');

// Generous upper bound on how many characters add_to_packet() will accumulate between a SOH
// and the next ETX/EOT before giving up on the frame. This is purely defensive: without it, a
// stream that never sends a terminating ETX (line noise on the RS422/TCP path, a misbehaving
// serial-to-TCP converter, ...) would grow received_data_packet/receive_chksum forever, since
// only a genuine SOH/ETX/EOT byte - never plain length - is used to trigger a state change or
// error. 1024 hex characters (~512 bytes) comfortably covers the largest real combined
// multi-block reply seen so far (S_H726100's 7-block settings group, ~442 hex characters) with
// more than double headroom, while still catching runaway noise well before it could be mistaken
// for a plausible heat-pump-control reply.
const MAX_FRAME_LENGTH = 1024;

/**
 * Protocol/data-block state for ONE heat pump connection.
 *
 * This used to be a single module-level object (i.e. a process-wide singleton). That was
 * merely awkward for tests (which had to call reset()+initialize() between cases to avoid
 * bleeding state into each other - see idm_protocol.reset()) as long as the data block
 * definitions were fixed at require-time. It became an actual correctness risk once
 * definitions became loadable per adapter instance (see idm_datablocks.js's "Custom data
 * blocks directory" support) and, more importantly, because of received_data_packet/
 * receive_state/receive_chksum/remaining_data: these track the byte-by-byte parse of ONE
 * incoming TCP stream. Two adapter instances talking to two different heat pumps in the same
 * process (e.g. ioBroker "compact mode") would otherwise interleave and corrupt each other's
 * parser state and data block definitions. Each adapter instance must therefore create its own
 * `new IdmProtocol()`.
 */
class IdmProtocol {
    constructor() {
        this.dataBlocks = new Map();
        this.dataDefinitions = new Map();
        this.sensorDataBlocks = new Map();
        this.settingsDataBlocks = new Map();
        this.speed = new Map();
        /** @type {Map<string, string>} version -> absolute path of the file it was actually loaded from (set by initialize()) */
        this.dataSources = new Map();

        this.received_data_packet = '';
        this.receive_state = 0;
        this.receive_chksum = '';
        this.remaining_data = '';

        // version -> Map(block -> {length, confirmed}) - see recordMeasuredWireLength() and
        // getVerifiedBlockWireLength(). Every block goes through this, one way or another, before
        // it's trusted for multi-block requests (see firmwareSupportsMultiBlockRequestsForBlocks()):
        // seeded with a starting candidate - a JSON-declared "wireLength" (initialize()) or a
        // value restored from a previous run (main.js, via seedMeasuredWireLength()) - or, with
        // no seed at all, learned entirely from scratch via two consecutive live measurements.
        // Either way it's real traffic (see IdmSession's wireLength-learning hook in
        // receive_data()) that ultimately confirms a length, never a maintainer's or a previous
        // run's say-so alone.
        this.measuredWireLengths = new Map();
    }

    /**
     * Loads the hardware data block definitions (see idm_datablocks.js) and populates the
     * lookup Maps used by the rest of this class, one entry per firmware version. Also seeds an
     * unconfirmed measuredWireLengths CANDIDATE (see seedMeasuredWireLength()) for every block
     * that has a JSON-declared "wireLength" - a hand-verified starting guess, not an instant
     * grant (see getVerifiedBlockWireLength()'s comment for why every block, JSON-declared or
     * not, needs at least one live confirming measurement before multi-block requests trust it).
     * @param {string} [customDir] absolute path to a directory of custom per-version data
     *   blocks files, e.g. from the adapter's "dataBlocksDir" setting - a version with no
     *   matching (and valid) file there keeps using its bundled definition
     * @param {(msg: string) => void} [logWarn] called with a message for anything in customDir
     *   that could not be used
     */
    initialize(customDir, logWarn) {
        const { byVersion, sources } = idm_datablocks.resolve(customDir, logWarn);
        this.dataSources = sources;

        this.dataDefinitions.clear();
        this.dataBlocks.clear();
        this.sensorDataBlocks.clear();
        this.settingsDataBlocks.clear();
        this.speed.clear();
        // Also reset here: main.js always calls initialize() (constructor, then again in
        // onReady() with the configured customDir) BEFORE ever seeding a measurement persisted
        // from a previous run (see seedMeasuredWireLength()), so the JSON seeding below is always
        // what a real run starts from, with main.js's persisted-state seeding layered on top of
        // it afterwards (overwriting a block's candidate where a persisted one exists - both are
        // just unconfirmed candidates either way, so it makes no difference which one a block
        // happens to start from). This clear() also keeps a test suite that reuses one
        // IdmProtocol instance across several initialize() calls (e.g. one per `it`, via a shared
        // beforeEach) from leaking measurements learned in one test into the next.
        this.measuredWireLengths.clear();

        for (const [version, data] of byVersion) {
            this.dataDefinitions.set(version, data);
            this.dataBlocks.set(version, data.data_blocks.map(block => block.block_number));
            this.sensorDataBlocks.set(version, data.sensorBlocks);
            this.settingsDataBlocks.set(version, data.settingsBlocks);
            this.speed.set(version, data.speed);
            for (const block of data.data_blocks) {
                if (typeof block.wireLength === 'number') {
                    this.seedMeasuredWireLength(version, block.block_number, block.wireLength);
                }
            }
        }
    }

    /**
     * Whether the definition currently loaded for `version` (see initialize()) came from a
     * custom data blocks directory rather than the ones bundled with the adapter - so callers
     * (e.g. the "which definition was actually used" log line) can say so explicitly instead of
     * just printing a file path.
     * @param {string} version
     * @returns {boolean}
     */
    isCustomDefinition(version) {
        const file = this.dataSources.get(version);
        if (!file) return false;
        return !file.startsWith(idm_datablocks.BUNDLED_DIR);
    }

    /**
     * Checks a value about to be written to the heat pump against the min/max limits (if any)
     * carried by its data block definition. This is the enforcement point for the "min"/"max"
     * fields that can be set per-field in the data blocks file/JSON - fields without either
     * are accepted as before (no limit configured/known).
     * @param {any} definition the field's data block definition (or the stateNameMap entry
     *   derived from it) - only its optional "min"/"max" are used here
     * @param {string | number | boolean | null | undefined} value
     * @returns {{ok: boolean, value?: number, reason?: string}}
     */
    checkValueRange(definition, value) {
        if (!definition) return { ok: false, reason: 'no data block definition found for this state' };

        const numericValue = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(numericValue)) {
            return { ok: false, reason: `value "${value}" is not a number` };
        }
        if (definition.min !== undefined && definition.min !== null && numericValue < definition.min) {
            return { ok: false, reason: `${numericValue} is below the minimum allowed value ${definition.min}` };
        }
        if (definition.max !== undefined && definition.max !== null && numericValue > definition.max) {
            return { ok: false, reason: `${numericValue} is above the maximum allowed value ${definition.max}` };
        }
        return { ok: true, value: numericValue };
    }

    getDefinition(version, block) {
        try {
            const definitions = this.dataDefinitions.get(version);
            if (definitions) {
                const dataBlocks = definitions.data_blocks;
                for (let i = 0; i < dataBlocks.length; i++) {
                    if (dataBlocks[i].block_number === block) {
                        return dataBlocks[i].definition;
                    }
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }

    getDataBlocks(version) {
        if (this.dataBlocks && this.dataBlocks.has(version)) {
            return this.dataBlocks.get(version);
        }
        return null;
    }

    getSensorDataBlocks(version) {
        if (this.sensorDataBlocks && this.sensorDataBlocks.has(version)) {
            return this.sensorDataBlocks.get(version);
        }
        return null;
    }

    getSettingsDataBlocks(version) {
        if (this.settingsDataBlocks && this.settingsDataBlocks.has(version)) {
            return this.settingsDataBlocks.get(version);
        }
        return null;
    }

    /**
     * The block's ACTUAL length on the wire, in bytes, if known.
     *
     * This is NOT necessarily the same as summing this block's field lengths (see
     * getDefinition()): parseProtocol() has always had to tolerate a data block reply being
     * longer than its documented fields account for (any leftover bytes are appended to the
     * parsed text as "* add data: ..." and otherwise ignored) - undocumented, presumably
     * reserved/padding bytes that single-block requests never needed to know about, since the
     * reply's own SOH/ETX/checksum framing finds the frame boundary regardless. A MULTI-block
     * reply has no such per-block framing though - finding where one block's data ends and the
     * next one's id begins requires the block's TRUE wire length, so this returns the explicitly
     * verified "wireLength" from the data blocks file when present, falling back to the
     * (possibly too-short) documented field sum otherwise. See
     * firmwareSupportsMultiBlockRequests() for the gate this feeds.
     * @param {string | undefined} version
     * @param {string} block
     * @returns {number | null} byte length, or null if the block/version is unknown
     */
    getBlockWireLength(version, block) {
        const definitions = this.dataDefinitions.get(version);
        if (!definitions) return null;
        const entry = definitions.data_blocks.find((b) => b.block_number === block);
        if (!entry) return null;
        if (typeof entry.wireLength === 'number') return entry.wireLength;
        return entry.definition.reduce((s, f) => s + (typeof f.length === 'number' ? f.length : 0), 0);
    }

    /**
     * The TRUSTED wire length for `block`/`version`, for anything that needs to walk a
     * multi-block reply's byte boundaries (see parse_multi_block_reply()) rather than just
     * tolerate extra trailing bytes the way a single-block reply's own framing already does: a
     * length CONFIRMED via recordMeasuredWireLength() - either from two consecutive live
     * measurements, or from just one live measurement matching a SEEDED candidate (a
     * JSON-declared "wireLength", seeded by initialize(); or a value restored from a previous
     * adapter run, seeded by main.js via seedMeasuredWireLength()). A JSON-declared "wireLength"
     * is deliberately NOT trusted outright here, hand-verified or not: it's still only a
     * candidate until this run's own traffic confirms it once, exactly like a restored value -
     * see seedMeasuredWireLength()'s comment for why. Deliberately never falls back to the
     * documented field-sum getBlockWireLength() does for everything else - that fallback is a
     * plausible guess (blocks are known to carry undocumented trailing bytes beyond their listed
     * fields), and a wrong guess here wouldn't just mis-parse one block's own fields, it would
     * misalign every block AFTER it in the same reply too.
     * @param {string | undefined} version
     * @param {string} block
     * @returns {number | null}
     */
    getVerifiedBlockWireLength(version, block) {
        const measured = version ? this.measuredWireLengths.get(version)?.get(block) : undefined;
        if (measured && measured.confirmed) return measured.length;
        return null;
    }

    /**
     * Records one single-block reply's ACTUAL wire length for `block`/`version`, learned
     * passively from real traffic (see IdmSession's wireLength-learning hook in receive_data(),
     * the only caller) - a no-op once the block already has a trusted length (see
     * getVerifiedBlockWireLength()).
     *
     * A single-block reply is fully checksum-verified before this is ever called (see
     * add_to_packet()), so a CORRUPTED length can't slip in that way - what this guards against
     * instead is something we simply don't know either way, never having tested it: whether a
     * given firmware could append a different number of undocumented reserved/padding bytes on
     * different occasions, or even change its wire format between installations or over time
     * (e.g. a firmware update) despite reporting the same version string. Two CONSECUTIVE
     * matching measurements are required before a length is trusted enough to unlock multi-block
     * requests for its group (see firmwareSupportsMultiBlockRequestsForBlocks()) - a disagreement
     * simply restarts the count from the new value rather than ever averaging or guessing which
     * one was right. A SEEDED candidate (see seedMeasuredWireLength() - a value restored from a
     * previous run, or a JSON-declared "wireLength") counts as the FIRST of those two
     * measurements, not a free pass - every restart re-confirms once before its group is trusted
     * for multi-block again, exactly like a block seen for the very first time ever.
     * @param {string | undefined} version
     * @param {string} block
     * @param {number} length byte length of this reply's payload (after the 01F200+block header)
     * @returns {{status: 'already-verified' | 'first-measurement' | 'confirmed' | 'mismatch', length: number}}
     */
    recordMeasuredWireLength(version, block, length) {
        if (this.getVerifiedBlockWireLength(version, block) !== null) {
            return { status: 'already-verified', length };
        }
        if (!version) return { status: 'first-measurement', length };
        if (!this.measuredWireLengths.has(version)) this.measuredWireLengths.set(version, new Map());
        const perVersion = this.measuredWireLengths.get(version);
        const previous = perVersion.get(block);
        if (previous && previous.length === length) {
            perVersion.set(block, { length, confirmed: true });
            return { status: 'confirmed', length };
        }
        perVersion.set(block, { length, confirmed: false });
        return { status: previous ? 'mismatch' : 'first-measurement', length };
    }

    /**
     * Seeds `length` as a CANDIDATE measured wireLength for `block`/`version`. Two sources call
     * this, both feeding the SAME "needs one fresh confirming measurement" pipeline:
     *   - main.js, restoring a value persisted from a PREVIOUS adapter run (an ioBroker state),
     *     before the connection is started;
     *   - initialize(), for every block with a JSON-declared "wireLength" in its data blocks
     *     file - a hand-verified starting guess, not an instant grant (see
     *     getVerifiedBlockWireLength()'s comment for why).
     *
     * Deliberately does NOT mark it confirmed outright - every restart re-measures once before
     * trusting it again (see recordMeasuredWireLength(), whose normal "two consecutive matching
     * measurements" rule this feeds into as if the seeded value were the first of those two): we
     * have no hard evidence a control's wire length is fixed forever - whether because it depends
     * on some heat pump setting, or because a JSON value was estimated/wrong, or a firmware
     * update silently changed it - so treating ANY seed as an unconfirmed candidate, needing
     * exactly one fresh matching measurement THIS run, costs one extra request per block per
     * restart but means every block - freshly seen, previously learned, or hand-verified in the
     * data blocks file - is held to the same standard rather than any one source being trusted
     * blindly forever. Calling this again for a block that already has an entry (confirmed or
     * not) simply replaces it with a fresh unconfirmed candidate - used by
     * forgetMeasuredWireLengths() to force a clean re-measurement after a multi-block parse error
     * suggests a trusted length has gone wrong.
     * @param {string} version
     * @param {string} block
     * @param {number} length
     */
    seedMeasuredWireLength(version, block, length) {
        if (!this.measuredWireLengths.has(version)) this.measuredWireLengths.set(version, new Map());
        this.measuredWireLengths.get(version).set(block, { length, confirmed: false });
    }

    /**
     * Discards any measured/seeded wireLength state for `blockIds`/`version` - used when a
     * multi-block reply couldn't be parsed (see IdmSession#handleMultiBlockDataReply()'s `error`
     * branch, the only caller): losing sync mid-reply means one of the group's wireLengths is no
     * longer correct, but not which one, so the whole group is dropped back to square one rather
     * than guessing. This also intentionally discards a JSON-declared "wireLength" seed, not just
     * a live measurement - if the JSON value itself turned out to be wrong (or a firmware update
     * changed it), re-seeding from the very same value on the next connection would just recreate
     * the mismatch, so the affected block(s) instead start completely fresh:
     * firmwareSupportsMultiBlockRequestsForBlocks() now returns false for the group
     * (getVerifiedBlockWireLength() has nothing left to return), so its next turn automatically
     * falls back to the classic one-block-at-a-time round-robin, which re-learns each block from
     * two fresh consecutive measurements like a block seen for the very first time.
     * @param {string | undefined} version
     * @param {string[]} blockIds
     */
    forgetMeasuredWireLengths(version, blockIds) {
        if (!version) return;
        const perVersion = this.measuredWireLengths.get(version);
        if (!perVersion) return;
        for (const block of blockIds) perVersion.delete(block);
    }

    /**
     * Whether MULTI-block requests (asking for several data blocks in one 0171 message - see
     * IdmSession's multi-block collector) are safe to use for `blockIds` under `version`: every
     * one of them must have a TRUSTED wire length - see getVerifiedBlockWireLength(). Generalizes
     * what used to be a settings-only check to any group of block ids, so the same gate now also
     * covers sensor blocks (see firmwareSupportsMultiBlockRequestsForSensors()) - each group
     * qualifies independently, since a block's wireLength may be hand-verified for one group and
     * still only measured-and-unconfirmed (or entirely unmeasured) for the other.
     * @param {string | undefined} version
     * @param {string[] | null | undefined} blockIds
     * @returns {boolean}
     */
    firmwareSupportsMultiBlockRequestsForBlocks(version, blockIds) {
        if (!blockIds || blockIds.length === 0) return false;
        return blockIds.every((blockId) => this.getVerifiedBlockWireLength(version, blockId) !== null);
    }

    /**
     * Settings-blocks convenience wrapper - see firmwareSupportsMultiBlockRequestsForBlocks().
     * True once every settings block's wireLength has been confirmed via
     * recordMeasuredWireLength() - whether that took one confirming measurement (a JSON-declared
     * "wireLength", e.g. S_H726100, or a value restored from a previous run) or two independent
     * ones from scratch.
     * @param {string | undefined} version
     * @returns {boolean}
     */
    firmwareSupportsMultiBlockRequests(version) {
        return this.firmwareSupportsMultiBlockRequestsForBlocks(version, this.settingsDataBlocks.get(version));
    }

    /**
     * Sensor-blocks convenience wrapper - see firmwareSupportsMultiBlockRequestsForBlocks().
     * @param {string | undefined} version
     * @returns {boolean}
     */
    firmwareSupportsMultiBlockRequestsForSensors(version) {
        return this.firmwareSupportsMultiBlockRequestsForBlocks(version, this.sensorDataBlocks.get(version));
    }

    /**
     * Builds a 0171 request for MULTIPLE data blocks at once (see
     * firmwareSupportsMultiBlockRequests()). On the wire this is exactly the single-block
     * message's payload repeated for each block, with no separator or count byte needed since
     * blockIds are always fixed 2-hex-digit (1 byte) ids - confirmed against a real S_H726100
     * control. The reply's block ORDER is not guaranteed to match blockIds, and the control may
     * reply with only a subset of what was asked for per 0172 request - see
     * parse_multi_block_reply() and IdmSession's multi-block collector, which re-asks until
     * every requested block has actually been seen.
     * @param {string[]} blockIds
     * @returns {Uint8Array}
     */
    create_request_multi_block_message(blockIds) {
        return this.create_message('0171' + blockIds.map((id) => id + '00').join(''));
    }

    /**
     * Parses a multi-block data reply (see create_request_multi_block_message()) into its
     * individual blocks. Unlike protocol_state()/interpret_data(), which only ever look at the
     * FIRST block in a reply (the single-block request path never gets more than one), this
     * walks the whole payload using each block's VERIFIED wire length (getVerifiedBlockWireLength()) to
     * find where the next block's id starts. It stops and reports an error as soon as anything
     * looks inconsistent (unknown block id, truncated trailing data) rather than guessing - a
     * misparsed boundary could otherwise silently attribute one block's bytes to another
     * block's fields.
     * @param {string | undefined} version
     * @param {string} data the full received packet (as returned by get_data_packet()),
     *   expected to start with "01F200"
     * @param {(name: string, value: number) => void} [setStateFunction]
     * @returns {{blocks: {block: string, text: string}[], error: string | null}} `blocks` holds
     *   every block successfully parsed before `error` (if any) was hit - a caller may still use
     *   those, but should treat the reply as a whole as unreliable once `error` is set, since
     *   sync may have been lost partway through and any blocks after that point are unparsed.
     */
    parse_multi_block_reply(version, data, setStateFunction) {
        const blocks = [];
        if (!data || data.slice(0, 4) !== '01F2' || data.slice(4, 6) !== '00') {
            return { blocks, error: 'not a multi-block data reply: ' + data };
        }
        let pos = 6;
        while (pos < data.length) {
            if (data.length - pos < 2) {
                return { blocks, error: `${data.length - pos} trailing byte(s) left over - not enough for another block id` };
            }
            const block = data.slice(pos, pos + 2).toUpperCase();
            pos += 2;
            const wireLength = this.getVerifiedBlockWireLength(version, block);
            if (wireLength === null) {
                return { blocks, error: `unknown block id "${block}" at offset ${pos - 2} - lost sync (missing wireLength, or corrupted/misaligned data)` };
            }
            const blockData = data.slice(pos, pos + wireLength * 2);
            if (blockData.length < wireLength * 2) {
                return { blocks, error: `block ${block} truncated (expected ${wireLength} bytes, only ${blockData.length / 2} left in reply)` };
            }
            pos += wireLength * 2;
            const definition = this.getDefinition(version, block);
            const text = definition ? this.parseProtocol(blockData, definition, setStateFunction) : 'unknown block ' + block;
            blocks.push({ block, text });
        }
        return { blocks, error: null };
    }

    create_message(data) {
        let checksum, i;
        const message = new Uint8Array(data.length + 6);
        message[0] = 1;
        i = 1;
        checksum = 0;

        for (let ch, idx = 0; idx < data.length; idx += 1) {
            ch = data[idx];
            message[i] = idm_utils.ord(ch);
            i = i + 1;
            checksum = checksum ^ idm_utils.ord(ch);
        }

        message[i] = 3;
        const checksumText = idm_utils.get_string(checksum);
        message[i + 1] = idm_utils.ord(checksumText[0]);
        message[i + 2] = idm_utils.ord(checksumText[1]);
        message[i + 3] = idm_utils.ord(checksumText[2]);
        message[i + 4] = 4;
        return message;
    }

    create_init_message() {
        return this.create_message('0160');
    }

    create_request_data_block_message(dataBlock) {
        return this.create_message('0171' + dataBlock + '00');
    }

    create_request_data_content_message() {
        return this.create_message('0172');
    }

    create_set_value_message(valueId, value, size, factor) {
        if(factor !== 0) {
            value = value / factor;
        }
        return this.create_message('0161' + idm_utils.get_hex_from_word(valueId) + '01' + idm_utils.get_value_string(value, size));
    }

    reset() {
        this.received_data_packet = '';
        this.receive_state = 0;
        this.receive_chksum = '';
    }

    add_to_packet(received_data) {
        let chksum_c, chksum_r;

        received_data = idm_utils.get_string_uint8array(received_data);
        received_data = this.remaining_data + received_data;
        this.remaining_data = '';

        for (let i = 0; i < received_data.length; i += 1) {
            const ch = received_data[i];

            if (idm_utils.ord(ch) === 1) {
                if (this.receive_state !== 0) {
                    return 11 + this.receive_state * 100;
                }

                this.receive_state = 1;
            } else {
                if (idm_utils.ord(ch) === 3) {
                    if (this.receive_state !== 1) {
                        return 13 + this.receive_state * 100;
                    }

                    this.receive_state = 2;
                } else {
                    if (idm_utils.ord(ch) === 4) {
                        if (this.receive_state == 0) { continue; } // ignore end end of text at the start
                        if (this.receive_state !== 2) {
                            return 14 + this.receive_state * 100;
                        }

                        if (this.receive_chksum.length !== 3) {
                            return 15 + this.receive_state * 100;
                        }

                        chksum_c = idm_utils.calc_checksum(this.received_data_packet);
                        chksum_r = idm_utils.read_val(3, this.receive_chksum);

                        if (chksum_c !== chksum_r) {
                            return 16 + this.receive_state * 100;
                        }

                        this.receive_state = 3;
                        if (i < (received_data.length - 1)) this.remaining_data = received_data.slice(i + 1);
                        return this.receive_state;
                    } else {
                        if (this.receive_state === 1) {
                            this.received_data_packet = this.received_data_packet + ch;
                            if (this.received_data_packet.length > MAX_FRAME_LENGTH) {
                                this.reset();
                                return 500; // frame too long without a terminating ETX - likely line noise
                            }
                        }

                        if (this.receive_state === 2) {
                            this.receive_chksum = this.receive_chksum + ch;
                            if (this.receive_chksum.length > MAX_FRAME_LENGTH) {
                                this.reset();
                                return 501; // checksum too long without a terminating EOT - likely line noise
                            }
                        }

                        if (this.receive_state === 3) {
                            return 20 + this.receive_state * 100;
                        }
                    }
                }
            }
        }

        return this.receive_state;
    }

    get_protocol_string(data) {
        let text = '';
        for (let i = 0; i < data.length; i += 1)
            switch (data[i]) {
                case 1: text = text + '-SOH-'; break;
                case 3: text = text + '-ETX-'; break;
                case 4: text = text + '-EOT-'; break;
                default: text = text + String.fromCharCode(data[i]);
            }
        return text;
    }

    get_data_packet() {
        if (this.receive_state == 3) {
            return this.received_data_packet;
        } else {
            return '';
        }
    }

    protocol_state(data) {
        if (!data || data.length < 4) return 'E0';
        if (data.slice(0, 4) === '01F2') {
            if (data.length >= 6 && data.slice(0, 6) === '01F201') return 'NR'; // data request not ready!
            if (data.length < 8) return 'E1'; // request data error
            if (data.slice(4, 6) !== '00') return 'E2'; // request data - invalid response
            const block = idm_utils.get_byte(data.slice(6, 8));
            return 'Data_block_' + block.toString();
        }
        if (data.slice(0, 4) === '01E0') return 'I1'; // init ok
        if (data.length >= 6) {
            if (data.slice(0, 6) === '01F100') return 'R1'; // request data ok
            if (data.slice(0, 6) === '01E100') return 'S1'; // set value OK
        }
        return 'U1'; // unknown response
    }

    // Calls stateFunction(...) once per named state and collects its return values so
    // callers can `await` completion (stateFunction is typically async, e.g. it creates an
    // ioBroker object). Returns a Promise that resolves once every call has settled.
    mapStatenames(version, stateFunction) {
        const dataBlocks = this.getDataBlocks(version);
        const results = [];
        if (dataBlocks) dataBlocks.forEach(block => {
            const definitions = this.getDefinition(version, block);
            if (definitions) definitions.forEach(definition => {
                if (definition.statename && definition.statename.length > 0)  {
                    results.push(stateFunction(
                        definition.statename,
                        definition.writable,
                        definition.description,
                        definition.function,
                        definition.length,
                        definition.factor,
                        definition.unit,
                        definition.min,
                        definition.max,
                        block));
                }
            });
        });
        return Promise.all(results);
    }

    parseProtocol(data, definition, setStateFunction) {
        let text = '';
        let pos = 0;
        let nextPos = 0;
        //console.log('num entries: ' + definition.length);
        for (let i = 0; i < definition.length; i++) {
            const entry = definition[i];
            nextPos = pos + entry.length * 2;
            //console.log('field: ' + entry.field + ' from pos: ' + pos + ' to pos: ' + nextPos + ' data: ' + data.slice(pos, nextPos));
            if (data.length < nextPos) return text + ' * miss data';
            let valueText = 'ERROR';

            if (entry.length === 1) valueText = idm_utils.get_byte(data.slice(pos,nextPos)).toString();
            if (entry.length === 2) valueText = idm_utils.get_int(data.slice(pos,nextPos)).toString();
            text = text + entry.description + ':' + Number.parseFloat(valueText) * entry.factor + '; ';
            if (setStateFunction && entry.statename && entry.statename.length > 0) {
                setStateFunction(entry.statename, Number.parseFloat(valueText) * entry.factor);
            }
            pos = nextPos;
        }
        if (data.length > nextPos) text = text + ' * add data: ' + data.slice(nextPos);
        return text;

    }

    interpret_data(version, data, setStateFunction) {
        let text;

        if (data.slice(0, 4) === '01E0') {
            // initial response message with version info
            text = 'Version: ' + idm_utils.get_text(data.slice(4));
            return text;
        }

        if (data.slice(0, 6) === '01F100') { // data request response
            return 'dataRequestOk';
        }

        if (data.slice(0, 4) === '01E1') { // data set response
            if (data.slice(4,6) ==='00') {
                return 'setDataOk';
            } else {
                return 'error set data: ' + data.slice(4);
            }
        }

        if (data.slice(0, 4) !== '01F2') { // data block header
            return 'invalid response: ' + data;
        }

        if (data.slice(4, 6) !== '00') {
            return 'error in data response: ' + data;
        }


        const block = idm_utils.get_byte(data.slice(6, 8));
        text = 'B:' + block.toString();

        const definition = this.getDefinition(version, idm_utils.get_hex_from_byte(block));
        if (definition) {
            text = this.parseProtocol(data.slice(8), definition, setStateFunction);
        } else  {
            text = text + ' unknown';
        }
        return text;
    }
}

module.exports = IdmProtocol;
