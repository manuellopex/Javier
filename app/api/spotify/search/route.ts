import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/security/rate-limit';
import { spotifySearch, isSpotifyConfigured } from '@/lib/integrations/spotify';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`spotify:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  if (!isSpotifyConfigured()) {
    return Response.json(
      {
        error:
          'Spotify API not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET (docs/agents.md).',
      },
      { status: 501 }
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  if (!q) return Response.json({ error: 'q is required' }, { status: 400 });

  try {
    const results = await spotifySearch(q, Number(url.searchParams.get('limit')) || 12);
    return Response.json({ results });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Spotify search failed' },
      { status: 502 }
    );
  }
}
