# Live StreamHUB

Live StreamHUB is a work-in-progress broadcast overlay platform for esports streams.
The goal is to let a streamer build a reusable 1920x1080 "hub" layout in the web
app, save it to the hosted backend, export it to OBS as a browser source, and then
fill that overlay with live game data captured locally through Overwolf.

The project is currently split into four main applications:

| Area | Path | Role |
| --- | --- | --- |
| Web app | `src/web` | Angular UI for auth, hub library, visual editor, overlay rendering, and OBS export. |
| Hosted backend | `src/backend` | NestJS API for users, sessions, auth cookies, and saved hub layouts. Uses Prisma with PostgreSQL. |
| Local server | `src/local-server` | NestJS bridge that runs on the streamer's machine. It receives Overwolf game data, normalizes live state, serves game-data endpoints, and provides overlay config to OBS/browser sources. |
| Overwolf app | `src/overwolf-app` | Overwolf/Electron client that starts the local bridge, listens to Overwolf GEP events, processes raw game payloads, and posts them into the local server. |

## The Big Picture

There are two different kinds of data in this system:

1. Persistent product data: users, sessions, and saved hub layouts.
2. Live runtime data: current game clock, teams, players, kills, objectives, events, etc.

Those are intentionally handled by different servers.

```text
                              Persistent setup flow

  Browser user
      |
      | login/register, create hub, edit hub, save hub
      v
  Angular web app  ----------------------->  Hosted Nest backend
  http://localhost:4200                     http://localhost:3000
                                                |
                                                | Prisma
                                                v
                                            PostgreSQL


                                Live overlay flow

  Overwolf / GEP
      |
      | raw game events and info updates
      v
  Overwolf Electron app
      |
      | DataProcessorService + data maps
      | POST /game-data/ingest
      v
  Local Nest server  --------------------->  Hosted backend
  http://127.0.0.1:3001                     GET /hub/owner/:userId/:hubId
      |
      | serves overlay page + config
      | pushes live state over WebSocket
      v
  OBS Browser Source
  http://127.0.0.1:3001/overlay/:userId/:hubId
```

The hosted backend should know who the user is and what layouts they saved. The
local server should know what is happening in the game right now. OBS reads from
the local server because OBS needs a low-latency local source that keeps working
during a stream without pushing every live frame through the hosted backend.

## Frontend Responsibilities

The Angular app is the user's control room. It does not capture Overwolf data
directly. It creates, edits, saves, previews, renders, and exports hub layouts.

Current routes:

| Route | Purpose |
| --- | --- |
| `/` | Home page. |
| `/login` | Login form. |
| `/register` | Registration form. |
| `/hubs` | Authenticated hub library and OBS export controls. |
| `/editor` | Authenticated 1920x1080 visual editor for the selected hub. |
| `/overlay/:userId/:hubId` | Runtime overlay renderer used by OBS/browser sources. |

The frontend owns these responsibilities:

- Authenticate users through the hosted backend.
- Keep the current user in `AuthStore`.
- Load the user's saved hubs into `HubStore`.
- Create new hubs through `POST /hub/create`.
- Edit a selected hub's `layout.layers` on a 1920x1080 broadcast canvas.
- Save layout changes through `PATCH /hub/update/:hubId`.
- Preview hubs in the library.
- Connect to OBS through `obs-websocket-js`.
- Create or update an OBS browser source that points at the local overlay URL.
- Render the overlay route by loading hub config from the local server and live
  game state from the local WebSocket.

### What the Frontend Creates

The current editor stores the visual design inside the hub `layout` JSON. The
main persisted field is:

```ts
layout: {
  layers: EditorLayer[];
}
```

Every layer shares the same base geometry:

```ts
type Layer = {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  position: { x: number; y: number };
  width: number;
  height: number;
};
```

Layer coordinates are stored in fixed 1920x1080 canvas units. The editor and
preview convert those values into percentages so the canvas can scale in the
browser while still exporting predictable OBS dimensions.

Implemented layer types:

| Layer type | Extra data | Runtime behavior |
| --- | --- | --- |
| `Text` | `text`, `fontSize`, `fontFamily`, `color` | Renders static copy. |
| `Image` | `src`, `alt`, `opacity` | Renders an image. |
| `Video` | `src`, `autoplay`, `muted` | Renders a looping video. |
| `Kills` | none yet | Runtime overlay reads `team.blue.kills`. |
| `Towers` | none yet | Runtime overlay reads `team.blue.objectives`. |
| `Group` | none yet | Placeholder for grouping behavior. |

