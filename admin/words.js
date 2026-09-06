/*global systemDictionary:true */
'use strict';

// Translations for every label actually shown in admin/index_m.html (see the "translate" gulp
// task and lib/tools.js for the tooling this was generated with). Keep this in sync whenever a
// label in index_m.html changes or a new one is added - ioBroker falls back to the English
// (source) text for any key missing here, so a stale/incomplete dictionary fails silently
// rather than with an error.
systemDictionary = {
    'TCP Server IP': {
        'en': 'TCP Server IP',
        'de': 'TCP-Server-IP',
        'ru': 'IP-адрес TCP-сервера',
        'pt': 'IP do servidor TCP',
        'nl': 'TCP-server-IP',
        'fr': 'Adresse IP du serveur TCP',
        'it': 'IP del server TCP',
        'es': 'IP del servidor TCP',
        'pl': 'Adres IP serwera TCP',
        'zh-cn': 'TCP 服务器 IP'
    },
    'TCP Server Port': {
        'en': 'TCP Server Port',
        'de': 'TCP-Server-Port',
        'ru': 'Порт TCP-сервера',
        'pt': 'Porta do servidor TCP',
        'nl': 'TCP-serverpoort',
        'fr': 'Port du serveur TCP',
        'it': 'Porta del server TCP',
        'es': 'Puerto del servidor TCP',
        'pl': 'Port serwera TCP',
        'zh-cn': 'TCP 服务器端口'
    },
    'Poll interval for sensor, status and error data [s]': {
        'en': 'Poll interval for sensor, status and error data [s]',
        'de': 'Abfrageintervall für Sensor-, Status- und Fehlerdaten [s]',
        'ru': 'Интервал опроса данных датчиков, статуса и ошибок [с]',
        'pt': 'Intervalo de consulta para dados de sensores, status e erros [s]',
        'nl': 'Pollinterval voor sensor-, status- en foutgegevens [s]',
        'fr': "Intervalle d'interrogation pour les données de capteurs, d'état et d'erreurs [s]",
        'it': 'Intervallo di polling per dati di sensori, stato ed errori [s]',
        'es': 'Intervalo de consulta para datos de sensores, estado y errores [s]',
        'pl': 'Interwał odpytywania danych czujników, stanu i błędów [s]',
        'zh-cn': '传感器、状态和错误数据的轮询间隔 [秒]'
    },
    'Reconnect interval after connection got lost or could not be established [s]': {
        'en': 'Reconnect interval after connection got lost or could not be established [s]',
        'de': 'Wiederverbindungsintervall, nachdem die Verbindung verloren ging oder nicht hergestellt werden konnte [s]',
        'ru': 'Интервал повторного подключения после потери соединения или невозможности его установить [с]',
        'pt': 'Intervalo de reconexão após a conexão ser perdida ou não puder ser estabelecida [s]',
        'nl': 'Herverbindingsinterval nadat de verbinding verloren is gegaan of niet tot stand kon worden gebracht [s]',
        'fr': "Intervalle de reconnexion après la perte de connexion ou l'échec de son établissement [s]",
        'it': 'Intervallo di riconnessione dopo che la connessione è stata persa o non è stato possibile stabilirla [s]',
        'es': 'Intervalo de reconexión tras perder la conexión o no poder establecerla [s]',
        'pl': 'Interwał ponownego łączenia po utracie połączenia lub gdy nie udało się go nawiązać [s]',
        'zh-cn': '连接丢失或无法建立后的重新连接间隔 [秒]'
    },
    'Custom data blocks directory (absolute path, optional - one JSON file per firmware version, overrides the matching built-in definition; leave empty to only use the built-in definitions)': {
        'en': 'Custom data blocks directory (absolute path, optional - one JSON file per firmware version, overrides the matching built-in definition; leave empty to only use the built-in definitions)',
        'de': 'Eigenes Datenblock-Verzeichnis (absoluter Pfad, optional - eine JSON-Datei pro Firmware-Version, ersetzt die passende eingebaute Definition; leer lassen, um nur die eingebauten Definitionen zu verwenden)',
        'ru': 'Каталог пользовательских блоков данных (абсолютный путь, необязательно - один JSON-файл на версию прошивки, заменяет соответствующее встроенное определение; оставьте пустым, чтобы использовать только встроенные определения)',
        'pt': 'Diretório de blocos de dados personalizados (caminho absoluto, opcional - um arquivo JSON por versão de firmware, substitui a definição integrada correspondente; deixe em branco para usar apenas as definições integradas)',
        'nl': 'Map met aangepaste datablokken (absoluut pad, optioneel - één JSON-bestand per firmwareversie, vervangt de bijbehorende ingebouwde definitie; laat leeg om alleen de ingebouwde definities te gebruiken)',
        'fr': "Répertoire de blocs de données personnalisés (chemin absolu, facultatif - un fichier JSON par version de firmware, remplace la définition intégrée correspondante ; laissez vide pour n'utiliser que les définitions intégrées)",
        'it': 'Directory dei blocchi dati personalizzati (percorso assoluto, opzionale - un file JSON per versione firmware, sostituisce la definizione integrata corrispondente; lasciare vuoto per usare solo le definizioni integrate)',
        'es': 'Directorio de bloques de datos personalizados (ruta absoluta, opcional - un archivo JSON por versión de firmware, sustituye a la definición integrada correspondiente; déjelo vacío para usar solo las definiciones integradas)',
        'pl': 'Katalog niestandardowych bloków danych (ścieżka bezwzględna, opcjonalnie - jeden plik JSON na wersję firmware, zastępuje odpowiednią wbudowaną definicję; pozostaw puste, aby używać tylko wbudowanych definicji)',
        'zh-cn': '自定义数据块目录(绝对路径,可选 - 每个固件版本一个 JSON 文件,替换对应的内置定义;留空则仅使用内置定义)'
    }
};
