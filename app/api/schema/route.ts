import { createAIStream, STREAM_HEADERS } from '@/lib/ai-stream';
import { SCHEMA_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { resolveWithFallbacks } from '@/lib/server-keys';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const {
      businessName,
      businessType,
      city,
      state,
      country,
      phone,
      website,
      description,
      services,
      faqs,
      apiKey,
      provider = 'gemini',
      model = 'gemini-2.0-flash',
    } = await request.json();

    const { apiKey: effectiveKey, fallbacks } = resolveWithFallbacks(provider, model, apiKey);
    if (!effectiveKey)
      return new Response('Please add your API key — click the provider button in the top right.', {
        status: 401,
      });
    if (!businessName?.trim()) return new Response('Business name is required.', { status: 400 });

    const parts = [
      `Business Name: ${businessName.trim()}`,
      `Business Type: ${businessType || 'LocalBusiness'}`,
      city?.trim() && `City: ${city.trim()}`,
      state?.trim() && `State/Region: ${state.trim()}`,
      country?.trim() && `Country: ${country.trim()}`,
      phone?.trim() && `Phone: ${phone.trim()}`,
      website?.trim() && `Website: ${website.trim()}`,
      description?.trim() && `Description: ${description.trim()}`,
      services?.trim() && `Services (one per line):\n${services.trim()}`,
      faqs?.trim() && `FAQs:\n${faqs.trim()}`,
    ].filter(Boolean) as string[];

    const stream = await createAIStream(
      {
        provider,
        apiKey: effectiveKey,
        model,
        system: SCHEMA_SYSTEM_PROMPT,
        userMessage: `Generate GEO schema markup for this business:\n\n${parts.join('\n')}`,
        maxTokens: 4000,
      },
      fallbacks
    );

    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (err: any) {
    return new Response(err?.message || 'Internal server error', { status: 500 });
  }
}
