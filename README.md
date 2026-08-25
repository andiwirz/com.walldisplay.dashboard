# Wall Display Dashboard for Homey

A [Homey](https://homey.app) app that turns a **Shelly Wall Display** (or any compatible touchscreen device) into a smart home control panel — powered by your Homey devices.

The app runs a local HTTP/WebSocket server on your Homey that emulates the Home Assistant API. The Shelly Wall Display connects to it as if it were a Home Assistant instance, while the actual device data and control come entirely from Homey.

---

## Features

### Device Control
- **Live dashboard** — all Homey devices as touch tiles, real-time state updates via Server-Sent Events (SSE) with adaptive fallback polling
- **Device control** — toggle lights, sockets, locks, fans, blinds, heaters, TVs, and more directly from the wall
- **Dimmer support** — tap anywhere on a dimmer tile to toggle on/off; drag the slider to adjust brightness; both gestures work independently and never interfere with each other
- **Blind controls** — position slider, ▲ ■ ▼ buttons, or both; choose per installation in Settings → Design. Blinds that only support up/down/stop always get the three buttons. Useful for devices that report a position slider but cannot actually be positioned (e.g. via Bond Bridge)
- **Alarm control** — arm, disarm, or partially arm your home alarm; view motion and contact alerts
- **PIN protection** — optional 4-digit PIN for the home alarm, configurable in the settings page
- **Camera & doorbell snapshots** — tap a camera or doorbell tile to view the latest image with auto-refresh
- **External sensors** — reed contacts and similar sensors (e.g. garage door) shown as Open / Closed; tile turns red when open
- **Sensor readings** — temperature, humidity, CO₂, and power consumption shown inline on each tile

### Flow Buttons & Flow Action Cards
- **One-tap flow triggers** — select any manually-triggerable Homey flow in the settings to show it as a button on the dashboard
- **Visual feedback** — spinner while triggering, green ✓ on success, red ✕ on error
- **Basic and Advanced Flows** — supports both classic flows and Advanced Flows (Homey ≥ 10)
- **Adjustable tile width** — flow tiles can use their natural width (dynamic) or match the width of device tiles exactly
- **Show camera on dashboard** — Flow action card that automatically opens a camera or doorbell snapshot on the dashboard when a Flow runs; select a specific display or broadcast to all, and optionally auto-close after a set number of seconds; ideal for doorbell automations
- **Show message on dashboard** — Flow action card that displays any text full-screen on the dashboard, with an optional countdown (in minutes) and the same per-display targeting

### Moods
- **Homey Moods as tiles** — tap a tile to activate a mood; moods get their own tile row with their own drag-and-drop order
- **Room shown alongside** — moods often share a name across rooms, so the room is listed next to the name in the settings
- **Per-display selection** — choose which moods appear on each display under Settings → Profiles
- **Off by default** — nothing appears until you enable moods, so existing dashboards are unaffected by the update
- **Personal Access Token** — as with flows, activating a mood may require the token set in the General settings

### Navigation & Layout
- **Room grouping** — devices organised by Homey zones, with a toggle to view all devices in a flat list; tap a room title to collapse or expand its tiles
- **Room filter** — ☰ burger menu icon in the header opens a chip bar listing all active rooms; tap a chip to filter to that room, tap again to clear; chips wrap to multiple lines on small screens (no horizontal scrolling); room order follows the configured zone order
- **Device class filters** — optional shortcut buttons in the header to filter by Cameras, Media Players, Thermostats, Lights, or Blinds; each can be enabled independently in Settings → Design
- **Search** — 🔍 icon in the header opens a search field; press Enter to confirm the filter (keyboard closes, filter stays active); tap the icon again to edit, ✕ to clear; disabled by default, enable in Settings → Design
- **Room order** — drag and drop rooms into any order via the Design settings
- **Drag & drop reordering** — long-press a tile to drag it to a new position; order is saved across reloads
- **Adjustable tile width** — choose from XS / S / M (default) / L / XL via the settings page
- **Adjustable tile height** — Auto (content-driven) or Same as width, which sets a minimum height matching the configured tile width
- **Tile layout** — values, status and device name always aligned to the bottom of each tile for a clean, consistent look
- **Theme mode** — Light, Dark, Toggle (manual header button), or Auto (light 07:00–21:00, dark otherwise); configurable in Settings → Design; the header button is hidden in Light / Dark / Auto modes
- **Clock** — live clock in the header, drift-corrected
- **Tile Colors** — four levels: **None** (no background tint at all — an active device is marked by its icon, label and a soft glow), **Default** (the built-in warm tint), **Subtle** and **Strong** (your own colors). Set a custom active color, an optional inactive color for switchable devices, and a flow button color; sensors and cameras are never tinted
- **Bilingual interface** — the whole dashboard is available in English and German, including device states, weather conditions and all dialogs. The Shelly Wall Display always reports English to the browser, so the language can be set explicitly in Settings → Design; connected displays switch over immediately
- **Touch-friendly** — every control has a touch area of at least 44 px, including the sliders, the on/off switch and the header buttons. The header adapts to the number of quick-access buttons and wraps to a second row rather than pushing anything off screen
- **Header-hidden shortcuts** — when the header is hidden for a clean full-screen look, ⚡ Energy and 🚗 EV shortcut tiles appear automatically in the flow area so both dashboards remain accessible

### Weather Dashboard
- **Weather tile** — optional tile at the top of the dashboard showing current conditions: weather emoji, temperature, description, wind speed, and city name; tap to open the forecast modal
- **Header button** — optional 🌤️ button in the header bar (independent of the tile) that also opens the forecast modal
- **Forecast modal** — two tabs:
  - *Today* — current conditions (feels like, humidity, wind, pressure) plus an hourly strip (every 3 hours, full-width, scrollable)
  - *7 Days* — daily forecast with high/low temperatures, weather emoji, rain probability, and precipitation
- **Free API** — powered by [Open-Meteo](https://open-meteo.com) — no API key required
- **Auto-location** — latitude and longitude are automatically populated from Homey's geolocation on first launch; can be overridden with a city search or the 📍 Homey location button in the settings
- **Temperature unit** — °C or °F, configurable in the Design settings
- **Disabled by default** — enable the tile and/or header button in the Design settings

### Energy Dashboard
- **Flow diagram** — Tesla-style animated SVG with dark circular nodes and colored rings showing real-time energy flows between Solar, Grid, Home, and Battery
- **T-junction layout** — Solar top-center, Grid bottom-left, Home bottom-right, Battery bottom-center; orthogonal connectors with a single animated dot per active line
- **Inactive nodes** — nodes with no active flow are shown in grey (no value, dimmed icon) so you can instantly see what is producing or consuming
- **Three tabs** — *Live* (flow diagram), *Devices* (per-device power cards), *7 Days* (bar chart with solar production and grid import)
- **7-day history chart** — bar chart with solar production and grid import per day
- **Animated flow lines** — travelling dots indicate direction; inactive connections shown as dashed lines
- **Invert battery sign** — option for systems that report positive power when discharging (e.g. GoodWe SMILE, some Fronius inverters)
- **Meter handling** — some meters report total house usage through `measure_power` and the actual grid flow separately (`measure_power.grid`, or a whole-home flag in the device's energy configuration). Where such a value exists it is used directly; otherwise `measure_power` is read as the net grid flow, as with a classic current clamp
- **Exclude support** — devices marked as "Exclude from Energy" in Homey are automatically hidden
- **Enable / disable** — the ⚡ Energy button can be hidden via the settings page

### EV Dashboard
- **Dedicated EV panel** — tap the 🚗 header button to open a modal with your electric vehicle's live status; disabled by default, enabled in the Design settings
- **Any Homey device** — pick any device from your Homey as the EV; not limited to a specific driver
- **Car image** — upload a PNG or JPEG photo of your car; PNG transparency is preserved (no black background)
- **Battery bar** — live state-of-charge bar with percentage label; pulses when actively charging
- **Charging state badge** — `ev_charging_state` shown as a colored pill above the battery bar:
  - ⚡ Charging (green, pulsing bar)
  - 🔌 Plugged in / Waiting (amber)
  - 🔌 Unplugged (`plugged_out`) (grey)
  - 🚗 Driving / Discharging (grey)
  - — Not connected (grey)
- **Capability cards** — select any device capabilities in the settings; each shows an icon, formatted value, and label
- **Capability picker** — standard EV caps (`measure_battery`, `ev_charging_state`) are pre-selected and highlighted with an orange "EV" badge in the settings
- **Auto-refresh** — EV data polls every 30 seconds while the modal is open

### Reliability & Performance
- **Instant capability updates** — per-device `makeCapabilityInstance` subscriptions (homey-api V3) fire the moment Homey commits any capability value change; physical switch presses appear on the dashboard in under 1 second
- **SSE fast path** — capability changes are broadcast over Server-Sent Events immediately; the card updates within a single animation frame
- **Fallback polling** — full device state poll every 120 s (SSE active) / 10 s (SSE inactive) as a safety net; `makeCapabilityInstance` delivers real-time updates so frequent polling is unnecessary
- **SSE reconnect backoff** — exponential backoff (1 s → 2 s → 4 s → … → 30 s) after connection loss
- **Auto-refresh** — full data reload every 15 minutes and on header logo tap; the current view stays on screen until the new data arrives, so the dashboard never blanks out mid-refresh
- **Filters survive a redraw** — an active room, category or search filter is re-applied after every redraw, including the periodic refresh
- **Cached lists** — flow and mood lists are held in memory and refreshed only when they actually change in Homey, rather than being re-fetched on every redraw
- **Self-healing icon cache** — if browser storage fills up, the oldest cached icons are dropped and the write is retried, instead of silently re-downloading every icon on every load
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
| Thermostat | 🌡️ | Target Temp, On/Off, Mode (via modal) | Temperature |
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
| Speaker / Media Player | 🔊 🎵 | Play/Pause, Skip, Volume (via modal); album art fullscreen with Ken Burns zoom | Track info |
| Button / Remote | 🔘 | Tap to trigger | — |
| Car / EV | 🚗 | — | Battery (SoC %), Charging State, Range, and more via EV Dashboard |

---

## Installation

1. Install the app on your Homey via the Homey App Store or by sideloading with the Homey CLI.
2. Open the app settings in the Homey app.
3. Note the displayed dashboard URL (e.g. `http://192.168.1.x:7575`).
4. On your Shelly Wall Display: **Settings → Network → Home Assistant → Add URL** and enter the URL.
5. The display connects automatically and loads the dashboard.

---

## Settings

The settings page is organised into four tabs:

### General

| Setting | Description | Default |
|---|---|---|
| **Dashboard URL** | Clickable link to the dashboard — also works in any browser | Auto-detected |
| **Port** | HTTP server port (1024–65535). Server restarts automatically when changed. | `7575` |
| **Alarm PIN** | Optional 4-digit PIN to arm/disarm the alarm from the dashboard. Leave empty to disable. | — |
| **Flow Confirmation** | Show a confirmation dialog before triggering a flow | Disabled |
| **Homey API Token** | Personal Access Token required to trigger flows (**Homey Pro 2023 or later only**). Create at **my.homey.app → Account → Developer → API Keys**. | — |

### Design

| Setting | Description | Default |
|---|---|---|
| **Dashboard Title** | Name shown in the top-left of the dashboard header | — |
| **Theme Mode** | **Toggle** — manual ☀️/🌙 button. **Light** / **Dark** — fixed. **Auto** — light 07:00–21:00, dark outside those hours | Toggle |
| **Accent Color** | Highlight color used for active tiles, toggles, and interactive elements | `#F5A623` |
| **Tile Colors** | State-based tile coloring: **None** (no tint at all) / **Default** (built-in warm tint) / **Subtle** / **Strong**; configurable active color, optional inactive color (switchable devices only), and flow button color | Default |
| **Tile Shape** | Corner radius of tiles: Sharp / Rounded / Pill | Rounded |
| **Header** | Show or hide the header bar (title, clock, buttons). When hidden, ⚡ and 🚗 shortcut tiles appear in the flow area automatically. | Enabled |
| **Energy Dashboard** | Show or hide the ⚡ Energy button in the dashboard header | Enabled |
| **Invert battery sign** | Flip the sign of battery power readings for inverters that report positive = discharging | Disabled |
| **Weather Dashboard** | Show weather as a tile and/or 🌤️ header button; configure city (auto-detected from Homey geolocation), temperature unit (°C/°F) | Disabled |
| **EV Dashboard** | Show or hide the 🚗 EV button; select the EV device, pick capabilities, and optionally upload a car image | Disabled |
| **View Toggle Button** | Show or hide the Rooms / All button; set the default view | Enabled / All |
| **Room Filter** | Show or hide the ☰ burger menu that opens the room chip bar | Enabled |
| **Search** | Show or hide the 🔍 search button in the header | Disabled |
| **Class Filters** | Individually enable/disable filter buttons for Cameras, Media Players, Thermostats, Lights, and Blinds | All disabled |
| **Dashboard Language** | **Auto** (browser language) / **English** / **Deutsch**. The Shelly Wall Display always reports English, so pick the language explicitly there. | Auto |
| **Power on tiles** | Show the current wattage on device tiles that report it. The Energy dashboard always shows every value regardless. | Enabled |
| **Blind controls** | For blinds that report both a position slider and up/down/stop: **Slider** / **Buttons** / **Both**. Blinds that only support up/down/stop always show the buttons. | Slider |
| **Font Size** | Text size on device and flow tiles (1–5) | 1 |
| **Tile Width** | Width of device tiles: XS / S / M / L / XL | M |
| **Tile Height** | **Auto** — height follows content. **Same as width** — sets a minimum height matching the configured tile width. Note that tiles stretch to fill the row, so they will not always come out exactly square. | Auto |
| **Flow Tile Width** | **Dynamic** — tiles size to their content. **Same as devices** — match device tile width. | Dynamic |
| **Shortcut Bar Position** | Show the shortcut bar (flows, weather, Energy, EV) above or below device tiles | Above |

### Profiles

Configure what each display shows. Every profile has three collapsible sections — **Devices**, **Flows** and **Moods** — that let you choose exactly what appears on that display.

**Default profile** — always present, applies to all displays that have no matching IP profile.

**IP profiles** — add one per display. Matching is done purely on the connecting device's IP address, so any browser works, not just Shelly hardware — give the device a fixed IP (a DHCP reservation is easiest), otherwise the profile silently stops matching. Open `/api/client-ip` on the device to see the address the Homey actually sees. Each IP profile overrides the default for that specific display. Profiles can be deleted with a two-click confirmation (click ✕, then confirm).

| Section | Options |
|---|---|
| **Devices** | *All* (no filter) · *None* (hide all devices) · individual device selection grouped by room |
| **Flows** | *All* (no filter) · *None* (hide all flows) · individual flow selection |
| **Moods** | *All* · *None* (default) · individual mood selection, each listed with its room |

> **Note on flow triggering:** Due to a Homey platform restriction, apps cannot trigger flows using their internal token. A **Personal Access Token** (set in the General tab) is required — **this feature requires a Homey Pro 2023 or later**. Create one at [my.homey.app](https://my.homey.app) under Account → Developer → API Keys with full permissions.

### Debug

Tools for diagnosing camera, speaker, and logging issues. All output is shown in copyable black code fields.

| Tool | Description |
|---|---|
| **App Logging** | Enable or disable the in-memory log buffer. When enabled, the last 200 `log()` / `error()` calls from the app are stored in a ring buffer with zero overhead when disabled. |
| **App Logs** | Load the current log buffer — newest entries first, errors highlighted in red. |
| **Image Registry** | Show all images registered with Homey, grouped by cameras and speakers. Useful for diagnosing missing album art or camera snapshots. |
| **Speaker Cover URL** | Enter a speaker device ID to resolve its current album art URL without fetching the image — useful for testing 401 / 404 responses directly in the browser. |
| **Energy classification** | `/api/debug/energy` lists every energy-related device with its Homey energy configuration and raw capability values — the quickest way to see why solar, grid or battery figures look wrong. |

---

## Dashboard Usage

| Interaction | Action |
|---|---|
| Tap tile | Toggle device on/off (where supported) |
| Tap dimmer tile (not on slider) | Toggle light on/off |
| Drag dimmer / blind slider | Adjust brightness or position |
| ▲ ■ ▼ buttons on a blind tile | Open, stop, or close; the pressed button lights up while moving |
| Tap mood tile | Activate the mood |
| Long-press tile (400 ms) | Start drag & drop to reorder |
| Tap room title | Collapse / expand room tiles |
| Tap camera / doorbell tile | Open live snapshot |
| Tap speaker / media player tile | Open media player modal |
| Tap album art in media player | Open album art fullscreen immediately |
| Tap flow button | Trigger the flow immediately |
| ⊞ All / ⊟ Rooms button | Switch between flat list and room-grouped view |
| ☰ button | Open / close room filter chip bar |
| Room chip | Filter tiles to that room; tap again to clear |
| 🔍 button | Open / close search field |
| 📷 / 🔊 / 🌡 / 💡 / 🪟 button | Filter tiles by device class; tap again to clear |
| ☀️ / 🌙 button | Toggle dark / light mode (Toggle mode only) |
| ⚡ button | Open Energy Dashboard |
| 🚗 button | Open EV Dashboard |
| 🌤️ button | Open Weather Dashboard |
| Tap weather tile | Open Weather Dashboard |
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
| `/api/moods` | GET | All Homey moods, with their room |
| `/api/mood/:id/set` | POST | Activate a mood by ID |
| `/api/settings` | GET / POST | Read or update app settings |
| `/api/device/:id/capability/:cap` | POST | Set a device capability value |
| `/api/camera/:id` | GET | Latest camera snapshot (proxied from Homey) |
| `/api/ev` | GET | EV device live data (name, availability, selected capabilities) |
| `/api/ev-image` | GET | Car image binary (PNG or JPEG, as uploaded) |
| `/api/location` | GET | Homey geolocation (lat, lon, accuracy, mode) |
| `/api/client-ip` | GET | The client's IP as seen by the Homey — used for profile matching |
| `/api/debug/energy` | GET | Energy device classification and raw capability values |
| `/api/icon-proxy` | GET | Proxy for external device icon URLs |
| `/device-icons/:name.svg` | GET | Named device icons (served locally) |
| `/api/config` | GET | Simulated Home Assistant config |
| `/api/discovery_info` | GET | Simulated HA discovery info |
| `/auth/*` | GET / POST | Simulated HA authentication flow |
| `/events` | GET | Server-Sent Events stream for live updates |
| `/api/websocket` | UPGRADE | WebSocket (HA protocol) |

---

## Requirements

- **Homey** with Homey Web API (`homey:manager:api` permission) and geolocation (`homey:manager:geolocation` for auto-location)
- **Homey SDK** v3, compatibility `>=5.0.0`
- A **Shelly Wall Display** or any device / browser that can connect to a local HTTP server
- A **Personal Access Token** (for flow triggering only — requires **Homey Pro 2023 or later**)

---

## Project Structure

```
com.walldisplay.dashboard/
├── app.js                  # Homey app entry point — HTTP/WebSocket server, Homey API integration
├── app.json                # App manifest (id, permissions, api declarations, metadata)
├── api.js                  # Homey SDK v3 API module — debug endpoints callable from settings page
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
    └── index.html          # Settings UI — tabs: General, Design, Profiles, Debug
```

---

## Support

If you enjoy this app, consider buying me a beer 🍺

[![PayPal](https://img.shields.io/badge/PayPal-Buy%20me%20a%20beer-blue?logo=paypal)](https://www.paypal.com/paypalme/AndiWirz)

---

## License

MIT
