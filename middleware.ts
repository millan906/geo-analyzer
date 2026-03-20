import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

// In-memory rate limiter — resets on server restart.
// For production, replace with Redis/Upstash for persistence across instances.
const rateLimit = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // requests per window per IP

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous'
  );
}

export default auth(function middleware(request: NextRequest) {
  // Protect server-side persistence routes
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/reports') || pathname.startsWith('/api/history')) {
    // @ts-expect-error auth injects auth property
    if (!request.auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Rate limit analyze endpoint
  if (pathname.startsWith('/api/analyze')) {
    const ip = getClientIp(request);
    const now = Date.now();
    const record = rateLimit.get(ip);

    if (!record || now > record.resetAt) {
      rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      record.count += 1;
      if (record.count > MAX_REQUESTS) {
        return new NextResponse('Rate limit exceeded. Please wait a minute and try again.', {
          status: 429,
          headers: {
            'Retry-After': '60',
            'Content-Type': 'text/plain',
          },
        });
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/api/:path*', '/login'],
};
