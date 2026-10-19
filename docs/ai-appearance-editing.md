# Appearance editing follow-up

The current composition update is documented in [AI hub design knowledge](ai-hub-design-knowledge.md).
It supersedes the compact-by-default creation behavior described in the historical
benchmark below. Native proportions, typography and surface hierarchy are now
preserved; the previous benchmark timings are not timings for the updated prompts.

The initial prototype could select named palettes and toggle scoreboard data, but
could not express gradients, a different outline shade, thinner outlines or
horizontal padding. As a result, a valid plan could apply only the objective-stat
part of a multi-part request. JSON/layout validation did not establish semantic
completeness.

The editor now supports those appearance properties through a constrained edit
specification. Colors are named shades or validated `#RRGGBB` values; border width
is bounded to 0–4 canvas pixels, and scoreboard horizontal padding to 0–32 pixels.
Null fields preserve existing settings. The application compiles these decisions
into existing layer styles and scoped CSS, including compound scoreboards/rosters.
No model-generated CSS or remote inference is used.

Current colors, border settings and scoreboard flags are included in model context.
Old generated plans are not replayed. No-op edits trigger bounded repair rather
than presenting an unchanged hub as a successful edit. The proposal lists actual
changes before Apply. Browser rounding can render a 0.5px border as one physical
pixel; internal borders are still reduced relative to the original template.

Use **Edit current hub** and **Qwen 3 · 4B (detailed editing)** for multi-part
appearance requests. The original 1.7B model remains an option for basic changes,
but genuine browser runs still showed semantic omissions with that smaller model.
The 4B model's catalog estimate is about 3.4 GB of GPU memory, and its weight
manifest contains 2,262,920,192 bytes, plus runtime/tokenizer assets. This is a
larger download and slower inference, still entirely on the user's device.

The regression uses the exact reported four-clause edit against the recorded
plain-navy layout from the original real-model run. That starting configuration
is committed as `src/web/tests/fixtures/ai-plain-navy.generated.json`; edit output
comes from real WebGPU inference, not a fixture response. A second prompt changes
only padding after saving/reopening, checking gradient/border preservation and
layer IDs. Auth/storage alone are stubbed in the isolated browser runner.

Run from `src/web` after building:

```powershell
$env:AI_QA_APPEARANCE = '1'
$env:AI_MODEL = 'Qwen3-4B-q4f16_1-MLC'
npm run test:ai-browser
```

Results, raw model output, computed browser styles and screenshots are saved under
`tmp-visual-qa/ai-hub-builder/appearance-regression/`. The original 1.7B failure
report is retained there as `evaluation-1.7B.json`.

## Browser verification

The final appearance regression passed both prompts on Windows/Chrome 155 with the
GTX 1660 SUPER, with genuine Qwen3 4B WebGPU inference:

- The exact four-clause request produced a navy-to-midnight gradient, a dark-blue
  outline (`#102d50`) with 0.5px configured width, 16px horizontal scoreboard
  padding, and visible drake/voidgrub/herald statistics. Computed browser styles
  also confirmed gradients in both player rosters and dark outlines in all ten
  rows, including even rows that previously inherited a more-specific cyan rule.
- The second request set padding to 24px while preserving the gradients, border
  colors and widths, player panels and layer IDs after Save/reopen.

Both passed without model repair: 84.42 seconds for the complete request and
83.40 seconds for the padding-only follow-up in the final run. Cached model
initialization was about 10 seconds. The production build and 36 automated tests
pass. Cancellation/unload are exercised in the browser runner. The 4B model is
substantially slower on this device than the original 1.7B template model; expect
roughly 1–2 minutes for these detailed edits rather than the earlier 8–14 second
template benchmark. Initial uncached model initialization was about 45 seconds
on this connection. Other devices/connections will differ.

During a 4B inference, `nvidia-smi` reported 5,564 MiB aggregate GPU memory in use
out of 6,144 MiB and 88% GPU utilization. This includes other processes and is not
a measurement of the model's allocation alone; the WebLLM model estimate remains
3,431.59 MB. Initial 4B weights contain 2,262,920,192 bytes plus runtime assets.
After the final QA browsers closed, aggregate GPU memory was 2,713 MiB. That
observed decrease includes browser/driver cleanup and other processes; it does
not establish an isolated model-memory figure or immediate recovery on Unload.

[Final structured report](../tmp-visual-qa/ai-hub-builder/appearance-regression/evaluation.json)
· [Before](../tmp-visual-qa/ai-hub-builder/appearance-regression/baseline-plain-navy-canvas-1920.png)
· [After the full request](../tmp-visual-qa/ai-hub-builder/appearance-regression/scenario-1-canvas-1920.png)
· [After the padding-only edit](../tmp-visual-qa/ai-hub-builder/appearance-regression/scenario-2-canvas-1920.png)

New designs use an independent composition specification, plus optional component
operations, and do not receive the previous hub's colors as context. Existing hubs
supply internal design lessons. Edit mode receives current hub state and preserves
the existing design identity.

The final four-scenario regression also passed with real Qwen3 4B inference:
37.5 seconds for the minimalist navy design, 34.7 seconds for CBLOL, 66.7 seconds
for the player-size/spacing follow-up, and 33.2 seconds for the futuristic design.
These checks are scenario-specific; the model may still emit extra or unsuitable
settings for other prompts. Review the proposed-change list before applying.
[Template regression report](../tmp-visual-qa/ai-hub-builder/template-regression/evaluation.json).
