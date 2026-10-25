# Design knowledge and rendered review

The latest component-level CSS controls, stricter checks and optional Qwen → Phi →
Qwen workflow are documented in [creative control and visual critique](ai-hub-creative-control.md).
Benchmarks below describe their recorded versions. The optional separate reviewer
supersedes the previous same-model-only behaviour.

The builder composes native broadcast components from a natural-language request.
There is no reference picker or compulsory named style. Relationships guide the
layout: score hierarchy, readable names, quiet secondary data, coherent team
signals and aligned related panels. These are not fixed coordinates for every hub.
Creation starts with the supported top scorebug and bottom mirrored roster pair;
supported operations and subsequent edits can reposition them.

## Approved evidence

`src/web/src/app/features/editor/ai/hub-design-knowledge.ts` contains the versioned
`APPROVED_HUB_DESIGN_CASES` registry. Pulse, Offset and Foundry supply real palette
tokens and geometry directly from their native preset factories, supported
composition choices, and annotations connecting a decision to its visual effect.
Condensed names preserve density without tiny text; quiet alternating rows help
follow statistics; bright team signals work against restrained surfaces.
Each case includes an editing example with relationships to preserve and mistakes
to avoid. The former short descriptive lessons have been removed.

Two relevant cases are retrieved per request, keeping context bounded as the
library grows. Their template IDs are not part of the generation contract.
The model can combine individual treatments with new colours, fonts and surfaces.
Generation receives measured evidence and causal explanations, rather than a full
preset recipe that a small model can copy instead of following the requested
colours. Complete native examples remain in the registry for inspection and the
syntax example needed by Phi.
Pulse's restrained team-gradient rows and Offset's alternating rows are also shared
rendering primitives, rather than unrelated prose approximations.

To add an approved hub:

1. Add its native layout and rendering tokens to the manual template library.
2. Add a `DesignCase` with actual geometry/tokens, supported composition choices,
   choice/effect annotations, an editing example and retrieval tags.
3. Check it at 1080p and 720p: long names, ten players, sixty items, contrast,
   hierarchy, gameplay and minimap visibility. Include materially different styles
   when possible; repeated near-identical examples add little evidence.
4. Run the creation/edit regressions before accepting it into the registry.

This supplies inference context. It does not train model weights or make every
added example an automatic quality improvement. The registry is curated in code;
user-generated hubs are not silently collected as training examples.

## Independent choices and layout relationships

Creation supports six arbitrary hex colour roles; separate body, heading and
player-name fonts; uppercase names; solid/gradient/glass surfaces;
square/rounded/cut corners; border/team-rail widths; coloured scoreboard team
sections; flat/alternating/team-gradient rows; split/underline/no header accent;
scoreboard dimensions; individual roster width/height; optional event branding;
and a heading. No compulsory template or palette identity is selected.

Native rendering retains data bindings. Scoped colour variables allow later
palette edits to preserve fonts, glass treatment and geometry. Older saved
compositions without the new choices remain compatible.

Edits preserve unrelated content/media/styles. Resizing an originally joined pair
maintains its seam, bottom anchor, common heading and backdrop. Custom split
positions are respected. Typography retains role-specific readable minimum sizes.
The edit decoder knows five-player tables require at least 540 x 240 native units;
a player-only resize cannot target the entire hub. Individual portrait controls
remain separate from whole-table dimensions. Semantic `branding` visibility hides
the associated information panel, labels and crest together.

## Interpreting everyday requests

Every request first goes through a separate interpretation pass in the already
loaded model. It separates requested changes, preservation notes and unsupported
requests. The original wording stays alongside the interpreted brief. Edit
permissions derive from semantic categories rather than keywords in the raw input.
For example, “keep these colours but add a degrade” preserves hues while changing
the team fills; character and equipment pictures map to portraits and item icons.
Each change is grounded in a phrase from the original instruction. Creation drops
copied example requests while retaining the full original brief; an edit asks for
one correction when a request cannot be grounded. Incompatible check/aspect
combinations also fail interpretation. Harmless summary verbosity is trimmed.

