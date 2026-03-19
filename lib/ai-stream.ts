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

export async function createAIStream({
  provider,
  apiKey,
  model,
  system,
  userMessage,
  maxTokens = 6000,
}: {
  provider: string;
  apiKey: string;
  model: string;
  system: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<ReadableStream<Uint8Array>> {
  // ── Anthropic ──────────────────────────────────────────────────────────────
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey });
    return new ReadableStream({
      async start(controller) {
        try {
          const stream = client.messages.stream({
            model,
            max_tokens: maxTokens,
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
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({
        model,
        systemInstruction: system,
      });

      return new ReadableStream({
        async start(controller) {
          try {
            const result = await geminiModel.generateContentStream(userMessage);
            for await (const chunk of result.stream) {
              const text = chunk.text();
              if (text) controller.enqueue(encoder.encode(text));
            }
            controller.close();
          } catch (err: any) {
            const msg =
              err?.message?.includes('API_KEY') || err?.status === 400
                ? 'Invalid API key. Get a free key at aistudio.google.com.'
                : err?.status === 429
                  ? 'Rate limit reached. Wait a moment and retry.'
                  : err?.message || 'Gemini request failed.';
            controller.enqueue(encoder.encode(`ERROR: ${msg}`));
            controller.close();
          }
        },
      });
    } catch {
      return errorStream('Gemini SDK not available. Run: npm install @google/generative-ai');
    }
  }

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  if (provider === 'openai') {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey });

      return new ReadableStream({
        async start(controller) {
          try {
            const stream = await client.chat.completions.create({
              model,
              max_tokens: maxTokens,
              stream: true,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: userMessage },
              ],
            });
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content || '';
              if (text) controller.enqueue(encoder.encode(text));
            }
            controller.close();
          } catch (err: any) {
            const msg =
              err?.status === 401
                ? 'Invalid API key. Check platform.openai.com.'
                : err?.status === 429
                  ? 'Rate limit or quota exceeded.'
                  : err?.message || 'OpenAI request failed.';
            controller.enqueue(encoder.encode(`ERROR: ${msg}`));
            controller.close();
          }
        },
      });
    } catch {
      return errorStream('OpenAI SDK not available. Run: npm install openai');
    }
  }

  return errorStream(`Unknown provider: ${provider}`);
}

export const STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
} as const;
