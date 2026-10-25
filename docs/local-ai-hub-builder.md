# Local AI Hub Builder prototype

The current implementation uses general component CSS authoring. See
[CSS authoring architecture and validation](ai-hub-css-refactor.md) for the active
contract, removed intent permissions, persistence and current limitations.
The earlier operation-based contracts and benchmarks below are historical.

For the current design workflow, internal context and independent composition,
see [AI hub design knowledge](ai-hub-design-knowledge.md). Earlier model
benchmarks in this document describe their recorded versions and prompts.

The prototype runs model inference in a dedicated browser worker. Detailed editing
now defaults to Qwen3 4B; the original 1.7B model remains available for basic
customization. Optional Phi feedback now reviews Qwen's actual preview, with
sequential model loading in the same worker. Phi can also handle the full
generation/review process. See [creative control and visual critique](ai-hub-creative-control.md)
for its memory estimate and the default lighter measured review.
No inference endpoint,
API key, paid service, or backend model process is involved. Open an existing hub in the
editor, click **AI Hub Builder**, load a model, choose **New design** or **Edit current hub**,
and generate a proposal. Apply it after reviewing the preview, then use the normal
editor controls and Save. Applying automatically selects edit mode for follow-up requests.
Closing the panel terminates its worker; reopening uses cached model assets.

## Existing application integration

Hubs persist as `layout.backgroundId` and `layout.layers` through `HubStore` and the
existing owner-scoped hub API. Layers use **center coordinates** on a 1920 × 1080
canvas; earlier layers render in front. The seven predefined templates build real
`EditorLayer` objects. Scoreboards are `LolScorebug`; each `LolPlayerRoster` contains
five roles and six item slots per player. There are also individual portrait, item,
name, CS, KDA, gold and other stat layers.

The AI produces a native specification and checked component-part CSS values,
never HTML, selectors, scripts, resource URLs or complete layer objects.
New designs choose independent colours, fonts, component treatments and dimensions,
informed by structured approved hub evidence. Edits use fixed nullable appearance,
padding and objective-stat fields plus optional operations for other changes; these
are compiled into the same validated operations. Current hub state supplies context,
including current visual settings, without replaying an old plan that might override it:

```text
Instruction + bounded current-hub context
  → interpretation into changes, preservation and limitations (same model)
  → WebLLM worker + schema-constrained decoding
  → Ajv plan validation
  → native component composition + deterministic operations
  → layout validation (bounded local corrections)
  → existing HubPreviewComponent + optional rendered-design critique
  → at most one aesthetic refinement (ten minutes total across the run)
  → one HubStore history entry → existing editor → existing Save API
```

Operations cover named themes, moving/resizing layers, scoreboard flags and team
codes, roster portraits/spacing/stat visibility, typography, adding scoreboards or
rosters, and removing/hiding layers. Selectors include semantic component sets or
existing layer IDs. Edit mode constrains the model's template choice to `current`.
User layers, IDs, media and player overrides are preserved during edits unless the
plan explicitly targets them. New designs replace the layout only after Apply.

Named theme edits use eight readable palettes. New compositions use independent
hex colour roles with contrast validation and derived readable secondary shades.
There are no prompt
lookups, fixture responses or keyword-to-layout routing in the inference path.
Explicit appearance edits now also accept constrained named shades or validated
six-digit hex colors for gradient stops and outlines, plus bounded outline width
and horizontal padding. Generated CSS is assembled by trusted application code for
the existing style system. A visible list describes the actual proposed operations;
no-op edit plans are rejected and enter the bounded repair loop.
New compositions declare their scoreboard and roster dimensions directly. Existing
hubs retain their dimensions in edit mode unless resizing is requested. Linked
editable team logos follow scorebug movement/scaling, and joined roster furniture
reflows with its tables.

Preview layer IDs are remapped so their scoped CSS cannot change the live editor.
Apply rejects stale proposals after any intervening hub edit or hub switch. Undo,
redo, dirty tracking and persistence use the existing store.

## Technology choice

| Option | Advantages | Tradeoff / decision |
| --- | --- | --- |
| WebLLM 0.2.86 | WebGPU, JSON-schema decoder constraints, streaming, caches, worker support, explicit unload | Selected; requires a working GPU adapter and shader-f16 for the selected models. |
| Transformers.js | ONNX Runtime, WebGPU and CPU/WASM paths, quantized models | Plausible CPU fallback, but adds another model/runtime download and a separate structured-generation path. Investigated, not implemented or benchmarked here. CPU generation latency needs measurement before promising it. |
| Chrome Prompt API | Browser-managed local model lifecycle and structured output options | Browser/hardware availability and model control differ; would need a separate adapter. Not a reliable cross-browser baseline for this experiment. |

