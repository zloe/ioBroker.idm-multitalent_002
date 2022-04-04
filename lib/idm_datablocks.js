

const idm_datablocks = {
    idm701100: ['03', '04', '05', '06', '07', '08', '09', '0A', '0B'],
    idm701100_data: {
        version: 'idm701100',
        data_blocks: [
            {
                block_number: '03',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1 },
                    { field: 'So_Wi_temp', description: 'Sommer-Winter-Umsch.', length: 2, factor: 1 },
                    { field: 'autowp', description: 'autom. WP Zuschaltung', length: 1, factor: 1 },
                    { field: 'zuzeit', description: 'WP Zuschaltzeit', length: 2, factor: 1 },
                    { field: 'notbetrieb', description: 'Notbetrieb', length: 1, factor: 1 },
                    { field: 'badsommer', description: 'Bad-Sommerbetrieb', length: 1, factor: 1 },
                    { field: 'mindrehz', description: 'min. Drehzahl HZK-Pumpe', length: 2, factor: 1 },
                    { field: 'schichtpl', description: 'Schichttrennplatte', length: 1, factor: 1 },
                    { field: 'puffer', description: 'Puffer vorhanden', length: 1, factor: 1 },
                    { field: 'zirkzeit', description: 'Laufzeit Zirkulation', length: 2, factor: 1 },
                    { field: 'HGL_temp', description: 'gew. HGL-Temperatur', length: 2, factor: 0.1 },
                    { field: 'telkontakt', description: 'Funktion ext. Kontakt', length: 2, factor: 1 },
                    { field: 'restzeit', description: 'Restzeit?', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '04',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'frost_A', description: 'Frostschutz A', length: 1, factor: 1 },
                    { field: 'steilheitA', description: 'Kennlinie HK A', length: 2, factor: 1 },
                    { field: 'tagtempA', description: 'Nenntemp HK A', length: 2, factor: 1 },
                    { field: 'nachttem_A', description: 'Spartemp HK A', length: 2, factor: 1 },
                    { field: 'fb_A', description: 'Art HK A', length: 1, factor: 1 },
                    { field: 'betrieb_A', description: 'Betriebsart HK A', length: 2, factor: 1 },
                    { field: 'max_A', description: 'Maxtemp HK A', length: 2, factor: 1 },
                    { field: 'einfluss_A', description: 'Raumeinfluss HK A', length: 1, factor: 1 },
                    { field: 'betrieb_WW', description: 'Betriebsart Warmwasser', length: 1, factor: 1 },
                    { field: 'min_A', description: 'Mintemp HK A', length: 2, factor: 1 },
                    { field: 'prozent_A', description: 'Anteil Raumeinfluss A', length: 2, factor: 1 },
                    { field: 'sensor_A', description: 'Raumeinfluss A von', length: 1, factor: 1 },
                    { field: 'einflAauf', description: 'Raumeinfluss A auf', length: 1, factor: 1 },
                    { field: 'A_misch', description: 'HK A mit Mischer', length: 1, factor: 1 },
                    { field: 'faktor_A', description: 'Absenkfaktor A', length: 2, factor: 1 },
                    { field: 'absenkA', description: 'Schnellabsenkung A', length: 1, factor: 1 },
                    { field: 'konst_A', description: 'Konstanttemp A', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '05',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'frost_B', description: 'Frostschutz B', length: 1, factor: 1 },
                    { field: 'fb_B', description: 'Art HK B', length: 1, factor: 1 },
                    { field: 'max_B', description: 'Maximaltemp HK B', length: 2, factor: 1 },
                    { field: 'steilheitB', description: 'Kennlinie HK B', length: 2, factor: 1 },
                    { field: 'tagtemp_B', description: 'Nenntemp HK B', length: 2, factor: 1 },
                    { field: 'nachttem_B', description: 'Spartemp HK B', length: 2, factor: 1 },
                    { field: 'betrieb_B', description: 'Betriebsart HK B', length: 2, factor: 1 },
                    { field: 'einfluss_B', description: 'Raumeinfluss HK B', length: 1, factor: 1 },
                    { field: 'min_B', description: 'Minimaltemp HK B', length: 2, factor: 1 },
                    { field: 'prozent_B', description: 'Anteil Raumeinfluss B', length: 2, factor: 1 },
                    { field: 'sensor_B', description: 'Raumeinfluss B von', length: 1, factor: 1 },
                    { field: 'einflBauf', description: 'Raumeinfluss B auf', length: 1, factor: 1 },
                    { field: 'B_misch', description: 'HK B mit Mischer', length: 1, factor: 1 },
                    { field: 'faktor_B', description: 'Absenkfaktor B', length: 2, factor: 1 },
                    { field: 'absenkB', description: 'Schnellabsenkung B', length: 1, factor: 1 },
                    { field: 'konst_B', description: 'Konstanttemp B', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '06',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'wp_fg', description: 'WP-Freigabe', length: 1, factor: 1 },
                    { field: 'wp', description: 'wp?', length: 1, factor: 1 },
                    { field: 'diffwp', description: 'WP Schaltdifferenz', length: 2, factor: 1 },
                    { field: 'wp_kund', description: 'WP-Freigabe Kunde', length: 1, factor: 1 },
                    { field: 'WP_max', description: 'WP Maximaltemp.', length: 2, factor: 1 },
                    { field: 'min_LfZt', description: 'min. WP Laufzeit', length: 2, factor: 1 },
                    { field: 'min_StStZt', description: 'min. WP Stehzeit', length: 2, factor: 1 },
                    { field: 'minsolwarn', description: 'min. Solewarnung', length: 2, factor: 1 },
                    { field: 'maxSpreiz', description: 'max Spreizung', length: 2, factor: 1 },
                    { field: 'minsolalrm', description: 'min. Solealarm', length: 2, factor: 1 },
                    { field: 'ausgleich', description: 'Betriebsstundenausgleich', length: 1, factor: 1 },
                    { field: 'Sole_min', description: 'min Soletemp', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '07',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'relais1', description: 'Relais1 Solepumpe', length: 1, factor: 1 },
                    { field: 'relais2', description: 'Relais2 WP Stufe 1', length: 1, factor: 1 },
                    { field: 'relais3', description: 'Relais3 Mischer A - auf', length: 1, factor: 1 },
                    { field: 'relais4', description: 'Relais4 Mischer A - zu', length: 1, factor: 1 },
                    { field: 'relais5', description: 'Relais5 WP Stufe 2', length: 1, factor: 1 },
                    { field: 'relais6', description: 'Relais6 Pumpe Heizkreis B', length: 1, factor: 1 },
                    { field: 'relais7', description: 'Relais7 Mischer B - auf', length: 1, factor: 1 },
                    { field: 'relais8', description: 'Relais8 Mischer B - zu', length: 1, factor: 1 },
                    { field: 'relais9', description: 'Relais9 Kühlventil', length: 1, factor: 1 },
                    { field: 'relais10', description: 'Relais10 HG-Mischer - auf', length: 1, factor: 1 },
                    { field: 'relais11', description: 'Relais11 HG-Mischer - zu', length: 1, factor: 1 },
                    { field: 'relais12', description: 'Relais12 Zirkulationspumpe', length: 1, factor: 1 },
                    { field: 'relais13', description: 'Relais13 Störmeldeausgang', length: 1, factor: 1 },
                    { field: 'triac1', description: 'Triac Plattentauscherpumpe', length: 2, factor: 1 },
                    { field: 'triac2', description: 'Triac Ladepumpe', length: 2, factor: 1 },
                    { field: 'triac3', description: 'Triac Pumpe Heizkreis A', length: 2, factor: 1 },
                    { field: 'uebertemp', description: 'Störung Übertemperatur', length: 1, factor: 1 },
                    { field: 'telefon', description: 'Telefonkontakt', length: 1, factor: 1 }
                ]
            },
            {
                block_number: '08',
                definition: [
                    { field: 'cool_onA', description: 'Kühlung freig A', length: 1, factor: 1 },
                    { field: 'cool_A', description: 'Raumtemp. Kühl A', length: 2, factor: 0.1 },
                    { field: 'diffco_A', description: 'Schaltdiff. Kühlung A', length: 2, factor: 0.1 },
                    { field: 'mincoolA', description: 'min. Kühlkreistemp A', length: 2, factor: 1 },
                    { field: 'cool_B', description: 'Raumtemp. Kühlg.', length: 2, factor: 0.1 },
                    { field: 'mincoolB', description: 'Kühlkreistemperatur', length: 2, factor: 1 },
                    { field: 'diffco_B', description: 'Schaltdiff. Kühlung', length: 2, factor: 0.1 },
                    { field: 'cool_onB', description: 'Kühlung freigegeben', length: 1, factor: 1 }
                ]
            },
            {
                block_number: '09',
                definition: [
                    { field: 'mindrehz2', description: 'min. Drehzahl Ladepumpe', length: 2, factor: 1 },
                    { field: 'Sekunde', description: 'Sekunde', length: 1, factor: 1 },
                    { field: 'Minute', description: 'Minute', length: 1, factor: 1 },
                    { field: 'Stunde', description: 'Stunde', length: 1, factor: 1 },
                    { field: 'Tag', description: 'Tag', length: 1, factor: 1 },
                    { field: 'Monat', description: 'Monat', length: 1, factor: 1 },
                    { field: 'Jahr', description: 'Jahr', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '0A',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'aussentemp', description: 'Außentemperatur', length: 2, factor: 1 },
                    { field: 'Zapftemp', description: 'Zapftemperatur', length: 2, factor: 1 },
                    { field: 'Speichtemp', description: 'Speichertemperatur', length: 2, factor: 1 },
                    { field: 'solltemp_A', description: 'Soll-Vorlauf A', length: 2, factor: 1 },
                    { field: 'solltemp_B', description: 'Soll-Vorlauf B', length: 2, factor: 1 },
                    { field: 'WP_Temp', description: 'WP-Vorlauf', length: 2, factor: 1 },
                    { field: 'WP_RL', description: 'WP-Rücklauf', length: 2, factor: 1 },
                    { field: 'raum_A', description: 'Raumtemperatur A', length: 2, factor: 0.1 },
                    { field: 'raum_B', description: 'Raumtemperatur B', length: 2, factor: 0.1 },
                    { field: 'Vorl_A', description: 'Vorlauf Heizkreis A', length: 2, factor: 1 },
                    { field: 'Vorl_B', description: 'Vorlauf Heizkreis B', length: 2, factor: 1 },
                    { field: 'WP_Temp2', description: 'WP_Temp2?', length: 2, factor: 1 },
                    { field: 'hg_temp', description: 'HG-Temperatur', length: 2, factor: 0.1 },
                    { field: 'Sole_Temp', description: 'Sole-Austrittstemp.', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '0B',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'sommer', description: 'Sommerbetrieb', length: 1, factor: 1 },
                    { field: 'error3', description: 'Störung Fühlerdefekt', length: 1, factor: 1 },
                    { field: 'error1', description: 'error1?', length: 1, factor: 1 },
                    { field: 'HD_Warn', description: 'Hochdruckstörung', length: 1, factor: 1 },
                    { field: 'ND_Warn', description: 'Niederdruckstörung', length: 1, factor: 1 },
                    { field: 'Thermwarn', description: 'Störung Thermorelais', length: 1, factor: 1 },
                    { field: 'Inputwarn', description: 'Störung Sole zu kalt', length: 1, factor: 1 },
                    { field: 'error4', description: 'Störung Verhältnis Std/Imp', length: 1, factor: 1 },
                    { field: 'WP_warn', description: 'Störung Spreizung zu hoch', length: 1, factor: 1 },
                    { field: 'sperrzeit', description: 'Sperrzeit', length: 1, factor: 1 },
                    { field: 'cool', description: 'Kühlfuntion', length: 1, factor: 1 },
                    { field: 'vorrang', description: 'Vorrangschaltung', length: 1, factor: 1 }
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
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'WW_soll', description: 'Warmwasser-Sollwert', length: 2, factor: 1 },
                    { field: 'So_Wi_temp', description: 'Sommer-Winter-Umsch.', length: 2, factor: 1 },
                    { field: 'autowp', description: 'autom. WP Zuschaltung', length: 1, factor: 1 },
                    { field: 'zuzeit', description: 'WP Zuschaltzeit', length: 2, factor: 1 },
                    { field: 'notbetrieb', description: 'Notbetrieb', length: 1, factor: 1 },
                    { field: 'badsommer', description: 'Bad-Sommerbetrieb', length: 1, factor: 1 },
                    { field: 'mindrehz', description: 'min. Drehzahl HZK-Pumpe', length: 2, factor: 1 },
                    { field: 'schichtpl', description: 'Schichttrennplatte', length: 1, factor: 1 },
                    { field: 'puffer', description: 'Puffer vorhanden', length: 1, factor: 1 },
                    { field: 'zirkzeit', description: 'Laufzeit Zirkulation', length: 2, factor: 1 },
                    { field: 'HGL_temp', description: 'gew. HGL-Temperatur', length: 2, factor: 0.1 },
                    { field: 'telkontakt', description: 'Funktion ext. Kontakt', length: 2, factor: 1 },
                    { field: 'restzeit', description: 'Restzeit?', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '04',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'frost_A', description: 'Frostschutz A', length: 1, factor: 1 },
                    { field: 'steilheitA', description: 'Kennlinie HK A', length: 2, factor: 1 },
                    { field: 'tagtempA', description: 'Nenntemp HK A', length: 2, factor: 1 },
                    { field: 'nachttem_A', description: 'Spartemp HK A', length: 2, factor: 1 },
                    { field: 'fb_A', description: 'Art HK A', length: 1, factor: 1 },
                    { field: 'betrieb_A', description: 'Betriebsart HK A', length: 2, factor: 1 },
                    { field: 'max_A', description: 'Maxtemp HK A', length: 2, factor: 1 },
                    { field: 'einfluss_A', description: 'Raumeinfluss HK A', length: 1, factor: 1 },
                    { field: 'betrieb_WW', description: 'Betriebsart Warmwasser', length: 1, factor: 1 },
                    { field: 'min_A', description: 'Mintemp HK A', length: 2, factor: 1 },
                    { field: 'prozent_A', description: 'Anteil Raumeinfluss A', length: 2, factor: 1 },
                    { field: 'sensor_A', description: 'Raumeinfluss A von', length: 1, factor: 1 },
                    { field: 'einflAauf', description: 'Raumeinfluss A auf', length: 1, factor: 1 },
                    { field: 'A_misch', description: 'HK A mit Mischer', length: 1, factor: 1 },
                    { field: 'faktor_A', description: 'Absenkfaktor A', length: 2, factor: 1 },
                    { field: 'absenkA', description: 'Schnellabsenkung A', length: 1, factor: 1 },
                    { field: 'konst_A', description: 'Konstanttemp A', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '05',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'frost_B', description: 'Frostschutz B', length: 1, factor: 1 },
                    { field: 'fb_B', description: 'Art HK B', length: 1, factor: 1 },
                    { field: 'max_B', description: 'Maximaltemp HK B', length: 2, factor: 1 },
                    { field: 'steilheitB', description: 'Kennlinie HK B', length: 2, factor: 1 },
                    { field: 'tagtemp_B', description: 'Nenntemp HK B', length: 2, factor: 1 },
                    { field: 'nachttem_B', description: 'Spartemp HK B', length: 2, factor: 1 },
                    { field: 'betrieb_B', description: 'Betriebsart HK B', length: 2, factor: 1 },
                    { field: 'einfluss_B', description: 'Raumeinfluss HK B', length: 1, factor: 1 },
                    { field: 'min_B', description: 'Minimaltemp HK B', length: 2, factor: 1 },
                    { field: 'prozent_B', description: 'Anteil Raumeinfluss B', length: 2, factor: 1 },
                    { field: 'sensor_B', description: 'Raumeinfluss B von', length: 1, factor: 1 },
                    { field: 'einflBauf', description: 'Raumeinfluss B auf', length: 1, factor: 1 },
                    { field: 'B_misch', description: 'HK B mit Mischer', length: 1, factor: 1 },
                    { field: 'faktor_B', description: 'Absenkfaktor B', length: 2, factor: 1 },
                    { field: 'absenkB', description: 'Schnellabsenkung B', length: 1, factor: 1 },
                    { field: 'konst_B', description: 'Konstanttemp B', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '06',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'wp_fg', description: 'WP-Freigabe', length: 1, factor: 1 },
                    { field: 'wp', description: 'wp?', length: 1, factor: 1 },
                    { field: 'diffwp', description: 'WP Schaltdifferenz', length: 2, factor: 1 },
                    { field: 'wp_kund', description: 'WP-Freigabe Kunde', length: 1, factor: 1 },
                    { field: 'WP_max', description: 'WP Maximaltemp.', length: 2, factor: 1 },
                    { field: 'min_LfZt', description: 'min. WP Laufzeit', length: 2, factor: 1 },
                    { field: 'min_StStZt', description: 'min. WP Stehzeit', length: 2, factor: 1 },
                    { field: 'minsolwarn', description: 'min. Solewarnung', length: 2, factor: 1 },
                    { field: 'maxSpreiz', description: 'max Spreizung', length: 2, factor: 1 },
                    { field: 'minsolalrm', description: 'min. Solealarm', length: 2, factor: 1 },
                    { field: 'ausgleich', description: 'Betriebsstundenausgleich', length: 1, factor: 1 },
                    { field: 'Sole_min', description: 'min Soletemp', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '07',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'relais1', description: 'Relais1 Solepumpe', length: 1, factor: 1 },
                    { field: 'relais2', description: 'Relais2 WP Stufe 1', length: 1, factor: 1 },
                    { field: 'relais3', description: 'Relais3 Mischer A - auf', length: 1, factor: 1 },
                    { field: 'relais4', description: 'Relais4 Mischer A - zu', length: 1, factor: 1 },
                    { field: 'relais5', description: 'Relais5 WP Stufe 2', length: 1, factor: 1 },
                    { field: 'relais6', description: 'Relais6 Pumpe Heizkreis B', length: 1, factor: 1 },
                    { field: 'relais7', description: 'Relais7 Mischer B - auf', length: 1, factor: 1 },
                    { field: 'relais8', description: 'Relais8 Mischer B - zu', length: 1, factor: 1 },
                    { field: 'relais9', description: 'Relais9 Kühlventil', length: 1, factor: 1 },
                    { field: 'relais10', description: 'Relais10 HG-Mischer - auf', length: 1, factor: 1 },
                    { field: 'relais11', description: 'Relais11 HG-Mischer - zu', length: 1, factor: 1 },
                    { field: 'relais12', description: 'Relais12 Zirkulationspumpe', length: 1, factor: 1 },
                    { field: 'relais13', description: 'Relais13 Störmeldeausgang', length: 1, factor: 1 },
                    { field: 'triac1', description: 'Triac Plattentauscherpumpe', length: 2, factor: 1 },
                    { field: 'triac2', description: 'Triac Ladepumpe', length: 2, factor: 1 },
                    { field: 'triac3', description: 'Triac Pumpe Heizkreis A', length: 2, factor: 1 },
                    { field: 'uebertemp', description: 'Störung Übertemperatur', length: 1, factor: 1 },
                    { field: 'telefon', description: 'Telefonkontakt', length: 1, factor: 1 }
                ]
            },
            {
                block_number: '08',
                definition: [
                    { field: 'cool_onA', description: 'Kühlung freig A', length: 1, factor: 1 },
                    { field: 'cool_A', description: 'Raumtemp. Kühl A', length: 2, factor: 0.1 },
                    { field: 'diffco_A', description: 'Schaltdiff. Kühlung A', length: 2, factor: 0.1 },
                    { field: 'mincoolA', description: 'min. Kühlkreistemp A', length: 2, factor: 1 },
                    { field: 'cool_B', description: 'Raumtemp. Kühlg.', length: 2, factor: 0.1 },
                    { field: 'mincoolB', description: 'Kühlkreistemperatur', length: 2, factor: 1 },
                    { field: 'diffco_B', description: 'Schaltdiff. Kühlung', length: 2, factor: 0.1 },
                    { field: 'cool_onB', description: 'Kühlung freigegeben', length: 1, factor: 1 }
                ]
            },
            {
                block_number: '09',
                definition: [
                    { field: 'mindrehz2', description: 'min. Drehzahl Ladepumpe', length: 2, factor: 1 },
                    { field: 'Sekunde', description: 'Sekunde', length: 1, factor: 1 },
                    { field: 'Minute', description: 'Minute', length: 1, factor: 1 },
                    { field: 'Stunde', description: 'Stunde', length: 1, factor: 1 },
                    { field: 'Tag', description: 'Tag', length: 1, factor: 1 },
                    { field: 'Monat', description: 'Monat', length: 1, factor: 1 },
                    { field: 'Jahr', description: 'Jahr', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '0A',
                definition: [
                    { field: 'bivalzusch', description: 'Bivalentzuschaltung', length: 2, factor: 1},
                    { field: 'bivaltemp', description: 'Zuschalttemp.-/zeit', length: 2, factor: 1},
                    { field: 'bivalbetr', description: 'Bivalentbetriebsart', length: 2, factor: 1}
                ]
            },
            {
                block_number: '0B',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'aussentemp', description: 'Außentemperatur', length: 2, factor: 1 },
                    { field: 'Zapftemp', description: 'Zapftemperatur', length: 2, factor: 1 },
                    { field: 'Speichtemp', description: 'Speichertemperatur', length: 2, factor: 1 },
                    { field: 'solltemp_A', description: 'Soll-Vorlauf A', length: 2, factor: 1 },
                    { field: 'solltemp_B', description: 'Soll-Vorlauf B', length: 2, factor: 1 },
                    { field: 'WP_Temp', description: 'WP-Vorlauf', length: 2, factor: 1 },
                    { field: 'WP_RL', description: 'WP-Rücklauf', length: 2, factor: 1 },
                    { field: 'raum_A', description: 'Raumtemperatur A', length: 2, factor: 0.1 },
                    { field: 'raum_B', description: 'Raumtemperatur B', length: 2, factor: 0.1 },
                    { field: 'Vorl_A', description: 'Vorlauf Heizkreis A', length: 2, factor: 1 },
                    { field: 'Vorl_B', description: 'Vorlauf Heizkreis B', length: 2, factor: 1 },
                    { field: 'WP_Temp2', description: 'WP_Temp2?', length: 2, factor: 1 },
                    { field: 'hg_temp', description: 'HG-Temperatur', length: 2, factor: 0.1 },
                    { field: 'Sole_Temp', description: 'Sole-Austrittstemp.', length: 2, factor: 1 }
                ]
            },
            {
                block_number: '0C',
                definition: [
                    { field: 'padding', description: 'padding', length: 2, factor: 1 },
                    { field: 'sommer', description: 'Sommerbetrieb', length: 1, factor: 1 },
                    { field: 'error3', description: 'Störung Fühlerdefekt', length: 1, factor: 1 },
                    { field: 'error1', description: 'error1?', length: 1, factor: 1 },
                    { field: 'HD_Warn', description: 'Hochdruckstörung', length: 1, factor: 1 },
                    { field: 'ND_Warn', description: 'Niederdruckstörung', length: 1, factor: 1 },
                    { field: 'Thermwarn', description: 'Störung Thermorelais', length: 1, factor: 1 },
                    { field: 'Inputwarn', description: 'Störung Sole zu kalt', length: 1, factor: 1 },
                    { field: 'error4', description: 'Störung Verhältnis Std/Imp', length: 1, factor: 1 },
                    { field: 'WP_warn', description: 'Störung Spreizung zu hoch', length: 1, factor: 1 },
                    { field: 'sperrzeit', description: 'Sperrzeit', length: 1, factor: 1 },
                    { field: 'cool', description: 'Kühlfuntion', length: 1, factor: 1 },
                    { field: 'vorrang', description: 'Vorrangschaltung', length: 1, factor: 1 }
                ]
            }
        ]

    }
};

module.exports = idm_datablocks;
