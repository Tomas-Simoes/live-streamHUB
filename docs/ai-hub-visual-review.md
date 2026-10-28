# Request evidence and visual references

Pipeline: `2026-10-26-css-authoring-evidence-v6`.

The 27 October follow-up, `2026-10-27-css-authoring-budget-v7`, retains this review/reference workflow but replaces verbose interpretation with a compact clause-index plan (900-token ceiling), accepts long descriptive summaries and guards full retries using observed runtime. See [the timeout analysis](ai-hub-analysis-2026-10-27.md). The original instruction remains complete.

The aim is to improve instruction adherence and make the optional visual correction accountable. This change does not train Qwen or establish that a small local model can consistently match a professional LEC/LCK package.

## Request → preview → evidence

The interpreter preserves exact phrases from the user's request, alongside a proposed identity, composition, typography and player-row plan. Invented quotations are rejected. The original instruction still reaches the CSS designer. Any clauses not fully covered by a check remain visible as unverified goals.

The original clauses also remain in the checklist when the interpreter returns no requirements; generic brief goals never replace them. Generation and correction receive the complete accepted instruction. The input field preserves pasted text beyond 6,000 characters and displays an explicit warning; the service refuses an oversized request before any model call instead of silently truncating it. This preserves transport fidelity, not a guarantee that the model will obey every instruction.

The preview can measure gradient presence, canvas-relative width, portrait/item size relationships, vertical placement and approximate hue family. These are measurement capabilities, not permitted design categories: arbitrary supported scoped CSS remains available. Novel or subjective instructions use a visual requirement rather than a fixed treatment.

Measured failures enter the existing bounded correction loop even with optional review disabled. Missing selectors or unavailable evidence never count as success. A visible gradient is only partly measured: its direction, subtlety, palette and finish need review. Likewise, a hue-family match does not certify an exact artistic colour. A visual requirement does not become a pass simply because it appeared in the brief.

## Reference library

Open **Visual reference library** in the builder. Pulse, Offset and Foundry provide concrete design-decision/effect annotations and previews of their actual native source. Users do not have to choose a template.

To add professional examples:

1. Write what works in the images: hierarchy, field grouping, surface relationships or use of colour. Explain the effect, rather than only naming a league or calling the image good.
2. Add PNG, JPEG or WebP files. The file limit is 12 MB; stored copies are rasterized to JPEG, at most 1600 × 1000, preserving aspect ratio.
3. References persist in this browser's IndexedDB. They are not uploaded. If persistence is unavailable, the UI explicitly reports tab-only storage. Removal deletes the local entry.

At most two examples are selected through lexical overlap between the request and reference annotations. This is simple, inspectable retrieval, not semantic image search. Qwen receives the annotations; it does not see these images. With Phi enabled, the first selected example is supplied as an actual companion image. For a native example, that image is rendered from its real source. For an uploaded reference, the stored image is used without stretching it.

**Download reference library** exports annotations, uploaded images and the native source records. This is context material, not trained weights. More examples do not guarantee better output: relevance and explanation matter. There are no fabricated approved before/after training pairs.

**Include reference CSS** is off by default. Enable it only to compare the same prompts with and without source excerpts. It does not limit which designs may be requested.

## Optional Phi correction

Enable **Review the rendered design** and **Use Phi visual review**. Qwen and Phi run sequentially; the generator is unloaded before Phi is loaded.

Phi is disabled by default. As of 27 October, the user has deferred Phi-assisted evaluation and training; current generation tests should leave it off. Without a visual model, uploaded reference images are stored but only their textual annotations reach Qwen.

The reviewer sees the actual preview, close-ups, measurements and original instruction. A correction needs a specific problem, visible evidence, a criterion and an action. Numeric scores no longer select the winning proposal. Measurement-only feedback cannot start an aesthetic refinement.

