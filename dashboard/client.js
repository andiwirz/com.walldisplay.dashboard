/* Homey Wall Display – Dashboard Client
   Kompatibel mit Android 7 / Chrome 55+ WebView */

(function () {
  'use strict';

  var zones = {};
  var devices = {};
  var eventSource = null;
  var pollTimer = null;
  var _alarmPin = '';
  var _pinEntry = '';
  var _pinCallback = null;

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
  }
  window.closeEnergyModal = closeEnergyModal;

  function _fetchEnergy() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/energy', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try { _renderEnergy(JSON.parse(xhr.responseText)); } catch (_) {}
      }
    };
    xhr.send();
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
    if (type === 'solar')    return power > 0  ? ['Generating',   'solar']    : ['Idle', 'idle'];
    if (type === 'battery')  return power < 0  ? ['Discharging',  'discharging'] : (power > 0 ? ['Charging', 'charging'] : ['Idle', 'idle']);
    if (type === 'grid')     return power < 0  ? ['Exporting',    'exporting'] : (power > 0 ? ['Importing', 'importing'] : ['Idle', 'idle']);
    if (type === 'ev')       return power > 0  ? ['Charging',     'charging']  : ['Idle', 'idle'];
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
    var svgH     = hasBattery ? 230 : 155;
    var solarC   = _energyColor('solar',   s.solarW);
    var gridC    = _energyColor('grid',    s.gridW);
    var batC     = _energyColor('battery', s.batteryW);
    var homeC    = '#F5A623';

    // Node rects (x, y, w=130, h=52)
    // Solar: (10,10)  Grid: (180,10)
    // Home: (95,88)   Battery: (95,162) — only if hasBattery
    // Connection points:
    //   Solar bottom-right: ~(90, 62) → Home top-left: ~(125, 88)
    //   Grid  bottom-left:  ~(230,62) → Home top-right: ~(195, 88)
    //   Home bottom-center: (160,140) → Battery top:    (160,162)

    var lineW = function (w) { return Math.max(2, Math.min(7, 2 + Math.abs(w) / 250)); };

    var solarLine = s.solarW > 0
      ? '<line x1="90" y1="62" x2="125" y2="88" stroke="' + solarC + '" stroke-width="' + lineW(s.solarW) + '" class="energy-flow-line"/>'
      : '<line x1="90" y1="62" x2="125" y2="88" stroke="' + solarC + '" stroke-width="2" stroke-dasharray="4 4" opacity="0.4"/>';

    var gridCls  = s.gridW > 0 ? 'energy-flow-line' : (s.gridW < 0 ? 'energy-flow-line-rev' : '');
    var gridDash = s.gridW === 0 ? 'stroke-dasharray="4 4" opacity="0.4"' : '';
    var gridLine = '<line x1="230" y1="62" x2="195" y2="88" stroke="' + gridC + '" stroke-width="' + lineW(s.gridW) + '" ' + (gridCls ? 'class="' + gridCls + '"' : gridDash) + '/>';

    var batLine = '';
    if (hasBattery) {
      var batCls  = s.batteryW > 0 ? 'energy-flow-line' : (s.batteryW < 0 ? 'energy-flow-line-rev' : '');
      var batDash = s.batteryW === 0 ? 'stroke-dasharray="4 4" opacity="0.4"' : '';
      batLine = '<line x1="160" y1="140" x2="160" y2="162" stroke="' + batC + '" stroke-width="' + lineW(s.batteryW) + '" ' + (batCls ? 'class="' + batCls + '"' : batDash) + '/>';
    }

    var node = function (x, y, color, label, value, sub) {
      var bg = color === '#8E8E93' ? 'rgba(142,142,147,0.08)' : color.replace(')', ',0.10)').replace('rgb', 'rgba').replace('#', 'rgba(').replace('rgba(', 'rgba(').replace(/rgba\(([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2}),/, function (m, r, g, b) {
        return 'rgba(' + parseInt(r,16) + ',' + parseInt(g,16) + ',' + parseInt(b,16) + ',';
      });
      // simpler bg calc
      var hex = color;
      var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      var bgFill = 'rgba(' + r + ',' + g + ',' + b + ',0.10)';
      var borderColor = color;
      var out = '';
      out += '<rect x="' + x + '" y="' + y + '" width="130" height="52" rx="10"';
      out += ' fill="' + bgFill + '" stroke="' + borderColor + '" stroke-width="1.5"/>';
      out += '<text x="' + (x+65) + '" y="' + (y+20) + '" text-anchor="middle" font-size="9" fill="' + color + '" opacity="0.8" font-weight="600" letter-spacing="0.5">' + label + '</text>';
      out += '<text x="' + (x+65) + '" y="' + (y+37) + '" text-anchor="middle" font-size="15" font-weight="600" fill="' + color + '">' + value + '</text>';
      if (sub) out += '<text x="' + (x+65) + '" y="' + (y+50) + '" text-anchor="middle" font-size="9" fill="' + color + '" opacity="0.75">' + sub + '</text>';
      return out;
    };

    var gridLabel = s.gridW < 0 ? 'GRID · EXPORT' : 'GRID · IMPORT';
    var batLabel  = s.batteryW < 0 ? 'BATTERY · OUT' : (s.batteryW > 0 ? 'BATTERY · IN' : 'BATTERY');
    var batSub    = s.batterySoc !== null ? s.batterySoc + '% SoC' : null;

    var svg = '<svg class="energy-flow-svg" viewBox="0 0 320 ' + svgH + '" xmlns="http://www.w3.org/2000/svg">';
    svg += solarLine + gridLine + batLine;
    svg += node(10,  10, solarC, 'SOLAR',          _fmtW(s.solarW), null);
    svg += node(180, 10, gridC,  gridLabel,         _fmtW(s.gridW),  null);
    svg += node(85,  88, homeC,  'HOME',            _fmtW(s.homeW),  null);
    if (hasBattery) svg += node(85, 162, batC, batLabel, _fmtW(s.batteryW), batSub);
    svg += '</svg>';
    return svg;
  }

  function _renderEnergy(data) {
    var s       = data.summary;
    var devices = data.devices;
    var hasBat  = devices.some(function (d) { return d.type === 'battery'; });

    // Update timestamp
    var now = new Date();
    var ts  = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');
    document.getElementById('energy-update-time').textContent = ts;

    var html = _renderEnergyFlowSVG(s, hasBat);

    // Device cards — only show energy-relevant types, never generic consumers
    var shown = devices.filter(function (d) {
      return d.type === 'solar' || d.type === 'battery' || d.type === 'grid' || d.type === 'ev';
    });

    if (shown.length === 0) {
      html += '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px 0">No energy devices found.<br>Add solar panels, batteries or power meters in Homey.</p>';
    } else {
      html += '<div class="energy-devices">';
      shown.forEach(function (d) {
        var st    = _energyStatus(d.type, d.power, d.soc);
        var sub    = '';
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
    }

    document.getElementById('energy-body').innerHTML = html;
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

  // Gibt die steuerbare Alarm-Capability zurück oder null.
  // Unterstützt Standard homealarm_state sowie custom boolean Capabilities.
  function getAlarmCapability(d) {
    var caps = d.capabilitiesObj || {};
    if (caps.homealarm_state) return { capId: 'homealarm_state', isBoolean: false, value: caps.homealarm_state.value };
    if (caps.homealarm)       return { capId: 'homealarm',       isBoolean: false, value: caps.homealarm.value };
    // Custom boolean mit setable: true (z.B. Shelly Wall Display Alarm)
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

  // Erzeugt ein Icon-Element: Homey-SVG falls vorhanden, sonst Emoji-Fallback
  function buildIconElement(d) {
    var span = createElement('span', 'device-icon');
    if (d.icon) {
      var img = document.createElement('img');
      img.className = 'device-icon-img';
      img.alt = '';
      // Lokale Pfade (/device-icons/...) direkt laden – kein Proxy nötig
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

  // ── Uhr ────────────────────────────────────────────
  function updateClock() {
    var now = new Date();
    var h = now.getHours().toString().padStart(2, '0');
    var m = now.getMinutes().toString().padStart(2, '0');
    var el = document.getElementById('clock');
    if (el) el.textContent = h + ':' + m;
  }

  setInterval(updateClock, 1000);
  updateClock();

  // ── Daten laden ─────────────────────────────────────
  function loadData() {
    showLoading();

    // Settings laden (PIN + Energy-Sichtbarkeit)
    xhr('GET', '/api/settings', null, function (err, cfg) {
      if (!err && cfg) {
        _alarmPin = cfg.alarmPin || '';
        var btn = document.getElementById('energy-btn');
        if (btn) btn.style.display = cfg.energyEnabled === false ? 'none' : '';
      }
    });

    xhr('GET', '/api/zones', null, function (err, zonesData) {
      if (err) return showError();

      xhr('GET', '/api/devices', null, function (err2, devicesData) {
        if (err2) return showError();

        zones = {};
        zonesData.forEach(function (z) { zones[z.id] = z; });

        devices = {};
        devicesData.forEach(function (d) { devices[d.id] = d; });

        render();
        connectSSE();
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
    // Remove these IDs from _order, then reinsert at their old block position
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
        // Reorder in DOM: move card before or after target
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

    var caps = d.capabilitiesObj || {};
    var hasOnOff = d.capabilities && d.capabilities.indexOf('onoff') !== -1;
    var hasAlarm = d.class === 'homealarm' ||
                  !!(d.capabilities && d.capabilities.indexOf('homealarm') !== -1);
    var hasDim   = d.capabilities && d.capabilities.indexOf('dim') !== -1;
    var isOn = hasOnOff && caps.onoff && caps.onoff.value === true;
    var alarmCap = hasAlarm ? getAlarmCapability(d) : null;
    var isArmed = alarmCap ? alarmIsArmed(alarmCap.value) : false;

    if (isOn || isArmed) card.classList.add('on');

    // Kamera/Doorbell: Karte klickbar → Modal mit Snapshot
    if (d.class === 'camera' || d.class === 'doorbell') {
      card.classList.add('clickable');
      (function (deviceId, deviceName) {
        card.addEventListener('click', function () {
          openCameraModal(deviceId, deviceName);
        });
      }(d.id, d.name));
    }

    // Ganze Karte klickbar für onoff-only (kein Dim) und homealarm
    if (hasAlarm || (hasOnOff && !hasDim)) {
      card.classList.add('clickable');
      (function (deviceId) {
        card.addEventListener('click', function (e) {
          // Toggle-Button selbst löst seinen eigenen Handler aus – nicht doppelt
          if (e.target.classList.contains('device-toggle')) return;
          var d = devices[deviceId];
          if (!d) return;
          var c = d.capabilitiesObj || {};
          if (hasAlarm) {
            var ac = getAlarmCapability(devices[deviceId]);
            if (ac) {
              var newVal = ac.isBoolean ? !alarmIsArmed(ac.value) : (alarmIsArmed(ac.value) ? 'disarmed' : 'armed');
              requirePin(function () { setCapability(deviceId, ac.capId, newVal); });
            }
          } else {
            setCapability(deviceId, 'onoff', !(c.onoff && c.onoff.value));
          }
        });
      }(d.id));
    }

    // Header: Icon + Toggle
    var header = createElement('div', 'device-header');
    header.appendChild(buildIconElement(d));

    if (hasOnOff) {
      var toggle = createElement('button', 'device-toggle');
      if (isOn) toggle.classList.add('on');
      toggle.setAttribute('aria-label', isOn ? 'Turn off' : 'Turn on');
      toggle.addEventListener('click', function () {
        var newVal = !toggle.classList.contains('on');
        setCapability(d.id, 'onoff', newVal);
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

    // Name
    var name = createElement('div', 'device-name');
    name.textContent = d.name;
    card.appendChild(name);

    // Status-Zeile (An/Aus oder Sensorwert)
    var statusEl = createElement('div', 'device-status');
    statusEl.id = 'status-' + d.id;
    statusEl.textContent = buildStatusText(d);
    card.appendChild(statusEl);

    // Werte (Sensor-Details, Slider)
    var values = buildValueElements(d);
    if (values) card.appendChild(values);

    return card;
  }

  // ── Statustext für die Karte ────────────────────
  function buildStatusText(d) {
    var caps = d.capabilitiesObj || {};
    var hasOnOff = d.capabilities && d.capabilities.indexOf('onoff') !== -1;
    var hasAlarm = d.class === 'homealarm' ||
                  !!(d.capabilities && d.capabilities.indexOf('homealarm') !== -1);

    if (hasAlarm) {
      var ac = getAlarmCapability(d);
      if (ac) {
        if (ac.isBoolean) return alarmIsArmed(ac.value) ? 'Armed' : 'Disarmed';
        return ac.value === 'armed' ? 'Armed' : ac.value === 'partially_armed' ? 'Partly armed' : 'Disarmed';
      }
    }
    if (hasOnOff) {
      var isOn = caps.onoff && caps.onoff.value === true;
      if (caps.dim && isOn) {
        return 'On · ' + Math.round((caps.dim.value || 0) * 100) + ' %';
      }
      return isOn ? 'On' : 'Off';
    }
    if (!d.available) return 'Unavailable';
    return '';
  }

  function buildValueElements(d) {
    var caps = d.capabilitiesObj || {};
    var container = createElement('div', 'device-values');
    var added = 0;

    // Primärwert: Temperatur (nicht bei Steckdosen)
    var _noTemp = ['socket', 'light', 'windowcoverings', 'shutterblinds', 'blinds', 'curtain'];
    if (_noTemp.indexOf(d.class) === -1 && caps.measure_temperature) {
      var el = createElement('div', 'device-value primary');
      var val = caps.measure_temperature.value;
      el.innerHTML = (val !== null && val !== undefined ? val.toFixed(1) : '--') +
        '<span class="value-unit"> °C</span>';
      container.appendChild(el);
      added++;
    }

    // Luftfeuchtigkeit
    if (caps.measure_humidity) {
      var el = createElement('div', 'device-value');
      var val = caps.measure_humidity.value;
      el.textContent = '💧 ' + (val !== null && val !== undefined ? Math.round(val) + ' %' : '--');
      container.appendChild(el);
      added++;
    }

    // Leistung
    if (caps.measure_power) {
      var el = createElement('div', 'device-value');
      var val = caps.measure_power.value;
      el.textContent = '⚡ ' + (val !== null && val !== undefined ? Math.round(val) + ' W' : '--');
      container.appendChild(el);
      added++;
    }

    // Helligkeit (Dim-Slider)
    if (caps.dim) {
      var val = caps.dim.value !== null ? caps.dim.value : 0;
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
        setCapability(deviceId, 'dim', newVal);
      });
      slider.addEventListener('input', function () {
        this.style.setProperty('--val', this.value + '%');
      });
      container.appendChild(slider);
      added++;
    }

    // Jalousie/Rollo-Slider (windowcoverings_set: 0=zu, 1=offen)
    if (caps.windowcoverings_set) {
      var val = caps.windowcoverings_set.value !== null ? caps.windowcoverings_set.value : 0;
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
        setCapability(deviceId, 'windowcoverings_set', newVal);
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
    if (caps.alarm_motion) {
      var el = createElement('div', 'device-value');
      var dot = createElement('span', 'alarm-dot');
      if (caps.alarm_motion.value) dot.classList.add('active');
      el.appendChild(dot);
      var txt = document.createTextNode(' Motion');
      el.appendChild(txt);
      container.appendChild(el);
      added++;
    }

    // Kontaktalarm (Türen/Fenster)
    if (caps.alarm_contact) {
      var el = createElement('div', 'device-value');
      var dot = createElement('span', 'alarm-dot');
      if (caps.alarm_contact.value) dot.classList.add('active');
      el.appendChild(dot);
      var txt = document.createTextNode(caps.alarm_contact.value ? ' Open' : ' Closed');
      el.appendChild(txt);
      container.appendChild(el);
      added++;
    }

    // CO2
    if (caps.measure_co2) {
      var el = createElement('div', 'device-value');
      var val = caps.measure_co2.value;
      el.textContent = '💨 ' + (val !== null && val !== undefined ? Math.round(val) + ' ppm' : '--');
      container.appendChild(el);
      added++;
    }

    return added > 0 ? container : null;
  }

  // ── Capability setzen ───────────────────────────────
  function setCapability(deviceId, capability, value) {
    var body = JSON.stringify({ value: value });
    var url = '/api/device/' + deviceId + '/capability/' + capability;

    xhr('POST', url, body, function (err) {
      if (err) {
        console.error('Fehler beim Setzen von ' + capability + ':', err);
      }
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

    var caps = d.capabilitiesObj || {};
    var hasOnOff = d.capabilities && d.capabilities.indexOf('onoff') !== -1;
    var hasAlarm = d.class === 'homealarm' ||
                  !!(d.capabilities && d.capabilities.indexOf('homealarm') !== -1);
    var isOn = hasOnOff && caps.onoff && caps.onoff.value === true;
    var alarmCapUpdate = hasAlarm ? getAlarmCapability(d) : null;
    var isArmed = alarmCapUpdate ? alarmIsArmed(alarmCapUpdate.value) : false;

    if (isOn || isArmed) card.classList.add('on');
    else card.classList.remove('on');

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

    // Status-Zeile
    var statusEl = document.getElementById('status-' + deviceId);
    if (statusEl) statusEl.textContent = buildStatusText(d);

    // Temperatur
    var prim = card.querySelector('.device-value.primary');
    if (prim && caps.measure_temperature) {
      var val = caps.measure_temperature.value;
      prim.innerHTML = (val !== null && val !== undefined ? val.toFixed(1) : '--') +
        '<span class="value-unit"> °C</span>';
    }

    // Dim-Slider
    var sliders = card.querySelectorAll('.dim-slider');
    sliders.forEach(function(slider) {
      if (caps.dim && !caps.windowcoverings_set) {
        var pct = Math.round((caps.dim.value || 0) * 100);
        slider.value = pct;
        slider.style.setProperty('--val', pct + '%');
      }
    });

    // Jalousie-Slider
    if (caps.windowcoverings_set) {
      var wcSlider = card.querySelector('.dim-slider');
      if (wcSlider) {
        var pct = Math.round((caps.windowcoverings_set.value || 0) * 100);
        wcSlider.value = pct;
        wcSlider.style.setProperty('--val', pct + '%');
      }
      var wcLabel = document.getElementById('wc-label-' + deviceId);
      if (wcLabel) {
        wcLabel.textContent = '🪟 ' + Math.round((caps.windowcoverings_set.value || 0) * 100) + ' %';
      }
    }

    // Alarme
    var dots = card.querySelectorAll('.alarm-dot');
    var i = 0;
    if (caps.alarm_motion) {
      if (dots[i]) {
        if (caps.alarm_motion.value) dots[i].classList.add('active');
        else dots[i].classList.remove('active');
      }
      i++;
    }
    if (caps.alarm_contact) {
      if (dots[i]) {
        if (caps.alarm_contact.value) dots[i].classList.add('active');
        else dots[i].classList.remove('active');
      }
    }
  }

  // ── Server-Sent Events ──────────────────────────────
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
      eventSource.close();
      eventSource = null;
      // Fallback: alle 10 Sekunden neu laden
      startPolling();
    };
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      xhr('GET', '/api/devices', null, function (err, devicesData) {
        if (err || !devicesData) return;
        devicesData.forEach(function (d) {
          if (devices[d.id]) {
            devices[d.id].capabilitiesObj = d.capabilitiesObj;
            devices[d.id].available = d.available;
            updateCard(d.id);
          }
        });
      });
    }, 10000);
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

  // ── XHR-Wrapper ─────────────────────────────────────
  function xhr(method, url, body, callback) {
    var req = new XMLHttpRequest();
    req.open(method, url, true);
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
    req.onerror = function () { callback(new Error('Netzwerkfehler')); };
    req.send(body || null);
  }

  // ── Refresh ─────────────────────────────────────────

  // 1) Auto-Refresh alle 5 Minuten (Sicherheitsnetz)
  setInterval(loadData, 5 * 60 * 1000);

  // 2) Tap auf Logo/Header-Titel → Refresh
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

  // Globale Funktion für den "Erneut versuchen"-Button
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
      var inner = document.querySelector('.pin-modal-inner');
      inner.classList.remove('shake');
      void inner.offsetWidth; // reflow
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

  // ── Kamera-Modal ────────────────────────────────────
  var _cameraRefreshTimer = null;

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
      img.src = '/api/camera/' + deviceId + '?t=' + Date.now();
    }

    img.onerror = function () {
      img.style.display = 'none';
      err.style.display = 'flex';
    };

    refresh();
    clearInterval(_cameraRefreshTimer);
    _cameraRefreshTimer = setInterval(refresh, 3000);
  }

  function closeCameraModal() {
    clearInterval(_cameraRefreshTimer);
    _cameraRefreshTimer = null;
    var modal = document.getElementById('camera-modal');
    modal.style.display = 'none';
    document.getElementById('camera-modal-img').src = '';
    document.body.style.overflow = '';
  }

  window.openCameraModal  = openCameraModal;
  window.closeCameraModal = closeCameraModal;


})();
