# Wall Display Dashboard for Homey

A [Homey](https://homey.app) app that turns a **Shelly Wall Display** (or any compatible touchscreen device) into a smart home control panel — powered by your Homey devices.

The app runs a local HTTP/WebSocket server on your Homey that emulates the Home Assistant API. The Shelly Wall Display connects to it as if it were a Home Assistant instance, while the actual device data and control come entirely from Homey.

---

## Features

### Device Control
- **Live dashboard** — all Homey devices as touch tiles, real-time state updates via Server-Sent Events (SSE) with adaptive fallback polling
- **Device control** — toggle lights, sockets, locks, fans, blinds, heaters, TVs, and more directly from the wall
- **Dimmer support** — adjust brightness or blind position with a slider
- **Alarm control** — arm, disarm, or partially arm your home alarm; view motion and contact alerts
- **PIN protection** — optional 4-digit PIN for the home alarm, configurable in the settings page
- **Camera & doorbell snapshots** — tap a camera or doorbell tile to view the latest image with auto-refresh
- **External sensors** — reed contacts and similar sensors (e.g. garage door) shown as Open / Closed; tile turns red when open
- **Sensor readings** — temperature, humidity, CO₂, and power consumption shown inline on each tile

### Flow Buttons
- **One-tap flow triggers** — select any manually-triggerable Homey flow in the settings to show it as a button on the dashboard
- **Visual feedback** — spinner while triggering, green ✓ on success, red ✕ on error
- **Basic and Advanced Flows** — supports both classic flows and Advanced Flows (Homey ≥ 10)
- **Adjustable tile width** — flow tiles can use their natural width (dynamic) or match the width of device tiles exactly

### Navigation & Layout
- **Room grouping** — devices organised by Homey zones, with a toggle to view all devices in a flat list
- **Drag & drop reordering** — long-press a tile to drag it to a new position; order is saved across reloads
- **Adjustable tile size** — choose from XS / S / M (default) / L / XL via the settings page
- **Dark / light mode** — toggle between themes via the header button; preference is saved per browser
- **Clock** — live clock in the header, drift-corrected

### Energy Dashboard
- **Flow diagram** — animated SVG showing real-time energy flows between solar panels, the power grid, your home, and battery storage
- **Solar total bar** — 7-day history chart with a yellow bar for total solar production alongside grid import and home consumption
- **Animated flow lines** — travelling dots indicate direction and magnitude of each energy flow
- **Device cards** — individual power readings for each solar, grid, battery, and EV-charger device
- **Exclude support** — devices marked as "Exclude from Energy" in Homey are automatically hidden
- **Enable / disable** — the ⚡ Energy button can be hidden via the settings page

### Reliability
- **SSE + polling** — Server-Sent Events for instant updates; polling every 10 s (30 s when SSE is active) as a safety net for capabilities Homey does not push via realtime events
- **SSE reconnect backoff** — exponential backoff (1 s → 2 s → 4 s → … → 30 s) after connection loss
- **Auto-refresh** — full data reload every 5 minutes and on header logo tap
- **XHR timeout** — all requests time out after 10 seconds to prevent a frozen UI

---

## How It Works

```
Shelly Wall Display  /  any browser
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

> **Tip:** The dashboard URL also works in any regular browser (Chrome, Safari, Firefox) — just open it on any device on your local network.

---

## Supported Device Types

| Device Class | Icon | Controllable | Sensor Data |
|---|---|---|---|
| Light | 💡 | On/Off, Dim | — |
| Socket | 🔌 | On/Off | Power (W) |
| Thermostat | 🌡️ | — | Temperature, Humidity |
| Sensor | 📡 | — | Temperature, Humidity, CO₂ |
| Lock | 🔒 | On/Off | — |
| Blinds / Curtain / Window Coverings | 🪟 | On/Off, Position | — |
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
3. Note the displayed dashboard URL (e.g. `http://192.168.1.x:7575`).
4. On your Shelly Wall Display: **Settings → Network → Home Assistant → Add URL** and enter the URL.
5. The display connects automatically and loads the dashboard.

---

## Settings

The settings page is organised into three tabs:

### General

| Setting | Description | Default |
|---|---|---|
| **Dashboard URL** | Clickable link to the dashboard — also works in any browser | Auto-detected |
| **Port** | HTTP server port (1024–65535). Server restarts automatically when changed. | `7575` |
| **Tile Size** | Size of device tiles on the dashboard: XS / S / M / L / XL | M (130 px) |
| **Energy Dashboard** | Show or hide the ⚡ Energy button in the dashboard header | Enabled |
| **Alarm PIN** | Optional 4-digit PIN to arm/disarm the alarm from the dashboard. Leave empty to disable. | — |
| **Homey API Token** | Personal Access Token required to trigger flows. Create at **my.homey.app → Account → Developer → API Keys**. | — |

### Devices

Choose which devices appear on the dashboard. Devices are grouped by room. Use the All / None buttons per room for quick selection.

### Flows

| Setting | Description |
|---|---|
| **Flow selection** | Select which manually-triggerable flows appear as buttons on the dashboard. Flows are grouped by folder. |
| **Flow tile width** | **Dynamic** — tiles size to their content. **Same as devices** — tiles match the device tile width exactly. |

> **Note on flow triggering:** Due to a Homey platform restriction, apps cannot trigger flows using their internal token. A **Personal Access Token** (set in the General tab) is required. Create one at [my.homey.app](https://my.homey.app) under Account → Developer → API Keys with full permissions.

---

## Dashboard Usage

| Interaction | Action |
|---|---|
| Tap tile | Toggle device on/off (where supported) |
| Tap dimmer / blind tile | Adjust slider |
| Long-press tile (400 ms) | Start drag & drop to reorder |
| Tap camera / doorbell tile | Open live snapshot |
| Tap flow button | Trigger the flow immediately |
| ⊞ All / ⊟ Rooms button | Switch between flat list and room-grouped view |
| ☀️ / 🌙 button | Toggle dark / light mode |
| ⚡ button | Open Energy Dashboard |
| Tap header logo | Manual refresh |

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Dashboard UI |
| `/ping` | GET | Health check |
| `/api/devices` | GET | Enabled devices list (cached 3 s) |
| `/api/alldevices` | GET | All devices (used by settings, cached 3 s) |
| `/api/zones` | GET | Homey zones / rooms |
| `/api/energy` | GET | Energy device data and summary |
| `/api/flows` | GET | All manually-triggerable flows |
| `/api/flow/:id/trigger` | POST | Trigger a flow by ID |
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
- A **Shelly Wall Display** or any device / browser that can connect to a local HTTP server
- A **Personal Access Token** (for flow triggering only)

---

## Project Structure

```
com.walldisplay.dashboard/
├── app.js                  # Homey app entry point — HTTP/WebSocket server, Homey API integration
├── app.json                # App manifest (id, permissions, metadata)
├── package.json            # Node.js dependencies
├── assets/
│   ├── icon.svg            # App icon
│   └── images/             # App store images (small / large / xlarge)
├── dashboard/
│   ├── index.html          # Dashboard HTML shell
│   ├── client.js           # Frontend logic (rendering, SSE, controls, energy, flows, drag & drop, PIN)
│   ├── style.css           # Touch-optimised styles (dark/light mode, tile sizes, flow tiles)
│   └── device-icons/       # SVG device icons served locally
└── settings/
    └── index.html          # Settings UI — tabs: General, Devices, Flows
```

---

## License

MIT
