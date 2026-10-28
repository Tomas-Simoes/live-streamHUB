# CSS entry recovery on 27 October

Source: `ai-hub-diagnostic-2026-10-27T15-40-43-346Z.json`, Qwen3 4B, pipeline v7. The unchanged charcoal/teal/orange prompt failed after four attempts in **409.36 seconds**. Phi and optional reasoning were off.

## Evidence

Interpretation took **31.74 seconds / 378 output tokens**, versus 182.77 seconds / 1,419 tokens in the preceding diagnostic. The compact-plan change reduced the work in this run, but did not fix the CSS recovery path.

Four full generations followed: **84.34, 98.13, 99.02 and 96.08 seconds**. None reached a preview. The first, third and fourth mixed bare root declarations with complete selector rules. The parser accepted either format alone but rejected the mixture. The second wrapped its declarations, but root `display:inline-block` was prohibited as frame geometry. These failed before a `HubPlan` was returned, so recovery lost the candidate and asked for complete generation again.

All four responses also referenced `ai-decoration-portal`, which was neither created nor requested. The compact plan incorrectly treated the requested half-width geometry as immutable geometry of the original hub. It used a layer ID as a CSS selector for the width check and described a portrait-frame colour as an unsupported background measurement. Those problems were hidden behind the earlier parser failures.

## Pipeline v8

`2026-10-27-css-authoring-recovery-v8` addresses the recovery mechanism:

- PostCSS wraps each run of bare component declarations in `& { ... }`, in place. Values, order, comments, normal rules and conditional blocks are retained. Existing scope/resource/geometry validation still runs on the normalized AST.
- Root `display` modes that retain a frame box (`block`, `inline-block`, flex/grid variants and `flow-root`) are accepted. Root `none`, `contents`, indirect display values, dimensions, position and transforms still require the appropriate structural handling. Internal presentation remains general CSS.
- A schema-valid response with invalid CSS retains its candidate and identifies each offending operation index. Preflight batches invalid CSS and missing CSS targets before rendering.
- Indexed revisions can replace one stylesheet, retarget or remove an entry. Untouched CSS is retained. Invalid measured patches are combined with their retained baseline before entry correction, preventing loss of previously valid work.
- Creation starts from a new scaffold and does not freeze geometry/content of the previously open hub. Interpreter-generated creation constraints are recorded as ignored; the complete original instruction still reaches the designer. Edit preservation remains enforced.
- A requirement selector that names its exact source layer ID resolves to that frame, including after preview-ID remapping. Malformed colour measurement references remain explicitly unverified rather than becoming false background failures.
- Readability and measurable instruction failures are sent together in one CSS repair request, rather than requiring separate rounds merely to discover the next category of problem.
- Style errors expose the concrete reason instead of only saying “unsupported component style.”

## Additional measurement bug found during replay

The first browser replay reached the preview and exposed a false failure: portrait widths were zero because the new requirement checker intersected them with ancestors outside the review canvas. The review stage is deliberately rendered offscreen. Measurements now intersect images with clipping ancestors only through the preview root, excluding the dialog and page viewport. Actual clipping inside slots/rows/components is still measured. A dedicated offscreen regression and actual-browser portrait/item comparison cover this boundary.

## Verification scope

The exact original response and all four attempted formats are preserved in `src/web/tests/fixtures/ai-mixed-css-response.json`. Node regressions cover normalization/cascade order, isolation and resource rejection, root frame containment, candidate retention, batched indexed replacement, invalid patch recovery, creation geometry, malformed colour checks and offscreen measurements.

The browser fixture explicitly removes the unrequested portal stylesheet, then supplies a controlled CSS patch for the measured layout and original requirements. These corrections are scripted test responses, not new Qwen inference. Browser replay verifies that actual rendering, validation, preview, apply and save can complete from the exact original generation. It cannot guarantee the artistic judgement or future output of Qwen.

The total ten-minute budget and four-attempt ceiling remain. No fallback visual template or silent deletion of invalid model entries is introduced. Phi stays off for the current evaluation.

Final verification: **237 Node tests passed**, TypeScript checking and production compilation passed. The final Chrome replay `tmp-visual-qa/ai-hub-builder/recovery-v8/exact-mixed-css-final/evaluation.json` passed with exactly `generation → proposal-repair → style-repair`, no browser runtime exceptions, one saved layout, ten portraits and sixty item slots. The scoreboard measured 50% of canvas width; portrait sides measured 24 displayed pixels against item sides up to 18.7 pixels. The malformed frame-colour measurement remained unverified. The 1280-pixel screenshot was inspected. These are factual geometry/validity results; the interpreter's clause association and overall visual quality remain subject to review.

The existing hub-library browser regression also passed on this build, including native previews and creation/navigation/save behavior, with no runtime exceptions. This checks the shared CSS normalization path against the existing templates.
