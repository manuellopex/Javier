import crypto from 'node:crypto';

export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufB, bufB);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Auth for the desktop-agent endpoints (shared secret, constant-time). */
export function authorizeAgent(req: Request): boolean {
  const expected = process.env.DESKTOP_AGENT_KEY;
  if (!expected) return false;
  return timingSafeEqual(req.headers.get('x-aura-agent-key') ?? '', expected);
}
