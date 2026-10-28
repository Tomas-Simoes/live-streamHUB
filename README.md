# Live StreamHUB

Live StreamHUB is a work-in-progress broadcast overlay platform for esports streams.

The current architecture is:

| Area | Path | Role |
| --- | --- | --- |
| Backend | `src/backend` | Auth, users, hub storage, media, and owner-scoped hub APIs. |
| Web app | `src/web` | Angular UI for auth, hub library, visual editor, previews, and OBS export. |
| Overwolf app | `src/overwolf-app` | Classic Overwolf WebApp. Captures game data through Overwolf game events and updates a generated OBS browser overlay. |

## AI Hub Builder

The editor includes an experimental AI builder for creating and editing League of
Legends broadcast overlays from ordinary language. Inference runs locally in a
browser worker through WebLLM and WebGPU; no inference server, API key, or paid
model service is required. The backend stores hubs through the normal Save flow.

### Try it

1. Open a hub in the editor and open **AI Hub Builder**.
2. Select **Qwen 3 · 4B (detailed editing)** and load the model. The first download
   is approximately 2.5 GB; the estimated GPU memory requirement is 3.4 GB.
3. Choose creation or editing and describe the result you want. Keep **Use Phi
   visual review** off for the current baseline evaluation.
4. Generate a proposal, inspect its preview, and apply it. Apply creates an
   undoable editor change; use **Save** to persist it.
5. For another adjustment, describe the change in edit mode.

Example creation prompt:

```text
Create a professional League of Legends broadcast overlay with dark charcoal
surfaces, teal for the left team and burnt orange for the right. Keep a compact
scoreboard centered at the top, with visible team gradients, prominent scores,
and a clear clock. Join two mirrored five-player tables at the bottom, with
items toward the outside and player names and statistics toward the middle.
Make champion portraits slightly larger than individual item icons. Use a
consistent typography hierarchy and fine separators, and keep gameplay and
the minimap clear.
```

The model authors scoped CSS for live scoreboard/player components and uses
structural operations for frame geometry. It can change presentation without
selecting a predefined visual style. The original accepted instruction remains
available throughout generation and correction; interpretation is an additional
implementation aid.

### Validation and recovery

The active pipeline is **`2026-10-27-css-authoring-fit-v9`**:

- CSS is parsed, scoped to real components, and checked for unsupported resources
  and frame changes. Exact semantic shorthand such as `.item` and `.name`
  resolves to the corresponding native component parts.
- Native CSS pixels scale correctly for both outer frames and their contents.
- A rendered preview checks layout, visible icon sizes, text readability,
  clipping, contrast, bindings, and measurable request requirements.
- Up to **three local fit trials per run** can correct measured container/row
  allocation and content sizing before requesting another model response. Each
  trial is re-rendered and checked against preservation boundaries. It is retained
  only when measured failures decrease without introducing integrity failures or
  newly failed requirement checks.
- Model generation/correction is capped at **four attempts** within a shared
  **ten-minute run budget**. These are stopping limits, not a guarantee of model
  quality or completion. A rejected proposal leaves the current editor unchanged.

Qwen3 4B receives text, not images. Reference images have local annotations that
provide text context to Qwen; adding references does not fine-tune the model.
Optional Phi feedback can inspect preview images, but its improvement to visual
quality has not been established. A measurements-only review cannot certify
professional visual quality.

The v9 regression reproduced the reported failed response in Chrome and completed
preview, apply, and save with zero model repair calls. The local checks recovered
the original proposal; this was a recorded-response replay, not fresh inference
or a live performance benchmark. The associated verification passed 243 Node
tests, production compilation, and the hub-library browser regression.

If a run fails, use **Download full diagnostic** in the builder before reloading
or starting another run. It includes the instruction, model calls, proposals,
validation errors, rendered measurements, and available preview captures.

Further reading:

- [Current CSS authoring architecture](docs/ai-hub-css-refactor.md)
- [v9 diagnosis, recovery rules, and verification](docs/ai-hub-measured-fit-2026-10-28.md)
- [Visual references and optional image review](docs/ai-hub-visual-review.md)

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

Use Node.js 22, npm 10 or later, and Docker for the local PostgreSQL workflow.
Configure `src/backend/.env.development` using the settings listed below.

Install all active packages:

```bash
npm run install:all
```

On a shell with `sh` available, run backend and web together:

```bash
npm run dev
```

On Windows, open two terminals at the repository root:

```powershell
# Terminal 1
npm.cmd run dev:backend
```

```powershell
# Terminal 2
npm.cmd run dev:web
```

The backend development command generates the Prisma client and starts the local
PostgreSQL container before launching Nest. Dependencies include the local Nest
CLI; a global `nest` installation is unnecessary. For a fresh host development
database, start PostgreSQL and apply the existing migrations first:

```bash
npm run db:start --prefix src/backend
npm run prisma:deploy --prefix src/backend
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

```bash
npm run build:backend
npm run build:web
npm run lint:web
npm test --prefix src/web
npm run test:hubs-browser --prefix src/web
```

Build the web app before running browser tests. The browser harness uses local
Chrome and stubs authentication/persistence. For the v9 failure replay without
downloading or running a model, run the following from `src/web` in PowerShell:

```powershell
$env:AI_QA_CSS = '1'
$env:AI_QA_SINGLE = '1'
$env:AI_QA_REPLAY = 'tests/fixtures/ai-container-collapse-response.json'
$env:AI_QA_OUTPUT = 'recovery-v9/manual-replay'
npm.cmd run test:ai-browser
```

The replay supplies the recorded model response; rendering, validation, local
fitting, apply, and save run in the real browser. Evidence is written under
`tmp-visual-qa/ai-hub-builder/`.

The AI builder requires a compatible WebGPU adapter, hardware acceleration, and
HTTPS or localhost. If adapter detection fails, check hardware acceleration and
restart the browser. Model downloads and GPU availability affect real inference
time; replay tests do not measure that performance.
