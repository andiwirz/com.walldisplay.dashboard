/* Homey Wall Display – Dashboard Client
   Kompatibel mit Android 7 / Chrome 55+ WebView */

(function () {
  'use strict';

  // ── #15 Capability-Konstanten ──────────────────────
  var CAP = {
    ONOFF:           'onoff',
    DIM:             'dim',
    ALARM_MOTION:    'alarm_motion',
    ALARM_CONTACT:   'alarm_contact',
    INPUT_EXT_1:     'input_external_1',
    MEASURE_TEMP:    'measure_temperature',
    MEASURE_HUMIDITY:'measure_humidity',
    MEASURE_POWER:   'measure_power',
    MEASURE_CO2:     'measure_co2',
    MEASURE_BATTERY: 'measure_battery',
    WC_SET:          'windowcoverings_set',
    WC_STATE:        'windowcoverings_state',
    HOMEALARM_STATE: 'homealarm_state',
    HOMEALARM:       'homealarm',
    SPEAKER_PLAYING: 'speaker_playing',
    SPEAKER_NEXT:    'speaker_next',
    SPEAKER_PREV:    'speaker_prev',
    SPEAKER_SHUFFLE: 'speaker_shuffle',
    SPEAKER_REPEAT:  'speaker_repeat',
    SPEAKER_TRACK:   'speaker_track',
    SPEAKER_ARTIST:  'speaker_artist',
    SPEAKER_ALBUM:   'speaker_album',
    VOLUME_SET:      'volume_set',
    VOLUME_MUTE:     'volume_mute',
    TARGET_TEMP:     'target_temperature',
    THERMOSTAT_MODE: 'thermostat_mode',
    LOCKED:          'locked',
    LOCK_MODE:       'lock_mode',
  };

  // ── i18n ───────────────────────────────────────────
  // Sprache aus dem Browser/WebView. Das Shelly Wall Display meldet die
  // im Gerät eingestellte Sprache, sonst greift Englisch als Fallback.
  var lang = (navigator.language || 'en').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';

  var STRINGS = {
    en: {
      // Energie
      solarTotal: 'Solar total', solarSelfUse: 'Solar self-use',
      gridImport: 'Grid import', gridExport: 'Grid export',
      solar: 'Solar', grid: 'Grid', battery: 'Battery', house: 'House',
      exportL: 'Export', importL: 'Import',
      generating: 'Generating', consuming: 'Consuming',
      charging: 'Charging', discharging: 'Discharging',
      importing: 'Importing', exporting: 'Exporting', idle: 'Idle',
      energy: 'Energy', evTitle: 'EV', other: 'Other', live: 'Live', devicesTab: 'Devices',
      sevenDays: '7 Days', 
      // Geräte-Status
      turnOn: 'Turn on', turnOff: 'Turn off',
      trigger: 'Trigger', locked: 'Locked', unlocked: 'Unlocked',
      playing: 'Playing', stopped: 'Stopped', closed: 'Closed', open: 'Open',
      armed: 'Armed', disarmed: 'Disarmed', partlyArmed: 'Partly armed',
      unavailable: 'Unavailable', unlock: 'Unlock', openDoor: 'Open door',
      // UI
      tryAgain: 'Try again', enterPin: 'Enter PIN', wrongPin: 'Wrong PIN',
      stop: 'Stop', next8h: 'Next 8 hours',
      on: 'On', off: 'Off', yes: 'Yes', no: 'No', ok: 'OK', low: 'Low',
      modeHeat: 'Heat', modeCool: 'Cool', modeAuto: 'Auto',
      startFlow: 'Start Flow?', startBtn: '▶ Start',
      noImage: 'No image available', current: 'Current',
      tapToReturn: 'tap to return', 
      showAllDevices: 'Show all devices', groupByRooms: 'Group by rooms',
      allRooms: 'All', rooms: 'Rooms', search: 'Search…', searchLabel: 'Search',
      cameras: 'Cameras', mediaPlayers: 'Media Players', thermostats: 'Thermostats',
      lights: 'Lights', blinds: 'Blinds', themeToggle: 'Toggle dark mode', 
      noDevicesTitle: 'No devices to show',
      noDevicesBody: 'Open the <strong>Homey app</strong>, go to <strong>Apps → Shelly Wall Display Dashboard → Settings</strong> and enable the devices you want to display.<br><br>If you are accessing the dashboard from a specific device, also check that its <strong>IP address</strong> is configured under the Profiles tab.',
      networkError: 'Network error', timeout: 'Timeout',
      requestTimeout: 'Request timed out',
      // Wetter
      weather: 'Weather', today: 'Today', noForecast: 'No forecast data',
      feelsLike: 'Feels like', wind: 'Wind', humidity: 'Humidity',
      pressure: 'Pressure', hourly: 'Hourly',
      // EV
      
      notCharging: 'Not charging',
      noEvDevice: 'No EV device configured.',
      configureInSettings: 'Configure it in the app settings.',
    },
    de: {
      // Energie
      solarTotal: 'Solar gesamt', solarSelfUse: 'Eigenverbrauch',
      gridImport: 'Netzbezug', gridExport: 'Einspeisung',
      solar: 'Solar', grid: 'Netz', battery: 'Batterie', house: 'Haus',
      exportL: 'Einspeisung', importL: 'Bezug',
      generating: 'Erzeugt', consuming: 'Verbraucht',
      charging: 'Lädt', discharging: 'Entlädt',
      importing: 'Bezug', exporting: 'Einspeisung', idle: 'Inaktiv',
      energy: 'Energie', evTitle: 'E-Auto', other: 'Sonstige', live: 'Live', devicesTab: 'Geräte',
      sevenDays: '7 Tage', 
      // Geräte-Status
      turnOn: 'Einschalten', turnOff: 'Ausschalten',
      trigger: 'Auslösen', locked: 'Verriegelt', unlocked: 'Entriegelt',
      playing: 'Spielt', stopped: 'Gestoppt', closed: 'Geschlossen', open: 'Offen',
      armed: 'Scharf', disarmed: 'Unscharf', partlyArmed: 'Teilscharf',
      unavailable: 'Nicht verfügbar', unlock: 'Entriegeln', openDoor: 'Tür öffnen',
      // UI
      tryAgain: 'Erneut versuchen', enterPin: 'PIN eingeben', wrongPin: 'Falsche PIN',
      stop: 'Stopp', next8h: 'Nächste 8 Stunden',
      on: 'Ein', off: 'Aus', yes: 'Ja', no: 'Nein', ok: 'OK', low: 'Niedrig',
      modeHeat: 'Heizen', modeCool: 'Kühlen', modeAuto: 'Automatik',
      startFlow: 'Flow starten?', startBtn: '▶ Starten',
      noImage: 'Kein Bild verfügbar', current: 'Aktuell',
      tapToReturn: 'tippen zum Zurückkehren', 
      showAllDevices: 'Alle Geräte anzeigen', groupByRooms: 'Nach Räumen gruppieren',
      allRooms: 'Alle', rooms: 'Räume', search: 'Suchen…', searchLabel: 'Suchen',
      cameras: 'Kameras', mediaPlayers: 'Mediaplayer', thermostats: 'Thermostate',
      lights: 'Lichter', blinds: 'Rolladen', themeToggle: 'Hell/Dunkel umschalten', 
      noDevicesTitle: 'Keine Geräte vorhanden',
      noDevicesBody: 'Öffne die <strong>Homey-App</strong>, gehe zu <strong>Apps → Shelly Wall Display Dashboard → Einstellungen</strong> und aktiviere die Geräte, die angezeigt werden sollen.<br><br>Wenn du das Dashboard von einem bestimmten Gerät aus aufrufst, prüfe zusätzlich, ob dessen <strong>IP-Adresse</strong> im Reiter Profile hinterlegt ist.',
      networkError: 'Netzwerkfehler', timeout: 'Zeitüberschreitung',
      requestTimeout: 'Zeitüberschreitung der Anfrage',
      // Wetter
      weather: 'Wetter', today: 'Heute', noForecast: 'Keine Vorhersagedaten',
      feelsLike: 'Gefühlt', wind: 'Wind', humidity: 'Luftfeuchtigkeit',
      pressure: 'Luftdruck', hourly: 'Stündlich',
      // EV
      
      notCharging: 'Lädt nicht',
      noEvDevice: 'Kein E-Auto konfiguriert.',
      configureInSettings: 'In den App-Einstellungen konfigurieren.',
    },
  };

  var T = STRINGS[lang];

  // Setzt die Sprache neu und baut alle abgeleiteten Tabellen neu auf.
  // Wird nach dem Laden der Einstellungen aufgerufen — das Shelly Wall Display
  // meldet über navigator.language immer 'en', darum ist die explizite
  // Einstellung (dashboardLang) die einzige verlässliche Quelle.
  function _setLang(l) {
    var next = (l === 'de' || l === 'en')
      ? l
      : ((navigator.language || 'en').toLowerCase().indexOf('de') === 0 ? 'de' : 'en');
    if (next === lang && T) return false;   // nichts geändert
    lang       = next;
    T          = STRINGS[lang];
    WMO_DESC   = WMO_DESC_ALL[lang];
    _efT       = { grid: T.grid, batt: T.battery, house: T.house, export: T.exportL, import: T.importL };
    _evCapMeta = _buildEvCapMeta();
    // Energie-Flow-DOM wird gecacht — invalidieren, damit die Knotenlabels
    // beim nächsten Rendern in der neuen Sprache neu aufgebaut werden.
    _efHasBattery = null;
    return true;
  }

  var zones = {};
  var devices = {};
  var _myIp = null;
  var _enabledFlows  = null;  // Array von Flow-IDs oder null
  var _enabledMoods  = null;  // Array von Mood-IDs oder null
  var _moodsData     = {};    // id -> Mood-Objekt
  var _hasRendered   = false; // true sobald einmal Inhalt gezeichnet wurde
  // Flow-/Mood-Listen aendern sich nur beim Anlegen/Loeschen in Homey.
  // render() laeuft aber auch beim View-Wechsel — ohne Cache waeren das
  // zwei HTTP-Anfragen pro Tastendruck. Invalidierung via SSE.
  var _flowListCache = null;
  var _moodListCache = null;
  var _flowTileMatch = false; // true = Breite wie Gerätekacheln
  var _flowConfirm   = false; // true = Bestätigung vor Flow-Start
  var _flowPosition  = 'top'; // 'top' | 'bottom'
  var _headerHidden  = false; // true = Header ausgeblendet → Dashboard-Tiles im Grid
  var _searchEnabled  = false; // 🔍 Search Button aktiv
  var _cameraFilterEnabled  = false; // 📷 Camera Filter Button
  var _speakerFilterEnabled = false; // 🎵 Speaker Filter Button
  var _thermostatFilterEnabled = false; // 🌡️ Thermostat Filter Button
  var _lightFilterEnabled = false;     // 💡 Light Filter Button
  var _blindsFilterEnabled = false;    // 🪟 Blinds Filter Button
  var _roomFilterEnabled = false;     // 🏠 Room Filter Button
  var _energyEnabled = true;  // ⚡ Energy Button aktiv
  var _evEnabled     = false; // 🚗 EV Button aktiv
  var _weatherEnabled   = false;
  var _weatherHeaderBtn = false;
  var _weatherLat       = null;
  var _weatherLon       = null;
  var _weatherCity      = '';
  var _weatherUnit      = 'celsius';
  var _weatherData      = null;
  var _weatherTimer     = null;
  var eventSource = null;
  var pollTimer = null;
  var _alarmPin = '';
  var _pinEntry = '';
  var _pinCallback = null;

  // #4 SVG-Cache – Vollneuaufbau nur wenn sich Summary ändert
  var _lastEnergySummaryKey = null;

  // #12 SSE-Backoff
  var _sseBackoff = 1000;
  // #2 SSE-Aktivitäts-Flag (für adaptives Polling)
  var _sseActive = false;

  // ── Batch-SSE: RAF-basierte Update-Queue ───────────────
  // Mehrere SSE-Events im selben Frame (z.B. Dimmer-Sliding) werden
  // gesammelt und einmal pro requestAnimationFrame gerendert.
  // #1 RAF-Fallback für ältere WebViews ohne requestAnimationFrame
  var _raf = (typeof requestAnimationFrame !== 'undefined')
    ? requestAnimationFrame.bind(window)
    : function (cb) { setTimeout(cb, 16); };
  var _pendingUpdates  = {};   // id → true
  var _rafScheduled    = false;
  function _scheduleCardUpdate(id) {
    _pendingUpdates[id] = true;
    if (!_rafScheduled) {
      _rafScheduled = true;
      _raf(function () {
        _rafScheduled = false;
        var ids = Object.keys(_pendingUpdates);
        _pendingUpdates = {};
        for (var i = 0; i < ids.length; i++) updateCard(ids[i]);
      });
    }
  }

  // ── Icon-Cache (localStorage) ──────────────────────────
  // Icons werden beim ersten Load normal per Proxy geladen (sofortige Anzeige).
  // Im Hintergrund speichert ein XHR das Icon als Data-URL in localStorage —
  // ab dem zweiten Load kein Netzwerk-Request mehr nötig.
  var _ICON_CACHE_VER = '2';
  var _ICON_LS_PREFIX = 'hd_ic_';
  var _iconMemCache   = {};  // url-hash → dataURL (Session-Speicher, verhindert doppelte LS-Reads)

  // Version prüfen — alte Einträge löschen wenn Cache-Format geändert wurde
  try {
    if (localStorage.getItem('hd_ic_ver') !== _ICON_CACHE_VER) {
      var _toRemove = [];
      for (var _ki = 0; _ki < localStorage.length; _ki++) {
        var _k = localStorage.key(_ki);
        if (_k && _k.startsWith(_ICON_LS_PREFIX)) _toRemove.push(_k);
      }
      _toRemove.forEach(function (k) { localStorage.removeItem(k); });
      localStorage.setItem('hd_ic_ver', _ICON_CACHE_VER);
    }
  } catch (_) {}

  function _iconKey(url) {
    // Einfacher djb2-Hash → kurzer alphanumerischer Schlüssel
    var h = 5381;
    for (var i = 0; i < url.length; i++) h = ((h << 5) + h) ^ url.charCodeAt(i);
    return _ICON_LS_PREFIX + (h >>> 0).toString(36);
  }

  // #2 Memory-Cache-Größe begrenzen: ältesten Eintrag verdrängen wenn > 200 Einträge
  function _iconMemCacheSet(key, val) {
    var keys = Object.keys(_iconMemCache);
    if (keys.length >= 200) { delete _iconMemCache[keys[0]]; }
    _iconMemCache[key] = val;
  }

  // Schreibt ein Icon in den localStorage. Ohne Aufräumen bleibt der Speicher
  // irgendwann voll — ab dann schlägt JEDES setItem fehl und sämtliche Icons
  // werden bei jedem Laden neu über den Proxy geholt. Bei Quota-Fehler wird
  // deshalb ein Teil der Icon-Einträge verworfen und einmal neu versucht.
  function _iconLsSet(key, val) {
    try {
      localStorage.setItem(key, val);
      return true;
    } catch (_) {
      var iconKeys = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(_ICON_LS_PREFIX) === 0 && k !== 'hd_ic_ver') iconKeys.push(k);
        }
      } catch (_e) { return false; }
      if (!iconKeys.length) return false;
      // 40 % verwerfen — genug Luft, damit nicht bei jedem Icon neu aufgeräumt wird
      var drop = Math.max(1, Math.ceil(iconKeys.length * 0.4));
      for (var j = 0; j < drop; j++) {
        try { localStorage.removeItem(iconKeys[j]); } catch (_e2) {}
        delete _iconMemCache[iconKeys[j]];
      }
      try {
        localStorage.setItem(key, val);
        return true;
      } catch (_e3) {
        return false;
      }
    }
  }

  // #3 Einzel-XHR: Icon wird einmal als Blob geholt, als Data-URL gezeigt UND gecacht.
  // Kein Doppel-Request mehr (früher: Browser-Fetch + separater XHR für Cache).
  function _fetchAndCacheIcon(proxyUrl, cacheKey, onReady) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', proxyUrl);
      xhr.responseType = 'blob';
      xhr.onload = function () {
        if (xhr.status !== 200) { onReady(null); return; }
        var reader = new FileReader();
        reader.onloadend = function () {
          var dataUrl = reader.result;
          if (!dataUrl) { onReady(null); return; }
          if (dataUrl.length <= 200000) { // #2 >150 KB überspringen
            _iconMemCacheSet(cacheKey, dataUrl);
            _iconLsSet(cacheKey, dataUrl);
          }
          onReady(dataUrl);
        };
        reader.readAsDataURL(xhr.response);
      };
      xhr.onerror = function () { onReady(null); };
      xhr.send();
    } catch (_) { onReady(null); }
  }

  // ── Energy Modal ───────────────────────────────────
  var _energyTimer = null;
  var _energyTab   = 'live'; // 'live' | 'devices' | 'history'
  var _lastEnergyData = null; // cached for tab switching

  function openEnergyModal() {
    _energyTab = 'live';
    _setEnergyTab('live');
    document.getElementById('energy-modal').style.display = 'flex';
    _lastEnergySummaryKey = null;
    _fetchEnergy();
    if (!_energyTimer) _energyTimer = setInterval(_fetchEnergy, 5000);
  }
  window.openEnergyModal = openEnergyModal;

  function closeEnergyModal() {
    document.getElementById('energy-modal').style.display = 'none';
    if (_energyTimer) { clearInterval(_energyTimer); _energyTimer = null; }
    _lastEnergySummaryKey = null;
    _lastEnergyData = null;
    _energyTab = 'live';
  }
  window.closeEnergyModal = closeEnergyModal;

  function switchEnergyTab(tab) {
    _energyTab = tab;
    _setEnergyTab(tab);
    if (tab === 'devices') {
      _renderEnergyDevicesTab();
      return;
    }
    if (tab === 'history') {
      if (_energyTimer) { clearInterval(_energyTimer); _energyTimer = null; }
      _fetchEnergyHistory();
    } else {
      _lastEnergySummaryKey = null;
      _fetchEnergy();
      if (!_energyTimer) _energyTimer = setInterval(_fetchEnergy, 5000);
    }
  }
  window.switchEnergyTab = switchEnergyTab;

  function _setEnergyTab(tab) {
    document.getElementById('energy-tab-live').classList.toggle('active',    tab === 'live');
    document.getElementById('energy-tab-devices').classList.toggle('active', tab === 'devices');
    document.getElementById('energy-tab-history').classList.toggle('active', tab === 'history');
  }

  function _renderEnergyDevicesTab() {
    var body = document.getElementById('energy-body');
    if (!body) return;
    if (_lastEnergyData) {
      body.innerHTML = '<div class="energy-scroll-body">' + _buildEnergyDeviceCardsHtml(_lastEnergyData.devices) + '</div>';
    } else {
      body.innerHTML = '<div class="energy-spinner"><div class="spinner"></div></div>';
      // Fetch live data once to populate device list
      _fetchEnergy();
    }
  }

  // #3 Energy Error Handling
  function _fetchEnergy() {
    var req = new XMLHttpRequest();
    req.open('GET', '/api/energy', true);
    req.timeout = 10000; // #11 Timeout
    req.onload = function () {
      if (req.status === 200) {
        try { _renderEnergy(JSON.parse(req.responseText)); } catch (_) {}
      } else {
        _showEnergyError('HTTP ' + req.status);
      }
    };
    req.onerror   = function () { _showEnergyError(T.networkError); };
    req.ontimeout = function () { _showEnergyError(T.requestTimeout); };
    req.send();
  }

  function _showEnergyError(msg) {
    var body = document.getElementById('energy-body');
    if (body) body.innerHTML = '<p style="color:var(--danger);font-size:13px;text-align:center;padding:32px 16px">⚠️ ' + msg + '</p>';
  }

  // ── History-Tab ────────────────────────────────────
  function _fetchEnergyHistory() {
    var body = document.getElementById('energy-body');
    if (body) body.innerHTML = '<div class="energy-spinner"><div class="spinner"></div></div>';

    xhr('GET', '/api/energy/history?days=7', null, function (err, data) {
      if (_energyTab !== 'history') return; // Tab wurde währenddessen gewechselt
      if (err) { _showEnergyError(err.message); return; }
      _renderEnergyHistory(data);
    }, 20000);
  }

  function _renderEnergyHistory(data) {
    var body = document.getElementById('energy-body');
    if (!body) return;
    if (!data || !data.hasData) {
      var dbg = data && data._debug;
      var hasDevices = dbg && (dbg.gridDevices.length + dbg.solarDevices.length) > 0;
      var dbgLines = '';
      if (dbg && dbg.log && dbg.log.length) {
        dbgLines = '<br><code style="font-size:9px;opacity:0.5;word-break:break-all">' +
          dbg.log.map(function(e) {
            var label = e.type + '/[' + (e.capList || []).slice(0,2).join(',') + ']';
            return label + ': ' + (e.dbg || []).join(' ');
          }).join('<br>') + '</code>';
      }
      var devInfo = '';
      if (dbg) {
        var tagged = (dbg.gridDevices || []).map(function(d) { return Object.assign({ _t: 'grid' }, d); })
          .concat((dbg.solarDevices || []).map(function(d) { return Object.assign({ _t: 'solar' }, d); }));
        devInfo = tagged.map(function(d) {
          return d._t + ' caps:[' + (d.capList || []).join(',') + '] logs:[' + (d.logIds || []).join(',') + ']';
        }).join('<br>');
      }
      var apiInfo = dbg ? ' url=' + (dbg.homeyBaseUrl || '?') + ' token=' + (dbg.hasToken ? 'yes' : 'NO') : '';
      var msg = hasDevices
        ? '📊 Energy devices found, but no historical data yet.<br>' +
          '<span style="font-size:11px;opacity:0.65">Grid: ' + dbg.gridDevices.length +
          '  Solar: ' + dbg.solarDevices.length + apiInfo + dbgLines +
          (devInfo ? '<br>' + devInfo : '') + '</span>'
        : '📊 No energy history available.<br>' +
          '<span style="font-size:11px;opacity:0.65">Requires devices with cumulative kWh meters (grid/solar).</span>';
      body.innerHTML =
        '<p style="text-align:center;color:var(--text-muted);padding:40px 24px 12px;font-size:14px;line-height:1.6">' +
        msg + '</p>';
      return;
    }
    body.innerHTML = '<div class="history-chart-wrap">' + _buildHistoryChartSVG(data) + '</div>';
  }

  function _buildHistoryChartSVG(data) {
    var labels  = data.labels;   // ['Mon','Tue',...]
    var grid    = data.grid;     // [kWh,...] Netzbezug
    var solar   = data.solar;    // [kWh,...] Solarproduktion
    var exp     = data.export || new Array(labels.length).fill(0); // Einspeisung
    var n       = labels.length;

    // ── Abgeleitete Werte ──────────────────────────────────────────────────────
    // Solar-Eigenverbrauch = Solarproduktion − Einspeisung (mind. 0)
    var selfUse  = solar.map(function(s, i) { return Math.max(0, s - (exp[i] || 0)); });
    // Heimverbrauch = Solar-Eigenverbrauch + Netzbezug  →  Höhe des Hauptbalkens
    var homeCons = grid.map(function(g, i)  { return g + selfUse[i]; });

    var W = 460, H = 400;
    var padL = 44, padR = 20, padTop = 24, padBot = 54;
    var chartW = W - padL - padR;
    var chartH = H - padTop - padBot;

    // Y-Achse: Maximum aus Solar gesamt, Heimverbrauch und Einspeisung
    var maxVal = 0.1;
    for (var i = 0; i < n; i++) {
      if (homeCons[i]       > maxVal) maxVal = homeCons[i];
      if ((exp[i]   || 0)   > maxVal) maxVal = exp[i];
      if ((solar[i] || 0)   > maxVal) maxVal = solar[i]; // gelber Balken darf Y-Achse nicht übersteigen
    }
    // Schöne Y-Achsen-Obergrenze: nah am Maximum, aber auf runde Zahl
    var niceMax = maxVal <= 5  ? Math.ceil(maxVal) :
                  maxVal <= 20 ? Math.ceil(maxVal / 5)  * 5  :
                  maxVal <= 100 ? Math.ceil(maxVal / 10) * 10 :
                  maxVal <= 500 ? Math.ceil(maxVal / 50) * 50 :
                  Math.ceil(maxVal / 100) * 100;
    // Headroom: wenn maxVal sehr nah an niceMax liegt, eine Stufe höher
    if (niceMax < maxVal * 1.05) {
      niceMax = maxVal <= 20  ? niceMax + 5  :
                maxVal <= 100 ? niceMax + 10 :
                maxVal <= 500 ? niceMax + 50 : niceMax + 100;
    }

    // Drei Balken pro Tag:  Gelb (Solar gesamt) | Grün+Orange (Heimverbrauch) | Blau (Einspeisung)
    var step     = chartW / n;
    var fullW    = Math.max(34, Math.floor(step * 0.84));
    var barGap   = 2;
    var yellowW  = Math.floor(fullW * 0.20);
    var sideW    = Math.floor(fullW * 0.24);
    var mainW    = fullW - yellowW - sideW - 2 * barGap;
    var mainOff  = yellowW + barGap;   // x-Offset Hauptbalken
    var sideOff  = mainOff + mainW + barGap; // x-Offset Nebenbalken

    function bx(i)    { return Math.round(padL + i * step + (step - fullW) / 2); }
    function barH(v)  { return Math.max(0, Math.round((v / niceMax) * chartH)); }

    var svg = '<svg class="history-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" ' +
      'xmlns="http://www.w3.org/2000/svg" ' +
      'style="font-family:system-ui,-apple-system,sans-serif;overflow:visible">';

    // Y-Label-Formatter: ab 1000 kWh → MWh-Kurzform
    function fmtYLbl(v) {
      if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
      if (v >= 10)   return Math.round(v).toString();
      return Number.isInteger(v) ? v.toString() : v.toFixed(1);
    }

    // ── Horizontale Hilfslinien ──
    var yTicks = [0.25, 0.5, 0.75, 1.0];
    for (var t = 0; t < yTicks.length; t++) {
      var yVal = niceMax * yTicks[t];
      var yPx  = padTop + chartH - barH(yVal);
      svg += '<line x1="' + padL + '" y1="' + yPx + '" x2="' + (W - padR) + '" y2="' + yPx +
        '" stroke="#8E8E93" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.4"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (yPx + 4) + '" text-anchor="end" ' +
        'font-size="10" fill="#8E8E93">' + fmtYLbl(yVal) + '</text>';
    }
    svg += '<text x="' + (padL - 6) + '" y="' + (padTop - 8) + '" text-anchor="end" ' +
      'font-size="9" fill="#8E8E93" opacity="0.8">kWh</text>';

    // ── Balken ──
    var today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    for (var i = 0; i < n; i++) {
      var x       = bx(i);
      var mx      = x + mainOff;     // x-Position Hauptbalken
      var sx      = x + sideOff;     // x-Position Nebenbalken
      var baseY   = padTop + chartH;
      var yH      = barH(solar[i]   || 0);  // gelb   – Solar gesamt
      var suH     = barH(selfUse[i] || 0);  // grün   – Solar-Eigenverbrauch
      var gH      = barH(grid[i]    || 0);  // orange – Netzbezug
      var eH      = barH(exp[i]     || 0);  // teal   – Einspeisung (Nebenbalken)
      var mainH   = suH + gH;               // Gesamthöhe Hauptbalken = Heimverbrauch
      var isToday = (labels[i] === today && i === n - 1);
      var alpha   = isToday ? '1' : '0.78';

      // Hintergrund – Hauptbalken
      svg += '<rect x="' + mx + '" y="' + padTop + '" width="' + mainW + '" height="' + chartH +
        '" rx="3" fill="#8E8E93" opacity="0.08"/>';
      if (eH > 0) {
        svg += '<rect x="' + sx + '" y="' + padTop + '" width="' + sideW + '" height="' + chartH +
          '" rx="2" fill="#8E8E93" opacity="0.06"/>';
      }

      // Gelber Balken – Solar gesamt
      if (yH > 0) {
        svg += '<rect x="' + x + '" y="' + (baseY - yH) + '" width="' + yellowW + '" height="' + yH +
          '" rx="2" fill="#FFD60A" opacity="' + alpha + '"/>';
        var solarVal = solar[i] || 0;
        if (solarVal >= 0.05) {
          var solarLbl = solarVal >= 10 ? Math.round(solarVal).toString() : solarVal.toFixed(1);
          svg += '<text x="' + Math.round(x + yellowW / 2) + '" y="' + (baseY - yH - 4) +
            '" text-anchor="middle" font-size="9.5" font-weight="600" fill="#FFD60A" opacity="0.9">' + solarLbl + '</text>';
        }
      }

      // Grüner Balken – Solar-Eigenverbrauch (unten)
      if (suH > 0) {
        svg += '<rect x="' + mx + '" y="' + (baseY - suH) + '" width="' + mainW + '" height="' + suH +
          '" rx="3" fill="#34C759" opacity="' + alpha + '"/>';
      }

      // Oranger Balken – Netzbezug (auf Solar gestapelt)
      if (gH > 0) {
        var gy = baseY - suH - gH;
        svg += '<rect x="' + mx + '" y="' + gy + '" width="' + mainW + '" height="' + gH +
          '" rx="3" fill="#FF9500" opacity="' + alpha + '"/>';
        if (suH > 0 && gH > 3) { // untere Ecken eckig wenn Solar darunter
          svg += '<rect x="' + mx + '" y="' + (gy + gH - 4) + '" width="' + mainW + '" height="4"' +
            ' fill="#FF9500" opacity="' + alpha + '"/>';
        }
      }

      // Teal Nebenbalken – Einspeisung
      if (eH > 0) {
        svg += '<rect x="' + sx + '" y="' + (baseY - eH) + '" width="' + sideW + '" height="' + eH +
          '" rx="2" fill="#5AC8FA" opacity="' + alpha + '"/>';
        // Wert über dem Nebenbalken
        var expVal = exp[i] || 0;
        if (expVal >= 0.05) {
          var expLbl = expVal >= 10 ? Math.round(expVal).toString() : expVal.toFixed(1);
          svg += '<text x="' + Math.round(sx + sideW / 2) + '" y="' + (baseY - eH - 4) +
            '" text-anchor="middle" font-size="9.5" font-weight="600" fill="#5AC8FA" opacity="0.9">' + expLbl + '</text>';
        }
      }

      // Heute-Highlight (umschließt alle drei Balken)
      if (isToday) {
        svg += '<rect x="' + (x - 1) + '" y="' + (padTop - 1) + '" width="' + (fullW + 2) + '" height="' + (chartH + 2) +
          '" rx="3" fill="none" stroke="var(--accent)" stroke-width="1.2" opacity="0.5"/>';
      }

      // Heimverbrauch-Wert über Hauptbalken
      var cons = homeCons[i] || 0;
      if (cons >= 0.05 && mainH > 0) {
        var valLbl = cons >= 10 ? Math.round(cons).toString() : cons.toFixed(1);
        svg += '<text x="' + Math.round(mx + mainW / 2) + '" y="' + (baseY - mainH - 5) +
          '" text-anchor="middle" font-size="9.5" font-weight="600" fill="#8E8E93">' + valLbl + '</text>';
      }

      // Tag-Label
      svg += '<text x="' + Math.round(mx + mainW / 2) + '" y="' + (padTop + chartH + 17) +
        '" text-anchor="middle" font-size="12" fill="' + (isToday ? 'var(--accent)' : '#8E8E93') +
        '" font-weight="' + (isToday ? '700' : '400') + '">' + labels[i] + '</text>';
    }

    // ── Legende ──
    var legY     = H - 6;
    var hasSolarData = solar.some(function(v) { return v > 0; });
    var hasSelf  = selfUse.some(function(v) { return v > 0; });
    var hasGrid  = grid.some(function(v)    { return v > 0; });
    var hasExp   = exp.some(function(v)     { return v > 0; });
    var legItems = [];
    if (hasSolarData) legItems.push({ color: '#FFD60A', label: T.solarTotal });
    if (hasSelf) legItems.push({ color: '#34C759', label: T.solarSelfUse });
    if (hasGrid) legItems.push({ color: '#FF9500', label: T.gridImport });
    if (hasExp)  legItems.push({ color: '#5AC8FA', label: T.gridExport });
    var totalLegW = legItems.reduce(function(s, it) { return s + 11 + 5 + it.label.length * 6.6 + 10; }, 0);
    var legX = Math.max(padL, Math.round((W - totalLegW) / 2));
    for (var li = 0; li < legItems.length; li++) {
      var it = legItems[li];
      svg += '<rect x="' + legX + '" y="' + (legY - 8) + '" width="11" height="8" rx="2" fill="' + it.color + '" opacity="0.85"/>';
      svg += '<text x="' + (legX + 15) + '" y="' + legY + '" font-size="11" fill="#8E8E93">' + it.label + '</text>';
      legX += 11 + 5 + it.label.length * 6.6 + 10;
    }

    svg += '</svg>';
    return svg;
  }

  function _fmtW(w) {
    if (w === null || w === undefined) return '—';
    var abs = Math.abs(w);
    if (abs >= 1000) return (abs / 1000).toFixed(1) + ' kW';
    return abs + ' W';
  }

  function _fmtKwh(v) {
    if (v === null || v === undefined) return null;
    return v.toFixed(1) + ' kWh';
  }

  function _energyStatus(type, power, soc) {
    if (type === 'solar')    return power > 0  ? [T.generating,   'solar']       : [T.idle, 'idle'];
    if (type === 'battery')  return power < 0  ? [T.discharging,  'discharging'] : (power > 0 ? [T.charging, 'charging'] : [T.idle, 'idle']);
    if (type === 'grid')     return power < 0  ? [T.exporting,    'exporting']   : (power > 0 ? [T.importing, 'importing'] : [T.idle, 'idle']);
    if (type === 'ev')       return power > 0  ? [T.charging,     'charging']    : [T.idle, 'idle'];
    return [T.consuming, 'consuming'];
  }

  var _ENERGY_FALLBACK_ICONS = { solar: '☀️', battery: '🔋', grid: '⚡', ev: '🚗', consumer: '🔌' };

  function _energyIconHtml(d, imgEl) {
    // imgEl: optionaler <img>-DOM-Knoten, der nachträglich befüllt wird (async Pfad)
    if (d.icon) {
      var proxyUrl = d.icon.startsWith('/') ? d.icon : '/api/icon-proxy?url=' + encodeURIComponent(d.icon);
      var cacheKey = _iconKey(d.icon);
      var cached = _iconMemCache[cacheKey];
      if (!cached) { try { cached = localStorage.getItem(cacheKey); } catch (_) {} }
      if (cached) { _iconMemCacheSet(cacheKey, cached); }
      if (cached) {
        return '<img src="' + cached + '" class="energy-device-icon-img" alt="">';
      }
      // #3 Einzel-XHR – Icon wird gecacht und danach in imgEl eingetragen wenn vorhanden
      if (imgEl) {
        _fetchAndCacheIcon(proxyUrl, cacheKey, function (dataUrl) {
          imgEl.src = dataUrl || proxyUrl;
        });
      } else {
        _fetchAndCacheIcon(proxyUrl, cacheKey, function () {});
      }
      return '<img src="' + proxyUrl + '" class="energy-device-icon-img" alt="">';
    }
    return '<span class="energy-device-icon-emoji">' + (_ENERGY_FALLBACK_ICONS[d.type] || '⚡') + '</span>';
  }

  // ── Energy Flow Widget (hub + node + dashed line style) ─────────────────
  var _efHasBattery = false;

  var _efT = { grid: T.grid, batt: T.battery, house: T.house, export: T.exportL, import: T.importL };

  var _EF_C = {
    pv:        '#F59E0B',
    house:     '#3B82F6',
    charge:    '#22C55E',
    discharge: '#F97316',
    export:    '#22C55E',
    import:    '#EF4444',
    idle:      'var(--border)',
  };

  function _buildEfHtml(hasBattery) {
    var battHide = hasBattery ? '' : ' style="display:none"';
    return '<div class="ef-wrap" id="ef-wrap">' +
      '<svg class="ef-svg" id="ef-svg">' +
        '<line id="ef-line-pv"    stroke-width="2" stroke-dasharray="5 4"/>' +
        '<line id="ef-line-house" stroke-width="2" stroke-dasharray="5 4"/>' +
        '<line id="ef-line-grid"  stroke-width="2" stroke-dasharray="5 4"/>' +
        '<line id="ef-line-batt"  stroke-width="2" stroke-dasharray="5 4"' + battHide + '/>' +
      '</svg>' +
      '<div class="ef-hub" id="ef-hub">' +
        '<svg width="16" height="16" id="ef-hub-icon" viewBox="0 0 24 24" fill="none"' +
             ' stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>' +
        '</svg>' +
      '</div>' +
      // PV — top center
      '<div class="ef-node" id="ef-node-pv" style="left:50%;top:12%">' +
        '<svg class="ef-node-icon" viewBox="0 0 24 24" fill="none"' +
             ' stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="12" cy="12" r="4"/>' +
          '<line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>' +
          '<line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>' +
          '<line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>' +
          '<line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>' +
        '</svg>' +
        '<div class="ef-node-value" id="ef-pv-val">—</div>' +
        '<div class="ef-node-label">' + T.solar + '</div>' +
      '</div>' +
      // Grid — middle left
      '<div class="ef-node" id="ef-node-grid" style="left:12%;top:50%">' +
        '<svg class="ef-node-icon" id="ef-grid-icon" viewBox="0 0 24 24" fill="none"' +
             ' stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>' +
        '</svg>' +
        '<div class="ef-node-value" id="ef-grid-val">—</div>' +
        '<div class="ef-node-label">' + _efT.grid + '</div>' +
        '<div class="ef-node-sub" id="ef-grid-sub"></div>' +
      '</div>' +
      // Battery — middle right
      '<div class="ef-node" id="ef-node-batt" style="left:88%;top:50%">' +
        '<svg class="ef-node-icon" id="ef-batt-icon" viewBox="0 0 24 24" fill="none"' +
             ' stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="2" y="7" width="16" height="10" rx="2"/>' +
          '<line x1="22" y1="10" x2="22" y2="14"/>' +
          '<line x1="6" y1="12" x2="12" y2="12"/>' +
          '<line x1="9" y1="9" x2="9" y2="15"/>' +
        '</svg>' +
        '<div class="ef-node-value" id="ef-batt-val">—</div>' +
        '<div class="ef-node-label">' + _efT.batt + '</div>' +
        '<div class="ef-node-sub" id="ef-batt-soc"></div>' +
      '</div>' +
      // House — bottom center
      '<div class="ef-node" id="ef-node-house" style="left:50%;top:88%">' +
        '<svg class="ef-node-icon" viewBox="0 0 24 24" fill="none"' +
             ' stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
          '<polyline points="9,22 9,12 15,12 15,22"/>' +
        '</svg>' +
        '<div class="ef-node-value" id="ef-house-val">—</div>' +
        '<div class="ef-node-label">' + _efT.house + '</div>' +
      '</div>' +
    '</div>';
  }

  function _efPositionLines() {
    var wrap = document.getElementById('ef-wrap');
    if (!wrap) return;
    function efRel(el) {
      var r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      return { top: r.top-w.top, bottom: r.bottom-w.top, left: r.left-w.left, right: r.right-w.left,
               cx: (r.left+r.right)/2-w.left, cy: (r.top+r.bottom)/2-w.top };
    }
    function efCoords(id, x1, y1, x2, y2) {
      var el = document.getElementById(id);
      if (!el) return;
      el.setAttribute('x1', Math.round(x1)); el.setAttribute('y1', Math.round(y1));
      el.setAttribute('x2', Math.round(x2)); el.setAttribute('y2', Math.round(y2));
    }
    var hub   = document.getElementById('ef-hub');
    var pv    = document.getElementById('ef-node-pv');
    var house = document.getElementById('ef-node-house');
    var grid  = document.getElementById('ef-node-grid');
    var batt  = document.getElementById('ef-node-batt');
    if (!hub || !pv || !house || !grid) return;
    var h = efRel(hub), p = efRel(pv), ho = efRel(house), g = efRel(grid);
    efCoords('ef-line-pv',    p.cx,  p.bottom,  h.cx,    h.top);
    efCoords('ef-line-house', h.cx,  h.bottom,  ho.cx,   ho.top);
    efCoords('ef-line-grid',  g.right, g.cy,    h.left,  h.cy);
    if (batt) {
      var b = efRel(batt);
      efCoords('ef-line-batt', h.right, h.cy, b.left, b.cy);
    }
  }

  function _efSetLine(id, anim, color) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.stroke          = color;
    el.style.strokeOpacity   = anim ? '1' : '0.35';
    el.style.strokeDasharray = anim ? '5 4' : '3 7';
    el.style.animation       = anim ? (anim + ' 0.5s linear infinite') : 'none';
  }

  function _updateEfFlow(s, hasBattery, thr) {
    var pv   = s.solarW   || 0;
    var batt = s.batteryW;   // null if no battery
    var grid = s.gridW    || 0;
    var soc  = s.batterySoc;
    var home = s.homeW    || 0;

    var pvEl    = document.getElementById('ef-pv-val');
    var homeEl  = document.getElementById('ef-house-val');
    var battEl  = document.getElementById('ef-batt-val');
    var gridEl  = document.getElementById('ef-grid-val');
    var socEl   = document.getElementById('ef-batt-soc');
    var gridSub = document.getElementById('ef-grid-sub');

    if (pvEl)    pvEl.textContent   = _fmtW(pv);
    if (homeEl)  homeEl.textContent = _fmtW(home);
    if (battEl)  battEl.textContent = _fmtW(batt !== null ? Math.abs(batt) : null);
    if (gridEl)  gridEl.textContent = _fmtW(grid !== null ? Math.abs(grid) : null);
    if (socEl)   socEl.textContent  = (soc !== null && soc !== undefined) ? Math.round(soc) + '%' : '';
    if (gridSub) gridSub.textContent = (grid < -thr) ? _efT.export : (grid > thr) ? _efT.import : '';

    // PV line: fwd = producing
    _efSetLine('ef-line-pv', pv > thr ? 'ef-fwd' : null, pv > thr ? _EF_C.pv : _EF_C.idle);

    // House line: fwd = consuming
    _efSetLine('ef-line-house', home > thr ? 'ef-fwd' : null, home > thr ? _EF_C.house : _EF_C.idle);

    // Battery line
    var battNode = document.getElementById('ef-node-batt');
    var battIcon = document.getElementById('ef-batt-icon');
    if (batt === null || batt === undefined) {
      _efSetLine('ef-line-batt', null, 'transparent');
      if (battNode) battNode.style.opacity = '0.25';
      if (battIcon) battIcon.setAttribute('stroke', '#9CA3AF');
    } else {
      if (battNode) battNode.style.opacity = '1';
      if (batt > thr) {
        _efSetLine('ef-line-batt', 'ef-fwd', _EF_C.charge);
        if (battIcon) battIcon.setAttribute('stroke', _EF_C.charge);
      } else if (batt < -thr) {
        _efSetLine('ef-line-batt', 'ef-rev', _EF_C.discharge);
        if (battIcon) battIcon.setAttribute('stroke', _EF_C.discharge);
      } else {
        _efSetLine('ef-line-batt', null, _EF_C.idle);
        if (battIcon) battIcon.setAttribute('stroke', '#9CA3AF');
      }
    }

    // Grid line: fwd = import, rev = export
    var gridIcon = document.getElementById('ef-grid-icon');
    if (grid < -thr) {
      _efSetLine('ef-line-grid', 'ef-rev', _EF_C.export);
      if (gridIcon) gridIcon.setAttribute('stroke', _EF_C.export);
    } else if (grid > thr) {
      _efSetLine('ef-line-grid', 'ef-fwd', _EF_C.import);
      if (gridIcon) gridIcon.setAttribute('stroke', _EF_C.import);
    } else {
      _efSetLine('ef-line-grid', null, _EF_C.idle);
      if (gridIcon) gridIcon.setAttribute('stroke', '#9CA3AF');
    }

    // Hub border: green=PV on+no import | orange=batt discharging+no import | red=importing | none=standby
    var hub     = document.getElementById('ef-hub');
    var hubIcon = document.getElementById('ef-hub-icon');
    var importing = grid  >  thr;
    var pvOn      = pv    >  thr;
    var battDisch = batt !== null && batt < -thr;
    if (hub) {
      if (pvOn && !importing) {
        hub.style.borderColor = _EF_C.charge;
        hub.style.boxShadow   = '0 0 8px rgba(34,197,94,0.4)';
        if (hubIcon) { hubIcon.style.stroke = _EF_C.charge; hubIcon.style.opacity = '0.9'; }
      } else if (!pvOn && battDisch && !importing) {
        hub.style.borderColor = _EF_C.pv;
        hub.style.boxShadow   = '0 0 8px rgba(245,158,11,0.4)';
        if (hubIcon) { hubIcon.style.stroke = _EF_C.pv; hubIcon.style.opacity = '0.9'; }
      } else if (importing) {
        hub.style.borderColor = _EF_C.import;
        hub.style.boxShadow   = '0 0 8px rgba(239,68,68,0.4)';
        if (hubIcon) { hubIcon.style.stroke = _EF_C.import; hubIcon.style.opacity = '0.9'; }
      } else {
        hub.style.borderColor = 'transparent';
        hub.style.boxShadow   = 'none';
        if (hubIcon) { hubIcon.style.stroke = 'currentColor'; hubIcon.style.opacity = '0.35'; }
      }
    }
  }

  // kept for reference — no longer called from live tab
  // #4 Device-Card-HTML in eigene Funktion ausgelagert (für SVG-Caching)
  function _buildEnergyDeviceCardsHtml(devList) {
    var shown = devList.filter(function (d) {
      return d.type === 'solar' || d.type === 'battery' || d.type === 'grid' || d.type === 'ev';
    });
    if (shown.length === 0) {
      return '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px 0">No energy devices found.<br>Add solar panels, batteries or power meters in Homey.</p>';
    }
    var html = '<div class="energy-devices">';
    shown.forEach(function (d) {
      var st  = _energyStatus(d.type, d.power, d.soc);
      var sub = '';
      if (d.type === 'battery' && d.soc !== null) sub = d.soc + '% SoC';
      if (d.meterImported !== null && d.meterExported !== null)
        sub = _fmtKwh(d.meterImported) + ' in · ' + _fmtKwh(d.meterExported) + ' out';
      else if (d.meterImported !== null)
        sub = _fmtKwh(d.meterImported) + ' total';

      html += '<div class="energy-device-card">';
      html += '<div class="energy-device-icon">' + _energyIconHtml(d) + '</div>';
      html += '<div class="energy-device-name">' + d.name + '</div>';
      html += '<div class="energy-device-power">' + _fmtW(d.power) + ' <span>W</span></div>';
      if (sub) html += '<div class="energy-device-sub">' + sub + '</div>';
      html += '<div class="energy-device-status energy-status-' + st[1] + '">' + st[0] + '</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function _renderEnergy(data) {
    _lastEnergyData = data; // cache for Devices tab

    if (_energyTab === 'devices') { _renderEnergyDevicesTab(); return; }
    if (_energyTab !== 'live') return;

    var s       = data.summary;
    var devList = data.devices;
    var hasBat  = devList.some(function (d) { return d.type === 'battery'; });
    var body    = document.getElementById('energy-body');
    var thr     = 50;

    // Rebuild DOM only when not yet present or battery presence changed
    if (!document.getElementById('ef-wrap') || _efHasBattery !== hasBat) {
      _efHasBattery = hasBat;
      body.innerHTML = '<div class="energy-flow-container">' + _buildEfHtml(hasBat) + '</div>';
      // Reposition lines whenever the wrap resizes (flex height changes)
      if (typeof ResizeObserver !== 'undefined') {
        var efObs = new ResizeObserver(function () { _efPositionLines(); });
        var efWrapEl = document.getElementById('ef-wrap');
        if (efWrapEl) efObs.observe(efWrapEl);
      }
      requestAnimationFrame(function () { requestAnimationFrame(_efPositionLines); });
    }

    _updateEfFlow(s, hasBat, thr);
    requestAnimationFrame(_efPositionLines);
  }

  // ── Theme ('light' | 'dark') ───────────────────────
  var theme = 'light';
  var _themeMode = 'toggle'; // 'toggle' | 'light' | 'dark' | 'auto'
  var _themeAutoTimer = null;
  try { theme = localStorage.getItem('theme') || 'light'; } catch (_) {}

  function applyTheme(t) {
    theme = t;
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : '');
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      var emoji = btn.querySelector('.hdr-emoji');
      if (emoji) emoji.textContent = t === 'dark' ? '🌙' : '🔆';
      else btn.textContent = t === 'dark' ? '🌙' : '🔆';
    }
  }

  function _autoTheme() {
    var h = new Date().getHours();
    applyTheme(h >= 7 && h < 21 ? 'light' : 'dark');
  }

  function _applyThemeMode(mode) {
    _themeMode = mode || 'toggle';
    var btn = document.getElementById('theme-toggle');
    if (_themeAutoTimer) { clearInterval(_themeAutoTimer); _themeAutoTimer = null; }
    if (_themeMode === 'light') {
      applyTheme('light');
      if (btn) btn.style.display = 'none';
    } else if (_themeMode === 'dark') {
      applyTheme('dark');
      if (btn) btn.style.display = 'none';
    } else if (_themeMode === 'auto') {
      _autoTheme();
      _themeAutoTimer = setInterval(_autoTheme, 60000);
      if (btn) btn.style.display = 'none';
    } else {
      if (btn) btn.style.display = '';
      try { var saved = localStorage.getItem('theme'); if (saved) applyTheme(saved); } catch (_) {}
    }
  }

  function toggleTheme() {
    if (_themeMode !== 'toggle') return;
    theme = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', theme); } catch (_) {}
    applyTheme(theme);
  }

  applyTheme(theme);
  window.toggleTheme = toggleTheme;

  // ── View-Modus ('zones' | 'all') ───────────────────
  var _viewDefault   = 'all';   // aus Settings, wird in loadData gesetzt
  var _viewBtnHidden = false;   // aus Settings
  var _zoneOrder     = [];      // gespeicherte Reihenfolge der Räume (Array von Zone-IDs)
  var _collapsedZones = {};     // {zoneName: true} — eingeklappte Räume, in localStorage
  try {
    var _czRaw = JSON.parse(localStorage.getItem('collapsedZones') || '{}');
    if (_czRaw && typeof _czRaw === 'object') _collapsedZones = _czRaw;
  } catch (_) {}
  var viewMode = 'all';
  try {
    var _stored = localStorage.getItem('viewMode');
    viewMode = _stored || 'all';
  } catch (_) {}

  function toggleView() {
    viewMode = viewMode === 'zones' ? 'all' : 'zones';
    try { localStorage.setItem('viewMode', viewMode); } catch (_) {}
    updateViewToggle();
    render();
  }

  function updateViewToggle() {
    var btn = document.getElementById('view-toggle');
    if (!btn) return;
    btn.style.display = _viewBtnHidden ? 'none' : '';
    var label = viewMode === 'zones' ? '⊞ ' + T.allRooms : '⊟ ' + T.rooms;
    var emoji = btn.querySelector('.hdr-emoji');
    if (emoji) emoji.textContent = label;
    else btn.textContent = label;
    document.body.classList.toggle('view-zones', viewMode === 'zones');
    btn.setAttribute('aria-label', viewMode === 'zones' ? T.showAllDevices : T.groupByRooms);
  }

  window.toggleView = toggleView;

  // ── Geräteklassen → Icon ────────────────────────────
  var CLASS_ICONS = {
    light:       '💡',
    socket:      '🔌',
    thermostat:  '🌡',
    sensor:      '📡',
    lock:        '🔒',
    blinds:      '🪟',
    curtain:     '🪟',
    fan:         '💨',
    heater:      '🔥',
    doorbell:    '🔔',
    camera:      '📷',
    speaker:     '🔊',
    vacuumcleaner: '🤖',
    windowcoverings: '🪟',
    tv:          '📺',
    mediaplayer: '🎵',
    car:         '🚗',
    solarpanel:  '☀️',
    button:      '🔘',
    remote:      '🕹',
    homealarm:   '🔐',
    other:       '●',
  };

  // homealarm: armed/partially_armed oder boolean true → scharf
  function alarmIsArmed(value) {
    if (typeof value === 'boolean') return value;
    return value === 'armed' || value === 'partially_armed';
  }

  // #15 Gibt die steuerbare Alarm-Capability zurück oder null.
  function getAlarmCapability(d) {
    var caps = d.capabilitiesObj || {};
    if (caps[CAP.HOMEALARM_STATE]) return { capId: CAP.HOMEALARM_STATE, isBoolean: false, value: caps[CAP.HOMEALARM_STATE].value };
    if (caps[CAP.HOMEALARM])       return { capId: CAP.HOMEALARM,       isBoolean: false, value: caps[CAP.HOMEALARM].value };
    var capIds = d.capabilities || [];
    for (var i = 0; i < capIds.length; i++) {
      var cap = caps[capIds[i]];
      if (cap && cap.type === 'boolean' && cap.setable) {
        return { capId: capIds[i], isBoolean: true, value: cap.value };
      }
    }
    return null;
  }

  function getIcon(cls) {
    return CLASS_ICONS[cls] || CLASS_ICONS.other;
  }

  function buildIconElement(d) {
    var span = createElement('span', 'device-icon');
    if (d.icon) {
      var proxyUrl = d.icon.startsWith('/') ? d.icon : '/api/icon-proxy?url=' + encodeURIComponent(d.icon);
      var cacheKey = _iconKey(d.icon);
      var img = document.createElement('img');
      img.className = 'device-icon-img';
      img.alt = '';
      img.onerror = function () {
        if (span.contains(img)) span.removeChild(img);
        span.textContent = getIcon(d.class);
      };

      // Aus Cache laden (Memory → localStorage)
      var cached = _iconMemCache[cacheKey];
      if (!cached) {
        try { cached = localStorage.getItem(cacheKey); } catch (_) {}
        if (cached) _iconMemCacheSet(cacheKey, cached);
      }

      if (cached) {
        img.src = cached; // Cache-Hit: kein Netzwerk-Request
      } else {
        // #3 Einzel-XHR: einmal holen → anzeigen + cachen (kein Doppel-Request)
        _fetchAndCacheIcon(proxyUrl, cacheKey, function (dataUrl) {
          img.src = dataUrl || proxyUrl; // Fallback auf Proxy-URL wenn XHR scheitert
        });
      }

      span.appendChild(img);
    } else {
      span.textContent = getIcon(d.class);
    }
    return span;
  }

  // ── #6 Uhr (drift-korrigiert mit setTimeout) ────────
  function updateClock() {
    var now = new Date();
    var h = now.getHours().toString().padStart(2, '0');
    var m = now.getMinutes().toString().padStart(2, '0');
    var el = document.getElementById('clock');
    if (el) el.textContent = h + ':' + m;
  }

  function scheduleClock() {
    var delay = 1000 - (Date.now() % 1000);
    setTimeout(function () { updateClock(); scheduleClock(); }, delay);
  }

  updateClock();
  scheduleClock();

  // ── Daten laden ─────────────────────────────────────
  var _loadRetryTimer = null;

  function loadData() {
    if (_loadRetryTimer) { clearTimeout(_loadRetryTimer); _loadRetryTimer = null; }
    showLoading();

    if (!_myIp) {
      xhr('GET', '/api/client-ip', null, function (err, data) {
        if (!err && data && data.ip) _myIp = data.ip;
      });
    }

    xhr('GET', '/api/settings', null, function (err, cfg) {
      if (!err && cfg) {
        // Sprache zuerst — alle folgenden Renderings nutzen bereits die neue.
        if (_setLang(cfg.dashboardLang)) applyI18n();
        _alarmPin      = cfg.alarmPin || '';
        _energyEnabled = cfg.energyEnabled !== false;
        _evEnabled     = cfg.evEnabled === true;
        var btn = document.getElementById('energy-btn');
        if (btn) btn.style.display = _energyEnabled ? '' : 'none';
        var evBtn = document.getElementById('ev-btn');
        if (evBtn) evBtn.style.display = _evEnabled ? '' : 'none';
        // Wetter-Dashboard
        _weatherEnabled   = cfg.weatherEnabled   === true;
        _weatherHeaderBtn = cfg.weatherHeaderBtn !== false;
        var weatherBtn = document.getElementById('weather-btn');
        if (weatherBtn) weatherBtn.style.display = _weatherHeaderBtn ? '' : 'none';
        _weatherLat  = cfg.weatherLat  || null;
        _weatherLon  = cfg.weatherLon  || null;
        _weatherCity = cfg.weatherCity || '';
        _weatherUnit = cfg.weatherUnit || 'celsius';
        if (_weatherTimer) { clearInterval(_weatherTimer); _weatherTimer = null; }
        // Fetch wenn Kachel ODER Header-Button aktiv ist
        if ((_weatherEnabled || _weatherHeaderBtn) && _weatherLat && _weatherLon) {
          fetchWeather();
          _weatherTimer = setInterval(fetchWeather, 30 * 60 * 1000);
        } else {
          _weatherData = null;
        }
        // Kachelgrösse: 1=90px 2=110px 3=130px(default) 4=165px 5=210px
        var tilePx = [90, 110, 130, 165, 210];
        var ts = (cfg.tileSize >= 1 && cfg.tileSize <= 5) ? cfg.tileSize : 3;
        document.documentElement.style.setProperty('--tile-min', tilePx[ts - 1] + 'px');
        // Kachelhöhe: 'square' = min-height gleich wie Breite, 'auto' = content-driven (100px min)
        var tileH = cfg.tileHeight === 'square' ? tilePx[ts - 1] + 'px' : '100px';
        document.documentElement.style.setProperty('--tile-h', tileH);
        // Flow-Filter merken — Server-Semantik beibehalten:
        //   null  = alle Flows zeigen
        //   []    = keine Flows zeigen  (__none__ wird serverseitig zu [] konvertiert)
        //   [ids] = nur diese Flows zeigen
        _enabledFlows = Array.isArray(cfg.enabledFlows) ? cfg.enabledFlows : null;
        _enabledMoods = Array.isArray(cfg.enabledMoods) ? cfg.enabledMoods : null;
        // Flow-Tile-Breite: 'match' = wie Gerätekacheln, sonst dynamisch
        _flowTileMatch = cfg.flowTileWidth === 'match';
        // Flow-Bestätigung und Position
        _flowConfirm  = cfg.flowConfirm  === true;
        _flowPosition = cfg.flowPosition === 'bottom' ? 'bottom' : 'top';
        // Dashboard-Titel
        var titleEl = document.getElementById('header-title');
        if (titleEl) {
          var titleText = cfg.dashboardTitle || '';
          titleEl.textContent = titleText;
          titleEl.style.display = titleText ? '' : 'none';
        }
        // Schriftgrösse: 1–5 → scale 1.0 / 1.15 / 1.3 / 1.5 / 1.75
        var fontScales = [1, 1.15, 1.3, 1.5, 1.75];
        var fs = (cfg.fontSize >= 1 && cfg.fontSize <= 5) ? cfg.fontSize : 1;
        document.documentElement.style.setProperty('--font-scale', fontScales[fs - 1]);
        // Ansicht-Standard + Button-Sichtbarkeit
        _viewDefault   = cfg.viewDefault   || 'all';
        _viewBtnHidden = cfg.viewBtnHidden === true;
        _zoneOrder     = Array.isArray(cfg.zoneOrder) ? cfg.zoneOrder : [];
        _coverFullscreen      = cfg.coverFullscreen === true;
        _coverFullscreenDelay = (cfg.coverFullscreenDelay > 0) ? cfg.coverFullscreenDelay : 20;
        // Nur anwenden wenn der Nutzer noch keine eigene Wahl getroffen hat
        if (!localStorage.getItem('viewMode')) {
          viewMode = _viewDefault;
        }
        // Akzentfarbe
        var accent = cfg.accentColor || '#F5A623';
        var ar = parseInt(accent.slice(1,3),16), ag = parseInt(accent.slice(3,5),16), ab = parseInt(accent.slice(5,7),16);
        var root = document.documentElement;
        root.style.setProperty('--accent',     accent);
        root.style.setProperty('--toggle-on',  accent);
        root.style.setProperty('--border-on',  'rgba('+ar+','+ag+','+ab+',0.35)');
        root.style.setProperty('--shadow-on',  '0 2px 10px rgba('+ar+','+ag+','+ab+',0.22), 0 0 1px rgba('+ar+','+ag+','+ab+',0.3)');
        // Kachelform
        var radii = { sharp: '6px', rounded: '14px', pill: '28px' };
        root.style.setProperty('--radius', radii[cfg.tileRadius] || '14px');
        // Kachelfarben (Tile Color Mode)
        var colorMode = cfg.tileColorMode || 'off';
        var colorOn   = cfg.tileColorOn   || '#34C759';
        var colorOff  = cfg.tileColorOff  || '';
        var colorFlow = cfg.tileColorFlow || '#AF52DE';
        document.body.classList.remove('tile-colors-subtle', 'tile-colors-strong');
        if (colorMode !== 'off') {
          document.body.classList.add('tile-colors-' + colorMode);
          var onA     = colorMode === 'strong' ? 0.28 : 0.16;
          var shadowA = colorMode === 'strong' ? 0.24 : 0.13;
          var flowA   = colorMode === 'strong' ? 0.18 : 0.10;
          // Active color
          var cr = parseInt(colorOn.slice(1,3),16), cg = parseInt(colorOn.slice(3,5),16), cb = parseInt(colorOn.slice(5,7),16);
          root.style.setProperty('--tc-on-bg',     'rgba('+cr+','+cg+','+cb+','+onA+')');
          root.style.setProperty('--tc-on-shadow', '0 2px 12px rgba('+cr+','+cg+','+cb+','+shadowA+'), 0 0 1px rgba('+cr+','+cg+','+cb+',0.2)');
          // Inactive color (optional)
          if (colorOff && /^#[0-9a-fA-F]{6}$/.test(colorOff)) {
            var or2 = parseInt(colorOff.slice(1,3),16), og2 = parseInt(colorOff.slice(3,5),16), ob2 = parseInt(colorOff.slice(5,7),16);
            root.style.setProperty('--tc-off-bg', 'rgba('+or2+','+og2+','+ob2+','+onA+')');
          } else {
            root.style.removeProperty('--tc-off-bg');
          }
          // Flow color
          var fr = parseInt(colorFlow.slice(1,3),16), fg = parseInt(colorFlow.slice(3,5),16), fb = parseInt(colorFlow.slice(5,7),16);
          root.style.setProperty('--tc-flow-bg',     'rgba('+fr+','+fg+','+fb+','+flowA+')');
          root.style.setProperty('--tc-flow-border', 'rgba('+fr+','+fg+','+fb+','+(flowA*1.6)+')');
        } else {
          root.style.removeProperty('--tc-on-bg');
          root.style.removeProperty('--tc-on-shadow');
          root.style.removeProperty('--tc-off-bg');
          root.style.removeProperty('--tc-flow-bg');
          root.style.removeProperty('--tc-flow-border');
        }
        // Hintergrund-Stil
        var bgStyle = cfg.bgStyle || 'flat';
        document.body.classList.remove('bg-gradient', 'bg-glass');
        if (bgStyle === 'gradient') document.body.classList.add('bg-gradient');
        if (bgStyle === 'glass')    document.body.classList.add('bg-glass');
        // Animations-Modus
        var animMode = cfg.animMode || 'default';
        document.body.classList.remove('anim-off', 'anim-lively');
        if (animMode === 'off')    document.body.classList.add('anim-off');
        if (animMode === 'lively') document.body.classList.add('anim-lively');
        // Header Icon Style
        var headerIconStyle = cfg.headerIconStyle || 'svg';
        document.body.classList.toggle('hdr-icons-svg', headerIconStyle === 'svg');
        // Emoji- und SVG-Symbole sind unterschiedlich hoch — die Kopfzeile
        // aendert dadurch ihre Hoehe, nachdem _boot() sie schon gemessen hat.
        _syncHeaderHeight();
        // Theme Mode
        _applyThemeMode(cfg.themeMode);

        // Suchbutton
        _searchEnabled = cfg.searchEnabled === true;
        var searchBtn = document.getElementById('search-btn');
        if (searchBtn) searchBtn.style.display = _searchEnabled ? '' : 'none';

        _cameraFilterEnabled = cfg.cameraFilterEnabled === true;
        var camBtn = document.getElementById('camera-filter-btn');
        if (camBtn) camBtn.style.display = _cameraFilterEnabled ? '' : 'none';

        _speakerFilterEnabled = cfg.speakerFilterEnabled === true;
        var spkBtn = document.getElementById('speaker-filter-btn');
        if (spkBtn) spkBtn.style.display = _speakerFilterEnabled ? '' : 'none';

        _thermostatFilterEnabled = cfg.thermostatFilterEnabled === true;
        var thBtn = document.getElementById('thermostat-filter-btn');
        if (thBtn) thBtn.style.display = _thermostatFilterEnabled ? '' : 'none';

        _lightFilterEnabled = cfg.lightFilterEnabled === true;
        var ltBtn = document.getElementById('light-filter-btn');
        if (ltBtn) ltBtn.style.display = _lightFilterEnabled ? '' : 'none';

        _blindsFilterEnabled = cfg.blindsFilterEnabled === true;
        var blBtn = document.getElementById('blinds-filter-btn');
        if (blBtn) blBtn.style.display = _blindsFilterEnabled ? '' : 'none';

        _roomFilterEnabled = cfg.roomFilterEnabled === true;
        var rmBtn = document.getElementById('room-filter-btn');
        if (rmBtn) rmBtn.style.display = _roomFilterEnabled ? '' : 'none';

        // Header ausblenden
        _headerHidden = cfg.headerHidden === true;
        var header = document.querySelector('.header');
        if (_headerHidden) {
          if (header) header.style.display = 'none';
          root.style.setProperty('--header-h', '0px');
        } else {
          if (header) header.style.display = '';
          root.style.setProperty('--header-h', '50px');
        }
      }
    });

    xhr('GET', '/api/zones', null, function (err, zonesData) {
      if (err) { showError(); _loadRetryTimer = setTimeout(loadData, 5000); return; }

      xhr('GET', '/api/devices', null, function (err2, devicesData) {
        if (err2) { showError(); _loadRetryTimer = setTimeout(loadData, 5000); return; }

        zones = {};
        zonesData.forEach(function (z) { zones[z.id] = z; });

        devices = {};
        devicesData.forEach(function (d) { devices[d.id] = d; });

        render();
        connectSSE();
        startPolling(); // Parallel-Poll für Capabilities die Homey nicht via SSE pusht (z.B. input_external_1)
      });
    });
  }

  // ── Drag & Drop Reihenfolge ─────────────────────────
  var _order = [];
  try { _order = JSON.parse(localStorage.getItem('deviceOrder') || '[]'); } catch (_) {}

  var _flowOrder = [];
  try { _flowOrder = JSON.parse(localStorage.getItem('flowOrder') || '[]'); } catch (_) {}

  var _moodOrder = [];
  try { _moodOrder = JSON.parse(localStorage.getItem('moodOrder') || '[]'); } catch (_) {}

  // Geraete, Flows und Moods teilen dieselbe Sortier- und Drag-Logik.
  // Sortiert nach gespeicherter Reihenfolge; Unbekanntes alphabetisch ans Ende.
  function _sortByOrder(list, order) {
    return list.slice().sort(function (a, b) {
      var ia = order.indexOf(a.id);
      var ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.name.localeCompare(b.name);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  function getOrderedDevices(list) { return _sortByOrder(list, _order); }
  function getOrderedFlows(list)   { return _sortByOrder(list, _flowOrder); }
  function getOrderedMoods(list)   { return _sortByOrder(list, _moodOrder); }

  // Liest die aktuelle DOM-Reihenfolge zurueck in das Order-Array (in-place,
  // damit die Referenz erhalten bleibt) und legt sie im localStorage ab.
  function _persistOrder(grid, selector, idPrefix, order, storeKey) {
    var ids = Array.from(grid.querySelectorAll(selector))
      .map(function (el) { return el.id.replace(idPrefix, ''); });
    var first = ids.find(function (id) { return order.indexOf(id) !== -1; });
    var insertAt = first ? order.indexOf(first) : order.length;
    ids.forEach(function (id) {
      var i = order.indexOf(id);
      if (i !== -1) { if (i < insertAt) insertAt--; order.splice(i, 1); }
    });
    ids.forEach(function (id, i) { order.splice(insertAt + i, 0, id); });
    try { localStorage.setItem(storeKey, JSON.stringify(order)); } catch (_) {}
  }

  function saveOrderFromGrid(grid) {
    _persistOrder(grid, '.device-card', 'card-', _order, 'deviceOrder');
  }
  function saveFlowOrderFromGrid(grid) {
    _persistOrder(grid, '.flow-tile', 'flow-tile-', _flowOrder, 'flowOrder');
  }
  function saveMoodOrderFromGrid(grid) {
    _persistOrder(grid, '.mood-tile', 'mood-tile-', _moodOrder, 'moodOrder');
  }

  var _drag = null;

  function _initDrag(grid, selector, onSave) {
    Array.from(grid.querySelectorAll(selector)).forEach(function (el) {
      makeDraggable(el, grid, selector, onSave);
    });
  }

  function initDragOnGrid(grid)     { _initDrag(grid, '.device-card', saveOrderFromGrid); }
  function initDragOnFlowGrid(grid) { _initDrag(grid, '.flow-tile',   saveFlowOrderFromGrid); }
  function initDragOnMoodGrid(grid) { _initDrag(grid, '.mood-tile',   saveMoodOrderFromGrid); }

  // cardSelector: CSS-Selektor für die draggbaren Elemente im Grid
  // onReorder:    Callback(grid) nach erfolgreichem Drop
  function makeDraggable(card, grid, cardSelector, onReorder) {
    var st = null;

    function onDown(e) {
      if (_drag || st) return;
      var pt = e.touches ? e.touches[0] : e;
      st = { startX: pt.clientX, startY: pt.clientY };
      st.timer = setTimeout(function () { activateDrag(pt.clientX, pt.clientY); }, 400);
      if (e.touches) {
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
        document.addEventListener('touchcancel', onUp);
      } else {
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }
    }

    function onMove(e) {
      var pt = e.touches ? e.touches[0] : e;
      if (!_drag) {
        if (st && Math.abs(pt.clientX - st.startX) + Math.abs(pt.clientY - st.startY) > 10) {
          clearTimeout(st.timer); cleanup();
        }
        return;
      }
      if (e.cancelable) e.preventDefault();
      _drag.ghost.style.left = (pt.clientX - _drag.offX) + 'px';
      _drag.ghost.style.top  = (pt.clientY - _drag.offY) + 'px';
      _drag.ghost.style.visibility = 'hidden';
      var el = document.elementFromPoint(pt.clientX, pt.clientY);
      _drag.ghost.style.visibility = '';
      var target = el && el.closest ? el.closest(cardSelector) : null;
      Array.from(grid.querySelectorAll(cardSelector + '.drag-over'))
        .forEach(function (c) { c.classList.remove('drag-over'); });
      _drag.over = (target && target !== card) ? target : null;
      if (_drag.over) _drag.over.classList.add('drag-over');
    }

    function onUp() {
      if (!_drag) { clearTimeout(st && st.timer); cleanup(); return; }
      Array.from(grid.querySelectorAll(cardSelector + '.drag-over'))
        .forEach(function (c) { c.classList.remove('drag-over'); });
      if (_drag.over) {
        var cards = Array.from(grid.querySelectorAll(cardSelector));
        var fi = cards.indexOf(card);
        var ti = cards.indexOf(_drag.over);
        if (fi < ti) grid.insertBefore(card, _drag.over.nextSibling);
        else         grid.insertBefore(card, _drag.over);
        if (onReorder) onReorder(grid);
      }
      _drag.ghost.remove();
      card.style.opacity = '';
      card.style.transform = '';
      _drag = null;
      cleanup();
    }

    function cleanup() {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      st = null;
    }

    function activateDrag(x, y) {
      var rect = card.getBoundingClientRect();
      var ghost = card.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;width:' +
        rect.width + 'px;left:' + rect.left + 'px;top:' + rect.top + 'px;' +
        'opacity:0.92;box-shadow:0 8px 32px rgba(0,0,0,0.25);transform:rotate(1.5deg) scale(1.04);';
      document.body.appendChild(ghost);
      card.style.opacity = '0.3';
      _drag = { ghost: ghost, offX: x - rect.left, offY: y - rect.top, over: null };
      st = null;
    }

    card.addEventListener('touchstart', onDown, { passive: true });
    card.addEventListener('mousedown', onDown);
  }

  // ── Flow-Sektion ─────────────────────────────────────
  var _flowsData = {}; // id → { id, name, type }

  // ── Weather Widget ──────────────────────────────────────────────────────

  var WMO_EMOJI = {
    0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
    45:'🌫️', 48:'🌫️',
    51:'🌦️', 53:'🌦️', 55:'🌦️', 56:'🌨️', 57:'🌨️',
    61:'🌧️', 63:'🌧️', 65:'🌧️', 66:'🌨️', 67:'🌨️',
    71:'🌨️', 73:'🌨️', 75:'❄️', 77:'🌨️',
    80:'🌦️', 81:'🌧️', 82:'⛈️', 85:'🌨️', 86:'❄️',
    95:'⛈️', 96:'⛈️', 99:'⛈️'
  };

  var WMO_DESC_ALL = {
    en: {
      0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
      45:'Fog', 48:'Freezing fog',
      51:'Light drizzle', 53:'Drizzle', 55:'Dense drizzle',
      56:'Light freezing drizzle', 57:'Freezing drizzle',
      61:'Light rain', 63:'Rain', 65:'Heavy rain',
      66:'Light freezing rain', 67:'Freezing rain',
      71:'Light snow', 73:'Snow', 75:'Heavy snow', 77:'Snow grains',
      80:'Rain showers', 81:'Moderate showers', 82:'Heavy showers',
      85:'Snow showers', 86:'Heavy snow showers',
      95:'Thunderstorm', 96:'Thunderstorm', 99:'Thunderstorm'
    },
    de: {
      0:'Klarer Himmel', 1:'Überwiegend klar', 2:'Teilweise bewölkt', 3:'Bedeckt',
      45:'Nebel', 48:'Reifnebel',
      51:'Leichter Nieselregen', 53:'Nieselregen', 55:'Starker Nieselregen',
      56:'Leichter gefrierender Nieselregen', 57:'Gefrierender Nieselregen',
      61:'Leichter Regen', 63:'Regen', 65:'Starker Regen',
      66:'Leichter gefrierender Regen', 67:'Gefrierender Regen',
      71:'Leichter Schneefall', 73:'Schneefall', 75:'Starker Schneefall', 77:'Schneegriesel',
      80:'Regenschauer', 81:'Mässige Schauer', 82:'Starke Schauer',
      85:'Schneeschauer', 86:'Starke Schneeschauer',
      95:'Gewitter', 96:'Gewitter', 99:'Gewitter'
    },
  };
  var WMO_DESC = WMO_DESC_ALL[lang];

  var _weatherModalTab = 'today';

  function fetchWeather() {
    if ((!_weatherEnabled && !_weatherHeaderBtn) || !_weatherLat || !_weatherLon) return;
    var unitParam = _weatherUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude='  + _weatherLat
      + '&longitude=' + _weatherLon
      + '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature,surface_pressure'
      + '&hourly=temperature_2m,weather_code,precipitation_probability'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset'
      + '&temperature_unit=' + unitParam
      + '&wind_speed_unit=kmh'
      + '&timezone=auto'
      + '&forecast_days=7';
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.onload = function () {
      if (req.status === 200) {
        try {
          _weatherData = JSON.parse(req.responseText);
          var existing = document.getElementById('weather-widget');
          if (existing && existing.parentNode) {
            var updated = buildWeatherTile();
            existing.parentNode.replaceChild(updated, existing);
          }
          // Re-render modal if already open
          var modal = document.getElementById('weather-modal');
          if (modal && modal.style.display !== 'none') renderWeatherModal();
        } catch (e) {}
      }
    };
    req.send();
  }

  function openWeatherModal() {
    document.getElementById('weather-modal').style.display = 'flex';
    _weatherModalTab = 'today';
    document.getElementById('weather-tab-today').classList.add('active');
    document.getElementById('weather-tab-week').classList.remove('active');
    renderWeatherModal();
    if (!_weatherData) fetchWeather();
  }
  window.openWeatherModal = openWeatherModal;

  function closeWeatherModal() {
    document.getElementById('weather-modal').style.display = 'none';
  }
  window.closeWeatherModal = closeWeatherModal;

  function switchWeatherTab(tab) {
    _weatherModalTab = tab;
    document.getElementById('weather-tab-today').classList.toggle('active', tab === 'today');
    document.getElementById('weather-tab-week').classList.toggle('active', tab === 'week');
    renderWeatherModal();
  }
  window.switchWeatherTab = switchWeatherTab;

  function renderWeatherModal() {
    var body = document.getElementById('weather-body');
    if (!body) return;
    if (!_weatherData || !_weatherData.current) {
      body.innerHTML = '<div class="wm-spinner"><div class="spinner"></div></div>';
      return;
    }
    if (_weatherModalTab === 'today') {
      renderWeatherToday(body);
    } else {
      renderWeather7Days(body);
    }
  }

  function renderWeatherToday(body) {
    var d = _weatherData;
    var cur = d.current;
    var u = _weatherUnit === 'fahrenheit' ? '°F' : '°C';
    var code = cur.weather_code || 0;
    var emoji = WMO_EMOJI[code] !== undefined ? WMO_EMOJI[code] : '🌡️';
    var desc  = WMO_DESC[code] || '';

    // Current overview
    var html =
      '<div class="wm-current">' +
        '<div class="wm-current-main">' +
          '<div class="wm-big-emoji">' + emoji + '</div>' +
          '<div>' +
            '<div class="wm-big-temp">' + Math.round(cur.temperature_2m) + u + '</div>' +
            '<div class="wm-big-desc">' + desc + '</div>' +
            '<div class="wm-city-name">' + _weatherCity + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="wm-details">' +
          '<div class="wm-detail-item"><div class="wm-detail-label">' + T.feelsLike + '</div><div class="wm-detail-value">' + Math.round(cur.apparent_temperature) + u + '</div></div>' +
          '<div class="wm-detail-item"><div class="wm-detail-label">' + T.humidity + '</div><div class="wm-detail-value">' + cur.relative_humidity_2m + '%</div></div>' +
          '<div class="wm-detail-item"><div class="wm-detail-label">' + T.wind + '</div><div class="wm-detail-value">' + Math.round(cur.wind_speed_10m) + ' km/h</div></div>' +
          '<div class="wm-detail-item"><div class="wm-detail-label">' + T.pressure + '</div><div class="wm-detail-value">' + Math.round(cur.surface_pressure) + ' hPa</div></div>' +
        '</div>' +
      '</div>';

    // Hourly forecast — next 24 h
    // Use current.time from the API response as lower bound — it is already in
    // the location's local timezone (because we request timezone=auto), so no
    // device-clock arithmetic is needed and timezone/DST bugs are avoided.
    if (d.hourly && d.hourly.time && d.hourly.time.length) {
      var nowHourStr = (d.current && d.current.time) ? d.current.time : '';

      // Find start index (first hourly entry >= current observation time)
      var startIdx = 0;
      for (var si = 0; si < d.hourly.time.length; si++) {
        if (d.hourly.time[si] >= nowHourStr) { startIdx = si; break; }
      }

      html += '<div class="wm-section-title">' + T.hourly + '</div><div class="wm-hourly-wrap"><div class="wm-hourly">';
      var count = 0;
      for (var i = startIdx; i < d.hourly.time.length && count < 8; i += 3) {
        var hTime  = d.hourly.time[i];
        var hHour  = hTime.substring(11, 13);
        var hEmoji = WMO_EMOJI[d.hourly.weather_code[i]] !== undefined ? WMO_EMOJI[d.hourly.weather_code[i]] : '🌡️';
        var hTemp  = Math.round(d.hourly.temperature_2m[i]);
        var hRain  = d.hourly.precipitation_probability[i] || 0;
        html += '<div class="wm-hour">' +
          '<div class="wm-hour-time">' + hHour + ':00</div>' +
          '<div class="wm-hour-emoji">' + hEmoji + '</div>' +
          '<div class="wm-hour-temp">' + hTemp + '°</div>' +
          '<div class="wm-hour-rain">' + (hRain > 0 ? '💧 ' + hRain + '%' : '') + '</div>' +
        '</div>';
        count++;
      }
      html += '</div></div>';
    }

    body.innerHTML = html;
  }

  function renderWeather7Days(body) {
    var d = _weatherData;
    var u = _weatherUnit === 'fahrenheit' ? '°F' : '°C';
    if (!d.daily || !d.daily.time || !d.daily.time.length) {
      body.innerHTML = '<div class="wm-empty">' + T.noForecast + '</div>';
      return;
    }
    var dayNames = lang === 'de'
      ? ['So','Mo','Di','Mi','Do','Fr','Sa']
      : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    var html = '<div class="wm-days">';
    for (var i = 0; i < d.daily.time.length; i++) {
      var date    = new Date(d.daily.time[i] + 'T12:00:00');
      var isToday = (i === 0);
      var dayName = isToday ? T.today : dayNames[date.getDay()];
      var dCode  = d.daily.weather_code[i];
      var dEmoji = WMO_EMOJI[dCode] !== undefined ? WMO_EMOJI[dCode] : '🌡️';
      var dDesc  = WMO_DESC[dCode] || '';
      var dMax   = Math.round(d.daily.temperature_2m_max[i]);
      var dMin   = Math.round(d.daily.temperature_2m_min[i]);
      var dRain  = d.daily.precipitation_probability_max[i] || 0;
      var dWind  = Math.round(d.daily.wind_speed_10m_max[i]);

      html += '<div class="wm-day' + (isToday ? ' wm-day-today' : '') + '">' +
        '<div class="wm-day-left">' +
          '<div class="wm-day-name">' + dayName + '</div>' +
          '<div class="wm-day-desc">' + dDesc + '</div>' +
        '</div>' +
        '<div class="wm-day-emoji">' + dEmoji + '</div>' +
        '<div class="wm-day-right">' +
          '<div class="wm-day-temps"><span class="wm-day-max">' + dMax + u + '</span><span class="wm-day-min">' + dMin + u + '</span></div>' +
          '<div class="wm-day-meta">' +
            (dRain > 0 ? '<span>💧 ' + dRain + '%</span>' : '') +
            '<span>💨 ' + dWind + ' km/h</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';
    body.innerHTML = html;
  }

  function buildWeatherTile() {
    var tile = createElement('div', 'weather-widget');
    tile.id = 'weather-widget';
    tile.addEventListener('click', openWeatherModal);

    if (!_weatherData || !_weatherData.current) {
      tile.innerHTML =
        '<div class="weather-left"><div class="weather-emoji">🌡️</div></div>' +
        '<div class="weather-right"><div class="weather-city">' + (_weatherCity || T.weather) + '</div>' +
        '<div class="weather-desc">Loading…</div></div>';
      return tile;
    }

    var cur  = _weatherData.current;
    var code = cur.weather_code || 0;
    var emoji = WMO_EMOJI[code] !== undefined ? WMO_EMOJI[code] : '🌡️';
    var desc  = WMO_DESC[code]  || '';
    var temp  = Math.round(cur.temperature_2m);
    var unit  = _weatherUnit === 'fahrenheit' ? '°F' : '°C';
    var wind  = Math.round(cur.wind_speed_10m);
    var hum   = cur.relative_humidity_2m;

    tile.innerHTML =
      '<div class="weather-left">' +
        '<div class="weather-emoji">' + emoji + '</div>' +
        '<div class="weather-temp">' + temp + unit + '</div>' +
      '</div>' +
      '<div class="weather-right">' +
        '<div class="weather-city">' + _weatherCity + '</div>' +
        '<div class="weather-desc">' + desc + '</div>' +
        '<div class="weather-meta">' +
          '<span>💨 ' + wind + ' km/h</span>' +
          '<span>💧 ' + hum + '%</span>' +
        '</div>' +
      '</div>';
    return tile;
  }

  // ── End Weather Widget ──────────────────────────────────────────────────

  function buildDashboardShortcutTile(icon, label, onClick) {
    var tile = createElement('button', 'flow-tile dashboard-shortcut-tile');
    var iconEl = createElement('span', 'flow-tile-icon');
    iconEl.textContent = icon;
    tile.appendChild(iconEl);
    var nameEl = createElement('span', 'flow-tile-name');
    nameEl.textContent = label;
    tile.appendChild(nameEl);
    tile.addEventListener('click', onClick);
    return tile;
  }

  // Holt die Flow-Liste einmal und liefert sie danach aus dem Speicher.
  function _withFlowList(cb) {
    if (_flowListCache) { cb(null, _flowListCache); return; }
    xhr('GET', '/api/flows', null, function (err, flows) {
      if (!err && flows) _flowListCache = flows;
      cb(err, flows);
    });
  }

  function _withMoodList(cb) {
    if (_moodListCache) { cb(null, _moodListCache); return; }
    xhr('GET', '/api/moods', null, function (err, moods) {
      if (!err && moods) _moodListCache = moods;
      cb(err, moods);
    });
  }

  // Vom SSE-Handler aufgerufen, wenn in Homey ein Flow/Mood angelegt,
  // umbenannt oder geloescht wurde.
  function _invalidateFlowMoodLists() {
    _flowListCache = null;
    _moodListCache = null;
  }

  function renderFlowSection(container) {
    var section = createElement('div', 'flow-section');

    var grid = createElement('div', 'flow-grid' + (_flowTileMatch ? ' flow-grid-fixed' : ''));
    section.appendChild(grid);
    container.appendChild(section);

    // Weather tile — always in the flow grid when enabled
    if (_weatherEnabled && _weatherLat && _weatherLon) {
      grid.appendChild(buildWeatherTile());
    }

    // Dashboard-Shortcut-Tiles: nur wenn Header ausgeblendet
    if (_headerHidden) {
      if (_energyEnabled) {
        grid.appendChild(buildDashboardShortcutTile('⚡', T.energy, function () { openEnergyModal(); }));
      }
      if (_evEnabled) {
        grid.appendChild(buildDashboardShortcutTile('🚗', 'EV', function () { openEvModal(); }));
      }
    }

    // Flows aus dem Cache oder einmalig vom Server (Namen + Typen)
    _withFlowList(function (err, flows) {
      if (err || !flows) return;
      // null = alle zeigen, [] = keine, [ids] = Filter
      var visible;
      if (_enabledFlows === null) {
        visible = flows; // alle
      } else {
        var enabledSet = new Set(_enabledFlows);
        visible = flows.filter(function (f) { return enabledSet.has(f.id); });
      }
      if (!visible.length) {
        section.style.display = 'none';
        return;
      }
      // Gespeicherte Reihenfolge anwenden
      getOrderedFlows(visible).forEach(function (f) {
        _flowsData[f.id] = f;
        grid.appendChild(buildFlowTile(f));
      });
      // Drag & Drop aktivieren
      initDragOnFlowGrid(grid);
    });
  }

  // Flow- und Mood-Kacheln verhalten sich identisch — gleiche Optik, gleicher
  // Bestaetigungsdialog, gleiche Lauf-/Erfolg-/Fehler-Zustaende. Sie unterscheiden
  // sich nur in Icon, Ziel-URL und Datenquelle; das steht hier gebuendelt.
  var _TILE_KINDS = {
    flow: {
      cls:      'flow-tile',
      idPrefix: 'flow-tile-',
      icon:     '▶',
      data:     function () { return _flowsData; },
      url:      function (id) { return '/api/flow/' + id + '/trigger'; },
      subtitle: function () { return ''; },
    },
    mood: {
      cls:      'flow-tile mood-tile',
      idPrefix: 'mood-tile-',
      icon:     '☾',
      data:     function () { return _moodsData; },
      url:      function (id) { return '/api/mood/' + id + '/set'; },
      subtitle: function (m) { return (m && m.zone) || ''; },
    },
  };

  function _buildTile(kind, item) {
    var k = _TILE_KINDS[kind];
    var tile = createElement('button', k.cls);
    tile.id = k.idPrefix + item.id;
    tile.setAttribute('aria-label', item.name);
    var sub = k.subtitle(item);
    if (sub) tile.title = sub;

    var icon = createElement('span', 'flow-tile-icon');
    icon.textContent = k.icon;
    tile.appendChild(icon);

    var name = createElement('span', 'flow-tile-name');
    name.textContent = item.name;
    tile.appendChild(name);

    tile.addEventListener('click', function () { _activateTile(kind, item.id, tile); });
    return tile;
  }

  function _activateTile(kind, id, tileEl) {
    if (!tileEl || tileEl.classList.contains('flow-running')) return;
    if (_flowConfirm) { _confirmTile(kind, id, tileEl); return; }
    _runTile(kind, id, tileEl);
  }

  function _confirmTile(kind, id, tileEl) {
    var item = _TILE_KINDS[kind].data()[id];
    // Guard: Daten noch nicht geladen oder Modal fehlt -> direkt ausloesen
    if (!item) { _runTile(kind, id, tileEl); return; }
    var nameEl    = document.getElementById('flow-confirm-name');
    var modal     = document.getElementById('flow-confirm-modal');
    var okBtn     = document.getElementById('flow-confirm-ok');
    var cancelBtn = document.getElementById('flow-confirm-cancel');
    if (!modal) { _runTile(kind, id, tileEl); return; }
    if (nameEl) nameEl.textContent = item.name;
    modal.style.display = 'flex';

    // Handler einmalig setzen (vorherige entfernen)
    var newOk     = okBtn.cloneNode(true);
    var newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.addEventListener('click', function () {
      modal.style.display = 'none';
      _runTile(kind, id, tileEl);
    });
    newCancel.addEventListener('click', function () {
      modal.style.display = 'none';
    });
    // Hintergrund-Klick schliesst Modal
    modal.onclick = function (e) {
      if (e.target === modal) modal.style.display = 'none';
    };
  }

  function _runTile(kind, id, tileEl) {
    var k = _TILE_KINDS[kind];
    tileEl.classList.add('flow-running');
    var iconEl = tileEl.querySelector('.flow-tile-icon');
    if (iconEl) iconEl.textContent = '⟳';

    xhr('POST', k.url(id), '{}', function (err, data) {
      tileEl.classList.remove('flow-running');
      if (err) {
        tileEl.classList.add('flow-error');
        if (iconEl) iconEl.textContent = '✕';
        tileEl.title = (data && data.error) ? data.error : err.message;
        setTimeout(function () {
          tileEl.classList.remove('flow-error');
          tileEl.title = k.subtitle(k.data()[id]);
          if (iconEl) iconEl.textContent = k.icon;
        }, 3000);
      } else {
        tileEl.classList.add('flow-success');
        if (iconEl) iconEl.textContent = '✓';
        setTimeout(function () {
          tileEl.classList.remove('flow-success');
          if (iconEl) iconEl.textContent = k.icon;
        }, 1800);
      }
    });
  }

  function buildFlowTile(f) { return _buildTile('flow', f); }
  function buildMoodTile(m) { return _buildTile('mood', m); }

  // ── Moods ───────────────────────────────────────────
  // Eigenes Grid neben den Flows — Moods behalten so ihre eigene
  // Reihenfolge und ihr eigenes Drag & Drop.
  function renderMoodSection(container) {
    var section = createElement('div', 'mood-section');
    var grid = createElement('div', 'mood-grid flow-grid' + (_flowTileMatch ? ' flow-grid-fixed' : ''));
    section.appendChild(grid);
    container.appendChild(section);

    _withMoodList(function (err, moods) {
      if (err || !moods) { section.style.display = 'none'; return; }
      // null = alle zeigen, [] = keine, [ids] = Filter
      var visible;
      if (_enabledMoods === null) {
        visible = moods;
      } else {
        var enabledSet = new Set(_enabledMoods);
        visible = moods.filter(function (m) { return enabledSet.has(m.id); });
      }
      if (!visible.length) { section.style.display = 'none'; return; }
      getOrderedMoods(visible).forEach(function (m) {
        _moodsData[m.id] = m;
        grid.appendChild(buildMoodTile(m));
      });
      initDragOnMoodGrid(grid);
    });
  }

  // ── Rendern ─────────────────────────────────────────
  function render() {
    updateViewToggle();
    var container = document.getElementById('zones-container');
    container.innerHTML = '';

    // null = alle anzeigen, [] = keine, [ids] = spezifische
    var showFlows = _enabledFlows === null || (_enabledFlows && _enabledFlows.length > 0);
    var showMoods = _enabledMoods === null || (_enabledMoods && _enabledMoods.length > 0);

    // Flows-Sektion oben (Standard)
    if (showFlows && _flowPosition !== 'bottom') {
      renderFlowSection(container);
    }
    // Moods folgen der gleichen Positionseinstellung wie die Flows
    if (showMoods && _flowPosition !== 'bottom') {
      renderMoodSection(container);
    }

    if (viewMode === 'all') {
      renderAllFlat(container);
    } else {
      renderByZones(container);
    }

    // Flows-Sektion unten (optional)
    if (showFlows && _flowPosition === 'bottom') {
      renderFlowSection(container);
    }
    if (showMoods && _flowPosition === 'bottom') {
      renderMoodSection(container);
    }

    // Empty State — keine Geräte konfiguriert / sichtbar
    if (Object.keys(devices).length === 0) {
      var es = createElement('div', 'empty-state');
      es.innerHTML =
        '<div class="empty-state-icon">🏠</div>' +
        '<div class="empty-state-title">' + T.noDevicesTitle + '</div>' +
        '<div class="empty-state-body">' + T.noDevicesBody + '</div>';
      container.appendChild(es);
    }

    // render() baut den Container komplett neu auf — dabei gehen die per
    // style.display gesetzten Filter verloren, waehrend die Kopfzeilen-Buttons
    // weiter aktiv aussehen. Deshalb den aktiven Filter erneut anwenden.
    _reapplyFilters();
    // Buttons koennen sich ein-/ausblenden — Hoehe erneut abgleichen
    _syncHeaderHeight();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-msg').style.display = 'none';
    container.style.display = 'block';
    _hasRendered = true;
  }

  // Such-, Klassen- und Raumfilter schliessen sich gegenseitig aus —
  // es kann also hoechstens einer aktiv sein.
  function _reapplyFilters() {
    if (_searchQuery) { _applySearchFilter(_searchQuery); return; }
    if (_activeClassFilter) { _applyClassFilter(); return; }
    if (_activeRoomFilter) { _applyRoomFilter(); }
  }

  function renderByZones(container) {
    var byZone = {};
    var noZone = [];

    Object.values(devices).forEach(function (d) {
      if (d.zone && zones[d.zone]) {
        if (!byZone[d.zone]) byZone[d.zone] = [];
        byZone[d.zone].push(d);
      } else {
        noZone.push(d);
      }
    });

    // Reihenfolge: gespeicherte _zoneOrder zuerst, danach alphabetisch für neue Räume
    var zoneIds = Object.keys(byZone);
    zoneIds.sort(function (a, b) {
      var ia = _zoneOrder.indexOf(a);
      var ib = _zoneOrder.indexOf(b);
      if (ia === -1 && ib === -1) return zones[a].name.localeCompare(zones[b].name);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    zoneIds.forEach(function (zoneId) {
      container.appendChild(buildZoneSection(zones[zoneId].name, byZone[zoneId]));
    });

    if (noZone.length > 0) {
      container.appendChild(buildZoneSection(T.other, noZone));
    }
  }

  function renderAllFlat(container) {
    var allDevices = getOrderedDevices(Object.values(devices));
    var section = createElement('div', 'zone-section');
    var grid = createElement('div', 'device-grid');
    allDevices.forEach(function (d) { grid.appendChild(buildDeviceCard(d)); });
    initDragOnGrid(grid);
    section.appendChild(grid);
    container.appendChild(section);
  }

  function buildZoneSection(zoneName, deviceList) {
    var section = createElement('div', 'zone-section');

    // Collapsed-Zustand aus localStorage wiederherstellen
    if (_collapsedZones[zoneName]) {
      section.classList.add('collapsed');
    }

    section.setAttribute('data-zone', zoneName.toLowerCase());

    var title = createElement('div', 'zone-title');
    title.textContent = zoneName;

    title.addEventListener('click', function () {
      var isNowCollapsed = section.classList.toggle('collapsed');
      _collapsedZones[zoneName] = isNowCollapsed || undefined;
      // Sauber aufräumen: nicht-eingeklappte Räume aus dem Objekt entfernen
      if (!isNowCollapsed) delete _collapsedZones[zoneName];
      try { localStorage.setItem('collapsedZones', JSON.stringify(_collapsedZones)); } catch (_) {}
    });

    section.appendChild(title);

    var grid = createElement('div', 'device-grid');

    getOrderedDevices(deviceList).forEach(function (d) {
      grid.appendChild(buildDeviceCard(d));
    });
    initDragOnGrid(grid);

    section.appendChild(grid);
    return section;
  }

  function buildDeviceCard(d) {
    var card = createElement('div', 'device-card');
    card.id = 'card-' + d.id;
    card.setAttribute('data-name', d.name.toLowerCase());
    card.setAttribute('data-class', d.class || '');
    card.setAttribute('data-zone-id', d.zone || '');
    if (!d.available) card.classList.add('unavailable');

    var caps      = d.capabilitiesObj || {};
    var capIds    = d.capabilities || [];
    var hasOnOff  = capIds.indexOf(CAP.ONOFF) !== -1;
    var hasAlarm  = d.class === 'homealarm' || capIds.indexOf(CAP.HOMEALARM) !== -1 || capIds.indexOf(CAP.HOMEALARM_STATE) !== -1;
    var hasDim    = capIds.indexOf(CAP.DIM) !== -1;
    var hasWcState = capIds.indexOf(CAP.WC_STATE) !== -1 && capIds.indexOf(CAP.WC_SET) === -1;
    var isSpeaker    = d.class === 'speaker' || d.class === 'mediaplayer';
    var isThermostat = capIds.indexOf(CAP.TARGET_TEMP) !== -1;
    var isLock       = d.class === 'lock';
    var isCamera     = d.class === 'camera' || d.class === 'doorbell';
    var isPriceDevice = capIds.indexOf('current_quarter_price') !== -1;
    var _buttonCapId = null;
    for (var _bi = 0; _bi < capIds.length; _bi++) {
      if (capIds[_bi] === 'button' || capIds[_bi].indexOf('devicecapabilities_button.button') === 0) {
        _buttonCapId = capIds[_bi]; break;
      }
    }
    var hasButton = _buttonCapId !== null && !hasOnOff && !hasAlarm;
    var isOn         = hasOnOff && caps[CAP.ONOFF] && caps[CAP.ONOFF].value === true;
    var alarmCap  = hasAlarm ? getAlarmCapability(d) : null;
    var isArmed   = alarmCap ? alarmIsArmed(alarmCap.value) : false;
    var wcState   = hasWcState && caps[CAP.WC_STATE] ? caps[CAP.WC_STATE].value : null;
    var isLocked  = isLock && caps[CAP.LOCKED] && caps[CAP.LOCKED].value === true;

    if (isOn || isArmed || isLocked) card.classList.add('on');
    if (wcState === 'up') card.classList.add('on');
    if (caps[CAP.INPUT_EXT_1] && caps[CAP.INPUT_EXT_1].value === true) card.classList.add('open');
    if (hasOnOff || hasDim || hasAlarm || hasWcState || isLock) card.classList.add('is-switchable');

    if (d.class === 'camera' || d.class === 'doorbell') {
      card.classList.add('clickable');
      (function (deviceId, deviceName) {
        card.addEventListener('click', function () {
          openCameraModal(deviceId, deviceName);
        });
      }(d.id, d.name));
    }

    // Speaker/Mediaplayer → Modal öffnen statt on/off
    if (isSpeaker) {
      card.classList.add('clickable');
      (function (deviceId) {
        card.addEventListener('click', function () {
          openSpeakerModal(deviceId);
        });
      }(d.id));
    }

    // Thermostat → Modal öffnen
    if (isThermostat) {
      card.classList.add('clickable');
      (function (deviceId) {
        card.addEventListener('click', function (e) {
          if (e.target.classList.contains('device-toggle')) return;
          openThermostatModal(deviceId);
        });
      }(d.id));
    }

    // Lock → Modal öffnen (Modal = Bestätigung + Aktionsauswahl)
    if (isLock) {
      card.classList.add('clickable');
      (function (deviceId) {
        card.addEventListener('click', function () { openLockModal(deviceId); });
      }(d.id));
    }

    // Energy Price Device → Preis-Modal öffnen
    if (isPriceDevice && !isSpeaker && !isThermostat && !isLock) {
      card.classList.add('clickable');
      (function (deviceId) {
        card.addEventListener('click', function () { openPriceModal(deviceId); });
      }(d.id));
    }

    if (!isSpeaker && !isThermostat && !isLock && !isPriceDevice && !isCamera && (hasAlarm || hasOnOff)) {
      card.classList.add('clickable');
      (function (deviceId) {
        card.addEventListener('click', function (e) {
          if (e.target.classList.contains('device-toggle')) return;
          if (e.target.tagName === 'INPUT') return; // Dim-/Blind-Slider ignorieren
          var dv = devices[deviceId];
          if (!dv) return;
          var cv = dv.capabilitiesObj || {};
          if (hasAlarm) {
            var ac = getAlarmCapability(devices[deviceId]);
            if (ac) {
              if (ac.capId === CAP.HOMEALARM_STATE) {
                openAlarmModal(deviceId);
              } else {
                var newVal = !alarmIsArmed(ac.value);
                requirePin(function () { setCapability(deviceId, ac.capId, newVal); });
              }
            }
          } else {
            setCapability(deviceId, CAP.ONOFF, !(cv[CAP.ONOFF] && cv[CAP.ONOFF].value));
          }
        });
      }(d.id));
    }

    // Button-Capability (z.B. virtuelle Buttons) — Tap feuert button=true
    if (hasButton && !isSpeaker && !isThermostat && !isLock && !isPriceDevice) {
      card.classList.add('clickable');
      (function (deviceId, capId, cardEl) {
        cardEl.addEventListener('click', function () {
          setCapability(deviceId, capId, true);
          var icon = cardEl.querySelector('.device-btn-trigger');
          if (icon) {
            icon.classList.add('triggered');
            setTimeout(function () { icon.classList.remove('triggered'); }, 600);
          }
        });
      }(d.id, _buttonCapId, card));
    }

    // windowcoverings_state (z.B. Somfy RTS — kein onoff, kein WC_SET)
    if (hasWcState) {
      card.classList.add('clickable');
      (function (deviceId) {
        card.addEventListener('click', function (e) {
          if (e.target.classList.contains('wc-state-btn')) return;
          var dv = devices[deviceId];
          if (!dv) return;
          var cur = (dv.capabilitiesObj[CAP.WC_STATE] || {}).value;
          // Tap: öffnen wenn zu/gestoppt, schliessen wenn offen
          setCapability(deviceId, CAP.WC_STATE, cur === 'up' ? 'down' : 'up');
        });
      }(d.id));
    }

    var header = createElement('div', 'device-header');
    header.appendChild(buildIconElement(d));

    if (!isSpeaker && !isCamera && hasOnOff) {
      var toggle = createElement('button', 'device-toggle');
      if (isOn) toggle.classList.add('on');
      toggle.setAttribute('aria-label', isOn ? T.turnOff : T.turnOn);
      toggle.addEventListener('click', function () {
        var newVal = !toggle.classList.contains('on');
        setCapability(d.id, CAP.ONOFF, newVal);
      });
      header.appendChild(toggle);
    }

    if (hasButton) {
      var btnTrigger = createElement('button', 'device-btn-trigger');
      btnTrigger.setAttribute('aria-label', T.trigger);
      (function (deviceId, capId, el) {
        btnTrigger.addEventListener('click', function (e) {
          e.stopPropagation();
          setCapability(deviceId, capId, true);
          el.classList.add('triggered');
          setTimeout(function () { el.classList.remove('triggered'); }, 600);
        });
      }(d.id, _buttonCapId, btnTrigger));
      header.appendChild(btnTrigger);
    }

    if (hasWcState) {
      // Stopp-Button (◼) — sendet 'idle'
      var stopBtn = createElement('button', 'wc-state-btn');
      stopBtn.textContent = '◼';
      stopBtn.title = T.stop;
      stopBtn.setAttribute('aria-label', T.stop);
      (function (deviceId) {
        stopBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          setCapability(deviceId, CAP.WC_STATE, 'idle');
        });
      }(d.id));
      header.appendChild(stopBtn);
    }

    if (hasAlarm) {
      var alarmToggle = createElement('button', 'device-toggle alarm-toggle');
      if (isArmed) alarmToggle.classList.add('on');
      alarmToggle.setAttribute('data-alarm', 'true');
      (function (deviceId, btn) {
        btn.addEventListener('click', function () {
          var ac = getAlarmCapability(devices[deviceId]);
          if (!ac) return;
          if (ac.capId === CAP.HOMEALARM_STATE) {
            openAlarmModal(deviceId);
          } else {
            requirePin(function () { setCapability(deviceId, ac.capId, !alarmIsArmed(ac.value)); });
          }
        });
      }(d.id, alarmToggle));
      header.appendChild(alarmToggle);
    }

    card.appendChild(header);

    // Spacer pushes values/status/name to the bottom of the tile
    card.appendChild(createElement('div', 'device-spacer'));

    var values = buildValueElements(d);
    if (values) card.appendChild(values);

    var statusEl = createElement('div', 'device-status');
    statusEl.id = 'status-' + d.id;
    statusEl.textContent = buildStatusText(d);
    card.appendChild(statusEl);

    var name = createElement('div', 'device-name');
    name.textContent = d.name;
    card.appendChild(name);

    return card;
  }

  // ── #15 Statustext für die Karte ────────────────────
  function buildStatusText(d) {
    var caps       = d.capabilitiesObj || {};
    var capIds     = d.capabilities || [];
    var hasOnOff   = capIds.indexOf(CAP.ONOFF) !== -1;
    var hasAlarm   = d.class === 'homealarm' || capIds.indexOf(CAP.HOMEALARM) !== -1 || capIds.indexOf(CAP.HOMEALARM_STATE) !== -1;
    var hasWcState = capIds.indexOf(CAP.WC_STATE) !== -1 && capIds.indexOf(CAP.WC_SET) === -1;

    if (d.class === 'lock') {
      var lkLocked = caps[CAP.LOCKED] && caps[CAP.LOCKED].value === true;
      return lkLocked ? T.locked : T.unlocked;
    }

    if (d.class === 'speaker' || d.class === 'mediaplayer') {
      var track   = caps[CAP.SPEAKER_TRACK]  && caps[CAP.SPEAKER_TRACK].value;
      var artist  = caps[CAP.SPEAKER_ARTIST] && caps[CAP.SPEAKER_ARTIST].value;
      var playing = caps[CAP.SPEAKER_PLAYING] && caps[CAP.SPEAKER_PLAYING].value === true;
      if (track) return (playing ? '▶ ' : '⏸ ') + track + (artist ? ' · ' + artist : '');
      return playing ? T.playing : T.stopped;
    }

    if (hasAlarm) {
      var ac = getAlarmCapability(d);
      if (ac) {
        if (ac.isBoolean) return alarmIsArmed(ac.value) ? T.armed : T.disarmed;
        return ac.value === 'armed' ? T.armed : ac.value === 'partially_armed' ? T.partlyArmed : T.disarmed;
      }
    }
    if (hasWcState) {
      var wcVal = caps[CAP.WC_STATE] ? caps[CAP.WC_STATE].value : null;
      if (wcVal === 'up')   return T.open;
      if (wcVal === 'down') return T.closed;
      if (wcVal === 'idle') return T.stopped;
      return '';
    }
    // Thermostat / Heizung
    if (capIds.indexOf(CAP.TARGET_TEMP) !== -1) {
      var target = caps[CAP.TARGET_TEMP] && caps[CAP.TARGET_TEMP].value;
      var hasOO  = capIds.indexOf(CAP.ONOFF) !== -1;
      var isOff  = hasOO && !(caps[CAP.ONOFF] && caps[CAP.ONOFF].value);
      if (isOff) return T.off;
      var mode = caps[CAP.THERMOSTAT_MODE] && caps[CAP.THERMOSTAT_MODE].value;
      var modeStr = (mode && mode !== 'heat') ? ' · ' + mode : '';
      return '→ ' + (target !== null && target !== undefined ? target.toFixed(1) + ' °C' : '—') + modeStr;
    }
    if (hasOnOff) {
      var isOn = caps[CAP.ONOFF] && caps[CAP.ONOFF].value === true;
      if (caps[CAP.DIM] && isOn) {
        return T.on + ' · ' + Math.round((caps[CAP.DIM].value || 0) * 100) + ' %';
      }
      return isOn ? T.on : T.off;
    }
    if (!d.available) return T.unavailable;
    return '';
  }

  function _energyPriceColorClass(d) {
    var caps   = d.capabilitiesObj || {};
    var capIds = d.capabilities    || [];
    if (capIds.indexOf('current_quarter_price') === -1) return null;
    var cur = caps['current_quarter_price'] && caps['current_quarter_price'].value;
    if (typeof cur !== 'number') return null;
    var jsonCap = caps['quarter_prices_json'];
    if (!jsonCap || typeof jsonCap.value !== 'string') return null;
    try {
      var data    = JSON.parse(jsonCap.value);
      var now     = Date.now();
      var horizon = now + 8 * 60 * 60 * 1000;
      var src     = Array.isArray(data) ? data : (data.today || []).concat(data.tomorrow || []);
      var prices  = [];
      src.forEach(function (e) {
        var ts = e.timestamp || 0;
        if (ts < now || ts > horizon) return;
        // Preis-Feld: verschiedene Feldnamen versuchen, dann beliebigen Zahlenwert
        var p = e.price !== undefined ? e.price :
                e.value !== undefined ? e.value :
                e.amount !== undefined ? e.amount :
                e.spotPrice !== undefined ? e.spotPrice :
                e.total !== undefined ? e.total : undefined;
        if (p === undefined) {
          for (var k in e) {
            if (typeof e[k] === 'number' && e[k] >= -1 && e[k] <= 10) { p = e[k]; break; }
          }
        }
        if (typeof p === 'number') prices.push(p);
      });
      if (prices.length < 3) return null;
      prices.sort(function (a, b) { return a - b; });
      var p33 = prices[Math.floor(prices.length / 3)];
      var p67 = prices[Math.floor(prices.length * 2 / 3)];
      if (cur <= p33) return 'price-green';
      if (cur <= p67) return 'price-yellow';
      return 'price-red';
    } catch (e) { return null; }
  }

  function buildValueElements(d) {
    var caps      = d.capabilitiesObj || {};
    var capIds    = d.capabilities    || [];
    var container = createElement('div', 'device-values');
    var added     = 0;

    // Primärwert: Temperatur
    var _noTemp = ['socket', 'light', 'windowcoverings', 'shutterblinds', 'blinds', 'curtain'];
    var _isSocketLike = capIds.indexOf(CAP.ONOFF) !== -1 &&
                        !!caps[CAP.MEASURE_POWER] &&
                        capIds.indexOf(CAP.TARGET_TEMP) === -1;
    if (_noTemp.indexOf(d.class) === -1 && !_isSocketLike && caps[CAP.MEASURE_TEMP]) {
      var el = createElement('div', 'device-value primary');
      var val = caps[CAP.MEASURE_TEMP].value;
      el.innerHTML = (val !== null && val !== undefined ? val.toFixed(1) : '--') +
        '<span class="value-unit"> °C</span>';
      container.appendChild(el);
      added++;
    }

    // Luftfeuchtigkeit
    if (caps[CAP.MEASURE_HUMIDITY]) {
      var el = createElement('div', 'device-value');
      var val = caps[CAP.MEASURE_HUMIDITY].value;
      el.textContent = '💧 ' + (val !== null && val !== undefined ? Math.round(val) + ' %' : '--');
      container.appendChild(el);
      added++;
    }

    // Leistung
    if (caps[CAP.MEASURE_POWER]) {
      var el = createElement('div', 'device-value');
      var val = caps[CAP.MEASURE_POWER].value;
      el.textContent = '⚡ ' + (val !== null && val !== undefined ? Math.round(val) + ' W' : '--');
      container.appendChild(el);
      added++;
    }

    // Helligkeit (Dim-Slider)
    if (caps[CAP.DIM]) {
      var val = caps[CAP.DIM].value !== null ? caps[CAP.DIM].value : 0;
      var pct = Math.round(val * 100);
      var slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'dim-slider';
      slider.min = '0';
      slider.max = '100';
      slider.value = pct;
      slider.style.setProperty('--val', pct + '%');
      var deviceId = d.id;
      slider.addEventListener('change', function () {
        var newVal = parseInt(this.value, 10) / 100;
        this.style.setProperty('--val', this.value + '%');
        setCapability(deviceId, CAP.DIM, newVal);
      });
      slider.addEventListener('input', function () {
        this.style.setProperty('--val', this.value + '%');
      });
      container.appendChild(slider);
      added++;
    }

    // Jalousie/Rollo-Slider
    if (caps[CAP.WC_SET]) {
      var val = caps[CAP.WC_SET].value !== null ? caps[CAP.WC_SET].value : 0;
      var pct = Math.round(val * 100);
      var label = createElement('div', 'device-value');
      label.textContent = '🪟 ' + pct + ' %';
      label.id = 'wc-label-' + d.id;
      container.appendChild(label);
      var slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'dim-slider';
      slider.min = '0';
      slider.max = '100';
      slider.value = pct;
      slider.style.setProperty('--val', pct + '%');
      var deviceId = d.id;
      slider.addEventListener('change', function () {
        var newVal = parseInt(this.value, 10) / 100;
        this.style.setProperty('--val', this.value + '%');
        setCapability(deviceId, CAP.WC_SET, newVal);
      });
      slider.addEventListener('input', function () {
        this.style.setProperty('--val', this.value + '%');
        var lbl = document.getElementById('wc-label-' + deviceId);
        if (lbl) lbl.textContent = '🪟 ' + this.value + ' %';
      });
      container.appendChild(slider);
      added++;
    }

    // Bewegungsalarm
    if (caps[CAP.ALARM_MOTION]) {
      var el = createElement('div', 'device-value');
      var dot = createElement('span', 'alarm-dot');
      if (caps[CAP.ALARM_MOTION].value) dot.classList.add('active');
      el.appendChild(dot);
      el.appendChild(document.createTextNode(' Motion'));
      container.appendChild(el);
      added++;
    }

    // Kontaktalarm (Türen/Fenster)
    if (caps[CAP.ALARM_CONTACT]) {
      var el = createElement('div', 'device-value');
      var dot = createElement('span', 'alarm-dot');
      if (caps[CAP.ALARM_CONTACT].value) dot.classList.add('active');
      el.appendChild(dot);
      el.appendChild(document.createTextNode(caps[CAP.ALARM_CONTACT].value ? ' ' + T.open : ' ' + T.closed));
      container.appendChild(el);
      added++;
    }

    // Externer Eingang (z.B. Reed-Kontakt am Garagentor)
    if (caps[CAP.INPUT_EXT_1]) {
      var el = createElement('div', 'device-value');
      var dot = createElement('span', 'alarm-dot');
      if (caps[CAP.INPUT_EXT_1].value) dot.classList.add('active');
      el.appendChild(dot);
      el.appendChild(document.createTextNode(caps[CAP.INPUT_EXT_1].value ? ' ' + T.open : ' ' + T.closed));
      container.appendChild(el);
      added++;
    }

    // CO2
    if (caps[CAP.MEASURE_CO2]) {
      var el = createElement('div', 'device-value');
      var val = caps[CAP.MEASURE_CO2].value;
      el.textContent = '💨 ' + (val !== null && val !== undefined ? Math.round(val) + ' ppm' : '--');
      container.appendChild(el);
      added++;
    }

    // Energiepreis-Farbkodierung auf der Kachel
    var priceColorClass = _energyPriceColorClass(d);
    if (priceColorClass) {
      var pcap = caps['current_quarter_price'];
      var pval = pcap && typeof pcap.value === 'number' ? pcap.value : null;
      if (pval !== null) {
        var pel = createElement('div', 'device-value primary ' + priceColorClass);
        pel.setAttribute('data-capid', 'current_quarter_price');
        var punit = (pcap.units || '');
        pel.textContent = parseFloat(pval.toFixed(4)) + (punit ? ' ' + punit : '');
        container.appendChild(pel);
        added++;
      }
    }

    // Fallback für Custom-Capabilities (z.B. current_quarter_price, solar_forecast_power)
    var _fbExcludeClasses = ['speaker', 'mediaplayer', 'homealarm', 'lock', 'light', 'socket'];
    if (added === 0 && _fbExcludeClasses.indexOf(d.class) === -1) {
      var fbSkip = [
        CAP.ONOFF, CAP.DIM, CAP.MEASURE_TEMP, CAP.MEASURE_HUMIDITY, CAP.MEASURE_POWER,
        CAP.MEASURE_CO2, CAP.WC_SET, CAP.WC_STATE, CAP.LOCKED, CAP.HOMEALARM_STATE,
        CAP.HOMEALARM, CAP.ALARM_MOTION, CAP.ALARM_CONTACT, CAP.INPUT_EXT_1,
        CAP.TARGET_TEMP, CAP.THERMOSTAT_MODE, CAP.SPEAKER_PLAYING, CAP.SPEAKER_TRACK,
        CAP.SPEAKER_ARTIST, CAP.VOLUME_SET, CAP.VOLUME_MUTE, 'measure_battery', 'alarm_battery',
        'current_quarter_price'
      ];
      var fbCapIds = d.capabilities || [];
      var fbCount  = 0;
      for (var fi = 0; fi < fbCapIds.length && fbCount < 2; fi++) {
        var fid = fbCapIds[fi];
        if (fbSkip.indexOf(fid) !== -1) continue;
        if (fid.indexOf('_json') !== -1) continue;
        if (fid.indexOf('_hour_') !== -1 || fid.indexOf('_tomorrow_') !== -1) continue;
        if (fid.indexOf('debug') !== -1 || fid.indexOf('timeline') !== -1) continue;
        if (fid.indexOf('button_') === 0) continue;
        var fcap = caps[fid];
        if (!fcap || typeof fcap.value !== 'number' || fcap.value === null) continue;
        var fval  = fcap.value;
        var funit = fcap.units || '';
        var fstr  = Math.abs(fval) < 10 ? parseFloat(fval.toFixed(2)) : Math.round(fval);
        var fel   = createElement('div', 'device-value' + (fbCount === 0 ? ' primary' : ''));
        fel.setAttribute('data-capid', fid);
        fel.textContent = fstr + (funit ? ' ' + funit : '');
        container.appendChild(fel);
        added++;
        fbCount++;
      }
    }

    return added > 0 ? container : null;
  }

  // ── Capability setzen ───────────────────────────────
  function setCapability(deviceId, capability, value) {
    var body = JSON.stringify({ value: value });
    var url  = '/api/device/' + deviceId + '/capability/' + capability;

    xhr('POST', url, body, function (err) {
      if (err) console.error('Fehler beim Setzen von ' + capability + ':', err);
    });

    // Optimistisches UI-Update
    if (!devices[deviceId]) return;
    if (!devices[deviceId].capabilitiesObj) devices[deviceId].capabilitiesObj = {};
    if (!devices[deviceId].capabilitiesObj[capability]) {
      devices[deviceId].capabilitiesObj[capability] = {};
    }
    devices[deviceId].capabilitiesObj[capability].value = value;
    updateCard(deviceId);
  }

  // ── Karte aktualisieren (ohne Re-render) ────────────
  function updateCard(deviceId) {
    var d = devices[deviceId];
    if (!d) return;
    var card = document.getElementById('card-' + deviceId);
    if (!card) return;

    var caps       = d.capabilitiesObj || {};
    var capIds     = d.capabilities || [];
    var hasOnOff   = capIds.indexOf(CAP.ONOFF) !== -1;
    var hasAlarm   = d.class === 'homealarm' || capIds.indexOf(CAP.HOMEALARM) !== -1 || capIds.indexOf(CAP.HOMEALARM_STATE) !== -1;
    var hasWcState = capIds.indexOf(CAP.WC_STATE) !== -1 && capIds.indexOf(CAP.WC_SET) === -1;
    var isOn       = hasOnOff && caps[CAP.ONOFF] && caps[CAP.ONOFF].value === true;
    var alarmCapU  = hasAlarm ? getAlarmCapability(d) : null;
    var isArmed    = alarmCapU ? alarmIsArmed(alarmCapU.value) : false;
    var wcStateVal = hasWcState && caps[CAP.WC_STATE] ? caps[CAP.WC_STATE].value : null;
    var isLockU    = d.class === 'lock';
    var isLockedU  = isLockU && caps[CAP.LOCKED] && caps[CAP.LOCKED].value === true;

    if (isOn || isArmed || wcStateVal === 'up' || isLockedU) card.classList.add('on');
    else card.classList.remove('on');

    if (caps[CAP.INPUT_EXT_1] && caps[CAP.INPUT_EXT_1].value === true) card.classList.add('open');
    else card.classList.remove('open');

    var toggle = card.querySelector('.device-toggle:not([data-alarm])');
    if (toggle) {
      if (isOn) toggle.classList.add('on');
      else toggle.classList.remove('on');
    }

    var alarmToggle = card.querySelector('.device-toggle[data-alarm]');
    if (alarmToggle) {
      if (isArmed) alarmToggle.classList.add('on');
      else alarmToggle.classList.remove('on');
    }

    var statusEl = document.getElementById('status-' + deviceId);
    if (statusEl) statusEl.textContent = buildStatusText(d);

    var prim = card.querySelector('.device-value.primary');
    if (prim && caps[CAP.MEASURE_TEMP]) {
      var val = caps[CAP.MEASURE_TEMP].value;
      prim.innerHTML = (val !== null && val !== undefined ? val.toFixed(1) : '--') +
        '<span class="value-unit"> °C</span>';
    }

    // Fallback-Werte (Custom Capabilities) live aktualisieren
    card.querySelectorAll('[data-capid]').forEach(function (el) {
      var cid  = el.getAttribute('data-capid');
      var fcap = caps[cid];
      if (!fcap || typeof fcap.value !== 'number') return;
      var fval  = fcap.value;
      var funit = fcap.units || '';
      if (cid === 'current_quarter_price') {
        el.textContent = parseFloat(fval.toFixed(4)) + (funit ? ' ' + funit : '');
        el.classList.remove('price-green', 'price-yellow', 'price-red');
        var cls = _energyPriceColorClass(d);
        if (cls) el.classList.add(cls);
      } else {
        el.textContent = (Math.abs(fval) < 10 ? parseFloat(fval.toFixed(2)) : Math.round(fval)) +
          (funit ? ' ' + funit : '');
      }
    });

    var sliders = card.querySelectorAll('.dim-slider');
    sliders.forEach(function (slider) {
      if (caps[CAP.DIM] && !caps[CAP.WC_SET]) {
        var pct = Math.round((caps[CAP.DIM].value || 0) * 100);
        slider.value = pct;
        slider.style.setProperty('--val', pct + '%');
      }
    });

    if (caps[CAP.WC_SET]) {
      var wcSlider = card.querySelector('.dim-slider');
      if (wcSlider) {
        var pct = Math.round((caps[CAP.WC_SET].value || 0) * 100);
        wcSlider.value = pct;
        wcSlider.style.setProperty('--val', pct + '%');
      }
      var wcLabel = document.getElementById('wc-label-' + deviceId);
      if (wcLabel) {
        wcLabel.textContent = '🪟 ' + Math.round((caps[CAP.WC_SET].value || 0) * 100) + ' %';
      }
    }

    // Speaker-Modal live aktualisieren wenn offen
    if (_speakerModalId === deviceId) _updateSpeakerModal();
    // Thermostat-Modal live aktualisieren wenn offen
    if (_thermostatModalId === deviceId) _updateThermostatModal();
    // Lock-Modal live aktualisieren wenn offen
    if (_alarmModalId === deviceId) _updateAlarmModal();
    if (_lockModalId === deviceId) _updateLockModal();
    if (_priceModalId === deviceId) _updatePriceModal();

    // Alarme (dot-Index muss mit buildValueElements übereinstimmen)
    var dots = card.querySelectorAll('.alarm-dot');
    var i = 0;
    if (caps[CAP.ALARM_MOTION]) {
      if (dots[i]) {
        if (caps[CAP.ALARM_MOTION].value) dots[i].classList.add('active');
        else dots[i].classList.remove('active');
      }
      i++;
    }
    if (caps[CAP.ALARM_CONTACT]) {
      if (dots[i]) {
        if (caps[CAP.ALARM_CONTACT].value) dots[i].classList.add('active');
        else dots[i].classList.remove('active');
        var sib2 = dots[i] ? dots[i].nextSibling : null;
        if (sib2) sib2.textContent = caps[CAP.ALARM_CONTACT].value ? ' ' + T.open : ' ' + T.closed;
      }
      i++;
    }
    if (caps[CAP.INPUT_EXT_1]) {
      if (dots[i]) {
        if (caps[CAP.INPUT_EXT_1].value) dots[i].classList.add('active');
        else dots[i].classList.remove('active');
        var sib3 = dots[i] ? dots[i].nextSibling : null;
        if (sib3) sib3.textContent = caps[CAP.INPUT_EXT_1].value ? ' ' + T.open : ' ' + T.closed;
      }
    }
  }

  // ── #12 Server-Sent Events mit Exponential Backoff ──
  function connectSSE() {
    if (eventSource) {
      try { eventSource.close(); } catch (_) {}
    }

    if (typeof EventSource === 'undefined') {
      startPolling();
      return;
    }

    eventSource = new EventSource('/events');

    eventSource.onmessage = function (e) {
      _sseActive  = true;
      _sseBackoff = 1000; // Backoff zurücksetzen bei erfolgreicher Nachricht
      try {
        var data = JSON.parse(e.data);
        // Fast path: single capability value changed (on/off, dim, temp …)
        if (data.type === 'device.capability.update') {
          var d = devices[data.deviceId];
          if (d) {
            if (!d.capabilitiesObj) d.capabilitiesObj = {};
            // Batched format: { updates: { capId: value, … } }
            if (data.updates) {
              var keys = Object.keys(data.updates);
              for (var ki = 0; ki < keys.length; ki++) {
                var capId = keys[ki];
                if (!d.capabilitiesObj[capId]) d.capabilitiesObj[capId] = {};
                d.capabilitiesObj[capId].value = data.updates[capId];
              }
            }
            _scheduleCardUpdate(data.deviceId);
          }
        }
        // Flow action: show camera on dashboard
        if (data.type === 'show_camera' && data.deviceId) {
          if (!data.targetIp || data.targetIp === _myIp) {
            openCameraModal(data.deviceId, data.deviceName || '', data.duration || 0);
          }
        }
        // Flow action: show message on dashboard
        if (data.type === 'show_message' && data.message) {
          if (!data.targetIp || data.targetIp === _myIp) {
            openMessageModal(data.message, data.duration || 0);
          }
        }
        // Einstellung geändert die ein vollständiges Neuladen erfordert (z.B. Sprache)
        if (data.type === 'settings.reload') {
          loadData();
        }
        // Flow-/Mood-Liste in Homey geändert — Cache verwerfen und neu zeichnen
        if (data.type === 'lists.changed') {
          _invalidateFlowMoodLists();
          render();
        }

        // Full update: availability change or metadata update
        if (data.type === 'device.update' && data.device) {
          var id = data.device.id;
          if (devices[id]) {
            if (data.device.capabilitiesObj) {
              devices[id].capabilitiesObj = data.device.capabilitiesObj;
            }
            devices[id].available = data.device.available;
            _scheduleCardUpdate(id);
          }
        }
      } catch (_) {}
    };

    eventSource.onerror = function () {
      _sseActive = false;
      eventSource.close();
      eventSource = null;
      // Exponential Backoff: 1 s → 2 s → 4 s → … max 30 s
      setTimeout(function () {
        _sseBackoff = Math.min(_sseBackoff * 2, 30000);
        connectSSE();
      }, _sseBackoff);
    };
  }

  // ── #2 Adaptives Polling (30 s mit SSE, 10 s ohne) ──
  function startPolling() {
    if (pollTimer) return;
    // If SSE is available, delay the first fallback poll — SSE handles real-time updates.
    _schedulePoll(_sseActive ? 120000 : 10000);
  }

  function _schedulePoll(delay) {
    pollTimer = setTimeout(function () {
      pollTimer = null;
      xhr('GET', '/api/devices', null, function (err, devicesData) {
        if (!err && devicesData) {
          devicesData.forEach(function (d) {
            if (devices[d.id]) {
              devices[d.id].capabilitiesObj = d.capabilitiesObj;
              devices[d.id].available = d.available;
              _scheduleCardUpdate(d.id); // Batch: alle Poll-Updates in einem RAF-Frame
            }
          });
        }
        // SSE aktiv: makeCapabilityInstance hält alle Werte live → nur seltener Safety-Poll.
        // SSE inaktiv: häufiger pollen da kein Echtzeit-Push.
        _schedulePoll(_sseActive ? 120000 : 10000);
      });
    }, delay);
  }

  // ── UI-Hilfsfunktionen ──────────────────────────────
  // Der Spinner erscheint nur, solange noch nichts angezeigt wird. Beim
  // periodischen Auffrischen (alle 15 min) bleibt der bisherige Inhalt stehen
  // und wird erst beim Eintreffen der neuen Daten ersetzt — sonst blitzt an
  // einem fest montierten Display viermal pro Stunde der Ladezustand auf.
  function showLoading() {
    if (_hasRendered) return;
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('error-msg').style.display = 'none';
    document.getElementById('zones-container').style.display = 'none';
  }

  // Ein fehlgeschlagener Hintergrund-Refresh darf ein bereits gezeichnetes
  // Dashboard nicht leeren — der Retry laeuft ohnehin nach 5 s weiter.
  function showError() {
    if (_hasRendered) return;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-msg').style.display = 'flex';
    document.getElementById('zones-container').style.display = 'none';
  }

  function createElement(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  // ── #11 XHR-Wrapper mit Timeout ─────────────────────
  function xhr(method, url, body, callback, timeoutMs) {
    var req = new XMLHttpRequest();
    req.open(method, url, true);
    req.timeout = timeoutMs || 10000; // Standard 10 s, überschreibbar
    if (body) req.setRequestHeader('Content-Type', 'application/json');
    req.onreadystatechange = function () {
      if (req.readyState !== 4) return;
      var data = null;
      try { data = JSON.parse(req.responseText); } catch (_) {}
      if (req.status >= 200 && req.status < 300) {
        callback(null, data);
      } else {
        callback(new Error('HTTP ' + req.status), data);
      }
    };
    req.onerror   = function () { callback(new Error(T.networkError)); };
    req.ontimeout = function () { callback(new Error(T.timeout)); };
    req.send(body || null);
  }

  // ── Refresh ─────────────────────────────────────────
  setInterval(loadData, 15 * 60 * 1000);

  document.addEventListener('DOMContentLoaded', function () {
    var headerLeft = document.querySelector('.header-left');
    if (headerLeft) {
      headerLeft.style.cursor = 'pointer';
      headerLeft.addEventListener('click', function () {
        loadData();
        flashRefresh();
      });
    }
  });

  function flashRefresh() {
    var logo = document.querySelector('.logo');
    if (!logo) return;
    logo.style.transition = 'transform 0.4s ease';
    logo.style.transform = 'rotate(360deg)';
    setTimeout(function () {
      logo.style.transition = '';
      logo.style.transform = '';
    }, 400);
  }

  // Die Kopfzeile ist fixiert; Inhalt, Raum-Chips und Modals richten sich
  // über --header-h nach ihrer Höhe. Bei vielen Schnellzugriffen bricht sie
  // auf schmalen Displays um und wird höher — dann muss die Variable folgen,
  // sonst verdeckt sie den Anfang der Geräteliste.
  function _syncHeaderHeight() {
    var h = document.querySelector('.header');
    if (!h) return;
    var px = Math.round(h.getBoundingClientRect().height);
    if (px > 0) document.documentElement.style.setProperty('--header-h', px + 'px');
  }

  function _watchHeaderHeight() {
    _syncHeaderHeight();
    if (typeof ResizeObserver !== 'undefined') {
      var h = document.querySelector('.header');
      if (h) new ResizeObserver(_syncHeaderHeight).observe(h);
    } else {
      window.addEventListener('resize', _syncHeaderHeight);
    }
  }

  // Übersetzt alle statischen Texte in index.html (data-i18n="key").
  function applyI18n() {
    document.documentElement.lang = lang;
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-i18n');
      if (T[key] !== undefined) els[i].textContent = T[key];
    }
    // Attribut-Übersetzungen: data-i18n-attr="title,aria-label" nutzt denselben
    // Key aus data-i18n-attr-key. Tooltips und Screenreader-Labels sonst englisch.
    var attrEls = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrEls.length; j++) {
      var el    = attrEls[j];
      var aKey  = el.getAttribute('data-i18n-attr-key');
      var attrs = (el.getAttribute('data-i18n-attr') || '').split(',');
      if (T[aKey] === undefined) continue;
      for (var k = 0; k < attrs.length; k++) {
        var a = attrs[k].replace(/^\s+|\s+$/g, '');
        if (a) el.setAttribute(a, T[aKey]);
      }
    }
  }

  // ── Start ───────────────────────────────────────────
  function _boot() { applyI18n(); _watchHeaderHeight(); loadData(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

  window.loadData = loadData;

  // ── PIN-Modal ────────────────────────────────────────
  function requirePin(callback) {
    if (!_alarmPin) { callback(); return; }
    _pinEntry = '';
    _pinCallback = callback;
    updatePinDots();
    document.getElementById('pin-error').textContent = '';
    document.getElementById('pin-modal').style.display = 'flex';
  }

  function pinKey(digit) {
    if (_pinEntry.length >= 4) return;
    _pinEntry += digit;
    updatePinDots();
    // #5 Haptisches Feedback (Android WebView)
    if (navigator.vibrate) navigator.vibrate(25);
    if (_pinEntry.length === 4) {
      setTimeout(checkPin, 80);
    }
  }

  function pinBackspace() {
    _pinEntry = _pinEntry.slice(0, -1);
    updatePinDots();
  }

  function pinCancel() {
    document.getElementById('pin-modal').style.display = 'none';
    _pinEntry = '';
    _pinCallback = null;
  }

  function checkPin() {
    if (_pinEntry === _alarmPin) {
      document.getElementById('pin-modal').style.display = 'none';
      var cb = _pinCallback;
      _pinEntry = '';
      _pinCallback = null;
      if (cb) cb();
    } else {
      // #5 Haptisches Feedback bei falschem PIN (doppelter Buzz)
      if (navigator.vibrate) navigator.vibrate([60, 80, 60]);
      var inner = document.querySelector('.pin-modal-inner');
      inner.classList.remove('shake');
      void inner.offsetWidth;
      inner.classList.add('shake');
      document.getElementById('pin-error').textContent = T.wrongPin;
      _pinEntry = '';
      updatePinDots();
    }
  }

  function updatePinDots() {
    var dots = document.querySelectorAll('.pin-dots span');
    dots.forEach(function (dot, i) {
      if (i < _pinEntry.length) dot.classList.add('filled');
      else dot.classList.remove('filled');
    });
  }

  window.pinKey       = pinKey;
  window.pinBackspace = pinBackspace;
  window.pinCancel    = pinCancel;

  // ── #13 Kamera-Modal mit Lade-Timeout ───────────────
  var _cameraRefreshTimer = null;
  var _cameraAutoCloseTimer = null;  // Flow-Argument "duration" (Sekunden)
  var _cameraLoadTimer    = null;

  // Calculate the constrained display size for a camera image,
  // matching the CSS rules: max-width:92vw, max-height:calc(92vh - 45px header).
  var _CAM_HEADER_H = 45;
  function _camDisplaySize(natW, natH) {
    var maxW  = Math.round(window.innerWidth  * 0.92);
    var maxH  = Math.round(window.innerHeight * 0.92) - _CAM_HEADER_H;
    var scale = Math.min(1, maxW / natW, maxH / natH);
    return { w: Math.round(natW * scale), h: Math.round(natH * scale) };
  }

  function openCameraModal(deviceId, deviceName, autoCloseSecs) {
    var modal = document.getElementById('camera-modal');
    var inner = document.getElementById('camera-modal-inner');
    var title = document.getElementById('camera-modal-title');
    var img     = document.getElementById('camera-modal-img');
    var err     = document.getElementById('camera-modal-error');
    var spinner = document.getElementById('camera-modal-spinner');

    title.textContent = deviceName;
    err.style.display = 'none';
    img.style.display = 'block';
    spinner.style.display = 'none';

    // Pre-size the modal-inner (width + height) to the stored display size before
    // showing. Both dimensions must be locked to prevent CLS — the image load
    // changes both width and height of the container.
    // Skip on small displays (≤499×499 px) — CSS fullscreen media query takes over.
    var _isSmallDisplay = window.innerWidth <= 499 && window.innerHeight <= 499;
    if (!_isSmallDisplay) {
      try {
        var stored = JSON.parse(localStorage.getItem('cam_size_' + deviceId));
        if (stored && stored.w && stored.h) {
          var preSize = _camDisplaySize(stored.w, stored.h);
          inner.style.width  = preSize.w + 'px';
          inner.style.height = (preSize.h + _CAM_HEADER_H) + 'px';
          img.setAttribute('width',  stored.w);
          img.setAttribute('height', stored.h);
        } else {
          inner.style.width  = '';
          inner.style.height = '';
        }
      } catch (_) { inner.style.width = ''; inner.style.height = ''; }
    } else {
      inner.style.width  = '';
      inner.style.height = '';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    function refresh() {
      // Spinner einblenden
      spinner.style.display = 'flex';
      // #13 Timeout: wenn Bild nach 8 s nicht geladen → Fehlermeldung
      if (_cameraLoadTimer) clearTimeout(_cameraLoadTimer);
      _cameraLoadTimer = setTimeout(function () {
        spinner.style.display = 'none';
        img.style.display = 'none';
        err.style.display = 'flex';
      }, 8000);
      img.src = '/api/camera/' + deviceId + '?t=' + Date.now();
    }

    img.onload = function () {
      if (_cameraLoadTimer) { clearTimeout(_cameraLoadTimer); _cameraLoadTimer = null; }
      // Save natural dimensions and lock inner to exact display size (w + h)
      if (img.naturalWidth && img.naturalHeight) {
        try {
          localStorage.setItem('cam_size_' + deviceId,
            JSON.stringify({ w: img.naturalWidth, h: img.naturalHeight }));
        } catch (_) {}
        img.setAttribute('width',  img.naturalWidth);
        img.setAttribute('height', img.naturalHeight);
        if (!(window.innerWidth <= 499 && window.innerHeight <= 499)) {
          var sz = _camDisplaySize(img.naturalWidth, img.naturalHeight);
          inner.style.width  = sz.w + 'px';
          inner.style.height = (sz.h + _CAM_HEADER_H) + 'px';
        }
      }
      spinner.style.display = 'none';
      img.style.display = 'block';
      err.style.display = 'none';
    };

    img.onerror = function () {
      if (_cameraLoadTimer) { clearTimeout(_cameraLoadTimer); _cameraLoadTimer = null; }
      spinner.style.display = 'none';
      img.style.display = 'none';
      err.style.display = 'flex';
    };

    img.onclick = function () { refresh(); };

    refresh();
    clearInterval(_cameraRefreshTimer);
    _cameraRefreshTimer = setInterval(refresh, 10000);

    // Automatisch schliessen, wenn der Flow eine Dauer mitgibt.
    // 0 oder nichts = offen lassen (Verhalten vor der Erweiterung).
    if (_cameraAutoCloseTimer) { clearTimeout(_cameraAutoCloseTimer); _cameraAutoCloseTimer = null; }
    var secs = parseInt(autoCloseSecs, 10);
    if (secs > 0) {
      _cameraAutoCloseTimer = setTimeout(function () {
        _cameraAutoCloseTimer = null;
        closeCameraModal();
      }, secs * 1000);
    }
  }

  function closeCameraModal() {
    clearInterval(_cameraRefreshTimer);
    if (_cameraLoadTimer) { clearTimeout(_cameraLoadTimer); _cameraLoadTimer = null; }
    if (_cameraAutoCloseTimer) { clearTimeout(_cameraAutoCloseTimer); _cameraAutoCloseTimer = null; }
    _cameraRefreshTimer = null;
    var modal = document.getElementById('camera-modal');
    modal.style.display = 'none';
    var img   = document.getElementById('camera-modal-img');
    var inner = document.getElementById('camera-modal-inner');
    img.src = '';
    img.removeAttribute('width');
    img.removeAttribute('height');
    inner.style.width  = '';
    inner.style.height = '';
    document.body.style.overflow = '';
  }

  window.openCameraModal  = openCameraModal;
  window.closeCameraModal = closeCameraModal;

  // ── Nachricht-Modal ────────────────────────────────
  var _msgAutoCloseTimer     = null;
  var _msgCountdownInterval  = null;

  function openMessageModal(text, durationMin) {
    var modal       = document.getElementById('message-modal');
    var textEl      = document.getElementById('message-modal-text');
    var countdownEl = document.getElementById('message-modal-countdown');

    if (_msgAutoCloseTimer)    { clearTimeout(_msgAutoCloseTimer);       _msgAutoCloseTimer    = null; }
    if (_msgCountdownInterval) { clearInterval(_msgCountdownInterval);   _msgCountdownInterval = null; }

    textEl.textContent = text;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (durationMin > 0) {
      var endMs = Date.now() + durationMin * 60 * 1000;
      countdownEl.style.display = 'block';
      function tick() {
        var rem = Math.max(0, Math.round((endMs - Date.now()) / 1000));
        var m = Math.floor(rem / 60);
        var s = rem % 60;
        countdownEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
        if (rem <= 0) closeMessageModal();
      }
      tick();
      _msgCountdownInterval = setInterval(tick, 1000);
      _msgAutoCloseTimer = setTimeout(closeMessageModal, durationMin * 60 * 1000);
    } else {
      countdownEl.style.display = 'none';
    }
  }

  function closeMessageModal() {
    if (_msgAutoCloseTimer)    { clearTimeout(_msgAutoCloseTimer);     _msgAutoCloseTimer    = null; }
    if (_msgCountdownInterval) { clearInterval(_msgCountdownInterval); _msgCountdownInterval = null; }
    document.getElementById('message-modal').style.display = 'none';
    document.body.style.overflow = '';
  }

  window.closeMessageModal = closeMessageModal;

  // ── Speaker-Modal ─────────────────────────────────
  var _speakerModalId   = null;
  var _speakerPollTimer = null;
  var _speakerPollCount = 0;
  var _speakerPollTrack = '';
  var _speakerWasPlaying = false;   // play/pause Zustandsverfolgung

  // ── Cover Fullscreen ───────────────────────────────
  var _coverFullscreen      = true;  // aus Settings geladen (Default: aktiv)
  var _coverFullscreenDelay = 20;    // Sekunden, aus Settings
  var _coverFsTimer         = null;
  var _coverFsActive        = false;

  function _startCoverFsTimer() {
    _clearCoverFsTimer();
    if (!_coverFullscreen || !_speakerModalId) return;
    var coverImg = document.getElementById('speaker-cover');
    if (!coverImg || !coverImg.classList.contains('loaded')) return;
    _coverFsTimer = setTimeout(_showCoverFullscreen, _coverFullscreenDelay * 1000);
  }

  function _clearCoverFsTimer() {
    if (_coverFsTimer) { clearTimeout(_coverFsTimer); _coverFsTimer = null; }
  }

  function _showCoverFullscreen() {
    if (!_speakerModalId) return;
    var coverImg = document.getElementById('speaker-cover');
    if (!coverImg || !coverImg.classList.contains('loaded') || !coverImg.src) return;

    var overlay  = document.getElementById('cover-fullscreen');
    var bg       = document.getElementById('cover-fullscreen-bg');
    var trackEl  = document.getElementById('cover-fs-track');
    var artistEl = document.getElementById('cover-fs-artist');

    bg.style.backgroundImage = 'url("' + coverImg.src + '")';
    if (trackEl)  trackEl.textContent  = document.getElementById('speaker-track-name').textContent || '';
    if (artistEl) artistEl.textContent = document.getElementById('speaker-track-artist').textContent || '';

    overlay.style.display = 'flex';
    // Double rAF so transition fires after display:flex is painted
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.classList.add('visible'); });
    });
    _coverFsActive = true;
  }

  function _dismissCoverFullscreen() {
    if (!_coverFsActive) return;
    var overlay = document.getElementById('cover-fullscreen');
    overlay.classList.remove('visible');
    _coverFsActive = false;
    setTimeout(function () { if (!_coverFsActive) overlay.style.display = 'none'; }, 620);
  }

  // Called from onclick on the overlay
  window.dismissCoverFullscreen = function () {
    _dismissCoverFullscreen();
    _clearCoverFsTimer();
    // Restart the idle timer so it re-enters fullscreen after another delay
    _startCoverFsTimer();
  };

  // SVG-Icons für die Transport-Controls
  var _SI = {
    shuffle:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
    prev:     '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4"/><rect x="5" y="4" width="3" height="16" rx="1.5"/></svg>',
    play:     '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>',
    pause:    '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1.5"/><rect x="15" y="3" width="4" height="18" rx="1.5"/></svg>',
    next:     '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20"/><rect x="16" y="4" width="3" height="16" rx="1.5"/></svg>',
    repeat:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    repeat1:  '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></g><text x="12" y="14.5" text-anchor="middle" font-size="7" fill="currentColor" font-weight="700" font-family="sans-serif">1</text></svg>',
    volHi:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    volMute:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
  };

  function openSpeakerModal(deviceId) {
    _speakerModalId = deviceId;
    var d = devices[deviceId];
    if (!d) return;
    document.getElementById('speaker-modal-name').textContent = d.name;
    // Event-Listener für beide Slider (vertikal + horizontal)
    var _volDebounce = null;
    function _volSend(value) {
      if (_volDebounce) { clearTimeout(_volDebounce); _volDebounce = null; }
      setCapability(_speakerModalId, CAP.VOLUME_SET, value / 100);
    }
    function _volInput() {
      var val = parseInt(this.value, 10);
      // Visuelles Feedback sofort auf beiden Slidern
      var other = this.id === 'speaker-vol-slider'
                  ? document.getElementById('speaker-vol-slider-row')
                  : document.getElementById('speaker-vol-slider');
      if (other) { other.value = val; other.style.setProperty('--val', val + '%'); }
      this.style.setProperty('--val', val + '%');
      // API-Aufruf entprellt (150 ms) — verhindert Flooding
      if (_volDebounce) clearTimeout(_volDebounce);
      _volDebounce = setTimeout(function () { _volSend(val); }, 150);
    }
    function _volChange() {
      // Beim Loslassen: sofort senden, Debounce abbrechen
      _volSend(parseInt(this.value, 10));
    }
    var volSlider = document.getElementById('speaker-vol-slider');
    volSlider.oninput  = _volInput;
    volSlider.onchange = _volChange;
    var volSliderRow = document.getElementById('speaker-vol-slider-row');
    volSliderRow.oninput  = _volInput;
    volSliderRow.onchange = _volChange;
    _speakerWasPlaying = false;
    _updateSpeakerModal();
    document.getElementById('speaker-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Measure marquee AFTER modal is visible (double rAF ensures layout is done)
    requestAnimationFrame(function () { requestAnimationFrame(_recheckMarquee); });

    // Tap auf Cover → sofort Vollbild (wie automatischer Timer)
    var coverWrap = document.getElementById('speaker-cover-wrap');
    if (coverWrap) {
      coverWrap.onclick = function () {
        _clearCoverFsTimer();
        _showCoverFullscreen();
      };
    }
  }

  function closeSpeakerModal() {
    _clearCoverFsTimer();
    _dismissCoverFullscreen();
    document.getElementById('speaker-modal').style.display = 'none';
    document.body.style.overflow = '';
    var coverImg = document.getElementById('speaker-cover');
    coverImg.src = '';
    coverImg.removeAttribute('data-track');
    coverImg.classList.remove('loaded');
    _stopSpeakerPoll();
    _speakerModalId    = null;
    _speakerWasPlaying = false;
  }

  // Nach Next/Prev: pollen bis Track wechselt (max. 15 Versuche).
  // Sofortiger erster Poll + danach alle 1.5 s als Fallback falls SSE-Event fehlt.
  function _startSpeakerPoll() {
    _stopSpeakerPoll();
    _speakerPollCount = 0;
    var d = devices[_speakerModalId];
    _speakerPollTrack = (d && d.capabilitiesObj && d.capabilitiesObj[CAP.SPEAKER_TRACK]
                         && d.capabilitiesObj[CAP.SPEAKER_TRACK].value) || '';

    function _doPoll() {
      if (!_speakerModalId) { _stopSpeakerPoll(); return; }
      if (++_speakerPollCount > 15) { _stopSpeakerPoll(); return; }
      xhr('GET', '/api/device/' + _speakerModalId + '/caps', null, function (err, raw) {
        if (err || !raw) return;
        try {
          var data = JSON.parse(raw);
          var caps = data.capabilitiesObj || {};
          var newTrack = (caps[CAP.SPEAKER_TRACK] && caps[CAP.SPEAKER_TRACK].value) || '';
          if (newTrack !== _speakerPollTrack) {
            _stopSpeakerPoll();
            // Gerätecache aktualisieren und Modal neu zeichnen
            if (devices[_speakerModalId]) {
              var existing = devices[_speakerModalId].capabilitiesObj || {};
              Object.keys(caps).forEach(function (k) { existing[k] = caps[k]; });
              devices[_speakerModalId].capabilitiesObj = existing;
            }
            _updateSpeakerModal();
          }
        } catch (_) {}
      });
    }

    _doPoll(); // Sofort, ohne Wartezeit
    _speakerPollTimer = setInterval(_doPoll, 1500);
  }

  function _stopSpeakerPoll() {
    if (_speakerPollTimer) { clearInterval(_speakerPollTimer); _speakerPollTimer = null; }
  }

  var _MARQUEE_IDS = ['speaker-track-name', 'speaker-track-artist', 'speaker-track-album'];

  // Set text on a container element; wraps text in a .marquee-inner span.
  // Does NOT measure — call _recheckMarquee() after the modal is visible.
  function _setMarqueeText(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    var inner = el.querySelector('.marquee-inner');
    if (!inner) {
      el.textContent = '';
      inner = document.createElement('span');
      inner.className = 'marquee-inner';
      el.appendChild(inner);
    }
    inner.style.animation = '';
    inner.textContent = text;
  }

  // Lazily create a <style> element for injected marquee @keyframes rules.
  var _marqueeSheet = null;
  function _getMarqueeSheet() {
    if (!_marqueeSheet) {
      var s = document.createElement('style');
      s.id = 'marquee-kf';
      document.head.appendChild(s);
      _marqueeSheet = s.sheet;
    }
    return _marqueeSheet;
  }

  // Inject a concrete @keyframes rule (no CSS variables) and apply it inline.
  function _applyMarqueeAnim(inner, id, overflow) {
    var sheet = _getMarqueeSheet();
    var name  = 'mq_' + id.replace(/[^a-z0-9]/gi, '_');
    // Remove old rule for this element
    for (var i = sheet.cssRules.length - 1; i >= 0; i--) {
      if (sheet.cssRules[i].name === name) { sheet.deleteRule(i); break; }
    }
    var shift = '-' + overflow + 'px';
    var dur   = Math.max(6, overflow / 40 + 3).toFixed(1);
    sheet.insertRule(
      '@keyframes ' + name + '{' +
      '0%,12%{transform:translateX(0)}' +
      '72%,84%{transform:translateX(' + shift + ')}' +
      '93%,100%{transform:translateX(0)}' +
      '}',
      sheet.cssRules.length
    );
    inner.style.animation = name + ' ' + dur + 's ease-in-out infinite';
  }

  // Measure actual rendered overflow and enable scrolling where needed.
  // Must be called while the modal is already visible (offsetWidth != 0).
  function _recheckMarquee() {
    _MARQUEE_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var inner = el.querySelector('.marquee-inner');
      if (!inner) return;
      // Reset
      inner.style.animation = '';
      el.classList.remove('has-marquee');
      var overflow = inner.offsetWidth - el.offsetWidth;
      if (overflow > 4) {
        el.classList.add('has-marquee');   // switches container to text-align:left
        _applyMarqueeAnim(inner, id, overflow);
      }
    });
  }

  function _updateSpeakerModal() {
    if (!_speakerModalId) return;
    var d = devices[_speakerModalId];
    if (!d) return;
    var caps = d.capabilitiesObj || {};

    // Track-Info
    var track  = (caps[CAP.SPEAKER_TRACK]  && caps[CAP.SPEAKER_TRACK].value)  || '';
    var artist = (caps[CAP.SPEAKER_ARTIST] && caps[CAP.SPEAKER_ARTIST].value) || '';
    var album  = (caps[CAP.SPEAKER_ALBUM]  && caps[CAP.SPEAKER_ALBUM].value)  || '';
    _setMarqueeText('speaker-track-name',   track  || '—');
    _setMarqueeText('speaker-track-artist', artist);
    _setMarqueeText('speaker-track-album',  album);
    // If modal is already visible (SSE live update), recheck immediately
    if (document.getElementById('speaker-modal').style.display !== 'none') {
      requestAnimationFrame(_recheckMarquee);
    }

    // Cover: nur neu laden wenn sich der Track geändert hat
    var coverImg = document.getElementById('speaker-cover');
    var prevTrack = coverImg.getAttribute('data-track') || '';
    if (track !== prevTrack) {
      coverImg.setAttribute('data-track', track);
      coverImg.classList.remove('loaded');
      _clearCoverFsTimer();
      _dismissCoverFullscreen();
      var coverSrc = '/api/camera/' + _speakerModalId + '?t=' + Date.now();
      coverImg.onload  = function () {
        this.classList.add('loaded');
        // Cover geladen → Timer starten falls gerade gespielt wird
        if (_speakerWasPlaying) _startCoverFsTimer();
      };
      coverImg.onerror = function () { this.classList.remove('loaded'); };
      coverImg.src = coverSrc;
    }

    // Statische Icons (prev/next/shuffle/repeat-Outline setzen)
    document.getElementById('speaker-prev-btn').innerHTML    = _SI.prev;
    document.getElementById('speaker-next-btn').innerHTML    = _SI.next;
    document.getElementById('speaker-shuffle-btn').innerHTML = _SI.shuffle;

    // Play / Pause
    var playing = caps[CAP.SPEAKER_PLAYING] && caps[CAP.SPEAKER_PLAYING].value === true;
    var playBtn = document.getElementById('speaker-play-btn');
    playBtn.innerHTML = playing ? _SI.pause : _SI.play;

    // Shuffle
    var shuffle = caps[CAP.SPEAKER_SHUFFLE] && caps[CAP.SPEAKER_SHUFFLE].value === true;
    document.getElementById('speaker-shuffle-btn').classList.toggle('active', shuffle);

    // Repeat (none / playlist / track)
    var repeat = (caps[CAP.SPEAKER_REPEAT] && caps[CAP.SPEAKER_REPEAT].value) || 'none';
    var repeatActive = repeat && repeat !== 'none' && repeat !== false;
    var repeatBtn = document.getElementById('speaker-repeat-btn');
    repeatBtn.innerHTML = (repeat === 'track') ? _SI.repeat1 : _SI.repeat;
    repeatBtn.classList.toggle('active', !!repeatActive);

    // Lautstärke
    var vol = (caps[CAP.VOLUME_SET] && caps[CAP.VOLUME_SET].value != null)
              ? Math.round(caps[CAP.VOLUME_SET].value * 100) : 50;
    var muted = caps[CAP.VOLUME_MUTE] && caps[CAP.VOLUME_MUTE].value === true;
    // Beide Slider synchron halten (vertikal + horizontal)
    var slider = document.getElementById('speaker-vol-slider');
    slider.value = vol;
    var sliderRow = document.getElementById('speaker-vol-slider-row');
    sliderRow.value = vol;
    sliderRow.style.setProperty('--val', vol + '%');
    // Beide Mute-Buttons
    var volIcon = muted ? _SI.volMute : _SI.volHi;
    var muteBtn = document.getElementById('speaker-mute-btn');
    muteBtn.innerHTML = volIcon;
    muteBtn.classList.toggle('muted', muted);
    var muteBtnRow = document.getElementById('speaker-mute-btn-row');
    muteBtnRow.innerHTML = volIcon;
    muteBtnRow.classList.toggle('muted', muted);

    // ── Cover Fullscreen Timer: Play/Pause-Transitions ─────────────
    if (playing && !_speakerWasPlaying) {
      // Gerade gestartet → Timer beginnen (falls Cover schon geladen)
      _startCoverFsTimer();
    } else if (!playing && _speakerWasPlaying) {
      // Pausiert → Timer stoppen, Fullscreen schliessen
      _clearCoverFsTimer();
      _dismissCoverFullscreen();
    }
    _speakerWasPlaying = playing;
  }

  function speakerPlayPause() {
    if (!_speakerModalId) return;
    var playing = ((devices[_speakerModalId].capabilitiesObj || {})[CAP.SPEAKER_PLAYING] || {}).value === true;
    setCapability(_speakerModalId, CAP.SPEAKER_PLAYING, !playing);
  }
  function speakerPrev() {
    if (!_speakerModalId) return;
    setCapability(_speakerModalId, CAP.SPEAKER_PREV, true);
    _startSpeakerPoll();
  }
  function speakerNext() {
    if (!_speakerModalId) return;
    setCapability(_speakerModalId, CAP.SPEAKER_NEXT, true);
    _startSpeakerPoll();
  }
  function speakerToggleShuffle() {
    if (!_speakerModalId) return;
    var shuffle = ((devices[_speakerModalId].capabilitiesObj || {})[CAP.SPEAKER_SHUFFLE] || {}).value === true;
    setCapability(_speakerModalId, CAP.SPEAKER_SHUFFLE, !shuffle);
  }
  function speakerCycleRepeat() {
    if (!_speakerModalId) return;
    var repeat = ((devices[_speakerModalId].capabilitiesObj || {})[CAP.SPEAKER_REPEAT] || {}).value || 'none';
    var next = (!repeat || repeat === 'none') ? 'playlist'
             : repeat === 'playlist'          ? 'track'
             : 'none';
    setCapability(_speakerModalId, CAP.SPEAKER_REPEAT, next);
  }
  function speakerToggleMute() {
    if (!_speakerModalId) return;
    var muted = ((devices[_speakerModalId].capabilitiesObj || {})[CAP.VOLUME_MUTE] || {}).value === true;
    setCapability(_speakerModalId, CAP.VOLUME_MUTE, !muted);
  }

  // ── Alarm-Modal ───────────────────────────────────
  var _alarmModalId = null;

  function openAlarmModal(deviceId) {
    _alarmModalId = deviceId;
    var d = devices[deviceId];
    if (!d) return;
    document.getElementById('alarm-modal-name').textContent = d.name;
    document.getElementById('alarm-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    _updateAlarmModal();
  }

  function closeAlarmModal() {
    document.getElementById('alarm-modal').style.display = 'none';
    document.body.style.overflow = '';
    _alarmModalId = null;
  }

  function _updateAlarmModal() {
    if (!_alarmModalId) return;
    var d = devices[_alarmModalId];
    if (!d) return;
    var ac = getAlarmCapability(d);
    if (!ac) return;
    var cur = ac.value;

    var statusEl = document.getElementById('alarm-modal-status');
    var statusLabels = { armed: '🔐 Armed', partially_armed: '🔏 Partially Armed', disarmed: '🔓 Disarmed' };
    statusEl.textContent = statusLabels[cur] || cur;
    statusEl.className = 'lock-modal-status ' +
      (cur === 'armed' ? 'locked' : cur === 'partially_armed' ? 'partially-armed' : 'unlocked');

    var actionsEl = document.getElementById('alarm-modal-actions');
    actionsEl.innerHTML = '';
    var options = [
      { value: 'armed',           label: '🔐 Armed' },
      { value: 'partially_armed', label: '🔏 Partially Armed' },
      { value: 'disarmed',        label: '🔓 Disarmed' }
    ];
    options.forEach(function (opt) {
      var btn = createElement('button', 'lock-action-btn');
      btn.textContent = opt.label;
      if (opt.value === cur) btn.classList.add('active');
      (function (val) {
        btn.addEventListener('click', function () {
          var deviceId = _alarmModalId;
          var capId    = ac.capId;
          closeAlarmModal();
          requirePin(function () { setCapability(deviceId, capId, val); });
        });
      }(opt.value));
      actionsEl.appendChild(btn);
    });
  }

  window.openAlarmModal  = openAlarmModal;
  window.closeAlarmModal = closeAlarmModal;

  // ── Price-Modal ───────────────────────────────────
  var _priceModalId = null;

  function openPriceModal(deviceId) {
    _priceModalId = deviceId;
    var d = devices[deviceId];
    if (!d) return;
    document.getElementById('price-modal-name').textContent = d.name;
    document.getElementById('price-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    _updatePriceModal();
  }

  function closePriceModal() {
    document.getElementById('price-modal').style.display = 'none';
    document.body.style.overflow = '';
    _priceModalId = null;
  }

  function _extractPriceFromEntry(e) {
    var p = e.price !== undefined ? e.price : e.value !== undefined ? e.value :
            e.amount !== undefined ? e.amount : e.spotPrice !== undefined ? e.spotPrice :
            e.total !== undefined ? e.total : undefined;
    if (p === undefined) {
      for (var k in e) {
        if (typeof e[k] === 'number' && e[k] >= -1 && e[k] <= 10) { p = e[k]; break; }
      }
    }
    return typeof p === 'number' ? p : null;
  }

  function _buildPriceChart(d) {
    var caps    = d.capabilitiesObj || {};
    var jsonCap = caps['quarter_prices_json'];
    var curCap  = caps['current_quarter_price'];
    if (!jsonCap || typeof jsonCap.value !== 'string') return null;

    try {
      var data = JSON.parse(jsonCap.value);
      var src  = Array.isArray(data) ? data : (data.today || []).concat(data.tomorrow || []);

      var nowMs   = Date.now();
      var nowDate = new Date(nowMs);
      var clockHour = new Date(
        nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), nowDate.getHours()
      ).getTime();

      var hours = [];
      for (var h = 0; h < 8; h++) {
        var hStart = clockHour + h * 3600000;
        var hEnd   = hStart + 3600000;
        var hDate  = new Date(hStart);
        var label  = (hDate.getHours() < 10 ? '0' : '') + hDate.getHours() + ':00';
        var vals   = [];
        src.forEach(function (e) {
          var ts = e.timestamp || 0;
          if (ts >= hStart && ts < hEnd) {
            var p = _extractPriceFromEntry(e);
            if (p !== null) vals.push(p);
          }
        });
        var price = vals.length > 0 ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
        hours.push({ label: label, price: price, isCurrent: h === 0 });
      }

      var validPrices = [];
      hours.forEach(function (h) { if (h.price !== null) validPrices.push(h.price); });
      if (validPrices.length === 0) return null;

      var sorted = validPrices.slice().sort(function (a, b) { return a - b; });
      var min    = sorted[0];
      var max    = sorted[sorted.length - 1];
      var range  = max - min || 0.0001;
      var p33    = sorted[Math.floor(sorted.length / 3)];
      var p67    = sorted[Math.floor(sorted.length * 2 / 3)];

      function colorFor(price) {
        return price <= p33 ? 'price-green' : price <= p67 ? 'price-yellow' : 'price-red';
      }

      var chart = createElement('div', 'price-chart');
      hours.forEach(function (h) {
        var col = createElement('div', 'price-chart-col' + (h.isCurrent ? ' price-col-current' : ''));
        var barWrap = createElement('div', 'price-bar-wrap');

        if (h.price !== null) {
          var bar = createElement('div', 'price-bar');
          var heightPct = max > 0 ? Math.max((h.price / max) * 90, 5) : 50;
          bar.style.height = Math.round(heightPct) + '%';
          bar.classList.add(colorFor(h.price));
          barWrap.appendChild(bar);
        }
        col.appendChild(barWrap);

        var timeEl = createElement('div', 'price-time');
        timeEl.textContent = h.label;
        col.appendChild(timeEl);

        if (h.price !== null) {
          var valEl = createElement('div', 'price-val');
          valEl.textContent = parseFloat(h.price.toFixed(3));
          col.appendChild(valEl);
        }
        chart.appendChild(col);
      });

      return { chart: chart, unit: (curCap && curCap.units) || '' };
    } catch (e) { return null; }
  }

  function _updatePriceModal() {
    if (!_priceModalId) return;
    var d = devices[_priceModalId];
    if (!d) return;

    var caps   = d.capabilitiesObj || {};
    var curCap = caps['current_quarter_price'];
    var curVal = curCap && typeof curCap.value === 'number' ? curCap.value : null;
    var unit   = (curCap && curCap.units) || '';

    var curEl = document.getElementById('price-modal-current');
    if (curVal !== null) {
      curEl.textContent = parseFloat(curVal.toFixed(4)) + (unit ? ' ' + unit : '');
      curEl.className = 'price-modal-current ' + (_energyPriceColorClass(d) || '');
    } else {
      curEl.textContent = '—';
      curEl.className = 'price-modal-current';
    }

    var chartWrap = document.getElementById('price-modal-chart');
    chartWrap.innerHTML = '';
    var result = _buildPriceChart(d);
    if (result) {
      var lbl = createElement('div', 'price-chart-label');
      lbl.textContent = T.next8h + (result.unit ? ' (' + result.unit + ')' : '');
      chartWrap.appendChild(lbl);
      chartWrap.appendChild(result.chart);
    }
  }

  window.openPriceModal  = openPriceModal;
  window.closePriceModal = closePriceModal;

  // ── Search ────────────────────────────────────────
  var _searchQuery = '';

  function openSearch() {
    var header = document.querySelector('.header');
    header.classList.add('searching');
    var bar = document.getElementById('search-bar');
    bar.style.display = 'flex';
    var input = document.getElementById('search-input');
    input.value = _searchQuery;
    input.focus();
    input.select();
  }

  function _hideSearchBar() {
    var header = document.querySelector('.header');
    header.classList.remove('searching');
    document.getElementById('search-bar').style.display = 'none';
    var btn = document.getElementById('search-btn');
    if (btn) btn.classList.toggle('search-active', _searchQuery !== '');
  }

  function _confirmSearch() {
    _searchQuery = document.getElementById('search-input').value.trim();
    _hideSearchBar();
    _applySearchFilter(_searchQuery);
  }

  function closeSearch() {
    _searchQuery = '';
    _hideSearchBar();
    _applySearchFilter('');
  }

  function _applySearchFilter(query) {
    var q = query.toLowerCase().trim();
    var container = document.getElementById('zones-container');
    var cards = container.querySelectorAll('.device-card');
    cards.forEach(function (card) {
      var name = card.getAttribute('data-name') || '';
      card.style.display = (q === '' || name.indexOf(q) !== -1) ? '' : 'none';
    });
    var sections = container.querySelectorAll('.zone-section[data-zone]');
    sections.forEach(function (sec) {
      var zoneName = sec.getAttribute('data-zone') || '';
      var zoneMatch = q !== '' && zoneName.indexOf(q) !== -1;
      var visibleCards = sec.querySelectorAll('.device-card:not([style*="display: none"])');
      if (zoneMatch) {
        sec.querySelectorAll('.device-card').forEach(function (c) { c.style.display = ''; });
        sec.style.display = '';
      } else {
        sec.style.display = (q === '' || visibleCards.length > 0) ? '' : 'none';
      }
    });
  }

  document.getElementById('search-input').addEventListener('input', function () {
    _applySearchFilter(this.value);
  });
  document.getElementById('search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSearch();
    if (e.key === 'Enter') { e.preventDefault(); _confirmSearch(); }
  });

  window.openSearch  = openSearch;
  window.closeSearch = closeSearch;

  // ── Class Filter (Camera / Speaker) ───────────────
  var _activeClassFilter = null;

  function toggleClassFilter(type) {
    if (_activeClassFilter === type) {
      _activeClassFilter = null;
    } else {
      _activeClassFilter = type;
    }
    // Clear search when activating a class filter
    if (_activeClassFilter && _searchQuery) {
      _searchQuery = '';
      var btn = document.getElementById('search-btn');
      if (btn) btn.classList.remove('search-active');
    }
    _applyClassFilter();
    document.getElementById('camera-filter-btn').classList.toggle('filter-active', _activeClassFilter === 'camera');
    document.getElementById('speaker-filter-btn').classList.toggle('filter-active', _activeClassFilter === 'speaker');
    document.getElementById('thermostat-filter-btn').classList.toggle('filter-active', _activeClassFilter === 'thermostat');
    document.getElementById('light-filter-btn').classList.toggle('filter-active', _activeClassFilter === 'light');
    document.getElementById('blinds-filter-btn').classList.toggle('filter-active', _activeClassFilter === 'blinds');
  }

  function _applyClassFilter() {
    var container = document.getElementById('zones-container');
    var cards = container.querySelectorAll('.device-card');
    var filter = _activeClassFilter;
    var matchClasses = filter === 'camera' ? ['camera', 'doorbell'] :
                       filter === 'speaker' ? ['speaker', 'mediaplayer'] :
                       filter === 'thermostat' ? ['thermostat', 'heater'] :
                       filter === 'light' ? ['light'] :
                       filter === 'blinds' ? ['blinds', 'curtain', 'windowcoverings', 'shutterblinds', 'sunshade'] : null;
    cards.forEach(function (card) {
      var cls = card.getAttribute('data-class') || '';
      card.style.display = (!matchClasses || matchClasses.indexOf(cls) !== -1) ? '' : 'none';
    });
    var sections = container.querySelectorAll('.zone-section[data-zone]');
    sections.forEach(function (sec) {
      var visibleCards = sec.querySelectorAll('.device-card:not([style*="display: none"])');
      sec.style.display = (!matchClasses || visibleCards.length > 0) ? '' : 'none';
    });
  }

  window.toggleClassFilter = toggleClassFilter;

  // ── Room Filter (Chip-Leiste) ──────────────────────
  var _activeRoomFilter = null;
  var _roomChipsVisible = false;

  function toggleRoomChips() {
    if (_roomChipsVisible) {
      _hideRoomChips();
      _activeRoomFilter = null;
      _applyRoomFilter();
      document.getElementById('room-filter-btn').classList.remove('filter-active');
    } else {
      _showRoomChips();
    }
  }

  function _showRoomChips() {
    var bar = document.getElementById('room-chips');
    bar.innerHTML = '';
    var usedZones = {};
    Object.values(devices).forEach(function (d) {
      if (d.zone && zones[d.zone]) usedZones[d.zone] = zones[d.zone].name;
    });
    var sorted = Object.keys(usedZones).sort(function (a, b) {
      var ia = _zoneOrder.indexOf(a);
      var ib = _zoneOrder.indexOf(b);
      if (ia === -1 && ib === -1) return usedZones[a].localeCompare(usedZones[b]);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    sorted.forEach(function (zoneId) {
      var chip = createElement('button', 'room-chip');
      chip.textContent = usedZones[zoneId];
      chip.setAttribute('data-zone-id', zoneId);
      if (_activeRoomFilter === zoneId) chip.classList.add('active');
      chip.addEventListener('click', function () {
        if (_activeRoomFilter === zoneId) {
          _activeRoomFilter = null;
          document.getElementById('room-filter-btn').classList.remove('filter-active');
        } else {
          _activeRoomFilter = zoneId;
          document.getElementById('room-filter-btn').classList.add('filter-active');
          if (_activeClassFilter) {
            _activeClassFilter = null;
            document.querySelectorAll('.filter-hdr-btn').forEach(function (b) { b.classList.remove('filter-active'); });
            document.getElementById('room-filter-btn').classList.add('filter-active');
          }
          if (_searchQuery) {
            _searchQuery = '';
            var sb = document.getElementById('search-btn');
            if (sb) sb.classList.remove('search-active');
          }
        }
        bar.querySelectorAll('.room-chip').forEach(function (c) {
          c.classList.toggle('active', c.getAttribute('data-zone-id') === _activeRoomFilter);
        });
        _applyRoomFilter();
      });
      bar.appendChild(chip);
    });
    bar.style.display = 'flex';
    _roomChipsVisible = true;
    document.body.classList.add('room-chips-visible');
    requestAnimationFrame(function () {
      document.documentElement.style.setProperty('--room-chips-h', bar.offsetHeight + 'px');
    });
  }

  function _hideRoomChips() {
    document.getElementById('room-chips').style.display = 'none';
    _roomChipsVisible = false;
    document.body.classList.remove('room-chips-visible');
  }

  function _applyRoomFilter() {
    var container = document.getElementById('zones-container');
    var cards = container.querySelectorAll('.device-card');
    cards.forEach(function (card) {
      var zid = card.getAttribute('data-zone-id') || '';
      card.style.display = (!_activeRoomFilter || zid === _activeRoomFilter) ? '' : 'none';
    });
    var sections = container.querySelectorAll('.zone-section[data-zone]');
    sections.forEach(function (sec) {
      var visibleCards = sec.querySelectorAll('.device-card:not([style*="display: none"])');
      sec.style.display = (!_activeRoomFilter || visibleCards.length > 0) ? '' : 'none';
    });
  }

  window.toggleRoomChips = toggleRoomChips;

  // ── Lock-Modal ────────────────────────────────────
  var _lockModalId = null;

  // Gibt die beste Enum-Capability für Lock-Aktionen zurück
  // (lock_mode standard oder beliebige Nuki-eigene Enum-Cap)
  function _getLockActionCap(d) {
    var caps   = d.capabilitiesObj || {};
    var capIds = d.capabilities    || [];
    // 1. Standard lock_mode
    if (caps[CAP.LOCK_MODE] && Array.isArray(caps[CAP.LOCK_MODE].values) && caps[CAP.LOCK_MODE].values.length) {
      return CAP.LOCK_MODE;
    }
    // 2. Jede andere Enum-Capability (Nuki-eigene etc.)
    var skip = [CAP.LOCKED, 'measure_battery', 'alarm_battery', CAP.THERMOSTAT_MODE,
                CAP.HOMEALARM_STATE, CAP.HOMEALARM, CAP.WC_STATE, CAP.SPEAKER_REPEAT,
                'button_action', CAP.ONOFF, CAP.MEASURE_TEMP, CAP.MEASURE_HUMIDITY];
    for (var i = 0; i < capIds.length; i++) {
      var cid = capIds[i];
      if (skip.indexOf(cid) !== -1) continue;
      var cap = caps[cid];
      if (cap && Array.isArray(cap.values) && cap.values.length >= 2) return cid;
    }
    return null;
  }

  function openLockModal(deviceId) {
    _lockModalId = deviceId;
    var d = devices[deviceId];
    if (!d) return;
    document.getElementById('lock-modal-name').textContent = d.name;
    document.getElementById('lock-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    _updateLockModal();
  }

  function closeLockModal() {
    document.getElementById('lock-modal').style.display = 'none';
    document.body.style.overflow = '';
    _lockModalId = null;
  }

  function _updateLockModal() {
    if (!_lockModalId) return;
    var d = devices[_lockModalId];
    if (!d) return;
    var caps   = d.capabilitiesObj || {};
    var capIds = d.capabilities    || [];

    // Status anzeigen
    var isLocked  = caps[CAP.LOCKED] && caps[CAP.LOCKED].value === true;
    var statusEl  = document.getElementById('lock-modal-status');
    statusEl.textContent = isLocked ? '🔒 Locked' : '🔓 Unlocked';
    statusEl.className   = 'lock-modal-status ' + (isLocked ? 'locked' : 'unlocked');

    // Aktions-Buttons aufbauen
    var actionsEl = document.getElementById('lock-modal-actions');
    actionsEl.innerHTML = '';

    var lockIcons = {
      locked:                '🔒',
      unlocked:              '🔓',
      unlatched:             '🚪',
      lock_n_go:             '🏃',
      lock_n_go_with_unlatch:'🏃',
      open:                  '🔓',
      close:                 '🔒',
      button_unlatch:        '🚪',
      button_lock_n_go:      '🏃',
      button_lock_n_go_unlatch: '🏃',
      button_open:           '🔓',
      button_lock:           '🔒',
      button_unlock:         '🔓',
    };
    var _lockT = lang === 'de'
      ? { lock: 'Verriegeln', unlock: T.unlock, openDoor: T.openDoor, open: T.open,
          lng: "Lock 'n' Go", lngOpen: "Lock 'n' Go + Öffnen" }
      : { lock: 'Lock', unlock: T.unlock, openDoor: T.openDoor, open: T.open,
          lng: "Lock 'n' Go", lngOpen: "Lock 'n' Go + Open" };
    var lockLabels = {
      locked:                _lockT.lock,
      unlocked:              _lockT.unlock,
      unlatched:             _lockT.openDoor,
      lock_n_go:             _lockT.lng,
      lock_n_go_with_unlatch:_lockT.lngOpen,
      button_unlatch:        _lockT.openDoor,
      button_lock_n_go:      _lockT.lng,
      button_lock_n_go_unlatch: _lockT.lngOpen,
      button_open:           _lockT.open,
      button_lock:           _lockT.lock,
      button_unlock:         _lockT.unlock,
    };

    var skipCaps = [CAP.LOCKED, CAP.MEASURE_BATTERY, 'alarm_battery', CAP.THERMOSTAT_MODE,
                    CAP.HOMEALARM_STATE, CAP.HOMEALARM, CAP.WC_STATE, CAP.SPEAKER_REPEAT,
                    'button_action', CAP.ONOFF, CAP.MEASURE_TEMP, CAP.MEASURE_HUMIDITY,
                    CAP.ALARM_MOTION, CAP.ALARM_CONTACT];

    // 1. Lock / Unlock — immer anzeigen wenn locked-Capability vorhanden
    if (caps[CAP.LOCKED] !== undefined) {
      [
        { label: '🔒 Lock',   value: true,  active: isLocked  },
        { label: '🔓 Unlock', value: false, active: !isLocked },
      ].forEach(function (a) {
        var btn = createElement('button', 'lock-action-btn');
        btn.textContent = a.label;
        if (a.active) btn.classList.add('active');
        (function (val) {
          btn.addEventListener('click', function () {
            setCapability(_lockModalId, CAP.LOCKED, val);
            closeLockModal();
          });
        }(a.value));
        actionsEl.appendChild(btn);
      });
    }

    // 2. Enum-Capabilities (z.B. lock_mode → Werte als Auswahl)
    var actionCapId = _getLockActionCap(d);
    if (actionCapId) {
      var aCap  = caps[actionCapId];
      var aVals = aCap.values;
      var aCur  = aCap.value;
      aVals.forEach(function (v) {
        var btn = createElement('button', 'lock-action-btn');
        if (v.id === aCur) btn.classList.add('active');
        var icon  = lockIcons[v.id] || '●';
        var label = lockLabels[v.id] ||
                    (v.title ? (v.title.en || v.title.de || v.id) : null) ||
                    v.id.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        btn.textContent = icon + ' ' + label;
        (function (capId, modeId) {
          btn.addEventListener('click', function () {
            setCapability(_lockModalId, capId, modeId);
            closeLockModal();
          });
        }(actionCapId, v.id));
        actionsEl.appendChild(btn);
      });
    }

    // 2. Button-Capabilities (setable:true, getable:false — z.B. Nuki "Tür öffnen", "Lock 'n' Go")
    capIds.forEach(function (cid) {
      if (skipCaps.indexOf(cid) !== -1) return;
      var cap = caps[cid];
      if (!cap) return;
      // Button erkennen: entweder explizit getable:false oder Wert ist null/false ohne values
      var isBtn = (cap.setable === true && cap.getable === false) ||
                  (cap.setable === true && cap.value === null && !Array.isArray(cap.values));
      if (!isBtn) return;
      // Label: bekannte ID → fester Text; sonst cap.title; sonst ID als Fallback
      var label = lockLabels[cid] ||
                  (cap.title ? (cap.title.en || cap.title.de || cid) : null) ||
                  cid.replace(/^button_/, '').replace(/_/g, ' ')
                     .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      // Icon: bekannte ID → feste Map; sonst über Label-Text
      var icon = lockIcons[cid];
      if (!icon) {
        var lbl = label.toLowerCase();
        if (lbl.indexOf('öffnen') !== -1 || lbl.indexOf('unlatch') !== -1 ||
            (lbl.indexOf('open') !== -1 && lbl.indexOf('lock') === -1)) icon = '🚪';
        else if (lbl.indexOf('lock') !== -1 && lbl.indexOf('go') !== -1) icon = '🏃';
        else if (lbl.indexOf('unlock') !== -1 || lbl.indexOf('auf') !== -1) icon = '🔓';
        else if (lbl.indexOf('lock') !== -1 || lbl.indexOf('ab') !== -1) icon = '🔒';
        else icon = '●';
      }
      var btn = createElement('button', 'lock-action-btn');
      btn.textContent = icon + ' ' + label;
      (function (capId) {
        btn.addEventListener('click', function () {
          setCapability(_lockModalId, capId, true);
          closeLockModal();
        });
      }(cid));
      actionsEl.appendChild(btn);
      hasActions = true;
    });

  }

  window.openLockModal  = openLockModal;
  window.closeLockModal = closeLockModal;

  // ── Thermostat-Modal ──────────────────────────────
  var _thermostatModalId = null;

  function openThermostatModal(deviceId) {
    _thermostatModalId = deviceId;
    var d = devices[deviceId];
    if (!d) return;
    document.getElementById('thermostat-modal-name').textContent = d.name;
    document.getElementById('thermostat-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    _updateThermostatModal();
  }

  function closeThermostatModal() {
    document.getElementById('thermostat-modal').style.display = 'none';
    document.body.style.overflow = '';
    _thermostatModalId = null;
  }

  function _updateThermostatModal() {
    if (!_thermostatModalId) return;
    var d = devices[_thermostatModalId];
    if (!d) return;
    var caps   = d.capabilitiesObj || {};
    var capIds = d.capabilities    || [];

    // Aktuelle Temperatur
    var cur = caps[CAP.MEASURE_TEMP] && caps[CAP.MEASURE_TEMP].value;
    document.getElementById('thermostat-current-temp').textContent =
      (cur !== null && cur !== undefined) ? cur.toFixed(1) + ' °C' : '—';

    // Zieltemperatur
    var tgt = caps[CAP.TARGET_TEMP] && caps[CAP.TARGET_TEMP].value;
    var tgtText = (tgt !== null && tgt !== undefined) ? tgt.toFixed(1) + ' °C' : '—';
    document.getElementById('thermostat-target-temp').textContent = tgtText;

    // on/off toggle
    var hasOO   = capIds.indexOf(CAP.ONOFF) !== -1;
    var isOn    = hasOO && caps[CAP.ONOFF] && caps[CAP.ONOFF].value === true;
    var onOffEl = document.getElementById('thermostat-onoff-btn');
    if (hasOO) {
      onOffEl.style.display = 'flex';
      onOffEl.classList.toggle('on', isOn);
      onOffEl.textContent = isOn ? T.on : T.off;
    } else {
      onOffEl.style.display = 'none';
    }

    // Modus-Buttons
    var modeCap  = caps[CAP.THERMOSTAT_MODE];
    var modesEl  = document.getElementById('thermostat-modes');
    if (modeCap) {
      modesEl.style.display = 'flex';
      var curMode = modeCap.value;
      var vals    = (modeCap.values && modeCap.values.length) ? modeCap.values
                  : [{id:'heat',title:{en:T.modeHeat}},{id:'cool',title:{en:T.modeCool}},
                     {id:'auto',title:{en:T.modeAuto}},{id:'off', title:{en:T.off}}];
      var modeIcons = {heat:'🔥', cool:'❄️', auto:'🔄', off:'○'};
      modesEl.innerHTML = '';
      vals.forEach(function (v) {
        var btn = createElement('button', 'thermostat-mode-btn');
        btn.textContent = (modeIcons[v.id] || '') + ' ' +
          (v.title ? (v.title.en || v.id) : v.id);
        if (v.id === curMode) btn.classList.add('active');
        (function (modeId) {
          btn.addEventListener('click', function () { thermostatSetMode(modeId); });
        }(v.id));
        modesEl.appendChild(btn);
      });
    } else {
      modesEl.style.display = 'none';
    }
  }

  function thermostatAdjust(delta) {
    if (!_thermostatModalId) return;
    var caps = (devices[_thermostatModalId] || {}).capabilitiesObj || {};
    var cur  = (caps[CAP.TARGET_TEMP] && caps[CAP.TARGET_TEMP].value) || 20;
    var step = delta > 0 ? 0.5 : -0.5;
    var nv   = Math.round((cur + step) * 2) / 2; // snap to 0.5 steps
    var cap  = caps[CAP.TARGET_TEMP] || {};
    if (cap.min !== undefined && nv < cap.min) nv = cap.min;
    if (cap.max !== undefined && nv > cap.max) nv = cap.max;
    setCapability(_thermostatModalId, CAP.TARGET_TEMP, nv);
  }

  function thermostatSetMode(mode) {
    if (!_thermostatModalId) return;
    setCapability(_thermostatModalId, CAP.THERMOSTAT_MODE, mode);
  }

  function thermostatToggleOnOff() {
    if (!_thermostatModalId) return;
    var caps = (devices[_thermostatModalId] || {}).capabilitiesObj || {};
    var cur  = caps[CAP.ONOFF] && caps[CAP.ONOFF].value === true;
    setCapability(_thermostatModalId, CAP.ONOFF, !cur);
  }

  window.openThermostatModal  = openThermostatModal;
  window.closeThermostatModal = closeThermostatModal;
  window.thermostatAdjust     = thermostatAdjust;
  window.thermostatSetMode    = thermostatSetMode;
  window.thermostatToggleOnOff= thermostatToggleOnOff;

  window.openSpeakerModal     = openSpeakerModal;
  window.closeSpeakerModal    = closeSpeakerModal;
  window.speakerPlayPause     = speakerPlayPause;
  window.speakerPrev          = speakerPrev;
  window.speakerNext          = speakerNext;
  window.speakerToggleShuffle = speakerToggleShuffle;
  window.speakerCycleRepeat   = speakerCycleRepeat;
  window.speakerToggleMute    = speakerToggleMute;

  // ── EV Dashboard ─────────────────────────────────────────────────────

  var _evTimer = null;

  // Known capability metadata for EV / car devices
  function _buildEvCapMeta() {
    var L = lang === 'de'
      ? { batt: 'Batterie', chgState: 'Ladezustand', range: 'Reichweite', battLow: 'Batterie schwach',
          locked: 'Verriegelt', temp: 'Temperatur', tempIn: 'Innentemperatur', tempOut: 'Aussentemperatur',
          chgPower: 'Ladeleistung', energyUsed: 'Verbrauchte Energie', odo: 'Kilometerstand',
          onoff: 'Ein / Aus', chgCurrent: 'Ladestrom', voltage: 'Spannung' }
      : { batt: 'Battery', chgState: 'Charging State', range: 'Range', battLow: 'Battery Low',
          locked: 'Locked', temp: 'Temperature', tempIn: 'Inside Temp', tempOut: 'Outside Temp',
          chgPower: 'Charging Power', energyUsed: 'Energy Used', odo: 'Odometer',
          onoff: 'On / Off', chgCurrent: 'Charging Current', voltage: 'Voltage' };
    return {
      measure_battery:     { label: L.batt,       unit: '%',    icon: '🔋' },
      ev_charging_state:   { label: L.chgState,   unit: '',     icon: '⚡' },
      measure_range:       { label: L.range,      unit: ' km',  icon: '📍' },
      alarm_battery:       { label: L.battLow,    unit: '',     icon: '⚠️' },
      locked:              { label: L.locked,     unit: '',     icon: '🔒' },
      measure_temperature: { label: L.temp,       unit: '°C',   icon: '🌡️' },
      'measure_temperature.inside':  { label: L.tempIn,  unit: '°C',  icon: '🌡️' },
      'measure_temperature.outside': { label: L.tempOut, unit: '°C',  icon: '🌡️' },
      measure_power:       { label: L.chgPower,   unit: ' W',   icon: '⚡' },
      meter_power:         { label: L.energyUsed, unit: ' kWh', icon: '⚡' },
      odometer:            { label: L.odo,        unit: ' km',  icon: '🛣️' },
      onoff:               { label: L.onoff,      unit: '',     icon: '⏻' },
      measure_current:     { label: L.chgCurrent, unit: ' A',   icon: '⚡' },
      measure_voltage:     { label: L.voltage,    unit: ' V',   icon: '⚡' },
    };
  }

  var _evCapMeta = _buildEvCapMeta();

  // Maps Homey's ev_charging_state enum values to display text, badge class and pulse flag.
  // Standard Homey values (SDK): charging, plugged_in, discharging, not_connected
  // Non-standard aliases used by some drivers are mapped to the nearest standard equivalent.
  var _evChargingStateMap = {
    // ── Standard Homey SDK values ──────────────────────────────────
    'charging':        { label: '⚡ Charging',     cls: 'ev-charge-charging',    pulse: true  },
    'plugged_in':      { label: '🔌 Plugged in',   cls: 'ev-charge-plugged',     pulse: false },
    'discharging':     { label: '🚗 Driving',      cls: 'ev-charge-discharging', pulse: false },
    'not_connected':   { label: '— Not connected', cls: 'ev-charge-none',        pulse: false },
    // ── Non-standard aliases (various car app drivers) ─────────────
    'plugged_out':     { label: '🔌 Unplugged',    cls: 'ev-charge-none',        pulse: false },
    'unplugged':       { label: '— Not connected', cls: 'ev-charge-none',        pulse: false },
    'disconnected':    { label: '— Not connected', cls: 'ev-charge-none',        pulse: false },
    'connected':       { label: '🔌 Plugged in',   cls: 'ev-charge-plugged',     pulse: false },
    'fully_charged':   { label: '✅ Full',          cls: 'ev-charge-plugged',     pulse: false },
    'waiting':         { label: '🔌 Plugged in',   cls: 'ev-charge-plugged',     pulse: false },
  };

  function _evCapLabel(key) {
    return (_evCapMeta[key] || {}).label || key;
  }
  function _evCapIcon(key) {
    return (_evCapMeta[key] || {}).icon || '●';
  }
  function _evCapUnit(key) {
    return (_evCapMeta[key] || {}).unit || '';
  }

  function _escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _formatEvCapValue(key, val, units) {
    if (typeof val === 'boolean') {
      if (key === 'locked')         return val ? '🔒 ' + T.locked : '🔓 ' + T.unlocked;
      if (key === 'onoff')          return val ? T.on : T.off;
      if (key === 'alarm_battery')  return val ? '⚠️ ' + T.low : T.ok;
      if (key === 'charging_state') return val ? T.charging : T.notCharging;
      return val ? T.yes : T.no;
    }
    if (typeof val === 'number') {
      var rounded = Math.round(val * 10) / 10;
      var u = units || _evCapUnit(key);
      return rounded + (u ? ' ' + u : '');
    }
    if (val === null || val === undefined) return '—';
    if (typeof val === 'string') return val;
    return String(val);
  }

  function _renderEvBody(body, data) {
    if (!data || data.error) {
      body.innerHTML = '<div class="ev-error">' + T.noEvDevice + '<br>' + T.configureInSettings + '</div>';
      return;
    }

    var caps = data.caps || {};
    // Each entry: { value, title, units }
    var batteryEntry = caps.measure_battery;
    var battery = (batteryEntry && typeof batteryEntry.value === 'number') ? batteryEntry.value : null;

    var html = '';

    // Car image (hidden via onerror if not uploaded)
    html += '<div class="ev-car-img-wrap" id="ev-img-wrap"><img class="ev-car-img" src="/api/ev-image" onerror="var w=document.getElementById(\'ev-img-wrap\');if(w)w.style.display=\'none\'" alt=""></div>';

    // Name + availability
    html += '<div class="ev-device-name">' + _escHtml(data.name) + '</div>';
    if (!data.available) {
      html += '<div class="ev-unavailable">⚠️ Offline</div>';
    }

    // Battery section: bar + integrated charging state badge
    if (battery !== null) {
      var pct = Math.max(0, Math.min(100, battery));
      var barColor = pct <= 20 ? 'var(--danger)' : pct <= 40 ? '#FF9500' : 'var(--green)';

      // ev_charging_state — standard Homey EV capability
      var chargeEntry = caps.ev_charging_state;
      var chargeVal   = chargeEntry ? chargeEntry.value : null;
      var chargeMeta  = chargeVal ? (_evChargingStateMap[chargeVal] || { label: String(chargeVal), cls: 'ev-charge-none', pulse: false }) : null;

      html += '<div class="ev-battery-section">';
      if (chargeMeta) {
        html += '<div class="ev-battery-status-row">';
        html += '<span class="ev-charge-badge ' + chargeMeta.cls + '">' + chargeMeta.label + '</span>';
        html += '<span class="ev-battery-pct">' + Math.round(pct) + '%</span>';
        html += '</div>';
      }
      html += '<div class="ev-battery-bar-wrap">';
      html += '<div class="ev-battery-bar-track">';
      html += '<div class="ev-battery-bar-fill' + (chargeMeta && chargeMeta.pulse ? ' is-charging' : '') + '" style="width:' + pct + '%;background:' + barColor + '"></div>';
      html += '</div>';
      if (!chargeMeta) html += '<div class="ev-battery-pct">' + Math.round(pct) + '%</div>';
      html += '</div>';
      html += '</div>';
    }

    // Capability cards — exclude measure_battery and ev_charging_state (both handled above)
    var capKeys = Object.keys(caps).filter(function(k) {
      return k !== 'measure_battery' && k !== 'ev_charging_state';
    });
    if (capKeys.length > 0) {
      html += '<div class="ev-caps-grid">';
      for (var i = 0; i < capKeys.length; i++) {
        var key   = capKeys[i];
        var entry = caps[key];                          // { value, title, units }
        var val   = entry ? entry.value   : null;
        var label = (entry && entry.title)  ? entry.title  : _evCapLabel(key);
        var units = (entry && entry.units)  ? entry.units  : null;
        html += '<div class="ev-cap-card">';
        html += '<div class="ev-cap-icon">' + _evCapIcon(key) + '</div>';
        html += '<div class="ev-cap-value">' + _escHtml(_formatEvCapValue(key, val, units)) + '</div>';
        html += '<div class="ev-cap-label">' + _escHtml(label) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    body.innerHTML = html;
  }

  function _fetchEv() {
    var body = document.getElementById('ev-body');
    if (!body) return;
    xhr('GET', '/api/ev', null, function(err, data) {
      _renderEvBody(body, err ? null : data);
    });
  }

  function openEvModal() {
    document.getElementById('ev-modal').style.display = 'flex';
    // Show spinner while loading
    var body = document.getElementById('ev-body');
    if (body) body.innerHTML = '<div class="ev-spinner"><div class="spinner"></div></div>';
    _fetchEv();
    if (!_evTimer) _evTimer = setInterval(_fetchEv, 30000);
  }
  window.openEvModal = openEvModal;

  function closeEvModal() {
    document.getElementById('ev-modal').style.display = 'none';
    if (_evTimer) { clearInterval(_evTimer); _evTimer = null; }
  }
  window.closeEvModal = closeEvModal;

})();
