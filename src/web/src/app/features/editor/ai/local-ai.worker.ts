/// <reference lib="webworker" />
import { MLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';
import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';

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
      await engine.reload(data.model, { context_window_size: data.model.startsWith('Qwen') ? 6144 : 4096 });
      currentModel = data.model;
      const record = prebuiltAppConfig.model_list.find(m => m.model_id === data.model);
      send('result', { initializationMs: performance.now() - start, estimatedVramMB: record?.vram_required_MB });
    } else if (kind === 'switch') {
      if (!engine) throw new Error('Load the generator first.');
      const start = performance.now();
      // Only one model is resident; release the generator before loading Phi.
      await engine.unload(); currentModel = '';
      await engine.reload(data.model, { context_window_size: data.model.startsWith('Qwen') ? 6144 : 4096 });
      currentModel = data.model;
      send('result', { model: currentModel, initializationMs: performance.now() - start });
    } else if (kind === 'generate' || kind === 'review' || kind === 'interpret') {
      if (!engine) throw new Error('Load the local model first.');
      await engine.resetChat();
      const start = performance.now();
      // Bounded strings multiply grammar compilation work in nested style rules.
      // Runtime Ajv/value validation still enforces every length restriction.
      const decodeSchema = JSON.parse(JSON.stringify(data.schema, (key, value) => key === 'maxLength' ? undefined : value));
      const chunks = await engine.chat.completions.create({
        messages: data.messages as ChatCompletionMessageParam[], temperature: 0,
        max_tokens: kind === 'review' ? 420 : kind === 'interpret' ? 1100 : 1200, stream: true, stream_options: { include_usage: true },
        ...(currentModel.startsWith('Qwen') ? { extra_body: { enable_thinking: false } } : {}),
        response_format: data.grammar ? { type: 'grammar', grammar: data.grammar } : { type: 'json_object', schema: JSON.stringify(decodeSchema) },
      });
      let raw = '';
      let usage;
      for await (const chunk of chunks) {
        raw += chunk.choices[0]?.delta.content ?? '';
        if (chunk.usage) usage = chunk.usage;
        send(kind === 'review' ? 'review-tokens' : kind === 'interpret' ? 'interpret-tokens' : 'tokens', raw);
      }
      send('result', { raw, generationMs: performance.now() - start, usage });
    } else if (kind === 'unload') {
      await engine?.unload();
      engine = undefined;
      send('result', null);
    }
  } catch (error) {
    send('error', error instanceof Error ? error.message : String(error));
  }
});
