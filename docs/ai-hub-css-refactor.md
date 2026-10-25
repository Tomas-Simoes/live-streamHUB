# AI Hub Builder: CSS authoring refactor

## Objective and scope

Users describe a broadcast in ordinary language. The model owns the artistic decisions. The application provides reusable live-data components, broad isolated CSS, structural tools, and technical checks. There are no keyword-triggered style recipes and intent does not select a property whitelist.

Keep the Angular editor, layer model, history, hub storage, preview and broadcast export. Do not add cloud inference, training, another editor, or a new aesthetic judge.

## Implementation plan

1. Inspect the existing worker → interpretation → plan → compiler → preview → storage/export path.
2. Add parsed/scoped component stylesheets and incremental declaration patches in existing `style.customCss` storage. Use AST parsers for selectors, values and stylesheets, not regular-expression scoping.
3. Expose semantic component structure and current styles; use the same unrestricted presentation contract for creation and editing. Keep native structural operations for actual layer geometry/data visibility.
4. Replace intent permissions and visual post-processing with a descriptive brief, explicit preservation constraints, and validation feedback.
5. Populate reusable references from approved native hubs, including real geometry/CSS and optional edit/preview metadata; provide a dataset export format without implementing training.
6. Test isolation, persistence, native bindings, patches, constraints, recovery and budgets. Distinguish deterministic response tests from real model/browser inference.

## Decisions

- CSS stays with the real layers and follows normal Save/Undo/Redo/preview/export. Model output contains a short summary, per-target stylesheet patches, and structural operations.
- All presentation properties supported by the browser are available. Resource loading and scope escape are prohibited. Layer frame geometry uses structural operations so editor handles and exports agree.
- CSS pixel values use the existing 1920×1080 native coordinate convention and are scaled when rendered, without changing their persisted source.
- Creation begins with reusable functional scoreboard and two five-player rosters; no approved visual preset is silently substituted on failure.
- Technical validity, instruction compliance and advisory visual review remain separate. Ambiguous aesthetic requirements are reported as unverified, not certified by numeric layout checks.
- Local inference remains bounded by the shared ten-minute deadline. Prefer small edit/repair patches over full regeneration and avoid sending the application source.

## Verification

