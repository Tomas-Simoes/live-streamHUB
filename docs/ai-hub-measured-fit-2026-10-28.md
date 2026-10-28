# Recovery of collapsed component containers

Diagnostic: `ai-hub-diagnostic-2026-10-27T16-20-33-527Z.json`, pipeline v8, Qwen3 4B. The run stopped after 194.61 seconds, not at the ten-minute deadline. Interpretation took 29.18 seconds, generation 77.34 seconds, and two ineffective repairs 40.90 and 43.20 seconds. Phi was off. Every repair reproduced the same measurements.

## Causes

- Six grid columns were assigned to the outer layer, which has one native renderer. Its 600px table was compressed into a roughly 128px column; row width measured 124.5px. The previous local repair checked only implicit wrapping inside player rows, so it did not recognize this parent collapse.
- Generated `.portrait`, `.item`, `.name`, `.cs`, `.kda`, `.blue-team` and `.red-team` rules did not address the native DOM. Both subsequent repairs increased dimensions of unmatched selectors and changed no pixels.
- Root CSS pixels were converted using the layer width even though root query units resolve against the 1920px canvas. In a 600px layer, root `font-size:16px` became 51.2px. Descendant rules query the component and need the component width instead.
- The scoreboard width remained 1200px instead of the quoted half-canvas request. Root padding pushed score content outside its frame. After fitting the scoreboard to 960px, the native clock measured 9.6 displayed pixels, just below the existing readability threshold.

## Pipeline v9

Version: `2026-10-27-css-authoring-fit-v9`.

Exact semantic part names are accepted as class shorthand and normalized through the CSS AST to native `data-component-part` selectors. Arbitrary existing classes, values, conditions and security checks remain supported. The stored patch identity uses the normalized selector, so a later `.item` correction and a native attribute correction address the same declarations.

Root and descendant rules use their actual query-container widths when compiling native pixels, including selector lists combining both. Saved numeric values remain in native units.

Measurements now include outer frame, renderer and surface widths; maximum rendered text width across all five players; field fonts; and scoreboard text sizes. Preview IDs are remapped to real layer IDs. Generation/repair prompts explain which container holds the renderer, five rows and individual player fields.

Before another model request, up to **three local trials per run** can repair measured container collapse, undersized content, conflicting row allocation, scoreboard padding overflow and a failed quoted frame-width requirement. Changes retain authored palette and font family. Column minima derive from visible fields and measured text; impossible fits and deliberately positioned overlays go back to the model. These are technical fit rules, not an artistic fallback template.

Each trial uses the existing overall ten-minute budget, preservation checks, binding checks and a fresh browser measurement. A trial is retained only if failure count drops. New hidden/outside/overlapping bindings, clipped text, failed images or newly failed user checks reject the trial. Passing requirement checks cannot disappear into an unverified state. Partial improvements can be retained while remaining failures continue through correction; no invalid candidate is published. Repeated identical local operations are not retried. Optional Phi stays off.

## Evidence

`tests/fixtures/ai-container-collapse-response.json` contains the exact original instruction, interpretation and generated proposal. The two failed real repairs are retained for regression analysis, but **no scripted replacement repair is provided**.

The real Chrome replay at `tmp-visual-qa/ai-hub-builder/recovery-v9/exact-final/evaluation.json` completed preview, apply and save with only `init → interpret → generate`; zero repair model calls, one generation attempt, two accepted local trials. Local measurements took approximately 198 and 231ms in this controlled run. These times exclude live Qwen inference and are not a generation-speed benchmark.

Final measured row widths: 580.8 native pixels. Actual visible item images: 28 native pixels. Scoreboard: 960 native pixels, 50% of canvas. Clock: 10 displayed pixels; names: 13.2; CS: 12; KDA: 10. Ten portraits and sixty item slots were retained; no measured clipping, outside/hidden/overlapping content, contrast failure or missing image remained. Root 16px fonts measured approximately 16px rather than 51.2px. Both generated team gradients reached the actual scoreboard. The 1280px screenshot was inspected.

Verification: **243 Node tests passed**, TypeScript checking and production compilation passed. After the final container-contract prompt clarification, the 55 relevant CSS/recovery tests passed again. The existing hub-library browser regression completed with no runtime exceptions. A second final Chrome run with the normal measurements review enabled (`recovery-v9/exact-default-review/evaluation.json`) also completed preview, apply and save, with no repair calls; its review response was controlled, and Phi was off.

The replay confirms recovery of this exact failure without hand-authored model corrections. It does not establish professional aesthetic quality, complete subjective instruction fulfilment or the reliability/speed of a fresh live model run. The interpreter still associates the portrait comparison with the wrong original clause in this diagnostic; the full portrait request remains visibly unverified rather than being dropped. Gradient checks remain limited to measurable presence, not artistic palette/direction approval.
