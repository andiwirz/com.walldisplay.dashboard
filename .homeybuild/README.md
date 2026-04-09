# Wall Display Dashboard for Homey

A [Homey](https://homey.app) app that turns a **Shelly Wall Display** (or any compatible touchscreen device) into a smart home control panel — powered by your Homey devices.

The app runs a local HTTP/WebSocket server on your Homey that emulates the Home Assistant API. The Shelly Wall Display connects to it as if it were a Home Assistant instance, while the actual device data and control come entirely from Homey.

---

## Features

- **Live dashboard** — displays all your Homey devices on the touchscreen with real-time state updates via Server-Sent Events (SSE)
- **Device control** — toggle lights, sockets, locks, fans, blinds, heaters, TVs, and more directly from the wall
- **Dimmer support** — adjust brightness or position with a slider for dimmable lights and covers
- **Alarm control** — arm, disarm, or partially arm your home alarm; view motion and contact alerts
- **Sensor readings** — temperature, humidity, CO₂, power consumption, and more shown inline
- **Room grouping** — devices organized by Homey zones with a toggle to view all devices flat
- **Device filtering** — choose exactly which devices appear on the display via the settings page
- **Pull-to-refresh** — swipe down or tap the header to manually refresh
- **Auto-refresh** — fallback polling every 10 seconds and full refresh every 5 minutes
- **Home Assistant protocol emulation** — the display connects seamlessly without any device firmware changes

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
| Light | 💡 | On/Off, Dim | Temperature |
| Socket | 🔌 | On/Off | Power (W) |
| Thermostat | 🌡️ | — | Temperature, Humidity |
| Sensor | 📡 | — | Temperature, Humidity, CO₂ |
| Lock | 🔒 | On/Off | — |
| Blinds / Curtain / Window Coverings | 🪟 | On/Off, Position | — |
| Fan | 💨 | On/Off, Speed | — |
| Heater | 🔥 | On/Off | Temperature |
| Home Alarm | 🔐 | Armed / Disarmed / Partial | Motion, Contact |
| TV | 📺 | On/Off | — |
| Vacuum Cleaner | 🤖 | On/Off | — |
| Solar Panel | ☀️ | — | Power (W) |
| Camera | 📷 | — | — |
| Speaker / Media Player | 🔊 🎵 | — | — |
| Doorbell | 🔔 | — | — |
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
├── app.js              # Homey app entry point — HTTP/WebSocket server, Homey API integration
├── app.json            # App manifest (id, permissions, metadata)
├── package.json        # Node.js dependencies
├── dashboard/
│   ├── index.html      # Dashboard HTML shell
│   ├── client.js       # Frontend logic (device rendering, SSE, controls)
│   └── style.css       # Dashboard styles (touch-optimized)
└── settings/
    └── index.html      # Settings UI (port, device filter)
```

---

## License

MIT
