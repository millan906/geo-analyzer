export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    gemini: !!process.env.GEMINI_API_KEY?.trim(),
    groq: !!process.env.GROQ_API_KEY?.trim(),
    anthropic: !!process.env.ANTHROPIC_API_KEY?.trim(),
    openai: !!process.env.OPENAI_API_KEY?.trim(),
  });
}
