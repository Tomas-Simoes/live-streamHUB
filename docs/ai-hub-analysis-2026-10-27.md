# Ten-minute failure on 27 October

Source: `ai-hub-diagnostic-2026-10-27T14-47-19-536Z.json`, pipeline `2026-10-26-css-authoring-evidence-v6`, Qwen3 4B. Phi and optional thinking were off. The request was the charcoal/teal/burnt-orange broadcast prompt with a half-width scoreboard and mirrored bottom tables.

## What actually failed

- Initialization: 37.26 seconds, outside the shared generation deadline.
- Interpretation: 182.77 seconds, 1,419 output tokens. Much of this repeated the instruction in quoted requirements, summary, goals, preferences and preservation notes.
- First CSS response: 333.92 seconds, 2,165 output tokens, approximately 7.58 decoded tokens/second.
- The response contained a 571-character summary. Runtime validation rejected `/summary` because its maximum was 360 characters. The worker deliberately omitted string-length automata from decoding, so that limit was not enforced while generating.
- Since parsing stopped before producing a candidate, the recovery path requested another full generation. Only approximately 84 seconds remained. That request timed out after emitting the beginning of another summary.
- No preview, rendered validation or review ran. This timeout was not caused by Phi, preview assets, or an aesthetic review loop.

The wording “Some design settings are missing or unsupported” concealed a description-length error. Raising the total deadline would leave the same wasteful recovery behavior in place.

## Corrections in v7

`2026-10-27-css-authoring-budget-v7` removes the fatal summary-length condition from both the authoring response and compiled plan schemas. Summaries remain strings and are requested as a short sentence. Actual CSS, operation, resource and layout validation remains enforced. Original model output is retained in diagnostics.

New interpretation decoding uses a compact version-2 contract. Objective checks reference original clause indices; runtime resolves each index to the user's exact original clause. Subjective goals stay in the original instruction and the unverified checklist without being copied into numerous generated fields. The plan retains four concise design decisions and explicit preservation constraints. Interpretation output is capped at 900 tokens, down from 1,800. The generator still receives the full original instruction, with a smaller design aid. Existing diagnostic briefs remain readable.

Before another full generation, the service compares remaining time with 85% of the observed generation duration plus preview preparation time. If that cannot fit, it reports `insufficient-budget` and does not start the call. Focused repairs remain eligible; this guard does not equate their smaller cost with full regeneration. This avoids wasted calls, not a guarantee of successful generation.

An empty patch remains a repair against the retained candidate, rather than restarting from the original scaffold. Schema failures now expose the actual validation message instead of only generic design-settings wording.

## What the original CSS revealed after the summary fix

The exact response is preserved in `src/web/tests/fixtures/ai-long-summary-response.json`. It compiles after the summary fix, but contains real design problems: nonexistent selectors, a blue treatment instead of teal, repeated complete replacements that erase earlier styles, undersized item strips, and a flex scoreboard that clips team codes. It also claims half-width geometry without issuing a frame operation.

The real Chrome replay detects undersized items and clipped team codes. Its controlled CSS repair restores readable allocations and the scoreboard grid, adds requested team gradients and a half-width frame, and retains a readable clock. This repair is a test fixture, not a new Qwen response and not a claim that a small model will independently make the same correction.

## Verification

The regression suite tests the exact 571-character response, compact clause-index decoding, preservation of the original instruction, recovery from actual readability failures, retention after an empty patch and refusal to launch a full retry at the recorded speed with only 84 seconds remaining. The old late-response test still verifies that a response arriving beyond the shared deadline is discarded; its initial response is fast enough for a retry to be eligible.

The ten-minute total ceiling remains. Phi stays off for current evaluation. No real model inference was run for this fix; generation quality and end-to-end performance on the revised prompts must be assessed separately.

Final verification: **227 Node tests passed**, TypeScript checking and production build passed. Existing bundle-size/CommonJS warnings remain. Chrome replay `tmp-visual-qa/ai-hub-builder/budget-v7/exact-summary-final/evaluation.json` passed with two attempts (the exact original generation plus one controlled CSS repair), ten portraits, sixty item slots, readable native bindings, preview/apply/save and no browser runtime exceptions. The 1280-pixel proposal image was inspected. This replay establishes recovery behavior, not fresh model design ability.

An additional diagnostic-export replay captured the revised hub and applied editor correctly, but its baseline image hit the existing 12-second image-capture deadline. The export recorded that explicit error and retained baseline source data. That optional export timeout did not affect generation or applying the valid proposal.
