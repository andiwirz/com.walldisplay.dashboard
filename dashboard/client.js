/* Homey Wall Display – Dashboard Client
   Kompatibel mit Android 7 / Chrome 55+ WebView */

(function () {
  'use strict';

  var zones = {};
  var devices = {};
  var eventSource = null;
  var pollTimer = null;

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
    btn.textContent = viewMode === 'zones' ? '⊞ Alle' : '⊟ Räume';
    btn.setAttribute('aria-label', viewMode === 'zones' ? 'Alle Geräte anzeigen' : 'Nach Räumen gruppieren');
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
      container.appendChild(buildZoneSection('Sonstige', noZone));
    }
  }

  function renderAllFlat(container) {
    var allDevices = Object.values(devices).slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    var section = createElement('div', 'zone-section');
    var grid = createElement('div', 'device-grid');
    allDevices.forEach(function (d) { grid.appendChild(buildDeviceCard(d)); });
    section.appendChild(grid);
    container.appendChild(section);
  }

  function buildZoneSection(zoneName, deviceList) {
    var section = createElement('div', 'zone-section');
    var title = createElement('div', 'zone-title');
    title.textContent = zoneName;
    section.appendChild(title);

    var grid = createElement('div', 'device-grid');

    // Geräte sortiert nach Name
    deviceList.sort(function (a, b) { return a.name.localeCompare(b.name); });
    deviceList.forEach(function (d) {
      grid.appendChild(buildDeviceCard(d));
    });

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
              setCapability(deviceId, ac.capId, newVal);
            }
          } else {
            setCapability(deviceId, 'onoff', !(c.onoff && c.onoff.value));
          }
        });
      }(d.id));
    }

    // Header: Icon + Toggle
    var header = createElement('div', 'device-header');
    var icon = createElement('span', 'device-icon');
    icon.textContent = getIcon(d.class);
    header.appendChild(icon);

    if (hasOnOff) {
      var toggle = createElement('button', 'device-toggle');
      if (isOn) toggle.classList.add('on');
      toggle.setAttribute('aria-label', isOn ? 'Ausschalten' : 'Einschalten');
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
          setCapability(deviceId, ac.capId, newVal);
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
        if (ac.isBoolean) return alarmIsArmed(ac.value) ? 'Scharf' : 'Unscharf';
        return ac.value === 'armed' ? 'Scharf' : ac.value === 'partially_armed' ? 'Teilscharf' : 'Unscharf';
      }
    }
    if (caps.measure_temperature && caps.measure_temperature.value !== null && caps.measure_temperature.value !== undefined) {
      return caps.measure_temperature.value.toFixed(1) + ' °C';
    }
    if (caps.measure_power && caps.measure_power.value !== null && caps.measure_power.value !== undefined) {
      return Math.round(caps.measure_power.value) + ' W';
    }
    if (hasOnOff) {
      var isOn = caps.onoff && caps.onoff.value === true;
      if (caps.dim && isOn) {
        return 'An · ' + Math.round((caps.dim.value || 0) * 100) + ' %';
      }
      return isOn ? 'An' : 'Aus';
    }
    if (!d.available) return 'Nicht verfügbar';
    return '';
  }

  function buildValueElements(d) {
    var caps = d.capabilitiesObj || {};
    var container = createElement('div', 'device-values');
    var added = 0;

    // Primärwert: Temperatur
    if (caps.measure_temperature) {
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

    // Heimalarm-Status
    var alarmCapForValues = (d.class === 'homealarm') ? getAlarmCapability(d) : null;
    if (alarmCapForValues) {
      var el = createElement('div', 'device-value alarm-status');
      var armed = alarmIsArmed(alarmCapForValues.value);
      var label;
      if (alarmCapForValues.isBoolean) {
        label = armed ? '🔐 Scharf' : '🔓 Unscharf';
      } else {
        label = alarmCapForValues.value === 'armed' ? '🔐 Scharf' :
                alarmCapForValues.value === 'partially_armed' ? '🔐 Teilscharf' : '🔓 Unscharf';
      }
      el.textContent = label;
      if (armed) el.classList.add('alarm-active');
      container.appendChild(el);
      added++;
    }

    // Bewegungsalarm
    if (caps.alarm_motion) {
      var el = createElement('div', 'device-value');
      var dot = createElement('span', 'alarm-dot');
      if (caps.alarm_motion.value) dot.classList.add('active');
      el.appendChild(dot);
      var txt = document.createTextNode(' Bewegung');
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
      var txt = document.createTextNode(caps.alarm_contact.value ? ' Offen' : ' Geschlossen');
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

    var alarmStatus = card.querySelector('.alarm-status');
    if (alarmStatus && alarmCapUpdate) {
      var label;
      if (alarmCapUpdate.isBoolean) {
        label = isArmed ? '🔐 Scharf' : '🔓 Unscharf';
      } else {
        label = alarmCapUpdate.value === 'armed' ? '🔐 Scharf' :
                alarmCapUpdate.value === 'partially_armed' ? '🔐 Teilscharf' : '🔓 Unscharf';
      }
      alarmStatus.textContent = label;
      if (isArmed) alarmStatus.classList.add('alarm-active');
      else alarmStatus.classList.remove('alarm-active');
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
    var slider = card.querySelector('.dim-slider');
    if (slider && caps.dim) {
      var pct = Math.round((caps.dim.value || 0) * 100);
      slider.value = pct;
      slider.style.setProperty('--val', pct + '%');
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
    initPullToRefresh();
  });

  // 3) Pull-to-Refresh (Wischen nach unten vom oberen Rand)
  function initPullToRefresh() {
    var touchStartY = 0;
    var pulling = false;
    var indicator = null;
    var THRESHOLD = 70; // px zum Auslösen

    function getIndicator() {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'pull-indicator';
        document.body.appendChild(indicator);
      }
      return indicator;
    }

    document.addEventListener('touchstart', function (e) {
      if (window.scrollY === 0) {
        touchStartY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - touchStartY;
      if (dy <= 0) { pulling = false; return; }
      var progress = Math.min(dy / THRESHOLD, 1);
      var ind = getIndicator();
      ind.style.transform = 'translateX(-50%) translateY(' + (Math.min(dy * 0.5, 50)) + 'px)';
      ind.style.opacity = progress;
      ind.textContent = progress >= 1 ? '↻' : '↓';
      ind.className = progress >= 1 ? 'pull-ready' : '';
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      if (!pulling) return;
      pulling = false;
      var dy = e.changedTouches[0].clientY - touchStartY;
      var ind = getIndicator();
      ind.style.transform = 'translateX(-50%) translateY(-40px)';
      ind.style.opacity = '0';
      ind.className = '';
      if (dy >= THRESHOLD) {
        loadData();
        flashRefresh();
      }
    }, { passive: true });
  }

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

})();
