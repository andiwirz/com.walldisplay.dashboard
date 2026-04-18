'use strict';

const Homey = require('homey');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const DEFAULT_PORT = 7575;

class ShellyWallDisplayApp extends Homey.App {

  async onInit() {
    this.log('Shelly Wall Display App gestartet');
    this.sseClients = new Set();

    await this._initHomeyApi();

    const port = this.homey.settings.get('port') || DEFAULT_PORT;
    try {
      await this._startServer(port);
    } catch (err) {
      this.error('Server-Start fehlgeschlagen:', err.message);
      return;
    }

    this.homey.settings.on('set', (key) => {
      if (key === 'port') {
        const newPort = this.homey.settings.get('port') || DEFAULT_PORT;
        this._restartServer(newPort).catch((e) => this.error('Server-Neustart fehlgeschlagen:', e.message));
      }
    });
  }

  async _initHomeyApi() {
    try {
      // Direkt HomeyAPI-Klasse laden (nicht index.js), da index.js HomeyAPIV3
      // eager-loaded, welches socket.io-client benötigt – diese Sub-Dependency
      // fehlt im Homey-Runtime-Environment.
      const HomeyAPI = require('homey-api/lib/HomeyAPI/HomeyAPI');
      this.homeyApi = await HomeyAPI.createAppAPI({ homey: this.homey });
      this.homeyBaseUrl = await this.homey.api.getLocalUrl();
      this.log('Homey API verbunden');

      this.homeyApi.devices.on('device.update', (device) => {
        this._broadcastSSE({
          type: 'device.update',
          device: {
            id: device.id,
            available: device.available,
            capabilitiesObj: device.capabilitiesObj,
          },
        });
      });
    } catch (err) {
      this.error('Homey API Fehler:', err.message);
    }
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
    this.log(`Dashboard läuft auf: ${url}`);
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
    this.log(`${req.method} ${url.pathname}${auth}${ua}`);

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

    return this._serveStatic(res, url.pathname);
  }

  async _handleAPI(req, res, url) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // ── Home Assistant Kompatibilitäts-Endpunkte ──────────────────────────────
    // Das Shelly Wall Display prüft diese Endpunkte um eine gültige HA-Instanz zu verifizieren.

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
        unit_system: { length: 'km', mass: 'g', temperature: '°C', volume: 'L' },
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

    // HA Auth-Endpunkte — minimal, damit kein Auth-Fehler erscheint

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
      // Schritt 2: Credentials akzeptieren, Code zurückgeben
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
    // ─────────────────────────────────────────────────────────────────────────

