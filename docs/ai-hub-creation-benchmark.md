# AI Hub Builder: creation benchmark

Start with case 1. Use **Create a new design**, Qwen 3 4B, **Give it a design review: off**, **Phi feedback: off**. Structural and rendered validity checks still run. Generate once with **Think before styling: off**, then generate the SAME prompt with it **on**. Keep the browser, game/GPU load and other settings comparable. Exclude initial model download/loading when comparing generation time. Do not edit either result yet.

Save each screenshot and diagnostic JSON with the case ID, thinking setting and run number. A single pair is exploratory: repeat promising comparisons before concluding that reasoning improves quality. Then use the other cases to check that improvements generalize beyond one reference style.

For each pair, assess: completion within ten minutes; requested colours/composition; readable live data; coordinated typography/spacing; and which result you would actually use on a broadcast. Record failures as failures. Do not replace a poor result with a hand-edited screenshot. Technical validity is separate from visual quality.

## 1. LEC-inspired composition

```text
Create a professional League of Legends broadcast overlay with a strong teal-and-burnt-orange identity.

Make the top scoreboard one slim, connected strip, centered and roughly half the screen width. Put team logos and names toward the outer ends, gold and towers nearer the middle, and prominent kill scores in a neutral near-black center. Place the clock underneath the scores and objectives in a narrow lower strip. Make the left section visibly teal and the right visibly burnt orange, with smooth gradients that darken toward the center.

Join two mirrored five-player tables along the bottom. Keep equipment icons toward the outside, champion portraits and names together, and statistics toward the middle. Group CS above KDA, with the champion level beside the portrait. Make champion portraits slightly larger than item icons. Use subtly team-tinted rows, fine separators and compact but readable spacing.

Use condensed white headings, clear player names and quieter secondary information. Coordinate the surfaces, gradients and accents across the whole overlay. Keep all live match information readable and the gameplay and minimap clear.
```

## 2. Same general direction, ordinary language

```text
Make a League overlay that looks ready for a big esports final. I want teal on the left and warm orange on the right, fading into a dark middle. Keep the scoreboard small and centered at the top, with the score and clock easy to find. Put both teams' player tables together at the bottom. Keep each player's picture near their name, items on the outside and stats toward the middle. Give it a strong, consistent identity with good lettering and subtle depth. Keep the game and minimap easy to see.
```

## 3. Imperfect English

```text
make a pro league hub pls. left team teal right orange but darker orange not yellow. want degrade into dark middle on top score bar. names and score easy to read. player rows together down bottom, items outside and names stats inside. champ pics a bit bigger than equipment and level beside pic. dont cover map. make the colours and letters feel like same tournament design, not just random boxes
```

## 4. Light editorial identity

```text
Create a League of Legends broadcast overlay with a light ivory and graphite identity. Use deep emerald for the left team and terracotta for the right. Give the surfaces a restrained printed-paper feel, with dark readable text and fine rules. Use elegant serif tournament headings with clean sans-serif player names and statistics. Keep the top scoreboard compact and the mirrored five-player tables joined at the bottom. Make team differences obvious through small coordinated accents. Preserve strong contrast, all live match information and a clear gameplay area and minimap.
```

## 5. Angular, energetic identity

```text
Create a sharp, energetic League of Legends tournament overlay using charcoal, acid lime and coral. Make the team sections distinctly lime and coral, with short angular edge details and bold condensed lettering. Use a compact top scoreboard with prominent scores and a clear clock. Join the player tables at the bottom, with items on the outside, portraits beside names, and statistics toward the center. Carry the same angular details and accent treatment through both tables without boxing every cell. Keep all five players, their items and statistics readable, and leave gameplay and the minimap clear.
```

## 6. Restrained premium identity

```text
Create an elegant League of Legends grand-final overlay with warm black surfaces, ivory text and restrained metallic-gold details. Distinguish the left team with deep petrol and the right with muted burgundy. Use a compact centered scoreboard, large scores, a clear clock and carefully aligned team information. Build joined mirrored player tables at the bottom with subtle alternating surfaces and fine separators. Keep names and portraits grouped, items toward the outside and statistics toward the middle. Give the whole package a deliberate, premium identity through typography and spacing. Keep every live statistic readable and the gameplay and minimap clear.
```

## Current experiment boundaries

- The brief now proposes identity, composition, typography and field-layout decisions in the existing interpretation call. These remain freely chosen design decisions, not style permissions or verified visual results.
- Thinking is optional and off by default. It runs once before CSS, without a JSON grammar, for at most 384 output tokens or a cooperative 45-second deadline. A 55-second watchdog terminates an unresponsive worker. Both count against the original ten-minute total. The pass is skipped if it would leave less than three minutes after its watchdog for generation/validation.
- The CSS answer still uses its normal schema, checks and bounded correction loop. Incomplete thinking notes are labelled provisional and do not become a malformed CSS response. Notes are internal; exported diagnostics include timing, usage and termination reason.
- Keep Phi off during this comparison so the effect of thinking is not confounded with a different reviewer.
- No claim of improved visual quality or new inference speed is established by orchestration tests or recorded-response browser replay.

## Integration verification

The bounded-thinking implementation passed 200 Node tests, TypeScript checking and the production build. The Chrome replay at `tmp-visual-qa/ai-hub-builder/bounded-thinking-regression/evaluation.json` passed with one controlled reasoning response, one recorded CSS response, one successful local grid recovery and one Save; all 10 portraits, 60 items, 10 CS and 10 KDA bindings remained present. No browser exceptions were recorded. This run used no live model inference and does not measure generation speed or visual improvement.

## Free-model investigation

Qwen3.5-4B is Apache-2.0 and an MLC entry exists in the installed runtime, with a base estimate of 3867.82 MB at its catalog context. It has NOT been enabled in the builder: on 2026-10-21 its public MLC config declared stop IDs 151643/151645, while the same repository's tokenizer declared end-of-text/end-of-message as 248044/248046. This needs a validated artifact/configuration and real loading/generation checks before recommending it. A catalog entry alone is insufficient.

Qwen3-8B's catalog estimate is 5695.78 MB before the application's larger context and other GPU consumers. It is not a sensible default for the user's 6 GB card. No paid backend, external inference service or automatic model download was introduced.

Sources: [Qwen 3.5 4B model](https://huggingface.co/Qwen/Qwen3.5-4B), [MLC configuration](https://huggingface.co/mlc-ai/Qwen3.5-4B-q4f16_1-MLC/blob/main/mlc-chat-config.json), [MLC tokenizer](https://huggingface.co/mlc-ai/Qwen3.5-4B-q4f16_1-MLC/blob/main/tokenizer_config.json).
