import { GEO_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { STREAM_HEADERS } from '@/lib/ai-stream';

export const runtime = 'nodejs';
export const maxDuration = 180;

const encoder = new TextEncoder();

async function callGemini(apiKey: string, model: string, userMessage: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model, systemInstruction: GEO_SYSTEM_PROMPT });
  const result = await geminiModel.generateContent(userMessage);
  return result.response.text();
}

async function callGroq(apiKey: string, model: string, userMessage: string): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
  const response = await client.chat.completions.create({
    model,
    max_tokens: 8000,
    messages: [
      { role: 'system', content: GEO_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  });
  return response.choices[0]?.message?.content || '';
}

export async function POST(request: Request) {
  try {
    const { content, targetQuery, geminiKey, groqKey, geminiModel, groqModel } =
      await request.json();

    if (!geminiKey?.trim() && !groqKey?.trim()) {
      return new Response('At least one free API key (Gemini or Groq/Llama) is required.', {
        status: 401,
      });
    }
    if (!content?.trim()) return new Response('Content is required.', { status: 400 });

    const userMessage = `Analyze the following content for GEO optimization.\n\nTarget AI Query: "${targetQuery?.trim() || 'Infer the most relevant target query from the content'}"\n\nContent:\n${content.trim()}`;

    // Run both models in parallel
    const tasks: Promise<{ model: string; analysis: string }>[] = [];

    if (geminiKey?.trim()) {
      tasks.push(
        callGemini(geminiKey.trim(), geminiModel || 'gemini-2.0-flash', userMessage)
          .then((text) => ({ model: 'Gemini', analysis: text }))
          .catch((err) => ({ model: 'Gemini', analysis: `ERROR: ${err.message}` }))
      );
    }

    if (groqKey?.trim()) {
      tasks.push(
        callGroq(groqKey.trim(), groqModel || 'llama-3.3-70b-versatile', userMessage)
          .then((text) => ({ model: 'Llama (Groq)', analysis: text }))
          .catch((err) => ({ model: 'Llama (Groq)', analysis: `ERROR: ${err.message}` }))
      );
    }

    const results = await Promise.all(tasks);
    const valid = results.filter((r) => !r.analysis.startsWith('ERROR:'));

    if (valid.length === 0) {
      const errors = results.map((r) => `${r.model}: ${r.analysis}`).join('\n');
      return new Response(`ERROR: Both models failed.\n${errors}`, { status: 500 });
    }

    // Only one model succeeded — return its result directly
    if (valid.length === 1) {
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(valid[0].analysis));
            controller.close();
          },
        }),
        { headers: STREAM_HEADERS }
      );
    }

    // Both succeeded — stream a consensus synthesis
    const synthesisPrompt = `You are synthesizing two independent GEO analysis reports for the same webpage. Produce a single authoritative CONSENSUS GEO report.

## Report A — ${valid[0].model}
${valid[0].analysis}

## Report B — ${valid[1].model}
${valid[1].analysis}

Instructions:
- Start with "## 🔀 Multi-Model Consensus Report (${valid[0].model} + ${valid[1].model})"
- Average the GEO scores from both reports into one final score
- For each signal, show both scores and the average: e.g. "Citability: 18/25 avg (Gemini: 20, Llama: 16)"
- Under "Consensus Insights", highlight findings BOTH models agree on (high confidence)
- Under "Disputed Signals", flag where the models disagree significantly — this reveals genuine uncertainty about the content
- Keep all Quick Wins and rewrite suggestions from both, deduplicated
- End with the AI Answer Preview from whichever model gave the more complete one
- Be specific, actionable, and confident`;

    const { default: OpenAI } = await import('openai');

    // Use Groq for synthesis (free + fast streaming), fall back to Gemini via non-streaming
    if (groqKey?.trim()) {
      const client = new OpenAI({
        apiKey: groqKey.trim(),
        baseURL: 'https://api.groq.com/openai/v1',
      });
      const stream = await client.chat.completions.create({
        model: groqModel || 'llama-3.3-70b-versatile',
        max_tokens: 8000,
        stream: true,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert GEO analyst synthesizing multi-model reports. Be specific, structured, and actionable.',
          },
          { role: 'user', content: synthesisPrompt },
        ],
      });

      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of stream) {
                const text = chunk.choices[0]?.delta?.content || '';
                if (text) controller.enqueue(encoder.encode(text));
              }
              controller.close();
            } catch (err: any) {
              controller.enqueue(encoder.encode(`\n\nERROR synthesizing: ${err.message}`));
              controller.close();
            }
          },
        }),
        { headers: STREAM_HEADERS }
      );
    }

    // Fallback: synthesize with Gemini (non-streaming, then return)
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiKey.trim());
    const geminiSynth = genAI.getGenerativeModel({ model: geminiModel || 'gemini-2.0-flash' });
    const synthResult = await geminiSynth.generateContent(synthesisPrompt);
    const synthText = synthResult.response.text();

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(synthText));
          controller.close();
        },
      }),
      { headers: STREAM_HEADERS }
    );
  } catch (err: any) {
    return new Response(err?.message || 'Internal server error', { status: 500 });
  }
}
