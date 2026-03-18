# GEO Analyzer

**The Yoast SEO of the AI Era**

GEO Analyzer scores your content for AI citability — telling you exactly how likely it is to appear in Google AI Overviews, ChatGPT, Perplexity, and Gemini answers, and giving you a precise checklist to improve it.

Just as Yoast SEO gives you green/yellow/red lights for traditional search optimization, GEO Analyzer delivers a **GEO Score** with signal-level breakdowns, rewrite examples, and a simulated AI answer preview — all streamed in real time, powered by Claude.

---

## Features

- **GEO Score (0–100)** — A weighted composite across 6 AI citability signals, with traffic-light status per signal
- **Target AI Query** — Anchor every analysis to the natural language prompt your audience types into AI systems
- **Signal Breakdown** — Per-signal scores with one-line findings and animated progress bars
- **Quick Wins** — Prioritized fixes estimated under 30 minutes each
- **Rewrite Suggestions** — Side-by-side before/after rewrites using your actual content
- **AI Answer Preview** — A simulation of what ChatGPT or Gemini would say if it read your page right now
- **Streaming output** — Analysis streams token-by-token as Claude thinks, with a live cursor
- **Browser-stored API key** — Your Anthropic key is saved to `localStorage` only; it never touches a server you don't control
- **Copy report** — One-click copy of the full analysis to clipboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| AI | Anthropic SDK (`claude-opus-4-6`, adaptive extended thinking) |
| Streaming | Web Streams API (`ReadableStream`) |
| Testing | Jest 29, Testing Library |
| Linting / Formatting | ESLint, Prettier, lint-staged, Husky |

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com) (free tier works for testing)

### Install and run

```bash
git clone https://github.com/your-username/geo-analyzer.git
cd geo-analyzer
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

No `.env` file is required. The API key is entered directly in the UI and stored only in your browser's `localStorage`.

### Other commands

```bash
npm run build        # Production build
npm run start        # Run production build
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Jest test suite
npm run test:ci      # Jest with coverage (for CI)
```

---

## How to Use

1. **Add your API key** — Click "Add API Key" in the header and paste your `sk-ant-api03-...` key. It is saved locally in your browser for future sessions.

2. **Enter a Target AI Query** — Type the natural language prompt your target audience would ask an AI system. For example:
   - *"best dental clinic in Cebu City"*
   - *"top HR software for small business"*
   - *"how to choose a local plumber"*

3. **Paste your content** — Copy any page content into the text area: a service page, homepage, about page, blog post, or product description. The word count updates live.

4. **Run GEO Analysis** — Click "Run GEO Analysis." The report streams in as Claude processes your content. The GEO Score and signal bars update as results arrive.

5. **Review and act** — Read the signal breakdown, apply the Quick Wins, use the rewrite suggestions, and study the AI Answer Preview to understand what the AI currently sees (and misses) in your content.

6. **Copy or reset** — Copy the full report to clipboard, or click Reset to analyze a new piece of content.

---

## GEO Score Breakdown

The GEO Score is a 0–100 rating across six weighted signals. Every signal is scored independently against the submitted content and the Target AI Query.

| Signal | Weight | What It Measures |
|---|---|---|
| **Citability** | 25 pts | Does the content open with a direct answer (BLUF)? Can an LLM extract complete, standalone facts? Is language specific and declarative rather than promotional? |
| **Entity Clarity** | 20 pts | Is the brand or business name stated clearly in the first paragraph? Is location, category, and industry explicit? Are names consistent throughout? |
| **Factual Density** | 20 pts | Are there specific, verifiable data points — years in operation, certifications, counts, pricing ranges, timelines? Or only qualitative claims? |
| **Format Quality** | 15 pts | Is there a proper H1 → H2 → H3 structure? A FAQ section with at least 5 Q&A pairs? Bullet lists or numbered steps? Appropriate word count (800–2000 for service pages)? |
| **Topical Authority** | 10 pts | Does the page cover the topic comprehensively, address related subtopics, demonstrate process knowledge, and use industry terminology correctly? |
| **Schema Health** | 10 pts | Is structured data (JSON-LD) present? Does it include `LocalBusiness`, `FAQPage`, and `Service` types with a `sameAs` array? |

**Score ranges:**

| Score | Status | Meaning |
|---|---|---|
| 80–100 | GEO Ready | Likely to be cited by AI systems |
| 50–79 | Needs Work | Some signals are missing or weak |
| 0–49 | Not Optimized | Unlikely to appear in AI-generated answers |

---

## Project Structure

```
geo-analyzer/
├── app/
│   ├── page.tsx                  # Main UI — input form, score card, signal bars, analysis panel
│   ├── layout.tsx                # Root layout and metadata
│   ├── globals.css               # Tailwind base styles
│   └── api/
│       └── analyze/
│           └── route.ts          # POST endpoint — calls Claude API, returns a streaming response
├── lib/
│   ├── system-prompt.ts          # GEO Analyzer system prompt (scoring rubric, output format)
│   └── parse-geo.ts              # Parses GEO Score and signal data from streamed Claude output
├── __tests__/
│   ├── api/
│   │   └── analyze.test.ts       # API route tests
│   └── lib/
│       └── parse-geo.test.ts     # Unit tests for score and signal parsing
├── middleware.ts                 # Next.js middleware
├── tailwind.config.ts
├── jest.config.ts
└── package.json
```

### Key files at a glance

- **`app/page.tsx`** — Single-page client component. Manages all state (API key, query, content, streamed analysis text), renders the score card with animated signal bars, and handles the streaming fetch loop.
- **`app/api/analyze/route.ts`** — Receives `{ content, targetQuery, apiKey }`, instantiates an Anthropic client with the user-supplied key, calls `claude-opus-4-6` with adaptive extended thinking enabled, and pipes the text stream directly back to the browser.
- **`lib/system-prompt.ts`** — The complete GEO Analyzer system prompt. Defines the 6-signal scoring rubric, score ranges, and the exact structured output format that Claude must produce.
- **`lib/parse-geo.ts`** — Lightweight regex parsers that extract the numeric GEO Score and per-signal data from the streamed text in real time, so the UI can update the score card while the report is still generating.

---

## Environment Variables

For basic use, no `.env` file is required.

The user's Anthropic API key is entered in the browser UI and stored in `localStorage`. It is passed directly from the client to the `/api/analyze` route on each request and is never logged or persisted server-side.

If you are deploying this and want to pre-configure a server-side key (for example, to remove the in-browser key entry step), you can add:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

> The current codebase uses the client-supplied key by design, so you would need to modify `app/api/analyze/route.ts` to read from `process.env` instead.

---

## Roadmap

The following features are planned for future releases:

- **GEO Content Rewriter** — Full page rewrite using BLUF intro, entity anchor paragraph, restructured headers, and an appended FAQ block, all in one pass
- **Schema Markup Generator** — Produces ready-to-paste JSON-LD for `LocalBusiness`, `FAQPage`, and `Service` types, with Yoast and RankMath implementation instructions
- **AI Answer Preview (standalone)** — Run an answer simulation independently, without a full GEO Score analysis
- **Competitor GEO Gap Analysis** — Compare your content against a competitor URL to identify why they appear in AI answers and you don't, with targeted displacement recommendations
- **GBP Optimization Brief** — Generate a complete Google Business Profile brief: optimized description, category recommendations, service list, post copy, Q&A pairs, and review response templates
- **GEO Score history** — Track scores over time per URL as you iterate on content
- **WordPress plugin / bookmarklet** — Analyze content from inside the Gutenberg editor without leaving WordPress

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

*GEO Analyzer — powered by [Claude](https://anthropic.com)*
