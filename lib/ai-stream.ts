import Anthropic from '@anthropic-ai/sdk';

const encoder = new TextEncoder();

function errorStream(message: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`ERROR: ${message}`));
      controller.close();
    },
  });
}

function is429(err: any): boolean {
  return (
    err?.status === 429 ||
    err?.message?.includes('429') ||
    err?.message?.includes('Too Many Requests') ||
    err?.message?.includes('quota') ||
    err?.message?.includes('Quota')
  );
}

export interface FallbackConfig {
  provider: string;
  apiKey: string;
  model: string;
}

interface StreamParams {
  provider: string;
  apiKey: string;
  model: string;
  system: string;
  userMessage: string;
  maxTokens?: number;
}

// Initiates the API connection BEFORE creating the ReadableStream.
// This means 429 / auth errors throw here — allowing the caller to catch and fall back.
async function attemptStream(params: StreamParams): Promise<ReadableStream<Uint8Array>> {
  const { provider, apiKey, model, system, userMessage, maxTokens = 6000 } = params;

  // ── Anthropic ──────────────────────────────────────────────────────────────
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey });
    return new ReadableStream({
      async start(controller) {
        try {
          const stream = client.messages.stream({
            model,
            max_tokens: maxTokens,
            temperature: 0,
            system,
            messages: [{ role: 'user', content: userMessage }],
          });
          stream.on('text', (text) => controller.enqueue(encoder.encode(text)));
          await stream.finalMessage();
          controller.close();
        } catch (err: any) {
          const msg =
            err?.status === 401
              ? 'Invalid API key. Check console.anthropic.com.'
              : err?.status === 429
                ? 'Rate limit reached. Wait a moment and retry.'
                : err?.message || 'Anthropic request failed.';
          controller.enqueue(encoder.encode(`ERROR: ${msg}`));
          controller.close();
        }
      },
    });
  }

  // ── Google Gemini ──────────────────────────────────────────────────────────
  if (provider === 'gemini') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model,
      systemInstruction: system,
      generationConfig: { temperature: 0 },
    });
    // ↓ Awaited OUTSIDE ReadableStream — 429 throws here, caller can fall back
    const result = await geminiModel.generateContentStream(userMessage);
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (err: any) {
          controller.enqueue(encoder.encode(`ERROR: ${err.message || 'Gemini stream failed.'}`));
          controller.close();
        }
      },
    });
  }

  // ── Groq (Llama / Mixtral) + OpenAI ───────────────────────────────────────
  if (provider === 'groq' || provider === 'openai') {
    const { default: OpenAI } = await import('openai');
    const client =
      provider === 'groq'
        ? new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' })
        : new OpenAI({ apiKey });
    // ↓ Awaited OUTSIDE ReadableStream — 429 throws here, caller can fall back
    const stream = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature: 0,
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
    });
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || '';
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(`ERROR: ${err.message || `${provider} stream failed.`}`)
          );
          controller.close();
        }
      },
    });
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export async function createAIStream(
  params: StreamParams,
  fallbacks: FallbackConfig[] = []
): Promise<ReadableStream<Uint8Array>> {
  const chain: StreamParams[] = [params, ...fallbacks.map((f) => ({ ...params, ...f }))];

  for (let i = 0; i < chain.length; i++) {
    try {
      return await attemptStream(chain[i]);
    } catch (err: any) {
      const isLast = i === chain.length - 1;
      if (is429(err) && !isLast) continue; // silently try next model
      const msg = is429(err)
        ? `Daily quota reached on all free models. Limits reset at midnight UTC — or add a paid API key (Claude / GPT-4o) to continue now.`
        : err?.message?.includes('API_KEY') || err?.status === 401
          ? `Invalid API key for ${chain[i].provider}. Check your key and try again.`
          : err?.message || 'Request failed.';
      return errorStream(msg);
    }
  }

  return errorStream('No providers available.');
}

export const STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
} as const;
