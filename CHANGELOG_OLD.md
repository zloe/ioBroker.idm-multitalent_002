# Older changes

### 1.3.10 (2026-09-09)
* (zloe) fix: a retry on an already finely-tuned data block used to always jump its delay up by the full, coarse step (300ms) regardless of how small a correction was actually needed - now it corrects by the same (possibly already tiny) step that tuning had converged to, and only doubles that step towards the coarse ceiling if retries actually keep recurring

### 1.3.9 (2026-09-09)
* (zloe) list every data block's current content delay in the full-coverage cycle log line, so a change in total cycle time can be traced back to which block(s) grew
* (zloe) the adaptive per-block content delay's ease-down step now starts coarse (100ms) and halves each time it's used (down to a 1ms floor), instead of always easing by a flat 100ms - a block that's been stable for a while gets refined much more finely, converging near its true minimum safe delay instead of only ever landing on multiples of 100ms. A retry resets a block's step back to the coarse starting point

### 1.3.8 (2026-09-09)
* (zloe) remove the "completed one full poll cycle (every sensor block + one settings block)" log line entirely - it fired every single sensor sweep (~14s on real hardware), far too often to be useful. Only the full-coverage cycle line (every sensor and settings block actually read at least once, confirmed correct against real production logs) remains

### 1.3.7 (2026-09-08)
* (zloe) fix: the full-coverage cycle log line still fired far too often on real hardware - it was gated by the settings-block round-robin index advancing at *request* time, not by data actually being read, so a retry, a response-watchdog reset, or the periodic resync could let a "lap" complete without every block truly having been read. Now gated by actual received data instead

### 1.3.6 (2026-09-08)
* (zloe) shorten the full-coverage cycle log line to `full-coverage cycle #N done in Xms` - same information (elapsed time, running total), just without the long parenthetical explanation
* (zloe) fix three `npm run check` (typescript) errors surfaced by the typescript 7 / axios 1.20 / @types/sinon 22 updates, without changing any runtime behavior

### 1.3.5 (2026-09-08)
* (zloe) hotfix: 1.3.4's CI run failed on Node 20 - `engines: ">=22"` and testing on Node 20 at the same time don't work together, npm install fails with EBADENGINE. Drop Node 20 from the CI test matrix again (keeping the >=22 requirement); this reintroduces one repository-checker item (E3025) that directly conflicts with another (E0028) - can't satisfy both

### 1.3.4 (2026-09-08)
* (zloe) rename/rework the second cycle-timing log line: it's now explicitly about every data block (sensor and settings) having been read at least once, not just the settings side, and it now also reports a running total of how many full-coverage cycles have completed
* (zloe) address most of the ioBroker repository checker's findings from #349: raise the minimum Node.js version to 22, bump the required admin/js-controller versions, add missing translations, trim the in-admin news list to real, published versions, switch built-in module imports to the `node:` form, add the missing release-script plugins, tidy up CI/dependabot config, and rewrite the README's installation section to stop suggesting a direct `npm install` (see below for the couple of checker items intentionally left alone)

### 1.3.3 (2026-09-08)
* (zloe) shorten the recurring per-data-block request log line (data block 07) to one compact line with the same information
* (zloe) also log how long a full settings cycle (every settings block once, not just the one per sweep) takes, once the next one starts

### 1.3.2 (2026-09-08)
* (zloe) replace the per-data-block content delay's averaging with a proper hill-climb: it now only grows when a "not ready" retry was actually needed and eases back down after several clean cycles, converging on a sweet spot instead of only ever ratcheting upward
* (zloe) lower the default/floor data-content delay from 1000ms to 650ms
* (zloe) log how long one full poll cycle (every sensor block plus one settings block) actually takes, once the next cycle starts

### 1.3.1 (2026-09-08)
* (zloe) log which firmware versions have a data block definition available, and which one (bundled or a custom override) was actually selected once the heat pump reports its version
* (zloe) add estimated min/max write limits for every remaining writable S_H726100 field (temperature setpoints, cooling settings, two on/off flags, pump speed) - conservative, margin-padded ranges, not hardware-verified for every field, see lib/datablocks/README.md
* (zloe) learn a per-data-block delay before requesting its content instead of one fixed guess for all of them, reducing "not ready" retries over time (see the Architecture section)

### 1.3.0 (2026-09-06)
* (zloe) move the hardware data block definitions out of the code into one JSON file per firmware version (lib/datablocks/), validated at load time
* (zloe) enforce configured min/max limits when writing a value to the heatpump, reverting the displayed value if a write is rejected
* (zloe) support a directory of custom data block files (one per firmware version, matched by their own version field, not the filename) to override or add definitions without an adapter update - see lib/datablocks/README.md
* (zloe) fix a bug where the per-version speed adjustment (e.g. idm722100's 75%) never actually took effect
* (zloe) give every adapter instance its own protocol/connection state instead of a shared module-level singleton, fixing multi-instance ("compact mode") safety
* (zloe) extract the TCP connection and request/response state machine out of main.js into its own class (lib/idm-session.js)
* (zloe) add a short per-request response timeout and a frame-length cap, so a dropped reply or a garbled byte stream is recovered from in seconds instead of stalling
* (zloe) translate the admin config screen and fill in missing changelog translations (previously English-only outside of a few fields)

### 1.2.9 (2026-09-05)
* (zloe) switch npm deploy from the retired classic npm token to Trusted Publishing (OIDC) - both 1.2.7 and 1.2.8 failed to publish to npm because of this

### 1.2.8 (2026-09-05)
* (zloe) fix repository checker issues (#298): add engines.node, German news translations, correct js-controller/admin dependency versions, add missing tier/licenseInformation, remove deprecated common.main/title, fix broken vscode schema link
* (zloe) add .releaseconfig.json so io-package.json's version is kept in sync automatically on release
* (zloe) fix broken `npm run lint` (missing @eslint/js dependency)

### 1.2.7 (2026-09-05)
* (zloe) fix broken test/lint toolchain (incompatible chai/sinon-chai/chai-as-promised versions, outdated tsconfig moduleResolution)
* (zloe) fix three duplicate `function` numbers in data block definitions that could have targeted the wrong register once made writable
* (zloe) clear all pending communication timers on adapter unload, not just reconnect/resend
* (zloe) remove unused imports, clear the default TCP server IP placeholder
* (zloe) add real unit tests for idm-utils and the main.js communication state machine

### 1.2.6 (2024-09-21)
* (zloe) fixed reconnect handling

### 1.2.5 (2024-01-21)
* (zloe) further fixes in error handling

### 1.2.4 (2024-01-21)
* (zloe) further improve logging and handling of transmission errors

### 1.2.3 (2024-01-21)
* (zloe) improve handling of data transmission problems

### 1.2.2 (2024-01-21)
* (zloe) fix handling of data transmission problems which lead to stopping requesting data

### 1.2.1 (2024-01-20)
* (zloe) improving statistics and log messages
* (zloe) fix data definition for idm722100

### 1.2.0 (2024-01-19)
* (zloe) adding support for idm722100

### 1.1.1 (2023-11-04)
* (zloe) optimizing protocol
* (zloe) updated dependencies

### 1.1.0 (2023-11-02)
* (zloe) initial version TERRA130601 - S_H726100 support
* (zloe) updated dependencies
