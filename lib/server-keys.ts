import type { FallbackConfig } from './ai-stream';

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

/**
 * Builds a fallback chain for server-key requests.
 * Tries cheaper/alternative models before giving up, across both free providers.
 * Only used when the request is using a server key (not a user-supplied key).
 *
 * Fallback order:
 *   gemini-2.0-flash → gemini-2.0-flash-lite → groq/llama-3.1-8b-instant
 *   groq/llama-3.3-70b → groq/llama-3.1-8b-instant → gemini-2.0-flash-lite
 */
export function getServerFallbacks(
  primaryProvider: string,
  primaryModel: string
): FallbackConfig[] {
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || '';
  const groqKey = process.env.GROQ_API_KEY?.trim() || '';
  const chain: FallbackConfig[] = [];

  if (primaryProvider === 'gemini') {
    // Same provider, lighter model (separate quota)
    if (primaryModel !== 'gemini-2.0-flash-lite' && geminiKey) {
      chain.push({ provider: 'gemini', apiKey: geminiKey, model: 'gemini-2.0-flash-lite' });
    }
    // Cross-provider fallback
    if (groqKey) {
      chain.push({ provider: 'groq', apiKey: groqKey, model: 'llama-3.1-8b-instant' });
    }
  }

  if (primaryProvider === 'groq') {
    // Same provider, lighter model (separate token pool)
    if (primaryModel !== 'llama-3.1-8b-instant' && groqKey) {
      chain.push({ provider: 'groq', apiKey: groqKey, model: 'llama-3.1-8b-instant' });
    }
    // Cross-provider fallback
    if (geminiKey) {
      chain.push({ provider: 'gemini', apiKey: geminiKey, model: 'gemini-2.0-flash-lite' });
    }
  }

  return chain;
}

/**
 * Convenience: resolves key + builds fallback chain in one call.
 * Routes use this when they want automatic fallback on quota errors.
 */
export function resolveWithFallbacks(
  provider: string,
  model: string,
  userApiKey?: string
): { apiKey: string; fallbacks: FallbackConfig[] } {
  const apiKey = resolveApiKey(provider, userApiKey);
  const fallbacks = !userApiKey?.trim() ? getServerFallbacks(provider, model) : [];
  return { apiKey, fallbacks };
}
