export const PROVIDERS = {
  anthropic: {
    name: 'Claude',
    fullName: 'Anthropic Claude',
    keyLabel: 'Anthropic API Key',
    keyPlaceholder: 'sk-ant-api03-...',
    keyLink: 'console.anthropic.com',
    freeTier: false,
    models: [
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6 — Best' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — Faster' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — Cheapest' },
    ],
    defaultModel: 'claude-opus-4-6',
  },
  gemini: {
    name: 'Gemini',
    fullName: 'Google Gemini',
    keyLabel: 'Google AI Studio Key',
    keyPlaceholder: 'AIzaSy...',
    keyLink: 'aistudio.google.com',
    freeTier: true,
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — Free tier' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite — Free tier' },
      { id: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro — Paid' },
    ],
    defaultModel: 'gemini-2.0-flash',
  },
  groq: {
    name: 'Llama',
    fullName: 'Groq (Llama)',
    keyLabel: 'Groq API Key',
    keyPlaceholder: 'gsk_...',
    keyLink: 'console.groq.com',
    freeTier: true,
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B — Best Free' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B — Fastest' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B — Alternative' },
    ],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  openai: {
    name: 'GPT',
    fullName: 'OpenAI GPT',
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-proj-...',
    keyLink: 'platform.openai.com',
    freeTier: false,
    models: [
      { id: 'gpt-4o', label: 'GPT-4o — Best' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini — Cheaper' },
    ],
    defaultModel: 'gpt-4o',
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;