    if (!this.homeyApi) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: 'Homey API nicht verfügbar' }));
      return;
    }

    try {
      // GET /api/settings
      if (url.pathname === '/api/settings' && req.method === 'GET') {
        const energyEnabled = this.homey.settings.get('energyEnabled');
        res.writeHead(200);
        res.end(JSON.stringify({
          port: this.homey.settings.get('port') || DEFAULT_PORT,
          enabledDevices: this.homey.settings.get('enabledDevices') || null,
          alarmPin: this.homey.settings.get('alarmPin') || '',
          energyEnabled: energyEnabled === false ? false : true,
        }));
        return;
      }

      // POST /api/settings
      if (url.pathname === '/api/settings' && req.method === 'POST') {
        const body = await this._readBody(req);
        const { key, value } = JSON.parse(body);
        const allowed = ['port', 'enabledDevices', 'alarmPin', 'energyEnabled'];
        if (!allowed.includes(key)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Not allowed' }));
          return;
        }
        this.homey.settings.set(key, value);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // GET /api/devices
      if (url.pathname === '/api/devices' && req.method === 'GET') {
        const devices = await this.homeyApi.devices.getDevices();
        const enabledDevices = this.homey.settings.get('enabledDevices'); // string[] | null
        const result = Object.values(devices)
          .filter((d) => !Array.isArray(enabledDevices) || enabledDevices.includes(d.id))
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

      // GET /api/alldevices — ungefiltert, nur für die Settings-Seite
      if (url.pathname === '/api/alldevices' && req.method === 'GET') {
        const devices = await this.homeyApi.devices.getDevices();
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
        const zones = await this.homeyApi.zones.getZones();
        res.writeHead(200);
        res.end(JSON.stringify(Object.values(zones)));
        return;
      }

      // GET /api/icon-proxy?url=... — Homey-Icon mit Auth proxyen
      if (url.pathname === '/api/icon-proxy' && req.method === 'GET') {
        const iconUrl = url.searchParams.get('url');
        if (!iconUrl || !iconUrl.startsWith('http')) {
          res.writeHead(400); res.end(); return;
        }
        const iconMod = iconUrl.startsWith('https') ? require('https') : require('http');
        const token = await this.homey.api.getOwnerApiToken().catch(() => null);
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        iconMod.get(iconUrl, { headers }, (iconRes) => {
          res.setHeader('Content-Type', iconRes.headers['content-type'] || 'image/svg+xml');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.writeHead(iconRes.statusCode);
          iconRes.pipe(res);
        }).on('error', () => { res.writeHead(502); res.end(); });
        return;
      }

      // GET /api/debug/images — alle registrierten Homey-Images + camera device.images
      if (url.pathname === '/api/debug/images' && req.method === 'GET') {
        const allImages = await this.homeyApi.images.getImages();
        const allDevices = await this.homeyApi.devices.getDevices();
        const cameras = Object.values(allDevices)
          .filter(d => (d.virtualClass || d.class) === 'camera')
          .map(d => ({ id: d.id, name: d.name, images: d.images }));
        res.writeHead(200);
        res.end(JSON.stringify({
          images: Object.values(allImages).map(img => ({
            id: img.id, ownerUri: img.ownerUri, url: img.url,
          })),
          cameras,
        }, null, 2));
        return;
      }

      // GET /api/camera/:deviceId — aktuelles Kamerabild (Snapshot) proxyen
      const cameraMatch = url.pathname.match(/^\/api\/camera\/([^/]+)$/);
      if (cameraMatch && req.method === 'GET') {
        const deviceId = cameraMatch[1];
        // Image-ID direkt aus der device.images-Property lesen.
        // device.images ist ein Array von Image-Objekten mit {id, ownerUri, url, ...}.
        // Der ownerUri zeigt auf die App (nicht das Gerät), daher können wir nicht
        // über images.getImages() filtern — stattdessen das Gerät direkt abfragen.
        let imageId = null;
        try {
          const device = await this.homeyApi.devices.getDevice({ id: deviceId });
          const imgs = device.images;
          if (Array.isArray(imgs) && imgs.length > 0) {
            const first = imgs[0];
            if (typeof first === 'object' && first !== null) {
              // imageObj.id ist die echte UUID; first.id ist nur der Slot-Name ("main")
              imageId = (first.imageObj && first.imageObj.id) ? first.imageObj.id : first.id;
            } else {
              imageId = first;
            }
          }
        } catch (e) {
          this.log('Camera device error:', e.message);
        }
        if (!imageId) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Keine Kamerabilder verfügbar' }));
          return;
        }
        const token = await this.homey.api.getOwnerApiToken().catch(() => null);
        const imageUrl = `${this.homeyBaseUrl}/api/image/${imageId}`;
        const imgMod = imageUrl.startsWith('https') ? require('https') : require('http');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        imgMod.get(imageUrl, { headers }, (imgRes) => {
          res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.writeHead(imgRes.statusCode);
          imgRes.pipe(res);
        }).on('error', () => { res.writeHead(502); res.end(); });
        return;
      }

      // GET /api/debug/energy — raw energy device data for classification debugging
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

      // GET /api/energy
      if (url.pathname === '/api/energy' && req.method === 'GET') {
        const devices = await this.homeyApi.devices.getDevices();
        const result = [];

        for (const d of Object.values(devices)) {
          const cls  = d.virtualClass || d.class;
          const caps = d.capabilitiesObj || {};
          const en   = d.energy || {};

          // Skip devices excluded from energy reporting (Homey "Exclude from Energy" setting)
          if (en.excluded === true) continue;

          // Detect energy type — check class first, then energy config, then capabilities
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

          const power = caps.measure_power
            ? Math.round(caps.measure_power.value || 0) : null;
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

    const heartbeat = setInterval(() => {
      res.write(':\n\n'); // SSE-Kommentar als Heartbeat
    }, 25000);

    this.sseClients.add(res);
    req.on('close', () => {
      clearInterval(heartbeat);
      this.sseClients.delete(res);
    });
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

  _serveStatic(res, pathname) {
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

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
      res.writeHead(200);
      res.end(data);
    });
  }

  _readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  // ── HA WebSocket-Protokoll ────────────────────────────────────────────────
  // Shelly Wall Display prüft /api/websocket mit dem HA Auth-Handshake
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

      this.log(`WS msg: ${msg.type}`);

      // Schritt 2: Auth-Request → immer akzeptieren
      if (msg.type === 'auth') {
        authenticated = true;
        ws.send(JSON.stringify({ type: 'auth_ok', ha_version: HA_VERSION }));
        return;
      }

      if (!authenticated) {
        ws.send(JSON.stringify({ type: 'auth_invalid', message: 'Not authenticated' }));
        return;
      }

      // Alle anderen Commands → generisches OK
      if (msg.id) {
        ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: null }));
      }
    });

    ws.on('error', (err) => this.error('WS error:', err.message));
  }

  // Homey App-API: GET /api/app/com.shellywalldisplay.homey/info
  // Gibt URL, Port, Geräte und Zonen zurück (alles in einem Call, um Mixed-Content zu vermeiden)
  async onGet(args) {
    // Homey OS kann onGet() ohne Argument aufrufen → safe default
    const { query } = (args || {});
    const port = this.homey.settings.get('port') || DEFAULT_PORT;
    const url = this.homey.settings.get('currentUrl') || null;

    let devices = [];
    let zones = [];
    if (this.homeyApi) {
      try {
        const devMap = await this.homeyApi.devices.getDevices();
        devices = Object.values(devMap).map((d) => ({
          id: d.id,
          name: d.name,
          zone: d.zone,
          class: d.class,
        }));
      } catch (_) {}
      try {
        const zoneMap = await this.homeyApi.zones.getZones();
        zones = Object.values(zoneMap).map((z) => ({
          id: z.id,
          name: z.name,
          parent: z.parent || null,
        }));
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
  // - Absolute URL ("http...")           → unverändert (via icon-proxy)
  // - Relativer Pfad ("/api/icon/...")   → homeyBaseUrl + Pfad (via icon-proxy)
  // - Interne Icon-Name ("garage-door")  → /device-icons/{name}.svg (eigener Server, kein Proxy)
  _buildIconUrl(iconUrl) {
    if (!iconUrl) return null;
    if (iconUrl.startsWith('http')) return iconUrl;
    if (iconUrl.startsWith('/') && this.homeyBaseUrl) return this.homeyBaseUrl + iconUrl;
    // Interner Homey-Icon-Name → wird vom eigenen Dashboard-Server ausgeliefert
    return `/device-icons/${iconUrl}.svg`;
  }

  // Gibt die LAN-IP der Homey zurück (bevorzugt 10.x / 192.168.x, überspringt Loopback + Docker)
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
        // 172.x.x.x (Docker-Bridge) wird übersprungen
      }
    }

    return candidates[0] || null;
  }

  async onUninit() {
    if (this.wss) this.wss.close();
    if (this.server) this.server.close();
  }

}

module.exports = ShellyWallDisplayApp;
