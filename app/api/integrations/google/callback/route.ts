import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { exchangeCode, INTEGRATION_KIND } from '@/lib/integrations/google-calendar';
import { audit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

/** Google OAuth callback: exchanges the code and stores tokens. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectTo = (suffix: string) =>
    Response.redirect(`${url.origin}/integrations?google=${suffix}`, 302);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectTo('error');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = cookies().get('aura_g_state')?.value;
  cookies().delete('aura_g_state');

  if (!code || !state || !expectedState || state !== expectedState) {
    await audit({
      userId: user.id,
      event: 'integration.google.oauth_rejected',
      detail: { reason: 'state mismatch or missing code' },
      risk: 'HIGH',
    });
    return redirectTo('error');
  }

  try {
    const redirectUri = `${url.origin}/api/integrations/google/callback`;
    const tokens = await exchangeCode(code, redirectUri);
    if (!tokens.refresh_token) {
      // Without a refresh token the connection dies in an hour — reject.
      return redirectTo('error');
    }

    const config = {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    };

    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('kind', INTEGRATION_KIND)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('integrations')
        .update({ enabled: true, config })
        .eq('id', existing.id);
    } else {
      await supabase.from('integrations').insert({
        user_id: user.id,
        kind: INTEGRATION_KIND,
        name: 'Google Calendar',
        enabled: true,
        config,
      });
    }

    await audit({
      userId: user.id,
      event: 'integration.google.connected',
      detail: {},
      risk: 'MEDIUM',
    });
    return redirectTo('connected');
  } catch (err) {
    console.error('[google/callback]', err);
    return redirectTo('error');
  }
}
