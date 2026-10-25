# Roster validation timeout analysis — 2026-10-19

The latest user export identifies a different failure from the earlier unbounded
preview wait. Preview preparation now completed in 1.66 and 2.01 seconds. Phi was
disabled. The failure happened in generated component geometry and its repair loop.

| Stage | Observed time | Outcome |
| --- | ---: | --- |
| Interpretation | 40.05 s | Omitted the portrait/item relationship; mapped burnt orange to burgundy. |
| First proposal | 107.58 s | Full composition, 1,115 output tokens; portrait/item strip overlap. |
| First repair | 119.93 s | Regenerated almost the same document, 997 tokens; identical measured overlap. |
| Third proposal | Remaining budget | Started with too little time to finish before the old 300 s cutoff. |

The generated `items { width:32px; height:32px }` applied to the whole six-icon
strip, reducing individual icons to about **3.17 px at 720p**. The 64-native-pixel
portrait also exceeded its reserved grid track. Removing redundant scoreboard
rules changed the JSON fingerprint without improving the rendered failure.
The user-facing text called this small/clipped text despite an overlap being the
actual reported problem.

## Changes

- Resolve simple icon dimensions together with native grid tracks. Fit portraits
  to row height and interpret icon-sized strip dimensions as per-icon sizes.
  Preserve shapes, typography, colour, unrelated decoration and explicit custom grids.
- Verify minimum individual item sizes as well as overlap. Do not weaken or skip
  rendered validation.
- Recover clearly quoted portrait/gradient/separator relationships omitted by the
  interpreter. Associate a gradient check with the actual gradient request.
- Discard ungrounded colour hints and retain a generator's requested shade when it
  already belongs to the correct colour family. Burnt orange is a supported hint,
  with a tighter hue tolerance to prevent drift to red.
- Reserve the lower-right minimap area when the user asks to keep it clear.
  Compact/tightly packed player-table requests constrain the creation schema to
  at most 640 native pixels per table and 300 high. This is request-specific layout
  arithmetic, not a compulsory visual reference. Minimap checks quote only the
  minimap request, without certifying unrelated aesthetic wording in the sentence.
- A new portrait/item relationship releases an earlier arbitrary item size, so
  'slightly larger' need not become a portrait twice the size of each item.
- Repair remaining rendered readability failures with a compact style patch rather
  than a complete regeneration. The original instruction schema also restricts CSS
  properties inside patches. Preserve all match data and compile from the original hub.
- Detect repeated measured failures even if redundant JSON operations differ.
- The first genuine forced-failure test showed that generic frame-overflow feedback
  still made Qwen copy an invalid row transform. Render diagnostics now identify
  the responsible transform and provide a small, explicit recommended patch. Bad
  style examples are omitted when a causal fix is available. The returned patch
  must still pass its original permission schema and fresh rendered checks.
- Render hints address stable blue/red player groups, not layer UUIDs generated
  afresh for each composition. A recorded browser repair verifies this complete
  compilation boundary before spending time on a live-model retry.
- Apply known, measured corrections together before requesting another inference.
  This includes a row transform that puts live data outside its frame and a team
  gradient whose literal colours make white labels unreadable. The gradient repair
  uses the already chosen team/surface tokens, preserving the requested identity.
  The patch must satisfy the original style permissions, compile again and improve
  the measured failures; otherwise it is discarded. All readability and request
  checks still run before a proposal can be applied. There is one local correction
  pass per model proposal, rather than an unbounded local repair loop.
- Keep one shared **600,000 ms** budget, four proposal attempts, the earlier short
  resource/review limits, cancellation and valid-candidate retention. This permits
  generation and meaningful corrections within the requested five-to-ten-minute range.
- Start an optional design refinement only if it is likely to finish in the remaining
  time. Estimate from this device's observed generation time, allow 25% headroom and
  reserve time for rendered checks, critique and any reviewer switches. Otherwise
  return the validated hub with suggestions; required validation is never relaxed.

## Reproduction and evidence

`tests/fixtures/ai-reported-roster-overlap.json` retains the user's first interpretation
and proposal unchanged. Before the compiler changes, its browser replay reproduces
the 3.17 px icons and `roster-portrait/roster-items` overlap. After the changes the
same output passes in one proposal, with about **28 px items and 34 px portraits
at 720p**, working gradients, fine separators and the original teal/orange identity.
Both 720p/1080p text checks and Apply/Save are exercised. Replays are explicitly
labelled and do not measure model inference speed.

Reports live under `tmp-visual-qa/ai-hub-builder/reported-overlap-before/` and
`reported-overlap-final-v4/`. `recorded-repair-final-v3/` explicitly uses a scripted
patch (not model judgement) to verify the full render/repair/Apply/Save mechanism.
Native/permission/repair regressions are covered by
`tests/ai-hub-roster-flow.test.mjs`.

`literal-contrast-final-v4/` replays a captured genuine Qwen response that previously
failed on both out-of-frame player rows and a bright literal orange gradient.
The native correction fixes both teams and the gradient in one measured pass,
with one model proposal, zero extra inference calls, no remaining rendered failures
and working Apply/Save. This replay verifies repair execution, not model speed or
model aesthetic judgement.

The roster-fix pipeline identifier used in these recordings is
`2026-10-19-native-repair-v4`. A structurally valid JSON response alone still cannot
be applied: native/rendered checks and requested measurable relationships must pass.
These checks do not certify LEC/LCK-level aesthetic judgement.

## Live verification on 2026-10-20

`final-real-creation-v4/` uses actual browser/WebGPU Qwen3 4B inference, with Phi off.
The original teal/burnt-orange test prompt completes in **189.1 seconds**: 39.8 s
interpretation, 126.2 s generation and 22.9 s measurements-only critique. The native
pass fixes an unreadable literal gradient without another model inference. Preview
and remeasurement take about 96 ms together. All required checks, 720p/1080p
rendering, Apply/Save and cancellation pass, with zero browser exceptions.

Manual inspection confirms a compact scoreboard, teal/orange gradient sections,
joined bottom tables, larger champion portraits and an unobstructed minimap.
It is still a relatively simple visual treatment. This run establishes successful
execution and time on the tested device; it does not establish Pulse/Offset-level
craftsmanship or show that optional Phi feedback improves aesthetic quality.

The device-speed guard for optional refinement is separately covered by a simulated
slow-device test: a valid proposal at 430 s is returned with suggestions instead of
starting a second generation that is unlikely to fit before 600 s.

`final-real-repair-v4/` repeats real Qwen generation with a test-only injected row
translation matching the previously failing out-of-frame content. The local pass
removes that translation on both teams and corrects the unreadable gradient
together. It finishes in **185.5 seconds**, with one generated proposal and no
extra model repair call. Required checks, both render sizes, Apply/Save and
cancellation pass; browser exceptions and remaining rendered failures are zero.
The fault exists only in the browser test harness, not the application.

The final automated suite contains **165 passing tests**. The genuine runs above
exercise generation and native correction; the optional low-budget refinement
decision is covered separately by the deterministic clock test.
