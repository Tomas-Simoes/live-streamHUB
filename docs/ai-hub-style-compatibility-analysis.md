# Style compatibility failure — 2026-10-20

The user's original LEC-style prompt failed before any rendered preview was
measured. Interpretation took 28.0 s, generation 68.4 s, and a full regeneration
84.2 s. Both proposals used `var(--teamLeft)` and `var(--teamRight)`; strict CSS
validation rejected those names. The repeated-proposal stop correctly bounded
the run, but the generic component-configuration message concealed the CSS cause.

The generated CSS also contained `font-variation-settings: 'wght' 700`. This is
valid CSS missing from the application's permitted property inventory. It was a
second rejection waiting behind the first, rather than the reported error itself.

## Correction

- Resolve unambiguous camelCase and unprefixed aliases of existing local colour
  roles before strict validation. `--teamLeft`, `--team-left`, `--hub-teamLeft`
  and `--hub-team-left` resolve to `--hub-team-left`, including nested fallbacks.
  Team backgrounds keep the native contrast-adjusted surface, rather than taking
  a bright literal accent from the raw design document.
- Permit `font-variation-settings` through the same declaration/value validation
  and browser `CSS.supports` checks as other typography. Fonts that lack variable
  axes ignore that setting; existing font-family and font-weight choices remain.
  Typography edit permissions still apply.
- Keep rejecting invented variables, external resources, scripts, unsupported
  functions, invalid browser CSS and declarations outside the original edit scope.
- Report unsupported component styling specifically, and identify the unknown
  variable in remaining repair feedback.

No model retries, attempt limits, time limits or readability checks were relaxed.
The exported pipeline identifier is `2026-10-20-style-compat-v5`.

## Evidence

`tests/fixtures/ai-reported-style-aliases.json` retains both exact model proposals
and the interpretation from the user's evaluation. The pasted evaluation stopped
after its last issue object; only the outer closing delimiters were supplied to
extract the responses. The response strings themselves are unchanged.

Four regressions reproduced the failure before the fix. The complete automated
suite now has **172 passing tests**, and the production build passes.

`tmp-visual-qa/ai-hub-builder/style-compat-replay-v5/evaluation.json` replays the
unchanged first proposal in Chrome. It reaches a validated, measured preview in
one proposal, preserves all ten players and sixty items, passes 720p/1080p checks,
retains the requested team identity and joined tables, and completes Apply/Save.
Browser exceptions are zero. This replay establishes compatibility and rendering;
it does not measure model inference speed or certify aesthetic quality.

`tmp-visual-qa/ai-hub-builder/style-compat-real-v5/evaluation.json` runs the exact
original prompt with real Qwen3 4B WebGPU inference and measurements-only review.
It completes in **119.2 seconds**, with one generated proposal, zero model repair
attempts, and a validated result. Required semantic/readability checks, 720p/1080p
rendering, Apply/Save and cancellation pass, with zero browser exceptions. Initial
model loading is separate from that pipeline time. Phi is off in this test; this
run verifies compatibility and successful execution, not improved aesthetic taste.
