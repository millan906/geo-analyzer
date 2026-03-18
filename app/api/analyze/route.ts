import Anthropic from '@anthropic-ai/sdk';
import { GEO_SYSTEM_PROMPT } from '@/lib/system-prompt';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { content, targetQuery, apiKey } = await request.json();

    if (!apiKey?.trim()) {
      return new Response('Anthropic API key is required.', { status: 401 });
    }
    if (!targetQuery?.trim()) {
      return new Response('Target AI Query is required.', { status: 400 });
    }
    if (!content?.trim()) {
      return new Response('Content is required.', { status: 400 });
    }
    if (content.length > 60000) {
      return new Response('Content is too long. Please limit to ~10,000 words.', { status: 400 });
    }

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const messageStream = client.messages.stream({
            model: 'claude-opus-4-6',
            max_tokens: 8000,
            thinking: { type: 'adaptive' },
            system: GEO_SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: `Analyze the following content for GEO optimization.\n\nTarget AI Query: "${targetQuery.trim()}"\n\nContent to analyze:\n${content.trim()}`,
              },
            ],
          });

          messageStream.on('text', (text) => {
            controller.enqueue(encoder.encode(text));
          });

          await messageStream.finalMessage();
          controller.close();
        } catch (err: any) {
          const message =
            err?.status === 401
              ? 'ERROR: Invalid API key. Please check your Anthropic API key at console.anthropic.com'
              : err?.status === 429
              ? 'ERROR: Rate limit reached. Please wait a moment and try again.'
              : `ERROR: ${err?.message || 'Analysis failed. Please try again.'}`;
          controller.enqueue(encoder.encode(message));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    return new Response(err?.message || 'Internal server error', { status: 500 });
  }
}
