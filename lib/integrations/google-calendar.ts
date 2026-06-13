import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Google Calendar connector — plain REST, no SDK.
 *
 * OAuth tokens live in the `integrations` table (kind: 'google_calendar',
 * config: { refresh_token, access_token, access_token_expires_at }).
 * Requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET; see docs/integrations.md.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export const INTEGRATION_KIND = 'google_calendar';

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // always get a refresh_token
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

interface GoogleIntegrationConfig {
  refresh_token: string;
  access_token: string;
  access_token_expires_at: string;
}

/** Returns the user's Google Calendar integration row, or null. */
export async function getGoogleIntegration(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('integrations')
    .select('id, enabled, config')
    .eq('user_id', userId)
    .eq('kind', INTEGRATION_KIND)
    .maybeSingle();
  return data && data.enabled ? data : null;
}

/**
 * Returns a valid access token for the user, refreshing (and persisting the
 * refreshed token) when expired. Null when not connected.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const integration = await getGoogleIntegration(supabase, userId);
  if (!integration) return null;

  const config = integration.config as GoogleIntegrationConfig;
  const expiresAt = new Date(config.access_token_expires_at ?? 0).getTime();
  if (config.access_token && expiresAt > Date.now() + 60_000) {
    return config.access_token;
  }

  const refreshed = await refreshAccessToken(config.refresh_token);
  const newConfig: GoogleIntegrationConfig = {
    refresh_token: refreshed.refresh_token ?? config.refresh_token,
    access_token: refreshed.access_token,
    access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  };
  await supabase.from('integrations').update({ config: newConfig }).eq('id', integration.id);
  return newConfig.access_token;
}

// --- Calendar REST operations -------------------------------------------------

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export async function gcalListEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const res = await fetch(`${CAL_BASE}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google Calendar list failed (${res.status})`);
  const data = (await res.json()) as { items?: GoogleEvent[] };
  return data.items ?? [];
}

export async function gcalCreateEvent(
  accessToken: string,
  input: {
    title: string;
    description?: string;
    location?: string;
    starts_at: string;
    ends_at: string;
    all_day?: boolean;
  }
): Promise<GoogleEvent> {
  const body = input.all_day
    ? {
        summary: input.title,
        description: input.description,
        location: input.location,
        start: { date: input.starts_at.slice(0, 10) },
        end: { date: input.ends_at.slice(0, 10) },
      }
    : {
        summary: input.title,
        description: input.description,
        location: input.location,
        start: { dateTime: input.starts_at },
        end: { dateTime: input.ends_at },
      };

  const res = await fetch(CAL_BASE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Google Calendar create failed: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

export async function gcalDeleteEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete failed (${res.status})`);
  }
}
