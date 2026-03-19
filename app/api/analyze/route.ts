import { createAIStream, STREAM_HEADERS } from '@/lib/ai-stream';
import { GEO_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { resolveApiKey } from '@/lib/server-keys';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const {
      content,
      targetQuery,
      apiKey,
      provider = 'anthropic',
      model = 'claude-opus-4-6',
    } = await request.json();

    const effectiveKey = resolveApiKey(provider, apiKey);
    if (!effectiveKey)
      return new Response('Please add your API key — click the provider button in the top right.', {
        status: 401,
      });
    if (!targetQuery?.trim()) return new Response('Target AI Query is required.', { status: 400 });
    if (!content?.trim()) return new Response('Content is required.', { status: 400 });
    if (content.length > 60000)
      return new Response('Content too long. Limit ~10,000 words.', { status: 400 });

    const stream = await createAIStream({
      provider,
      apiKey: effectiveKey,
      model,
      system: GEO_SYSTEM_PROMPT,
      userMessage: `Analyze the following content for GEO optimization.\n\nTarget AI Query: "${targetQuery.trim()}"\n\nContent to analyze:\n${content.trim()}`,
      maxTokens: 8000,
    });

    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (err: any) {
    return new Response(err?.message || 'Internal server error', { status: 500 });
  }
}
