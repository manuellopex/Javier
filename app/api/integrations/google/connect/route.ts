import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { buildAuthUrl, isGoogleConfigured } from '@/lib/integrations/google-calendar';

export const dynamic = 'force-dynamic';

/** Starts the Google Calendar OAuth flow (redirects to Google consent). */
export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isGoogleConfigured()) {
    return Response.json(
      { error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' },
      { status: 503 }
    );
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/integrations/google/callback`;
  const state = crypto.randomBytes(24).toString('hex');

  cookies().set('aura_g_state', state, {
    httpOnly: true,
    secure: origin.startsWith('https'),
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return Response.redirect(buildAuthUrl(redirectUri, state), 302);
}
