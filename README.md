# Wall Display Dashboard for Homey

A [Homey](https://homey.app) app that turns a **Shelly Wall Display** (or any compatible touchscreen device) into a smart home control panel — powered by your Homey devices.

The app runs a local HTTP/WebSocket server on your Homey that emulates the Home Assistant API. The Shelly Wall Display connects to it as if it were a Home Assistant instance, while the actual device data and control come entirely from Homey.

---

## Features

- **Live dashboard** — displays all your Homey devices on the touchscreen with real-time state updates via Server-Sent Events (SSE)
- **Device control** — toggle lights, sockets, locks, fans, blinds, heaters, TVs, and more directly from the wall
- **Dimmer support** — adjust brightness or position with a slider for dimmable lights and covers
- **Alarm control** — arm, disarm, or partially arm your home alarm; view motion and contact alerts
- **PIN protection** — optional 4-digit PIN for the home alarm, configurable in the settings page
- **Camera & doorbell images** — tap a camera or doorbell tile to view the latest snapshot
- **Sensor readings** — temperature, humidity, CO₂, power consumption, and more shown inline
- **Room grouping** — devices organized by Homey zones with a toggle to view all devices flat
- **Device filtering** — choose exactly which devices appear on the display via the settings page
- **Custom device icons** — respects user-set custom icons from the Homey app; 226 named icons served locally
- **Drag & drop reordering** — long-press a tile to drag it to a new position; order is saved across reloads
- **Dark / light mode** — toggle between themes via the header button; preference is saved in localStorage
- **Auto-refresh** — SSE stream for instant updates, fallback polling every 10 seconds, full refresh every 5 minutes

---

## How It Works

```
Shelly Wall Display
        │
        │  HTTP + WebSocket (Home Assistant protocol)
        ▼
Homey App (com.walldisplay.dashboard)
        │
        │  Homey Web API
        ▼
   Your Homey Devices
```

1. The Homey app starts an HTTP/WebSocket server (default port **7575**) on your local network.
2. The Shelly Wall Display is configured to connect to `http://<homey-ip>:7575`.
3. The display completes a simulated Home Assistant authentication handshake.
4. The dashboard UI loads and fetches your devices and zones from Homey.
5. An SSE stream delivers live device state changes to the display as they happen.
6. Tapping a device card sends a control command back to Homey via the REST API.

---

## Supported Device Types

| Device Class | Icon | Controllable | Sensor Data |
|---|---|---|---|
| Light | 💡 | On/Off, Dim | — |
| Socket | 🔌 | On/Off | Power (W) |
| Thermostat | 🌡️ | — | Temperature, Humidity |
| Sensor | 📡 | — | Temperature, Humidity, CO₂ |
| Lock | 🔒 | On/Off | — |
| Blinds / Curtain / Shutterblind / Window Coverings | 🪟 | On/Off, Position | — |
| Fan | 💨 | On/Off | — |
| Heater | 🔥 | On/Off | Temperature |
| Home Alarm | 🔐 | Armed / Disarmed / Partial | Motion, Contact |
| TV | 📺 | On/Off | — |
| Vacuum Cleaner | 🤖 | On/Off | — |
| Solar Panel | ☀️ | — | Power (W) |
| Camera | 📷 | — | Snapshot image |
| Doorbell | 🔔 | — | Snapshot image |
| Speaker / Media Player | 🔊 🎵 | — | — |
| Button / Remote | 🔘 🕹️ | — | — |

---

## Installation

1. Install the app on your Homey via the Homey App Store or by sideloading with the Homey CLI.
2. Open the app settings in the Homey app.
3. Note the displayed dashboard URL (e.g., `http://192.168.1.x:7575`).
4. On your Shelly Wall Display, configure the Home Assistant server URL to match.
5. The display will connect automatically and load the dashboard.

---

## Settings

Open the app settings in the Homey app to configure:

| Setting | Description | Default |
|---|---|---|
| **Dashboard URL** | The address to enter on your Shelly Wall Display | Auto-detected |
| **Port** | HTTP server port (1024–65535). The server restarts automatically when changed. | `7575` |
| **Device Selection** | Choose which devices are visible on the dashboard. Devices are listed by room. Select all, clear all, or pick individually. | All devices |
| **Alarm PIN** | Optional 4-digit PIN required to arm/disarm the home alarm from the dashboard. Leave empty to disable. | — |

---

## Dashboard Usage

| Interaction | Action |
|---|---|
| Tap tile | Toggle device on/off (where supported) |
| Long-press tile (400 ms) | Start drag & drop to reorder |
| Tap camera / doorbell tile | Open live snapshot |
| ⊞ All / ⊟ Rooms button | Switch between flat and grouped view |
| ☀️ / 🌙 button | Toggle dark / light mode |

---

## API Endpoints

The app exposes the following HTTP endpoints (primarily for internal use by the dashboard and the display):

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Dashboard UI |
| `/ping` | GET | Health check |
| `/api/devices` | GET | Enabled devices list |
| `/api/alldevices` | GET | All devices (used by settings) |
| `/api/zones` | GET | Homey zones / rooms |
| `/api/settings` | GET / POST | Read or update app settings |
| `/api/device/:id/capability/:cap` | POST | Set a device capability value |
| `/api/camera/:id` | GET | Latest camera snapshot (proxied from Homey) |
| `/api/icon-proxy` | GET | Proxy for external device icon URLs |
| `/device-icons/:name.svg` | GET | Named device icons (served locally) |
| `/api/config` | GET | Simulated Home Assistant config |
| `/api/discovery_info` | GET | Simulated HA discovery info |
| `/auth/*` | GET / POST | Simulated HA authentication flow |
| `/events` | GET | Server-Sent Events stream for live updates |
| `/api/websocket` | UPGRADE | WebSocket (HA protocol) |

---

## Requirements

- **Homey** with Homey Web API (`homey:manager:api` permission)
- **Homey SDK** v3, compatibility `>=5.0.0`
- **Node.js** `>=16`
- A **Shelly Wall Display** or any other device/browser that can connect to a local HTTP server

---

## Project Structure

```
com.walldisplay.dashboard/
├── app.js                  # Homey app entry point — HTTP/WebSocket server, Homey API integration
├── app.json                # App manifest (id, permissions, metadata)
├── package.json            # Node.js dependencies
├── .gitignore              # Excludes node_modules, .claude/, build artefacts
├── dashboard/
│   ├── index.html          # Dashboard HTML shell
│   ├── client.js           # Frontend logic (device rendering, SSE, controls, drag & drop, PIN)
│   ├── style.css           # Dashboard styles (touch-optimized, dark/light mode)
│   └── device-icons/       # 226 SVG device icons (copied from homey-lib)
└── settings/
    └── index.html          # Settings UI (port, device filter, alarm PIN)
```

---

## License

MIT
