/**
 * Resolves the API key for a given provider.
 * Priority: user-supplied key → server environment variable → empty string
 */
export function resolveApiKey(provider: string, userKey?: string): string {
  if (userKey?.trim()) return userKey.trim();
  const env: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };
  return env[provider]?.trim() || '';
}
