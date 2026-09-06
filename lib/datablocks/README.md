# Data block definitions

One JSON file per supported control firmware version. The adapter matches the version string
the heat pump reports right after connecting (e.g. `idm701100`, `EVR752101`) against each
file's own `"version"` field - the filename itself is not significant, it's just for humans
browsing this directory.

## Overriding without an adapter update

The adapter instance setting **"Custom data blocks directory"** (`native.dataBlocksDir`) can
point at a directory of your own files with the same shape. A file there whose `"version"`
matches one of the bundled files REPLACES that bundled definition entirely (it is not merged
field-by-field); versions with no matching custom file are unaffected, and a not-yet-supported
version can be added the same way. A file that fails validation, or two files in that directory
claiming the same version, are both rejected with a warning in the adapter's log - the bundled
definition (if any) is kept in that case rather than guessing which one to use.

## File shape

```json
{
    "version": "idm701100",
    "sensorBlocks": ["07", "09", "0A", "0B"],
    "settingsBlocks": ["03", "04", "05", "06", "08"],
    "speed": 100,
    "data_blocks": [
        {
            "block_number": "03",
            "definition": [
                { "statename": "Heizkreis-A.Betriebsart", "field": "betrieb_A", "description": "Betriebsart HK A", "length": 2, "factor": 1, "writable": true, "function": 11, "min": 0, "max": 5 }
            ]
        }
    ]
}
```

* `version` - matched against what the heat pump reports; must be unique among the files being
  loaded together (see above)
* `sensorBlocks` / `settingsBlocks` - which of this version's data blocks are polled as
  fast-changing sensor data vs. slower-changing settings data
* `speed` - percentage of normal polling speed this control can keep up with (100 = normal;
  some versions need to be polled more slowly)
* `data_blocks` - one entry per block number, each with a `definition` array of fields:
  * `statename` - the ioBroker state created for this field (empty for padding/unused positions)
  * `field` - internal field name (only used for debugging/comments)
  * `function` - the register id the multitalent control uses to identify this value; must be
    unique within its data block (checked by validation - a collision has previously caused a
    write meant for one field to land on another, see the 1.2.7 changelog entry)
  * `length` - 1 or 2 bytes on the wire
  * `factor` - raw value is divided/multiplied by this to get/set the real-world value
  * `writable` - whether the adapter subscribes to this state and sends changes back to the heat pump
  * `min` / `max` - optional. When present, a write outside this range is rejected (logged,
    never sent to the heat pump, and the displayed value is reverted) instead of being
    forwarded. **Only add these once you are sure of the correct value for your hardware** -
    this is sent to a live heat pump, and a wrong guess is enforced just as strictly as a
    correct one.

## Known operating-mode enumerations

The protocol itself was reverse-engineered (RS422 sniffing, no official iDM documentation
exists) - see the main README's Developer manual section for sources. The following ranges are
the only ones that could be sourced with confidence, from comments already in the codebase, and
are pre-filled in the bundled files:

* Betriebsart Heizkreis (fields `betrieb_A` / `betrieb_B` / `Betrieb_C` / `Betrieb_D`): 0 =
  Automatik-Betrieb (nach Uhrenprogramm), 1 = Dauer-Nennbetrieb, 2 = Dauer-Sparbetrieb, 3 = aus,
  4 = Konstanttemperaturbetrieb, 5 = Kühlen
* Betriebsart Warmwasser (field `betrieb_WW`): 0 = nach Ladeprogramm, 1 = dauernd ein, 2 =
  dauernd aus
* Heizkreisart (fields `fb_A` / `fb_B` / `FB_C` / `FB_D`): 0 = Heizkoerper, 1 = Fussboden
* Mischervorhanden (fields `A_misch` / `B_misch` / `C_misch` / `D_misch`): 0 = kein Mischer, 1 =
  Mischer, 3 = Mischer (meaning unconfirmed)
* Funktion externer Kontakt (field `telkontakt`): 0 = Betriebsartumschaltung (auf
  Dauernennbetrieb und Freigabe Speicherladung), 1 = direkte WP Steuerung, 2 =
  Rundsteuerempfaenger

Every other writable field in most bundled versions intentionally has no `min`/`max` set, because
no verified hardware range is available.

## Estimated ranges (S_H726100)

`S_H726100.json` additionally has `min`/`max` set on every writable field that isn't already
covered by a known enumeration above - the values above (still hardware-confirmed), plus one more
category below. Unlike those, these are **not** confirmed against the actual control - nobody has
verified them on real hardware for every field, they are plausible ranges (typical setpoint
ranges for this kind of heat pump, e.g. domestic hot water 5-75°C, heating circuit flow
limits 10-90°C, percentages 0-100) with a deliberate margin so a legitimate value is never
rejected, chosen only to catch a value that is obviously wrong (a typo, a unit mix-up, a stray
digit) rather than to enforce the hardware's real limits precisely. If one of them turns out to
be wrong for your installation - too tight (a legitimate value gets rejected) or too loose - use
the **"Custom data blocks directory"** setting (see above) with your own `S_H726100.json`
containing the corrected `min`/`max` for that field; it fully replaces the bundled file, and the
adapter logs which one (bundled or custom) it actually used for the connected version once
connected, so you can confirm your override took effect.
