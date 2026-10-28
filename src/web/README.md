# Live StreamHUB Web

Angular frontend for authentication, the hub library, the visual broadcast editor,
previews, and OBS scene handoff. See the [project README](../../README.md) for
backend setup, the Overwolf/OBS workflow, and the AI Hub Builder guide.

## Commands

Run these from `src/web` after installing dependencies:

```bash
npm run dev
npm run build
npm test
```

The development app runs at `http://localhost:4200`. Production browser assets
are written to `dist/browser`. From the repository root, use `npm run dev:web`
and `npm run build:web`. In PowerShell, use `npm.cmd` if script execution policy
blocks `npm.ps1`.

After building, browser checks are available through:

```bash
npm run test:hubs-browser
npm run test:ai-browser
```

The hub-library test uses local Chrome with authentication and persistence
stubbed. The AI harness can run live inference or controlled replays. Use the
[recorded-response replay instructions](../../README.md#useful-commands) to test
recovery without downloading or running a model.

## Structure

| Path | Responsibility |
| --- | --- |
| `src/app/core/api` | Auth, hub, media, and OBS integration. |
| `src/app/core/store` | Hub state, persistence, and OBS connection state. |
| `src/app/shared/types` | Hub, layout, layer, and user types. |
| `src/app/shared/templates` | Predefined broadcast hubs. |
| `src/app/shared/helpers` | Layer styles, scoped authored CSS, and roster fields. |
| `src/app/features/editor/components` | Editor, native layer renderers, and manual controls. |
| `src/app/features/editor/ai` | Local model worker, CSS authoring, validation, review, and diagnostics. |
| `src/app/features/hubs` | Hub library, shared previews, and OBS export controls. |
| `src/app/features/auth`, `src/app/features/home` | Authentication and home pages. |
| `tests` | Node regressions, recorded model fixtures, and browser harnesses. |

## Editor and AI Builder

Layers use center coordinates on a 1920 × 1080 broadcast canvas. The canvas scales
in the browser; authored CSS retains native units in saved layouts. AI proposals
use the existing `HubStore` history and Save flow, with isolated preview IDs and
an explicit Apply step.

The current pipeline is **`2026-10-27-css-authoring-fit-v9`**. Qwen3 4B generates
scoped presentation CSS and structural operations for native live-data widgets.
Rendered checks cover readability, containment, and measurable requirements.
Up to three local fitting trials and four model attempts share a ten-minute
generation budget; invalid proposals are not applied to the editor.

Inference requires WebGPU and a secure context (HTTPS or localhost). Qwen3 4B is
text-only. Optional Phi image feedback is off by default and has not been
established to improve visual quality. Reference annotations are context, not
model training. Download the full diagnostic before reloading after a failed run.

- [CSS authoring architecture](../../docs/ai-hub-css-refactor.md)
- [v9 recovery and verification evidence](../../docs/ai-hub-measured-fit-2026-10-28.md)
- [Visual references and optional review](../../docs/ai-hub-visual-review.md)