Sources: [WebLLM workers](https://webllm.mlc.ai/docs/user/advanced_usage.html),
[WebLLM API](https://webllm.mlc.ai/docs/user/api_reference.html),
[Transformers.js](https://huggingface.co/docs/transformers.js/index),
[Transformers.js WebGPU](https://huggingface.co/docs/transformers.js/guides/webgpu),
[Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api).

Current detailed-editing model: **Qwen3-4B-q4f16_1-MLC**, non-thinking mode, with
**Qwen3-1.7B-q4f16_1-MLC** available for basic customization. Both model cards declare
Apache-2.0. The 1.7B results below describe the initial template prototype, not a
guarantee for multi-property appearance edits. Smaller Qwen variants were investigated; the 0.8B browser experiment
produced repetition and semantic mistakes, so it is not offered in the prototype UI. WebLLM is
Apache-2.0. The model repository and compiled WASM library are fetched from
Hugging Face / MLC's GitHub-hosted assets. Hosting serves ordinary static JS;
the backend only persists accepted hub configurations.

Sources: [Qwen3 4B model/license](https://huggingface.co/Qwen/Qwen3-4B),
[Qwen3 1.7B model/license](https://huggingface.co/Qwen/Qwen3-1.7B),
[Qwen2.5 0.5B model/license](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct),
[WebLLM license](https://github.com/mlc-ai/web-llm/blob/main/LICENSE),
[model catalog and VRAM estimates](https://github.com/mlc-ai/web-llm/blob/v0.2.86/src/config.ts).

## Validation and resource behavior

- Ajv rejects unknown operations/properties, out-of-range values, invalid selectors
  at compilation, and arbitrary code or media sources. The same schema constrains decoding.
- Canvas bounds are clamped deterministically for changed layers. Minimum sizes are
  checked for scoreboards, rosters, standalone portraits and item slots.
- New intersections between visible content layers reject the proposal. Decorative
  shapes/images and groups may intentionally overlap; pre-existing layout issues
  remain warnings during edits. This is geometric validation, not pixel-level proof
  that custom user CSS cannot hide content.
- Roster grid rules budget portrait, name, CS, KDA, gold and six-item columns.
  Template header/background furniture follows increased roster height. Unsupported
  changes or unresolved collisions fail without modifying the hub.
- Validation errors go back to the same local model for up to three corrections,
  within one ten-minute total limit. Repeated invalid proposals or persistent
  identical issues stop early. The interface explains each correction and the
  eventual stopping reason. See [validation and repair](ai-hub-validation-repair.md).
  Runtime failures, timeouts and GPU device loss terminate the worker and require reload.
- WebGPU capability is probed before loading. Unsupported browsers show a clear
  message and retain the manual editor; there is no silent cloud fallback.
- Model code is a separate worker bundle, instantiated only on Load. Progress and
  streamed output are shown. Cancel terminates the worker, including an in-flight
  download/generation; a subsequent load reuses completed cached assets.
- Unload calls `engine.unload()` and terminates the worker. Closing the panel or
  leaving the editor also terminates it. Disk cache is retained. Browser/driver
  garbage collection controls when physical memory returns; exact recovered GPU
  memory cannot be measured through the ordinary browser APIs used here.
- HTTPS or localhost is required. Cache Storage is best-effort, origin-specific,
  and subject to storage quotas/eviction. First load needs network access; a cached
  model does not by itself make the whole Angular/auth application an offline app.

## Reproduce and inspect

```powershell
cd src/web
npm install
npm test
npm run build
npm run test:ai-browser
```

The browser runner uses installed Chrome with real WebGPU and real model inference.
Set `CHROME_PATH` to another Chromium executable as needed. It serves the production
build on localhost port 4277 (`AI_QA_PORT` overrides it). Only auth and hub storage
responses are stubbed in this isolated runner; no AI results are mocked. It clicks
through the actual application, applies/saves real generated layers, and records
screenshots, structured outputs, timings and validation results under
`tmp-visual-qa/ai-hub-builder/template-regression/` (current template tests) or
`appearance-regression/` (appearance tests). The original report and screenshots
remain directly under `tmp-visual-qa/ai-hub-builder/`. The retained `chrome-profile/` is ignored by Git and
holds model caches. Use **Structured output & performance → Download evaluation
JSON** for measurements on other devices.

The browser runner adds `--enable-unsafe-webgpu` to exercise the available hardware
in headless Chrome. Results demonstrate that configuration, not browser availability
on every consumer machine. Production does not set flags or bypass compatibility checks.

## Initial template evaluation — 15 October 2026 (Qwen3 1.7B)

Environment: Windows, headless Chrome 155, NVIDIA GeForce GTX 1660 SUPER (Turing),
WebGPU shader-f16. The GPU name was also checked through Windows' video-controller
information. The final run used the real Qwen3 1.7B model for
all four supplied prompts. It passed schema/layout validation and the runner's
specific semantic checks **4/4**, with **zero repair attempts** in that run. All
four results were applied, rendered by the real editor, and sent through the
normal Save flow to the isolated storage stub. No live PostgreSQL/backend end-to-end
save was exercised by this browser runner.

| Scenario | Generation + validation | Observed result |
| --- | --- | --- |
| Minimal dark blue | 13.51 s | Atelier + navy, clean compact top scorebug, two bottom rosters. |
| CBLOL | 8.73 s | Existing CBLOL layout, reddish/cream palette, visible portraits/items and team statistics. |
| Follow-up edit | 8.94 s | `current` template, portraitSize 48, gap 8, dy -12; original IDs retained. Rendered portrait width increased from about 44.8 to 47.5 canvas pixels. Scoreboard was already at the top; the requested upward move was clamped and reported. |
| Futuristic | 8.33 s | Pulse + neon, compact scorebug, ten players, ten CS and ten KDA fields, sixty item slots. The compact size comes from the common AI template rule, not an invented model resize. |

Raw output, request usage, generated layers, captured browser configuration and
checks: [final evaluation JSON](../tmp-visual-qa/ai-hub-builder/evaluation.json).
Native canvas screenshots:
[dark blue](../tmp-visual-qa/ai-hub-builder/scenario-1-canvas-1920.png),
[CBLOL](../tmp-visual-qa/ai-hub-builder/scenario-2-canvas-1920.png),
[follow-up](../tmp-visual-qa/ai-hub-builder/scenario-3-canvas-1920.png),
[futuristic](../tmp-visual-qa/ai-hub-builder/scenario-4-canvas-1920.png).
Visual inspection confirmed readable stat rows and visible portraits/items. These
are template-derived designs, not evidence of freeform design ability or a general
100% success rate. The semantic checks cover the specified scenarios, not every
possible interpretation of a prompt.

Measured/estimated resource findings:

- Qwen3 1.7B weight manifest: **968,001,536 bytes**, about **923 MiB**, plus tokenizer,
  model configuration and compiled runtime downloads. This is manifest size, not a
  network packet trace. The smaller rejected 0.8B weights were 423,937,664 bytes.
- Initial uncached model initialization: **26.7 s** wall time in the earlier Qwen3
  integration run. Final cached initialization: **3.17–4.56 s**. Download speed and
  shader compilation vary by machine and connection.
- Decode rate: **22.6–26.0 tokens/s** in the final run. First JSON grammar
  initialization cost **7.0–7.8 s** per fresh worker. The runner intentionally
  unloaded/reopened between scenarios; it does not measure a fully warm continuous
  chat session. Keeping the panel open avoids repeated model initialization.
- WebLLM catalog VRAM estimate: **2,036.66 MB**. Actual resident RAM, GPU utilization
  and recovered VRAM were **not measured**. Browser cache usage includes previously
  tested models and must not be interpreted as this model's live memory usage.
- Explicit unload was acknowledged in **0.26–0.27 s**, including the runner's
  250 ms polling interval. Actual worker cancellation prevented a late proposal and
  allowed reloading. Chrome still listed a worker debugging target 300 ms after
  cancellation; target lifetime and physical GPU-memory reclamation remain
  inconclusive and require OS-level profiling.
- Production build: **797.64 kB initial JS/CSS**, about **189.85 kB estimated
  compressed transfer**, and a separate **6.13 MB** AI worker, about **1.46 MB
  estimated compressed transfer**. Model weights are not bundled into the app.
- **28 automated tests pass**, including real template validation, invalid plans,
  collisions, portrait reflow, attached logos, preview isolation, atomic apply,
  stale detection, undo/redo/save, cancellation races and bounded repair. The
  production Angular build passes; it reports CommonJS optimization warnings for
  Ajv and existing OBS dependencies.

Failures found and corrected were not all model failures:

| Finding | Cause / outcome |
| --- | --- |
| Early Qwen2.5 1.5B outputs used invalid sizes/targets; later ones chose poor hex colors and hid requested elements. | Model instruction following and insufficiently constrained output. Those failures motivated named palettes, clearer operation examples and Qwen3. |
| Qwen3 emitted an empty `<think>` prefix even with thinking disabled. | Runtime/template integration. The parser now normalizes only that known empty prefix and still rejects extra prose. |
| Portrait enlargement could intersect the event header; compact scoreboards detached separate logos. | Application layout integration. Deterministic frame reflow and linked-logo geometry now handle these dependencies. |
| Qwen3.5 0.8B repeated unnecessary operations, chose the wrong palette, and exhausted the output budget on later prompts despite one repair. | Model generation failure. It is excluded from the UI to keep the prototype focused on the more reliable option. |

Earlier raw runs are retained beside the final report as `evaluation-initial.json`,
`evaluation-unrestricted-palette.json`, `evaluation-qwen3-prefix.json`,
`evaluation-qwen3.5-0.8B.json` and `evaluation-before-compact-preset.json`.

The evidence supports browser-local **template customization on compatible GPUs**.
It does not yet establish cross-device performance, repeatable professional design
quality, or that a model can generate arbitrary layouts reliably.

## Scope and next steps

This is Phase A: constrained template customization. Arbitrary freeform layouts,
new component types, custom asset generation and an unrestricted chat agent are
deliberately deferred. The prototype does not certify professional visual quality
for every prompt. Semantic omissions can pass geometry validation; users must review
the preview. Larger custom hubs receive bounded context, and template-specific frame
adjustments do not reorganize arbitrary user artwork.

Next work should collect repeated runs on integrated GPUs and slower networks,
improve semantic checks and model instruction following, and measure GPU memory with
OS tooling while OBS is running. Only then expand into deterministic layout families
or a measured CPU fallback. Keep model downloads and resident allocations optional.
