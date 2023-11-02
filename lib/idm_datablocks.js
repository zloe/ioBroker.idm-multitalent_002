// definition of the idm data blocks

// Betriebsart HK A: 0 = Automatik-Betrieb (nach Uhrenprogramm), 1 = Dauer-Nennbetrieb, 2 = Dauer-Sparbetrieb, 3 = aus, 4 = Konstanttemperaturbetrieb, 5 = Kühlen
// Betriebsart Warmwasser: 0 = nach Ladeprogramm,1 = dauernd ein,2 = dauernd aus

const idm_datablocks = {
    idm701100: ['03', '04', '05', '06', '07', '08', '09', '0A', '0B'],
    idm701100_sensors: ['07', '09', '0A', '0B'],
    idm701100_settings: [ '03', '04', '05', '06', '08' ],
    idm701100_data: {
        version: 'idm701100',
        data_blocks: [
            {
                block_number: '03',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Warmwasser.Sollwert', field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1, writable: true, function: 1 },
                    { statename: 'Heizung.SommerWinterUmschaltTemp', field: 'So_Wi_temp', description: 'Sommer-Winter-Umsch.', length: 2, factor: 1, writable: true, function: 4 },
                    { statename: 'Heizung.AutomatischeWPZuschaltung', field: 'autowp', description: 'autom. WP Zuschaltung', length: 1, factor: 1, writable: false, function: 12 },
                    { statename: 'Waermepumpe.ZuschaltZeit', field: 'zuzeit', description: 'WP Zuschaltzeit', length: 2, factor: 1, writable: false, function: 20 },
                    { statename: 'Heizung.Notebetrieb', field: 'notbetrieb', description: 'Notbetrieb', length: 1, factor: 1, writable: false, function: 24 },
                    { statename: 'Heizung.BadSommerbetrieb', field: 'badsommer', description: 'Bad-Sommerbetrieb', length: 1, factor: 1, writable: false, function: 25 },
                    { statename: 'Heizung.SchichttrennplatteVorhanden', field: 'schichtpl', description: 'Schichttrennplatte', length: 2, factor: 1, writable: false, function: 55 },
                    { statename: 'Heizung.unbekannt', field: 'unbekannt', description: 'Laufzeit Zirkulation', length: 2, factor: 1, writable: false, function: 57 },
                    { statename: 'Heizung.MinDrehzahlHZK-Pumpe', field: 'mindrehz', description: 'min. Drehzahl HZK-Pumpe', length: 2, factor: 1, writable: false, function: 48 },
                    { statename: 'Heizung.PufferVorhanden', field: 'puffer', description: 'Puffer vorhanden', length: 2, factor: 1, writable: false, function: 56 },
                    { statename: 'Heizung.LaufzeitZirkulation', field: 'zirkzeit', description: 'unbekannt', length: 2, factor: 1, writable: false, function: 56 },
                    { statename: 'Heizung.HGL-Temperatur', field: 'HGL_temp', description: 'gew. HGL-Temperatur', length: 2, factor: 0.1, writable: true, function: 66 },
                    { statename: 'Heizung.ExternerKontakt', field: 'telkontakt', description: 'Funktion ext. Kontakt', length: 2, factor: 1, writable: false, function: 67 },
                    { statename: 'Heizung.Restzeit', field: 'restzeit', description: 'Restzeit?', length: 2, factor: 1, writable: false, function: 132 }
                ]
            },
            {
                block_number: '04',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-A.Frostschutz', field: 'frost_A', description: 'Frostschutz A', length: 1, factor: 1, writable: false, function: 2 },
                    { statename: 'Heizkreis-A.Kennlinie', field: 'steilheitA', description: 'Kennlinie HK A', length: 2, factor: 1, writable: false, function: 5 },
                    { statename: 'Heizkreis-A.Nenntemperatur', field: 'tagtempA', description: 'Nenntemp HK A', length: 2, factor: 1, writable: true, function: 6 },
                    { statename: 'Heizkreis-A.Spartemperatur', field: 'nachttem_A', description: 'Spartemp HK A', length: 2, factor: 1, writable: true, function: 7 },
                    { statename: 'Heizkreis-A.HeizkreisArt', field: 'fb_A', description: 'Art HK A', length: 1, factor: 1, writable: false, function: 8 },
                    { statename: 'Heizkreis-A.Betriebsart', field: 'betrieb_A', description: 'Betriebsart HK A', length: 2, factor: 1, writable: true, function: 11 },
                    { statename: 'Heizkreis-A.Maximaltemperatur', field: 'max_A', description: 'Maxtemp HK A', length: 2, factor: 1, writable: true, function: 14 },
                    { statename: 'Heizkreis-A.Raumeinfluss', field: 'einfluss_A', description: 'Raumeinfluss HK A', length: 1, factor: 1, writable: false, function: 21 },
                    { statename: 'Warmwasser.Betriebsart', field: 'betrieb_WW', description: 'Betriebsart Warmwasser', length: 1, factor: 1, writable: true, function: 23 },
                    { statename: 'Heizkreis-A.Minimaltemperatur', field: 'min_A', description: 'Mintemp HK A', length: 2, factor: 1, writable: true, function: 26 },
                    { statename: 'Heizkreis-A.AnteilRaumeinfluss', field: 'prozent_A', description: 'Anteil Raumeinfluss A', length: 2, factor: 1, writable: false, function: 29 },
                    { statename: 'Heizkreis-A.RaumeinflussVon', field: 'sensor_A', description: 'Raumeinfluss A von', length: 1, factor: 1, writable: false, function: 31 },
                    { statename: 'Heizkreis-A.RaumeinflussAuf', field: 'einflAauf', description: 'Raumeinfluss A auf', length: 1, factor: 1, writable: false, function: 33 },
                    { statename: 'Heizkreis-A.MischerVorhanden', field: 'A_misch', description: 'HK A mit Mischer', length: 1, factor: 1, writable: false, function: 42 },
                    { statename: 'Waermepumpe.MaximaleSpreizung', field: 'maxSpreiz', description: 'max Spreizung', length: 2, factor: 1, writable: false, function: 41 },
                    { statename: 'Heizkreis-A.Schnellabsenkung', field: 'absenkA', description: 'Schnellabsenkung A', length: 1, factor: 1, writable: false, function: 52 },
                    { statename: '', field: 'padding2', description: 'padding2', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-A.Absenkfaktor', field: 'faktor_A', description: 'Absenkfaktor A', length: 2, factor: 1, writable: false, function: 50 },
                    { statename: '', field: 'padding4', description: 'padding4', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-A.Konstanttemperatur', field: 'konst_A', description: 'Konstanttemp A', length: 2, factor: 1, writable: true, function: 58 }
                ]
            },
            {
                block_number: '05',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-B.Frostschutz', field: 'frost_B', description: 'Frostschutz B', length: 1, factor: 1, writable: false, function: 3 },
                    { statename: 'Heizkreis-B.HeizkreisArt', field: 'fb_B', description: 'Art HK B', length: 1, factor: 1, writable: false, function: 13 },
                    { statename: 'Heizkreis-B.Maximaltemperatur', field: 'max_B', description: 'Maximaltemp HK B', length: 2, factor: 1, writable: true, function: 15 },
                    { statename: 'Heizkreis-B.Kennlinie', field: 'steilheitB', description: 'Kennlinie HK B', length: 2, factor: 1, writable: false, function: 16 },
                    { statename: 'Heizkreis-B.Nenntemperatur', field: 'tagtemp_B', description: 'Nenntemp HK B', length: 2, factor: 1, writable: true, function: 17 },
                    { statename: 'Heizkreis-B.Spartemperatur', field: 'nachttem_B', description: 'Spartemp HK B', length: 2, factor: 1, writable: true, function: 18 },
                    { statename: 'Heizkreis-B.Betriebsart', field: 'betrieb_B', description: 'Betriebsart HK B', length: 2, factor: 1, writable: true, function: 19 },
                    { statename: 'Heizkreis-B.Raumeinfluss', field: 'einfluss_B', description: 'Raumeinfluss HK B', length: 1, factor: 1, writable: false, function: 22 },
                    { statename: 'Heizkreis-B.Minimaltemperatur', field: 'min_B', description: 'Minimaltemp HK B', length: 2, factor: 1, writable: true, function: 27 },
                    { statename: 'Heizkreis-B.AnteilRaumeinfluss', field: 'prozent_B', description: 'Anteil Raumeinfluss B', length: 2, factor: 1, writable: false, function: 30 },
                    { statename: 'Heizkreis-B.RaumeinflussVon', field: 'sensor_B', description: 'Raumeinfluss B von', length: 1, factor: 1, writable: false, function: 32 },
                    { statename: 'Heizkreis-B.RaumeinflussAuf', field: 'einflBauf', description: 'Raumeinfluss B auf', length: 1, factor: 1, writable: false, function: 34 },
                    { statename: 'Heizkreis-B.Absenkfaktor', field: 'faktor_B', description: 'Absenkfaktor B', length: 2, factor: 1, writable: false, function: 51 },
                    { statename: 'Heizkreis-B.MischerVorhanden', field: 'B_misch', description: 'HK B mit Mischer', length: 1, factor: 1, writable: false, function: 43 },
                    { statename: 'Heizkreis-B.Konstanttemperatur', field: 'konst_B', description: 'Konstanttemp B', length: 2, factor: 1, writable: true, function: 59 },
                    { statename: 'Heizkreis-B.Schnellabsenkung', field: 'absenkB', description: 'Schnellabsenkung B', length: 1, factor: 1, writable: false, function: 53 }
                ]
            },
            {
                block_number: '06',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.Freigabe', field: 'wp_fg', description: 'WP-Freigabe', length: 1, factor: 1, writable: false, function: 9 },
                    { statename: 'Waermepumpe.WP', field: 'wp', description: 'wp?', length: 1, factor: 1, writable: false, function: 10 },
                    { statename: 'Waermepumpe.Schaltdifferenz', field: 'diffwp', description: 'WP Schaltdifferenz', length: 2, factor: 1, writable: false, function: 35 },
                    { statename: 'Waermepumpe.Maximaltemperatur', field: 'WP_max', description: 'WP Maximaltemp.', length: 2, factor: 1, writable: true, function: 37 },
                    { statename: 'Waermepumpe.MinimaleLaufzeit', field: 'min_LfZt', description: 'min. WP Laufzeit', length: 2, factor: 1, writable: false, function: 38 },
                    { statename: 'Waermepumpe.MinimaleStehzeit', field: 'min_StStZt', description: 'min. WP Stehzeit', length: 2, factor: 1, writable: false, function: 39 },
                    { statename: 'Waermepumpe.MinSolewarnung', field: 'minsolwarn', description: 'min. Solewarnung', length: 2, factor: 1, writable: false, function: 40 },
                    { statename: 'Waermepumpe.MinSolealarm', field: 'minsolalrm', description: 'min. Solealarm', length: 2, factor: 1, writable: false, function: 44 },
                    { statename: 'Waermepumpe.MinimaleSoletemperatur', field: 'Sole_min', description: 'min Soletemp', length: 2, factor: 1, writable: false, function: 60 },
                    { statename: 'Waermepumpe.FreigabeKunde', field: 'wp_kund', description: 'WP-Freigabe Kunde', length: 1, factor: 1, writable: false, function: 36 },
                    { statename: 'Waermepumpe.Ueberhoehung', field: 'ueberHoehung', description: 'Ueberhoehung Stromsperrung', length: 2, factor: 1, writable: false, function: 41 },
                    { statename: 'Waermepumpe.VorverlegeZeit', field: 'ausgleich', description: 'Vorverlegezeit Stromsperrung', length: 1, factor: 1, writable: false, function: 54 },
                    { statename: '', field: 'padding2', description: 'padding2', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding3', description: 'padding3', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding4', description: 'padding4', length: 1, factor: 1, writable: false, function: -1 }
                ]
            },
            {
                block_number: '07',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding2', description: 'padding2', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: 'Status.Relais01-SolePumpe', field: 'relais1', description: 'Relais1 Solepumpe', length: 1, factor: 1, writable: false, function: 116 },
                    { statename: 'Status.Relais02-WP-Stufe-1', field: 'relais2', description: 'Relais2 WP Stufe 1', length: 1, factor: 1, writable: false, function: 117 },
                    { statename: 'Status.Relais03-MischerA-Auf', field: 'relais3', description: 'Relais3 Mischer A - auf', length: 1, factor: 1, writable: false, function: 118 },
                    { statename: 'Status.Relais04-MischerA-Zu', field: 'relais4', description: 'Relais4 Mischer A - zu', length: 1, factor: 1, writable: false, function: 119 },
                    { statename: 'Status.Relais05-WP-Stufe-2', field: 'relais5', description: 'Relais5 WP Stufe 2', length: 1, factor: 1, writable: false, function: 120 },
                    { statename: 'Status.Relais06-Pumpe-HK-B', field: 'relais6', description: 'Relais6 Pumpe Heizkreis B', length: 1, factor: 1, writable: false, function: 121 },
                    { statename: 'Status.Relais07-MischerB-Auf', field: 'relais7', description: 'Relais7 Mischer B - auf', length: 1, factor: 1, writable: false, function: 122 },
                    { statename: 'Status.Relais08-MischerB-Zu', field: 'relais8', description: 'Relais8 Mischer B - zu', length: 1, factor: 1, writable: false, function: 123 },
                    { statename: 'Status.Relais09-Kuehlventil', field: 'relais9', description: 'Relais9 Kühlventil', length: 1, factor: 1, writable: false, function: 124 },
                    { statename: 'Status.Relais10-HG-Mischer-Auf', field: 'relais10', description: 'Relais10 HG-Mischer - auf', length: 1, factor: 1, writable: false, function: 125 },
                    { statename: 'Status.Relais11-HG-Mischer-Zu', field: 'relais11', description: 'Relais11 HG-Mischer - zu', length: 1, factor: 1, writable: false, function: 126 },
                    { statename: 'Status.Relais12-ZirkulationsP', field: 'relais12', description: 'Relais12 Zirkulationspumpe', length: 1, factor: 1, writable: false, function: 127 },
                    { statename: 'Status.Relais13-Stoerung', field: 'relais13', description: 'Relais13 Störmeldeausgang', length: 1, factor: 1, writable: false, function: 128 },
                    { statename: 'Status.Triac1-PlattenTauscherWW', field: 'triac1', description: 'Triac Plattentauscherpumpe', length: 2, factor: 1, writable: false, function: 129 },
                    { statename: 'Status.Triac2-Ladepumpe', field: 'triac2', description: 'Triac Ladepumpe', length: 2, factor: 1, writable: false, function: 130 },
                    { statename: 'Status.Triac3-Pumpe-HK-A', field: 'triac3', description: 'Triac Pumpe Heizkreis A', length: 2, factor: 1, writable: false, function: 131 },
                    { statename: 'Status.Uebertemperatur', field: 'uebertemp', description: 'Störung Übertemperatur', length: 1, factor: 1, writable: false, function: 148 },
                    { statename: '', field: 'padding3', description: 'padding3', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding4', description: 'padding4', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Status.Telefonkontakt', field: 'telefon', description: 'Telefonkontakt', length: 1, factor: 1, writable: false, function: 153 }
                ]
            },
            {
                block_number: '08',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.MinimaldrehzahlLadepumpe', field: 'mindrehz2', description: 'min. Drehzahl Ladepumpe', length: 2, factor: 1, writable: true, function: 62 }
                ]
            },
            {
                block_number: '09',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Zeit.Sekunde', field: 'Sekunde', description: 'Sekunde', length: 1, factor: 1, writable: false, function: 102 },
                    { statename: 'Zeit.Minute', field: 'Minute', description: 'Minute', length: 1, factor: 1, writable: false, function: 103 },
                    { statename: 'Zeit.Stunde', field: 'Stunde', description: 'Stunde', length: 1, factor: 1, writable: false, function: 104 },
                    { statename: 'Zeit.Tag', field: 'Tag', description: 'Tag', length: 1, factor: 1, writable: false, function: 105 },
                    { statename: 'Zeit.Monat', field: 'Monat', description: 'Monat', length: 1, factor: 1, writable: false, function: 106 },
                    { statename: 'Zeit.Jahr', field: 'Jahr', description: 'Jahr', length: 2, factor: 1, writable: false, function: 136 }
                ]
            },
            {
                block_number: '0A',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizung.Aussentemperatur', field: 'aussentemp', description: 'Außentemperatur', length: 2, factor: 1, writable: false, function: 107 },
                    { statename: 'Warmwasser.Zapftemperatur', field: 'Zapftemp', description: 'Zapftemperatur', length: 2, factor: 1, writable: false, function: 108 },
                    { statename: 'Warmwasser.Speichertemperatur', field: 'Speichtemp', description: 'Speichertemperatur', length: 2, factor: 1, writable: false, function: 109 },
                    { statename: 'Heizkreis-A.SollVorlauftemperatur', field: 'solltemp_A', description: 'Soll-Vorlauf A', length: 2, factor: 1, writable: false, function: 111 },
                    { statename: 'Heizkreis-B.SollVorlauftemperatur', field: 'solltemp_B', description: 'Soll-Vorlauf B', length: 2, factor: 1, writable: false, function: 112 },
                    { statename: 'Waermepumpe.Vorlauftemperatur', field: 'WP_Temp', description: 'WP-Vorlauf', length: 2, factor: 1, writable: false, function: 113 },
                    { statename: 'Waermepumpe.Ruecklauftemperatur', field: 'WP_RL', description: 'WP-Rücklauf', length: 2, factor: 1, writable: false, function: 114 },
                    { statename: 'Heizkreis-A.Raumtemperatur', field: 'raum_A', description: 'Raumtemperatur A', length: 2, factor: 0.1, writable: false, function: 133 },
                    { statename: 'Heizkreis-B.Raumtemperatur', field: 'raum_B', description: 'Raumtemperatur B', length: 2, factor: 0.1, writable: false, function: 134 },
                    { statename: 'Heizkreis-A.Vorlauftemperatur', field: 'Vorl_A', description: 'Vorlauf Heizkreis A', length: 2, factor: 1, writable: false, function: 149 },
                    { statename: 'Heizkreis-B.Vorlauftemperatur', field: 'Vorl_B', description: 'Vorlauf Heizkreis B', length: 2, factor: 1, writable: false, function: 150 },
                    { statename: 'Waermepumpe.Temperatur2', field: 'WP_Temp2', description: 'WP_Temp2?', length: 2, factor: 1, writable: false, function: 152 },
                    { statename: 'Waermepumpe.HGTemperatur', field: 'hg_temp', description: 'HG-Temperatur', length: 2, factor: 0.1, writable: false, function: 154 },
                    { statename: 'Waermepumpe.SoleTemperatur', field: 'Sole_Temp', description: 'Sole-Austrittstemp.', length: 2, factor: 1, writable: false, function: 158 }
                ]
            },
            {
                block_number: '0B',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizung.Sommerbetrieb', field: 'sommer', description: 'Sommerbetrieb', length: 1, factor: 1, writable: false, function: 110 },
                    { statename: 'Stoerungen.Fuehlerdefekt', field: 'error3', description: 'Störung Fühlerdefekt', length: 1, factor: 1, writable: false, function: 115 },
                    { statename: 'Stoerungen.Error1', field: 'error1', description: 'error1?', length: 1, factor: 1, writable: false, function: 135 },
                    { statename: 'Stoerungen.Hochdruckwarnung', field: 'HD_Warn', description: 'Hochdruckstörung', length: 1, factor: 1, writable: false, function: 137 },
                    { statename: 'Stoerungen.Niederdruckwarnung', field: 'ND_Warn', description: 'Niederdruckstörung', length: 1, factor: 1, writable: false, function: 138 },
                    { statename: 'Stoerungen.Thermorelais', field: 'Thermwarn', description: 'Störung Thermorelais', length: 1, factor: 1, writable: false, function: 139 },
                    { statename: 'Stoerungen.SoleZuKalt', field: 'Inputwarn', description: 'Störung Sole zu kalt', length: 1, factor: 1, writable: false, function: 140 },
                    { statename: 'Stoerungen.VerhaeltnisStundenImpulse', field: 'error4', description: 'Störung Verhältnis Std/Imp', length: 1, factor: 1, writable: false, function: 141 },
                    { statename: 'Stoerungen.SpreizungZuHoch', field: 'WP_warn', description: 'Störung Spreizung zu hoch', length: 1, factor: 1, writable: false, function: 142 },
                    { statename: 'Heizung.Sperrzeit', field: 'sperrzeit', description: 'Sperrzeit', length: 1, factor: 1, writable: false, function: 146 },
                    { statename: 'Heizung.Kuehlfunktion', field: 'cool', description: 'Kühlfuntion', length: 1, factor: 1, writable: false, function: 147 },
                    { statename: 'Warmwasser.Vorrangschaltung', field: 'vorrang', description: 'Vorrangschaltung', length: 1, factor: 1, writable: true, function: 151 }
                ]
            }
        ]

    },
    idm712100: ['03', '04', '05', '06', '07', '08', '09', '0A', '0B', '0C'],
    idm712100_sensors: ['07', '09', '0B', '0C'],
    idm712100_settings: [ '03', '04', '05', '06', '08', '0A' ],
    idm712100_data: {
        version: 'idm712100',
        data_blocks: [
            {
                block_number: '03',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Warmwasser.Sollwert', field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1, writable: true, function: 1 },
                    { statename: 'Heizung.SommerWinterUmschaltTemp', field: 'So_Wi_temp', description: 'Sommer-Winter-Umsch.', length: 2, factor: 1, writable: true, function: 4 },
                    { statename: 'Heizung.AutomatischeWPZuschaltung', field: 'autowp', description: 'autom. WP Zuschaltung', length: 1, factor: 1, writable: false, function: 12 },
                    { statename: 'Waermepumpe.ZuschaltZeit', field: 'zuzeit', description: 'WP Zuschaltzeit', length: 2, factor: 1, writable: false, function: 20 },
                    { statename: 'Heizung.Notebetrieb', field: 'notbetrieb', description: 'Notbetrieb', length: 1, factor: 1, writable: false, function: 24 },
                    { statename: 'Heizung.BadSommerbetrieb', field: 'badsommer', description: 'Bad-Sommerbetrieb', length: 1, factor: 1, writable: false, function: 25 },
                    { statename: 'Heizung.MinDrehzahlHZK-Pumpe', field: 'mindrehz', description: 'min. Drehzahl HZK-Pumpe', length: 2, factor: 1, writable: false, function: 48 },
                    { statename: 'Heizung.SchichttrennplatteVorhanden', field: 'schichtpl', description: 'Schichttrennplatte', length: 1, factor: 1, writable: false, function: 55 },
                    { statename: 'Heizung.PufferVorhanden', field: 'puffer', description: 'Puffer vorhanden', length: 1, factor: 1, writable: false, function: 56 },
                    { statename: 'Heizung.LaufzeitZirkulation', field: 'zirkzeit', description: 'Laufzeit Zirkulation', length: 2, factor: 1, writable: false, function: 57 },
                    { statename: 'Heizung.HGL-Temperatur', field: 'HGL_temp', description: 'gew. HGL-Temperatur', length: 2, factor: 0.1, writable: true, function: 66 },
                    { statename: 'Heizung.ExternerKontakt', field: 'telkontakt', description: 'Funktion ext. Kontakt', length: 2, factor: 1, writable: false, function: 67 },
                    { statename: 'Heizung.Restzeit', field: 'restzeit', description: 'Restzeit?', length: 2, factor: 1, writable: false, function: 132 }
                ]
            },
            {
                block_number: '04',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-A.Frostschutz', field: 'frost_A', description: 'Frostschutz A', length: 1, factor: 1, writable: false, function: 2 },
                    { statename: 'Heizkreis-A.Kennlinie', field: 'steilheitA', description: 'Kennlinie HK A', length: 2, factor: 1, writable: false, function: 5 },
                    { statename: 'Heizkreis-A.Nenntemperatur', field: 'tagtempA', description: 'Nenntemp HK A', length: 2, factor: 1, writable: true, function: 6 },
                    { statename: 'Heizkreis-A.Spartemperatur', field: 'nachttem_A', description: 'Spartemp HK A', length: 2, factor: 1, writable: true, function: 7 },
                    { statename: 'Heizkreis-A.HeizkreisArt', field: 'fb_A', description: 'Art HK A', length: 1, factor: 1, writable: false, function: 8 },
                    { statename: 'Heizkreis-A.Betriebsart', field: 'betrieb_A', description: 'Betriebsart HK A', length: 2, factor: 1, writable: true, function: 11 },
                    { statename: 'Heizkreis-A.Maximaltemperatur', field: 'max_A', description: 'Maxtemp HK A', length: 2, factor: 1, writable: true, function: 14 },
                    { statename: 'Heizkreis-A.Raumeinfluss', field: 'einfluss_A', description: 'Raumeinfluss HK A', length: 1, factor: 1, writable: false, function: 21 },
                    { statename: 'Warmwasser.Betriebsart', field: 'betrieb_WW', description: 'Betriebsart Warmwasser', length: 1, factor: 1, writable: true, function: 23 },
                    { statename: 'Heizkreis-A.Minimaltemperatur', field: 'min_A', description: 'Mintemp HK A', length: 2, factor: 1, writable: true, function: 26 },
                    { statename: 'Heizkreis-A.AnteilRaumeinfluss', field: 'prozent_A', description: 'Anteil Raumeinfluss A', length: 2, factor: 1, writable: false, function: 29 },
                    { statename: 'Heizkreis-A.RaumeinflussVon', field: 'sensor_A', description: 'Raumeinfluss A von', length: 1, factor: 1, writable: false, function: 31 },
                    { statename: 'Heizkreis-A.RaumeinflussAuf', field: 'einflAauf', description: 'Raumeinfluss A auf', length: 1, factor: 1, writable: false, function: 33 },
                    { statename: 'Heizkreis-A.MischerVorhanden', field: 'A_misch', description: 'HK A mit Mischer', length: 1, factor: 1, writable: false, function: 42 },
                    { statename: 'Heizkreis-A.Absenkfaktor', field: 'faktor_A', description: 'Absenkfaktor A', length: 2, factor: 1, writable: false, function: 50 },
                    { statename: 'Heizkreis-A.Schnellabsenkung', field: 'absenkA', description: 'Schnellabsenkung A', length: 1, factor: 1, writable: false, function: 52 },
                    { statename: 'Heizkreis-A.Konstanttemperatur', field: 'konst_A', description: 'Konstanttemp A', length: 2, factor: 1, writable: true, function: 58 }
                ]
            },
            {
                block_number: '05',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-B.Frostschutz', field: 'frost_B', description: 'Frostschutz B', length: 1, factor: 1, writable: false, function: 3 },
                    { statename: 'Heizkreis-B.HeizkreisArt', field: 'fb_B', description: 'Art HK B', length: 1, factor: 1, writable: false, function: 13 },
                    { statename: 'Heizkreis-B.Maximaltemperatur', field: 'max_B', description: 'Maximaltemp HK B', length: 2, factor: 1, writable: true, function: 15 },
                    { statename: 'Heizkreis-B.Kennlinie', field: 'steilheitB', description: 'Kennlinie HK B', length: 2, factor: 1, writable: false, function: 16 },
                    { statename: 'Heizkreis-B.Nenntemperatur', field: 'tagtemp_B', description: 'Nenntemp HK B', length: 2, factor: 1, writable: true, function: 17 },
                    { statename: 'Heizkreis-B.Spartemperatur', field: 'nachttem_B', description: 'Spartemp HK B', length: 2, factor: 1, writable: true, function: 18 },
                    { statename: 'Heizkreis-B.Betriebsart', field: 'betrieb_B', description: 'Betriebsart HK B', length: 2, factor: 1, writable: true, function: 19 },
                    { statename: 'Heizkreis-B.Raumeinfluss', field: 'einfluss_B', description: 'Raumeinfluss HK B', length: 1, factor: 1, writable: false, function: 22 },
                    { statename: 'Heizkreis-B.Minimaltemperatur', field: 'min_B', description: 'Minimaltemp HK B', length: 2, factor: 1, writable: true, function: 27 },
                    { statename: 'Heizkreis-B.AnteilRaumeinfluss', field: 'prozent_B', description: 'Anteil Raumeinfluss B', length: 2, factor: 1, writable: false, function: 30 },
                    { statename: 'Heizkreis-B.RaumeinflussVon', field: 'sensor_B', description: 'Raumeinfluss B von', length: 1, factor: 1, writable: false, function: 32 },
                    { statename: 'Heizkreis-B.RaumeinflussAuf', field: 'einflBauf', description: 'Raumeinfluss B auf', length: 1, factor: 1, writable: false, function: 34 },
                    { statename: 'Heizkreis-B.MischerVorhanden', field: 'B_misch', description: 'HK B mit Mischer', length: 1, factor: 1, writable: false, function: 43 },
                    { statename: 'Heizkreis-B.Absenkfaktor', field: 'faktor_B', description: 'Absenkfaktor B', length: 2, factor: 1, writable: false, function: 51 },
                    { statename: 'Heizkreis-B.Schnellabsenkung', field: 'absenkB', description: 'Schnellabsenkung B', length: 1, factor: 1, writable: false, function: 53 },
                    { statename: 'Heizkreis-B.Konstanttemperatur', field: 'konst_B', description: 'Konstanttemp B', length: 2, factor: 1, writable: true, function: 59 }
                ]
            },
            {
                block_number: '06',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.Freigabe', field: 'wp_fg', description: 'WP-Freigabe', length: 1, factor: 1, writable: false, function: 9 },
                    { statename: 'Waermepumpe.WP', field: 'wp', description: 'wp?', length: 1, factor: 1, writable: false, function: 10 },
                    { statename: 'Waermepumpe.Schaltdifferenz', field: 'diffwp', description: 'WP Schaltdifferenz', length: 2, factor: 1, writable: false, function: 35 },
                    { statename: 'Waermepumpe.FreigabeKunde', field: 'wp_kund', description: 'WP-Freigabe Kunde', length: 1, factor: 1, writable: false, function: 36 },
                    { statename: 'Waermepumpe.Maximaltemperatur', field: 'WP_max', description: 'WP Maximaltemp.', length: 2, factor: 1, writable: true, function: 37 },
                    { statename: 'Waermepumpe.MinimaleLaufzeit', field: 'min_LfZt', description: 'min. WP Laufzeit', length: 2, factor: 1, writable: true, function: 38 },
                    { statename: 'Waermepumpe.MinimaleStehzeit', field: 'min_StStZt', description: 'min. WP Stehzeit', length: 2, factor: 1, writable: false, function: 39 },
                    { statename: 'Waermepumpe.MinSolewarnung', field: 'minsolwarn', description: 'min. Solewarnung', length: 2, factor: 1, writable: false, function: 40 },
                    { statename: 'Waermepumpe.MaximaleSpreizung', field: 'maxSpreiz', description: 'max Spreizung', length: 2, factor: 1, writable: false, function: 41 },
                    { statename: 'Waermepumpe.MinSolealarm', field: 'minsolalrm', description: 'min. Solealarm', length: 2, factor: 1, writable: false, function: 44 },
                    { statename: 'Waermepumpe.Betriebsstundenausgleich', field: 'ausgleich', description: 'Betriebsstundenausgleich', length: 1, factor: 1, writable: false, function: 54 },
                    { statename: 'Waermepumpe.MinimaleSoletemperatur', field: 'Sole_min', description: 'min Soletemp', length: 2, factor: 1, writable: false, function: 60 }
                ]
            },
            {
                block_number: '07',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding2', description: 'padding', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: 'Status.Relais01-SolePumpe', field: 'relais1', description: 'Relais1 Solepumpe', length: 1, factor: 1, writable: false, function: 116 },
                    { statename: 'Status.Relais02-WP-Stufe-1', field: 'relais2', description: 'Relais2 WP Stufe 1', length: 1, factor: 1, writable: false, function: 117 },
                    { statename: 'Status.Relais03-MischerA-Auf', field: 'relais3', description: 'Relais3 Mischer A - auf', length: 1, factor: 1, writable: false, function: 118 },
                    { statename: 'Status.Relais04-MischerA-Zu', field: 'relais4', description: 'Relais4 Mischer A - zu', length: 1, factor: 1, writable: false, function: 119 },
                    { statename: 'Status.Relais05-WP-Stufe-2', field: 'relais5', description: 'Relais5 WP Stufe 2', length: 1, factor: 1, writable: false, function: 120 },
                    { statename: 'Status.Relais06-Pumpe-HK-B', field: 'relais6', description: 'Relais6 Pumpe Heizkreis B', length: 1, factor: 1, writable: false, function: 121 },
                    { statename: 'Status.Relais07-MischerB-Auf', field: 'relais7', description: 'Relais7 Mischer B - auf', length: 1, factor: 1, writable: false, function: 122 },
                    { statename: 'Status.Relais08-MischerB-Zu', field: 'relais8', description: 'Relais8 Mischer B - zu', length: 1, factor: 1, writable: false, function: 123 },
                    { statename: 'Status.Relais09-Kuehlventil', field: 'relais9', description: 'Relais9 Kühlventil', length: 1, factor: 1, writable: false, function: 124 },
                    { statename: 'Status.Relais10-HG-Mischer-Auf', field: 'relais10', description: 'Relais10 HG-Mischer - auf', length: 1, factor: 1, writable: false, function: 125 },
                    { statename: 'Status.Relais11-HG-Mischer-Zu', field: 'relais11', description: 'Relais11 HG-Mischer - zu', length: 1, factor: 1, writable: false, function: 126 },
                    { statename: 'Status.Relais12-ZirkulationsP', field: 'relais12', description: 'Relais12 Zirkulationspumpe', length: 1, factor: 1, writable: false, function: 127 },
                    { statename: 'Status.Relais13-Stoerung', field: 'relais13', description: 'Relais13 Störmeldeausgang', length: 1, factor: 1, writable: false, function: 128 },
                    { statename: 'Status.Triac1-PlattenTauscherWW', field: 'triac1', description: 'Triac Plattentauscherpumpe', length: 2, factor: 1, writable: false, function: 129 },
                    { statename: 'Status.Triac2-Ladepumpe', field: 'triac2', description: 'Triac Ladepumpe', length: 2, factor: 1, writable: false, function: 130 },
                    { statename: 'Status.Triac3-Pumpe-HK-A', field: 'triac3', description: 'Triac Pumpe Heizkreis A', length: 2, factor: 1, writable: false, function: 131 },
                    { statename: 'Status.Uebertemperatur', field: 'uebertemp', description: 'Störung Übertemperatur', length: 1, factor: 1, writable: false, function: 148 },
                    { statename: '', field: 'padding3', description: 'padding3', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding4', description: 'padding4', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Status.Telefonkontakt', field: 'telefon', description: 'Telefonkontakt', length: 1, factor: 1, writable: false, function: 153 }
                ]
            },
            {
                block_number: '08',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Kuehlung-A.Freigabe', field: 'cool_onA', description: 'Kühlung freigegeben A', length: 1, factor: 1, writable: true, function: 45 },
                    { statename: 'Kuehlung-A.Raumtemperatur', field: 'cool_A', description: 'Raumtemp. Kühl A', length: 2, factor: 0.1, writable: false, function: 46 },
                    { statename: 'Kuehlung-A.Schaltdifferenz', field: 'diffco_A', description: 'Schaltdiff. Kühlung A', length: 2, factor: 0.1, writable: false, function: 47 },
                    { statename: 'Kuehlung-A.Minimaltemperatur', field: 'mincoolA', description: 'min. Kühlkreistemp A', length: 2, factor: 1, writable: true, function: 49 },
                    { statename: 'Kuehlung-B.Raumtemperatur', field: 'cool_B', description: 'Raumtemp. Kühl B', length: 2, factor: 0.1, writable: false, function: 61 },
                    { statename: 'Kuehlung-B.Minimaltemperatur', field: 'mincoolB', description: 'min. Kühlkreistemp B', length: 2, factor: 1, writable: false, function: 68 },
                    { statename: 'Kuehlung-B.Schaltdifferenz', field: 'diffco_B', description: 'Schaltdiff. Kühlung B', length: 2, factor: 0.1, writable: true, function: 69 },
                    { statename: 'Kuehlung-B.Freigabe', field: 'cool_onB', description: 'Kühlung freigegeben B', length: 1, factor: 1, writable: true, function: 70 }
                ]
            },
            {
                block_number: '09',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.MinimaldrehzahlLadepumpe', field: 'mindrehz2', description: 'min. Drehzahl Ladepumpe', length: 2, factor: 1, writable: true, function: 62 },
                    { statename: 'Zeit.Sekunde', field: 'Sekunde', description: 'Sekunde', length: 1, factor: 1, writable: false, function: 102 },
                    { statename: 'Zeit.Minute', field: 'Minute', description: 'Minute', length: 1, factor: 1, writable: false, function: 103 },
                    { statename: 'Zeit.Stunde', field: 'Stunde', description: 'Stunde', length: 1, factor: 1, writable: false, function: 104 },
                    { statename: 'Zeit.Tag', field: 'Tag', description: 'Tag', length: 1, factor: 1, writable: false, function: 105 },
                    { statename: 'Zeit.Monat', field: 'Monat', description: 'Monat', length: 1, factor: 1, writable: false, function: 106 },
                    { statename: 'Zeit.Jahr', field: 'Jahr', description: 'Jahr', length: 2, factor: 1, writable: false, function: 136 }
                ]
            },
            {
                block_number: '0A',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Bivalenz.Zuschaltung', field: 'bivalzusch', description: 'Bivalentzuschaltung', length: 2, factor: 1, writable: false, function: 63 },
                    { statename: 'Bivalenz.Zuschalttemperatur', field: 'bivaltemp', description: 'Zuschalttemp.-/zeit', length: 2, factor: 1, writable: false, function: 64 },
                    { statename: 'Bivalenz.Betriebsart', field: 'bivalbetr', description: 'Bivalentbetriebsart', length: 2, factor: 1, writable: false, function: 65 }
                ]
            },
            {
                block_number: '0B',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizung.Aussentemperatur', field: 'aussentemp', description: 'Außentemperatur', length: 2, factor: 1, writable: false, function: 107 },
                    { statename: 'Warmwasser.Zapftemperatur', field: 'Zapftemp', description: 'Zapftemperatur', length: 2, factor: 1, writable: false, function: 108 },
                    { statename: 'Warmwasser.Speichertemperatur', field: 'Speichtemp', description: 'Speichertemperatur', length: 2, factor: 1, writable: false, function: 109 },
                    { statename: 'Heizkreis-A.SollVorlauftemperatur', field: 'solltemp_A', description: 'Soll-Vorlauf A', length: 2, factor: 1, writable: false, function: 111 },
                    { statename: 'Heizkreis-B.SollVorlauftemperatur', field: 'solltemp_B', description: 'Soll-Vorlauf B', length: 2, factor: 1, writable: false, function: 112 },
                    { statename: 'Waermepumpe.Vorlauftemperatur', field: 'WP_Temp', description: 'WP-Vorlauf', length: 2, factor: 1, writable: false, function: 113 },
                    { statename: 'Waermepumpe.Ruecklauftemperatur', field: 'WP_RL', description: 'WP-Rücklauf', length: 2, factor: 1, writable: false, function: 114 },
                    { statename: 'Heizkreis-A.Raumtemperatur', field: 'raum_A', description: 'Raumtemperatur A', length: 2, factor: 0.1, writable: false, function: 133 },
                    { statename: 'Heizkreis-B.Raumtemperatur', field: 'raum_B', description: 'Raumtemperatur B', length: 2, factor: 0.1, writable: false, function: 134 },
                    { statename: 'Heizkreis-A.Vorlauftemperatur', field: 'Vorl_A', description: 'Vorlauf Heizkreis A', length: 2, factor: 1, writable: false, function: 149 },
                    { statename: 'Heizkreis-B.Vorlauftemperatur', field: 'Vorl_B', description: 'Vorlauf Heizkreis B', length: 2, factor: 1, writable: false, function: 150 },
                    { statename: 'Waermepumpe.Temperatur2', field: 'WP_Temp2', description: 'WP_Temp2?', length: 2, factor: 1, writable: false, function: 152 },
                    { statename: 'Waermepumpe.HGTemperatur', field: 'hg_temp', description: 'HG-Temperatur', length: 2, factor: 0.1, writable: false, function: 154 },
                    { statename: 'Waermepumpe.SoleTemperatur', field: 'Sole_Temp', description: 'Sole-Austrittstemp.', length: 2, factor: 1, writable: false, function: 158 }
                ]
            },
            {
                block_number: '0C',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizung.Sommerbetrieb', field: 'sommer', description: 'Sommerbetrieb', length: 1, factor: 1, writable: false, function: 110 },
                    { statename: 'Stoerungen.Fuehlerdefekt', field: 'error3', description: 'Störung Fühlerdefekt', length: 1, factor: 1, writable: false, function: 115 },
                    { statename: 'Stoerungen.Error1', field: 'error1', description: 'error1?', length: 1, factor: 1, writable: false, function: 135 },
                    { statename: 'Stoerungen.Hochdruckwarnung', field: 'HD_Warn', description: 'Hochdruckstörung', length: 1, factor: 1, writable: false, function: 137 },
                    { statename: 'Stoerungen.Niederdruckwarnung', field: 'ND_Warn', description: 'Niederdruckstörung', length: 1, factor: 1, writable: false, function: 138 },
                    { statename: 'Stoerungen.Thermorelais', field: 'Thermwarn', description: 'Störung Thermorelais', length: 1, factor: 1, writable: false, function: 139 },
                    { statename: 'Stoerungen.SoleZuKalt', field: 'Inputwarn', description: 'Störung Sole zu kalt', length: 1, factor: 1, writable: false, function: 140 },
                    { statename: 'Stoerungen.VerhaeltnisStundenImpulse', field: 'error4', description: 'Störung Verhältnis Std/Imp', length: 1, factor: 1, writable: false, function: 141 },
                    { statename: 'Stoerungen.SpreizungZuHoch', field: 'WP_warn', description: 'Störung Spreizung zu hoch', length: 1, factor: 1, writable: false, function: 142 },
                    { statename: 'Heizung.Sperrzeit', field: 'sperrzeit', description: 'Sperrzeit', length: 1, factor: 1, writable: false, function: 146 },
                    { statename: 'Heizung.Kuehlfunktion', field: 'cool', description: 'Kühlfuntion', length: 1, factor: 1, writable: false, function: 147 },
                    { statename: 'Warmwasser.Vorrangschaltung', field: 'vorrang', description: 'Vorrangschaltung', length: 1, factor: 1, writable: false, function: 151 }
                ]
            }
        ]

    },
    S_H726100: ['03', '04', '05', '06', '07', '08', '09', '0A', '0B', '0C', '0D'],
    S_H726100_sensors: ['07', '0B', '0C', '0D'],
    S_H726100_settings: [ '03', '04', '05', '06', '09' ],
    S_H726100_data: {
        version: 'S_H726100',
        data_blocks: [
            {
                block_number: '03',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Warmwasser.Sollwert', field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1, writable: true, function: 1 },
                    { statename: 'Heizung.SommerWinterUmschaltTemp', field: 'so_wi_temp', description: 'Sommer-Winter-Umsch.', length: 2, factor: 1, writable: true, function: 4 },
                    { statename: 'Heizung.AutomatischeWPZuschaltung', field: 'autowp', description: 'autom. Zuschaltung', length: 1, factor: 1, writable: false, function: 12 },
                    { statename: 'Waermepumpe.ZuschaltZeit', field: 'zuzeit', description: 'Zuschaltzeit', length: 2, factor: 1, writable: false, function: 20 },
                    { statename: 'Heizung.Notebetrieb', field: 'notbetrieb', description: 'Notbetrieb', length: 1, factor: 1, writable: false, function: 24 },
                    { statename: 'Heizung.BadSommerbetrieb', field: 'badsommer', description: 'Bad-Sommerbetrieb', length: 1, factor: 1, writable: false, function: 25 },
                    { statename: 'Waermepumpe.FreigabeKunde', field: 'wp_kund', description: 'WP-Freigabe Kunde', length: 1, factor: 1, writable: false, function: 36 },
                    { statename: 'Heizung.MinDrehzahlHZK-Pumpe', field: 'mindrehz', description: 'min. Drehzahl HZK-Pumpe', length: 2, factor: 1, writable: false, function: 48 },
                    { statename: 'Heizung.SchichttrennplatteVorhanden', field: 'schichtpl', description: 'Schichttrennplatte', length: 1, factor: 1, writable: false, function: 55 },
                    { statename: 'Heizung.PufferVorhanden', field: 'puffer', description: 'Puffer vorhanden', length: 1, factor: 1, writable: false, function: 56 },
                    { statename: 'Heizung.LaufzeitZirkulation', field: 'zirkzeit', description: 'Laufzeit Zirkulation', length: 2, factor: 1, writable: false, function: 57 },
                    { statename: 'Heizung.HGL-Temperatur', field: 'HGL_temp', description: 'gew. HGL-Temperatur', length: 2, factor: 0.1, writable: true, function: 66 },
                    { statename: 'Heizung.ExternerKontakt', field: 'telkontakt', description: 'Funktion ext. Kontakt', length: 2, factor: 1, writable: false, function: 67 }
                ]
            },
            {
                block_number: '04',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-A.Frostschutz', field: 'frost_A', description: 'Frostschutz', length: 1, factor: 1, writable: false, function: 2 },
                    { statename: 'Heizkreis-A.Kennlinie', field: 'steilheitA', description: 'Kennlinie', length: 2, factor: 1, writable: false, function: 5 },
                    { statename: 'Heizkreis-A.Nenntemperatur', field: 'tagtempA', description: 'Nenntemperatur', length: 2, factor: 1, writable: true, function: 6 },
                    { statename: 'Heizkreis-A.Spartemperatur', field: 'nachttem_A', description: 'Spartemperatur', length: 2, factor: 1, writable: true, function: 7 },
                    { statename: 'Heizkreis-A.HeizkreisArt', field: 'fb_A', description: 'Art des Heizkreises', length: 1, factor: 1, writable: false, function: 8 },
                    { statename: 'Heizkreis-A.Betriebsart', field: 'betrieb_A', description: 'Betriebsart', length: 2, factor: 1, writable: true, function: 11 },
                    { statename: 'Heizkreis-A.Maximaltemperatur', field: 'max_A', description: 'Maximaltemperatur', length: 2, factor: 1, writable: true, function: 14 },
                    { statename: 'Heizkreis-A.Raumeinfluss', field: 'einfluss_A', description: 'Raumeinfluss', length: 1, factor: 1, writable: false, function: 21 },
                    { statename: 'Warmwasser.Betriebsart', field: 'betrieb_WW', description: 'Betriebsart Warmwasser', length: 1, factor: 1, writable: true, function: 23 },
                    { statename: 'Heizkreis-A.Minimaltemperatur', field: 'min_A', description: 'Minimaltemperatur', length: 2, factor: 1, writable: true, function: 26 },
                    { statename: 'Heizkreis-A.AnteilRaumeinfluss', field: 'prozent_A', description: 'Anteil Raumeinfluss', length: 2, factor: 1, writable: false, function: 29 },
                    { statename: 'Heizkreis-A.RaumeinflussVon', field: 'sensor_A', description: 'Raumeinfluss von', length: 1, factor: 1, writable: false, function: 31 },
                    { statename: 'Heizkreis-A.RaumeinflussAuf', field: 'einflAauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 33 },
                    //{ statename: 'Heizkreis-B.RaumeinflussAuf', field: 'einflBauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 34 },
                    { statename: 'Heizkreis-A.MischerVorhanden', field: 'A_misch', description: 'mit Mischer', length: 1, factor: 1, writable: false, function: 42 },
                    { statename: 'Heizkreis-A.Absenkfaktor', field: 'faktor_A', description: 'Absenkfaktor', length: 2, factor: 1, writable: false, function: 50 },
                    { statename: 'Heizkreis-A.Schnellabsenkung', field: 'absenkA', description: 'Schnellabsenkung', length: 1, factor: 1, writable: false, function: 52 },
                    { statename: '', field: 'padding2', description: 'padding2', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-A.Konstanttemperatur', field: 'konst_A', description: 'Konstanttemperatur', length: 2, factor: 1, writable: true, function: 58 },
                    { statename: 'Heizkreis-C.MischerVorhanden', field: 'C_misch', description: 'mit Mischer', length: 1, factor: 1, writable: false, function: 68 },
                    { statename: 'Heizkreis-D.MischerVorhanden', field: 'D_misch', description: 'mit Mischer', length: 1, factor: 1, writable: false, function: 69 },
                    { statename: 'Heizkreis-C.Schnellabsenkung', field: 'absenkC', description: 'Schnellabsenkung', length: 1, factor: 1, writable: false, function: 70 },
                    { statename: 'Heizkreis-D.Schnellabsenkung', field: 'absenkD', description: 'Schnellabsenkung', length: 1, factor: 1, writable: false, function: 71 },
                    { statename: 'Heizkreis-C.Betriebsart', field: 'Betrieb_C', description: 'Betriebsart', length: 2, factor: 1, writable: true, function: 72 },
                    { statename: 'Heizkreis-D.Betriebsart', field: 'Betrieb_D', description: 'Betriebsart', length: 2, factor: 1, writable: true, function: 73 },
                    { statename: 'Heizkreis-C.RaumeinflussAuf', field: 'einflCauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 76 },
                    { statename: 'Heizkreis-D.RaumeinflussAuf', field: 'einflDauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 77 },
                    { statename: 'Heizkreis-C.Raumeinfluss', field: 'Einfluss_C', description: 'Raumeinfluss', length: 1, factor: 1, writable: false, function: 78 },
                    { statename: 'Heizkreis-D.Raumeinfluss', field: 'Einfluss_D', description: 'Raumeinfluss', length: 1, factor: 1, writable: false, function: 79 },
                    { statename: 'Heizkreis-C.Absenkfaktor', field: 'faktor_C', description: 'Absenkfaktor', length: 2, factor: 1, writable: false, function: 80 },
                    { statename: 'Heizkreis-D.Absenkfaktor', field: 'faktor_D', description: 'Absenkfaktor', length: 2, factor: 1, writable: false, function: 81 },
                    { statename: 'Heizkreis-C.HeizkreisArt', field: 'FB_C', description: 'Art des Heizkreises', length: 1, factor: 1, writable: false, function: 82 },
                    { statename: 'Heizkreis-D.HeizkreisArt', field: 'FB_D', description: 'Art des Heizkreises', length: 1, factor: 1, writable: false, function: 83 },
                    { statename: 'Heizkreis-C.Frostschutz', field: 'frost_C', description: 'Frostschutz', length: 1, factor: 1, writable: false, function: 84 },
                    { statename: 'Heizkreis-D.Frostschutz', field: 'frost_D', description: 'Frostschutz', length: 1, factor: 1, writable: false, function: 85 },
                    { statename: 'Heizkreis-C.Konstanttemperatur', field: 'konst_C', description: 'Konstanttemperatur', length: 2, factor: 1, writable: true, function: 86 },
                    { statename: 'Heizkreis-D.Konstanttemperatur', field: 'konst_D', description: 'Konstanttemperatur', length: 2, factor: 1, writable: true, function: 87 },
                    { statename: 'Heizkreis-C.Maximaltemperatur', field: 'max_C', description: 'Maximaltemperatur', length: 2, factor: 1, writable: true, function: 88 },
                    { statename: 'Heizkreis-D.Maximaltemperatur', field: 'max_D', description: 'Maximaltemperatur', length: 2, factor: 1, writable: true, function: 89 },
                    { statename: 'Heizkreis-C.Minimaltemperatur', field: 'min_C', description: 'Minimaltemperatur', length: 2, factor: 1, writable: true, function: 90 },
                    { statename: 'Heizkreis-D.Minimaltemperatur', field: 'min_D', description: 'Minimaltemperatur', length: 2, factor: 1, writable: true, function: 91 },
                    { statename: 'Heizkreis-C.Spartemperatur', field: 'nachttem_C', description: 'Spartemperatur', length: 2, factor: 1, writable: true, function: 92 },
                    { statename: 'Heizkreis-D.Spartemperatur', field: 'nachttem_D', description: 'Spartemperatur', length: 2, factor: 1, writable: true, function: 93 },
                    { statename: 'Heizkreis-C.AnteilRaumeinfluss', field: 'prozentC', description: 'Anteil Raumeinfluss', length: 2, factor: 1, writable: false, function: 94 },
                    { statename: 'Heizkreis-D.AnteilRaumeinfluss', field: 'prozentD', description: 'Anteil Raumeinfluss', length: 2, factor: 1, writable: false, function: 95 },
                    { statename: 'Heizkreis-C.RaumeinflussVon', field: 'sensorHK_C', description: 'Raumeinfluss von', length: 1, factor: 1, writable: false, function: 96 },
                    { statename: 'Heizkreis-D.RaumeinflussVon', field: 'sensorHK_D', description: 'Raumeinfluss von', length: 1, factor: 1, writable: false, function: 97 },
                    { statename: 'Heizkreis-C.Kennlinie', field: 'steilheitC', description: 'Kennlinie', length: 2, factor: 1, writable: false, function: 98 },
                    { statename: 'Heizkreis-D.Kennlinie', field: 'steilheitD', description: 'Kennlinie', length: 2, factor: 1, writable: false, function: 99 },
                    { statename: 'Heizkreis-C.Nenntemperatur', field: 'tagtemp_C', description: 'Nenntemperatur', length: 2, factor: 1, writable: true, function: 100 },
                    { statename: 'Heizkreis-D.Nenntemperatur', field: 'tagtemp_D', description: 'Nenntemperatur', length: 2, factor: 1, writable: true, function: 101 }
                ]
            },
            {
                block_number: '05',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-B.Frostschutz', field: 'frost_B', description: 'Frostschutz B', length: 1, factor: 1, writable: false, function: 3 },
                    { statename: 'Heizkreis-B.HeizkreisArt', field: 'fb_B', description: 'Art HK B', length: 1, factor: 1, writable: false, function: 13 },
                    { statename: 'Heizkreis-B.Maximaltemperatur', field: 'max_B', description: 'Maximaltemp HK B', length: 2, factor: 1, writable: true, function: 15 },
                    { statename: 'Heizkreis-B.Kennlinie', field: 'steilheitB', description: 'Kennlinie HK B', length: 2, factor: 1, writable: false, function: 16 },
                    { statename: 'Heizkreis-B.Nenntemperatur', field: 'tagtemp_B', description: 'Nenntemp HK B', length: 2, factor: 1, writable: true, function: 17 },
                    { statename: 'Heizkreis-B.Spartemperatur', field: 'nachttem_B', description: 'Spartemp HK B', length: 2, factor: 1, writable: true, function: 18 },
                    { statename: 'Heizkreis-B.Betriebsart', field: 'betrieb_B', description: 'Betriebsart HK B', length: 2, factor: 1, writable: false, function: 19 },
                    { statename: 'Heizkreis-B.Raumeinfluss', field: 'einfluss_B', description: 'Raumeinfluss HK B', length: 1, factor: 1, writable: false, function: 22 },
                    { statename: 'Heizkreis-B.Minimaltemperatur', field: 'min_B', description: 'Minimaltemp HK B', length: 2, factor: 1, writable: true, function: 27 },
                    { statename: 'Heizkreis-B.AnteilRaumeinfluss', field: 'prozent_B', description: 'Anteil Raumeinfluss B', length: 2, factor: 1, writable: false, function: 30 },
                    { statename: 'Heizkreis-B.RaumeinflussVon', field: 'sensor_B', description: 'Raumeinfluss B von', length: 1, factor: 1, writable: false, function: 32 },
                    { statename: 'Heizkreis-B.MischerVorhanden', field: 'B_misch', description: 'HK B mit Mischer', length: 1, factor: 1, writable: false, function: 43 },
                    { statename: 'Heizkreis-B.Absenkfaktor', field: 'faktor_B', description: 'Absenkfaktor B', length: 2, factor: 1, writable: false, function: 51 },
                    { statename: 'Heizkreis-B.Schnellabsenkung', field: 'absenkB', description: 'Schnellabsenkung B', length: 1, factor: 1, writable: false, function: 53 },
                    { statename: 'Heizkreis-B.Konstanttemperatur', field: 'konst_B', description: 'Konstanttemp B', length: 2, factor: 1, writable: true, function: 59 }
                ]
            },
            {
                block_number: '06',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.Freigabe', field: 'wp_fg', description: 'WP-Freigabe', length: 1, factor: 1, writable: false, function: 9 },
                    { statename: 'Waermepumpe.Schaltdifferenz', field: 'diffwp', description: 'WP Schaltdifferenz', length: 2, factor: 1, writable: false, function: 35 },
                    { statename: 'Waermepumpe.Maximaltemperatur', field: 'WP_max', description: 'WP Maximaltemp.', length: 2, factor: 1, writable: true, function: 37 },
                    { statename: 'Waermepumpe.MinimaleLaufzeit', field: 'min_LfZt', description: 'min. WP Laufzeit', length: 2, factor: 1, writable: false, function: 38 },
                    { statename: 'Waermepumpe.MinimaleStehzeit', field: 'min_StStZt', description: 'min. WP Stehzeit', length: 2, factor: 1, writable: false, function: 39 },
                    { statename: 'Waermepumpe.MinSolewarnung', field: 'minsolwarn', description: 'min. Solewarnung', length: 2, factor: 1, writable: false, function: 40 },
                    { statename: 'Waermepumpe.MinSolealarm', field: 'minsolalrm', description: 'min. Solealarm', length: 2, factor: 1, writable: false, function: 44 }
                ]
            },
            {
                block_number: '07',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding2', description: 'padding', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding3', description: 'padding', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding4', description: 'padding', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding5', description: 'padding', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: 'Status.Relais01-SolePumpe', field: 'R_1', description: 'Solepumpe', length: 1, factor: 1, writable: false, function: 216 },
                    { statename: 'Status.Relais02-WP-Stufe-1', field: 'relais2', description: 'WP Stufe 1', length: 1, factor: 1, writable: false, function: 217 },
                    { statename: 'Status.Relais03-MischerA-Auf', field: 'relais3', description: 'Mischer A - auf', length: 1, factor: 1, writable: false, function: 218 },
                    { statename: 'Status.Relais04-MischerA-Zu', field: 'relais4', description: 'Mischer A - zu', length: 1, factor: 1, writable: false, function: 219 },
                    { statename: 'Status.Relais05-Prozessumkehr', field: 'relais5', description: 'Prozessumkehr', length: 1, factor: 1, writable: false, function: 220 },
                    { statename: 'Status.Relais06-Pumpe-HK-B', field: 'relais6', description: 'Pumpe Heizkreis B', length: 1, factor: 1, writable: false, function: 221 },
                    { statename: 'Status.Relais07-MischerB-Auf', field: 'relais7', description: 'Mischer B - auf', length: 1, factor: 1, writable: false, function: 222 },
                    { statename: 'Status.Relais08-MischerB-Zu', field: 'relais8', description: 'Mischer B - zu', length: 1, factor: 1, writable: false, function: 223 },
                    { statename: 'Status.Relais09-Kuehlventil', field: 'relais9', description: 'Kühlventil', length: 1, factor: 1, writable: false, function: 224 },
                    { statename: 'Status.Relais10-HG-Mischer-Auf', field: 'relais10', description: 'HG-Mischer - auf', length: 1, factor: 1, writable: false, function: 225 },
                    { statename: 'Status.Relais11-HG-Mischer-Zu', field: 'relais11', description: 'HG-Mischer - zu', length: 1, factor: 1, writable: false, function: 226 },
                    { statename: 'Status.Relais12-ZirkulationsP', field: 'relais12', description: 'Zirkulationspumpe', length: 1, factor: 1, writable: false, function: 227 },
                    { statename: 'Status.Relais13-Stoerung', field: 'relais13', description: 'Störmeldeausgang', length: 1, factor: 1, writable: false, function: 228 },
                    { statename: 'Status.Triac1-PlattenTauscherWW', field: 'triac1', description: 'Plattentauscherpumpe', length: 2, factor: 1, writable: false, function: 229 },
                    { statename: 'Status.Triac2-Ladepumpe', field: 'triac2', description: 'Ladepumpe', length: 2, factor: 1, writable: false, function: 230 },
                    { statename: 'Status.Triac3-Pumpe-HK-A', field: 'triac3', description: 'Pumpe Heizkreis A', length: 2, factor: 1, writable: false, function: 231 },
                    { statename: 'Status.Uebertemperatur', field: 'uebertemp', description: 'Übertemperatur', length: 1, factor: 1, writable: false, function: 248 },
                    { statename: 'Status.Telefonkontakt', field: 'telefon', description: 'Telefonkontakt', length: 1, factor: 1, writable: false, function: 253 },
                ]
            },
            {
                block_number: '08',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Kuehlung-A.Freigabe', field: 'cool_onA', description: 'Kühlung freigegeben A', length: 1, factor: 1, writable: true, function: 45 },
                    { statename: 'Kuehlung-A.Raumtemperatur', field: 'cool_A', description: 'Raumtemp. Kühl A', length: 2, factor: 0.1, writable: false, function: 46 },
                    { statename: 'Kuehlung-A.Schaltdifferenz', field: 'diffco_A', description: 'Schaltdiff. Kühlung A', length: 2, factor: 0.1, writable: false, function: 47 },
                    { statename: 'Kuehlung-A.Minimaltemperatur', field: 'mincoolA', description: 'min. Kühlkreistemp A', length: 2, factor: 1, writable: true, function: 49 },
                    { statename: 'Kuehlung-B.Raumtemperatur', field: 'cool_B', description: 'Raumtemp. Kühl B', length: 2, factor: 0.1, writable: false, function: 61 },
                    { statename: 'Kuehlung-B.Minimaltemperatur', field: 'mincoolB', description: 'min. Kühlkreistemp B', length: 2, factor: 1, writable: false, function: 68 },
                    { statename: 'Kuehlung-B.Schaltdifferenz', field: 'diffco_B', description: 'Schaltdiff. Kühlung B', length: 2, factor: 0.1, writable: true, function: 69 },
                    { statename: 'Kuehlung-B.Freigabe', field: 'cool_onB', description: 'Kühlung freigegeben B', length: 1, factor: 1, writable: true, function: 70 }
                ]
            },
            {
                block_number: '09',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.MinimaldrehzahlLadepumpe', field: 'mindrehz2', description: 'min. Drehzahl Ladepumpe', length: 2, factor: 1, writable: true, function: 62 },
                ]
            },
            {
                block_number: '0A',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding2', description: 'padding2', length: 2, factor: 1, writable: true, function: 62 },
                ]
            },
            {
                block_number: '0B',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding2', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Zeit.Sekunde', field: 'Sekunde', description: 'Sekunde', length: 1, factor: 1, writable: false, function: 202 },
                    { statename: 'Zeit.Minute', field: 'Minute', description: 'Minute', length: 1, factor: 1, writable: false, function: 203 },
                    { statename: 'Zeit.Stunde', field: 'Stunde', description: 'Stunde', length: 1, factor: 1, writable: false, function: 204 },
                    { statename: 'Zeit.Tag', field: 'Tag', description: 'Tag', length: 1, factor: 1, writable: false, function: 205 },
                    { statename: 'Zeit.Monat', field: 'Monat', description: 'Monat', length: 1, factor: 1, writable: false, function: 206 },
                    { statename: 'Zeit.Jahr', field: 'Jahr', description: 'Jahr', length: 2, factor: 1, writable: false, function: 236 },
                ]
            },
            {
                block_number: '0C',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizung.Aussentemperatur', field: 'aussentemp', description: 'Außentemperatur', length: 2, factor: 1, writable: false, function: 207 },
                    { statename: 'Warmwasser.Zapftemperatur', field: 'Zapftemp', description: 'Zapftemperatur', length: 2, factor: 1, writable: false, function: 208 },
                    { statename: 'Warmwasser.Speichertemperatur', field: 'Speichtemp', description: 'Speichertemperatur', length: 2, factor: 1, writable: false, function: 209 },
                    { statename: 'Heizkreis-A.SollVorlauftemperatur', field: 'solltemp_A', description: 'Soll-Vorlauf A', length: 2, factor: 1, writable: false, function: 211 },
                    { statename: 'Heizkreis-B.SollVorlauftemperatur', field: 'solltemp_B', description: 'Soll-Vorlauf B', length: 2, factor: 1, writable: false, function: 212 },
                    { statename: 'Waermepumpe.Vorlauftemperatur', field: 'WP_Temp', description: 'WP-Vorlauf', length: 2, factor: 1, writable: false, function: 213 },
                    { statename: 'Waermepumpe.Ruecklauftemperatur', field: 'WP_RL', description: 'WP-Rücklauf', length: 2, factor: 1, writable: false, function: 214 },
                    { statename: 'Heizkreis-A.Raumtemperatur', field: 'raum_A', description: 'Raumtemperatur A', length: 2, factor: 0.1, writable: false, function: 233 },
                    { statename: 'Heizkreis-B.Raumtemperatur', field: 'raum_B', description: 'Raumtemperatur B', length: 2, factor: 0.1, writable: false, function: 234 },
                    { statename: 'Heizkreis-A.Vorlauftemperatur', field: 'Vorl_A', description: 'Vorlauf Heizkreis A', length: 2, factor: 1, writable: false, function: 249 },
                    { statename: 'Heizkreis-B.Vorlauftemperatur', field: 'Vorl_B', description: 'Vorlauf Heizkreis B', length: 2, factor: 1, writable: false, function: 250 },
                    { statename: 'Waermepumpe.HGTemperatur', field: 'hg_temp', description: 'HG-Temperatur', length: 2, factor: 0.1, writable: false, function: 254 },
                    { statename: 'Waermepumpe.SoleTemperatur', field: 'Sole_Temp', description: 'Sole-Austrittstemp.', length: 2, factor: 1, writable: false, function: 258 },
                ]
            },
            {
                block_number: '0D',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizung.Sommerbetrieb', field: 'sommer', description: 'Sommerbetrieb', length: 1, factor: 1, writable: false, function: 210 },
                    { statename: 'Stoerungen.Fuehlerdefekt', field: 'error3', description: 'Fühlerdefekt', length: 1, factor: 1, writable: false, function: 215 },
                    { statename: 'Stoerungen.Hochdruckwarnung', field: 'HD_Warn', description: 'Hochdruckstörung', length: 1, factor: 1, writable: false, function: 237 },
                    { statename: 'Stoerungen.Niederdruckwarnung', field: 'ND_Warn', description: 'Niederdruckstörung', length: 1, factor: 1, writable: false, function: 238 },
                    { statename: 'Stoerungen.Thermorelais', field: 'Thermwarn', description: 'Thermorelaisstörung', length: 1, factor: 1, writable: false, function: 239 },
                    { statename: 'Stoerungen.SoleZuKalt', field: 'Inputwarn', description: 'Sole zu kalt', length: 1, factor: 1, writable: false, function: 240 },
                    { statename: 'Stoerungen.VerhaeltnisStundenImpulse', field: 'error4', description: 'Verhältnis Std/Imp', length: 1, factor: 1, writable: false, function: 241 },
                    { statename: 'Stoerungen.SpreizungZuHoch', field: 'WP_warn', description: 'Spreizung zu hoch', length: 1, factor: 1, writable: false, function: 242 },
                    { statename: 'Heizung.Sperrzeit', field: 'sperrzeit', description: 'Sperrzeit', length: 1, factor: 1, writable: false, function: 246 },
                    { statename: 'Heizung.Kuehlfunktion', field: 'cool', description: 'Kühlfuntion', length: 1, factor: 1, writable: false, function: 247 },
                    { statename: 'Warmwasser.Vorrangschaltung', field: 'vorrang', description: 'Vorrangschaltung', length: 1, factor: 1, writable: false, function: 251 },
                ]
            },
            {
                block_number: '0E',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.SollUeberhitzung', field: 'ueberhitz1', description: 'Soll-Überhitzung', length: 2, factor: 0.1, writable: false, function: 121 },
                    { statename: 'Waermepumpe.Zykluszeit', field: 'zyklzeit', description: 'Zykluszeit', length: 2, factor: 1, writable: false, function: 122 },
                    { statename: 'Waermepumpe.Startoeffnung', field: 'startoeffn', description: 'Startöffnung', length: 2, factor: 1, writable: false, function: 123 },
                    { statename: 'Stoerungen.FehlerSchrittmotor', field: 'Err_EV', description: 'Fehler Schrittmotor', length: 1, factor: 1, writable: false, function: 271 },
                    { statename: 'Waermepumpe.FreigabeKompressor', field: 'I05_DigiIn', description: 'Freigabe Kompressor', length: 1, factor: 1, writable: false, function: 272 },
                    { statename: 'Waermepumpe.PositionE-Ventil', field: 'I05_Pos', description: 'Position E-Ventil', length: 2, factor: 1, writable: false, function: 273 },
                    { statename: 'Waermepumpe.Sauggastemperatur', field: 'sauggas', description: 'Sauggastemperatur', length: 2, factor: 0.01, writable: false, function: 274 },
                    { statename: 'Waermepumpe.Sauggasdruck', field: 'saugp', description: 'Sauggasdruck', length: 2, factor: 0.1, writable: false, function: 275 },
                    { statename: 'Waermepumpe.IstUeberhitzung', field: 'ueberhitz', description: 'Ist-Überhitzung', length: 2, factor: 0.01, writable: false, function: 276 },
                ]
            }
        ]
    },
    idm750100: ['03', '04', '05', '06', '07', '09', '0B', '0C', '0D', '0E'],
    idm750100_sensors: ['07', '0B', '0C', '0D', '0E'],
    idm750100_settings: [ '03', '04', '05', '06', '09' ],
    idm750100_data: {
        version: 'idm750100',
        data_blocks: [
            {
                block_number: '03',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Warmwasser.Sollwert', field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1, writable: true, function: 1 },
                    { statename: 'Heizung.SommerWinterUmschaltTemp', field: 'so_wi_temp', description: 'Sommer-Winter-Umsch.', length: 2, factor: 1, writable: true, function: 4 },
                    { statename: 'Heizung.AutomatischeWPZuschaltung', field: 'autowp', description: 'autom. Zuschaltung', length: 1, factor: 1, writable: false, function: 12 },
                    { statename: 'Waermepumpe.ZuschaltZeit', field: 'zuzeit', description: 'Zuschaltzeit', length: 2, factor: 1, writable: false, function: 20 },
                    { statename: 'Heizung.Notebetrieb', field: 'notbetrieb', description: 'Notbetrieb', length: 1, factor: 1, writable: false, function: 24 },
                    { statename: 'Heizung.BadSommerbetrieb', field: 'badsommer', description: 'Bad-Sommerbetrieb', length: 1, factor: 1, writable: false, function: 25 },
                    { statename: 'Waermepumpe.FreigabeKunde', field: 'wp_kund', description: 'WP-Freigabe Kunde', length: 1, factor: 1, writable: false, function: 36 },
                    { statename: 'Heizung.MinDrehzahlHZK-Pumpe', field: 'mindrehz', description: 'min. Drehzahl HZK-Pumpe', length: 2, factor: 1, writable: false, function: 48 },
                    { statename: 'Heizung.SchichttrennplatteVorhanden', field: 'schichtpl', description: 'Schichttrennplatte', length: 1, factor: 1, writable: false, function: 55 },
                    { statename: 'Heizung.PufferVorhanden', field: 'puffer', description: 'Puffer vorhanden', length: 1, factor: 1, writable: false, function: 56 },
                    { statename: 'Heizung.LaufzeitZirkulation', field: 'zirkzeit', description: 'Laufzeit Zirkulation', length: 2, factor: 1, writable: false, function: 57 },
                    { statename: 'Heizung.HGL-Temperatur', field: 'HGL_temp', description: 'gew. HGL-Temperatur', length: 2, factor: 0.1, writable: true, function: 66 },
                    { statename: 'Heizung.ExternerKontakt', field: 'telkontakt', description: 'Funktion ext. Kontakt', length: 2, factor: 1, writable: false, function: 67 }
                ]
            },
            {
                block_number: '04',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-A.Frostschutz', field: 'frost_A', description: 'Frostschutz', length: 1, factor: 1, writable: false, function: 2 },
                    { statename: 'Heizkreis-A.Kennlinie', field: 'steilheitA', description: 'Kennlinie', length: 2, factor: 1, writable: false, function: 5 },
                    { statename: 'Heizkreis-A.Nenntemperatur', field: 'tagtempA', description: 'Nenntemperatur', length: 2, factor: 1, writable: true, function: 6 },
                    { statename: 'Heizkreis-A.Spartemperatur', field: 'nachttem_A', description: 'Spartemperatur', length: 2, factor: 1, writable: true, function: 7 },
                    { statename: 'Heizkreis-A.HeizkreisArt', field: 'fb_A', description: 'Art des Heizkreises', length: 1, factor: 1, writable: false, function: 8 },
                    { statename: 'Heizkreis-A.Betriebsart', field: 'betrieb_A', description: 'Betriebsart', length: 2, factor: 1, writable: true, function: 11 },
                    { statename: 'Heizkreis-A.Maximaltemperatur', field: 'max_A', description: 'Maximaltemperatur', length: 2, factor: 1, writable: true, function: 14 },
                    { statename: 'Heizkreis-A.Raumeinfluss', field: 'einfluss_A', description: 'Raumeinfluss', length: 1, factor: 1, writable: false, function: 21 },
                    { statename: 'Warmwasser.Betriebsart', field: 'betrieb_WW', description: 'Betriebsart Warmwasser', length: 1, factor: 1, writable: true, function: 23 },
                    { statename: 'Heizkreis-A.Minimaltemperatur', field: 'min_A', description: 'Minimaltemperatur', length: 2, factor: 1, writable: true, function: 26 },
                    { statename: 'Heizkreis-A.AnteilRaumeinfluss', field: 'prozent_A', description: 'Anteil Raumeinfluss', length: 2, factor: 1, writable: false, function: 29 },
                    { statename: 'Heizkreis-A.RaumeinflussVon', field: 'sensor_A', description: 'Raumeinfluss von', length: 1, factor: 1, writable: false, function: 31 },
                    { statename: 'Heizkreis-A.RaumeinflussAuf', field: 'einflAauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 33 },
                    { statename: 'Heizkreis-B.RaumeinflussAuf', field: 'einflBauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 34 },
                    { statename: 'Heizkreis-A.MischerVorhanden', field: 'A_misch', description: 'mit Mischer', length: 1, factor: 1, writable: false, function: 42 },
                    { statename: 'Heizkreis-A.Absenkfaktor', field: 'faktor_A', description: 'Absenkfaktor', length: 2, factor: 1, writable: false, function: 50 },
                    { statename: 'Heizkreis-A.Schnellabsenkung', field: 'absenkA', description: 'Schnellabsenkung', length: 1, factor: 1, writable: false, function: 52 },
                    { statename: 'Heizkreis-A.Konstanttemperatur', field: 'konst_A', description: 'Konstanttemperatur', length: 2, factor: 1, writable: true, function: 58 },
                    { statename: 'Heizkreis-C.MischerVorhanden', field: 'C_misch', description: 'mit Mischer', length: 1, factor: 1, writable: false, function: 68 },
                    { statename: 'Heizkreis-D.MischerVorhanden', field: 'D_misch', description: 'mit Mischer', length: 1, factor: 1, writable: false, function: 69 },
                    { statename: 'Heizkreis-C.Schnellabsenkung', field: 'absenkC', description: 'Schnellabsenkung', length: 1, factor: 1, writable: false, function: 70 },
                    { statename: 'Heizkreis-D.Schnellabsenkung', field: 'absenkD', description: 'Schnellabsenkung', length: 1, factor: 1, writable: false, function: 71 },
                    { statename: 'Heizkreis-C.Betriebsart', field: 'Betrieb_C', description: 'Betriebsart', length: 2, factor: 1, writable: true, function: 72 },
                    { statename: 'Heizkreis-D.Betriebsart', field: 'Betrieb_D', description: 'Betriebsart', length: 2, factor: 1, writable: true, function: 73 },
                    { statename: 'Heizkreis-C.RaumeinflussAuf', field: 'einflCauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 76 },
                    { statename: 'Heizkreis-D.RaumeinflussAuf', field: 'einflDauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 77 },
                    { statename: 'Heizkreis-C.Raumeinfluss', field: 'Einfluss_C', description: 'Raumeinfluss', length: 1, factor: 1, writable: false, function: 78 },
                    { statename: 'Heizkreis-D.Raumeinfluss', field: 'Einfluss_D', description: 'Raumeinfluss', length: 1, factor: 1, writable: false, function: 79 },
                    { statename: 'Heizkreis-C.Absenkfaktor', field: 'faktor_C', description: 'Absenkfaktor', length: 2, factor: 1, writable: false, function: 80 },
                    { statename: 'Heizkreis-D.Absenkfaktor', field: 'faktor_D', description: 'Absenkfaktor', length: 2, factor: 1, writable: false, function: 81 },
                    { statename: 'Heizkreis-C.HeizkreisArt', field: 'FB_C', description: 'Art des Heizkreises', length: 1, factor: 1, writable: false, function: 82 },
                    { statename: 'Heizkreis-D.HeizkreisArt', field: 'FB_D', description: 'Art des Heizkreises', length: 1, factor: 1, writable: false, function: 83 },
                    { statename: 'Heizkreis-C.Frostschutz', field: 'frost_C', description: 'Frostschutz', length: 1, factor: 1, writable: false, function: 84 },
                    { statename: 'Heizkreis-D.Frostschutz', field: 'frost_D', description: 'Frostschutz', length: 1, factor: 1, writable: false, function: 85 },
                    { statename: 'Heizkreis-C.Konstanttemperatur', field: 'konst_C', description: 'Konstanttemperatur', length: 2, factor: 1, writable: true, function: 86 },
                    { statename: 'Heizkreis-D.Konstanttemperatur', field: 'konst_D', description: 'Konstanttemperatur', length: 2, factor: 1, writable: true, function: 87 },
                    { statename: 'Heizkreis-C.Maximaltemperatur', field: 'max_C', description: 'Maximaltemperatur', length: 2, factor: 1, writable: true, function: 88 },
                    { statename: 'Heizkreis-D.Maximaltemperatur', field: 'max_D', description: 'Maximaltemperatur', length: 2, factor: 1, writable: true, function: 89 },
                    { statename: 'Heizkreis-C.Minimaltemperatur', field: 'min_C', description: 'Minimaltemperatur', length: 2, factor: 1, writable: true, function: 90 },
                    { statename: 'Heizkreis-D.Minimaltemperatur', field: 'min_D', description: 'Minimaltemperatur', length: 2, factor: 1, writable: true, function: 91 },
                    { statename: 'Heizkreis-C.Spartemperatur', field: 'nachttem_C', description: 'Spartemperatur', length: 2, factor: 1, writable: true, function: 92 },
                    { statename: 'Heizkreis-D.Spartemperatur', field: 'nachttem_D', description: 'Spartemperatur', length: 2, factor: 1, writable: true, function: 93 },
                    { statename: 'Heizkreis-C.AnteilRaumeinfluss', field: 'prozentC', description: 'Anteil Raumeinfluss', length: 2, factor: 1, writable: false, function: 94 },
                    { statename: 'Heizkreis-D.AnteilRaumeinfluss', field: 'prozentD', description: 'Anteil Raumeinfluss', length: 2, factor: 1, writable: false, function: 95 },
                    { statename: 'Heizkreis-C.RaumeinflussVon', field: 'sensorHK_C', description: 'Raumeinfluss von', length: 1, factor: 1, writable: false, function: 96 },
                    { statename: 'Heizkreis-D.RaumeinflussVon', field: 'sensorHK_D', description: 'Raumeinfluss von', length: 1, factor: 1, writable: false, function: 97 },
                    { statename: 'Heizkreis-C.Kennlinie', field: 'steilheitC', description: 'Kennlinie', length: 2, factor: 1, writable: false, function: 98 },
                    { statename: 'Heizkreis-D.Kennlinie', field: 'steilheitD', description: 'Kennlinie', length: 2, factor: 1, writable: false, function: 99 },
                    { statename: 'Heizkreis-C.Nenntemperatur', field: 'tagtemp_C', description: 'Nenntemperatur', length: 2, factor: 1, writable: true, function: 100 },
                    { statename: 'Heizkreis-D.Nenntemperatur', field: 'tagtemp_D', description: 'Nenntemperatur', length: 2, factor: 1, writable: true, function: 101 }
                ]
            },
            {
                block_number: '05',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-B.Frostschutz', field: 'frost_B', description: 'Frostschutz B', length: 1, factor: 1, writable: false, function: 3 },
                    { statename: 'Heizkreis-B.HeizkreisArt', field: 'fb_B', description: 'Art HK B', length: 1, factor: 1, writable: false, function: 13 },
                    { statename: 'Heizkreis-B.Maximaltemperatur', field: 'max_B', description: 'Maximaltemp HK B', length: 2, factor: 1, writable: true, function: 15 },
                    { statename: 'Heizkreis-B.Kennlinie', field: 'steilheitB', description: 'Kennlinie HK B', length: 2, factor: 1, writable: false, function: 16 },
                    { statename: 'Heizkreis-B.Nenntemperatur', field: 'tagtemp_B', description: 'Nenntemp HK B', length: 2, factor: 1, writable: true, function: 17 },
                    { statename: 'Heizkreis-B.Spartemperatur', field: 'nachttem_B', description: 'Spartemp HK B', length: 2, factor: 1, writable: true, function: 18 },
                    { statename: 'Heizkreis-B.Betriebsart', field: 'betrieb_B', description: 'Betriebsart HK B', length: 2, factor: 1, writable: false, function: 19 },
                    { statename: 'Heizkreis-B.Raumeinfluss', field: 'einfluss_B', description: 'Raumeinfluss HK B', length: 1, factor: 1, writable: false, function: 22 },
                    { statename: 'Heizkreis-B.Minimaltemperatur', field: 'min_B', description: 'Minimaltemp HK B', length: 2, factor: 1, writable: true, function: 27 },
                    { statename: 'Heizkreis-B.AnteilRaumeinfluss', field: 'prozent_B', description: 'Anteil Raumeinfluss B', length: 2, factor: 1, writable: false, function: 30 },
                    { statename: 'Heizkreis-B.RaumeinflussVon', field: 'sensor_B', description: 'Raumeinfluss B von', length: 1, factor: 1, writable: false, function: 32 },
                    { statename: 'Heizkreis-B.MischerVorhanden', field: 'B_misch', description: 'HK B mit Mischer', length: 1, factor: 1, writable: false, function: 43 },
                    { statename: 'Heizkreis-B.Absenkfaktor', field: 'faktor_B', description: 'Absenkfaktor B', length: 2, factor: 1, writable: false, function: 51 },
                    { statename: 'Heizkreis-B.Schnellabsenkung', field: 'absenkB', description: 'Schnellabsenkung B', length: 1, factor: 1, writable: false, function: 53 },
                    { statename: 'Heizkreis-B.Konstanttemperatur', field: 'konst_B', description: 'Konstanttemp B', length: 2, factor: 1, writable: true, function: 59 }
                ]
            },
            {
                block_number: '06',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.Freigabe', field: 'wp_fg', description: 'WP-Freigabe', length: 1, factor: 1, writable: false, function: 9 },
                    { statename: 'Waermepumpe.Schaltdifferenz', field: 'diffwp', description: 'WP Schaltdifferenz', length: 2, factor: 1, writable: false, function: 35 },
                    { statename: 'Waermepumpe.Maximaltemperatur', field: 'WP_max', description: 'WP Maximaltemp.', length: 2, factor: 1, writable: true, function: 37 },
                    { statename: 'Waermepumpe.MinimaleLaufzeit', field: 'min_LfZt', description: 'min. WP Laufzeit', length: 2, factor: 1, writable: false, function: 38 },
                    { statename: 'Waermepumpe.MinimaleStehzeit', field: 'min_StStZt', description: 'min. WP Stehzeit', length: 2, factor: 1, writable: false, function: 39 },
                    { statename: 'Waermepumpe.MinSolewarnung', field: 'minsolwarn', description: 'min. Solewarnung', length: 2, factor: 1, writable: false, function: 40 },
                    { statename: 'Waermepumpe.MinSolealarm', field: 'minsolalrm', description: 'min. Solealarm', length: 2, factor: 1, writable: false, function: 44 }
                ]
            },
            {
                block_number: '07',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding2', description: 'padding', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: 'Status.Relais01-SolePumpe', field: 'R_1', description: 'Solepumpe', length: 1, factor: 1, writable: false, function: 216 },
                    { statename: 'Status.Relais02-WP-Stufe-1', field: 'relais2', description: 'WP Stufe 1', length: 1, factor: 1, writable: false, function: 217 },
                    { statename: 'Status.Relais03-MischerA-Auf', field: 'relais3', description: 'Mischer A - auf', length: 1, factor: 1, writable: false, function: 218 },
                    { statename: 'Status.Relais04-MischerA-Zu', field: 'relais4', description: 'Mischer A - zu', length: 1, factor: 1, writable: false, function: 219 },
                    { statename: 'Status.Relais05-Prozessumkehr', field: 'relais5', description: 'Prozessumkehr', length: 1, factor: 1, writable: false, function: 220 },
                    { statename: 'Status.Relais06-Pumpe-HK-B', field: 'relais6', description: 'Pumpe Heizkreis B', length: 1, factor: 1, writable: false, function: 221 },
                    { statename: 'Status.Relais07-MischerB-Auf', field: 'relais7', description: 'Mischer B - auf', length: 1, factor: 1, writable: false, function: 222 },
                    { statename: 'Status.Relais08-MischerB-Zu', field: 'relais8', description: 'Mischer B - zu', length: 1, factor: 1, writable: false, function: 223 },
                    { statename: 'Status.Relais09-Kuehlventil', field: 'relais9', description: 'Kühlventil', length: 1, factor: 1, writable: false, function: 224 },
                    { statename: 'Status.Relais10-HG-Mischer-Auf', field: 'relais10', description: 'HG-Mischer - auf', length: 1, factor: 1, writable: false, function: 225 },
                    { statename: 'Status.Relais11-HG-Mischer-Zu', field: 'relais11', description: 'HG-Mischer - zu', length: 1, factor: 1, writable: false, function: 226 },
                    { statename: 'Status.Relais12-ZirkulationsP', field: 'relais12', description: 'Zirkulationspumpe', length: 1, factor: 1, writable: false, function: 227 },
                    { statename: 'Status.Relais13-Stoerung', field: 'relais13', description: 'Störmeldeausgang', length: 1, factor: 1, writable: false, function: 228 },
                    { statename: 'Status.Triac1-PlattenTauscherWW', field: 'triac1', description: 'Plattentauscherpumpe', length: 2, factor: 1, writable: false, function: 229 },
                    { statename: 'Status.Triac2-Ladepumpe', field: 'triac2', description: 'Ladepumpe', length: 2, factor: 1, writable: false, function: 230 },
                    { statename: 'Status.Triac3-Pumpe-HK-A', field: 'triac3', description: 'Pumpe Heizkreis A', length: 2, factor: 1, writable: false, function: 231 },
                    { statename: 'Status.Uebertemperatur', field: 'uebertemp', description: 'Übertemperatur', length: 1, factor: 1, writable: false, function: 248 },
                    { statename: 'Status.Telefonkontakt', field: 'telefon', description: 'Telefonkontakt', length: 1, factor: 1, writable: false, function: 253 },
                ]
            },
            {
                block_number: '09',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.MinimaldrehzahlLadepumpe', field: 'mindrehz2', description: 'min. Drehzahl Ladepumpe', length: 2, factor: 1, writable: true, function: 62 },
                ]
            },
            {
                block_number: '0B',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.SollUeberhitzung', field: 'ueberhitz1', description: 'Soll-Überhitzung', length: 2, factor: 0.1, writable: false, function: 121 },
                    { statename: 'Waermepumpe.Zykluszeit', field: 'zyklzeit', description: 'Zykluszeit', length: 2, factor: 1, writable: false, function: 122 },
                    { statename: 'Waermepumpe.Startoeffnung', field: 'startoeffn', description: 'Startöffnung', length: 2, factor: 1, writable: false, function: 123 },
                    { statename: 'Stoerungen.FehlerSchrittmotor', field: 'Err_EV', description: 'Fehler Schrittmotor', length: 1, factor: 1, writable: false, function: 271 },
                    { statename: 'Waermepumpe.FreigabeKompressor', field: 'I05_DigiIn', description: 'Freigabe Kompressor', length: 1, factor: 1, writable: false, function: 272 },
                    { statename: 'Waermepumpe.PositionE-Ventil', field: 'I05_Pos', description: 'Position E-Ventil', length: 2, factor: 1, writable: false, function: 273 },
                    { statename: 'Waermepumpe.Sauggastemperatur', field: 'sauggas', description: 'Sauggastemperatur', length: 2, factor: 0.01, writable: false, function: 274 },
                    { statename: 'Waermepumpe.Sauggasdruck', field: 'saugp', description: 'Sauggasdruck', length: 2, factor: 0.1, writable: false, function: 275 },
                    { statename: 'Waermepumpe.IstUeberhitzung', field: 'ueberhitz', description: 'Ist-Überhitzung', length: 2, factor: 0.01, writable: false, function: 276 },
                ]
            },
            {
                block_number: '0C',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Zeit.Sekunde', field: 'Sekunde', description: 'Sekunde', length: 1, factor: 1, writable: false, function: 202 },
                    { statename: 'Zeit.Minute', field: 'Minute', description: 'Minute', length: 1, factor: 1, writable: false, function: 203 },
                    { statename: 'Zeit.Stunde', field: 'Stunde', description: 'Stunde', length: 1, factor: 1, writable: false, function: 204 },
                    { statename: 'Zeit.Tag', field: 'Tag', description: 'Tag', length: 1, factor: 1, writable: false, function: 205 },
                    { statename: 'Zeit.Monat', field: 'Monat', description: 'Monat', length: 1, factor: 1, writable: false, function: 206 },
                    { statename: 'Zeit.Jahr', field: 'Jahr', description: 'Jahr', length: 2, factor: 1, writable: false, function: 236 },
                ]
            },
            {
                block_number: '0D',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizung.Aussentemperatur', field: 'aussentemp', description: 'Außentemperatur', length: 2, factor: 1, writable: false, function: 207 },
                    { statename: 'Warmwasser.Zapftemperatur', field: 'Zapftemp', description: 'Zapftemperatur', length: 2, factor: 1, writable: false, function: 208 },
                    { statename: 'Warmwasser.Speichertemperatur', field: 'Speichtemp', description: 'Speichertemperatur', length: 2, factor: 1, writable: false, function: 209 },
                    { statename: 'Heizkreis-A.SollVorlauftemperatur', field: 'solltemp_A', description: 'Soll-Vorlauf A', length: 2, factor: 1, writable: false, function: 211 },
                    { statename: 'Heizkreis-B.SollVorlauftemperatur', field: 'solltemp_B', description: 'Soll-Vorlauf B', length: 2, factor: 1, writable: false, function: 212 },
                    { statename: 'Waermepumpe.Vorlauftemperatur', field: 'WP_Temp', description: 'WP-Vorlauf', length: 2, factor: 1, writable: false, function: 213 },
                    { statename: 'Waermepumpe.Ruecklauftemperatur', field: 'WP_RL', description: 'WP-Rücklauf', length: 2, factor: 1, writable: false, function: 214 },
                    { statename: 'Heizkreis-A.Raumtemperatur', field: 'raum_A', description: 'Raumtemperatur A', length: 2, factor: 0.1, writable: false, function: 233 },
                    { statename: 'Heizkreis-B.Raumtemperatur', field: 'raum_B', description: 'Raumtemperatur B', length: 2, factor: 0.1, writable: false, function: 234 },
                    { statename: 'Heizkreis-A.Vorlauftemperatur', field: 'Vorl_A', description: 'Vorlauf Heizkreis A', length: 2, factor: 1, writable: false, function: 249 },
                    { statename: 'Heizkreis-B.Vorlauftemperatur', field: 'Vorl_B', description: 'Vorlauf Heizkreis B', length: 2, factor: 1, writable: false, function: 250 },
                    { statename: 'Waermepumpe.HGTemperatur', field: 'hg_temp', description: 'HG-Temperatur', length: 2, factor: 0.1, writable: false, function: 254 },
                    { statename: 'Waermepumpe.SoleTemperatur', field: 'Sole_Temp', description: 'Sole-Austrittstemp.', length: 2, factor: 1, writable: false, function: 258 },
                ]
            },
            {
                block_number: '0E',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizung.Sommerbetrieb', field: 'sommer', description: 'Sommerbetrieb', length: 1, factor: 1, writable: false, function: 210 },
                    { statename: 'Stoerungen.Fuehlerdefekt', field: 'error3', description: 'Fühlerdefekt', length: 1, factor: 1, writable: false, function: 215 },
                    { statename: 'Stoerungen.Hochdruckwarnung', field: 'HD_Warn', description: 'Hochdruckstörung', length: 1, factor: 1, writable: false, function: 237 },
                    { statename: 'Stoerungen.Niederdruckwarnung', field: 'ND_Warn', description: 'Niederdruckstörung', length: 1, factor: 1, writable: false, function: 238 },
                    { statename: 'Stoerungen.Thermorelais', field: 'Thermwarn', description: 'Thermorelaisstörung', length: 1, factor: 1, writable: false, function: 239 },
                    { statename: 'Stoerungen.SoleZuKalt', field: 'Inputwarn', description: 'Sole zu kalt', length: 1, factor: 1, writable: false, function: 240 },
                    { statename: 'Stoerungen.VerhaeltnisStundenImpulse', field: 'error4', description: 'Verhältnis Std/Imp', length: 1, factor: 1, writable: false, function: 241 },
                    { statename: 'Stoerungen.SpreizungZuHoch', field: 'WP_warn', description: 'Spreizung zu hoch', length: 1, factor: 1, writable: false, function: 242 },
                    { statename: 'Heizung.Sperrzeit', field: 'sperrzeit', description: 'Sperrzeit', length: 1, factor: 1, writable: false, function: 246 },
                    { statename: 'Heizung.Kuehlfunktion', field: 'cool', description: 'Kühlfuntion', length: 1, factor: 1, writable: false, function: 247 },
                    { statename: 'Warmwasser.Vorrangschaltung', field: 'vorrang', description: 'Vorrangschaltung', length: 1, factor: 1, writable: false, function: 251 },
                ]
            }
        ]
    },
    evr752101: ['03', '04', '05', '06', '07', '09', '0B', '0C', '0D', '0E'],
    evr752101_sensors: ['07', '0B', '0C', '0D', '0E'],
    evr752101_settings: [ '03', '04', '05', '06', '09' ],
    evr752101_data: {
        version: 'EVR752101',
        data_blocks: [
            {
                block_number: '03',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Warmwasser.Sollwert', field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1, writable: true, function: 1 },
                    { statename: 'Heizung.SommerWinterUmschaltTemp', field: 'so_wi_temp', description: 'Sommer-Winter-Umsch.', length: 2, factor: 1, writable: true, function: 4 },
                    { statename: 'Heizung.AutomatischeWPZuschaltung', field: 'autowp', description: 'autom. Zuschaltung', length: 1, factor: 1, writable: false, function: 12 },
                    { statename: 'Waermepumpe.ZuschaltZeit', field: 'zuzeit', description: 'Zuschaltzeit', length: 2, factor: 1, writable: false, function: 20 },
                    { statename: 'Heizung.Notebetrieb', field: 'notbetrieb', description: 'Notbetrieb', length: 1, factor: 1, writable: false, function: 24 },
                    { statename: 'Heizung.BadSommerbetrieb', field: 'badsommer', description: 'Bad-Sommerbetrieb', length: 1, factor: 1, writable: false, function: 25 },
                    { statename: 'Waermepumpe.FreigabeKunde', field: 'wp_kund', description: 'WP-Freigabe Kunde', length: 1, factor: 1, writable: false, function: 36 },
                    { statename: 'Heizung.MinDrehzahlHZK-Pumpe', field: 'mindrehz', description: 'min. Drehzahl HZK-Pumpe', length: 2, factor: 1, writable: false, function: 48 },
                    { statename: 'Heizung.SchichttrennplatteVorhanden', field: 'schichtpl', description: 'Schichttrennplatte', length: 1, factor: 1, writable: false, function: 55 },
                    { statename: 'Heizung.PufferVorhanden', field: 'puffer', description: 'Puffer vorhanden', length: 1, factor: 1, writable: false, function: 56 },
                    { statename: 'Heizung.LaufzeitZirkulation', field: 'zirkzeit', description: 'Laufzeit Zirkulation', length: 2, factor: 1, writable: false, function: 57 },
                    { statename: 'Heizung.HGL-Temperatur', field: 'HGL_temp', description: 'gew. HGL-Temperatur', length: 2, factor: 0.1, writable: true, function: 66 },
                    { statename: 'Heizung.ExternerKontakt', field: 'telkontakt', description: 'Funktion ext. Kontakt', length: 2, factor: 1, writable: false, function: 67 }
                ]
            },
            {
                block_number: '04',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-A.Frostschutz', field: 'frost_A', description: 'Frostschutz', length: 1, factor: 1, writable: false, function: 2 },
                    { statename: 'Heizkreis-A.Kennlinie', field: 'steilheitA', description: 'Kennlinie', length: 2, factor: 1, writable: false, function: 5 },
                    { statename: 'Heizkreis-A.Nenntemperatur', field: 'tagtempA', description: 'Nenntemperatur', length: 2, factor: 1, writable: true, function: 6 },
                    { statename: 'Heizkreis-A.Spartemperatur', field: 'nachttem_A', description: 'Spartemperatur', length: 2, factor: 1, writable: true, function: 7 },
                    { statename: 'Heizkreis-A.HeizkreisArt', field: 'fb_A', description: 'Art des Heizkreises', length: 1, factor: 1, writable: false, function: 8 },
                    { statename: 'Heizkreis-A.Betriebsart', field: 'betrieb_A', description: 'Betriebsart', length: 2, factor: 1, writable: true, function: 11 },
                    { statename: 'Heizkreis-A.Maximaltemperatur', field: 'max_A', description: 'Maximaltemperatur', length: 2, factor: 1, writable: true, function: 14 },
                    { statename: 'Heizkreis-A.Raumeinfluss', field: 'einfluss_A', description: 'Raumeinfluss', length: 1, factor: 1, writable: false, function: 21 },
                    { statename: 'Warmwasser.Betriebsart', field: 'betrieb_WW', description: 'Betriebsart Warmwasser', length: 1, factor: 1, writable: true, function: 23 },
                    { statename: 'Heizkreis-A.Minimaltemperatur', field: 'min_A', description: 'Minimaltemperatur', length: 2, factor: 1, writable: true, function: 26 },
                    { statename: 'Heizkreis-A.AnteilRaumeinfluss', field: 'prozent_A', description: 'Anteil Raumeinfluss', length: 2, factor: 1, writable: false, function: 29 },
                    { statename: 'Heizkreis-A.RaumeinflussVon', field: 'sensor_A', description: 'Raumeinfluss von', length: 1, factor: 1, writable: false, function: 31 },
                    { statename: 'Heizkreis-A.RaumeinflussAuf', field: 'einflAauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 33 },
                    { statename: 'Heizkreis-B.RaumeinflussAuf', field: 'einflBauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 34 },
                    { statename: 'Heizkreis-A.irgendwas', field: 'A_irgendwas', description: 'irgendwas', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-A.MischerVorhanden', field: 'A_misch', description: 'mit Mischer', length: 1, factor: 1, writable: false, function: 42 },
                    { statename: 'Heizkreis-A.Absenkfaktor', field: 'faktor_A', description: 'Absenkfaktor', length: 2, factor: 1, writable: false, function: 50 },
                    { statename: 'Heizkreis-A.Schnellabsenkung', field: 'absenkA', description: 'Schnellabsenkung', length: 1, factor: 1, writable: false, function: 52 },
                    { statename: 'Heizkreis-A.Konstanttemperatur', field: 'konst_A', description: 'Konstanttemperatur', length: 2, factor: 1, writable: true, function: 58 },
                    { statename: 'Heizkreis-C.MischerVorhanden', field: 'C_misch', description: 'mit Mischer', length: 1, factor: 1, writable: false, function: 68 },
                    { statename: 'Heizkreis-D.MischerVorhanden', field: 'D_misch', description: 'mit Mischer', length: 1, factor: 1, writable: false, function: 69 },
                    { statename: 'Heizkreis-C.Schnellabsenkung', field: 'absenkC', description: 'Schnellabsenkung', length: 1, factor: 1, writable: false, function: 70 },
                    { statename: 'Heizkreis-D.Schnellabsenkung', field: 'absenkD', description: 'Schnellabsenkung', length: 1, factor: 1, writable: false, function: 71 },
                    { statename: 'Heizkreis-C.Betriebsart', field: 'Betrieb_C', description: 'Betriebsart', length: 2, factor: 1, writable: true, function: 72 },
                    { statename: 'Heizkreis-D.Betriebsart', field: 'Betrieb_D', description: 'Betriebsart', length: 2, factor: 1, writable: true, function: 73 },
                    { statename: 'Heizkreis-C.RaumeinflussAuf', field: 'einflCauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 76 },
                    { statename: 'Heizkreis-D.RaumeinflussAuf', field: 'einflDauf', description: 'Raumeinfluss auf', length: 1, factor: 1, writable: false, function: 77 },
                    { statename: 'Heizkreis-C.Raumeinfluss', field: 'Einfluss_C', description: 'Raumeinfluss', length: 1, factor: 1, writable: false, function: 78 },
                    { statename: 'Heizkreis-D.Raumeinfluss', field: 'Einfluss_D', description: 'Raumeinfluss', length: 1, factor: 1, writable: false, function: 79 },
                    { statename: 'Heizkreis-C.Absenkfaktor', field: 'faktor_C', description: 'Absenkfaktor', length: 2, factor: 1, writable: false, function: 80 },
                    { statename: 'Heizkreis-D.Absenkfaktor', field: 'faktor_D', description: 'Absenkfaktor', length: 2, factor: 1, writable: false, function: 81 },
                    { statename: 'Heizkreis-C.HeizkreisArt', field: 'FB_C', description: 'Art des Heizkreises', length: 1, factor: 1, writable: false, function: 82 },
                    { statename: 'Heizkreis-D.HeizkreisArt', field: 'FB_D', description: 'Art des Heizkreises', length: 1, factor: 1, writable: false, function: 83 },
                    { statename: 'Heizkreis-C.Frostschutz', field: 'frost_C', description: 'Frostschutz', length: 1, factor: 1, writable: false, function: 84 },
                    { statename: 'Heizkreis-D.Frostschutz', field: 'frost_D', description: 'Frostschutz', length: 1, factor: 1, writable: false, function: 85 },
                    { statename: 'Heizkreis-C.Konstanttemperatur', field: 'konst_C', description: 'Konstanttemperatur', length: 2, factor: 1, writable: true, function: 86 },
                    { statename: 'Heizkreis-D.Konstanttemperatur', field: 'konst_D', description: 'Konstanttemperatur', length: 2, factor: 1, writable: true, function: 87 },
                    { statename: 'Heizkreis-C.Maximaltemperatur', field: 'max_C', description: 'Maximaltemperatur', length: 2, factor: 1, writable: true, function: 88 },
                    { statename: 'Heizkreis-D.Maximaltemperatur', field: 'max_D', description: 'Maximaltemperatur', length: 2, factor: 1, writable: true, function: 89 },
                    { statename: 'Heizkreis-C.Minimaltemperatur', field: 'min_C', description: 'Minimaltemperatur', length: 2, factor: 1, writable: true, function: 90 },
                    { statename: 'Heizkreis-D.Minimaltemperatur', field: 'min_D', description: 'Minimaltemperatur', length: 2, factor: 1, writable: true, function: 91 },
                    { statename: 'Heizkreis-C.Spartemperatur', field: 'nachttem_C', description: 'Spartemperatur', length: 2, factor: 1, writable: true, function: 92 },
                    { statename: 'Heizkreis-D.Spartemperatur', field: 'nachttem_D', description: 'Spartemperatur', length: 2, factor: 1, writable: true, function: 93 },
                    { statename: 'Heizkreis-C.AnteilRaumeinfluss', field: 'prozentC', description: 'Anteil Raumeinfluss', length: 2, factor: 1, writable: false, function: 94 },
                    { statename: 'Heizkreis-D.AnteilRaumeinfluss', field: 'prozentD', description: 'Anteil Raumeinfluss', length: 2, factor: 1, writable: false, function: 95 },
                    { statename: 'Heizkreis-C.RaumeinflussVon', field: 'sensorHK_C', description: 'Raumeinfluss von', length: 1, factor: 1, writable: false, function: 96 },
                    { statename: 'Heizkreis-D.RaumeinflussVon', field: 'sensorHK_D', description: 'Raumeinfluss von', length: 1, factor: 1, writable: false, function: 97 },
                    { statename: 'Heizkreis-C.Kennlinie', field: 'steilheitC', description: 'Kennlinie', length: 2, factor: 1, writable: false, function: 98 },
                    { statename: 'Heizkreis-D.Kennlinie', field: 'steilheitD', description: 'Kennlinie', length: 2, factor: 1, writable: false, function: 99 },
                    { statename: 'Heizkreis-C.Nenntemperatur', field: 'tagtemp_C', description: 'Nenntemperatur', length: 2, factor: 1, writable: true, function: 100 },
                    { statename: 'Heizkreis-D.Nenntemperatur', field: 'tagtemp_D', description: 'Nenntemperatur', length: 2, factor: 1, writable: true, function: 101 }
                ]
            },
            {
                block_number: '05',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizkreis-B.Frostschutz', field: 'frost_B', description: 'Frostschutz B', length: 1, factor: 1, writable: false, function: 3 },
                    { statename: 'Heizkreis-B.HeizkreisArt', field: 'fb_B', description: 'Art HK B', length: 1, factor: 1, writable: false, function: 13 },
                    { statename: 'Heizkreis-B.Maximaltemperatur', field: 'max_B', description: 'Maximaltemp HK B', length: 2, factor: 1, writable: true, function: 15 },
                    { statename: 'Heizkreis-B.Kennlinie', field: 'steilheitB', description: 'Kennlinie HK B', length: 2, factor: 1, writable: false, function: 16 },
                    { statename: 'Heizkreis-B.Nenntemperatur', field: 'tagtemp_B', description: 'Nenntemp HK B', length: 2, factor: 1, writable: true, function: 17 },
                    { statename: 'Heizkreis-B.Spartemperatur', field: 'nachttem_B', description: 'Spartemp HK B', length: 2, factor: 1, writable: true, function: 18 },
                    { statename: 'Heizkreis-B.Betriebsart', field: 'betrieb_B', description: 'Betriebsart HK B', length: 2, factor: 1, writable: true, function: 19 },
                    { statename: 'Heizkreis-B.Raumeinfluss', field: 'einfluss_B', description: 'Raumeinfluss HK B', length: 1, factor: 1, writable: false, function: 22 },
                    { statename: 'Heizkreis-B.Minimaltemperatur', field: 'min_B', description: 'Minimaltemp HK B', length: 2, factor: 1, writable: true, function: 27 },
                    { statename: 'Heizkreis-B.AnteilRaumeinfluss', field: 'prozent_B', description: 'Anteil Raumeinfluss B', length: 2, factor: 1, writable: false, function: 30 },
                    { statename: 'Heizkreis-B.RaumeinflussVon', field: 'sensor_B', description: 'Raumeinfluss B von', length: 1, factor: 1, writable: false, function: 32 },
                    { statename: 'Heizkreis-B.MischerVorhanden', field: 'B_misch', description: 'HK B mit Mischer', length: 1, factor: 1, writable: false, function: 43 },
                    { statename: 'Heizkreis-B.Absenkfaktor', field: 'faktor_B', description: 'Absenkfaktor B', length: 2, factor: 1, writable: false, function: 51 },
                    { statename: 'Heizkreis-B.Schnellabsenkung', field: 'absenkB', description: 'Schnellabsenkung B', length: 1, factor: 1, writable: false, function: 53 },
                    { statename: 'Heizkreis-B.Konstanttemperatur', field: 'konst_B', description: 'Konstanttemp B', length: 2, factor: 1, writable: true, function: 59 }
                ]
            },
            {
                block_number: '06',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.Freigabe', field: 'wp_fg', description: 'WP-Freigabe', length: 1, factor: 1, writable: false, function: 9 },
                    { statename: '', field: 'padding2', description: 'padding', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.Schaltdifferenz', field: 'diffwp', description: 'WP Schaltdifferenz', length: 2, factor: 1, writable: false, function: 35 },
                    { statename: 'Waermepumpe.Maximaltemperatur', field: 'WP_max', description: 'WP Maximaltemp.', length: 2, factor: 1, writable: false, function: 37 },
                    { statename: 'Waermepumpe.MinimaleLaufzeit', field: 'min_LfZt', description: 'min. WP Laufzeit', length: 2, factor: 1, writable: false, function: 38 },
                    { statename: 'Waermepumpe.MinimaleStehzeit', field: 'min_StStZt', description: 'min. WP Stehzeit', length: 2, factor: 1, writable: false, function: 39 },
                    { statename: '', field: 'padding3', description: 'padding', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.MinSolewarnung', field: 'minsolwarn', description: 'min. Solewarnung', length: 2, factor: 1, writable: false, function: 40 },
                    { statename: 'Waermepumpe.MinSolealarm', field: 'minsolalrm', description: 'min. Solealarm', length: 2, factor: 1, writable: false, function: 44 }
                ]
            },
            {
                block_number: '07',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: '', field: 'padding2', description: 'padding', length: 1, factor: 1, writable: false, function: -1 },
                    { statename: 'Status.Relais01-SolePumpe', field: 'R_1', description: 'Solepumpe', length: 1, factor: 1, writable: false, function: 216 },
                    { statename: 'Status.Relais02-WP-Stufe-1', field: 'relais2', description: 'WP Stufe 1', length: 1, factor: 1, writable: false, function: 217 },
                    { statename: 'Status.Relais03-MischerA-Auf', field: 'relais3', description: 'Mischer A - auf', length: 1, factor: 1, writable: false, function: 218 },
                    { statename: 'Status.Relais04-MischerA-Zu', field: 'relais4', description: 'Mischer A - zu', length: 1, factor: 1, writable: false, function: 219 },
                    { statename: 'Status.Relais05-Prozessumkehr', field: 'relais5', description: 'Prozessumkehr', length: 1, factor: 1, writable: false, function: 220 },
                    { statename: 'Status.Relais06-Pumpe-HK-B', field: 'relais6', description: 'Pumpe Heizkreis B', length: 1, factor: 1, writable: false, function: 221 },
                    { statename: 'Status.Relais07-MischerB-Auf', field: 'relais7', description: 'Mischer B - auf', length: 1, factor: 1, writable: false, function: 222 },
                    { statename: 'Status.Relais08-MischerB-Zu', field: 'relais8', description: 'Mischer B - zu', length: 1, factor: 1, writable: false, function: 223 },
                    { statename: 'Status.Relais09-Kuehlventil', field: 'relais9', description: 'Kühlventil', length: 1, factor: 1, writable: false, function: 224 },
                    { statename: 'Status.Relais10-HG-Mischer-Auf', field: 'relais10', description: 'HG-Mischer - auf', length: 1, factor: 1, writable: false, function: 225 },
                    { statename: 'Status.Relais11-HG-Mischer-Zu', field: 'relais11', description: 'HG-Mischer - zu', length: 1, factor: 1, writable: false, function: 226 },
                    { statename: 'Status.Relais12-ZirkulationsP', field: 'relais12', description: 'Zirkulationspumpe', length: 1, factor: 1, writable: false, function: 227 },
                    { statename: 'Status.Relais13-Stoerung', field: 'relais13', description: 'Störmeldeausgang', length: 1, factor: 1, writable: false, function: 228 },
                    { statename: 'Status.Triac1-PlattenTauscherWW', field: 'triac1', description: 'Plattentauscherpumpe', length: 2, factor: 1, writable: false, function: 229 },
                    { statename: 'Status.Triac2-Ladepumpe', field: 'triac2', description: 'Ladepumpe', length: 2, factor: 1, writable: false, function: 230 },
                    { statename: 'Status.Triac3-Pumpe-HK-A', field: 'triac3', description: 'Pumpe Heizkreis A', length: 2, factor: 1, writable: false, function: 231 },
                    { statename: 'Status.Uebertemperatur', field: 'uebertemp', description: 'Übertemperatur', length: 1, factor: 1, writable: false, function: 248 },
                    { statename: 'Status.Telefonkontakt', field: 'telefon', description: 'Telefonkontakt', length: 1, factor: 1, writable: false, function: 253 },
                ]
            },
            {
                block_number: '09',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.v1', field: 'v1', description: 'v1', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.v2', field: 'v2', description: 'v2', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.v3', field: 'v3', description: 'v3', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.v4', field: 'v4', description: 'v4', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.v5', field: 'v5', description: 'v5', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.MinimaldrehzahlLadepumpe', field: 'mindrehz2', description: 'min. Drehzahl Ladepumpe', length: 2, factor: 1, writable: true, function: 62 },
                    { statename: 'Waermepumpe.v6', field: 'v6', description: 'v6', length: 2, factor: 1, writable: false, function: -1 },
                ]
            },
            {
                block_number: '0B',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Waermepumpe.SollUeberhitzung', field: 'ueberhitz1', description: 'Soll-Überhitzung', length: 2, factor: 0.1, writable: false, function: 121 },
                    { statename: 'Waermepumpe.Zykluszeit', field: 'zyklzeit', description: 'Zykluszeit', length: 2, factor: 1, writable: false, function: 122 },
                    { statename: 'Waermepumpe.Startoeffnung', field: 'startoeffn', description: 'Startöffnung', length: 2, factor: 1, writable: false, function: 123 },
                    { statename: 'Stoerungen.FehlerSchrittmotor', field: 'Err_EV', description: 'Fehler Schrittmotor', length: 1, factor: 1, writable: false, function: 271 },
                    { statename: 'Waermepumpe.FreigabeKompressor', field: 'I05_DigiIn', description: 'Freigabe Kompressor', length: 1, factor: 1, writable: false, function: 272 },
                    { statename: 'Waermepumpe.PositionE-Ventil', field: 'I05_Pos', description: 'Position E-Ventil', length: 2, factor: 1, writable: false, function: 273 },
                    { statename: 'Waermepumpe.Sauggastemperatur', field: 'sauggas', description: 'Sauggastemperatur', length: 2, factor: 0.01, writable: false, function: 274 },
                    { statename: 'Waermepumpe.Sauggasdruck', field: 'saugp', description: 'Sauggasdruck', length: 2, factor: 0.1, writable: false, function: 275 },
                    { statename: 'Waermepumpe.IstUeberhitzung', field: 'ueberhitz', description: 'Ist-Überhitzung', length: 2, factor: 0.01, writable: false, function: 276 },
                ]
            },
            {
                block_number: '0C',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Zeit.Sekunde', field: 'Sekunde', description: 'Sekunde', length: 1, factor: 1, writable: false, function: 202 },
                    { statename: 'Zeit.Minute', field: 'Minute', description: 'Minute', length: 1, factor: 1, writable: false, function: 203 },
                    { statename: 'Zeit.Stunde', field: 'Stunde', description: 'Stunde', length: 1, factor: 1, writable: false, function: 204 },
                    { statename: 'Zeit.Tag', field: 'Tag', description: 'Tag', length: 1, factor: 1, writable: false, function: 205 },
                    { statename: 'Zeit.Monat', field: 'Monat', description: 'Monat', length: 1, factor: 1, writable: false, function: 206 },
                    { statename: 'Zeit.Jahr', field: 'Jahr', description: 'Jahr', length: 2, factor: 1, writable: false, function: 236 },
                ]
            },
            {
                block_number: '0D',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizung.Aussentemperatur', field: 'aussentemp', description: 'Außentemperatur', length: 2, factor: 1, writable: false, function: 207 },
                    { statename: 'Warmwasser.Zapftemperatur', field: 'Zapftemp', description: 'Zapftemperatur', length: 2, factor: 1, writable: false, function: 208 },
                    { statename: 'Warmwasser.Speichertemperatur', field: 'Speichtemp', description: 'Speichertemperatur', length: 2, factor: 1, writable: false, function: 209 },
                    { statename: 'Heizkreis-A.SollVorlauftemperatur', field: 'solltemp_A', description: 'Soll-Vorlauf A', length: 2, factor: 1, writable: false, function: 211 },
                    { statename: 'Heizkreis-B.SollVorlauftemperatur', field: 'solltemp_B', description: 'Soll-Vorlauf B', length: 2, factor: 1, writable: false, function: 212 },
                    { statename: 'Waermepumpe.Vorlauftemperatur', field: 'WP_Temp', description: 'WP-Vorlauf', length: 2, factor: 1, writable: false, function: 213 },
                    { statename: 'Waermepumpe.Ruecklauftemperatur', field: 'WP_RL', description: 'WP-Rücklauf', length: 2, factor: 1, writable: false, function: 214 },
                    { statename: 'Heizkreis-A.Raumtemperatur', field: 'raum_A', description: 'Raumtemperatur A', length: 2, factor: 0.1, writable: false, function: 233 },
                    { statename: 'Heizkreis-B.Raumtemperatur', field: 'raum_B', description: 'Raumtemperatur B', length: 2, factor: 0.1, writable: false, function: 234 },
                    { statename: 'Heizkreis-A.Vorlauftemperatur', field: 'Vorl_A', description: 'Vorlauf Heizkreis A', length: 2, factor: 1, writable: false, function: 249 },
                    { statename: 'Heizkreis-B.Vorlauftemperatur', field: 'Vorl_B', description: 'Vorlauf Heizkreis B', length: 2, factor: 1, writable: false, function: 250 },
                    { statename: 'Waermepumpe.SoleTemperatur', field: 'Sole_Temp', description: 'Sole-Austrittstemp.', length: 2, factor: 1, writable: false, function: 258 },
                    { statename: 'Waermepumpe.HGTemperatur', field: 'hg_temp', description: 'HG-Temperatur', length: 2, factor: 0.1, writable: false, function: 254 },
                ]
            },
            {
                block_number: '0E',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Heizung.Sommerbetrieb', field: 'sommer', description: 'Sommerbetrieb', length: 1, factor: 1, writable: false, function: 210 },
                    { statename: 'Stoerungen.Fuehlerdefekt', field: 'error3', description: 'Fühlerdefekt', length: 1, factor: 1, writable: false, function: 215 },
                    { statename: 'Stoerungen.Hochdruckwarnung', field: 'HD_Warn', description: 'Hochdruckstörung', length: 1, factor: 1, writable: false, function: 237 },
                    { statename: 'Stoerungen.Niederdruckwarnung', field: 'ND_Warn', description: 'Niederdruckstörung', length: 1, factor: 1, writable: false, function: 238 },
                    { statename: 'Stoerungen.Thermorelais', field: 'Thermwarn', description: 'Thermorelaisstörung', length: 1, factor: 1, writable: false, function: 239 },
                    { statename: 'Stoerungen.SoleZuKalt', field: 'Inputwarn', description: 'Sole zu kalt', length: 1, factor: 1, writable: false, function: 240 },
                    { statename: 'Stoerungen.VerhaeltnisStundenImpulse', field: 'error4', description: 'Verhältnis Std/Imp', length: 1, factor: 1, writable: false, function: 241 },
                    { statename: 'Stoerungen.SpreizungZuHoch', field: 'WP_warn', description: 'Spreizung zu hoch', length: 1, factor: 1, writable: false, function: 242 },
                    { statename: 'Heizung.Sperrzeit', field: 'sperrzeit', description: 'Sperrzeit', length: 1, factor: 1, writable: false, function: 246 },
                    { statename: 'Heizung.Kuehlfunktion', field: 'cool', description: 'Kühlfuntion', length: 1, factor: 1, writable: false, function: 247 },
                    { statename: 'Warmwasser.Vorrangschaltung', field: 'vorrang', description: 'Vorrangschaltung', length: 1, factor: 1, writable: false, function: 251 },
                ]
            }
        ]
    }
};

module.exports = idm_datablocks;
