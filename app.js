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
        res.writeHead(200);
        res.end(JSON.stringify({
          port: this.homey.settings.get('port') || DEFAULT_PORT,
          enabledDevices: this.homey.settings.get('enabledDevices') || null,
        }));
        return;
      }

      // POST /api/settings
      if (url.pathname === '/api/settings' && req.method === 'POST') {
        const body = await this._readBody(req);
        const { key, value } = JSON.parse(body);
        const allowed = ['port', 'enabledDevices'];
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
            class: d.class,
            capabilities: d.capabilities,
            capabilitiesObj: d.capabilitiesObj,
            available: d.available,
            icon: d.iconObj ? d.iconObj.url : null,
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
          class: d.class,
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
