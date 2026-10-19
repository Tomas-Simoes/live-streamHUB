# Historical reference-guided prototype

This workflow was superseded by [internal design knowledge and independent
composition](ai-hub-design-knowledge.md). The reference selector described below
has been removed. These notes and benchmarks document the previous implementation.

The AI Hub Builder now treats a template as an editable design reference, including
its proportions, typography, surface hierarchy and team-color roles. Pulse, Offset
and Foundry are the initial user-approved references. Atelier, Voltage, Crown and
CBLOL remain available with their own descriptions and editable layouts.

## Using it

1. Open **AI Hub Builder** and select **New design from a template**.
2. Choose **Pulse**, **Offset**, **Foundry** or another **Design reference**. The
   panel shows its original preview and design direction. Leave **Choose from my
   instruction** selected to let the model choose.
3. Describe the desired variation, for example “Create an emerald green version
   of this reference. Keep its typography and proportions.”
4. Review and apply the proposal. Subsequent edits use the current hub; the
   reference selector only applies to new designs. Apply, Undo and Save retain
   the normal editor behavior.

These are textual design descriptions and actual native layer configurations.
Screenshots are not sent to the text model. This does not fine-tune the model or
enable generation of arbitrary new compositions.

## Design application

- A null creation palette retains the complete native reference design. A palette
  is selected only when the instruction asks for another color scheme.
- Scorebugs retain their authored 1200 x 100 proportions by default. A requested
  compact scorebug can still use an explicit 1000 x 86 resize.
- Palettes now contain ink, raised/deep surfaces, primary/secondary text, dividers
  and separate team accents. Scoped color rules preserve typography and shapes,
  distinct score/clock/objective fields, alternating rows and accent statistics.
- Portrait/spacing edits retain native fonts. Copied unchanged roster settings
  cannot rebuild the grid. Padding alone cannot reset native backgrounds or borders.
- Gradients keep subtle center/objective shading and alternating row treatments.
  Explicit gradient, border width and padding overrides survive later edits.
- A palette switch replaces custom colors while retaining an existing gradient's
  structure and its fine borders/padding. User images and team logos retain their
  original assets.

## Model context and guardrails

The short catalog describes every design family. Local keyword retrieval adds
detailed notes for at most two relevant references, or just the explicit selection.
The detailed notes derive geometry from the actual template factories. An explicit
selection constrains the decoder schema and is checked again at runtime.

Creation and editing prompts describe visual hierarchy, surface depth, readable
statistics, mirrored rosters and reserved gameplay areas. No full layer JSON or
images are added to model context. Worker inference, the 4096-token context, model
cache and one bounded validation repair remain local and unchanged.

An independent edit audit rejects compiler side effects that change content,
typography or geometry outside the declared operations and their linked furniture.
It is an application-preservation check, not proof that the model interpreted every
clause correctly. Editing also narrows the decoder schema to recognized request
categories: a portrait/spacing/movement request cannot emit colors, border widths,
padding or typography changes. A padding-only follow-up locks unrelated fields to
null. The same schema is enforced at runtime, so invalid output gets the existing
bounded repair instead of silently discarding changes. This uses a small English/
Portuguese capability vocabulary; it does not supply model answers or parameter
values. Unrecognized instructions retain the full schema for compatibility.
Mixed or unfamiliar phrasing can still be misinterpreted; review the proposal.

Mechanical warnings flag main-text contrast below 4.5:1 against
resolved panel colors and compound panels covering reserved gameplay/minimap areas.
Complex custom CSS is not a complete contrast or internal-overflow analysis.

## Verification

`npm test` checks native-reference reproduction, every approved reference with all
eight palettes, preservation of typography/content/geometry/media, explicit
selection, bounded retrieval, no-op roster settings, padding-only edits and the
design guard. Request-scope tests cover multi-clause edits, portrait-only changes,
padding with preservation instructions, border-only edits and Portuguese vocabulary.
Existing editor history and inference lifecycle checks remain.

From `src/web`, after `npm run build`, run genuine browser/model scenarios with:

```powershell
$env:AI_QA_REFERENCES = '1'
npm run test:ai-browser
Remove-Item Env:AI_QA_REFERENCES
$env:AI_QA_APPEARANCE = '1'
npm run test:ai-browser
Remove-Item Env:AI_QA_APPEARANCE
npm run test:ai-browser
```

The reference suite generates navy, emerald and purple Pulse variations, then
automatically selects Foundry and Offset for different instructions. At 1920 x
1080 and 1280 x 720, it compares the actual rendered fonts, weights, component
frames, clipping and alternating rows with each native reference, and records
text-overflow counts. It also exercises preview isolation, Apply, Save and worker
unload/cancellation. Only authentication/storage are stubbed; model output is real.

Reports and screenshots are under
`tmp-visual-qa/ai-hub-builder/reference-regression/`. The appearance suite uses the
recorded original plain-navy hub and the user's four-clause edit, followed by a
padding-only edit. Its report is under `appearance-regression/`. The original
four-scenario suite remains under `template-regression/`. Mechanical checks and
reference comparisons support visual review; they do not certify aesthetic quality.

## Recorded verification — 2026-10-15

Production build and all **49 automated tests** passed. Genuine Qwen3 4B inference
on Chrome 155 / NVIDIA GTX 1660 SUPER passed all **11 browser scenarios**, without
model repair:

| Suite | Scenarios | Generation time | Result |
| --- | --- | --- | --- |
| Reference variations and automatic selection | 5 | 9.7–12.2 s | Native typography/frames retained at 1080p and 720p; no measured text overflow |
| Original creation/edit requests | 4 | 10.8, 13.8, 34.3, 15.0 s | Portraits/spacing changed while colors, outlines, padding, gold and clock stayed intact |
| Original four-clause appearance request + padding follow-up | 2 | 33.7, 32.4 s | Full-panel gradient, dark fine outlines, objectives and padding; subsequent padding-only preservation |

The portrait follow-up increased the model's portrait setting from 48 to 64 and
spacing from 8 to 12, without an appearance operation. The complete appearance
request selected navy-to-midnight, slate-blue outlines at 0.5 configured canvas
pixels and 16px scoreboard padding; the follow-up changed padding to 24px. Browser
rounding still applies to subpixel border widths. Cancellation/unload checks also
passed. Timings are observations on this device and exclude the initial model load.

Reports: [references](../tmp-visual-qa/ai-hub-builder/reference-regression/evaluation.json),
[original scenarios](../tmp-visual-qa/ai-hub-builder/template-regression/evaluation.json),
[appearance](../tmp-visual-qa/ai-hub-builder/appearance-regression/evaluation.json).
Example: [purple Pulse](../tmp-visual-qa/ai-hub-builder/reference-regression/scenario-3-proposal-1920.png).