The backend API also still accepts `imgs` and `features` arrays on a hub. Those
are kept in the data model for compatibility/future use, but the current Angular
editor uses `layout.layers` as the main source of truth.

## Hosted Backend Responsibilities

The hosted backend is the persistent API. It should be deployed somewhere stable
and backed by PostgreSQL.

Default local URL:

```text
http://localhost:3000
```

Swagger docs:

```text
http://localhost:3000/api/docs
```

Main modules:

| Module | Responsibility |
| --- | --- |
| `AuthModule` | Register, login, logout, and current-user lookup. |
| `SessionModule` | Refresh-token sessions and token rotation. |
| `UsersModule` | User records and public user DTOs. |
| `HubsModule` | CRUD for saved hub layouts. |
| `DatabaseModule` | Prisma/PostgreSQL connection. |

Important endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a user. |
| `POST` | `/auth/login` | Validate credentials, create a session, set auth cookies, return tokens. |
| `POST` | `/auth/logout` | Clear auth cookies. |
| `GET` | `/auth/me` | Return the current authenticated user. |
| `POST` | `/session/refresh` | Refresh the session with a refresh token. |
| `GET` | `/hub` | List all hubs. |
| `GET` | `/hub/mine` | List hubs owned by the authenticated user. |
| `POST` | `/hub/create` | Create a hub owned by the authenticated user. |
| `PATCH` | `/hub/update/:hubId` | Update a hub owned by the authenticated user. |
| `DELETE` | `/hub/delete/:hubId` | Delete a hub owned by the authenticated user. |
| `GET` | `/hub/owner/:userId/:hubId` | Fetch one hub for overlay config, scoped by owner id. |

The backend stores:

- `users`
- `sessions`
- `hubs`
- `hub_images`
- `hub_features`

The Prisma schema also contains `GameDataBinding` and `GameDataState` models.
Those are not the active live-data runtime yet; current live game state is owned
by the local server.

## Local Server Responsibilities

The local server is the bridge between the streaming machine, OBS, Overwolf, and
the hosted backend.

Default local URL:

```text
http://127.0.0.1:3001
```

It can run in two ways:

- Standalone from `src/local-server` for development and overlay testing.
- Embedded inside the Overwolf/Electron app when `src/overwolf-app` starts.

Main responsibilities:

- Receive processed/raw Overwolf data through `POST /game-data/ingest`.
- Normalize live data into a single `NormalizedGameState`.
- Keep a mock game state ticking when no Overwolf data has arrived.
- Expose the current game state for polling, SSE, and WebSocket clients.
- Serve the built Angular overlay app when `src/web/dist/browser/index.html`
  exists.
- Fetch hub layout config from the hosted backend for an overlay route.

Local server endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/game-data/state` | Current normalized game state snapshot. |
| `GET` | `/game-data/bindings` | Available binding metadata for game-data fields. |
| `GET` | `/game-data/live` | Server-sent events stream, currently one state per second. |
| `WS` | `/game-data/ws` | WebSocket stream used by the Angular overlay renderer. |
| `POST` | `/game-data/ingest` | Receives Overwolf payloads. |
| `GET` | `/overlay/:userId/:hubId/config` | Loads the saved hub from the hosted backend. |

The normalized runtime shape looks like this:

```ts
type NormalizedGameState = {
  source: "backend" | "mock" | "overwolf";
  connected: boolean;
  game: {
    time: number;
    mode: string;
    map: string;
    phase: string;
  };
  team: {
    blue: {
      name: string;
      gold: number;
      kills: number;
      minions: number;
      objectives: number;
    };
    red: {
      name: string;
      gold: number;
      kills: number;
      minions: number;
      objectives: number;
    };
  };
  player: Array<{
    id: string;
    name: string;
    team: "blue" | "red";
    championName: string;
    characterName: string;
    kills: number;
    deaths: number;
    assists: number;
    gold: number;
    minions: number;
    items: string[];
  }>;
  events: {
    latest: string;
    feed: string[];
  };
  updatedAt: string;
};
```

When `POST /game-data/ingest` receives data, the local server currently accepts:

- Already-normalized payloads with `processed.game` and `processed.team`.
- League `counters/match_clock` updates.
- League `live_client_data/game_data` updates when the value is JSON.

Everything else is currently ignored until more normalizers are added.

## Overwolf App Responsibilities

The Overwolf app is the local game-data collector. It is built with
Overwolf/Electron and uses the Overwolf Game Events Provider package.

Current flow:

1. Electron starts.
2. `Application` starts the local server on `http://127.0.0.1:3001`.
3. Unless `HUB_LOCAL_SERVER_ONLY` is enabled, it creates the desktop window.
4. `GameEventsService` waits for the Overwolf `gep` package.
5. When GEP is ready, it registers supported games and required features.
6. When a supported game is detected, it enables event capture.
7. `new-game-event` and `new-info-update` payloads emit `dataReceived`.
8. `GameDataController` runs `DataProcessorService` against `LeagueDataMap`.
9. The controller posts `{ source, raw, processed }` to
   `POST http://127.0.0.1:3001/game-data/ingest`.
