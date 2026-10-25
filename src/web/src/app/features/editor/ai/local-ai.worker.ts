/// <reference lib="webworker" />
import { MLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';
import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import { runHubReasoning } from './hub-reasoning';

let engine: MLCEngine | undefined;
let currentModel = '';
addEventListener('message', async ({ data }) => {
  const { id, kind } = data;
  const send = (type: string, payload: unknown) => postMessage({ id, type, payload });
  try {
    if (kind === 'init') {
      engine = new MLCEngine({
        appConfig: { ...prebuiltAppConfig, cacheBackend: 'cache' },
        initProgressCallback: progress => send('progress', progress),
      });
      const start = performance.now();
      await engine.reload(data.model, { context_window_size: data.model.startsWith('Qwen') ? 8192 : 4096 });
      currentModel = data.model;
      const record = prebuiltAppConfig.model_list.find(m => m.model_id === data.model);
      send('result', { initializationMs: performance.now() - start, estimatedVramMB: record?.vram_required_MB });
    } else if (kind === 'switch') {
      if (!engine) throw new Error('Load the generator first.');
      const start = performance.now();
      // Only one model is resident; release the generator before loading Phi.
      await engine.unload(); currentModel = '';
      await engine.reload(data.model, { context_window_size: data.model.startsWith('Qwen') ? 8192 : 4096 });
      currentModel = data.model;
      send('result', { model: currentModel, initializationMs: performance.now() - start });
    } else if (kind === 'reason') {
      if (!engine || !currentModel.startsWith('Qwen3-')) throw new Error('Bounded thinking requires a supported Qwen 3 model.');
      const result = await runHubReasoning(engine, data.input, () => send('reasoning-progress', null));
      send('result', result);
    } else if (kind === 'generate' || kind === 'repair' || kind === 'review' || kind === 'interpret') {
      if (!engine) throw new Error('Load the local model first.');
      await engine.resetChat();
      const start = performance.now();
      // Bounded strings multiply grammar compilation work in nested style rules.
      // Runtime Ajv/value validation still enforces every length restriction.
      const decodeSchema = JSON.parse(JSON.stringify(data.schema, (key, value) => key === 'maxLength' ? undefined : value));
      for (const op of decodeSchema.properties?.operations?.items?.oneOf ?? []) if (op.properties?.op?.const === 'style') {
        const item = op.properties.rules.items;
        op.properties.rules.items = { type: 'object', additionalProperties: false, required: ['part', 'css'], properties: {
          part: item.properties.part, css: { type: 'string', minLength: 1 },
        } };
      }
      const maxTokens = kind === 'review' ? Math.min(800, data.maxTokens ?? 700) : kind === 'interpret' ? 1800 : Math.min(3200, data.maxTokens ?? (kind === 'repair' ? 1400 : 2800));
      send('configuration', { model: currentModel, temperature: 0, maxTokens,
        contextWindow: currentModel.startsWith('Qwen') ? 8192 : 4096, thinking: false,
        decoder: data.grammar ? { grammar: data.grammar } : { schema: decodeSchema } });
      const chunks = await engine.chat.completions.create({
        messages: data.messages as ChatCompletionMessageParam[], temperature: 0,
        max_tokens: maxTokens, stream: true, stream_options: { include_usage: true },
        ...(currentModel.startsWith('Qwen') ? { extra_body: { enable_thinking: false } } : {}),
        response_format: data.grammar ? { type: 'grammar', grammar: data.grammar } : { type: 'json_object', schema: JSON.stringify(decodeSchema) },
      });
      let raw = '';
      let usage;
      let finishReason;
      for await (const chunk of chunks) {
        raw += chunk.choices[0]?.delta.content ?? '';
        if (chunk.usage) usage = chunk.usage;
        if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
        send(kind === 'review' ? 'review-tokens' : kind === 'interpret' ? 'interpret-tokens' : 'tokens', raw);
      }
      send('result', { raw, generationMs: performance.now() - start, usage, finishReason });
    } else if (kind === 'unload') {
      await engine?.unload();
      engine = undefined;
      send('result', null);
    }
  } catch (error) {
    send('error', error instanceof Error ? error.message : String(error));
  }
});