There is at most one aesthetic correction. Qwen receives a focused patch request against the retained candidate. After rendering and validation, Phi compares the revised and previous previews at the same scale. The revision replaces the previous candidate only when the comparison says `improved`, names an exact prior problem as resolved, reports no regressions, and actually received the comparison image. `uncertain`, `unchanged`, `worse`, missing comparison evidence or failed review retain the prior valid candidate. All decisions remain advisory: model-written evidence can still be wrong.

Unusable critique no longer triggers a second focused critique call. The valid proposal is retained with a warning. Repeated per-row measurements and duplicated request representations are omitted from the critic's prompt; full evidence remains in the diagnostic export.

## Time and failure limits

- The existing ten-minute total generation budget remains shared by interpretation, design, repairs, image preparation and model switches. Model initialization before a generation is reported separately.
- Four generation/correction attempts maximum, including at most one aesthetic refinement. An invalid refinement may need a technical repair within that same attempt ceiling.
- Optional review: 45 seconds for measurements or 90 seconds for images. Model switches have a 60-second phase limit. A refinement starts only if the observed generation speed and remaining budget suggest it can fit.
- Review failure or an inferior correction cannot erase an already valid candidate. The editor changes only after **Apply to editor**.

These limits bound work; they cannot guarantee a successful generation or a specific latency on every GPU. Review adds image processing and model-switch time. It remains optional until real comparisons demonstrate a benefit.

## Verification and the next real-model test

Verification completed on the 26 October build and confirmed on 27 October:

- **219 Node tests passed**, no failures or skipped tests; TypeScript checking passed.
- Production build succeeded. Existing bundle-size and CommonJS warnings remain (initial bundle approximately 1.15 MB against the 1 MB warning budget).
- Final Chrome replay `evidence-v6/improved-final` passed: missing gradient detected, focused repair applied, one aesthetic correction accepted with comparison evidence, preview/apply/save and diagnostic export verified. Native reference preview, image import, reload persistence and deletion passed. No browser runtime exceptions.
- Final Chrome replay `evidence-v6/retained-final` passed: the negative comparison retained the earlier validated CSS. No browser runtime exceptions.
- The final comparison contact sheet was inspected: both candidates use the same scale with overview and scoreboard/player-table details. Artifacts are under `tmp-visual-qa/ai-hub-builder/`.

These are controlled-response integration results, not real Qwen/Phi generation quality or performance measurements.

The controlled browser fixture `tests/fixtures/ai-evidence-review-response.json` deliberately omits a requested gradient. Real rendering must detect the omission, apply one repair, render the visual correction and compare actual images. Run the Chrome harness with:

```text
AI_QA_CSS=1
AI_QA_SINGLE=1
AI_QA_PHI_REVIEW=1
AI_QA_REPLAY=tests/fixtures/ai-evidence-review-response.json
```

Add `AI_QA_RETAIN=1` for a controlled negative comparison: the earlier validated CSS must be published. `AI_QA_LIBRARY=1` checks native previews, image import, persistence across navigation and deletion. `AI_QA_DIAGNOSTICS=1` checks the actual exported evidence. Worker initialization, switches and model responses are mocked in replay, so no model is downloaded or run. Compilation, previews, measurements, comparison images, application and saving are real.

For real evaluation, use the existing creation benchmark and keep the prompt/model/settings fixed. Compare Phi off/on first, then reference CSS off/on separately. Keep optional reasoning off for this first comparison so its cost does not confound the results. Add a few well-annotated professional references rather than an uncurated bulk collection. Record completion, latency, fulfilled instructions and human preference between the outputs, including styles unlike Pulse/Offset.

Download the full diagnostic after each run. It includes the selected annotations, original clauses, interpreted checks, measured samples, correction attempts, reviewer evidence and the decision to accept or retain. Controlled tests verify this process; they do not prove that Phi's artistic judgement improves Qwen's output. Real inference/performance measurement remains deferred at the user's request.
