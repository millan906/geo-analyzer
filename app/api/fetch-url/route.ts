export const runtime = 'nodejs';
export const maxDuration = 30;

/** Block private/loopback/link-local hostnames to prevent SSRF */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Loopback and localhost
  if (h === 'localhost' || h === '0.0.0.0' || h.endsWith('.localhost')) return true;

  // AWS metadata and link-local
  if (h.startsWith('169.254.')) return true;

  // IPv6 loopback
  if (h === '::1' || h === '[::1]') return true;

  // Private IPv4 ranges (literal IP hostnames)
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 0) return true; // 0.0.0.0/8
  }

  // .local mDNS hostnames
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;

  return false;
}

function extractText(html: string): string {
  return (
    html
      // Remove scripts, styles, nav, header, footer, aside
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      // Replace block-level elements with newlines for readability
      .replace(/<\/(p|div|li|h[1-6]|section|article|blockquote|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // Strip remaining tags
      .replace(/<[^>]+>/g, '')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&hellip;/g, '…')
      // Collapse excessive whitespace/newlines
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url?.trim()) {
      return Response.json({ error: 'URL is required.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return Response.json({ error: 'Invalid URL. Please include https://' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return Response.json({ error: 'Only http and https URLs are supported.' }, { status: 400 });
    }

    if (isPrivateHost(parsedUrl.hostname)) {
      return Response.json(
        { error: 'URL points to a private or reserved address.' },
        { status: 400 }
      );
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GEOAnalyzer/1.0; +https://geo-analyzer.com)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return Response.json(
        {
          error: `Could not fetch page (HTTP ${response.status}). The site may block automated access.`,
        },
        { status: 400 }
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return Response.json({ error: 'URL does not point to an HTML page.' }, { status: 400 });
    }

    const html = await response.text();
    const text = extractText(html);

    if (text.length < 50) {
      return Response.json(
        { error: 'Could not extract readable content from this page.' },
        { status: 400 }
      );
    }

    // Cap at ~60k chars to stay within Claude's analysis limit
    const truncated = text.length > 60000 ? text.slice(0, 60000) + '\n\n[Content truncated]' : text;

    return Response.json({ text: truncated, charCount: truncated.length });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return Response.json(
        { error: 'Request timed out. The site took too long to respond.' },
        { status: 408 }
      );
    }
    return Response.json({ error: err?.message || 'Failed to fetch URL.' }, { status: 500 });
  }
}
