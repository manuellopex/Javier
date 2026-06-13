import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarEvent } from '@/types';
import {
  getValidAccessToken,
  gcalListEvents,
  gcalCreateEvent,
  gcalDeleteEvent,
} from '@/lib/integrations/google-calendar';

/**
 * Unified calendar:
 *  - Local events always live in the `events` table.
 *  - When Google Calendar is connected, listings MERGE both sources and new
 *    events are CREATED in Google (so they exist on your real calendar).
 */

export interface CreateEventInput {
  title: string;
  starts_at: string;
  ends_at?: string | null;
  description?: string | null;
  location?: string | null;
  all_day?: boolean;
}

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export async function listEvents(
  supabase: SupabaseClient,
  userId: string,
  range: { from: string; to: string }
): Promise<CalendarEvent[]> {
  const { data: local, error } = await supabase
    .from('events')
    .select('id, title, description, location, starts_at, ends_at, all_day')
    .eq('user_id', userId)
    .gte('starts_at', range.from)
    .lte('starts_at', range.to)
    .order('starts_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  const events: CalendarEvent[] = (local ?? []).map((e) => ({ ...e, source: 'local' as const }));

  try {
    const token = await getValidAccessToken(supabase, userId);
    if (token) {
      const googleEvents = await gcalListEvents(token, range.from, range.to);
      for (const g of googleEvents) {
        events.push({
          id: g.id,
          title: g.summary ?? '(sin título)',
          description: g.description ?? null,
          location: g.location ?? null,
          starts_at: g.start?.dateTime ?? (g.start?.date ? `${g.start.date}T00:00:00Z` : ''),
          ends_at: g.end?.dateTime ?? null,
          all_day: Boolean(g.start?.date),
          source: 'google',
        });
      }
    }
  } catch (err) {
    // Google being down/expired must not hide the local calendar.
    console.error('[calendar] google list failed:', err);
  }

  events.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return events;
}

export async function createEvent(
  supabase: SupabaseClient,
  userId: string,
  input: CreateEventInput
): Promise<CalendarEvent> {
  const starts = new Date(input.starts_at);
  if (Number.isNaN(starts.getTime())) throw new Error('Invalid starts_at datetime');
  const ends = input.ends_at
    ? new Date(input.ends_at)
    : new Date(starts.getTime() + DEFAULT_DURATION_MS);

  const normalized = {
    title: input.title.slice(0, 300),
    description: input.description ?? null,
    location: input.location ?? null,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    all_day: Boolean(input.all_day),
  };

  const token = await getValidAccessToken(supabase, userId).catch(() => null);
  if (token) {
    const created = await gcalCreateEvent(token, {
      ...normalized,
      description: normalized.description ?? undefined,
      location: normalized.location ?? undefined,
    });
    return {
      id: created.id,
      ...normalized,
      source: 'google',
    };
  }

  const { data, error } = await supabase
    .from('events')
    .insert({ user_id: userId, ...normalized })
    .select('id, title, description, location, starts_at, ends_at, all_day')
    .single();
  if (error) throw new Error(error.message);
  return { ...data, source: 'local' };
}

export async function deleteEvent(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  source: 'local' | 'google'
): Promise<void> {
  if (source === 'google') {
    const token = await getValidAccessToken(supabase, userId);
    if (!token) throw new Error('Google Calendar is not connected');
    await gcalDeleteEvent(token, eventId);
    return;
  }
  const { error } = await supabase.from('events').delete().eq('id', eventId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}