- `node --test` (21 October): **178 passing tests**, no failures or skipped tests. Includes controlled model responses for general CSS, independent natural-language scenarios, complete tool availability, preservation, incremental corrections, timeout/cancellation, real store Save/Undo/Redo/reopening, resource inventories and indexed proposal repair. Controlled responses establish pipeline behavior, not model design skill.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json`: passed.
- `npm.cmd run build` (21 October): passed. Initial bundle 1.12 MB, 115.08 kB over the existing 1 MB warning budget. Parser/Ajv/OBS dependencies produce CommonJS optimization warnings; these were not suppressed.
- Controlled Chrome rendering on the final build: `css-native-render-final/evaluation.json` under `tmp-visual-qa/ai-hub-builder`: passed. Actual browser, preview, apply and save; replayed CSS response, not live model inference. Confirms authored colours apply, readable native binding baseline, ten portraits, sixty item slots and representative row measurements. Screenshots at 1920 and 1280 pixels were captured; the 1280 screenshot was inspected.
- `node tests/hub-library.browser.mjs`: passed. Existing template previews, multiple viewports, saved-hub previews, failed-save retry, duplicate-submit prevention and editor navigation; no browser runtime exceptions. The harness's fixed pending-request delay was replaced by explicit release after observation to eliminate a test race.
- Real Qwen development runs exposed an interpreter output truncation, incorrect native row tracks/clock containment, font-leading false clipping, stale reference excerpts, and excessive repeated correction output. These issues were corrected rather than adding artistic recipes. A subsequent pre-final run still timed out on undersized item icons; the final correction interface adds actual row fields and measured cell geometry. Final live-inference results are recorded below separately.

### Live-inference evidence

The final-build Qwen run (`css-authoring-real-v4`) was cancelled by the QA operator while interpreting the request. The GPU reported 100% utilization and 5,825/6,144 MiB occupied while another application was using it; only 128 interpretation characters were produced after several minutes. The QA generation and dedicated test browser were closed; user applications were left running. Details are in `tmp-visual-qa/ai-hub-builder/css-authoring-real-v4/operator-cancellation.json`.

This is **not a passing model test** or evidence that the final correction prompt solves the earlier real model failures. Final model latency, instruction adherence, and LEC/LCK-level aesthetics remain unverified under uncontended GPU conditions. The ten-minute limit bounds work; it cannot guarantee a valid answer from any particular model or resource configuration. Phi image feedback remains optional and was exercised with controlled responses, not benchmarked for real visual-quality improvement in this verification.

### 21 October: user-reported missing-target failure

The user's real Qwen log for pipeline `2026-10-20-css-authoring-v1` took 365.58 seconds. Generation took 99.34 seconds and two full-regeneration retries took 117.45 and 110.08 seconds. Every attempt failed on `player-header`, which had been advertised despite being absent from the neutral scaffold. `phases` was empty: no preview or visual review ran. The raw model output also allocated five tracks to a six-field right roster and used blue/coral colours instead of the requested teal/burnt orange.

Pipeline `2026-10-21-css-authoring-resource-repair-v2` fixes the inconsistent resource inventory, constrains resource names in the decoder (without constraining presentation properties), adds atomic indexed removal/retargeting of invalid proposal entries, and reports the missing layer clearly. New regression tests cover this exact response, all native preset aliases, custom heading creation, arbitrary retargeting, invalid revision indices, preservation of untouched CSS, and transition from proposal repair to measured CSS repair.

Browser replay `tmp-visual-qa/ai-hub-builder/missing-target-regression/evaluation.json` passed technical rendering, preview, apply and save checks. It starts with the user's exact original response. Two **controlled** repair responses explicitly remove the nonexistent optional heading style and repair the right-row tracks. The final preview retains ten portraits and sixty items. The screenshot at 1280 pixels was inspected. These repairs are test fixtures, not automatic application decisions and not live model outputs. The screenshot still shows the model's original blue/coral identity and inconsistent table typography; no subjective-quality pass is claimed. Real Qwen inference on the new decoder/repair contract was not run, respecting the user's request to defer performance measurement.

## Current architecture

`LocalAiService` interprets ordinary language into a descriptive `DesignBrief`: goals, preferences, targets, scope, functional requirements, explicitly protected aspects, and unsupported functionality. This brief never filters the response schema. The original instruction also reaches the designer unchanged (up to the explicit 6,000-character input budget).

`hub-targets.ts` is the shared resource matcher for compilation, context, constraints and decoder inventories. Only existing aliases are advertised: the neutral scaffold has no implicit `player-header` or branding panel. Interpretation and design decoding constrain **resource names** to existing targets and supported creations while leaving all CSS properties and structural tools available regardless of intent. New decorations are addressed by `ai-decoration-KEY`; runtime compilation still verifies they were actually created. Existing presets expose their real optional header/branding aliases.

Explicit preservation boundaries are checked against the original hub. A narrow request can protect geometry, typography, content, visibility, or allow changes only to a specified CSS selector and properties. These boundaries represent the user's restrictions; they do not select stylistic tools. Source-level CSS checks cannot prove every indirect effect of arbitrary CSS. A failed preservation check requests a corrected response against the original hub rather than stacking cosmetic undo rules.

The browser-local Qwen worker returns one response:

```json
{
  "summary": "A short description of actual design decisions",
  "styles": [{ "target": "players", "mode": "patch", "css": "[data-component-part=\"name\"] { letter-spacing: .6px; }" }],
  "operations": []
}
```

`hub-design-spec.ts` validates this transport contract and converts the response into the existing `HubPlan`. `hub-plan.ts` compiles that plan into the existing editable layers. Creation uses `hub-scaffold.ts`, which reuses the scoreboard and two roster implementations without the CBLOL preset's custom CSS, artwork or branding. No fallback preset is substituted when parsing or validation fails.

CSS is the visual interface. Native operations handle real layer frames, movement, size, component visibility/configuration, decorations and static text. The compiler does not reflow, fit fonts/icons, clamp positions or append artistic recipes in the authored-CSS path. Invalid geometry returns a validation error.

The same real preview performs rendered checks before a proposal is offered. Failure messages return to Qwen as focused patches against the candidate, retaining the previous valid work. A malformed repair remains a repair rather than accidentally restarting a full design. Explicit preservation constraints are checked against the original hub. Optional measurement/Phi review remains advisory and budgeted; it does not certify unmeasured instruction compliance or aesthetic quality.

## Styling contract

- Target a layer ID or `all`, `scoreboards`, `players`, `blue-players`, `red-players`, `texts`, `player-header`, or `branding`.
- `&` addresses a layer root. `body`, `html` and `:root` are parsed as component-root aliases, never document-wide selectors.
- Scoreboard: `.scorebug` / `[data-component-part="surface"]`; team sections, center, team codes/logos/seeds/gold/towers, kills, clock and objectives each have stable `data-component-part` attributes. `.team-lockup` groups a code with its seed.
- Tables: `.player-roster[data-team]` → `[data-component-part="row"][data-player-role]` → name, portrait, level, CS, KDA, gold, items → item → image. `items` means the six-icon strip; `item` means one slot. Visibility flags are included in model context.
- Static text uses `.text-layer` / `[data-component-part="text"]`; images remain native image elements.
- Any presentation property/value supported by the browser is available, including author-defined custom variables, grid/flex, gradients, typography, filters, clipping, pseudo elements and locally named keyframes. There is no font/palette/visual-property whitelist for the new stylesheet interface.
- Root frame geometry stays in native layout operations so selection handles, preview and saved dimensions agree. Internal geometry and decorative pseudo-element geometry are CSS.
- Rules may use local selectors and `@media`, `@supports`, `@container`, `@layer`, and `@keyframes`. Flatten nested selectors. Imports, remote fonts/images/resources, dynamic resource functions, global escape selectors and root sibling selectors are rejected.
- Keyframe and cascade-layer names are namespaced per rendered instance. Preview IDs continue to be remapped independently of the editor.

`authored-css.ts` uses PostCSS, selector-parser and value-parser ASTs. These packages were already transitive development dependencies and are now declared runtime dependencies because syntax validation, selector containment, value/resource checks, patches and rendering require them. This is security/structural parsing, not a library of artistic solutions.

## Persistence, patches and manual editing

The only persisted stylesheet source is the existing `layer.style.customCss`, with a marked authored section. There is no second database field or temporary preview-only sheet. Normal layout serialization, backend free-form layout storage, Save, Undo/Redo and reopening retain it. Existing native custom CSS and legacy saved designs remain supported.

A patch replaces matching declaration identities inside the authored section while retaining unrelated declarations, selectors and conditional contexts. A complete replacement intentionally clears that target's old custom CSS. Overlapping targets follow response order: a later replacement clears earlier rules for the same layer; the prompt recommends patches for specializations after a shared foundation.

Authored rules render after native defaults and can override existing inline presentation bindings. Ordinary inspector edits remove conflicting authored declarations before updating native values. Unrelated authored styling is retained. The existing Advanced CSS inspector exposes the actual saved source.

Pixel values remain stored in native 1920×1080 units. Rendering converts numeric CSS dimensions through parsed values to layer-relative container units; strings are untouched. Resizing recomputes the rendered sheet from the same saved source.

Existing OBS export currently creates/selects an OBS scene; it does not implement a full browser-source export of hub layers. This refactor does not add that missing export subsystem. Layout serialization and all existing web renderers retain CSS; an actual OBS session is a separate integration check.

## Native functional baseline

Native row tracks now follow the actual visibility flags and mirrored DOM order instead of reserving seven columns regardless of the rendered fields. The clock stays inside the scoreboard's grid. Default text is readable at the standard frame sizes. These are component defaults, always overridable by authored CSS; they are not post-generation choices based on user wording.

Rendered validity measures clipping, hidden fields, contrast, frame overflow, icon/text readability and overlapping live content, including across component frames. Translucent surfaces are composited over known underlying panel surfaces before contrast checks. CSS colour functions are resolved by the browser. Font leading alone is not treated as clipped ink: vertical checks use glyph metrics when available.

The functional row-field order and default track definitions come from the same helper used by rendering. Correction feedback includes representative rows' cells, x/y positions, computed column/row tracks, slot dimensions and actually visible image dimensions. IDs are mapped explicitly from the review preview back to original layers. Validation measures both dimensions of images intersected with their clipping ancestors: increasing an img cannot falsely pass a collapsed slot.

`hub-layout-recovery.ts` can attempt one local, mechanical correction per run when measured implicit grid wrapping collapses item slots. It derives tracks from the actual visible bindings and releases conflicting field placements. It changes no colours, fonts, frames or decorative treatments. Explicit preservation constraints are checked, the entire hub is rendered again, and the trial is retained only if all rendered validity checks pass. A rejected trial leaves the original candidate intact and supplies causal evidence to model repair. The correction is reported in warnings/metrics and remains ordinary editable, saved CSS; it does not force a preset.

A dedicated short correction prompt asks the model for remaining CSS repairs against the retained candidate. It receives the previous ineffective patch, causal geometry, current rules and user constraints rather than all unrelated colour facts. Repeated-proposal detection compares actual model responses, not equal measurements. Different but ineffective CSS receives another opportunity within the same four-attempt/ten-minute ceiling; identical repeated patches still stop.

Invalid resource references are corrected before rendering through `hub-proposal-repair.ts`. Compiler errors identify the proposal entry index. The model can explicitly remove that entry, retarget it, or create a genuinely requested decoration and retarget its style. Untouched CSS is retained exactly; there is no automatic deletion of invalid entries or fabricated header. These corrections use a small response (900-token ceiling) instead of regenerating the complete design. Subsequent measured layout problems use the existing CSS patch path. Error summaries identify the missing target rather than reporting generic misconfiguration.

## References and future datasets

`hub-reference-records.ts` stores versioned approved source records: description, full native structure, real CSS, decision/effect annotations, optional preview assets and explicitly approved before/instruction/after editing examples. Pulse, Offset and Foundry populate the initial records. CSS excerpts merge final overrides so obsolete CBLOL baseline declarations are not presented as the approved preset's identity.

The generator receives small relevant textual/CSS excerpts, never images as if Qwen could understand them. Layout declarations and dependent field placements form an atomic group: either all fit the context budget or only surface/type rules are included, explicitly marked as geometry omitted. Previously a five-column Pulse grid was supplied without the level/portrait shared-track placements, teaching an invalid fragment. Reference field lists are supplied alongside the excerpt. Complete reference records can be exported as JSONL. Only explicitly approved editing examples produce SFT message pairs; the initial records have no fabricated approved edits. No training, automatic approval or paid provider is implemented.

## Reported item-grid failure (2026-10-21)

The supplied run stopped after 206,111 ms (about 3m26s), not at the deadline. Both player rows had six fields but copied five tracks; auto-placement created a second row and collapsed icons. The model's img-only repair did not fix the containing slots. Equal rendered measurements then triggered the misleading repeated-proposal stop.

The exact original model generation and its failed repair are preserved in `tests/fixtures/ai-item-grid-response.json`. Run the Chrome harness with `AI_QA_CSS=1 AI_QA_NO_REVIEW=1 AI_QA_SINGLE=1 AI_QA_REPLAY=tests/fixtures/ai-item-grid-response.json`. The fixture requires successful local recovery, one model response, full native bindings, valid images and original-ID mapping. This is a recorded-output replay with real compilation, browser rendering, validation and Save; it is not fresh Qwen inference or a claim of improved artistic ability. The replay corrected visible image sides from 19.6/8.9 to 37.8 native px, with no additional model correction.

## Budgets and limits

- The interpretation response now includes a concrete proposed identity, composition, typography and player-row plan. These are free-form design decisions, not a whitelist of permitted styles or verified visual results. Older saved briefs remain compatible.
- Qwen's optional **Think before styling** pass is off by default. It runs once without JSON grammar, before the schema-constrained CSS response: 384 output tokens, a cooperative 45-second limit and a 55-second worker watchdog. It shares the ten-minute deadline and is skipped when there is insufficient time left for generation and validation. Corrections do not repeat thinking. Internal provisional notes inform CSS; diagnostics expose timing/termination rather than the notes.
- Shared ten-minute deadline, four generation/correction attempts maximum, and at most one optional design refinement.
- Qwen context: 8,192 tokens. Output ceilings: 1,000 interpretation; 2,800 creation; 2,200 editing; 900 proposal-entry correction; 1,400 rendered CSS correction; 420 review tokens.
- Current CSS context is compacted and bounded. Only complete rules are supplied; omitted CSS is flagged and retained by normal patches. Broad redesigns of very large hubs may require successive edits.
- There are operational response/rule size bounds. They bound browser/memory/inference work, not permitted aesthetics.
- Fine-grained free-text preservation notes remain instructions to the model; only the represented preservation aspects are mechanically verified. Other visual goals remain explicitly unverified.
- CSS cannot create a new functional widget, data source, font download or arbitrary HTML/JavaScript. These are component/hosting capabilities, not styling recipes.
- Architectural CSS support does not establish the artistic ability or reliability of a 4B model. Actual inference results must be reported separately from controlled-response tests.

## Follow-up evaluation

Use the six creation prompts and off/on comparison procedure in [the creation benchmark](ai-hub-creation-benchmark.md). Pipeline version `2026-10-21-css-authoring-bounded-thinking-v4` identifies this experiment. `AI_QA_REASONING=1` enables the switch in the browser harness; when combined with a recorded-response fixture, planning is also explicitly mocked, so that replay verifies integration rather than model reasoning or artistic improvement.

Run a small fixed creation/edit suite with an available GPU and record completion rate, end-to-end latency, correction count, preservation, instruction adherence and human visual comparisons. Include imperfect language and visual identities unlike the reference hubs. Compare optional Phi review enabled/disabled on the same inputs before making it a default. Evaluate stronger inference options only against these results. Accumulate explicitly approved before/instruction/after examples in the existing export format before considering fine-tuning; adding reference records supplies context and does not update model weights.
