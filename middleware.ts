import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const WINDOW_S = 60; // 1 minute window
const MAX_REQUESTS = 10; // requests per window per IP

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous'
  );
}

export default auth(async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Protect server-side persistence routes
  if (pathname.startsWith('/api/reports') || pathname.startsWith('/api/history')) {
    // @ts-expect-error auth injects auth property
    if (!request.auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Rate limit analyze endpoint
  if (pathname.startsWith('/api/analyze')) {
    const ip = getClientIp(request);
    const key = `rate_limit:${ip}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_S);
    }

    if (count > MAX_REQUESTS) {
      return new NextResponse('Rate limit exceeded. Please wait a minute and try again.', {
        status: 429,
        headers: {
          'Retry-After': '60',
          'Content-Type': 'text/plain',
        },
      });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/api/:path*', '/login'],
};
