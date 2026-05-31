'use strict';

const Homey = require('homey');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const WebSocket = require('ws');

const DEFAULT_PORT = 7575;

const LOG_BUFFER_SIZE = 200;

class ShellyWallDisplayApp extends Homey.App {

  // ── O(1) ring buffer — no shifting, no splicing ──────────────────────
  _pushLog(level, args) {
    if (!this._logRing) {
      this._logRing  = new Array(LOG_BUFFER_SIZE);
      this._logHead  = 0;   // next write position (mod LOG_BUFFER_SIZE)
      this._logCount = 0;   // how many entries are filled
    }
    let msg = '';
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (i > 0) msg += ' ';
      if (typeof a !== 'object' || a === null) {
        msg += String(a);
      } else {
        try {
          const s = JSON.stringify(a);
          msg += s.length > 150 ? s.slice(0, 150) + '…' : s;
        } catch (_) { msg += '[object]'; }
      }
    }
    this._logRing[this._logHead] = { ts: new Date().toISOString(), level, msg };
    this._logHead = (this._logHead + 1) % LOG_BUFFER_SIZE;
    if (this._logCount < LOG_BUFFER_SIZE) this._logCount++;
  }

  // Returns entries newest-first
  _getLogEntries() {
    if (!this._logRing) return [];
    const out = new Array(this._logCount);
    for (let i = 0; i < this._logCount; i++) {
      // Walk backwards from head
      const idx = (this._logHead - 1 - i + LOG_BUFFER_SIZE) % LOG_BUFFER_SIZE;
      out[i] = this._logRing[idx];
    }
    return out;
  }

  log(...args)   { if (this._debugLogging) this._pushLog('log',   args); super.log(...args);   }
  error(...args) { if (this._debugLogging) this._pushLog('error', args); super.error(...args); }

  async onInit() {
    this.log('Shelly Wall Display App gestartet');
    this.sseClients = new Set();
    // Device-Cache (60 s TTL, sofort invalidiert durch device.update-Events)
    this._deviceCache   = null;
    this._deviceCacheTs = 0;
    // Zones-Cache (5 min TTL — Zonen ändern sich selten)
    this._zonesCache   = null;
    this._zonesCacheTs = 0;
    // Static-File-Cache — Dateien einmal von Disk lesen, dann im Memory halten
    this._staticCache = new Map();
    // SSE-Filter: Vereinigungsmenge aller in irgendeinem Profil sichtbaren Geräte.
    // null = kein Filter (mind. ein Profil zeigt alle Geräte).
    this._relevantDeviceIds = null;
    // Debounce-Timer für Settings-Cache-Updates
    this._flowCacheTimer   = null;
    this._deviceCacheTimer = null;
    // Owner-Token-Cache (5 min TTL — Token ändert sich selten)
    this._ownerToken   = null;
    this._ownerTokenTs = 0;
    // Einmaliger HTTPS-Agent für Flow-Trigger (Connection-Pool-Reuse)
    this._httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });
    // node-fetch einmal laden
    this._nodeFetch = require('node-fetch');

    // Standardwerte für neue Settings vorbelegen, damit Homey.get() nie auf null trifft
    const settingDefaults = {
      accentColor: '#F5A623',
      tileRadius:  'rounded',
      fontSize:    1,
    };
    for (const [key, val] of Object.entries(settingDefaults)) {
      if (this.homey.settings.get(key) == null) {
        this.homey.settings.set(key, val);
      }
    }

    await this._initHomeyApi();

    const port = this.homey.settings.get('port') || DEFAULT_PORT;
    try {
      await this._startServer(port);
    } catch (err) {
      this.error('Server-Start fehlgeschlagen:', err.message);
      return;
    }

    // Load debug-logging flag (default: off)
    this._debugLogging = this.homey.settings.get('debugLogging') === true;

    this.homey.settings.on('set', (key) => {
      if (key === 'port') {
        const newPort = this.homey.settings.get('port') || DEFAULT_PORT;
        this._restartServer(newPort).catch((e) => this.error('Server-Neustart fehlgeschlagen:', e.message));
      }
      if (key === 'debugLogging') {
        this._debugLogging = this.homey.settings.get('debugLogging') === true;
        if (!this._debugLogging) {
          // Clear the buffer immediately when logging is turned off
          this._logRing  = null;
          this._logHead  = 0;
          this._logCount = 0;
        }
      }
      // SSE-Filter neu berechnen wenn sich Profile oder Geräteauswahl ändern (#9)
      if (key === 'displayProfiles' || key === 'defaultProfileDevices' || key === 'enabledDevices') {
        this._buildRelevantDeviceIds();
      }
    });
  }

  async _initHomeyApi() {
    try {
      // Direkt HomeyAPI-Klasse laden (nicht index.js), da index.js HomeyAPIV3
      // eager-loaded, welches socket.io-client benÃ¶tigt â€“ diese Sub-Dependency
      // fehlt im Homey-Runtime-Environment.
      const HomeyAPI = require('homey-api/lib/HomeyAPI/HomeyAPI');
      this.homeyApi = await HomeyAPI.createAppAPI({ homey: this.homey });
      this.homeyBaseUrl = await this.homey.api.getLocalUrl();
      this.log('Homey API verbunden');

      // ── Full device-object changes (name, zone, available …) ────────────────
      // NOTE: device.update fires on EVERY capability change (Homey updates the full
      // device object each time). Broadcasting capabilitiesObj here would duplicate
      // every makeCapabilityInstance event with a much larger JSON payload.
      // → Only broadcast when `available` actually changes; cap-value updates are
      //   already handled by makeCapabilityInstance with a minimal payload.
      this._deviceAvailable = {};   // tracks last known available state per device id
      this.homeyApi.devices.on('device.update', (device) => {
        const prev = this._deviceAvailable[device.id];
        const curr = device.available;
        // Always keep cache current
        // Only update availability — capability values are kept fresh by makeCapabilityInstance.
        // Replacing capabilitiesObj here on every device.update (which fires on every cap change)
        // creates unnecessary object churn with no benefit.
        if (this._deviceCache && this._deviceCache[device.id]) {
          this._deviceCache[device.id].available = curr;
        }
        this._deviceAvailable[device.id] = curr;
        // Only broadcast when availability actually changes (avoids duplicate SSE per cap update)
        if (prev === curr) return;
        if (this._relevantDeviceIds !== null && !this._relevantDeviceIds.has(device.id)) return;
        this._broadcastSSE({ type: 'device.update', device: { id: device.id, available: curr } });
      });

      // SSE-Filter initial befüllen (nach API-Init, damit Settings bereits geladen sind)
      this._buildRelevantDeviceIds();

      // Gerät hinzugefügt/entfernt: Cache invalidieren + Settings mit Debounce aktualisieren
      this.homeyApi.devices.on('device.create', async (device) => {
        this._deviceCache = null;
        this._scheduleDeviceCacheUpdate();
        this._subscribeDeviceCapabilities(device);
      });
      this.homeyApi.devices.on('device.delete', () => {
        this._deviceCache = null;
        this._scheduleDeviceCacheUpdate();
      });

      // ── Per-device capability subscriptions (real-time fast path) ────────────
      // device.on('capability') fires immediately on any value change.
      // Manager-level 'device.capability.update' does NOT exist in homey-api V3.
      this._subscribeAllDeviceCapabilities().catch((e) =>
        this.error('Capability-Subscriptions Fehler:', e.message)
      );

      // Initiales BefÃ¼llen des Caches (ohne await â€” App soll nicht blockieren)
      this._updateDeviceSettingsCache().catch((e) =>
        this.error('Device-Settings-Cache Fehler:', e.message)
      );

      // Flow-Cache befÃ¼llen
      this._updateFlowSettingsCache().catch((e) =>
        this.error('Flow-Settings-Cache Fehler:', e.message)
      );
      // Flow-Cache nur bei strukturellen Änderungen (erstellt/gelöscht) aktualisieren.
      // flow.update wird NICHT abonniert — es feuert bei jeder Ausführung (lastExecuted-Update)
      // und würde bei aktiver Energieautomation dauernd getFlows()+getAdvancedFlows() auslösen.
      try {
        this.homeyApi.flow.on('flow.create', () => this._scheduleFlowCacheUpdate());
        this.homeyApi.flow.on('flow.delete', () => this._scheduleFlowCacheUpdate());
      } catch (_) {}
    } catch (err) {
      this.error('Homey API Fehler:', err.message);
    }
  }

  // Schreibt alle GerÃ¤te + Zonen als kompakte JSON-Arrays in Homey-Settings.
  // Wird bei App-Start, device.create und device.delete aufgerufen.
  async _updateDeviceSettingsCache() {
    if (!this.homeyApi) return;
    const devMap  = await this.homeyApi.devices.getDevices();
    const zoneMap = await this.homeyApi.zones.getZones();
    const devices = Object.values(devMap).map((d) => ({
      id:    d.id,
      name:  d.name,
      zone:  d.zone,
      class: d.virtualClass || d.class,
      icon:  this._buildIconUrl(d.iconOverride || (d.iconObj ? d.iconObj.url : null)),
    }));
    const zones = Object.values(zoneMap).map((z) => ({
      id:     z.id,
      name:   z.name,
      parent: z.parent || null,
    }));
    this.homey.settings.set('cachedDevices', devices);
    this.homey.settings.set('cachedZones',   zones);
    this.log(`Device-Settings-Cache aktualisiert: ${devices.length} GerÃ¤te, ${zones.length} Zonen`);
  }

  // Schreibt alle triggerbaren Flows (Basic + Advanced) in Homey-Settings-Cache.
  // Nur triggerable:true Flows werden gespeichert — reduziert Cache-Grösse und
  // macht das filter() in /api/flows überflüssig.
  // Basic und Advanced Flows werden parallel geladen (Promise.all).
  async _updateFlowSettingsCache() {
    if (!this.homeyApi) return;

    // Ordner-Namen vorab laden für lesbare Anzeige
    let folderMap = {};
    try {
      const folders = await this.homeyApi.flow.getFlowFolders();
      for (const f of Object.values(folders)) folderMap[f.id] = f.name;
    } catch (_) {}

    // Basic und Advanced Flows parallel laden
    const [basicFlows, advFlows] = await Promise.all([
      this.homeyApi.flow.getFlows().catch(() => ({})),
      this.homeyApi.flow.getAdvancedFlows().catch(() => ({})),
    ]);

    const flows = [];
    for (const f of Object.values(basicFlows)) {
      if (f.triggerable === false) continue; // nicht triggerbar → überspringen (D)
      flows.push({
        id:     f.id,
        name:   f.name,
        folder: (f.folder && folderMap[f.folder]) || null,
        type:   'flow',
      });
    }
    for (const f of Object.values(advFlows)) {
      if (f.triggerable === false) continue;
      flows.push({
        id:     f.id,
        name:   f.name,
        folder: (f.folder && folderMap[f.folder]) || null,
        type:   'advancedflow',
      });
    }

    flows.sort((a, b) => a.name.localeCompare(b.name));
    this.homey.settings.set('cachedFlows', flows);
    this.log(`Flow-Settings-Cache aktualisiert: ${flows.length} triggerbare Flows`);
  }

  async _startServer(port) {
    this.server = http.createServer((req, res) => this._handleRequest(req, res));
    await new Promise((resolve, reject) => {
      this.server.listen(port, (err) => {
        if (err) return reject(err);
        resolve();
      });
      this.server.once('error', reject);
    });
    const homeyHost = this._getLanIP() || 'homey.local';
    const url = `http://${homeyHost}:${port}`;
    // WebSocket-Server (HA-Protokoll) auf demselben Port
    this.wss = new WebSocket.Server({ server: this.server });
    this.wss.on('connection', (ws, req) => this._handleWebSocket(ws, req));
    // Globaler SSE-Heartbeat — ein einziger Timer für alle verbundenen Clients
    if (this._sseHeartbeat) clearInterval(this._sseHeartbeat);
    this._sseHeartbeat = setInterval(() => {
      for (const client of this.sseClients) {
        try { client.write(':\n\n'); } catch (_) { this.sseClients.delete(client); }
      }
    }, 25000);
    this.log(`Dashboard lÃ¤uft auf: ${url}`);
    this.homey.settings.set('currentUrl', url);
  }

  async _restartServer(port) {
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
    }
    await this._startServer(port);
  }

  async _handleRequest(req, res) {
    const url = new URL(req.url, 'http://localhost');

    // HA-kompatible Security-Header
    // CORS offen lassen: Homey Settings-Seite wird von my.homey.app geladen und
    // benÃ¶tigt Cross-Origin-Zugriff auf die lokale API. Auf einem lokalen Heimserver
    // ist '*' vertretbar, da der Port nicht aus dem Internet erreichbar ist.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Server', '');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const auth = req.headers['authorization'] ? ' [Bearer]' : '';
    const ua = req.headers['user-agent'] ? ` UA:${req.headers['user-agent'].substring(0, 40)}` : '';
    if (!ShellyWallDisplayApp.SILENT_PATHS.has(url.pathname)) {
      this.log(`${req.method} ${url.pathname}${auth}${ua}`);
    }

    if (url.pathname === '/ping') {
      res.setHeader('Content-Type', 'text/plain');
      res.writeHead(200);
      res.end('pong');
      return;
    }

    if (url.pathname === '/events') {
      return this._handleSSE(req, res);
    }

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
      return this._handleAPI(req, res, url);
    }

    return this._serveStatic(res, url.pathname, req);
  }

  async _handleAPI(req, res, url) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // â”€â”€ Home Assistant KompatibilitÃ¤ts-Endpunkte â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Das Shelly Wall Display prÃ¼ft diese Endpunkte um eine gÃ¼ltige HA-Instanz zu verifizieren.

    if (url.pathname === '/api/' || url.pathname === '/api') {
      res.writeHead(200);
      res.end(JSON.stringify({ message: 'API running.' }));
      return;
    }

    if (url.pathname === '/api/config') {
      res.writeHead(200);
      res.end(JSON.stringify({
        components: [],
        config_dir: '/config',
        elevation: 0,
        latitude: 0,
        longitude: 0,
        location_name: 'Homey',
        time_zone: 'Europe/Amsterdam',
        unit_system: { length: 'km', mass: 'g', temperature: 'Â°C', volume: 'L' },
        version: '2024.1.0',
        state: 'RUNNING',
      }));
      return;
    }

    if (url.pathname === '/api/discovery_info') {
      const port = this.homey.settings.get('port') || DEFAULT_PORT;
      const homeyHost = this._getLanIP() || 'homey.local';
      res.writeHead(200);
      res.end(JSON.stringify({
        base_url: `http://${homeyHost}:${port}`,
        installation_type: 'Home Assistant OS',
        requires_api_password: false,
        uuid: 'homey-shelly-wall-display',
        version: '2024.1.0',
        location_name: 'Homey',
      }));
      return;
    }

    // HA Auth-Endpunkte â€” minimal, damit kein Auth-Fehler erscheint

    // Dieser Endpoint wird vom Shelly Wall Display zur Validierung aufgerufen
    if (url.pathname === '/auth/providers') {
      res.writeHead(200);
      res.end(JSON.stringify({
        providers: [{ name: 'Home Assistant Local', id: null, type: 'homeassistant' }],
        preselect_remember_me: true,
      }));
      return;
    }

    if (url.pathname === '/auth/login_flow' && req.method === 'POST') {
      const flowId = Math.random().toString(36).substring(2);
      res.writeHead(200);
      res.end(JSON.stringify({
        type: 'form',
        flow_id: flowId,
        handler: ['homeassistant', null],
        step_id: 'init',
        data_schema: [
          { name: 'username', type: 'string' },
          { name: 'password', type: 'string', required: true },
        ],
        errors: {},
      }));
      return;
    }

    if (url.pathname.match(/^\/auth\/login_flow\/[^/]+$/) && req.method === 'POST') {
      // Schritt 2: Credentials akzeptieren, Code zurÃ¼ckgeben
      const code = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      res.writeHead(200);
      res.end(JSON.stringify({
        type: 'create_entry',
        result: code,
        title: 'Homey',
      }));
      return;
    }

    if (url.pathname === '/auth/token' && req.method === 'POST') {
      res.writeHead(200);
      res.end(JSON.stringify({
        access_token: 'homey-token',
        expires_in: 1800,
        refresh_token: 'homey-refresh',
        token_type: 'Bearer',
      }));
      return;
    }

    if (url.pathname === '/auth/authorize') {
      // Redirect direkt zum Dashboard
      res.setHeader('Location', '/');
      res.writeHead(302);
      res.end();
      return;
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    if (!this.homeyApi) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: 'Homey API nicht verfÃ¼gbar' }));
      return;
    }

    try {
      // GET /api/settings
      if (url.pathname === '/api/settings' && req.method === 'GET') {
        const energyEnabled = this.homey.settings.get('energyEnabled');
        const tileSize     = this.homey.settings.get('tileSize');

        // Per-Display Flow-Filter: Profil für diese IP suchen
        const settingsClientIp    = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
        const settingsProfiles    = this.homey.settings.get('displayProfiles') || [];
        const settingsProfile     = settingsProfiles.find((p) => p.ip === settingsClientIp);
        const globalEnabledFlows  = this.homey.settings.get('enabledFlows') || null;
        // Profil gefunden → dessen flows verwenden (auch [] = "alle"), sonst globale Einstellung.
        // Wichtig: .length > 0 NICHT prüfen — [] bedeutet "alle Flows", nicht "kein Override".
        const rawEffectiveFlows = settingsProfile
          ? (Array.isArray(settingsProfile.flows) ? settingsProfile.flows : null)
          : globalEnabledFlows;
        // ['__none__'] = explizit keine Flows → leeres Array; Client wertet [] als "keine Flows"
        const effectiveEnabledFlows = Array.isArray(rawEffectiveFlows) && rawEffectiveFlows.includes('__none__')
          ? []
          : rawEffectiveFlows;

        res.writeHead(200);
        res.end(JSON.stringify({
          port: this.homey.settings.get('port') || DEFAULT_PORT,
          enabledDevices: this.homey.settings.get('enabledDevices') || null,
          alarmPin: this.homey.settings.get('alarmPin') || '',
          energyEnabled: energyEnabled === false ? false : true,
          tileSize: (tileSize >= 1 && tileSize <= 5) ? tileSize : 3,
          tileHeight: this.homey.settings.get('tileHeight') || 'auto',
          enabledFlows: effectiveEnabledFlows,
          flowTileWidth: this.homey.settings.get('flowTileWidth') || 'auto',
          flowConfirm: this.homey.settings.get('flowConfirm') === true,
          flowPosition: this.homey.settings.get('flowPosition') || 'top',
          dashboardTitle: this.homey.settings.get('dashboardTitle') || 'My Homey',
          fontSize: this.homey.settings.get('fontSize') || 1,
          accentColor: this.homey.settings.get('accentColor') || '#F5A623',
          tileRadius: this.homey.settings.get('tileRadius') || 'rounded',
          headerHidden: this.homey.settings.get('headerHidden') || false,
          viewDefault: this.homey.settings.get('viewDefault') || 'all',
          viewBtnHidden: this.homey.settings.get('viewBtnHidden') || false,
          zoneOrder: this.homey.settings.get('zoneOrder') || [],
          coverFullscreen: this.homey.settings.get('coverFullscreen') !== false,
          coverFullscreenDelay: this.homey.settings.get('coverFullscreenDelay') || 20,
          evEnabled: this.homey.settings.get('evEnabled') === true,
          evDeviceId: this.homey.settings.get('evDeviceId') || null,
          evCapabilities: this.homey.settings.get('evCapabilities') || [],
        }));
        return;
      }

      // POST /api/settings
      if (url.pathname === '/api/settings' && req.method === 'POST') {
        const body = await this._readBody(req);
        const { key, value } = JSON.parse(body);
        const allowed = ['port', 'enabledDevices', 'alarmPin', 'energyEnabled', 'batteryInvertSign', 'tileSize', 'tileHeight', 'enabledFlows', 'homeyToken', 'flowTileWidth', 'dashboardTitle', 'fontSize', 'accentColor', 'tileRadius', 'headerHidden', 'viewDefault', 'viewBtnHidden', 'zoneOrder', 'coverFullscreen', 'coverFullscreenDelay', 'defaultProfileZones', 'defaultProfileDevices'];
        if (!allowed.includes(key)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Not allowed' }));
          return;
        }
        // #16 Server-seitige Validierung
        if (key === 'port') {
          const p = Number(value);
          if (!Number.isInteger(p) || p < 1024 || p > 65535) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid port (1024â€“65535)' }));
            return;
          }
        }
        if (key === 'alarmPin' && value !== '' && !/^\d{4}$/.test(String(value))) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'PIN must be 4 digits' }));
          return;
        }
        if (key === 'tileSize') {
          const ts = Number(value);
          if (!Number.isInteger(ts) || ts < 1 || ts > 5) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'tileSize must be 1â€“5' }));
            return;
          }
        }
        this.homey.settings.set(key, value);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // GET /api/client-ip — liefert die IP-Adresse des anfragenden Clients
      if (url.pathname === '/api/client-ip' && req.method === 'GET') {
        const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ip }));
        return;
      }

      // GET /api/devices
      if (url.pathname === '/api/devices' && req.method === 'GET') {
        const devices = await this._getDevicesCache(); // #17

        // Per-Display Zonen-Filter: IP des anfragenden Displays mit Profilen abgleichen
        const clientIp        = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
        const displayProfiles  = this.homey.settings.get('displayProfiles') || [];
        const displayProfile   = displayProfiles.find((p) => p.ip === clientIp);
        // Resolve active profile: IP-specific → default → no filter
        const defaultProfileDevices = this.homey.settings.get('defaultProfileDevices');
        const legacyEnabledDevices  = this.homey.settings.get('enabledDevices');
        const defaultDeviceFallback = Array.isArray(defaultProfileDevices) ? defaultProfileDevices
          : (Array.isArray(legacyEnabledDevices) ? legacyEnabledDevices : []);
        // Profil gefunden → dessen devices verwenden (auch [] = "alle"), sonst Default-Fallback.
        // Wichtig: .length > 0 NICHT prüfen — [] bedeutet "alle Geräte", nicht "kein Override".
        const activeDevices = displayProfile
          ? (Array.isArray(displayProfile.devices) ? displayProfile.devices : [])
          : defaultDeviceFallback;
        const noDevices      = activeDevices.includes('__none__');
        const profileDevices = !noDevices && activeDevices.length > 0 ? new Set(activeDevices) : null;

        const result = noDevices ? [] : Object.values(devices)
          .filter((d) => !profileDevices || profileDevices.has(d.id))
          .map((d) => ({
            id: d.id,
            name: d.name,
            zone: d.zone,
            class: d.virtualClass || d.class,
            capabilities: d.capabilities,
            capabilitiesObj: d.capabilitiesObj,
            available: d.available,
            icon: this._buildIconUrl(d.iconOverride || (d.iconObj ? d.iconObj.url : null)),
          }));
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      // GET /api/alldevices â€” ungefiltert, nur fÃ¼r die Settings-Seite
      if (url.pathname === '/api/alldevices' && req.method === 'GET') {
        const devices = await this._getDevicesCache(); // #17
        const result = Object.values(devices).map((d) => ({
          id: d.id,
          name: d.name,
          zone: d.zone,
          class: d.virtualClass || d.class,
          icon: this._buildIconUrl(d.iconOverride || (d.iconObj ? d.iconObj.url : null)),
        }));
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      // GET /api/zones
      if (url.pathname === '/api/zones' && req.method === 'GET') {
        const zones = await this._getZonesCache();
        res.writeHead(200);
        res.end(JSON.stringify(zones));
        return;
      }

      // GET /api/flows â€” alle auslösbaren Flows für das Dashboard (aus Settings-Cache)
      if (url.pathname === '/api/flows' && req.method === 'GET') {
        // cachedFlows enthält bereits nur triggerbare Flows — kein filter() nötig
        const flows = this.homey.settings.get('cachedFlows') || [];
        res.writeHead(200);
        res.end(JSON.stringify(flows));
        return;
      }

      // POST /api/flow/:id/trigger â€” Flow manuell auslösen
      const flowTriggerMatch = url.pathname.match(/^\/api\/flow\/([^/]+)\/trigger$/);
      if (flowTriggerMatch && req.method === 'POST') {
        const flowId = flowTriggerMatch[1];
        let triggered = false;
        let lastError = null;

        // Flow-Typ aus Cache ermitteln (basic flow vs. advanced flow)
        const cachedFlows = this.homey.settings.get('cachedFlows') || [];
        const flowInfo = cachedFlows.find(f => f.id === flowId);
        const flowType = flowInfo ? flowInfo.type : null;
        this.log(`Flow trigger: id=${flowId} type=${flowType || 'unknown'}`);

        // Methode 1: SDK â€” Basic Flow (nur wenn Typ passt oder unbekannt)
        if (!triggered && flowType !== 'advancedflow') {
          try {
            await this.homeyApi.flow.triggerFlow({ id: flowId });
            triggered = true;
            this.log('Flow getriggert via triggerFlow SDK');
          } catch (e) {
            lastError = e.message;
            this.error('triggerFlow SDK Fehler:', e.message);
          }
        }

        // Methode 2: SDK â€” Advanced Flow (nur wenn Typ passt oder Methode 1 fehlschlug)
        if (!triggered && flowType !== 'flow') {
          try {
            await this.homeyApi.flow.triggerAdvancedFlow({ id: flowId });
            triggered = true;
            this.log('Flow getriggert via triggerAdvancedFlow SDK');
          } catch (e) {
            lastError = e.message;
            this.error('triggerAdvancedFlow SDK Fehler:', e.message);
          }
        }

        // Methode 3: Direkte HTTP-Anfrage mit Personal Access Token (PAT)
        // Hintergrund: createAppAPI-Tokens bekommen nie den Scope homey.flow.start
        // (Athom-Einschränkung). Nur ein PAT des Nutzers hat volle Rechte.
        if (!triggered) {
          const pat = this.homey.settings.get('homeyToken') || null;
          if (!pat) {
            lastError = 'Kein Personal Access Token hinterlegt. Bitte in den Einstellungen eintragen.';
            this.error(lastError);
          } else {
            try {
              const endpoints = flowType === 'advancedflow'
                ? [`/api/manager/flow/advancedflow/${flowId}/trigger`]
                : flowType === 'flow'
                  ? [`/api/manager/flow/flow/${flowId}/trigger`]
                  : [`/api/manager/flow/flow/${flowId}/trigger`, `/api/manager/flow/advancedflow/${flowId}/trigger`];

              for (const endpoint of endpoints) {
                if (triggered) break;
                const triggerUrl = `${this.homeyBaseUrl}${endpoint}`;
                this.log('PAT HTTP-Request:', triggerUrl);
                try {
                  const r = await this._nodeFetch(triggerUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
                    body: '{}',
                    agent: triggerUrl.startsWith('https') ? this._httpsAgent : undefined,
                  });
                  if (r.ok || r.status === 204) {
                    triggered = true;
                    this.log(`Flow getriggert via PAT (${r.status})`);
                  } else {
                    const body = await r.text().catch(() => '');
                    lastError = `HTTP ${r.status}: ${body}`;
                    this.error('PAT-Request Fehler:', lastError);
                  }
                } catch (fetchErr) {
                  lastError = fetchErr.message;
                  this.error('PAT fetch Fehler:', fetchErr.message);
                }
              }
            } catch (e) {
              lastError = e.message;
              this.error('PAT-Request Setup Fehler:', e.message);
            }
          }
        }

        if (triggered) {
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(500);
          res.end(JSON.stringify({ error: lastError || 'Flow konnte nicht ausgelöst werden' }));
        }
        return;
      }

      // GET /api/icon-proxy?url=... â€” Homey-Icon mit Auth proxyen
      if (url.pathname === '/api/icon-proxy' && req.method === 'GET') {
        const iconUrl = url.searchParams.get('url');
        // #10 SSRF-Schutz: nur http/https, keine Loopback/Link-Local-Adressen
        let iconParsed;
        try { iconParsed = new URL(iconUrl || ''); } catch (_) { res.writeHead(400); res.end(); return; }
        if (iconParsed.protocol !== 'http:' && iconParsed.protocol !== 'https:') {
          res.writeHead(400); res.end(); return;
        }
        const h = iconParsed.hostname;
        // Nur Cloud-Metadata-Service blockieren (SSRF-Schutz)
        // localhost/127.0.0.1 erlauben: homeyBaseUrl zeigt intern auf 127.0.0.1
        if (h.startsWith('169.254.')) {
          res.writeHead(403); res.end(); return;
        }
        const iconMod = iconParsed.protocol === 'https:' ? require('https') : require('http');
        const token = await this._getOwnerToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        iconMod.get(iconParsed.href, { headers }, (iconRes) => {
          res.setHeader('Content-Type', iconRes.headers['content-type'] || 'image/svg+xml');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          // #10 ETag weiterleiten — ermöglicht 304-Antworten bei unverändertem Icon
          if (iconRes.headers['etag'])          res.setHeader('ETag', iconRes.headers['etag']);
          if (iconRes.headers['last-modified']) res.setHeader('Last-Modified', iconRes.headers['last-modified']);
          res.writeHead(iconRes.statusCode);
          iconRes.pipe(res);
        }).on('error', () => { res.writeHead(502); res.end(); });
        return;
      }

      // GET /api/debug/insights â€” verfÃ¼gbare Insights-Logs fÃ¼r alle Energie-GerÃ¤te
      if (url.pathname === '/api/debug/insights' && req.method === 'GET') {
        const devices = await this._getDevicesCache();
        // Energie-GerÃ¤te finden
        const energyDeviceIds = Object.values(devices)
          .filter((d) => {
            const en = d.energy || {};
            const cls = d.virtualClass || d.class;
            return en.cumulative || en.homeBattery || en.evCharger ||
              cls === 'solarpanel' || cls === 'battery' || cls === 'evcharger';
          })
          .map((d) => d.id);

        const result = {};
        for (const deviceId of energyDeviceIds) {
          const uri = `homey:device:${deviceId}`;
          let logs = [];
          // Methode 1: SDK getLogs mit URI
          try {
            const r = await this.homeyApi.insights.getLogs({ uri });
            if (r && Object.keys(r).length) {
              logs = Object.values(r).map((l) => ({ id: l.id, uri: l.uri, title: l.title, type: l.type, units: l.units }));
            }
          } catch (e) { logs.push({ sdkError: e.message }); }
          // Methode 2: SDK getLogs ohne Filter + manuelles Filtern
          if (!logs.length || logs[0].sdkError) {
            try {
              const all = await this.homeyApi.insights.getLogs();
              const filtered = Object.values(all).filter((l) => l.uri === uri || (l.ownerUri && l.ownerUri === uri));
              logs = filtered.map((l) => ({ id: l.id, uri: l.uri, title: l.title, type: l.type, units: l.units }));
            } catch (e) { logs.push({ sdkError2: e.message }); }
          }
          // Methode 3: HTTP direkt
          const token = await this._getOwnerToken();
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const logsUrl = `${this.homeyBaseUrl}/api/manager/insights/log?uri=homey:device:${deviceId}`;
          const httpLogs = await new Promise((resolve) => {
            const mod = logsUrl.startsWith('https') ? require('https') : require('http');
            const chunks = [];
            mod.get(logsUrl, { headers }, (r) => {
              r.on('data', (c) => chunks.push(c));
              r.on('end', () => {
                try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (_) { resolve(null); }
              });
            }).on('error', () => resolve(null));
          });

          const dev = devices[deviceId];
          result[deviceId] = {
            name:      dev ? dev.name : deviceId,
            class:     dev ? (dev.virtualClass || dev.class) : '?',
            energy:    dev ? dev.energy : {},
            caps:      dev ? Object.keys(dev.capabilitiesObj || {}).filter((c) => c.startsWith('meter_') || c.startsWith('measure_power')) : [],
            sdkLogs:   logs,
            httpLogsUrl: logsUrl,
            httpLogs:  httpLogs,
          };
        }
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // GET /api/debug/images — alle registrierten Homey-Images + camera/speaker device.images
      if (url.pathname === '/api/debug/images' && req.method === 'GET') {
        const allImages = await this.homeyApi.images.getImages();
        const allDevices = await this.homeyApi.devices.getDevices();
        const cameras = Object.values(allDevices)
          .filter(d => (d.virtualClass || d.class) === 'camera')
          .map(d => ({ id: d.id, name: d.name, images: d.images }));
        const speakers = Object.values(allDevices)
          .filter(d => (d.virtualClass || d.class) === 'speaker' || (d.virtualClass || d.class) === 'musicplayer')
          .map(d => ({ id: d.id, name: d.name, class: d.class, virtualClass: d.virtualClass, images: d.images }));
        res.writeHead(200);
        res.end(JSON.stringify({
          images: Object.values(allImages).map(img => ({
            id: img.id, ownerUri: img.ownerUri, url: img.url,
          })),
          cameras,
          speakers,
        }, null, 2));
        return;
      }

      // GET /api/debug/cover/:deviceId — resolve the album art URL for a speaker without fetching it.
      // Useful for troubleshooting: open the returned resolvedUrl directly in the browser.
      const coverDebugMatch = url.pathname.match(/^\/api\/debug\/cover\/([^/]+)$/);
      if (coverDebugMatch && req.method === 'GET') {
        const deviceId = coverDebugMatch[1];
        const isUuid = (s) => typeof s === 'string' && s.length > 20 && s.includes('-');
        const resolveUrl = (raw) => {
          if (!raw) return null;
          if (raw.startsWith('http')) return raw;
          if (raw.startsWith('/'))    return `${this.homeyBaseUrl}${raw}`;
          return null;
        };
        try {
          const cached = this._deviceCache && this._deviceCache[deviceId];
          const device = cached || await this.homeyApi.devices.getDevice({ id: deviceId });
          const imgs   = device ? device.images : null;
          let resolved = null;
          let rawEntry = null;
          if (Array.isArray(imgs)) {
            for (const entry of imgs) {
              if (entry && entry.imageObj && isUuid(entry.imageObj.id)) {
                rawEntry = entry.imageObj;
                resolved = resolveUrl(entry.imageObj.url) || `${this.homeyBaseUrl}/api/image/${entry.imageObj.id}`;
                break;
              }
            }
          }
          const token = await this._getOwnerToken();
          const extBase = this._getExternalBaseUrl(req.socket.localAddress);
          const resolvedExternal = resolved
            ? resolved.replace(this.homeyBaseUrl, extBase)
            : null;
          res.writeHead(200);
          res.end(JSON.stringify({
            deviceId,
            deviceName:   device ? device.name : null,
            homeyBaseUrl: this.homeyBaseUrl,
            rawImageObj:  rawEntry,
            resolvedUrl:  resolvedExternal,
            hasToken:     !!token,
            hint: resolvedExternal
              ? `Open resolvedUrl in browser (append ?authorization=<token> if 401)`
              : 'No image found in device.images',
          }, null, 2));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      // GET /api/debug/logs — in-memory log ring buffer (last 300 entries)
      if (url.pathname === '/api/debug/logs' && req.method === 'GET') {
        const entries = this._getLogEntries();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(entries, null, 2));
        return;
      }

      // GET /api/device/:id/caps — frische Capabilities eines Geräts (kein Cache, für Speaker-Polling)
      const deviceCapsMatch = url.pathname.match(/^\/api\/device\/([^/]+)\/caps$/);
      if (deviceCapsMatch && req.method === 'GET') {
        const deviceId = deviceCapsMatch[1];
        try {
          const device = await this.homeyApi.devices.getDevice({ id: deviceId });
          // Cache-Eintrag dieses Geräts aktualisieren statt gesamten Cache löschen
          if (this._deviceCache && this._deviceCache[device.id]) {
            this._deviceCache[device.id].capabilitiesObj = device.capabilitiesObj || {};
            this._deviceCache[device.id].available       = device.available;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id:              device.id,
            capabilitiesObj: device.capabilitiesObj || {},
          }));
        } catch (e) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      // GET /api/ev — current capability values for the configured EV device
      if (url.pathname === '/api/ev' && req.method === 'GET') {
        const evDeviceId = this.homey.settings.get('evDeviceId');
        if (!evDeviceId) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'no device' }));
          return;
        }
        const devices = await this._getDevicesCache();
        const device  = devices[evDeviceId];
        if (!device) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'device not found' }));
          return;
        }
        const evCaps  = this.homey.settings.get('evCapabilities') || [];
        const capObj  = device.capabilitiesObj || {};
        const caps    = {};
        for (const key of evCaps) {
          if (Object.prototype.hasOwnProperty.call(capObj, key)) {
            const entry = capObj[key];
            // capabilitiesObj entries are objects { value, title, units, … }
            if (entry !== null && typeof entry === 'object') {
              caps[key] = { value: entry.value, title: entry.title || key, units: entry.units || '' };
            } else {
              caps[key] = { value: entry, title: key, units: '' };
            }
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id:        device.id,
          name:      device.name,
          available: device.available,
          caps,
        }));
        return;
      }

      // GET /api/ev-image — serves the uploaded EV car image (stored as base64 in settings)
      if (url.pathname === '/api/ev-image' && req.method === 'GET') {
        const imgData = this.homey.settings.get('evImageData');
        if (!imgData || typeof imgData !== 'string' || !imgData.startsWith('data:')) {
          res.writeHead(404); res.end('no image'); return;
        }
        const match = imgData.match(/^data:([^;]+);base64,(.+)$/s);
        if (!match) { res.writeHead(400); res.end('invalid'); return; }
        const buf = Buffer.from(match[2], 'base64');
        res.writeHead(200, { 'Content-Type': match[1], 'Cache-Control': 'no-cache' });
        res.end(buf);
        return;
      }

      // GET /api/camera/:deviceId — proxy current camera snapshot
      const cameraMatch = url.pathname.match(/^\/api\/camera\/([^/]+)$/);
      if (cameraMatch && req.method === 'GET') {
        const deviceId = cameraMatch[1];

        // Helper: is a string a real UUID (not a slot name like “main”/”snapshot”)
        const isUuid = (s) => typeof s === 'string' && s.length > 20 && s.includes('-');

        let imageId  = null;   // UUID of the image (for constructing the URL)
        let imageUrl = null;   // Resolved absolute URL

        // ── Strategy 1: device.images array ──────────────────────────────────
        // Structure varies by driver:
        //   [{id:”main”, imageObj:{id:”<uuid>”, url:”/api/image/<uuid>”}}]  — most common
        //   [{id:”<uuid>”, url:”...”}]                                       — some drivers
        //   [“<uuid>”]                                                        — plain string
        try {
          // Use in-memory device cache first (avoids fresh API roundtrip on every request)
          const cached = this._deviceCache && this._deviceCache[deviceId];
          const device = cached || await this.homeyApi.devices.getDevice({ id: deviceId });
          const imgs = device.images;
          this.log(`Camera ${deviceId} device.images count: ${Array.isArray(imgs) ? imgs.length : 0}`);

          if (Array.isArray(imgs) && imgs.length > 0) {
            for (const entry of imgs) {
              if (typeof entry === 'string' && isUuid(entry)) {
                imageId  = entry;
                imageUrl = `${this.homeyBaseUrl}/api/image/${entry}`;
                break;
              }
              if (typeof entry === 'object' && entry !== null) {
                // Helper: resolve a relative or absolute image URL against homeyBaseUrl.
                // On Homey 2016 the path is /image/<uuid>/image (not /api/image/<uuid>),
                // so we MUST use imageObj.url when present rather than constructing the URL.
                const resolveUrl = (raw) => {
                  if (!raw) return null;
                  if (raw.startsWith('http')) return raw;
                  if (raw.startsWith('/'))    return `${this.homeyBaseUrl}${raw}`;
                  return null;
                };

                // Priority 1: imageObj present — use its URL directly (preserves /image/<uuid>/image path)
                if (entry.imageObj && isUuid(entry.imageObj.id)) {
                  imageId  = entry.imageObj.id;
                  imageUrl = resolveUrl(entry.imageObj.url)
                          || `${this.homeyBaseUrl}/api/image/${imageId}`;
                  break;
                }
                // Priority 2: entry.id — only if UUID-like (not “main”/”snapshot”)
                if (isUuid(entry.id)) {
                  imageId  = entry.id;
                  imageUrl = resolveUrl(entry.url)
                          || `${this.homeyBaseUrl}/api/image/${imageId}`;
                  break;
                }
                // Priority 3: absolute URL from imageObj or entry
                const directUrl = (entry.imageObj && entry.imageObj.url) || entry.url || '';
                if (directUrl.startsWith('http')) {
                  imageUrl = directUrl;
                  break;
                }
              }
            }
          }
        } catch (e) {
          this.log('Camera device.images error:', e.message);
        }

        // ── Strategy 2: images.getImages() — match by UUID or deviceId ───────
        // Handles cases where ownerUri is an app URI (e.g. UniFi Protect:
        // ownerUri = “homey:app:com.ubnt.unifiprotect”, Sonos album art), not a device URI.
        if (!imageUrl) {
          // Helper: search a flat images object for our device
          const findInImages = (allImages) => Object.values(allImages).find(
            (img) => (imageId && img.id === imageId) ||
                     (img.ownerUri && img.ownerUri.includes(deviceId))
          );

          // Strategy 2a: SDK call (works on Homey ≥ v2)
          let sdkImages = null;
          try {
            sdkImages = await this.homeyApi.images.getImages();
            this.log(`Camera ${deviceId} SDK images: ${Object.keys(sdkImages).length} entries`);
          } catch (e) {
            this.log(`Camera getImages SDK error (${e.message}) — will try REST fallback`);
          }

          if (sdkImages) {
            const found = findInImages(sdkImages);
            if (found) {
              imageId  = found.id;
              imageUrl = `${this.homeyBaseUrl}/api/image/${found.id}`;
              this.log('Camera: found via SDK getImages():', imageUrl);
            }
          }

          // Strategy 2b: Direct REST call — works on early 2016 Homey where the SDK
          // throws “missing_scopes” but the HTTP endpoint is still accessible.
          if (!imageUrl) {
            try {
              const token = await this._getOwnerToken();
              const restRes = await this._nodeFetch(
                `${this.homeyBaseUrl}/api/manager/images/image`,
                {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                  agent:   this.homeyBaseUrl.startsWith('https') ? this._httpsAgent : undefined,
                }
              );
              if (restRes.ok) {
                const restImages = await restRes.json();
                this.log(`Camera ${deviceId} REST images: ${Object.keys(restImages).length} entries`);
                const found = findInImages(restImages);
                if (found) {
                  imageId  = found.id;
                  imageUrl = `${this.homeyBaseUrl}/api/image/${found.id}`;
                  this.log('Camera: found via REST images fallback:', imageUrl);
                }
              } else {
                this.log(`Camera REST images fallback HTTP ${restRes.status}`);
              }
            } catch (e) {
              this.log('Camera REST images fallback error:', e.message);
            }
          }
        }

        if (!imageUrl) {
          this.log(`Camera ${deviceId}: no image found`);
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'No camera image available' }));
          return;
        }

        // ── Fetch the image from Homey ────────────────────────────────────────
        // Uses node-fetch so we can: (a) log the status code for diagnosis,
        // (b) disable TLS verification for self-signed certs on Homey Pro,
        // (c) fall back to query-param auth if Bearer header returns 401/403.
        const token = await this._getOwnerToken();
        this.log(`Camera fetching: ${imageUrl} (token=${token ? 'yes' : 'NO'})`);

        const fetchImage = async (url, useBearer) => {
          const fetchOpts = {
            headers: (useBearer && token) ? { Authorization: `Bearer ${token}` } : {},
            // Reuse the shared HTTPS agent (connection pooling, no TLS cert check)
            agent: url.startsWith('https') ? this._httpsAgent : undefined,
          };
          return this._nodeFetch(url, fetchOpts);
        };

        try {
          let imgRes = await fetchImage(imageUrl, true);
          this.log(`Camera response status: ${imgRes.status} for ${imageUrl}`);

          // If Bearer auth failed, retry with token as query param
          if ((imgRes.status === 401 || imgRes.status === 403) && token) {
            const sep = imageUrl.includes('?') ? '&' : '?';
            const urlWithToken = `${imageUrl}${sep}authorization=${encodeURIComponent(token)}`;
            this.log(`Camera retrying with query-param token: ${urlWithToken}`);
            imgRes = await fetchImage(urlWithToken, false);
            this.log(`Camera retry response status: ${imgRes.status}`);
          }

          if (!imgRes.ok) {
            this.log(`Camera fetch failed with status ${imgRes.status}`);
            res.writeHead(502);
            res.end(JSON.stringify({ error: `Homey returned ${imgRes.status}` }));
            return;
          }

          res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.writeHead(200);
          imgRes.body.pipe(res);
        } catch (e) {
          this.log('Camera fetch error:', e.message);
          res.writeHead(502);
          res.end();
        }
        return;
      }

      // GET /api/debug/energy â€” raw energy device data for classification debugging
      if (url.pathname === '/api/debug/energy' && req.method === 'GET') {
        const devices = await this.homeyApi.devices.getDevices();
        const result = Object.values(devices)
          .filter(d => d.capabilitiesObj && (
            d.capabilitiesObj.measure_power !== undefined ||
            d.capabilitiesObj.meter_power !== undefined ||
            d.capabilitiesObj['meter_power.imported'] !== undefined ||
            d.capabilitiesObj['meter_power.exported'] !== undefined ||
            d.capabilitiesObj.measure_battery !== undefined
          ))
          .map(d => ({
            id: d.id,
            name: d.name,
            class: d.class,
            virtualClass: d.virtualClass,
            energy: d.energy || null,
            capabilities: d.capabilities,
            capValues: Object.fromEntries(
              Object.entries(d.capabilitiesObj || {})
                .filter(([k]) => k.startsWith('measure_') || k.startsWith('meter_') || k.startsWith('ev'))
                .map(([k, v]) => [k, v ? v.value : null])
            ),
          }));
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // GET /api/energy/history?days=7  â€” tÃ¤gliche kWh-Werte aus Homey Insights
      if (url.pathname === '/api/energy/history' && req.method === 'GET') {
        const numDays = Math.min(parseInt(url.searchParams.get('days') || '7', 10), 14);

        // Zeitbereich: einen Tag extra fÃ¼r das Delta des ersten Tages
        const now      = new Date();
        const dateFrom = new Date(now.getTime() - (numDays + 1) * 24 * 60 * 60 * 1000);

        // Alle verfÃ¼gbaren Insights-Log-IDs fÃ¼r ein GerÃ¤t ermitteln.
        // getLogs() gibt ein Objekt zurÃ¼ck, dessen KEYS die vollen kombinierten Strings
        // "homey:device:UUID:capId" sind â€“ daher mÃ¼ssen wir Object.keys() verwenden
        // und das PrÃ¤fix abschneiden, um nur den capId-Teil zu erhalten.
        const getDeviceLogIds = async (deviceId) => {
          const prefix = `homey:device:${deviceId}:`;
          // Methode 1: getLogs mit URI-Filter (gibt ggf. bereits gefiltert zurÃ¼ck)
          try {
            const logs = await this.homeyApi.insights.getLogs({ uri: `homey:device:${deviceId}` });
            if (logs && Object.keys(logs).length) {
              const ids = Object.keys(logs)
                .filter(k => k.startsWith(prefix))
                .map(k => k.slice(prefix.length));
              if (ids.length) {
                this.log(`getDeviceLogIds(${deviceId}) method1: [${ids.join(', ')}]`);
                return new Set(ids);
              }
            }
          } catch (_) {}
          // Methode 2: getLogs ohne Filter, manuell per Key-PrÃ¤fix filtern
          try {
            const all = await this.homeyApi.insights.getLogs();
            const ids = Object.keys(all)
              .filter(k => k.startsWith(prefix))
              .map(k => k.slice(prefix.length));
            this.log(`getDeviceLogIds(${deviceId}) method2: [${ids.join(', ')}]`);
            return new Set(ids);
          } catch (_) {}
          return new Set();
        };

        // Geordnete Kandidatenliste fÃ¼r Grid-Import-Cap aufbauen
        const gridCapCandidates = (caps, en, logIds) => {
          const hints = [
            en.meterPowerImportedCapability,
            'meter_power.imported', 'meter_power.consumed',
            'meter_power.used',     'meter_power',
          ].filter(Boolean);
          const ordered = [];
          // Prio 1: Im GerÃ¤t UND in Insights geloggt
          for (const c of hints) if (caps[c] && logIds.has(c) && !ordered.includes(c)) ordered.push(c);
          // Prio 2: Nur in Insights geloggt
          for (const c of hints) if (logIds.has(c) && !ordered.includes(c)) ordered.push(c);
          // Prio 3: Beliebiges meter_power.* aus Insights
          for (const id of logIds) if (id.startsWith('meter_power') && !ordered.includes(id)) ordered.push(id);
          // Prio 4: Capability-basiert (kein Insights-Nachweis nÃ¶tig â€“ Fallback wenn getLogs fehlschlug)
          for (const c of hints) if (caps[c] && !ordered.includes(c)) ordered.push(c);
          // Prio 5: Letzter Ausweg
          for (const c of hints) if (!ordered.includes(c)) ordered.push(c);
          return ordered;
        };

        // Geordnete Kandidatenliste fÃ¼r Grid-Export-Cap (Netz-Einspeisung) aufbauen
        const gridExportCapCandidates = (caps, en, logIds) => {
          const hints = [
            en.meterPowerExportedCapability,
            'meter_power.exported', 'meter_power.returned',
          ].filter(Boolean);
          const ordered = [];
          for (const c of hints) if (caps[c] && logIds.has(c) && !ordered.includes(c)) ordered.push(c);
          for (const c of hints) if (logIds.has(c) && !ordered.includes(c)) ordered.push(c);
          for (const c of hints) if (caps[c] && !ordered.includes(c)) ordered.push(c);
          return ordered;
        };

        // Geordnete Kandidatenliste fÃ¼r Solar-Export-Cap aufbauen
        const solarCapCandidates = (caps, en, logIds) => {
          const hints = [
            en.meterPowerExportedCapability,
            'meter_power.exported', 'meter_power.produced',
            'meter_power.returned',  'meter_power',
          ].filter(Boolean);
          const ordered = [];
          for (const c of hints) if (caps[c] && logIds.has(c) && !ordered.includes(c)) ordered.push(c);
          for (const c of hints) if (logIds.has(c) && !ordered.includes(c)) ordered.push(c);
          for (const id of logIds) if (id.startsWith('meter_power') && !ordered.includes(id)) ordered.push(id);
          for (const c of hints) if (caps[c] && !ordered.includes(c)) ordered.push(c);
          for (const c of hints) if (!ordered.includes(c)) ordered.push(c);
          return ordered;
        };

        // GerÃ¤te klassifizieren (gleiche Logik wie /api/energy)
        const devicesAll = await this._getDevicesCache();
        const gridDevices  = [];
        const solarDevices = [];

        for (const d of Object.values(devicesAll)) {
          const caps = d.capabilitiesObj || {};
          const en   = d.energy || {};
          if (en.excluded === true) continue;
          const cls         = d.virtualClass || d.class;
          const hasExported = !!(caps['meter_power.exported']);
          const hasImported = !!(
            caps['meter_power.imported'] || caps['meter_power.consumed'] ||
            (caps['meter_power'] && hasExported)
          );
          if (en.cumulative === true || (hasImported && hasExported)) {
            const logIds        = await getDeviceLogIds(d.id);
            const capList       = gridCapCandidates(caps, en, logIds);
            const exportCapList = gridExportCapCandidates(caps, en, logIds);
            gridDevices.push({ id: d.id, capList, exportCapList, logIds: [...logIds] });
          } else if (cls === 'solarpanel' || (en.meterPowerExportedCapability && !en.homeBattery)) {
            const logIds  = await getDeviceLogIds(d.id);
            const capList = solarCapCandidates(caps, en, logIds);
            solarDevices.push({ id: d.id, capList, logIds: [...logIds] });
          }
        }

        // Tag-Buckets aufbauen (Ã¤ltester zuerst)
        const dayBuckets = [];
        for (let i = numDays - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          d.setHours(0, 0, 0, 0);
          dayBuckets.push({ ts: d.getTime(), label: d.toLocaleDateString('en-US', { weekday: 'short' }) });
        }

        // Hilfsfunktion: Insights-Rohdaten per direktem HTTP holen (umgeht SDK-Probleme).
        // Gibt { data, status, bodySnippet } zurÃ¼ck, damit getDailyKwh Debug-Info aufzeichnen kann.
        const getInsightsHttp = async (deviceId, capId, resolution) => {
          const token = await this._getOwnerToken();
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const resParam = resolution ? `?resolution=${resolution}` : '';

          // Vier URL-Formate probieren:
          // Format A: URI URL-encoded + capId als Pfadsegmente (laut Homey REST-API-Docs)
          //   /api/manager/insights/log/homey%3Adevice%3AUUID/capId/entry
          // Format B: URI roh (mit Doppelpunkten) + capId
          //   /api/manager/insights/log/homey:device:UUID/capId/entry
          // Format C: vollstÃ¤ndiger Log-Key URL-encoded als einziges Segment
          //   /api/manager/insights/log/homey%3Adevice%3AUUID%3AcapId/entry
          // Format D: vollstÃ¤ndiger Log-Key roh als einziges Segment
          //   /api/manager/insights/log/homey:device:UUID:capId/entry
          const encodedUri = encodeURIComponent(`homey:device:${deviceId}`);
          const encodedFullId = encodeURIComponent(`homey:device:${deviceId}:${capId}`);
          const urlFormats = [
            `${this.homeyBaseUrl}/api/manager/insights/log/${encodedUri}/${capId}/entry${resParam}`,
            `${this.homeyBaseUrl}/api/manager/insights/log/homey:device:${deviceId}/${capId}/entry${resParam}`,
            `${this.homeyBaseUrl}/api/manager/insights/log/${encodedFullId}/entry${resParam}`,
            `${this.homeyBaseUrl}/api/manager/insights/log/homey:device:${deviceId}:${capId}/entry${resParam}`,
          ];

          const httpGet = (reqUrl) => new Promise((resolve) => {
            const mod = reqUrl.startsWith('https') ? require('https') : require('http');
            mod.get(reqUrl, { headers }, (res) => {
              const raw = [];
              res.on('data', (c) => raw.push(c));
              res.on('end', () => {
                const body = Buffer.concat(raw).toString();
                this.log(`Insights HTTP ${res.statusCode} [${reqUrl.slice(-60)}] body[:150]:`, body.slice(0, 150));
                try {
                  const parsed = JSON.parse(body);
                  const data = Array.isArray(parsed) ? { values: parsed } : parsed;
                  resolve({ data, status: res.statusCode, bodySnippet: body.slice(0, 80) });
                } catch (_) {
                  resolve({ data: null, status: res.statusCode, bodySnippet: body.slice(0, 80) });
                }
              });
            }).on('error', (e) => {
              this.log('Insights HTTP error:', e.message);
              resolve({ data: null, status: 0, bodySnippet: e.message });
            });
          });

          // Alle Formate der Reihe nach probieren, erstes mit Daten gewinnt
          const labels = ['A', 'B', 'C', 'D'];
          const results = [];
          for (let fi = 0; fi < urlFormats.length; fi++) {
            const r = await httpGet(urlFormats[fi]);
            results.push({ label: labels[fi], ...r });
            if (r.data && r.data.values && r.data.values.length > 0) {
              return { ...r, bodySnippet: results.map(x => `${x.label}(${x.status}):${x.bodySnippet}`).join('|') };
            }
            // Sobald ein Format > 404 (z.B. 200 oder 401) zurÃ¼ckgibt, nicht weiter probieren
            if (r.status !== 404 && r.status !== 0) break;
          }
          const best = results.find(r => r.data && r.data.values) || results[0];
          return { ...(best || { data: null, status: 0 }), bodySnippet: results.map(x => `${x.label}(${x.status}):${x.bodySnippet.slice(0,20)}`).join('|') };
        };

        // Hilfsfunktion: tÃ¤gliche kWh â€“ probiert alle capList-Kandidaten der Reihe nach
        const getDailyKwh = async (deviceId, capList) => {
          const dbgLog = [];
          const hasSdk = this.homeyApi.insights &&
            typeof this.homeyApi.insights.getLogEntries === 'function';

          for (const capId of capList) {
            let entries = null;

            // Methode 1: homeyApi.insights SDK.
            // Die API erwartet den vollstÃ¤ndigen Log-Key als "id" â€“
            // NICHT nur den Cap-Namen. Fehlermeldung "Not Found: LogLocal with ID meter_power"
            // tritt auf, wenn nur der kurze Name ohne PrÃ¤fix Ã¼bergeben wird.
            if (hasSdk) {
              // Homey Insights resolution-Strings verwenden camelCase mit GroÃŸbuchstabe:
              // 'last14Days', 'last7Days', 'last31Days' â€“ NICHT 'last14days' (lowercase).
              const fullId = `homey:device:${deviceId}:${capId}`;
              for (const res of ['last14Days', 'last7Days', 'last31Days']) {
                try {
                  const r = await this.homeyApi.insights.getLogEntries({
                    uri: `homey:device:${deviceId}`, id: fullId, resolution: res,
                  });
                  const cnt = r && r.values ? r.values.length : 0;
                  dbgLog.push(`sdk:${capId}:${res}:${cnt}`);
                  if (cnt > 1) { entries = r; break; }
                } catch (e) {
                  // fullId fehlgeschlagen â€“ kurzen Cap-Namen als Fallback probieren
                  try {
                    const r2 = await this.homeyApi.insights.getLogEntries({
                      uri: `homey:device:${deviceId}`, id: capId, resolution: res,
                    });
                    const cnt = r2 && r2.values ? r2.values.length : 0;
                    dbgLog.push(`sdk2:${capId}:${res}:${cnt}`);
                    if (cnt > 1) { entries = r2; break; }
                  } catch (e2) { dbgLog.push(`sdk:${capId}:${res}:err(${e2.message.slice(0,40)})`); }
                }
                if (entries) break;
              }
            }

            // Methode 2: direkter HTTP-Call
            if (!entries || entries.values.length < 2) {
              for (const res of ['last14Days', 'last7Days', '']) {
                const { data: r, status: httpStatus, bodySnippet } = await getInsightsHttp(deviceId, capId, res || null);
                const cnt = r && r.values ? r.values.length : 0;
                dbgLog.push(`http:${capId}:${res||'noRes'}:${cnt}(${httpStatus} ${bodySnippet ? bodySnippet.slice(0,40) : ''})`);
                if (cnt > 1) { entries = r; break; }
              }
            }

            if (!entries || !entries.values || entries.values.length < 2) continue; // nÃ¤chsten Kandidaten probieren

          // Pro Tag: Maximum nehmen (= letzter Wert des Tages bei kumulativem ZÃ¤hler)
          const maxPerDay = {};
          for (const entry of entries.values) {
            if (entry.v === null || entry.v === undefined) continue;
            const dateStr = new Date(entry.t).toLocaleDateString('en-CA'); // YYYY-MM-DD
            if (maxPerDay[dateStr] === undefined || entry.v > maxPerDay[dateStr]) {
              maxPerDay[dateStr] = entry.v;
            }
          }
            this.log('maxPerDay:', JSON.stringify(maxPerDay));

            // Tägliche Deltas berechnen
            const result = [];
            for (let i = 0; i < dayBuckets.length; i++) {
              const dayStr  = new Date(dayBuckets[i].ts).toLocaleDateString('en-CA');
              const prevStr = new Date(dayBuckets[i].ts - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');
              const vEnd    = maxPerDay[dayStr];
              const vStart  = maxPerDay[prevStr];
              if (vEnd !== undefined && vStart !== undefined && vEnd >= vStart) {
                const delta = parseFloat((vEnd - vStart).toFixed(2));
                // Initialisierungs-Artefakt: Insights startete bei 0 obwohl der physische
                // Zähler schon bei einem hohen Wert war → erstes Delta = kumulativer Zählerstand.
                // Erkennbar: vStart < 1 (Insights-Reset) aber delta riesig (> 1000 kWh).
                if (vStart < 1 && delta > 1000) {
                  this.log(`getDailyKwh: Init-Artefakt gefiltert ${dayStr}: vStart=${vStart}, delta=${delta}`);
                  result.push(null);
                } else {
                  result.push(delta);
                }
              } else {
                result.push(null);
              }
            }

            // Ausreisser-Filter: Werte die >100× den Median überschreiten sind
            // wahrscheinlich Mess-Artefakte (Reset, Überlauf o.ä.)
            const nonNull = result.filter(v => v !== null && v > 0);
            if (nonNull.length >= 2) {
              const sorted = [...nonNull].sort((a, b) => a - b);
              const median = sorted[Math.floor(sorted.length / 2)];
              const capVal = Math.max(median * 100, 10000); // 100× Median oder abs. 10 000 kWh
              for (let i = 0; i < result.length; i++) {
                if (result[i] !== null && result[i] > capVal) {
                  this.log(`getDailyKwh: Ausreisser gefiltert Tag ${i}: ${result[i]} > ${capVal} (Median ${median})`);
                  result[i] = null;
                }
              }
            }

            this.log(`getDailyKwh OK: ${deviceId}/${capId}`, dbgLog.join(' '));
            return { data: result, dbg: dbgLog }; // Erster erfolgreicher Kandidat gewinnt
          }

          // Alle Kandidaten fehlgeschlagen
          this.log(`getDailyKwh FAIL: ${deviceId} caps=[${capList.join(',')}]`, dbgLog.join(' '));
          return { data: null, dbg: dbgLog };
        };

        // #7 Aggregieren — alle Geräte parallel abfragen (Promise.all)
        const gridKwh   = new Array(numDays).fill(0);
        const exportKwh = new Array(numDays).fill(0);
        const solarKwh  = new Array(numDays).fill(0);
        let hasData = false;
        const debugLog = [];

        // Aufgaben-Liste aufbauen: [{ type, device }]
        const tasks = [
          ...gridDevices.map((d) => ({ type: 'grid',   device: d, capList: d.capList })),
          ...gridDevices
            .filter((d) => d.exportCapList && d.exportCapList.length)
            .map((d) => ({ type: 'export', device: d, capList: d.exportCapList })),
          ...solarDevices.map((d) => ({ type: 'solar',  device: d, capList: d.capList })),
        ];

        // #B Concurrency-Limit: max. 4 parallele Insights-Queries
        // verhindert Rate-Limiting der Homey Insights-API bei vielen Geräten
        const _pLimit = (n) => {
          let active = 0;
          const queue = [];
          const run = () => {
            while (active < n && queue.length) {
              active++;
              const { fn, resolve, reject } = queue.shift();
              fn().then(resolve, reject).finally(() => { active--; run(); });
            }
          };
          return (fn) => new Promise((resolve, reject) => {
            queue.push({ fn, resolve, reject });
            run();
          });
        };
        const limit = _pLimit(4);

        const taskResults = await Promise.all(
          tasks.map((t) => limit(async () => {
            const result = await getDailyKwh(t.device.id, t.capList);
            return { type: t.type, device: t.device, ...result };
          }))
        );

        for (const r of taskResults) {
          const { type, device, data, dbg } = r;
          if (type === 'grid') {
            debugLog.push({ type: 'grid', capList: device.capList, logIds: device.logIds, dbg });
            if (data) { hasData = true; data.forEach((v, i) => { if (v !== null) gridKwh[i] += v; }); }
          } else if (type === 'export') {
            if (data) { hasData = true; data.forEach((v, i) => { if (v !== null) exportKwh[i] += v; }); }
          } else if (type === 'solar') {
            debugLog.push({ type: 'solar', capList: device.capList, logIds: device.logIds, dbg });
            if (data) { hasData = true; data.forEach((v, i) => { if (v !== null) solarKwh[i] += v; }); }
          }
        }

        const dbgToken = await this._getOwnerToken();
        this.log(`Energy history: ${gridDevices.length} Grid, ${solarDevices.length} Solar, hasData=${hasData}`);
        res.writeHead(200);
        res.end(JSON.stringify({
          labels:   dayBuckets.map((b) => b.label),
          grid:     gridKwh.map((v) => parseFloat(v.toFixed(2))),
          export:   exportKwh.map((v) => parseFloat(v.toFixed(2))),
          solar:    solarKwh.map((v) => parseFloat(v.toFixed(2))),
          numDays,
          hasData,
          _debug: {
            homeyBaseUrl:  this.homeyBaseUrl,
            hasToken:      !!dbgToken,
            gridDevices:  gridDevices.map((d) => ({ id: d.id, capList: d.capList, logIds: d.logIds })),
            solarDevices: solarDevices.map((d) => ({ id: d.id, capList: d.capList, logIds: d.logIds })),
            log: debugLog,
          },
        }));
        return;
      }

      // GET /api/energy
      if (url.pathname === '/api/energy' && req.method === 'GET') {
        const devices = await this._getDevicesCache(); // #17
        const result = [];

        for (const d of Object.values(devices)) {
          const cls  = d.virtualClass || d.class;
          const caps = d.capabilitiesObj || {};
          const en   = d.energy || {};

          // Skip devices excluded from energy reporting (Homey "Exclude from Energy" setting)
          if (en.excluded === true) continue;

          // Detect energy type â€” check class first, then energy config, then capabilities
          // meter_power.exported (not .returned) is specific to real grid/energy meters
          const hasExportedCap = !!(caps['meter_power.exported']);
          const hasImportedCap = !!(caps['meter_power.imported'] || caps['meter_power.consumed']
                                    || (caps['meter_power'] && hasExportedCap));

          let type = null;
          if (cls === 'solarpanel' || en.meterPowerExportedCapability && !en.homeBattery)
            type = 'solar';
          else if (en.homeBattery === true || cls === 'battery')
            type = 'battery';
          else if (en.cumulative === true || (hasImportedCap && hasExportedCap))
            type = 'grid';
          else if (cls === 'evcharger' || en.evCharger === true)
            type = 'ev';
          else if (caps.measure_power !== undefined)
            type = 'consumer';

          if (!type) continue;

          let power = caps.measure_power
            ? Math.round(caps.measure_power.value || 0) : null;
          // Batterie-Vorzeichen invertieren wenn das Gerät positive Werte beim Entladen
          // meldet (z.B. GoodWe SMILE-G3, Fronius Symo Hybrid).
          if (type === 'battery' && power !== null && this.homey.settings.get('batteryInvertSign') === true) {
            power = -power;
          }
          const soc = caps.measure_battery
            ? Math.round(caps.measure_battery.value || 0) : null;

          const impCap = en.meterPowerImportedCapability || 'meter_power.imported';
          const expCap = en.meterPowerExportedCapability || 'meter_power.exported';
          const meterImported = caps[impCap]
            ? parseFloat((caps[impCap].value || 0).toFixed(2))
            : (caps.meter_power ? parseFloat((caps.meter_power.value || 0).toFixed(2)) : null);
          const meterExported = caps[expCap]
            ? parseFloat((caps[expCap].value || 0).toFixed(2)) : null;

          result.push({
            id: d.id, name: d.name, type, power, soc,
            meterImported, meterExported, available: d.available,
            icon: this._buildIconUrl(d.iconOverride || (d.iconObj ? d.iconObj.url : null)),
          });
        }

        const byType = (t) => result.filter((d) => d.type === t);
        const sum    = (arr) => arr.reduce((s, d) => s + (d.power || 0), 0);
        const solarW   = Math.round(sum(byType('solar')));
        const batteryW = Math.round(sum(byType('battery')));
        const gridW    = Math.round(sum(byType('grid')));
        const bats     = byType('battery').filter((d) => d.soc !== null);

        res.writeHead(200);
        res.end(JSON.stringify({
          devices: result,
          summary: {
            solarW,
            batteryW,
            gridW,
            homeW: Math.round(solarW + gridW - batteryW),
            batterySoc: bats.length
              ? Math.round(bats.reduce((s, d) => s + d.soc, 0) / bats.length)
              : null,
          },
        }));
        return;
      }

      // POST /api/device/:id/capability/:cap
      const capMatch = url.pathname.match(/^\/api\/device\/([^/]+)\/capability\/([^/]+)$/);
      if (capMatch && req.method === 'POST') {
        const [, deviceId, capability] = capMatch;
        const body = await this._readBody(req);
        const { value } = JSON.parse(body);
        const device = await this.homeyApi.devices.getDevice({ id: deviceId });
        await device.setCapabilityValue({ capabilityId: capability, value });
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Nicht gefunden' }));
    } catch (err) {
      this.error('API Fehler:', err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  _handleSSE(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.writeHead(200);
    res.write('data: {"type":"connected"}\n\n');
    this.sseClients.add(res);
    req.on('close', () => this.sseClients.delete(res));
  }

  _broadcastSSE(data) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(msg);
      } catch (_) {
        this.sseClients.delete(client);
      }
    }
  }

  _serveStatic(res, pathname, req) {
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    const filePath = path.join(__dirname, 'dashboard', pathname);
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };

    // #6 Cache-Control nach Dateityp:
    // JS/CSS: no-cache (Browser validiert immer via ETag → 304 wenn unverändert,
    //   sofort frisch nach App-Update ohne langen max-age-Stale-Window)
    // Bilder: 24 h (ändern sich praktisch nie)
    const cacheControl = {
      '.html': 'no-cache',
      '.css':  'no-cache',
      '.js':   'no-cache',
      '.png':  'public, max-age=86400',
      '.svg':  'public, max-age=86400',
      '.ico':  'public, max-age=86400',
    };

    const _sendStatic = (data, ct, etag, cc) => {
      // #6 ETag-basierte 304-Antwort
      if (etag && req && req.headers && req.headers['if-none-match'] === etag) {
        res.writeHead(304);
        res.end();
        return;
      }
      res.setHeader('Content-Type', ct);
      if (cc) res.setHeader('Cache-Control', cc);
      if (etag) res.setHeader('ETag', etag);
      res.writeHead(200);
      res.end(data);
    };

    // #H In-Memory-Cache mit mtime-Invalidierung:
    // Beim ersten Treffer wird die Datei-Änderungszeit (mtime) geprüft.
    // Ändert sich die mtime (z.B. nach homey app run hot-reload), wird die
    // gecachte Version verworfen und die Datei neu gelesen.
    if (this._staticCache.has(filePath)) {
      const cached = this._staticCache.get(filePath);
      fs.stat(filePath, (statErr, stat) => {
        if (!statErr && stat && stat.mtimeMs !== cached.mtime) {
          // Datei hat sich verändert → Cache-Eintrag löschen und neu einlesen
          this._staticCache.delete(filePath);
          this._serveStatic(res, pathname, req);
          return;
        }
        const cc = cacheControl[ext] || 'no-cache';
        _sendStatic(cached.data, cached.ct, cached.etag, cc);
      });
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ct   = contentTypes[ext] || 'application/octet-stream';
      const etag = '"' + crypto.createHash('md5').update(data).digest('hex').slice(0, 16) + '"';
      const cc   = cacheControl[ext] || 'no-cache';
      // mtime parallel zur Datei speichern für spätere Invalidierungs-Checks (#H)
      fs.stat(filePath, (sErr, stat) => {
        this._staticCache.set(filePath, { data, ct, etag, mtime: stat ? stat.mtimeMs : 0 });
      });
      _sendStatic(data, ct, etag, cc);
    });
  }

  // #14 Body-Limit (10 KB) verhindert Speicher-DoS durch riesige POST-Bodies
  _readBody(req, maxBytes = 10240) {
    return new Promise((resolve, reject) => {
      let body = '';
      let size = 0;
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          reject(new Error('Request body too large'));
          req.destroy();
          return;
        }
        body += chunk;
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  // â”€â”€ HA WebSocket-Protokoll â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Shelly Wall Display prÃ¼ft /api/websocket mit dem HA Auth-Handshake
  _handleWebSocket(ws, req) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    this.log(`WS connect: ${pathname}`);

    const HA_VERSION = '2024.1.0';

    // Schritt 1: auth_required senden
    ws.send(JSON.stringify({ type: 'auth_required', ha_version: HA_VERSION }));

    let authenticated = false;

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      // WS messages are too frequent to log (fires on every device update)

      // Schritt 2: Auth-Request â†’ immer akzeptieren
      if (msg.type === 'auth') {
        authenticated = true;
        ws.send(JSON.stringify({ type: 'auth_ok', ha_version: HA_VERSION }));
        return;
      }

      if (!authenticated) {
        ws.send(JSON.stringify({ type: 'auth_invalid', message: 'Not authenticated' }));
        return;
      }

      // Alle anderen Commands â†’ generisches OK
      if (msg.id) {
        ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: null }));
      }
    });

    ws.on('error', (err) => this.error('WS error:', err.message));
  }

  // Homey App-API: GET /api/app/com.shellywalldisplay.homey/info
  // Gibt URL, Port, GerÃ¤te und Zonen zurÃ¼ck (alles in einem Call, um Mixed-Content zu vermeiden)
  async onGet(args) {
    // Homey OS kann onGet() ohne Argument aufrufen â†’ safe default
    const { query } = (args || {});
    const port = this.homey.settings.get('port') || DEFAULT_PORT;
    const url = this.homey.settings.get('currentUrl') || null;

    let devices = [];
    let zones = [];
    if (this.homeyApi) {
      try {
        const devMap = await this._getDevicesCache();
        devices = Object.values(devMap).map((d) => ({
          id:   d.id,
          name: d.name,
          zone: d.zone,
          class: d.class,
          icon: this._buildIconUrl(d.iconOverride || (d.iconObj ? d.iconObj.url : null)),
        }));
      } catch (_) {}
      try {
        zones = await this._getZonesCache();
      } catch (_) {}
    }

    const enabledDevices = this.homey.settings.get('enabledDevices') || null;
    return { url, port, devices, zones, enabledDevices };
  }

  async onPost(args) {
    const { body } = (args || {});
    const { key, value } = body || {};
    const allowed = ['port', 'enabledDevices'];
    if (!allowed.includes(key)) throw new Error('Not allowed');
    this.homey.settings.set(key, value);
    return { ok: true };
  }

  // Baut eine absolute Icon-URL aus verschiedenen Homey-Formaten:
  // - Absolute URL ("http...")           â†’ unverÃ¤ndert (via icon-proxy)
  // - Relativer Pfad ("/api/icon/...")   â†’ homeyBaseUrl + Pfad (via icon-proxy)
  // - Interne Icon-Name ("garage-door")  â†’ /device-icons/{name}.svg (eigener Server, kein Proxy)
  // Returns the Homey's LAN IP base URL (e.g. http://192.168.1.10) so that
  // debug URLs can be opened directly from a browser on the same network.
  // Falls back to homeyBaseUrl (127.0.0.1) if no external interface is found.
  _getExternalBaseUrl(reqLocalAddress) {
    // Prefer the IP the client actually connected to (most reliable)
    if (reqLocalAddress && reqLocalAddress !== '127.0.0.1' && reqLocalAddress !== '::1') {
      const clean = reqLocalAddress.replace(/^::ffff:/, '');
      if (clean !== '127.0.0.1') {
        const proto = this.homeyBaseUrl.startsWith('https') ? 'https' : 'http';
        return `${proto}://${clean}`;
      }
    }
    // Fallback: first non-loopback IPv4 interface
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const proto = this.homeyBaseUrl.startsWith('https') ? 'https' : 'http';
          return `${proto}://${iface.address}`;
        }
      }
    }
    return this.homeyBaseUrl;
  }

  _buildIconUrl(iconUrl) {
    if (!iconUrl) return null;
    if (iconUrl.startsWith('http')) return iconUrl;
    if (iconUrl.startsWith('/') && this.homeyBaseUrl) return this.homeyBaseUrl + iconUrl;
    // Interner Homey-Icon-Name â†’ wird vom eigenen Dashboard-Server ausgeliefert
    return `/device-icons/${iconUrl}.svg`;
  }

  // #8 PrÃ¼ft ob ein Origin-Header von einem lokalen Netzwerk stammt
  _isLocalOrigin(origin) {
    try {
      const host = new URL(origin).hostname;
      return host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
        /^10\./.test(host) || /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    } catch (_) { return false; }
  }

  // Device-Cache mit 60 s TTL — wird sofort durch device.update-Events invalidiert.
  // Speichert nur Plain-Objects (nicht die rohen SDK-DeviceInstance-Objekte),
  // um Prototype-Ketten, EventEmitter-Referenzen und internen SDK-State zu vermeiden.
  async _getDevicesCache() {
    const now = Date.now();
    // 5-min TTL — makeCapabilityInstance + device.update keep values fresh in real-time.
    // A full getDevices() refresh is only needed as a safety net for structural changes
    // (capabilities added/removed) that aren't reflected by the live-update path.
    if (this._deviceCache && now - this._deviceCacheTs < 300000) {
      return this._deviceCache;
    }
    const raw = await this.homeyApi.devices.getDevices();
    const devices = {};
    for (const [id, d] of Object.entries(raw)) {
      devices[id] = {
        id:              d.id,
        name:            d.name,
        zone:            d.zone,
        class:           d.class,
        virtualClass:    d.virtualClass || null,
        available:       d.available,
        capabilities:    d.capabilities,
        capabilitiesObj: d.capabilitiesObj,
        energy:          d.energy || null,
        iconOverride:    d.iconOverride || null,
        iconObj:         d.iconObj     || null,
        images:          d.images      || null,
      };
    }
    this._deviceCache   = devices;
    this._deviceCacheTs = now;
    return devices;
  }

  // Zones-Cache mit 30 min TTL — Zonen ändern sich sehr selten. (#11)
  async _getZonesCache() {
    const now = Date.now();
    if (this._zonesCache && now - this._zonesCacheTs < 1800000) {
      return this._zonesCache;
    }
    const raw = await this.homeyApi.zones.getZones();
    this._zonesCache   = Object.values(raw).map((z) => ({
      id:     z.id,
      name:   z.name,
      parent: z.parent || null,
    }));
    this._zonesCacheTs = now;
    return this._zonesCache;
  }

  // Debounce-Wrapper für _updateFlowSettingsCache (5 s).
  // flow.update feuert bei jeder Ausführung → fasst Bursts zu einem einzigen Aufruf zusammen.
  _scheduleFlowCacheUpdate() {
    clearTimeout(this._flowCacheTimer);
    this._flowCacheTimer = setTimeout(
      () => this._updateFlowSettingsCache().catch((e) => this.error('Flow-Cache Fehler:', e.message)),
      5000
    );
  }

  // Debounce-Wrapper für _updateDeviceSettingsCache (3 s).
  // Schützt vor Burst-Fetches beim Pairen mehrerer Geräte gleichzeitig.
  _scheduleDeviceCacheUpdate() {
    clearTimeout(this._deviceCacheTimer);
    this._deviceCacheTimer = setTimeout(
      () => this._updateDeviceSettingsCache().catch((e) => this.error('Device-Cache Fehler:', e.message)),
      3000
    );
  }

  // ── Per-device capability subscriptions ──────────────────────────────────────
  // homey-api V3 does NOT have a manager-level capability-value event.
  // Real-time updates require device.makeCapabilityInstance(capId, cb) which
  // activates the per-device socket subscription (homey:device:<UUID>).
  // Without makeCapabilityInstance the socket namespace is never joined and
  // no capability events arrive — only the 30-second fallback poll would fire.

  _subscribeDeviceCapabilities(device) {
    const caps = Object.keys(device.capabilitiesObj || {});
    if (!this._capDebounceTimers)  this._capDebounceTimers  = {};
    if (!this._capDebouncePayload) this._capDebouncePayload = {};

    for (const capabilityId of caps) {
      try {
        device.makeCapabilityInstance(capabilityId, (value) => {
          const id = device.id;
          // Always patch cache in-place (no debounce needed for cache)
          const cached = this._deviceCache && this._deviceCache[id];
          if (cached && cached.capabilitiesObj && cached.capabilitiesObj[capabilityId]) {
            cached.capabilitiesObj[capabilityId].value = value;
          }
          // SSE filter — skip devices not visible in any profile
          if (this._relevantDeviceIds !== null && !this._relevantDeviceIds.has(id)) return;

          // Accumulate capability changes for this device
          if (!this._capDebouncePayload[id]) this._capDebouncePayload[id] = {};
          this._capDebouncePayload[id][capabilityId] = value;

          // Schedule a single SSE broadcast for this device (debounce 80 ms)
          if (this._capDebounceTimers[id]) return;
          this._capDebounceTimers[id] = setTimeout(() => {
            const updates = this._capDebouncePayload[id];
            delete this._capDebounceTimers[id];
            delete this._capDebouncePayload[id];
            this._broadcastSSE({ type: 'device.capability.update', deviceId: id, updates });
          }, 80);
        });
      } catch (_) {
        // Some capabilities don't support makeCapabilityInstance — skip silently
      }
    }
  }

  async _subscribeAllDeviceCapabilities() {
    if (!this.homeyApi) return;
    const devMap = await this.homeyApi.devices.getDevices();
    let devCount = 0;
    for (const device of Object.values(devMap)) {
      this._subscribeDeviceCapabilities(device);
      devCount++;
    }
    this.log(`Capability subscriptions active for ${devCount} devices`);
  }

  // Berechnet die Vereinigungsmenge aller Geräte die in irgendeinem Profil sichtbar sind.
  // Wird bei App-Start und bei jeder Profil-Änderung aufgerufen.
  // Ergebnis: Set<deviceId> oder null (= kein Filter, alle Geräte relevant).
  _buildRelevantDeviceIds() {
    const defaultDevices = this.homey.settings.get('defaultProfileDevices') || [];
    const profiles       = this.homey.settings.get('displayProfiles')       || [];

    const relevant = new Set();

    // Hilfsfunktion: Geräteliste eines Profils auswerten
    const addDevices = (devs) => {
      if (!Array.isArray(devs) || devs.length === 0) {
        // Leeres Array = kein Filter = alle Geräte → kein SSE-Filtering möglich
        this._relevantDeviceIds = null;
        return false; // Signal: Abbruch, null gesetzt
      }
      if (devs.includes('__none__')) return true; // Profil zeigt nichts → nichts hinzufügen
      for (const id of devs) relevant.add(id);
      return true;
    };

    // Default-Profil
    if (!addDevices(defaultDevices)) return; // null gesetzt → fertig

    // IP-Profile
    for (const profile of profiles) {
      if (!addDevices(profile.devices || [])) return; // null gesetzt → fertig
    }

    this._relevantDeviceIds = relevant;
    this.log(`SSE-Filter: ${relevant.size} relevante Geräte aus ${1 + profiles.length} Profil(en)`);
  }

  // Owner-API-Token mit 5 min TTL cachen — wird an mehreren Stellen benötigt,
  // ändert sich aber selten. Vermeidet wiederholte API-Calls pro Request.
  async _getOwnerToken() {
    const now = Date.now();
    if (this._ownerToken && now - this._ownerTokenTs < 300000) return this._ownerToken;
    this._ownerToken   = await this.homey.api.getOwnerApiToken().catch(() => null);
    this._ownerTokenTs = now;
    return this._ownerToken;
  }

  // Gibt die LAN-IP der Homey zurÃ¼ck (bevorzugt 10.x / 192.168.x, Ã¼berspringt Loopback + Docker)
  _getLanIP() {
    const ifaces = os.networkInterfaces();
    const candidates = [];

    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name]) {
        if (iface.family !== 'IPv4' || iface.internal) continue;
        const ip = iface.address;
        // Bevorzuge typische Heimnetz-Ranges
        if (ip.startsWith('10.') || ip.startsWith('192.168.')) {
          candidates.unshift(ip); // nach vorne
        } else if (!ip.startsWith('172.')) {
          candidates.push(ip);
        }
        // 172.x.x.x (Docker-Bridge) wird Ã¼bersprungen
      }
    }

    return candidates[0] || null;
  }

  // ── Homey Settings-page API (works via cloud relay too) ─────────────
  async onApi(method, endpoint, body) {
    // Normalise: some SDK versions omit the leading slash
    const ep = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    if (method === 'GET') {
      // GET /debug/logs
      if (ep === '/debug/logs') {
        return this._getLogEntries();
      }

      // GET /debug/images
      if (ep === '/debug/images') {
        const allImages  = await this.homeyApi.images.getImages();
        const allDevices = await this.homeyApi.devices.getDevices();
        const cameras = Object.values(allDevices)
          .filter(d => d.class === 'camera' && Array.isArray(d.images) && d.images.length)
          .map(d => ({ id: d.id, name: d.name, images: d.images }));
        const speakers = Object.values(allDevices)
          .filter(d => (d.class === 'speaker' || d.class === 'mediaplayer') && Array.isArray(d.images) && d.images.length)
          .map(d => ({ id: d.id, name: d.name, images: d.images }));
        return { homeyImages: allImages, cameras, speakers };
      }

      // GET /debug/cover/<deviceId>
      const coverMatch = ep.match(/^\/debug\/cover\/([^/]+)$/);
      if (coverMatch) {
        const deviceId = coverMatch[1];
        const isUuid = (s) => typeof s === 'string' && s.length > 20 && s.includes('-');
        const resolveUrl = (raw) => {
          if (!raw) return null;
          if (raw.startsWith('http')) return raw;
          if (raw.startsWith('/'))    return `${this.homeyBaseUrl}${raw}`;
          return null;
        };
        const cached = this._deviceCache && this._deviceCache[deviceId];
        const device = cached || await this.homeyApi.devices.getDevice({ id: deviceId });
        const imgs   = device ? device.images : null;
        let resolved = null;
        let rawEntry = null;
        if (Array.isArray(imgs)) {
          for (const entry of imgs) {
            if (entry && entry.imageObj && isUuid(entry.imageObj.id)) {
              rawEntry = entry.imageObj;
              resolved = resolveUrl(entry.imageObj.url) || `${this.homeyBaseUrl}/api/image/${entry.imageObj.id}`;
              break;
            }
          }
        }
        const token = await this._getOwnerToken();
        const extBase = this._getExternalBaseUrl(null);
        const resolvedExternal = resolved
          ? resolved.replace(this.homeyBaseUrl, extBase)
          : null;
        return {
          deviceId,
          deviceName:   device ? device.name : null,
          homeyBaseUrl: extBase,
          rawImageObj:  rawEntry,
          resolvedUrl:  resolvedExternal,
          hasToken:     !!token,
          hint: resolvedExternal
            ? 'Open resolvedUrl in browser (append ?authorization=<token> if 401)'
            : 'No image found in device.images',
        };
      }
    }
    throw new Error('Not found');
  }

  async onUninit() {
    if (this._sseHeartbeat)   clearInterval(this._sseHeartbeat);
    if (this._flowCacheTimer)   clearTimeout(this._flowCacheTimer);
    if (this._deviceCacheTimer) clearTimeout(this._deviceCacheTimer);
    if (this.wss)    this.wss.close();
    if (this.server) this.server.close();
  }

}

// High-frequency polling paths that should not appear in the debug log buffer
ShellyWallDisplayApp.SILENT_PATHS = new Set([
  '/api/devices', '/api/energy', '/api/zones', '/api/flows',
  '/api/settings', '/api/client-ip', '/ping',
  '/api/debug/logs', '/api/ev', '/api/ev-image',
]);

module.exports = ShellyWallDisplayApp;
