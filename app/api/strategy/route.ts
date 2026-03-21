import { createAIStream, STREAM_HEADERS } from '@/lib/ai-stream';
import { STRATEGY_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { resolveWithFallbacks } from '@/lib/server-keys';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const {
      auditReport,
      apiKey,
      provider = 'gemini',
      model = 'gemini-2.0-flash',
    } = await request.json();

    const { apiKey: effectiveKey, fallbacks } = resolveWithFallbacks(provider, model, apiKey);
    if (!effectiveKey)
      return new Response('Please add your API key — click the provider button in the top right.', {
        status: 401,
      });
    if (!auditReport?.trim()) return new Response('Audit report is required.', { status: 400 });

    const stream = await createAIStream(
      {
        provider,
        apiKey: effectiveKey,
        model,
        system: STRATEGY_SYSTEM_PROMPT,
        userMessage: `Based on the following audit report, generate a prioritized GEO strategy roadmap:\n\n${auditReport.trim()}`,
        maxTokens: 4000,
      },
      fallbacks
    );

    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (err: any) {
    return new Response(err?.message || 'Internal server error', { status: 500 });
  }
}
