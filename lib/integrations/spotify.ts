/**
 * Spotify Web API — client-credentials flow, server-side only.
 * Activates with SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET (free; create an
 * app at developer.spotify.com). Used by the Music Direction Agent and the
 * /music workspace.
 *
 * Note: client-credentials gives public catalog search only. Creating real
 * Spotify playlists needs user OAuth (roadmap); AURA keeps reference
 * playlists in the contents table meanwhile.
 */

export interface SpotifyTrack {
  id: string;
  url: string;
  name: string;
  artists: string;
  album: string;
  release_date: string | null;
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
  explicit: boolean;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function getAccessToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Spotify credentials not configured (see docs/agents.md)');

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`Spotify auth failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function spotifySearch(query: string, limit = 10): Promise<SpotifyTrack[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(Math.min(limit, 25)),
  });
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify search failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    tracks?: {
      items?: {
        id: string;
        name: string;
        explicit: boolean;
        duration_ms: number;
        popularity: number;
        preview_url: string | null;
        external_urls?: { spotify?: string };
        artists?: { name: string }[];
        album?: { name?: string; release_date?: string };
      }[];
    };
  };

  return (data.tracks?.items ?? []).map((t) => ({
    id: t.id,
    url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
    name: t.name,
    artists: (t.artists ?? []).map((a) => a.name).join(', '),
    album: t.album?.name ?? '',
    release_date: t.album?.release_date ?? null,
    duration_ms: t.duration_ms,
    popularity: t.popularity,
    preview_url: t.preview_url,
    explicit: t.explicit,
  }));
}
