# Creative control and optional visual critique

Qwen runs in the browser's WebLLM worker. No generation server or inference API is
required. Accepted native layers and scoped styles use the existing Apply, Undo
and Save flow. There is no compulsory reference picker.

## Component styling

The composition document supplies an initial native layout. `style` operations
then change individual scoreboard/roster parts using compact CSS declarations.
Each rule names a known part and contains `css: "property: value; ..."`; the app
parses it into checked property/value pairs. The older declarations-array format
remains compatible. Targets include groups, individual teams and existing layer IDs.
The vocabulary includes grid/flex layouts, internal positioning, dimensions,
padding/gaps, type roles, borders, shadows, local colour variables, gradients,
decorative pseudo-elements and image framing. `decoration` adds editable static
text/shapes with bounded native coordinates; it cannot invent a live data widget.
`text` changes static Text layers. Team codes and data bindings remain separate.

`hub-part-style.ts` owns the catalog, validation and scoped compiler. The model
never supplies selectors, markup, resource URLs, imports or scripts. Browser
`CSS.supports` rejects invalid values. Unknown parts/properties/functions and CSS
escapes are rejected. Native px values become container units so saved designs
scale consistently. Layer geometry uses native move/resize operations; root CSS
cannot detach a component from its editor selection box.

Group styles apply each rule only to compatible parts; `all` plus `text` does not
invent a text part on images. An entirely nonexistent target part fails. Later
native instructions supersede conflicting earlier CSS for the same controls,
while unrelated details survive. Rules recompile after final reflow.
Known local colour-role/name aliases normalize to supplied roles or literal
palette colours. Native pixel font sizes retain the editor's role-specific
readability floors. Arbitrary invented variables remain invalid.
CamelCase design-role references such as `var(--teamLeft)` resolve to the native
contrast-adjusted `var(--hub-team-left)` before validation. The supported typography
properties include `font-variation-settings`; original typography edit permissions
and browser CSS validation still apply. See the
[style compatibility failure analysis](ai-hub-style-compatibility-analysis.md).

## Required checks

Interpretation retains quoted request evidence and separates changes from
preservation. Supported relationships cannot silently escape as `check: none`:
team gradients, portrait/item hierarchy, fine row dividers and joined bottom tables
become executable requirements during creation and edits. Subjective requests
remain explicitly unverified. Styling cannot rename teams without an explicit
team-code request. Supported branding removal is not reported as unsupported.
Multi-component edits recover explicit player-panel/header scope and preserve both
row-fill and separator requests. Common quoted visual relationships use independent
native treatments followed by rendered checks; arbitrary generic aesthetic wording
does not select a preset. See the [edit contract analysis](ai-hub-edit-contract-analysis.md)
for the reported failure and end-to-end evidence.

The actual 720p preview measures fonts, clipping, missing images, hidden live
parts, out-of-frame content, overlapping data columns and text/surface contrast.
Requested gradients require distinct computed colour stops, not just gradient
syntax. Explicit team colours are checked against filled sections or team signals
as appropriate. These checks detect supported failure classes; they cannot prove
every arbitrary CSS treatment is usable. Users still inspect the proposal.

## Optional Qwen → Phi → Qwen

**Ask Phi for visual feedback · experimental** is off by default. Qwen generates
and required checks run first. The worker unloads Qwen before loading Phi; only
one model is resident at a time. Phi receives the actual screenshot, measurements,
original request and design principles. A smaller approved native example teaches
craftsmanship without imposing its identity. Refinement reviews instead compare
the new candidate with the previous proposal.

Each candidate's 672 × 512 contact sheet has an overview and enlarged scoreboard
and player-table details. The comparison sheet is 1120 × 544. Images remain local
and are excluded from evaluation exports, which retain capture metadata, model
switches and structured feedback.

An unusable critique gets at most one focused retry with the candidate alone and
a shorter image-first question. A rejection without actionable issues, or feedback
claiming the captured image is unavailable, is not a quality verdict. If neither
review is grounded, the UI reports visual review unavailable and retains the valid
candidate without inventing a rating or sending that feedback to Qwen.

After critique the worker restores Qwen. At most one aesthetic refinement is
allowed, followed by required checks and image review. Candidate selection uses
approval and advisory scores alongside hard checks. This is a heuristic, not proof
that Phi improved the design. If review fails or times out, the best retained valid
candidate can still be shown with a warning. Cancellation discards late results.
If another design pass is unlikely to fit in the remaining time, the builder returns
that validated candidate with suggestions. The estimate uses the device's observed
generation time and reserves time for checks, critique and model switches.

The ten-minute total includes interpretation, generation, rendering, validation,
switching (including the first Phi download), critique and refinement. Only initial
generator loading is separate. A cold Phi download may use most of the remaining
budget; later runs use cached assets. Each optional model switch has a 60-second
limit. Preview preparation is capped at 12 seconds; measurement reviews at 45 seconds
and image reviews (including their focused retry) at 90 seconds. Capture/review
failure retains a proposal only after required rendered checks passed. Qwen uses a 6144-token context for the richer
contract; Phi uses 4096. Applying remains one undoable history entry.

## Assessment and evaluation

The UI/export distinguish **validity**, **instruction fulfilment** and **visual
quality**. A measurements-only review cannot claim image-based visual approval.
Phi's feedback and scores are advisory and uncalibrated. Curated examples provide
inference context; they do not train model weights or automatically improve taste.

From `src/web`, run `npm test`, `npm run build`, then genuine Chrome/WebGPU
regressions sequentially (only auth/storage are stubbed):

```powershell
$env:AI_QA_CREATIVE = '1'
npm run test:ai-browser
$env:AI_QA_PHI_REVIEW = '1'
$env:AI_QA_SINGLE = '1'
npm run test:ai-browser
Remove-Item Env:AI_QA_CREATIVE, Env:AI_QA_PHI_REVIEW, Env:AI_QA_SINGLE
```

Reports/screenshots are in `tmp-visual-qa/ai-hub-builder/creative-regression` and
`creative-phi-regression`. Judge screenshots for identity, hierarchy, spacing,
readability and faithful execution; passing geometry alone is insufficient.

## Recorded verification — 2026-10-19

- 143 automated tests and the production build pass. A recorded-output browser
  regression also reproduces the original model CSS through the actual renderer.
- Real Qwen3-4B creation with the original charcoal/cyan/orange prompt completed in
  177.4 seconds. Gradients, portrait/item proportions, dividers, joined tables and
  rendered team colours passed their checks; both team names remained intact.
- A real follow-up identity edit completed in 221.5 seconds. Its first CSS attempt
  put light text on overly bright surfaces. The render checker rejected it, and
  one model correction passed contrast and preservation checks.
- A separate real Qwen → Phi → Qwen run applied rounded central-panel corners and
  a thin cyan border in 230.4 seconds. The comparison-image review claimed visible
  content was absent; that response was rejected. The focused single-candidate
  retry completed, after which Qwen was restored. Its final feedback was generic
  praise (approved=true, advisory score=1), with no actionable improvement.
- Apply/Save and cancellation passed; screenshots at 720p/1080p retained ten
  portraits, sixty item slots and no detected text overflow. No runtime exceptions
  were recorded in these completed runs.

These runs verify creative-control execution, repair, image delivery and model
handoff. They do **not** establish that Phi improves aesthetics or that Qwen now
matches Pulse/Offset quality. Keep the critic optional until broader human-rated
comparisons demonstrate that its feedback improves the result.
