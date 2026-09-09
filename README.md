![Logo](admin/idm-multitalent_002.png)

**Attention!** 
This is an open source adapter from an individual that is not related to the manufacturer, no warranty or guarantees! 

IDM agreed to the publishing of this work.

***You might loose warranty from the manufacturer!***
# ioBroker.idm-multitalent_002
[![NPM version](https://img.shields.io/npm/v/iobroker.idm-multitalent_002.svg)](https://www.npmjs.com/package/iobroker.idm-multitalent_002)
[![Downloads](https://img.shields.io/npm/dm/iobroker.idm-multitalent_002.svg)](https://www.npmjs.com/package/iobroker.idm-multitalent_002)
![Number of Installations](https://iobroker.live/badges/idm-multitalent_002-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/idm-multitalent_002-stable.svg)
[![NPM](https://nodei.co/npm/iobroker.idm-multitalent_002.png?downloads=true)](https://nodei.co/npm/iobroker.idm-multitalent_002/)

**Tests:** ![Test and Release](https://github.com/zloe/ioBroker.idm-multitalent_002/workflows/Test%20and%20Release/badge.svg)

## idm-multitalent_002 adapter for ioBroker
Read sensor data and read and write settings of a iDM heatpump with multitalent.002 control.

Currently following versions are supported (if your version is not listed but you are interested please contact me):
| SW Name | ID in firmware | status |
| :------ | :------------- | :----- |
| TERRA050701 | idm701 (idm701100) | supported, one installation |
| TERRA061001 | idm712 (idm712100) | supported, one installation |
| EVR-070110 | idm722 (idm722100) | supported, one installation |
| EVR-II071102 | idm750 (idm750100) | experimentally, no known installation, issues with data definitions |
| EVR-II100201 | EVR752 (EVR752101) | support in development currently, one experimental installation |
| TERRA130601 | S_H726 (S_H726100) | supported, one installation |

You need a Ethernet to RS422 converter to connect to the multitalent control.
**Note** that you have to connect ground/shield of your converter to the ground of the control/heatpump in order to prevent electric influences on the sensor readings.
There are sensor values and settings values. During a cycle all sensor values and one part of the settings values are read. So the sensor values are read more frequently than the settings values. 
The changed values are transferred immediately.
Note that settings of the heatpump are only read all ~5-6 cycles, so when setting values the acknowledgment might take some time.

During bootup of the heatpump control (e.g. after a power loss) no values should be polled. This is currently **NOT** ensured by the adapter. So you **manually** need to **stop** it. If the control of the heatpump did not start due to the adapter then simply stop the adapter and power cycle the control. This should fix the problem. Afterwards you can start the adapter again. I implemented a delayed switch-on of the serial server. This also mitigates the problem.

Example installation:

![system overview](resources/idm%20RS422%20Anschluss.drawio.png)

Settings of the serial adapter:
```
 Baud Rate(bps) 19200
 Parity         Even
 Data Bit       8
 Stop Bit       1
 Flow Control   None
 UART FIFO      Disable
```

Example screenshots of objects:
![Heizkreis A](resources/ioBrokerAdapter-HKA.jpg)
![Heizung](resources/ioBrokerAdapter-Heizung.jpg)
![Warmwasser](resources/ioBrokerAdapter-Warmwasser.jpg)
![Status](resources/ioBrokerAdapter-Status.jpg)

## Changelog
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

## Installation
As the adapter is not (yet) listed in the official ioBroker repository, install it through the Admin UI rather than a direct npm command:
1. In ioBroker Admin, go to **Adapters** and click the **"+" (custom install from URL)** icon in the top right
1. Paste `https://github.com/zloe/ioBroker.idm-multitalent_002` (or, for a specific released version, `iobroker.idm-multitalent_002@x.y.z`) into the field and confirm
1. Once installed, add an instance as usual and configure it

## Developer manual
The serial protocol itself was reverse-engineered (RS422 sniffing, no official iDM documentation exists) mainly by user "makki" in the [KNX-User-Forum "idm Wärmepumpe" thread](https://knx-user-forum.de/forum/%C3%B6ffentlicher-bereich/knx-eib-forum/1251-idm-w%C3%A4rmepumpe) and refined further here; see also the [ioBroker adapter thread](https://forum.iobroker.net/topic/54253/test-adapter-idm-multitalent_002). Neither source documents official min/max limits for the writable values (see below) - they only cover which register a value lives in and how it is encoded.

### Data block definitions
The register/data-block layout for every supported control version (which fields exist, at which position, with which factor/length, and whether they may be written) lives in one JSON file per firmware version under [`lib/datablocks/`](lib/datablocks/) (e.g. `idm701100.json`), **not** in the adapter's code - `lib/idm_datablocks.js` only loads, matches and validates them. See [`lib/datablocks/README.md`](lib/datablocks/README.md) for the full file format and the (few) known min/max ranges.

### Architecture
`main.js` only wires the adapter lifecycle (config, ioBroker objects/states) together; the actual
TCP connection and the request/response state machine that talks to the control (connect/
reconnect, sending init/data-block/data-content/set-value messages at the delays it needs,
retrying, recovering from a dropped connection or an unexpected reply) live in
[`lib/idm-session.js`](lib/idm-session.js) (`IdmSession`), which knows nothing about ioBroker
itself - it reports what happened through a small set of hooks instead, so it can be (and is,
see `lib/idm-session.test.js`) unit-tested without an adapter instance. `lib/idm-protocol.js`
(`IdmProtocol`) below that builds/parses the wire messages and holds the loaded data block
definitions (see below); `lib/idm-utils.js` has the low-level byte/hex helpers both use. Each
adapter instance creates its own `IdmProtocol` and `IdmSession` - see the comment at the top of
either class for why they must not be shared between instances running in the same process
(ioBroker "compact mode").

`IdmSession` also arms a short response timeout after every request it sends and resets the
connection if nothing valid comes back in time, instead of relying only on the much coarser
per-`reconnectinterval` silence watchdog - so a single dropped reply is now noticed and
recovered from in seconds rather than potentially up to a whole `reconnectinterval`.

After a data block request is acknowledged, the control needs a bit of time before its content is
actually ready - too short a wait gets an "NR" (not ready) reply, costing a retry. That time isn't
the same for every data block, so instead of one fixed guess for all of them, `IdmSession`
hill-climbs a per-block delay: a cycle that needed a retry grows that block's delay a little
(capped); several consecutive cycles that didn't need one ease it back down a little - but never
below the original fixed default, which is a hard floor, not just a starting point. This
deliberately isn't based on how long a cycle actually took (that's mostly just however long we
ourselves chose to wait before asking, so it could only ever justify growing the delay, never
discovering a shorter one would also work) - only on whether a retry was actually needed, so the
delay for a block can also come back down over time instead of only ratcheting upward, converging
on the actual sweet spot rather than trading unlimited retries for an unbounded wait, or the
reverse. The ease-down step itself starts coarse (100ms) and halves every time it's used, down to a
1ms floor - a block gets found in its rough neighborhood quickly, then refined ever more finely the
longer it stays stable, instead of only ever landing on multiples of 100ms. A retry resets that
block's step back to the coarse starting point, since it just proved the fine-tuning that led there
wrong. See `contentDelayForCurrentBlock()`/`updateContentDelayEstimate()` and the "adaptive
per-data-block content delay" tests in `lib/idm-session.test.js`.

`IdmSession` also logs how long a full-coverage cycle actually took, once the next one completes
(there is nothing to compare the very first cycle against yet) - every sensor block *and* every
settings block actually read at least once, gated by the settings side since the sensor blocks are
already re-read on every single sweep (only one settings block is requested per sweep, round-robin
- see `request_data()`). This is driven by data actually being *received* (`recordBlockRead()`,
called from `receive_data()`'s successful-data branch), not merely requested - a block that was
requested but never got a reply back (a retry, a response-watchdog reset, the periodic resync) does
not count, so the log only ever fires once every block has genuinely been read. It also carries a
running total of how many full-coverage cycles have completed since the adapter started (not
persisted across restarts) - together with the elapsed time, that's the overall effect of all the
delays above added together, so it's what actually shows whether a change to them made polling
faster or slower. (An earlier, more frequent "one full poll cycle" line - logged every single
sensor sweep - was dropped as too noisy; only this line remains.)

### Overriding the data blocks without an adapter update
The instance setting **"Custom data blocks directory"** (`native.dataBlocksDir`) can point at a directory of your own such files. Each file's `"version"` field is matched against the version string the heat pump reports after connecting - a match REPLACES that version's bundled definition entirely (it is not merged field-by-field), useful for adding min/max limits you have verified for your own installation, fixing a field, or adding a not-yet-supported control version, all without reinstalling or upgrading the adapter. Versions with no matching (and valid) custom file keep using their bundled definition. A file that fails validation, or two files claiming the same version, are both rejected with a warning in the adapter's log - the bundled definition (if any) is kept in that case.

Attention, still experimental, ... the adapter sets values of the heatpump, so do not install, unless you know what you are doing and have contacted the author! 

## License
MIT License

Copyright (c) 2026 zloe <klaus@zloebl.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
