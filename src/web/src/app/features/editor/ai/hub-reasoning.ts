import type { MLCEngine, ChatCompletionMessageParam } from '@mlc-ai/web-llm';

export const HUB_REASONING_LIMITS = Object.freeze({ maxTokens: 384, maxMs: 45_000, hardLimitMs: 55_000, reserveMs: 180_000, maxNotesCharacters: 1800 });

export const HUB_REASONING_PROMPT = `Work out a concise implementation approach for this League broadcast design before CSS is written. Focus on the requested identity, proportions, field grouping and how every live binding fits. Use the supplied actual rowFields, not an imagined DOM. Respect explicit preservation constraints. Consider gradients, typography hierarchy and mirrored table layout together. Keep the exploration short: choose an approach, do not debate multiple alternatives or write a complete stylesheet. Your notes will inform a separate schema-constrained CSS response.`;

/** A bounded thinking pass. JSON grammar is deliberately absent here: it would
 * mask the reasoning tokens. The final CSS request still uses its full schema.
 * Keep draft reasoning internal; diagnostics expose usage/timing, not the draft. */
export async function runHubReasoning(engine: Pick<MLCEngine, 'resetChat' | 'chat' | 'interruptGenerate'>,
  input: unknown, onProgress: () => void = () => {}, now = () => performance.now()) {
  await engine.resetChat();
  const start = now(); let interrupted = false, interruptError: unknown;
  let draft = '', usage: unknown, finishReason: string | undefined;
  const interrupt = () => {
    if (interrupted) return;
    interrupted = true;
    void engine.interruptGenerate().catch(error => { interruptError = error; });
  };
  const timer = setTimeout(interrupt, HUB_REASONING_LIMITS.maxMs);
  try {
    const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: HUB_REASONING_PROMPT },
      { role: 'user', content: JSON.stringify(input) }];
    const chunks = await engine.chat.completions.create({ messages, temperature: .6, top_p: .95,
      max_tokens: HUB_REASONING_LIMITS.maxTokens, extra_body: { enable_thinking: true }, stop: ['</think>'],
      stream: true, stream_options: { include_usage: true } });
    for await (const chunk of chunks) {
      draft += chunk.choices[0]?.delta.content ?? '';
      if (chunk.usage) usage = chunk.usage;
      if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
      onProgress();
      if (now() - start >= HUB_REASONING_LIMITS.maxMs) interrupt();
    }
    if (interruptError) throw interruptError;
    // These are provisional notes, not executable CSS or evidence of success.
    const notes = draft.replace(/^\s*<think>\s*/, '').replace(/<\/think>[\s\S]*$/, '').trim().slice(0, HUB_REASONING_LIMITS.maxNotesCharacters);
    return { notes, durationMs: now() - start, usage,
      stopReason: interrupted ? 'time-budget' : finishReason === 'length' ? 'token-budget' : 'completed',
      truncated: interrupted || finishReason === 'length' };
  } finally { clearTimeout(timer); }
}
