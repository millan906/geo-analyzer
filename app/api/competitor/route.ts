import { createAIStream, STREAM_HEADERS } from '@/lib/ai-stream';
import { COMPETITOR_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { resolveApiKey } from '@/lib/server-keys';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const {
      myContent,
      competitorContent,
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
    if (!myContent?.trim()) return new Response('Your content is required.', { status: 400 });
    if (!competitorContent?.trim())
      return new Response('Competitor content is required.', { status: 400 });

    const stream = await createAIStream({
      provider,
      apiKey: effectiveKey,
      model,
      system: COMPETITOR_SYSTEM_PROMPT,
      userMessage: `Perform a GEO competitor gap analysis.\n\nTarget AI Query: "${targetQuery.trim()}"\n\nMY CONTENT:\n${myContent.trim()}\n\n---\n\nCOMPETITOR CONTENT:\n${competitorContent.trim()}`,
    });

    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (err: any) {
    return new Response(err?.message || 'Internal server error', { status: 500 });
  }
}
