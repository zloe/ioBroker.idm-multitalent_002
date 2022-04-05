// definition of the idm data blocks

const idm_datablocks = {
    idm701100: ['03', '04', '05', '06', '07', '08', '09', '0A', '0B'],
    idm701100_data: {
        version: 'idm701100',
        data_blocks: [
            {
                block_number: '03',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Warmwasser.Sollwert', field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1, writable: true, function: 1 },
                    { statename: 'Heizung.SommerWinterUmschaltTemp', field: 'So_Wi_temp', description: 'Sommer-Winter-Umsch.', length: 2, factor: 1, writable: false, function: 4 },
                    { statename: 'Heizung.AutomatischeWPZuschaltung', field: 'autowp', description: 'autom. WP Zuschaltung', length: 1, factor: 1, writable: false, function: 12 },
                    { statename: 'Waermepumpe.ZuschaltZeit', field: 'zuzeit', description: 'WP Zuschaltzeit', length: 2, factor: 1, writable: false, function: 20 },
                    { statename: 'Heizung.Notebetrieb', field: 'notbetrieb', description: 'Notbetrieb', length: 1, factor: 1, writable: false, function: 24 },
                    { statename: 'Heizung.BadSommerbetrieb', field: 'badsommer', description: 'Bad-Sommerbetrieb', length: 1, factor: 1, writable: false, function: 25 },
                    { statename: 'Heizung.MinDrehzahlHZK-Pumpe', field: 'mindrehz', description: 'min. Drehzahl HZK-Pumpe', length: 2, factor: 1, writable: false, function: 48 },
                    { statename: 'Heizung.SchichttrennplatteVorhanden', field: 'schichtpl', description: 'Schichttrennplatte', length: 1, factor: 1, writable: false, function: 55 },
                    { statename: 'Heizung.PufferVorhanden', field: 'puffer', description: 'Puffer vorhanden', length: 1, factor: 1, writable: false, function: 56 },
                    { statename: 'Heizung.LaufzeitZirkulation', field: 'zirkzeit', description: 'Laufzeit Zirkulation', length: 2, factor: 1, writable: false, function: 57 },
                    { statename: 'Heizung.HGL-Temperatur', field: 'HGL_temp', description: 'gew. HGL-Temperatur', length: 2, factor: 0.1, writable: false, function: 66 },
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
                    { statename: 'Heizkreis-A.Maximaltemperatur', field: 'max_A', description: 'Maxtemp HK A', length: 2, factor: 1, writable: false, function: 14 },
                    { statename: 'Heizkreis-A.Raumeinfluss', field: 'einfluss_A', description: 'Raumeinfluss HK A', length: 1, factor: 1, writable: false, function: 21 },
                    { statename: 'Warmwasser.Betriebsart', field: 'betrieb_WW', description: 'Betriebsart Warmwasser', length: 1, factor: 1, writable: true, function: 23 },
                    { statename: 'Heizkreis-A.Minimaltemperatur', field: 'min_A', description: 'Mintemp HK A', length: 2, factor: 1, writable: false, function: 26 },
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
                    { statename: 'Heizkreis-B.Maximaltemperatur', field: 'max_B', description: 'Maximaltemp HK B', length: 2, factor: 1, writable: false, function: 15 },
                    { statename: 'Heizkreis-B.Kennlinie', field: 'steilheitB', description: 'Kennlinie HK B', length: 2, factor: 1, writable: false, function: 16 },
                    { statename: 'Heizkreis-B.Nenntemperatur', field: 'tagtemp_B', description: 'Nenntemp HK B', length: 2, factor: 1, writable: true, function: 17 },
                    { statename: 'Heizkreis-B.Spartemperatur', field: 'nachttem_B', description: 'Spartemp HK B', length: 2, factor: 1, writable: true, function: 18 },
                    { statename: 'Heizkreis-B.Betriebsart', field: 'betrieb_B', description: 'Betriebsart HK B', length: 2, factor: 1, writable: true, function: 19 },
                    { statename: 'Heizkreis-B.Raumeinfluss', field: 'einfluss_B', description: 'Raumeinfluss HK B', length: 1, factor: 1, writable: false, function: 22 },
                    { statename: 'Heizkreis-B.Minimaltemperatur', field: 'min_B', description: 'Minimaltemp HK B', length: 2, factor: 1, writable: false, function: 27 },
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
                    { statename: 'Waermepumpe.Maximaltemperatur', field: 'WP_max', description: 'WP Maximaltemp.', length: 2, factor: 1, writable: false, function: 37 },
                    { statename: 'Waermepumpe.MinimaleLaufzeit', field: 'min_LfZt', description: 'min. WP Laufzeit', length: 2, factor: 1, writable: false, function: 38 },
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
                    { statename: 'Status.Relais1', field: 'relais1', description: 'Relais1 Solepumpe', length: 1, factor: 1, writable: false, function: 116 },
                    { statename: 'Status.Relais2', field: 'relais2', description: 'Relais2 WP Stufe 1', length: 1, factor: 1, writable: false, function: 117 },
                    { statename: 'Status.Relais3', field: 'relais3', description: 'Relais3 Mischer A - auf', length: 1, factor: 1, writable: false, function: 118 },
                    { statename: 'Status.Relais4', field: 'relais4', description: 'Relais4 Mischer A - zu', length: 1, factor: 1, writable: false, function: 119 },
                    { statename: 'Status.Relais5', field: 'relais5', description: 'Relais5 WP Stufe 2', length: 1, factor: 1, writable: false, function: 120 },
                    { statename: 'Status.Relais6', field: 'relais6', description: 'Relais6 Pumpe Heizkreis B', length: 1, factor: 1, writable: false, function: 121 },
                    { statename: 'Status.Relais7', field: 'relais7', description: 'Relais7 Mischer B - auf', length: 1, factor: 1, writable: false, function: 122 },
                    { statename: 'Status.Relais8', field: 'relais8', description: 'Relais8 Mischer B - zu', length: 1, factor: 1, writable: false, function: 123 },
                    { statename: 'Status.Relais9', field: 'relais9', description: 'Relais9 Kühlventil', length: 1, factor: 1, writable: false, function: 124 },
                    { statename: 'Status.Relais10', field: 'relais10', description: 'Relais10 HG-Mischer - auf', length: 1, factor: 1, writable: false, function: 125 },
                    { statename: 'Status.Relais11', field: 'relais11', description: 'Relais11 HG-Mischer - zu', length: 1, factor: 1, writable: false, function: 126 },
                    { statename: 'Status.Relais12', field: 'relais12', description: 'Relais12 Zirkulationspumpe', length: 1, factor: 1, writable: false, function: 127 },
                    { statename: 'Status.Relais13', field: 'relais13', description: 'Relais13 Störmeldeausgang', length: 1, factor: 1, writable: false, function: 128 },
                    { statename: 'Status.Triac1', field: 'triac1', description: 'Triac Plattentauscherpumpe', length: 2, factor: 1, writable: false, function: 129 },
                    { statename: 'Status.Triac2', field: 'triac2', description: 'Triac Ladepumpe', length: 2, factor: 1, writable: false, function: 130 },
                    { statename: 'Status.Triac3', field: 'triac3', description: 'Triac Pumpe Heizkreis A', length: 2, factor: 1, writable: false, function: 131 },
                    { statename: 'Status.Uebertemperatur', field: 'uebertemp', description: 'Störung Übertemperatur', length: 1, factor: 1, writable: false, function: 148 },
                    { statename: 'Status.Telefonkontakt', field: 'telefon', description: 'Telefonkontakt', length: 1, factor: 1, writable: false, function: 153 }
                ]
            },
            {
                block_number: '08',
                definition: [
                    { statename: 'Kuehlung-A.Freigabe', field: 'cool_onA', description: 'Kühlung freig A', length: 1, factor: 1, writable: false, function: 45 },
                    { statename: 'Kuehlung-A.Raumtemperatur', field: 'cool_A', description: 'Raumtemp. Kühl A', length: 2, factor: 0.1, writable: false, function: 46 },
                    { statename: 'Kuehlung-A.Schaltdifferenz', field: 'diffco_A', description: 'Schaltdiff. Kühlung A', length: 2, factor: 0.1, writable: false, function: 47 },
                    { statename: 'Kuehlung-A.Minimaltemperatur', field: 'mincoolA', description: 'min. Kühlkreistemp A', length: 2, factor: 1, writable: false, function: 49 },
                    { statename: 'Kuehlung-B.Raumtemperatur', field: 'cool_B', description: 'Raumtemp. Kühlg.', length: 2, factor: 0.1, writable: false, function: 61 },
                    { statename: 'Kuehlung-B.Minimaltemperatur', field: 'mincoolB', description: 'Kühlkreistemperatur', length: 2, factor: 1, writable: false, function: 68 },
                    { statename: 'Kuehlung-B.Schaltdifferenz', field: 'diffco_B', description: 'Schaltdiff. Kühlung', length: 2, factor: 0.1, writable: false, function: 69 },
                    { statename: 'Kuehlung-B.Freigabe', field: 'cool_onB', description: 'Kühlung freigegeben', length: 1, factor: 1, writable: false, function: 70 }
                ]
            },
            {
                block_number: '09',
                definition: [
                    { statename: 'Waermepumpe.MinimaldrehzahlLadepumpe', field: 'mindrehz2', description: 'min. Drehzahl Ladepumpe', length: 2, factor: 1, writable: false, function: 62 },
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
                    { statename: 'Warmwasser.Vorrangschaltung', field: 'vorrang', description: 'Vorrangschaltung', length: 1, factor: 1, writable: false, function: 151 }
                ]
            }
        ]

    },
    idm712100: ['03', '04', '05', '06', '07', '08', '09', '0A', '0B', '0C'],
    idm712100_data: {
        version: 'idm712100',
        data_blocks: [
            {
                block_number: '03',
                definition: [
                    { statename: '', field: 'padding', description: 'padding', length: 2, factor: 1, writable: false, function: -1 },
                    { statename: 'Warmwasser.Sollwert', field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1, writable: true, function: 1 },
                    { statename: 'Heizung.SommerWinterUmschaltTemp', field: 'So_Wi_temp', description: 'Sommer-Winter-Umsch.', length: 2, factor: 1, writable: false, function: 4 },
                    { statename: 'Heizung.AutomatischeWPZuschaltung', field: 'autowp', description: 'autom. WP Zuschaltung', length: 1, factor: 1, writable: false, function: 12 },
                    { statename: 'Waermepumpe.ZuschaltZeit', field: 'zuzeit', description: 'WP Zuschaltzeit', length: 2, factor: 1, writable: false, function: 20 },
                    { statename: 'Heizung.Notebetrieb', field: 'notbetrieb', description: 'Notbetrieb', length: 1, factor: 1, writable: false, function: 24 },
                    { statename: 'Heizung.BadSommerbetrieb', field: 'badsommer', description: 'Bad-Sommerbetrieb', length: 1, factor: 1, writable: false, function: 25 },
                    { statename: 'Heizung.MinDrehzahlHZK-Pumpe', field: 'mindrehz', description: 'min. Drehzahl HZK-Pumpe', length: 2, factor: 1, writable: false, function: 48 },
                    { statename: 'Heizung.SchichttrennplatteVorhanden', field: 'schichtpl', description: 'Schichttrennplatte', length: 1, factor: 1, writable: false, function: 55 },
                    { statename: 'Heizung.PufferVorhanden', field: 'puffer', description: 'Puffer vorhanden', length: 1, factor: 1, writable: false, function: 56 },
                    { statename: 'Heizung.LaufzeitZirkulation', field: 'zirkzeit', description: 'Laufzeit Zirkulation', length: 2, factor: 1, writable: false, function: 57 },
                    { statename: 'Heizung.HGL-Temperatur', field: 'HGL_temp', description: 'gew. HGL-Temperatur', length: 2, factor: 0.1, writable: false, function: 66 },
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
                    { statename: 'Heizkreis-A.Maximaltemperatur', field: 'max_A', description: 'Maxtemp HK A', length: 2, factor: 1, writable: false, function: 14 },
                    { statename: 'Heizkreis-A.Raumeinfluss', field: 'einfluss_A', description: 'Raumeinfluss HK A', length: 1, factor: 1, writable: false, function: 21 },
                    { statename: 'Warmwasser.Betriebsart', field: 'betrieb_WW', description: 'Betriebsart Warmwasser', length: 1, factor: 1, writable: true, function: 23 },
                    { statename: 'Heizkreis-A.Minimaltemperatur', field: 'min_A', description: 'Mintemp HK A', length: 2, factor: 1, writable: false, function: 26 },
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
                    { statename: 'Heizkreis-B.Maximaltemperatur', field: 'max_B', description: 'Maximaltemp HK B', length: 2, factor: 1, writable: false, function: 15 },
                    { statename: 'Heizkreis-B.Kennlinie', field: 'steilheitB', description: 'Kennlinie HK B', length: 2, factor: 1, writable: false, function: 16 },
                    { statename: 'Heizkreis-B.Nenntemperatur', field: 'tagtemp_B', description: 'Nenntemp HK B', length: 2, factor: 1, writable: true, function: 17 },
                    { statename: 'Heizkreis-B.Spartemperatur', field: 'nachttem_B', description: 'Spartemp HK B', length: 2, factor: 1, writable: true, function: 18 },
                    { statename: 'Heizkreis-B.Betriebsart', field: 'betrieb_B', description: 'Betriebsart HK B', length: 2, factor: 1, writable: true, function: 19 },
                    { statename: 'Heizkreis-B.Raumeinfluss', field: 'einfluss_B', description: 'Raumeinfluss HK B', length: 1, factor: 1, writable: false, function: 22 },
                    { statename: 'Heizkreis-B.Minimaltemperatur', field: 'min_B', description: 'Minimaltemp HK B', length: 2, factor: 1, writable: false, function: 27 },
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
                    { statename: 'Waermepumpe.Maximaltemperatur', field: 'WP_max', description: 'WP Maximaltemp.', length: 2, factor: 1, writable: false, function: 37 },
                    { statename: 'Waermepumpe.MinimaleLaufzeit', field: 'min_LfZt', description: 'min. WP Laufzeit', length: 2, factor: 1, writable: false, function: 38 },
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
                    { statename: 'Status.Relais1', field: 'relais1', description: 'Relais1 Solepumpe', length: 1, factor: 1, writable: false, function: 116 },
                    { statename: 'Status.Relais2', field: 'relais2', description: 'Relais2 WP Stufe 1', length: 1, factor: 1, writable: false, function: 117 },
                    { statename: 'Status.Relais3', field: 'relais3', description: 'Relais3 Mischer A - auf', length: 1, factor: 1, writable: false, function: 118 },
                    { statename: 'Status.Relais4', field: 'relais4', description: 'Relais4 Mischer A - zu', length: 1, factor: 1, writable: false, function: 119 },
                    { statename: 'Status.Relais5', field: 'relais5', description: 'Relais5 WP Stufe 2', length: 1, factor: 1, writable: false, function: 120 },
                    { statename: 'Status.Relais6', field: 'relais6', description: 'Relais6 Pumpe Heizkreis B', length: 1, factor: 1, writable: false, function: 121 },
                    { statename: 'Status.Relais7', field: 'relais7', description: 'Relais7 Mischer B - auf', length: 1, factor: 1, writable: false, function: 122 },
                    { statename: 'Status.Relais8', field: 'relais8', description: 'Relais8 Mischer B - zu', length: 1, factor: 1, writable: false, function: 123 },
                    { statename: 'Status.Relais9', field: 'relais9', description: 'Relais9 Kühlventil', length: 1, factor: 1, writable: false, function: 124 },
                    { statename: 'Status.Relais10', field: 'relais10', description: 'Relais10 HG-Mischer - auf', length: 1, factor: 1, writable: false, function: 125 },
                    { statename: 'Status.Relais11', field: 'relais11', description: 'Relais11 HG-Mischer - zu', length: 1, factor: 1, writable: false, function: 126 },
                    { statename: 'Status.Relais12', field: 'relais12', description: 'Relais12 Zirkulationspumpe', length: 1, factor: 1, writable: false, function: 127 },
                    { statename: 'Status.Relais13', field: 'relais13', description: 'Relais13 Störmeldeausgang', length: 1, factor: 1, writable: false, function: 128 },
                    { statename: 'Status.Triac1', field: 'triac1', description: 'Triac Plattentauscherpumpe', length: 2, factor: 1, writable: false, function: 129 },
                    { statename: 'Status.Triac2', field: 'triac2', description: 'Triac Ladepumpe', length: 2, factor: 1, writable: false, function: 130 },
                    { statename: 'Status.Triac3', field: 'triac3', description: 'Triac Pumpe Heizkreis A', length: 2, factor: 1, writable: false, function: 131 },
                    { statename: 'Status.Uebertemperatur', field: 'uebertemp', description: 'Störung Übertemperatur', length: 1, factor: 1, writable: false, function: 148 },
                    { statename: 'Status.Telefonkontakt', field: 'telefon', description: 'Telefonkontakt', length: 1, factor: 1, writable: false, function: 153 }
                ]
            },
            {
                block_number: '08',
                definition: [
                    { statename: 'Kuehlung-A.Freigabe', field: 'cool_onA', description: 'Kühlung freig A', length: 1, factor: 1, writable: false, function: 45 },
                    { statename: 'Kuehlung-A.Raumtemperatur', field: 'cool_A', description: 'Raumtemp. Kühl A', length: 2, factor: 0.1, writable: false, function: 46 },
                    { statename: 'Kuehlung-A.Schaltdifferenz', field: 'diffco_A', description: 'Schaltdiff. Kühlung A', length: 2, factor: 0.1, writable: false, function: 47 },
                    { statename: 'Kuehlung-A.Minimaltemperatur', field: 'mincoolA', description: 'min. Kühlkreistemp A', length: 2, factor: 1, writable: false, function: 49 },
                    { statename: 'Kuehlung-B.Raumtemperatur', field: 'cool_B', description: 'Raumtemp. Kühlg.', length: 2, factor: 0.1, writable: false, function: 61 },
                    { statename: 'Kuehlung-B.Minimaltemperatur', field: 'mincoolB', description: 'Kühlkreistemperatur', length: 2, factor: 1, writable: false, function: 68 },
                    { statename: 'Kuehlung-B.Schaltdifferenz', field: 'diffco_B', description: 'Schaltdiff. Kühlung', length: 2, factor: 0.1, writable: false, function: 69 },
                    { statename: 'Kuehlung-B.Freigabe', field: 'cool_onB', description: 'Kühlung freigegeben', length: 1, factor: 1, writable: false, function: 70 }
                ]
            },
            {
                block_number: '09',
                definition: [
                    { statename: 'Waermepumpe.MinimaldrehzahlLadepumpe', field: 'mindrehz2', description: 'min. Drehzahl Ladepumpe', length: 2, factor: 1, writable: false, function: 62 },
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

    }
};

module.exports = idm_datablocks;
