'use strict';

// ── Homey Settings-page API ───────────────────────────────────────────────────
// Called via Homey.api(method, path, body, callback) from settings/index.html.
// Naming convention: method + PascalCase(path) → e.g. GET /debug/logs → getDebugLogs
//
// homey.app exposes: _getLogEntries(), homeyApi, _deviceCache,
//                    _getOwnerToken(), _getExternalBaseUrl(), homeyBaseUrl
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {

  // ── GET /debug/logs ─────────────────────────────────────────────────────────
  async getDebugLogs({ homey }) {
    return homey.app._getLogEntries();
  },

  // ── GET /debug/images ────────────────────────────────────────────────────────
  async getDebugImages({ homey }) {
    const app = homey.app;
    const allImages  = await app.homeyApi.images.getImages();
    const allDevices = await app.homeyApi.devices.getDevices();
    const cameras = Object.values(allDevices)
      .filter(d => d.class === 'camera' && Array.isArray(d.images) && d.images.length)
      .map(d => ({ id: d.id, name: d.name, images: d.images }));
    const speakers = Object.values(allDevices)
      .filter(d => (d.class === 'speaker' || d.class === 'mediaplayer') && Array.isArray(d.images) && d.images.length)
      .map(d => ({ id: d.id, name: d.name, images: d.images }));
    return { homeyImages: allImages, cameras, speakers };
  },

  // ── POST /debug/cover  (body: { deviceId }) ──────────────────────────────────
  async postDebugCover({ homey, body }) {
    const app = homey.app;
    const { deviceId } = body || {};
    if (!deviceId) return { error: 'Missing deviceId' };

    const isUuid = (s) => typeof s === 'string' && s.length > 20 && s.includes('-');
    const resolveUrl = (raw) => {
      if (!raw) return null;
      if (raw.startsWith('http')) return raw;
      if (raw.startsWith('/'))    return `${app.homeyBaseUrl}${raw}`;
      return null;
    };

    const cached = app._deviceCache && app._deviceCache[deviceId];
    const device = cached || await app.homeyApi.devices.getDevice({ id: deviceId });
    const imgs   = device ? device.images : null;
    let resolved = null;
    let rawEntry = null;

    if (Array.isArray(imgs)) {
      for (const entry of imgs) {
        if (entry && entry.imageObj && isUuid(entry.imageObj.id)) {
          rawEntry = entry.imageObj;
          resolved = resolveUrl(entry.imageObj.url) || `${app.homeyBaseUrl}/api/image/${entry.imageObj.id}`;
          break;
        }
      }
    }

    const token    = await app._getOwnerToken();
    const extBase  = app._getExternalBaseUrl(null);
    const resolvedExternal = resolved
      ? resolved.replace(app.homeyBaseUrl, extBase)
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
  },

};