Native arithmetic resolves supported relative requests using the current hub and
baseline measurements. Persistent controls cover per-team gradients, independent
item sizes, champion/item size ratios, row-only separators and player text sizes
that preserve their font family. Readable minimums limit shrink requests. The
proposal shows what was understood and a checklist: measured, limited or requiring
preview review. This does not train weights or guarantee correct interpretation.
The extra pass adds inference latency without loading a second model. Malformed
interpretation JSON gets at most one correction within the same shared deadline.
Grounding tolerates joined words, accents and repeated-letter spelling fixes while
retaining strict numeric evidence. Edit examples demonstrate shrinking and growing
elements separately from their size relative to neighbouring icons.

An instruction phrase can carry multiple checks: “smaller pictures but still larger
than items” preserves both size constraints. Explicit named team colours and font
categories are also translated into native design choices. For example, condensed
sports lettering selects the supported Impact heading face; it does not select a
whole preset. Other independent composition settings remain free.

## Review of the actual result

**Review the rendered design** is enabled by default and can be switched off.
This disables optional model critique; basic rendered checks still run.
The isolated native preview renders at 1280 x 720 before publication. Actual font
sizes, clipping, table geometry, seam spacing and missing images are measured.
The inspector retains the preview's native 1920 x 1080 canvas, scales its shell to
720p and converts computed typography into displayed pixels. It also supports the
older untransformed preview. Container-unit roster rules are rebuilt against the
final frame after intermediate model resizes, so saved icon proportions remain
consistent with their actual rendering.
Portrait/item sizes, row dividers and team background gradients are also measured.
Tiny/clipped text and failed measurable requests enter the bounded repair loop.
Best-candidate fallback only retains proposals that passed these checks.

By default the same loaded model returns a short structured critique. Optional Phi
feedback adds a separate image reviewer to Qwen proposals. A clear design issue
can trigger **one aesthetic refinement**, followed by another render/review.
The best structurally valid, readable candidate is retained if refinement regresses,
fails or exhausts the shared budget. Its score is advisory, not a certificate of
visual quality. No hidden chain of thought is requested or stored.

| Selected model | Review input | Resource impact |
| --- | --- | --- |
| Qwen3 4B / 1.7B | Actual DOM measurements, design decisions and approved evidence | Reuses the loaded text model; no screenshot or extra weights. Adds inference time. |
| Qwen + optional Phi feedback | Candidate image, craftsmanship example/previous proposal, measurements and original request | Sequential Qwen → Phi → Qwen loading; all switches share the generation deadline. |
| Phi 3.5 Vision | Actual rendered PNG, measurements and quality criteria | Replaces Qwen; roughly 3 GB initial download and 4.5 GB estimated GPU memory. One 672 x 512 contact sheet per candidate, with overview and readable overlay details. |

Qwen does not see an image. Phi receives an actual image via WebLLM's `image_url`
content, using the same single engine for generation and review. The rasterizer
is dynamically imported only for image review. Images stay local and are excluded
from evaluation exports; exports retain capture kind and size metadata.
The contact sheet retains the full placement plus enlarged scoreboard/table
details. Computed CSS accent colours and approximate hue families ground the
review, avoiding guesses based on the game's unrelated native HUD. Phi's review
uses a bounded-whitespace grammar to prevent incomplete JSON/whitespace stalls.
Switching models requires unloading the current model. Downloads can remain cached
on disk even though only one model is loaded into GPU memory.

The ten-minute limit covers **the whole generation run**: interpretation, proposals, rendering,
validation, critique and refinement. There are at most four proposal attempts and
one aesthetic refinement; reviewer calls consume the same time budget.
Initial generator loading is separate; reviewer loading and switches count toward
the generation deadline. Cancel terminates the worker. Apply remains
explicit and atomic. A readable proposal can still be shown if optional review
fails, with a warning; no invalid proposal is substituted for it.

