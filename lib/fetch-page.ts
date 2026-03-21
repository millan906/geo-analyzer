export interface FetchPageResult {
  text: string;
  charCount: number;
}

/**
 * Fetches and extracts readable text from a URL via the /api/fetch-url route.
 * Throws an Error with a user-facing message on failure.
 */
export async function fetchPageContent(url: string): Promise<FetchPageResult> {
  const res = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to fetch page.');
  }

  return { text: data.text as string, charCount: data.charCount as number };
}