10. The local server updates `NormalizedGameState` and broadcasts it to overlay
    clients.

Current GEP registration in code:

| Game | Game id | Required features |
| --- | --- | --- |
| League of Legends | `5426` | `live_client_data`, `counters` |
| Counter-Strike 2 | `22730` | `match_info`, `live_data` |

On unsupported development platforms, `GameEventsService.runInTemplateMode()`
can emit template data from `src/overwolf-app/data_templates` for debugging.
Actual Overwolf runtime behavior still depends on a Windows/Overwolf setup.

## OBS Flow

OBS is not part of the repo, but the web app can configure it through
`obs-websocket-js`.

When the user clicks export on a hub:

1. The frontend connects to OBS at `ws://127.0.0.1:4455`.
2. It asks for the OBS WebSocket password if none is saved.
3. It ensures a scene named `Live StreamHUB` exists.
4. It creates or updates a browser source named
   `Live StreamHUB - Browser {hubName}`.
5. That browser source points to:

```text
http://127.0.0.1:3001/overlay/:userId/:hubId
```

The OBS browser source then loads the Angular overlay route. The overlay route:

- Calls the local server for config:

```text
GET http://127.0.0.1:3001/overlay/:userId/:hubId/config
```

- The local server fetches the saved hub from the hosted backend:

```text
GET http://localhost:3000/hub/owner/:userId/:hubId
```

- The overlay reads `layout.layers`.
- The overlay opens:

```text
ws://127.0.0.1:3001/game-data/ws
```

- Every `game-state` WebSocket message updates the live stat layers.

For this OBS URL to work, the local server must be running and the built Angular
overlay must be available to it. By default, the local server looks for:

```text
src/web/dist/browser/index.html
```

During frontend-only development, you can also open the overlay through Angular:

```text
http://localhost:4200/overlay/:userId/:hubId
```

## Development Setup

Prerequisites:

- Node.js `>=20`
- npm `>=10`
- PostgreSQL, or Docker for the provided local database command
- OBS with WebSocket enabled if testing OBS export
- Windows with Overwolf installed if testing real Overwolf/GEP capture

Install dependencies for every package:

```sh
npm run install:all
```

Or:

```sh
make install
```

### Backend Database

The backend reads `src/backend/.env.development`. Expected variables:

```sh
DB_USER=livehub_dev
DB_PASSWORD=livehub_dev_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=live_stream_hub
DB_SCHEMA=public
JWT_SECRET=replace-this-for-real-development
```

The backend package includes a Docker helper:

```sh
npm run db:start --prefix ./src/backend
npm run prisma:migrate --prefix ./src/backend
```

Stop the local database container with:

```sh
npm run db:stop --prefix ./src/backend
```

### Start the Hosted Backend

```sh
npm run dev:backend
```

Backend URL:

```text
http://localhost:3000
```

Swagger:

```text
http://localhost:3000/api/docs
```

### Start the Web App

```sh
npm run dev:web
```

Web URL:

```text
http://localhost:4200
```

### Start Backend and Web Together

```sh
npm run dev
```

This starts the hosted backend and Angular web app only. It does not start the
local server or Overwolf app.

### Start the Local Server Standalone

```sh
npm run dev:local-server
```

Local server URL:

```text
http://127.0.0.1:3001
```

This is useful for testing overlay rendering and mock game data without running
Overwolf.

### Start the Overwolf App

```sh
npm run dev:overwolf
```

This builds and starts the Overwolf/Electron package. The app starts the local
server, then starts GEP capture when not in local-server-only mode.

To start only the embedded local bridge through the Overwolf package:

```sh
npm run dev:overwolf:local-server
```

That sets:

```sh
HUB_LOCAL_SERVER_ONLY=1
```

### Build

Build backend, local server, and web:

```sh
npm run build
```

Build only one package:

```sh
npm run build:backend
npm run build:local-server
npm run build:web
```

Build the web app before testing the OBS browser-source URL through the local
server, because the local server serves the Angular app from the web build
output.

