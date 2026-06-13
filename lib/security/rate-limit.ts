/**
 * Basic in-memory sliding-window rate limiter.
 *
 * Good enough for a single-user MVP. Note: on serverless platforms each
 * instance keeps its own window, so treat this as best-effort protection.
 * Upgrade path: Upstash Redis / Vercel KV (see docs/roadmap.md).
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const win = windows.get(key);

  if (!win || win.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (win.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((win.resetAt - now) / 1000),
    };
  }

  win.count += 1;
  return { ok: true, remaining: limit - win.count, retryAfterSeconds: 0 };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}
