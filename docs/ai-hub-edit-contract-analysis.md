# Multi-component editing failure — 2026-10-20

The user's evaluation `d88aa58c-ebb8-4f0e-ab6c-f005cfc9bdbf` failed in 206.6 s,
after one generation and three style patches. The complete supplied prompt is
1,369 characters, below the existing input limit. Truncation and the shared
ten-minute ceiling did not cause this failure.

## What failed

1. Interpretation assigned “Replace the flat grey player panels…” to scoreboards,
   treated layout preservation as a size change, and lost the background-fill
   request while converting a mixed row-fill/separator clause into a check.
2. Generation ignored most requested player treatments, changed teal to cobalt,
   and used identical foreground/background colours for a team code (1:1 contrast).
3. The local fill correction removed the gold contrast failure, but the service
   discarded it because both before/after reports contained one aggregate
   readability message. Two individual failures becoming one was not recognised.
4. The remaining model patches copied the bad foreground, including a malformed
   CSS patch, and eventually restored the original contrast errors.
5. Text component styles could be valid yet invisible because the text renderer
   bound font size, colour and related fields inline over the authored CSS.

## Changes

Explicit quoted component names repair incorrect interpretation targets. Preservation
clauses do not grant resize/move permission. A shared table heading has its own
target. Mixed row-background/separator requests keep both capabilities. Explicit
left/right gradient colours become grounded palette constraints.

Common explicit visual relationships now resolve to independent native treatments:
charcoal player surfaces, team-tinted/alternating rows, requested CS colours,
condensed names, CS/KDA hierarchy, restrained portrait frames and a slim shared
heading. They are assembled from existing checked component styling, without a
whole-hub preset or reference picker. Generic aesthetic wording does not activate
them; negative requests do not activate unwanted treatments. Other requested design
details remain available through model-generated native operations and checked CSS.

The recorded edit retains table/scoreboard geometry. A portrait-size proposal is
fitted to its current frame when the user explicitly preserves the layout, avoiding
the native roster's automatic frame expansion. Text part styles synchronize their
corresponding native fields so the renderer no longer masks them.

Rendered checks verify each supported treatment, alongside palette, contrast,
portraits/items, geometry and minimap checks. Wrong or omitted treatments cannot
pass merely because the component frames are valid. Subjective quality remains
unverified; these checks do not establish professional aesthetic judgement.

Contrast hints address bad foregrounds as well as bad fills and group compatible
rules by target. Local progress counts individual rendered failures, so a partial
improvement is retained before any further focused model patch. All mandatory
checks still have to pass before Apply. User-facing contrast failures now describe
contrast, rather than claiming text was small or clipped.

The original instruction is supplied once in generation context, alongside the
interpreted brief. The prompt identifies relationships already resolved natively
so the model can concentrate on other requested details. Existing palette colours
are included in hub context. Exports retain `modelRaw`, the resolved plan and the
native treatment descriptors separately.

The pipeline version is `2026-10-20-edit-contract-v6`. Four attempts, one optional
quality refinement, short resource/review limits, cancellation and the shared
600,000 ms ceiling remain in effect.

## Verification

`tests/fixtures/ai-reported-restyle.json` retains the original interpretation and
first edit response, with the saved native hub from the genuine preceding creation
test. `ai-restyle-request.txt` retains the full user prompt.

`edit-contract-replay-final-v6/` under `tmp-visual-qa/ai-hub-builder/` replays that
response in Chrome. It passes in one proposal, including every supported treatment,
preserved component geometry and data, 720p/1080p readability, and Apply/Save, with
zero browser exceptions. Replay times do not measure inference speed.

The automated suite contains 179 passing tests, including the recorded interpretation,
palette independence, negative feedback, native text values, layout/data preservation,
omitted-treatment rejection and partial contrast progress. The production build passes.

`edit-contract-real-v6/` runs real Qwen3 4B WebGPU inference on the same saved hub
with the complete original edit request and Phi off. Interpretation takes 82.4 s,
generation 108.7 s, and measurements-only critique 22.7 s. The pipeline completes
in **213.9 seconds (3m34s)**, with one proposal and zero model repair attempts.
All supported treatment checks, layout/data preservation, 720p/1080p rendering,
Apply/Save and cancellation pass; browser exceptions and rendered contrast,
overlap, hidden-content and frame-overflow failures are zero.

Manual image inspection confirms the teal/burnt-orange gradients, darker player
panels, subtle team rows, clearer CS/KDA hierarchy and portrait frames. The visual
treatment remains conservative. Neither the advisory 4.5 measurements-only score
nor these checks certify LEC/LCK-level aesthetic quality.
