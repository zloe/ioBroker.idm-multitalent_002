const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const idm_p = require('./idm-protocol');
const idm_u = require('./idm-utils');

describe('idm-protocol', () => {

    before(() => {
        idm_p.initialize();
    });

    // All control versions this adapter currently ships definitions for (see README.md).
    const versions = ['idm701100', 'idm712100', 'idm722100', 'S_H726100', 'idm750100', 'EVR752101'];

    describe('data block definitions', () => {

        it('defines at least one data block for every supported control version', () => {
            for (const version of versions) {
                const blocks = idm_p.getDataBlocks(version);
                expect(blocks, version).to.be.an('array').that.is.not.empty;
            }
        });

        it('gives every named field within a data block a distinct write "function" id', () => {
            // Regression test for a class of copy/paste bug found (and fixed) in
            // idm_datablocks.js: several fields pointed at the same "function" id as another
            // field in the same block. That id is what tells the heatpump which register to
            // write to, so a collision would (if either field is ever made writable) send a
            // value to the wrong physical parameter. -1 is the established "no function /
            // read-only position, not identified yet" marker and is intentionally excluded.
            for (const version of versions) {
                const blocks = idm_p.getDataBlocks(version);
                if (!blocks) continue;
                for (const block of blocks) {
                    const definition = idm_p.getDefinition(version, block);
                    if (!definition) continue;
                    const seen = new Map();
                    for (const entry of definition) {
                        if (entry.function === -1) continue;
                        const clash = seen.get(entry.function);
                        expect(clash, version + ' block ' + block + ': function ' + entry.function +
                            ' used by both "' + clash + '" and "' + entry.description + '"').to.be.undefined;
                        seen.set(entry.function, entry.description);
                    }
                }
            }
        });

        it('gives every field a field name, a description and a valid length', () => {
            for (const version of versions) {
                const blocks = idm_p.getDataBlocks(version);
                if (!blocks) continue;
                for (const block of blocks) {
                    const definition = idm_p.getDefinition(version, block);
                    if (!definition) continue;
                    for (const entry of definition) {
                        const where = version + ' block ' + block + ' field ' + entry.field;
                        expect(entry.field, where).to.be.a('string');
                        expect(entry.description, where).to.be.a('string');
                        expect(entry.length, where).to.be.oneOf([1, 2]);
                    }
                }
            }
        });
    });

    describe('parsing real captured data blocks (regression snapshots)', () => {
        // These payloads are real data blocks captured from running heatpumps (see the
        // project README for the supported hardware and installation counts). There is no
        // independent protocol specification available to verify every field against, so
        // these tests pin down parseProtocol()'s *current* output as a regression baseline:
        // if a future change to the parsing logic or a data block definition alters what
        // comes out of one of these captures, this will fail and the change needs a
        // deliberate look, rather than silently shipping a different reading of the same
        // bytes to someone's real heatpump.
        function expectParse(version, block, data, expectedText) {
            const definition = idm_p.getDefinition(version, block);
            expect(definition, version + ' block ' + block + ' has no definition').to.not.be.null;
            expect(idm_p.parseProtocol(data, definition)).to.equal(expectedText);
        }

        function expectNoDefinition(version, block) {
            // Documents a currently-known gap (no field definition exists yet for this
            // block/version) instead of silently skipping it.
            expect(idm_p.getDefinition(version, block)).to.be.null;
        }

        it('idm701100', () => {
            expectParse('idm701100', '03', '00002D001300010F00000001000A000B27010005001C0200000A00000000', 'padding:0; Warmwasser-Sollwert:45; Sommer-Winter-Umsch.:19; autom. WP Zuschaltung:1; WP Zuschaltzeit:15; Notbetrieb:0; Bad-Sommerbetrieb:0; Schichttrennplatte:1; Laufzeit Zirkulation:10; min. Drehzahl HZK-Pumpe:9995; Puffer vorhanden:1; unbekannt:5; gew. HGL-Temperatur:54; Funktion ext. Kontakt:0; Restzeit?:10;  * add data: 000000');
            expectParse('idm701100', '04', '0000000400150014000102002D000100140032000100030A0000FA000500012800', 'padding:0; Frostschutz A:0; Kennlinie HK A:4; Nenntemp HK A:21; Spartemp HK A:20; Art HK A:1; Betriebsart HK A:2; Maxtemp HK A:45; Raumeinfluss HK A:1; Betriebsart Warmwasser:0; Mintemp HK A:20; Anteil Raumeinfluss A:50; Raumeinfluss A von:1; Raumeinfluss A auf:0; HK A mit Mischer:3; max Spreizung:10; Schnellabsenkung A:0; padding2:250; Absenkfaktor A:5; padding4:1; Konstanttemp A:40; ');
            expectParse('idm701100', '05', '000000012D000200120010000300000A00640002000500001E000600FA00', 'padding:0; Frostschutz B:0; Art HK B:1; Maximaltemp HK B:45; Kennlinie HK B:2; Nenntemp HK B:18; Spartemp HK B:16; Betriebsart HK B:3; Raumeinfluss HK B:0; Minimaltemp HK B:10; Anteil Raumeinfluss B:100; Raumeinfluss B von:2; Raumeinfluss B auf:0; Absenkfaktor B:5; HK B mit Mischer:0; Konstanttemp B:30; Schnellabsenkung B:6;  * add data: 00FA00');
            expectParse('idm701100', '06', '00000101020039000A000A00ECFFECFF12000002001E0000001200', 'padding:0; WP-Freigabe:1; wp?:1; WP Schaltdifferenz:2; WP Maximaltemp.:57; min. WP Laufzeit:10; min. WP Stehzeit:10; min. Solewarnung:-20; min. Solealarm:-20; min Soletemp:18; WP-Freigabe Kunde:0; Ueberhoehung Stromsperrung:2; Vorverlegezeit Stromsperrung:30; padding2:0; padding3:0; padding4:18;  * add data: 00');
            expectParse('idm701100', '07', '00000000000000000000000000000000000000000B270000000000000000', 'padding:0; padding2:0; Relais1 Solepumpe:0; Relais2 WP Stufe 1:0; Relais3 Mischer A - auf:0; Relais4 Mischer A - zu:0; Relais5 WP Stufe 2:0; Relais6 Pumpe Heizkreis B:0; Relais7 Mischer B - auf:0; Relais8 Mischer B - zu:0; Relais9 Kühlventil:0; Relais10 HG-Mischer - auf:0; Relais11 HG-Mischer - zu:0; Relais12 Zirkulationspumpe:0; Relais13 Störmeldeausgang:0; Triac Plattentauscherpumpe:0; Triac Ladepumpe:0; Triac Pumpe Heizkreis A:9995; Störung Übertemperatur:0; padding3:0; padding4:0; Telefonkontakt:0;  * add data: 000000');
            expectParse('idm701100', '08', '0000B80B', 'padding:0; min. Drehzahl Ladepumpe:3000; ');
            expectParse('idm701100', '09', '00001727130D02E607', 'padding:0; Sekunde:23; Minute:39; Stunde:19; Tag:13; Monat:2; Jahr:2022; ');
            expectParse('idm701100', '0A', '0000000031001E0019000A001F001A00F0000000190000001E0042010000', 'padding:0; Außentemperatur:0; Zapftemperatur:49; Speichertemperatur:30; Soll-Vorlauf A:25; Soll-Vorlauf B:10; WP-Vorlauf:31; WP-Rücklauf:26; Raumtemperatur A:24; Raumtemperatur B:0; Vorlauf Heizkreis A:25; Vorlauf Heizkreis B:0; WP_Temp2?:30; HG-Temperatur:32.2; Sole-Austrittstemp.:0; ');
            expectParse('idm701100', '0B', '0000000000000000000000000000', 'padding:0; Sommerbetrieb:0; Störung Fühlerdefekt:0; error1?:0; Hochdruckstörung:0; Niederdruckstörung:0; Störung Thermorelais:0; Störung Sole zu kalt:0; Störung Verhältnis Std/Imp:0; Störung Spreizung zu hoch:0; Sperrzeit:0; Kühlfuntion:0; Vorrangschaltung:0; ');
        });

        it('EVR752101', () => {
            expectParse('EVR752101', '03', '000030000D000114000000010B2701000200080202000000', 'padding:0; Warmwasser-Sollwert:48; Sommer-Winter-Umsch.:13; autom. Zuschaltung:1; Zuschaltzeit:20; Notbetrieb:0; Bad-Sommerbetrieb:0; WP-Freigabe Kunde:1; min. Drehzahl HZK-Pumpe:9995; Schichttrennplatte:1; Puffer vorhanden:0; Laufzeit Zirkulation:2; gew. HGL-Temperatur:52; Funktion ext. Kontakt:2;  * add data: 0000');
            expectParse('EVR752101', '04', '00000104001800140001000030000000190064000203030A0001050000200001010000030003000303000005000500010100001E001E00320032000A000A00100010006400640002020A000A0014001400', 'padding:0; Frostschutz:1; Kennlinie:4; Nenntemperatur:24; Spartemperatur:20; Art des Heizkreises:1; Betriebsart:0; Maximaltemperatur:48; Raumeinfluss:0; Betriebsart Warmwasser:0; Minimaltemperatur:25; Anteil Raumeinfluss:100; Raumeinfluss von:2; Raumeinfluss auf:3; Raumeinfluss auf:3; irgendwas:10; mit Mischer:1; Absenkfaktor:5; Schnellabsenkung:0; Konstanttemperatur:32; mit Mischer:1; mit Mischer:1; Schnellabsenkung:0; Schnellabsenkung:0; Betriebsart:3; Betriebsart:3; Raumeinfluss auf:3; Raumeinfluss auf:3; Raumeinfluss:0; Raumeinfluss:0; Absenkfaktor:5; Absenkfaktor:5; Art des Heizkreises:1; Art des Heizkreises:1; Frostschutz:0; Frostschutz:0; Konstanttemperatur:30; Konstanttemperatur:30; Maximaltemperatur:50; Maximaltemperatur:50; Minimaltemperatur:10; Minimaltemperatur:10; Spartemperatur:16; Spartemperatur:16; Anteil Raumeinfluss:100; Anteil Raumeinfluss:100; Raumeinfluss von:2; Raumeinfluss von:2; Kennlinie:10; Kennlinie:10; Nenntemperatur:20; Nenntemperatur:20; ');
            expectParse('EVR752101', '05', '0000000132000A00140010000300000A00640002010500001E00', 'padding:0; Frostschutz B:0; Art HK B:1; Maximaltemp HK B:50; Kennlinie HK B:10; Nenntemp HK B:20; Spartemp HK B:16; Betriebsart HK B:3; Raumeinfluss HK B:0; Minimaltemp HK B:10; Anteil Raumeinfluss B:100; Raumeinfluss B von:2; HK B mit Mischer:1; Absenkfaktor B:5; Schnellabsenkung B:0; Konstanttemp B:30; ');
            expectParse('EVR752101', '06', '00000101040039000A000A000002001E000000', 'padding:0; WP-Freigabe:1; padding:1; WP Schaltdifferenz:4; WP Maximaltemp.:57; min. WP Laufzeit:10; min. WP Stehzeit:10; padding:0; min. Solewarnung:2; min. Solealarm:30;  * add data: 0000');
            expectParse('EVR752101', '07', '00000000000000000000000000000000000000000B2700000000010000000000000000', 'padding:0; padding:0; Solepumpe:0; WP Stufe 1:0; Mischer A - auf:0; Mischer A - zu:0; Prozessumkehr:0; Pumpe Heizkreis B:0; Mischer B - auf:0; Mischer B - zu:0; Kühlventil:0; HG-Mischer - auf:0; HG-Mischer - zu:0; Zirkulationspumpe:0; Störmeldeausgang:0; Plattentauscherpumpe:0; Ladepumpe:0; Pumpe Heizkreis A:9995; Übertemperatur:0; Telefonkontakt:0;  * add data: 0000010000000000000000');
            expectNoDefinition('EVR752101', '08');
            expectParse('EVR752101', '09', '000023000A0014001E00B400280A65000000', 'padding:0; v1:35; v2:10; v3:20; v4:30; v5:180; min. Drehzahl Ladepumpe:2600; v6:101;  * add data: 0000');
            expectNoDefinition('EVR752101', '0A');
            expectParse('EVR752101', '0B', '0000280078002D0000000000620C22025F0800', 'padding:0; Soll-Überhitzung:4; Zykluszeit:120; Startöffnung:45; Fehler Schrittmotor:0; Freigabe Kompressor:0; Position E-Ventil:0; Sauggastemperatur:31.7; Sauggasdruck:54.6; Ist-Überhitzung:21.43;  * add data: 00');
            expectParse('EVR752101', '0C', '000037280C0105E707', 'padding:0; Sekunde:55; Minute:40; Stunde:12; Tag:1; Monat:5; Jahr:2023; ');
            expectParse('EVR752101', '0D', '00000B003000300019000A002A00260000000000190000002000C401000000000A000A0014001400', 'padding:0; Außentemperatur:11; Zapftemperatur:48; Speichertemperatur:48; Soll-Vorlauf A:25; Soll-Vorlauf B:10; WP-Vorlauf:42; WP-Rücklauf:38; Raumtemperatur A:0; Raumtemperatur B:0; Vorlauf Heizkreis A:25; Vorlauf Heizkreis B:0; Sole-Austrittstemp.:32; HG-Temperatur:45.2;  * add data: 000000000A000A0014001400');
            expectParse('EVR752101', '0E', '000000000000000000000000000000', 'padding:0; Sommerbetrieb:0; Fühlerdefekt:0; Hochdruckstörung:0; Niederdruckstörung:0; Thermorelaisstörung:0; Sole zu kalt:0; Verhältnis Std/Imp:0; Spreizung zu hoch:0; Sperrzeit:0; Kühlfuntion:0; Vorrangschaltung:0;  * add data: 0000');
        });

        it('S_H726100', () => {
            expectParse('S_H726100', '03', '00002E001200010F00000001000B2701000100260200000000000000', 'padding:0; Warmwasser-Sollwert:46; Sommer-Winter-Umsch.:18; autom. WP Zuschaltung:1; WP Zuschaltzeit:15; Notbetrieb:0; Bad-Sommerbetrieb:0; Schichttrennplatte:1; min. Drehzahl HZK-Pumpe:9995; Puffer vorhanden:1; Laufzeit Zirkulation:1; gew. HGL-Temperatur:55; Funktion ext. Kontakt:0; Restzeit?:0;  * add data: 000000');
            expectParse('S_H726100', '04', '0000010400150013000102002D00010012002D000100030A0001FA0005000014000101000003000300FA00FA000001000005000500010100001E001E00320032000A000A00100010006400640001010A000A0014001400', 'padding:0; Frostschutz:1; Kennlinie:4; Nenntemperatur:21; Spartemperatur:19; Art des Heizkreises:1; Betriebsart:2; Maximaltemperatur:45; Raumeinfluss:1; Betriebsart Warmwasser:0; Minimaltemperatur:18; Anteil Raumeinfluss:45; Raumeinfluss von:1; Raumeinfluss auf:0; mit Mischer A:3; padding2:10; passing3:1; padding4:250; Absenkfaktor A:5; padding5:0; Schnellabsenkung A:0; Konstanttemperatur A:20; mit Mischer C:1; mit Mischer D:1; Schnellabsenkung C:0; Schnellabsenkung D:0; Betriebsart C:3; Betriebsart D:3; padding6:250; Raumeinfluss auf C:0; padding7:250; Raumeinfluss auf D:0; padding8:256; Raumeinfluss C:0; Raumeinfluss D:0; Absenkfaktor C:5; Absenkfaktor D:5; Art des Heizkreises C:1; Art des Heizkreises D:1; Frostschutz C:0; Frostschutz D:0; Konstanttemperatur C:30; Konstanttemperatur D:30; Maximaltemperatur C:50; Maximaltemperatur D:50; Minimaltemperatur C:10; Minimaltemperatur D:10; Spartemperatur C:16; Spartemperatur D:16; Anteil Raumeinfluss C:100; Anteil Raumeinfluss D:100; Raumeinfluss von C:1; Raumeinfluss von D:1; Kennlinie C:10; Kennlinie D:10; Nenntemperatur C:20; Nenntemperatur D:20; ');
            expectParse('S_H726100', '05', '0000000132000A00140010000300000A00640002010500001E000600FA00', 'padding:0; Frostschutz B:0; Art HK B:1; Maximaltemp HK B:50; Kennlinie HK B:10; Nenntemp HK B:20; Spartemp HK B:16; Betriebsart HK B:3; Raumeinfluss HK B:0; Minimaltemp HK B:10; Anteil Raumeinfluss B:100; Raumeinfluss B von:2; Raumeinfluss B auf:1; Absenkfaktor B:5; HK B mit Mischer:0; Konstanttemp B:30; Schnellabsenkung B:6;  * add data: 00FA00');
            expectParse('S_H726100', '06', '00000101040039000A000A00F1FFEEFF0002001E000000', 'padding:0; WP-Freigabe:1; wp?:1; WP Schaltdifferenz:4; WP Maximaltemp.:57; min. WP Laufzeit:10; min. WP Stehzeit:10; min. Solewarnung:-15; min. Solealarm:-18; min Soletemp:512; WP-Freigabe Kunde:0; Ueberhoehung Stromsperrung:30; Vorverlegezeit Stromsperrung:0;  * add data: 00');
            expectParse('S_H726100', '07', '000000000000000000000000000000000000000000000000000001000000000000000000', 'padding:0; padding2:0; Relais1 Solepumpe:0; Relais2 WP Stufe 1:0; Relais3 Mischer A - auf:0; Relais4 Mischer A - zu:0; Relais5 WP Stufe 2:0; Relais6 Pumpe Heizkreis B:0; Relais7 Mischer B - auf:0; Relais8 Mischer B - zu:0; Relais9 Kühlventil:0; Relais10 HG-Mischer - auf:0; Relais11 HG-Mischer - zu:0; Relais12 Zirkulationspumpe:0; Relais13 Störmeldeausgang:0; Triac Plattentauscherpumpe:0; Triac Ladepumpe:0; Triac Pumpe Heizkreis A:0; Störung Übertemperatur:0; padding3:0; padding4:0; Telefonkontakt:1;  * add data: 000000000000000000');
            expectParse('S_H726100', '08', '00000A001200000000001200120012000A000A000A0023000A0014001E00B400C4096400', 'padding:0; Kühlung freigegeben A:10; padding2:0; Raumtemp. Kühl A:1.8; Schaltdiff. Kühlung A:0; min. Kühlkreistemp A:0; Raumtemp. Kühl B:1.8; min. Kühlkreistemp B:18; Schaltdiff. Kühlung B:1.8; padding3:10; padding4:10; padding5:10; Integralanteil:35; Differentialanteil:10; Proportionalanteil:20; Vorhaltezeit:30; Nachstellzeit:180; minimale Drehzahl:2500; Deviation:100; ');
            expectParse('S_H726100', '09', '0000D80E', 'padding:0; min. Drehzahl Ladepumpe:3800; ');
            expectParse('S_H726100', '0A', '000000002D00', 'padding:0; padding2:0; max. Temp when direct control with external contact:45; ');
            expectParse('S_H726100', '0B', '000001002D270A020BE707', 'padding:0; padding:1; Sekunde:45; Minute:39; Stunde:10; Tag:2; Monat:11; Jahr:2023; ');
            expectParse('S_H726100', '0C', '00000E003000300015000A001D001C00D30000001C0019001E00D0010000000000000A000A0000000000', 'padding:0; Außentemperatur:14; Zapftemperatur:48; Speichertemperatur:48; Soll-Vorlauf A:21; Soll-Vorlauf B:10; WP-Vorlauf:29; WP-Rücklauf:28; Raumtemperatur A:21.1; Raumtemperatur B:0; Vorlauf Heizkreis A:28; Vorlauf Heizkreis B:25; WP_Temp2?:30; HG-Temperatur:46.400000000000006; Sole-Austrittstemp.:0;  * add data: 000000000A000A0000000000');
            expectParse('S_H726100', '0D', '0000000000000000000000000000', 'padding:0; Sommerbetrieb:0; Fühlerdefekt:0; Hochdruckstörung:0; Niederdruckstörung:0; Thermorelaisstörung:0; Sole zu kalt:0; Verhältnis Std/Imp:0; Spreizung zu hoch:0; Sperrzeit:0; Kühlfuntion:0; Vorrangschaltung:0;  * add data: 00');
        });

        it('idm722100', () => {
            expectParse('idm722100', '03', '0000300014000105000000010B2701000000', 'padding:0; Warmwasser-Sollwert:48; Sommer-Winter-Umsch.:20; autom. WP Zuschaltung:1; WP Zuschaltzeit:5; Notbetrieb:0; Bad-Sommerbetrieb:0; Schichttrennplatte:1; min. Drehzahl HZK-Pumpe:9995; Puffer vorhanden:1; padding2:0; padding3:0; ');
            expectParse('idm722100', '04', '0000000700180010000004002D0000001E00640002000A0001050000280000', 'padding:0; Frostschutz A:0; Kennlinie HK A:7; Nenntemp HK A:24; Spartemp HK A:16; Art HK A:0; Betriebsart HK A:4; Maxtemp HK A:45; Raumeinfluss HK A:0; Betriebsart Warmwasser:0; Mintemp HK A:30; Anteil Raumeinfluss A:100; Raumeinfluss A von:2; Raumeinfluss A auf:0; padding2:10; HK A mit Mischer:1; Absenkfaktor A:5; Schnellabsenkung A:0; Konstanttemp A:40;  * add data: 00');
            expectParse('idm722100', '05', '000000011E00050017001000040000170064000201010500001C00', 'padding:0; Frostschutz B:0; Art HK B:1; Maximaltemp HK B:30; Kennlinie HK B:5; Nenntemp HK B:23; Spartemp HK B:16; Betriebsart HK B:4; Raumeinfluss HK B:0; Minimaltemp HK B:23; Anteil Raumeinfluss B:100; Raumeinfluss B von:2; Raumeinfluss B auf:1; HK B mit Mischer:1; Absenkfaktor B:5; Schnellabsenkung B:0; Konstanttemp B:28; ');
            expectParse('idm722100', '06', '000001010400370005000A00F4FFF1FF00060002001E0000000103000000050001001E0028000A0010006400020A001400', 'padding:0; WP-Freigabe:1; wp?:1; WP Schaltdifferenz:4; WP Maximaltemp.:55; min. WP Laufzeit:5; min. WP Stehzeit:10; min. Solewarnung:-12; min. Solealarm:-15;  * add data: 00060002001E0000000103000000050001001E0028000A0010006400020A001400');
            expectParse('idm722100', '07', '000000010101000000000000000000000000102710270100000000000000010000000000', 'padding:0; padding:0; Relais1 Solepumpe:1; Relais2 WP Stufe 1:1; Relais3 Mischer A - auf:1; Relais4 Mischer A - zu:0; Relais5 WP Stufe 2:0; Relais6 Pumpe Heizkreis B:0; Relais7 Mischer B - auf:0; Relais8 Mischer B - zu:0; Relais9 Kühlventil:0; Relais10 HG-Mischer - auf:0; Relais11 HG-Mischer - zu:0; Relais12 Zirkulationspumpe:0; Relais13 Störmeldeausgang:0; Triac Plattentauscherpumpe:0; Triac Ladepumpe:10000; Triac Pumpe Heizkreis A:10000; Störung Übertemperatur:1; padding3:0; padding4:0; Telefonkontakt:0;  * add data: 000000010000000000');
            expectParse('idm722100', '08', '000001001C0200004B00', 'padding:0;  * add data: 01001C0200004B00');
            expectParse('idm722100', '09', '0000F00A', 'padding:0; min. Drehzahl Ladepumpe:2800; ');
            expectParse('idm722100', '0A', '000023000A001E00C4096400', 'padding:0; Bivalentzuschaltung:35; Zuschalttemp.-/zeit:10; Bivalentbetriebsart:30;  * add data: C4096400');
            expectParse('idm722100', '0B', '00002913081401E807', 'padding:0; Sekunde:41; Minute:19; Stunde:8; Tag:20; Monat:1; Jahr:2024; ');
            expectParse('idm722100', '0C', '0000FDFF2D00370028001C00270024000000000025001C0028001B02000000000A000000', 'padding:0; Außentemperatur:-3; Zapftemperatur:45; Speichertemperatur:55; Soll-Vorlauf A:40; Soll-Vorlauf B:28; WP-Vorlauf:39; WP-Rücklauf:36; Raumtemperatur A:0; Raumtemperatur B:0; Vorlauf Heizkreis A:37; Vorlauf Heizkreis B:28; WP_Temp2?:40; HG-Temperatur:53.900000000000006; Sole-Austrittstemp.:0;  * add data: 00000A000000');
            expectParse('idm722100', '0D', '0000000000000000000000000000', 'padding:0; Sommerbetrieb:0; Störung Fühlerdefekt:0; error1?:0; Hochdruckstörung:0; Niederdruckstörung:0; Störung Thermorelais:0; Störung Sole zu kalt:0; Störung Verhältnis Std/Imp:0; Störung Spreizung zu hoch:0; Sperrzeit:0; Kühlfuntion:0; Vorrangschaltung:0; ');
            expectNoDefinition('idm722100', '0E');
        });

    });

    describe('create_set_value_message', () => {
        it('produces a correctly framed and checksummed message for a range of values', () => {
            for (let i = 0; i < 19; i++) {
                const valueId = i * 17;
                const message = idm_p.create_set_value_message(valueId, i, 1, 1);

                // Frame: SOH(1) ... payload ... ETX(3) checksum(3 decimal digits) EOT(4)
                expect(message[0]).to.equal(1); // SOH
                expect(message[message.length - 1]).to.equal(4); // EOT
                expect(message[message.length - 5]).to.equal(3); // ETX before the checksum

                const payload = idm_u.get_string_uint8array(message.slice(1, message.length - 5));
                const checksumText = idm_u.get_string_uint8array(message.slice(message.length - 4, message.length - 1));
                const expectedChecksum = idm_u.calc_checksum(payload);
                expect(idm_u.read_val(3, checksumText), 'checksum for value ' + i).to.equal(expectedChecksum);

                // payload is "0161" + 4 hex digits valueId + "01" + 2 hex digits value
                expect(payload.slice(0, 4)).to.equal('0161');
                expect(payload.slice(4, 8)).to.equal(idm_u.get_hex_from_word(valueId));
                expect(payload.slice(8, 10)).to.equal('01');
                expect(idm_u.get_byte(payload.slice(10, 12))).to.equal(i);
            }
        });
    });

    describe('min/max enforcement', () => {
        after(() => {
            // restore the normal (bundled-defaults) state for any test file that runs after
            // this one and expects idm_p to be initialized the default way
            idm_p.initialize();
        });

        it('known operating-mode fields carry the ranges documented in the protocol comments', () => {
            // Betriebsart Heizkreis A/B: 0..5 (see the comment block at the top of
            // idm_datablocks.default.json / the original idm_datablocks.js)
            for (const version of versions) {
                const blocks = idm_p.getDataBlocks(version);
                if (!blocks) continue;
                for (const block of blocks) {
                    const definition = idm_p.getDefinition(version, block);
                    if (!definition) continue;
                    for (const entry of definition) {
                        if (entry.field === 'betrieb_A' || entry.field === 'betrieb_B' ||
                            entry.field === 'Betrieb_C' || entry.field === 'Betrieb_D') {
                            expect(entry.min, version + ' ' + entry.field).to.equal(0);
                            expect(entry.max, version + ' ' + entry.field).to.equal(5);
                        }
                        if (entry.field === 'betrieb_WW') {
                            expect(entry.min, version + ' ' + entry.field).to.equal(0);
                            expect(entry.max, version + ' ' + entry.field).to.equal(2);
                        }
                    }
                }
            }
        });

        it('checkValueRange accepts values with no configured limits', () => {
            const result = idm_p.checkValueRange({ function: 1 }, 12345);
            expect(result).to.deep.equal({ ok: true, value: 12345 });
        });

        it('checkValueRange accepts values within the configured min/max', () => {
            expect(idm_p.checkValueRange({ min: 0, max: 5 }, 0).ok).to.be.true;
            expect(idm_p.checkValueRange({ min: 0, max: 5 }, 5).ok).to.be.true;
            expect(idm_p.checkValueRange({ min: 0, max: 5 }, 3).ok).to.be.true;
        });

        it('checkValueRange rejects values outside the configured min/max', () => {
            const tooLow = idm_p.checkValueRange({ min: 0, max: 5 }, -1);
            expect(tooLow.ok).to.be.false;
            expect(tooLow.reason).to.match(/below the minimum/);

            const tooHigh = idm_p.checkValueRange({ min: 0, max: 5 }, 6);
            expect(tooHigh.ok).to.be.false;
            expect(tooHigh.reason).to.match(/above the maximum/);
        });

        it('checkValueRange only enforces the bound(s) that are actually configured', () => {
            expect(idm_p.checkValueRange({ min: 10 }, 5).ok).to.be.false;
            expect(idm_p.checkValueRange({ min: 10 }, 100).ok).to.be.true;
            expect(idm_p.checkValueRange({ max: 10 }, 100).ok).to.be.false;
            expect(idm_p.checkValueRange({ max: 10 }, 5).ok).to.be.true;
        });

        it('checkValueRange rejects non-numeric values', () => {
            const result = idm_p.checkValueRange({ min: 0, max: 5 }, 'not a number');
            expect(result.ok).to.be.false;
            expect(result.reason).to.match(/not a number/);
        });

        it('checkValueRange rejects when there is no definition at all', () => {
            expect(idm_p.checkValueRange(null, 5).ok).to.be.false;
            expect(idm_p.checkValueRange(undefined, 5).ok).to.be.false;
        });

        it('checkValueRange coerces numeric strings (as ioBroker state values can arrive)', () => {
            const result = idm_p.checkValueRange({ min: 0, max: 5 }, '3');
            expect(result).to.deep.equal({ ok: true, value: 3 });
        });
    });

    describe('initialize with a custom data blocks file', () => {
        let tmpDir;

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            // leave idm_p in its normal (bundled-defaults) state for subsequent tests
            idm_p.initialize();
        });

        it('picks up a valid custom file, including custom min/max values', () => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idm-protocol-test-'));
            const customFile = path.join(tmpDir, 'custom.json');
            fs.writeFileSync(customFile, JSON.stringify({
                idm701100_data: { data_blocks: [{ block_number: '03', definition: [
                    { statename: 'x', field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1, writable: true, function: 1, min: 30, max: 65 },
                ] }] },
                idm701100: ['03'],
                idm701100_sensors: [],
                idm701100_settings: ['03'],
                idm701100_speed: 100,
            }));

            idm_p.initialize(customFile, () => { throw new Error('should not warn for a valid file'); });

            const definition = idm_p.getDefinition('idm701100', '03');
            expect(definition[0].min).to.equal(30);
            expect(definition[0].max).to.equal(65);
        });

        it('falls back to the bundled defaults and calls logWarn for an invalid custom file', () => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idm-protocol-test-'));
            const customFile = path.join(tmpDir, 'invalid.json');
            fs.writeFileSync(customFile, JSON.stringify({ nonsense: true }));

            const warnings = [];
            idm_p.initialize(customFile, msg => warnings.push(msg));

            expect(warnings).to.have.lengthOf(1);
            // still fully usable with the normal, bundled definitions
            expect(idm_p.getDataBlocks('idm701100')).to.be.an('array').that.is.not.empty;
        });
    });

    describe('protocol_state', () => {
        it('classifies known response headers', () => {
            expect(idm_p.protocol_state('01F201')).to.equal('NR');
            expect(idm_p.protocol_state('01F1000000')).to.equal('R1');
            expect(idm_p.protocol_state('01E1000000')).to.equal('S1');
            expect(idm_p.protocol_state('01E0...')).to.equal('I1');
            expect(idm_p.protocol_state('01F20003AA')).to.equal('Data_block_3');
            expect(idm_p.protocol_state('0000')).to.equal('U1');
            expect(idm_p.protocol_state('01F2')).to.equal('E1'); // too short after the F2 header
            expect(idm_p.protocol_state('01F2FF0000')).to.equal('E2'); // non-zero error byte
            expect(idm_p.protocol_state('abc')).to.equal('E0'); // too short overall
        });
    });

});
