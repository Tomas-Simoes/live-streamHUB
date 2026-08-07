# Live StreamHUB Web

This web app is now an Angular application organized by feature modules.

## Commands

- `npm run dev` starts Angular on `http://localhost:4200/`.
- `npm run build` creates a production build in `dist/`.

From the repository root, use `npm run dev:web` and `npm run build:web`.

## Structure

- `src/app/core/models` contains shared domain types such as `HubLayout`, `HubElement`, and game-state models.
- `src/app/core/services` contains state and integration boundaries: auth, hub storage, game data, data bindings, language, and OBS.
- `src/app/features/editor` contains the editor feature module and its component split.
- `src/app/features/renderer` contains the hub renderer used by the editor, layout previews, and OBS overlay route.
- `src/app/features/layouts`, `auth`, `landing`, and `overlay` own their page components.
- `src/styles` contains global styles migrated from the previous app. Feature-specific style entry files live beside each module under `features/*/styles`.

## Notes

The editor stores element positions in fixed 1920x1080 broadcast-canvas units even though the canvas scales responsively in the browser. See `CanvasEditorComponent.getCanvasPoint` and the pointer handlers in `HubEditorComponent` for the conversion logic.

Hub editing is local-first. Every layout mutation goes through `HubEditorComponent.updateHub`, which refreshes `updatedAt` and writes a local draft via `HubStorageService.saveHubLocally`. Explicit Save still attempts the backend and falls back to local storage if the API is unavailable.
