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
  };

  var zones = {};
  var devices = {};
  var _enabledFlows  = null;  // Array von Flow-IDs oder null
  var _flowTileMatch = false; // true = Breite wie Gerätekacheln
  var _flowConfirm   = false; // true = Bestätigung vor Flow-Start
  var _flowPosition  = 'top'; // 'top' | 'bottom'
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

  // ── Energy Modal ───────────────────────────────────
  var _energyTimer = null;
  var _energyTab   = 'live'; // 'live' | 'history'

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
    _energyTab = 'live';
  }
  window.closeEnergyModal = closeEnergyModal;

  function switchEnergyTab(tab) {
    _energyTab = tab;
    _setEnergyTab(tab);
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
    document.getElementById('energy-tab-history').classList.toggle('active', tab === 'history');
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
    req.onerror   = function () { _showEnergyError('Network error'); };
    req.ontimeout = function () { _showEnergyError('Request timed out'); };
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
    var niceMax = maxVal <= 5  ? Math.ceil(maxVal) :
                  maxVal <= 20 ? Math.ceil(maxVal / 5) * 5 :
                  Math.ceil(maxVal / 10) * 10;
    // Headroom: wenn maxVal sehr nah an niceMax liegt, eine Stufe höher (Label-Platz sichern)
    if (niceMax < maxVal * 1.05) {
      niceMax = maxVal <= 20 ? niceMax + 5 : niceMax + 10;
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

    // ── Horizontale Hilfslinien ──
    var yTicks = [0.25, 0.5, 0.75, 1.0];
    for (var t = 0; t < yTicks.length; t++) {
      var yVal = niceMax * yTicks[t];
      var yPx  = padTop + chartH - barH(yVal);
      var lbl  = yVal >= 10 ? Math.round(yVal) : (Number.isInteger(yVal) ? yVal : yVal.toFixed(1));
      svg += '<line x1="' + padL + '" y1="' + yPx + '" x2="' + (W - padR) + '" y2="' + yPx +
        '" stroke="#8E8E93" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.4"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (yPx + 4) + '" text-anchor="end" ' +
        'font-size="10" fill="#8E8E93">' + lbl + '</text>';
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
    if (hasSolarData) legItems.push({ color: '#FFD60A', label: 'Solar total' });
    if (hasSelf) legItems.push({ color: '#34C759', label: 'Solar self-use' });
    if (hasGrid) legItems.push({ color: '#FF9500', label: 'Grid import' });
    if (hasExp)  legItems.push({ color: '#5AC8FA', label: 'Grid export' });
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

  function _energyColor(type, power) {
    if (type === 'solar')   return power > 0  ? '#34C759' : '#8E8E93';
    if (type === 'battery') return power < 0  ? '#34C759' : (power > 0 ? '#007AFF' : '#8E8E93');
    if (type === 'grid')    return power < 0  ? '#34C759' : (power > 0 ? '#FF9500' : '#8E8E93');
    return '#8E8E93';
  }

  function _energyStatus(type, power, soc) {
    if (type === 'solar')    return power > 0  ? ['Generating',   'solar']       : ['Idle', 'idle'];
    if (type === 'battery')  return power < 0  ? ['Discharging',  'discharging'] : (power > 0 ? ['Charging', 'charging'] : ['Idle', 'idle']);
    if (type === 'grid')     return power < 0  ? ['Exporting',    'exporting']   : (power > 0 ? ['Importing', 'importing'] : ['Idle', 'idle']);
    if (type === 'ev')       return power > 0  ? ['Charging',     'charging']    : ['Idle', 'idle'];
    return ['Consuming', 'consuming'];
  }

  var _ENERGY_FALLBACK_ICONS = { solar: '☀️', battery: '🔋', grid: '⚡', ev: '🚗', consumer: '🔌' };

  function _energyIconHtml(d) {
    if (d.icon) {
      var src = d.icon.startsWith('/') ? d.icon : '/api/icon-proxy?url=' + encodeURIComponent(d.icon);
      return '<img src="' + src + '" class="energy-device-icon-img" alt="">';
    }
    return '<span class="energy-device-icon-emoji">' + (_ENERGY_FALLBACK_ICONS[d.type] || '⚡') + '</span>';
  }

  function _renderEnergyFlowSVG(s, hasBattery) {
    var W    = 320;
    var R    = 38;
    var svgH = hasBattery ? 253 : 157;

    var solarC = _energyColor('solar',   s.solarW);
    var gridC  = _energyColor('grid',    s.gridW);
    var batC   = _energyColor('battery', s.batteryW);
    var homeC  = '#F5A623';

    var sx=75, sy=42, gx=245, gy=42, hx=160, hy=110, bx=160, by=210;

    function hexAlpha(hex, a) {
      var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
      return 'rgba('+r+','+g+','+b+','+a+')';
    }

    function edgePt(cx1, cy1, cx2, cy2) {
      var dx=cx2-cx1, dy=cy2-cy1, d=Math.sqrt(dx*dx+dy*dy);
      return { x: Math.round(cx1+dx/d*R), y: Math.round(cy1+dy/d*R) };
    }

    function lineW(w) { return Math.max(1.5, Math.min(5, 1.5+Math.abs(w||0)/400)); }

    function flowLine(x1, y1, x2, y2, color, watt, reverse) {
      if (Math.abs(watt||0) <= 5) {
        return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#ADADB8" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.3"/>';
      }
      var lw  = lineW(watt);
      var pd  = reverse ? 'M '+x2+','+y2+' L '+x1+','+y1 : 'M '+x1+','+y1+' L '+x2+','+y2;
      var dist = Math.sqrt(Math.pow(x2-x1,2)+Math.pow(y2-y1,2));
      var dur  = (dist/65).toFixed(2)+'s';
      var half = (parseFloat(dur)/2).toFixed(2)+'s';
      return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="'+lw+'" opacity="0.4"/>'+
        '<circle r="5" fill="'+color+'"><animateMotion dur="'+dur+'" repeatCount="indefinite" path="'+pd+'"/></circle>'+
        '<circle r="3.5" fill="'+color+'" opacity="0.55"><animateMotion dur="'+dur+'" begin="-'+half+'" repeatCount="indefinite" path="'+pd+'"/></circle>';
    }

    function node(cx, cy, color, iconSvg, label, value, sub) {
      var bg = hexAlpha(color, 0.11);
      return (
        '<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="'+bg+'" stroke="'+color+'" stroke-width="2"/>'+
        '<text x="'+cx+'" y="'+(cy-27)+'" text-anchor="middle" font-size="8" fill="'+color+'" font-weight="700" letter-spacing="0.8" opacity="0.85">'+label+'</text>'+
        '<g transform="translate('+cx+','+(cy-8)+')" fill="'+color+'" stroke="'+color+'">'+iconSvg+'</g>'+
        '<text x="'+cx+'" y="'+(cy+20)+'" text-anchor="middle" font-size="13" font-weight="700" fill="'+color+'" letter-spacing="-0.2">'+value+'</text>'+
        (sub ? '<text x="'+cx+'" y="'+(cy+33)+'" text-anchor="middle" font-size="9" fill="'+color+'" opacity="0.7">'+sub+'</text>' : '')
      );
    }

    var iSolar =
      '<circle r="5.5" stroke="none"/>'+
      '<g fill="none" stroke-width="2" stroke-linecap="round">'+
      '<line x1="0" y1="-9" x2="0" y2="-12"/>'+
      '<line x1="0" y1="9" x2="0" y2="12"/>'+
      '<line x1="9" y1="0" x2="12" y2="0"/>'+
      '<line x1="-9" y1="0" x2="-12" y2="0"/>'+
      '<line x1="6.4" y1="-6.4" x2="8.5" y2="-8.5"/>'+
      '<line x1="-6.4" y1="-6.4" x2="-8.5" y2="-8.5"/>'+
      '<line x1="6.4" y1="6.4" x2="8.5" y2="8.5"/>'+
      '<line x1="-6.4" y1="6.4" x2="-8.5" y2="8.5"/>'+
      '</g>';

    var iGrid = '<path d="M4,-12 L-2,1 L2,1 L-4,12 L10,0 L5,0 L8,-12 Z" stroke="none"/>';

    var iHome =
      '<polygon points="0,-12 -10,-1 10,-1" stroke="none"/>'+
      '<rect x="-8" y="-2" width="16" height="12" rx="1" fill="none" stroke-width="1.8"/>'+
      '<rect x="-3.5" y="3" width="7" height="7" rx="1" stroke="none" opacity="0.55"/>';

    var bLvl   = s.batterySoc !== null ? Math.max(0, Math.min(1, s.batterySoc/100)) : 0.45;
    var bBodyH = 17, bFillH = Math.max(1, Math.round(bLvl*bBodyH)), bFillY = -8+bBodyH-bFillH;
    var iBat =
      '<rect x="-7" y="-8" width="14" height="17" rx="2" fill="none" stroke-width="1.8"/>'+
      '<rect x="-4" y="-11" width="8" height="4" rx="1.5" stroke="none" opacity="0.85"/>'+
      '<rect x="-5.5" y="'+bFillY+'" width="11" height="'+bFillH+'" rx="1.5" stroke="none" opacity="0.45"/>';

    var svg = '<svg class="energy-flow-svg" viewBox="0 0 '+W+' '+svgH+'" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,-apple-system,sans-serif">';

    var sc=edgePt(sx,sy,hx,hy), hsc=edgePt(hx,hy,sx,sy);
    svg += flowLine(sc.x,sc.y,hsc.x,hsc.y, solarC, s.solarW, false);

    var gc=edgePt(gx,gy,hx,hy), hgc=edgePt(hx,hy,gx,gy);
    svg += flowLine(gc.x,gc.y,hgc.x,hgc.y, gridC, s.gridW, s.gridW < 0);

    if (hasBattery) {
      var hbc=edgePt(hx,hy,bx,by), bhc=edgePt(bx,by,hx,hy);
      svg += flowLine(hbc.x,hbc.y,bhc.x,bhc.y, batC, s.batteryW, s.batteryW < 0);
    }

    svg += node(sx, sy, solarC, iSolar, 'SOLAR',  _fmtW(s.solarW), null);
    svg += node(gx, gy, gridC,  iGrid,  s.gridW < 0 ? 'EXPORT' : 'IMPORT', _fmtW(s.gridW), null);
    svg += node(hx, hy, homeC,  iHome,  'HOME',   _fmtW(s.homeW),  null);
    if (hasBattery) svg += node(bx, by, batC, iBat, 'BATTERY', _fmtW(s.batteryW), s.batterySoc !== null ? s.batterySoc+'% SoC' : null);

    svg += '</svg>';
    return svg;
  }

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
    var s       = data.summary;
    var devList = data.devices;
    var hasBat  = devList.some(function (d) { return d.type === 'battery'; });

    var now = new Date();
    var ts  = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');

    var body   = document.getElementById('energy-body');
    var svgKey = JSON.stringify(s) + (hasBat ? '1' : '0');

    // #4 SVG nur neu aufbauen wenn sich Werte geändert haben
    if (svgKey !== _lastEnergySummaryKey) {
      _lastEnergySummaryKey = svgKey;
      var html = '<div class="energy-flow-container">' + _renderEnergyFlowSVG(s, hasBat) + '</div>';
      html    += '<div class="energy-scroll-body">' + _buildEnergyDeviceCardsHtml(devList) + '</div>';
      body.innerHTML = html;
    } else {
      // SVG unverändert – nur Device-Cards aktualisieren
      var scrollBody = body.querySelector('.energy-scroll-body');
      if (scrollBody) scrollBody.innerHTML = _buildEnergyDeviceCardsHtml(devList);
    }
  }

  // ── Theme ('light' | 'dark') ───────────────────────
  var theme = 'light';
  try { theme = localStorage.getItem('theme') || 'light'; } catch (_) {}

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : '');
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = t === 'dark' ? '🌙' : '🔆';
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', theme); } catch (_) {}
    applyTheme(theme);
  }

  applyTheme(theme);
  window.toggleTheme = toggleTheme;

  // ── View-Modus ('zones' | 'all') ───────────────────
  var _viewDefault   = 'all';   // aus Settings, wird in loadData gesetzt
  var _viewBtnHidden = false;   // aus Settings
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
    btn.textContent = viewMode === 'zones' ? '⊞ All' : '⊟ Rooms';
    btn.setAttribute('aria-label', viewMode === 'zones' ? 'Show all devices' : 'Group by rooms');
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
      var img = document.createElement('img');
      img.className = 'device-icon-img';
      img.alt = '';
      img.src = d.icon.startsWith('/') ? d.icon : '/api/icon-proxy?url=' + encodeURIComponent(d.icon);
      img.onerror = function () {
        span.removeChild(img);
        span.textContent = getIcon(d.class);
      };
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

    xhr('GET', '/api/settings', null, function (err, cfg) {
      if (!err && cfg) {
        _alarmPin = cfg.alarmPin || '';
        var btn = document.getElementById('energy-btn');
        if (btn) btn.style.display = cfg.energyEnabled === false ? 'none' : '';
        // Kachelgrösse: 1=90px 2=110px 3=130px(default) 4=165px 5=210px
        var tilePx = [90, 110, 130, 165, 210];
        var ts = (cfg.tileSize >= 1 && cfg.tileSize <= 5) ? cfg.tileSize : 3;
        document.documentElement.style.setProperty('--tile-min', tilePx[ts - 1] + 'px');
        // Flow-IDs merken
        // false = gespeichert mit "kein Flow", null = noch nie gespeichert → beides = keine Flows anzeigen
        _enabledFlows = Array.isArray(cfg.enabledFlows) && cfg.enabledFlows.length
          ? cfg.enabledFlows : null;
        // Flow-Tile-Breite: 'match' = wie Gerätekacheln, sonst dynamisch
        _flowTileMatch = cfg.flowTileWidth === 'match';
        // Flow-Bestätigung und Position
        _flowConfirm  = cfg.flowConfirm  === true;
        _flowPosition = cfg.flowPosition === 'bottom' ? 'bottom' : 'top';
        // Dashboard-Titel
        var titleEl = document.getElementById('header-title');
        if (titleEl) titleEl.textContent = cfg.dashboardTitle || 'My Homey';
        // Schriftgrösse: 1–5 → scale 1.0 / 1.15 / 1.3 / 1.5 / 1.75
        var fontScales = [1, 1.15, 1.3, 1.5, 1.75];
        var fs = (cfg.fontSize >= 1 && cfg.fontSize <= 5) ? cfg.fontSize : 1;
        document.documentElement.style.setProperty('--font-scale', fontScales[fs - 1]);
        // Ansicht-Standard + Button-Sichtbarkeit
        _viewDefault   = cfg.viewDefault   || 'all';
        _viewBtnHidden = cfg.viewBtnHidden === true;
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
        // Header ausblenden
        var header = document.querySelector('.header');
        if (cfg.headerHidden) {
          if (header) header.style.display = 'none';
          root.style.setProperty('--header-h', '0px');
        } else {
          if (header) header.style.display = '';
          root.style.setProperty('--header-h', '62px');
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

  function getOrderedDevices(list) {
    return list.slice().sort(function (a, b) {
      var ia = _order.indexOf(a.id);
      var ib = _order.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.name.localeCompare(b.name);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  function getOrderedFlows(list) {
    return list.slice().sort(function (a, b) {
      var ia = _flowOrder.indexOf(a.id);
      var ib = _flowOrder.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.name.localeCompare(b.name);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  function saveOrderFromGrid(grid) {
    var ids = Array.from(grid.querySelectorAll('.device-card'))
      .map(function (c) { return c.id.replace('card-', ''); });
    var first = ids.find(function (id) { return _order.indexOf(id) !== -1; });
    var insertAt = first ? _order.indexOf(first) : _order.length;
    ids.forEach(function (id) {
      var i = _order.indexOf(id);
      if (i !== -1) { if (i < insertAt) insertAt--; _order.splice(i, 1); }
    });
    ids.forEach(function (id, i) { _order.splice(insertAt + i, 0, id); });
    try { localStorage.setItem('deviceOrder', JSON.stringify(_order)); } catch (_) {}
  }

  function saveFlowOrderFromGrid(grid) {
    var ids = Array.from(grid.querySelectorAll('.flow-tile'))
      .map(function (t) { return t.id.replace('flow-tile-', ''); });
    var first = ids.find(function (id) { return _flowOrder.indexOf(id) !== -1; });
    var insertAt = first ? _flowOrder.indexOf(first) : _flowOrder.length;
    ids.forEach(function (id) {
      var i = _flowOrder.indexOf(id);
      if (i !== -1) { if (i < insertAt) insertAt--; _flowOrder.splice(i, 1); }
    });
    ids.forEach(function (id, i) { _flowOrder.splice(insertAt + i, 0, id); });
    try { localStorage.setItem('flowOrder', JSON.stringify(_flowOrder)); } catch (_) {}
  }

  var _drag = null;

  function initDragOnGrid(grid) {
    Array.from(grid.querySelectorAll('.device-card')).forEach(function (card) {
      makeDraggable(card, grid, '.device-card', saveOrderFromGrid);
    });
  }

  function initDragOnFlowGrid(grid) {
    Array.from(grid.querySelectorAll('.flow-tile')).forEach(function (tile) {
      makeDraggable(tile, grid, '.flow-tile', saveFlowOrderFromGrid);
    });
  }

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

  function renderFlowSection(container) {
    var section = createElement('div', 'flow-section');


    var grid = createElement('div', 'flow-grid' + (_flowTileMatch ? ' flow-grid-fixed' : ''));
    section.appendChild(grid);
    container.appendChild(section);

    // Flows vom Server laden (Namen + Typen)
    xhr('GET', '/api/flows', null, function (err, flows) {
      if (err || !flows) return;
      // Nur ausgewählte Flows zeigen
      var enabledSet = new Set(_enabledFlows || []);
      var visible = flows.filter(function (f) { return enabledSet.has(f.id); });
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

  function buildFlowTile(f) {
    var tile = createElement('button', 'flow-tile');
    tile.id = 'flow-tile-' + f.id;
    tile.setAttribute('aria-label', f.name);

    var icon = createElement('span', 'flow-tile-icon');
    icon.textContent = '▶';
    tile.appendChild(icon);

    var name = createElement('span', 'flow-tile-name');
    name.textContent = f.name;
    tile.appendChild(name);

    tile.addEventListener('click', function () {
      triggerFlow(f.id, tile);
    });

    return tile;
  }

  function triggerFlow(flowId, tileEl) {
    if (!tileEl || tileEl.classList.contains('flow-running')) return;
    if (_flowConfirm) {
      _showFlowConfirm(flowId, tileEl);
      return;
    }
    _doTriggerFlow(flowId, tileEl);
  }

  function _showFlowConfirm(flowId, tileEl) {
    var f = _flowsData[flowId];
    var nameEl  = document.getElementById('flow-confirm-name');
    var modal   = document.getElementById('flow-confirm-modal');
    var okBtn   = document.getElementById('flow-confirm-ok');
    var cancelBtn = document.getElementById('flow-confirm-cancel');
    if (!modal) { _doTriggerFlow(flowId, tileEl); return; }
    if (nameEl) nameEl.textContent = f ? f.name : '';
    modal.style.display = 'flex';

    // Handler einmalig setzen (vorherige entfernen)
    var newOk     = okBtn.cloneNode(true);
    var newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.addEventListener('click', function () {
      modal.style.display = 'none';
      _doTriggerFlow(flowId, tileEl);
    });
    newCancel.addEventListener('click', function () {
      modal.style.display = 'none';
    });

    // Hintergrund-Klick schliesst Modal
    modal.onclick = function (e) {
      if (e.target === modal) modal.style.display = 'none';
    };
  }

  function _doTriggerFlow(flowId, tileEl) {
    tileEl.classList.add('flow-running');
    var iconEl = tileEl.querySelector('.flow-tile-icon');
    if (iconEl) iconEl.textContent = '⟳';

    xhr('POST', '/api/flow/' + flowId + '/trigger', '{}', function (err, data) {
      tileEl.classList.remove('flow-running');
      if (err) {
        tileEl.classList.add('flow-error');
        if (iconEl) iconEl.textContent = '✕';
        var msg = (data && data.error) ? data.error : err.message;
        tileEl.title = msg;
        setTimeout(function () {
          tileEl.classList.remove('flow-error');
          tileEl.title = '';
          if (iconEl) iconEl.textContent = '▶';
        }, 3000);
      } else {
        tileEl.classList.add('flow-success');
        if (iconEl) iconEl.textContent = '✓';
        setTimeout(function () {
          tileEl.classList.remove('flow-success');
          if (iconEl) iconEl.textContent = '▶';
        }, 1800);
      }
    });
  }

  // ── Rendern ─────────────────────────────────────────
  function render() {
    updateViewToggle();
    var container = document.getElementById('zones-container');
    container.innerHTML = '';

    var showFlows = _enabledFlows && _enabledFlows.length;

    // Flows-Sektion oben (Standard)
    if (showFlows && _flowPosition !== 'bottom') {
      renderFlowSection(container);
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

    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-msg').style.display = 'none';
    container.style.display = 'block';
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

    Object.keys(byZone).sort(function (a, b) {
      return zones[a].name.localeCompare(zones[b].name);
    }).forEach(function (zoneId) {
      container.appendChild(buildZoneSection(zones[zoneId].name, byZone[zoneId]));
    });

    if (noZone.length > 0) {
      container.appendChild(buildZoneSection('Other', noZone));
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
    var title = createElement('div', 'zone-title');
    title.textContent = zoneName;
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
    if (!d.available) card.classList.add('unavailable');

    var caps      = d.capabilitiesObj || {};
    var capIds    = d.capabilities || [];
    var hasOnOff  = capIds.indexOf(CAP.ONOFF) !== -1;
    var hasAlarm  = d.class === 'homealarm' || capIds.indexOf(CAP.HOMEALARM) !== -1;
    var hasDim    = capIds.indexOf(CAP.DIM) !== -1;
    var hasWcState = capIds.indexOf(CAP.WC_STATE) !== -1 && capIds.indexOf(CAP.WC_SET) === -1;
    var isSpeaker = d.class === 'speaker' || d.class === 'mediaplayer';
    var isOn      = hasOnOff && caps[CAP.ONOFF] && caps[CAP.ONOFF].value === true;
    var alarmCap  = hasAlarm ? getAlarmCapability(d) : null;
    var isArmed   = alarmCap ? alarmIsArmed(alarmCap.value) : false;
    var wcState   = hasWcState && caps[CAP.WC_STATE] ? caps[CAP.WC_STATE].value : null;

    if (isOn || isArmed) card.classList.add('on');
    if (wcState === 'up') card.classList.add('on');
    if (caps[CAP.INPUT_EXT_1] && caps[CAP.INPUT_EXT_1].value === true) card.classList.add('open');

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

    if (!isSpeaker && (hasAlarm || (hasOnOff && !hasDim))) {
      card.classList.add('clickable');
      (function (deviceId) {
        card.addEventListener('click', function (e) {
          if (e.target.classList.contains('device-toggle')) return;
          var dv = devices[deviceId];
          if (!dv) return;
          var cv = dv.capabilitiesObj || {};
          if (hasAlarm) {
            var ac = getAlarmCapability(devices[deviceId]);
            if (ac) {
              var newVal = ac.isBoolean ? !alarmIsArmed(ac.value) : (alarmIsArmed(ac.value) ? 'disarmed' : 'armed');
              requirePin(function () { setCapability(deviceId, ac.capId, newVal); });
            }
          } else {
            setCapability(deviceId, CAP.ONOFF, !(cv[CAP.ONOFF] && cv[CAP.ONOFF].value));
          }
        });
      }(d.id));
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

    if (!isSpeaker && hasOnOff) {
      var toggle = createElement('button', 'device-toggle');
      if (isOn) toggle.classList.add('on');
      toggle.setAttribute('aria-label', isOn ? 'Turn off' : 'Turn on');
      toggle.addEventListener('click', function () {
        var newVal = !toggle.classList.contains('on');
        setCapability(d.id, CAP.ONOFF, newVal);
      });
      header.appendChild(toggle);
    }

    if (hasWcState) {
      // Stopp-Button (◼) — sendet 'idle'
      var stopBtn = createElement('button', 'wc-state-btn');
      stopBtn.textContent = '◼';
      stopBtn.title = 'Stop';
      stopBtn.setAttribute('aria-label', 'Stop');
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
          var newVal = ac.isBoolean ? !alarmIsArmed(ac.value) : (btn.classList.contains('on') ? 'disarmed' : 'armed');
          requirePin(function () { setCapability(deviceId, ac.capId, newVal); });
        });
      }(d.id, alarmToggle));
      header.appendChild(alarmToggle);
    }

    card.appendChild(header);

    var name = createElement('div', 'device-name');
    name.textContent = d.name;
    card.appendChild(name);

    var statusEl = createElement('div', 'device-status');
    statusEl.id = 'status-' + d.id;
    statusEl.textContent = buildStatusText(d);
    card.appendChild(statusEl);

    var values = buildValueElements(d);
    if (values) card.appendChild(values);

    return card;
  }

  // ── #15 Statustext für die Karte ────────────────────
  function buildStatusText(d) {
    var caps       = d.capabilitiesObj || {};
    var capIds     = d.capabilities || [];
    var hasOnOff   = capIds.indexOf(CAP.ONOFF) !== -1;
    var hasAlarm   = d.class === 'homealarm' || capIds.indexOf(CAP.HOMEALARM) !== -1;
    var hasWcState = capIds.indexOf(CAP.WC_STATE) !== -1 && capIds.indexOf(CAP.WC_SET) === -1;

    if (d.class === 'speaker' || d.class === 'mediaplayer') {
      var track   = caps[CAP.SPEAKER_TRACK]  && caps[CAP.SPEAKER_TRACK].value;
      var artist  = caps[CAP.SPEAKER_ARTIST] && caps[CAP.SPEAKER_ARTIST].value;
      var playing = caps[CAP.SPEAKER_PLAYING] && caps[CAP.SPEAKER_PLAYING].value === true;
      if (track) return (playing ? '▶ ' : '⏸ ') + track + (artist ? ' · ' + artist : '');
      return playing ? 'Playing' : 'Stopped';
    }

    if (hasAlarm) {
      var ac = getAlarmCapability(d);
      if (ac) {
        if (ac.isBoolean) return alarmIsArmed(ac.value) ? 'Armed' : 'Disarmed';
        return ac.value === 'armed' ? 'Armed' : ac.value === 'partially_armed' ? 'Partly armed' : 'Disarmed';
      }
    }
    if (hasWcState) {
      var wcVal = caps[CAP.WC_STATE] ? caps[CAP.WC_STATE].value : null;
      if (wcVal === 'up')   return 'Open';
      if (wcVal === 'down') return 'Closed';
      if (wcVal === 'idle') return 'Stopped';
      return '';
    }
    if (hasOnOff) {
      var isOn = caps[CAP.ONOFF] && caps[CAP.ONOFF].value === true;
      if (caps[CAP.DIM] && isOn) {
        return 'On · ' + Math.round((caps[CAP.DIM].value || 0) * 100) + ' %';
      }
      return isOn ? 'On' : 'Off';
    }
    if (!d.available) return 'Unavailable';
    return '';
  }

  function buildValueElements(d) {
    var caps      = d.capabilitiesObj || {};
    var container = createElement('div', 'device-values');
    var added     = 0;

    // Primärwert: Temperatur
    var _noTemp = ['socket', 'light', 'windowcoverings', 'shutterblinds', 'blinds', 'curtain'];
    if (_noTemp.indexOf(d.class) === -1 && caps[CAP.MEASURE_TEMP]) {
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
      el.appendChild(document.createTextNode(caps[CAP.ALARM_CONTACT].value ? ' Open' : ' Closed'));
      container.appendChild(el);
      added++;
    }

    // Externer Eingang (z.B. Reed-Kontakt am Garagentor)
    if (caps[CAP.INPUT_EXT_1]) {
      var el = createElement('div', 'device-value');
      var dot = createElement('span', 'alarm-dot');
      if (caps[CAP.INPUT_EXT_1].value) dot.classList.add('active');
      el.appendChild(dot);
      el.appendChild(document.createTextNode(caps[CAP.INPUT_EXT_1].value ? ' Open' : ' Closed'));
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
    var hasAlarm   = d.class === 'homealarm' || capIds.indexOf(CAP.HOMEALARM) !== -1;
    var hasWcState = capIds.indexOf(CAP.WC_STATE) !== -1 && capIds.indexOf(CAP.WC_SET) === -1;
    var isOn       = hasOnOff && caps[CAP.ONOFF] && caps[CAP.ONOFF].value === true;
    var alarmCapU  = hasAlarm ? getAlarmCapability(d) : null;
    var isArmed    = alarmCapU ? alarmIsArmed(alarmCapU.value) : false;
    var wcStateVal = hasWcState && caps[CAP.WC_STATE] ? caps[CAP.WC_STATE].value : null;

    if (isOn || isArmed || wcStateVal === 'up') card.classList.add('on');
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
        if (sib2) sib2.textContent = caps[CAP.ALARM_CONTACT].value ? ' Open' : ' Closed';
      }
      i++;
    }
    if (caps[CAP.INPUT_EXT_1]) {
      if (dots[i]) {
        if (caps[CAP.INPUT_EXT_1].value) dots[i].classList.add('active');
        else dots[i].classList.remove('active');
        var sib3 = dots[i] ? dots[i].nextSibling : null;
        if (sib3) sib3.textContent = caps[CAP.INPUT_EXT_1].value ? ' Open' : ' Closed';
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
        if (data.type === 'device.update' && data.device) {
          var id = data.device.id;
          if (devices[id]) {
            if (data.device.capabilitiesObj) {
              devices[id].capabilitiesObj = data.device.capabilitiesObj;
            }
            devices[id].available = data.device.available;
            updateCard(id);
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
    _schedulePoll(10000);
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
              updateCard(d.id);
            }
          });
        }
        // Längeres Intervall wenn SSE aktiv und Daten liefert
        _schedulePoll(_sseActive ? 30000 : 10000);
      });
    }, delay);
  }

  // ── UI-Hilfsfunktionen ──────────────────────────────
  function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('error-msg').style.display = 'none';
    document.getElementById('zones-container').style.display = 'none';
  }

  function showError() {
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
    req.onerror   = function () { callback(new Error('Netzwerkfehler')); };
    req.ontimeout = function () { callback(new Error('Timeout')); };
    req.send(body || null);
  }

  // ── Refresh ─────────────────────────────────────────
  setInterval(loadData, 5 * 60 * 1000);

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

  // ── Start ───────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadData);
  } else {
    loadData();
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
      document.getElementById('pin-error').textContent = 'Wrong PIN';
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
  var _cameraLoadTimer    = null;

  function openCameraModal(deviceId, deviceName) {
    var modal = document.getElementById('camera-modal');
    var title = document.getElementById('camera-modal-title');
    var img   = document.getElementById('camera-modal-img');
    var err   = document.getElementById('camera-modal-error');

    title.textContent = deviceName;
    err.style.display = 'none';
    img.style.display = 'block';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    function refresh() {
      // #13 Timeout: wenn Bild nach 8 s nicht geladen → Fehlermeldung
      if (_cameraLoadTimer) clearTimeout(_cameraLoadTimer);
      _cameraLoadTimer = setTimeout(function () {
        img.style.display = 'none';
        err.style.display = 'flex';
      }, 8000);
      img.src = '/api/camera/' + deviceId + '?t=' + Date.now();
    }

    img.onload = function () {
      if (_cameraLoadTimer) { clearTimeout(_cameraLoadTimer); _cameraLoadTimer = null; }
      img.style.display = 'block';
      err.style.display = 'none';
    };

    img.onerror = function () {
      if (_cameraLoadTimer) { clearTimeout(_cameraLoadTimer); _cameraLoadTimer = null; }
      img.style.display = 'none';
      err.style.display = 'flex';
    };

    refresh();
    clearInterval(_cameraRefreshTimer);
    _cameraRefreshTimer = setInterval(refresh, 3000);
  }

  function closeCameraModal() {
    clearInterval(_cameraRefreshTimer);
    if (_cameraLoadTimer) { clearTimeout(_cameraLoadTimer); _cameraLoadTimer = null; }
    _cameraRefreshTimer = null;
    var modal = document.getElementById('camera-modal');
    modal.style.display = 'none';
    document.getElementById('camera-modal-img').src = '';
    document.body.style.overflow = '';
  }

  window.openCameraModal  = openCameraModal;
  window.closeCameraModal = closeCameraModal;

  // ── Speaker-Modal ─────────────────────────────────
  var _speakerModalId  = null;
  var _speakerPollTimer = null;
  var _speakerPollCount = 0;
  var _speakerPollTrack = '';

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
    function _volChange() {
      setCapability(_speakerModalId, CAP.VOLUME_SET, parseInt(this.value, 10) / 100);
      // Anderen Slider synchron halten
      var other = this.id === 'speaker-vol-slider'
                  ? document.getElementById('speaker-vol-slider-row')
                  : document.getElementById('speaker-vol-slider');
      if (other) { other.value = this.value; other.style.setProperty('--val', this.value + '%'); }
    }
    var volSlider = document.getElementById('speaker-vol-slider');
    volSlider.oninput  = function () { /* thumb position gibt Feedback */ };
    volSlider.onchange = _volChange;
    var volSliderRow = document.getElementById('speaker-vol-slider-row');
    volSliderRow.oninput  = function () { this.style.setProperty('--val', this.value + '%'); };
    volSliderRow.onchange = _volChange;
    _updateSpeakerModal();
    document.getElementById('speaker-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeSpeakerModal() {
    document.getElementById('speaker-modal').style.display = 'none';
    document.body.style.overflow = '';
    var coverImg = document.getElementById('speaker-cover');
    coverImg.src = '';
    coverImg.removeAttribute('data-track');
    coverImg.classList.remove('loaded');
    _stopSpeakerPoll();
    _speakerModalId = null;
  }

  // Nach Next/Prev: alle 1.5 s pollen bis Track wechselt (max. 15 Versuche = ~22 s)
  function _startSpeakerPoll() {
    _stopSpeakerPoll();
    _speakerPollCount = 0;
    var d = devices[_speakerModalId];
    _speakerPollTrack = (d && d.capabilitiesObj && d.capabilitiesObj[CAP.SPEAKER_TRACK]
                         && d.capabilitiesObj[CAP.SPEAKER_TRACK].value) || '';
    _speakerPollTimer = setInterval(function () {
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
    }, 1500);
  }

  function _stopSpeakerPoll() {
    if (_speakerPollTimer) { clearInterval(_speakerPollTimer); _speakerPollTimer = null; }
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
    document.getElementById('speaker-track-name').textContent   = track  || '—';
    document.getElementById('speaker-track-artist').textContent = artist;
    document.getElementById('speaker-track-album').textContent  = album;

    // Cover: nur neu laden wenn sich der Track geändert hat
    var coverImg = document.getElementById('speaker-cover');
    var prevTrack = coverImg.getAttribute('data-track') || '';
    if (track !== prevTrack) {
      coverImg.setAttribute('data-track', track);
      // Sanft ausblenden, dann neues Cover laden
      coverImg.classList.remove('loaded');
      var coverSrc = '/api/camera/' + _speakerModalId + '?t=' + Date.now();
      coverImg.onload  = function () { this.classList.add('loaded'); };
      coverImg.onerror = function () { this.classList.remove('loaded'); };
      // Kurz warten, damit CSS-Transition greift, dann src wechseln
      setTimeout(function () { coverImg.src = coverSrc; }, 150);
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
  }

  function speakerPlayPause() {
    if (!_speakerModalId) return;
    var playing = ((devices[_speakerModalId].capabilitiesObj || {})[CAP.SPEAKER_PLAYING] || {}).value === true;
    setCapability(_speakerModalId, CAP.SPEAKER_PLAYING, !playing);
  }
  function speakerPrev() {
    if (!_speakerModalId) return;
    setCapability(_speakerModalId, CAP.SPEAKER_PREV, true);
    setTimeout(_startSpeakerPoll, 800); // kurz warten bis Sonos reagiert
  }
  function speakerNext() {
    if (!_speakerModalId) return;
    setCapability(_speakerModalId, CAP.SPEAKER_NEXT, true);
    setTimeout(_startSpeakerPoll, 800);
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

  window.openSpeakerModal     = openSpeakerModal;
  window.closeSpeakerModal    = closeSpeakerModal;
  window.speakerPlayPause     = speakerPlayPause;
  window.speakerPrev          = speakerPrev;
  window.speakerNext          = speakerNext;
  window.speakerToggleShuffle = speakerToggleShuffle;
  window.speakerCycleRepeat   = speakerCycleRepeat;
  window.speakerToggleMute    = speakerToggleMute;

})();
