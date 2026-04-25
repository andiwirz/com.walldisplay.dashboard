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
    HOMEALARM_STATE: 'homealarm_state',
    HOMEALARM:       'homealarm',
  };

  var zones = {};
  var devices = {};
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

  function openEnergyModal() {
    document.getElementById('energy-modal').style.display = 'flex';
    _fetchEnergy();
    _energyTimer = setInterval(_fetchEnergy, 5000);
  }
  window.openEnergyModal = openEnergyModal;

  function closeEnergyModal() {
    document.getElementById('energy-modal').style.display = 'none';
    if (_energyTimer) { clearInterval(_energyTimer); _energyTimer = null; }
    _lastEnergySummaryKey = null; // #4 Cache zurücksetzen
  }
  window.closeEnergyModal = closeEnergyModal;

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
    document.getElementById('energy-update-time').textContent = ts;

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
    if (btn) btn.textContent = t === 'dark' ? '🌙' : '☀️';
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', theme); } catch (_) {}
    applyTheme(theme);
  }

  applyTheme(theme);
  window.toggleTheme = toggleTheme;

  // ── View-Modus ('zones' | 'all') ───────────────────
  var viewMode = 'zones';
  try { viewMode = localStorage.getItem('viewMode') || 'zones'; } catch (_) {}

  function toggleView() {
    viewMode = viewMode === 'zones' ? 'all' : 'zones';
    try { localStorage.setItem('viewMode', viewMode); } catch (_) {}
    updateViewToggle();
    render();
  }

  function updateViewToggle() {
    var btn = document.getElementById('view-toggle');
    if (!btn) return;
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

  var _drag = null;

  function initDragOnGrid(grid) {
    Array.from(grid.querySelectorAll('.device-card')).forEach(function (card) {
      makeDraggable(card, grid);
    });
  }

  function makeDraggable(card, grid) {
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
      var target = el && el.closest ? el.closest('.device-card') : null;
      Array.from(grid.querySelectorAll('.device-card.drag-over'))
        .forEach(function (c) { c.classList.remove('drag-over'); });
      _drag.over = (target && target !== card) ? target : null;
      if (_drag.over) _drag.over.classList.add('drag-over');
    }

    function onUp() {
      if (!_drag) { clearTimeout(st && st.timer); cleanup(); return; }
      Array.from(grid.querySelectorAll('.device-card.drag-over'))
        .forEach(function (c) { c.classList.remove('drag-over'); });
      if (_drag.over) {
        var cards = Array.from(grid.querySelectorAll('.device-card'));
        var fi = cards.indexOf(card);
        var ti = cards.indexOf(_drag.over);
        if (fi < ti) grid.insertBefore(card, _drag.over.nextSibling);
        else         grid.insertBefore(card, _drag.over);
        saveOrderFromGrid(grid);
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

  // ── Rendern ─────────────────────────────────────────
  function render() {
    updateViewToggle();
    var container = document.getElementById('zones-container');
    container.innerHTML = '';

    if (viewMode === 'all') {
      renderAllFlat(container);
    } else {
      renderByZones(container);
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

    var caps     = d.capabilitiesObj || {};
    var capIds   = d.capabilities || [];
    var hasOnOff = capIds.indexOf(CAP.ONOFF) !== -1;
    var hasAlarm = d.class === 'homealarm' || capIds.indexOf(CAP.HOMEALARM) !== -1;
    var hasDim   = capIds.indexOf(CAP.DIM) !== -1;
    var isOn     = hasOnOff && caps[CAP.ONOFF] && caps[CAP.ONOFF].value === true;
    var alarmCap = hasAlarm ? getAlarmCapability(d) : null;
    var isArmed  = alarmCap ? alarmIsArmed(alarmCap.value) : false;

    if (isOn || isArmed) card.classList.add('on');
    if (caps[CAP.INPUT_EXT_1] && caps[CAP.INPUT_EXT_1].value === true) card.classList.add('open');

    if (d.class === 'camera' || d.class === 'doorbell') {
      card.classList.add('clickable');
      (function (deviceId, deviceName) {
        card.addEventListener('click', function () {
          openCameraModal(deviceId, deviceName);
        });
      }(d.id, d.name));
    }

    if (hasAlarm || (hasOnOff && !hasDim)) {
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

    var header = createElement('div', 'device-header');
    header.appendChild(buildIconElement(d));

    if (hasOnOff) {
      var toggle = createElement('button', 'device-toggle');
      if (isOn) toggle.classList.add('on');
      toggle.setAttribute('aria-label', isOn ? 'Turn off' : 'Turn on');
      toggle.addEventListener('click', function () {
        var newVal = !toggle.classList.contains('on');
        setCapability(d.id, CAP.ONOFF, newVal);
      });
      header.appendChild(toggle);
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
    var caps     = d.capabilitiesObj || {};
    var capIds   = d.capabilities || [];
    var hasOnOff = capIds.indexOf(CAP.ONOFF) !== -1;
    var hasAlarm = d.class === 'homealarm' || capIds.indexOf(CAP.HOMEALARM) !== -1;

    if (hasAlarm) {
      var ac = getAlarmCapability(d);
      if (ac) {
        if (ac.isBoolean) return alarmIsArmed(ac.value) ? 'Armed' : 'Disarmed';
        return ac.value === 'armed' ? 'Armed' : ac.value === 'partially_armed' ? 'Partly armed' : 'Disarmed';
      }
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

    var caps     = d.capabilitiesObj || {};
    var capIds   = d.capabilities || [];
    var hasOnOff = capIds.indexOf(CAP.ONOFF) !== -1;
    var hasAlarm = d.class === 'homealarm' || capIds.indexOf(CAP.HOMEALARM) !== -1;
    var isOn     = hasOnOff && caps[CAP.ONOFF] && caps[CAP.ONOFF].value === true;
    var alarmCapU = hasAlarm ? getAlarmCapability(d) : null;
    var isArmed  = alarmCapU ? alarmIsArmed(alarmCapU.value) : false;

    if (isOn || isArmed) card.classList.add('on');
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
      if (req.status >= 200 && req.status < 300) {
        var data = null;
        try { data = JSON.parse(req.responseText); } catch (_) {}
        callback(null, data);
      } else {
        callback(new Error('HTTP ' + req.status));
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

})();
