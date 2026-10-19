# Live StreamHUB

Live StreamHUB is a work-in-progress broadcast overlay platform for esports streams.

The current architecture is:

| Area | Path | Role |
| --- | --- | --- |
| Backend | `src/backend` | Auth, users, hub storage, media, and owner-scoped hub APIs. |
| Web app | `src/web` | Angular UI for auth, hub library, visual editor, previews, and OBS export. |
| Overwolf app | `src/overwolf-app` | Classic Overwolf WebApp. Captures game data through Overwolf game events and updates a generated OBS browser overlay. |

## Current OBS Flow

The web app exports a hub marker scene into OBS through `obs-websocket-js`.

When a hub is exported:

1. The frontend connects to OBS at `ws://127.0.0.1:4455`.
2. It creates/selects a scene named:

   ```text
   LiveHub userId={userId} hubId={hubId}
   ```

3. It switches OBS to that scene.

The scene name is the handoff between the web app and Overwolf. It preserves
the `userId` and `hubId` so Overwolf can load the correct hub from the backend
when it prepares the live render.

## Overwolf Render Flow

The Overwolf desktop/in-game window has a **Prepare OBS Render** button. It opens the same OBS WebSocket password flow as the frontend when no password is saved, with an option to remember the password in local storage. After connecting, it reads the current program scene, parses the `userId` and `hubId` from the scene name, and asks the backend for that hub.

`LeagueRender` then generates a local HTML overlay file in Overwolf's local app
data folder and creates or updates one full-canvas OBS Browser Source named:

```text
LiveHub Overlay {hubId}
```

That browser source contains all visible non-group hub layers. Static text,
image, and video layers render directly inside the page. League stat layers
carry a `team` value (`blue` or `red`), Player Score layers carry a `team` and
`role`, and every new League state from `LeagueProcessor` is pushed into the
page through OBS browser custom events using `CallVendorRequest` with the
`obs-browser` vendor.

The result is one OBS source per hub scene instead of one OBS source per hub
layer.

## Development

Install all active packages:

```bash
npm run install:all
```

Run backend and web:

```bash
npm run dev
```

Or run the full dev stack with Docker, including PostgreSQL:

```bash
docker compose up --build
```

The web app will be available at `http://localhost:4200`, and the backend API
at `http://localhost:3000`. Stop the stack with:

```bash
docker compose down
```

Run only the backend:

```bash
npm run dev:backend
```

Run only the Angular web app:

```bash
npm run dev:web
```

Load the normal Overwolf app through Overwolf's "Load unpacked extension"
dialog by selecting:

```text
src/overwolf-app
```

The Overwolf app has no npm build step. It is a classic manifest app:

```text
src/overwolf-app/manifest.json
src/overwolf-app/windows/background/index.html
src/overwolf-app/windows/background/background.js
src/overwolf-app/windows/desktop/index.html
src/overwolf-app/windows/desktop/desktop.js
src/overwolf-app/windows/desktop/desktop.css
src/overwolf-app/processors/GameProcessor.js
src/overwolf-app/processors/LeagueProcessor.js
src/overwolf-app/processors/CSProcessor.js
src/overwolf-app/processors/GameProcessorRegistry.js
```

`manifest.json` starts the background window and opens the desktop/in-game UI.

Game data enters the app in:

```text
src/overwolf-app/windows/background/background.js
```

The background script listens to Overwolf's game event APIs, then passes raw
payloads into:

```text
src/overwolf-app/processors/LeagueProcessor.js
```

`GameProcessor` defines the shared processor shape, `LeagueProcessor`
deserializes Overwolf JSON-string values such as
`live_client_data.all_players` and `live_client_data.game_data`, and
`CSProcessor` is a placeholder for the future Counter-Strike implementation.

Build backend and web:

```bash
npm run build
```

## Environment

Backend:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Backend API port. |
| `DATABASE_URL` | none | PostgreSQL connection string used by Prisma. |
| `JWT_SECRET` | none | Access token signing secret. |
| `JWT_REFRESH_SECRET` | none | Refresh token signing secret. |
| `CORS_ORIGIN` | `http://localhost:4200,http://127.0.0.1:4200` | Allowed browser origins. |

Web:

| Key | Default | Purpose |
| --- | --- | --- |
| `apiUrl` | `http://localhost:3000` | Backend API URL. |
| `obsUrl` | `ws://127.0.0.1:4455` | OBS WebSocket URL. |

Overwolf:

| Config | Default | Purpose |
| --- | --- | --- |
| `src/overwolf-app/config/AppConfig.js` `backendUrl` | `http://127.0.0.1:3000` | Backend API URL used for hub metadata. |
| `src/overwolf-app/config/AppConfig.js` `obsUrl` | `ws://127.0.0.1:4455` | OBS WebSocket URL. |

Overwolf also requests the `FileSystem` permission so it can write the generated
OBS overlay HTML file locally.

## Useful Commands

The Hub Editor includes an experimental **AI Hub Builder** that runs locally in
the browser using WebGPU. Open the panel to download a model, generate a validated
proposal, preview it, and apply it as an undoable edit. See the
[technical evaluation and setup](docs/local-ai-hub-builder.md) for requirements,
measurements, limitations, and the real-browser test runner.

```bash
npm run build:backend
npm run build:web
npm run lint:web
```