## Environment Knobs

Backend:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Hosted backend port. |
| `CORS_ORIGIN` | `http://localhost:4200,http://127.0.0.1:4200` | Allowed browser origins. |
| `DATABASE_URL` | built from `DB_*` | Full PostgreSQL URL. |
| `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA` | local defaults | Database connection pieces. |
| `JWT_SECRET` | development fallback | JWT signing secret. Replace for real use. |

Local server:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOCAL_SERVER_PORT` | `3001` | Local bridge port. |
| `LOCAL_SERVER_HOST` | `127.0.0.1` | Local bridge host. |
| `LOCAL_CORS_ORIGIN` | `http://localhost:4200,http://127.0.0.1:4200` | Allowed frontend origins. |
| `LOCAL_OVERLAY_DIST_DIR` | `../web/dist/browser` from the local server process | Built Angular overlay directory. |
| `HUB_BACKEND_URL` | `http://127.0.0.1:3000` | Hosted backend URL used by overlay config proxy. |

Overwolf app:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Chooses `.env.development`, `.env.staging`, or `.env.production`. |
| `HUB_LOCAL_SERVER_ONLY` | disabled | Starts only the local bridge and skips the window/GEP capture when enabled. |
| `HUB_LOCAL_SERVER_URL` | `http://localhost:3001` | Target for `POST /game-data/ingest`. |
| `HUB_BACKEND_URL` | fallback ingest target in Overwolf, backend target in local server | Used when a more specific local URL is not set. |

Web app:

The Angular environment files live in `src/web/src/env`.

| Field | Development value | Purpose |
| --- | --- | --- |
| `apiUrl` | `http://localhost:3000` | Hosted backend API. |
| `localServerUrl` | `http://127.0.0.1:3001` | Local bridge HTTP API and overlay host. |
| `localGameDataWsUrl` | `ws://127.0.0.1:3001/game-data/ws` | Live game-state WebSocket. |
| `obsUrl` | `ws://127.0.0.1:4455` | OBS WebSocket URL. |

## Suggested End-to-End Development Flow

1. Start PostgreSQL and run migrations.
2. Start the hosted backend with `npm run dev:backend`.
3. Start the web app with `npm run dev:web`.
4. Register or log in at `http://localhost:4200`.
5. Create a hub from `/hubs`.
6. Open it in `/editor`, add layers, and save.
7. Build the web app with `npm run build:web` so the local server can serve the
   overlay route.
8. Start the local server with `npm run dev:local-server`, or start the Overwolf
   app with `npm run dev:overwolf`.
9. In OBS, enable WebSocket on `127.0.0.1:4455`.
10. Back in `/hubs`, export the hub to OBS.
11. Run Overwolf/GEP capture, or use the local server mock state, and watch the
    OBS browser source update.

## Current Implementation Notes

- This is still an unfinished project.
- The persistent backend has moved from MongoDB to PostgreSQL/Prisma.
- The Angular editor currently persists hub design primarily as
  `layout.layers`.
- The generic binding catalog exists at `/game-data/bindings`, but the editor
  does not yet expose a full binding picker.
- Runtime stat rendering is currently hard-coded for `Kills` and `Towers`.
- Overwolf data maps and processors are still prototype-level. `LeagueDataMap`
  has early mapping examples; CS-specific processing is not implemented yet.
- The local server has a mock state loop so the overlay can be tested without a
  running game.
- Real Overwolf capture should be treated as Windows/Overwolf runtime work even
  though some template/debug flows can run elsewhere.

## Repository Map

```text
.
|-- Makefile
|-- package.json
|-- src
|   |-- backend
|   |   |-- prisma
|   |   |   `-- schema.prisma
|   |   `-- src
|   |       |-- auth
|   |       |-- database
|   |       |-- hubs
|   |       |-- session
|   |       `-- users
|   |-- local-server
|   |   `-- src
|   |       |-- game-data
|   |       |-- overlay
|   |       `-- server.ts
|   |-- overwolf-app
|   |   |-- data_templates
|   |   `-- src
|   |       |-- main
|   |       |-- preload
|   |       `-- renderer
|   `-- web
|       `-- src
|           |-- app
|           |   |-- core
|           |   |-- features
|           |   `-- shared
|           `-- env
`-- README.md
```

## Authors

- Tomás Simões - [GitHub](https://github.com/Tomas-Simoes)
- Rafael - [GitHub](https://github.com/Rafasta236)
- Leonardo - [GitHub](https://github.com/leorcf)
