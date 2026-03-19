import { createAIStream, STREAM_HEADERS } from '@/lib/ai-stream';
import { MARKETING_AUDIT_PROMPT } from '@/lib/system-prompt';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const {
      content,
      apiKey,
      provider = 'anthropic',
      model = 'claude-opus-4-6',
    } = await request.json();

    if (!apiKey?.trim()) return new Response('API key is required.', { status: 401 });
    if (!content?.trim()) return new Response('Content is required.', { status: 400 });
    if (content.length > 60000)
      return new Response('Content too long. Limit ~10,000 words.', { status: 400 });

    const stream = await createAIStream({
      provider,
      apiKey: apiKey.trim(),
      model,
      system: MARKETING_AUDIT_PROMPT,
      userMessage: `Run a full marketing audit on this page content:\n\n${content.trim()}`,
    });

    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (err: any) {
    return new Response(err?.message || 'Internal server error', { status: 500 });
  }
}