## Verification

From `src/web`, run `npm test` and `npm run build`. Real browser modes use Chrome,
WebGPU and genuine downloaded models; only authentication and storage are stubbed.
Run them sequentially because they share a Chrome profile and GPU:

```powershell
$env:AI_QA_INTENT = '1'
npm run test:ai-browser
Remove-Item Env:AI_QA_INTENT

$env:AI_QA_DESIGN = '1'
npm run test:ai-browser
Remove-Item Env:AI_QA_DESIGN

$env:AI_QA_VISION = '1'
$env:AI_MODEL = 'Phi-3.5-vision-instruct-q4f16_1-MLC'
npm run test:ai-browser
Remove-Item Env:AI_QA_VISION
Remove-Item Env:AI_MODEL
```

Reports/screenshots are under `tmp-visual-qa/ai-hub-builder/design-regression` and
`vision-regression`; everyday-language tests use `intent-regression`.
Existing creation, appearance, natural-language, composition
and repair suites remain available separately. Mechanical checks do not guarantee
aesthetic judgement or exact interpretation of every prompt. Creation is limited
to native components and decorations. Checked component-level CSS is generated;
invented live widgets, cameras and arbitrary markup remain unsupported.

Recorded Qwen3-4B verification on 2026-10-16: 89 automated tests and the production
build passed. Real browser creation plus measured review took 51.5 seconds; a
follow-up narrower/compact table edit plus review took 58.9 seconds. Both passed on
their first proposal without repairs. The tables remained joined, their common
heading followed their dimensions, and ten portraits/sixty items remained present.
Apply, Save, unload and cancellation passed with no browser runtime exceptions.
The screenshot was also inspected manually. These are sampled outcomes, not proof
that the text model can reliably judge colour harmony or every layout.

The Phi 3.5 Vision browser scenario also passed with a real 672 x 512 contact sheet,
measured CSS accents and bounded-whitespace decoding. Generation plus image review
took 85.7 seconds with cached model assets. Its summary named the rendered
lime/coral accents and discussed score hierarchy and table spacing. Apply, Save,
unload and cancellation passed with no runtime exceptions. The captured reviewer
input was inspected manually. This verifies image delivery and a grounded sample
response, not independent aesthetic expertise. Numeric scores are uncalibrated;
the model can still misjudge a design and the user reviews the proposal before Apply.

Latest interpretation/control verification on 2026-10-16: **113 automated tests**
and the production build passed. Real Chrome/WebGPU Qwen3-4B runs covered the
user's LEC creation prompt, their complete compact-edit prompt and an informal
follow-up containing “abit biger” and “dont change the font”. Total request times
were 80.7, 120.8 and 96.8 seconds, including interpretation and measured review.
The compact edit satisfied all nine interpreted checks. The informal follow-up
enlarged portraits and text, retained the portrait/item hierarchy, darkened the
team gradients and preserved font families, accent hues and joined bottom tables.
All three requests produced valid proposals without layout repairs or aesthetic
refinements. Apply/Save, unloading and cancellation passed, with no browser runtime
exceptions. Outputs were inspected at broadcast size.

The report under `tmp-visual-qa/ai-hub-builder/intent-regression/evaluation.json`
includes raw model responses and actual 720p/1080p measurements. Its grading was
updated against those unchanged captured measurements to verify preserved table
alignment directly, rather than requiring the model to emit a redundant
`joined-bottom` change entry. The same grading helper now runs in the browser
harness and additionally checks preserved font families and actual accent colours.
These sampled results establish instruction following for those cases, not general
aesthetic expertise. Earlier Phi timings above predate the interpretation layer;
the latest end-to-end measurements are for Qwen3-4B.
