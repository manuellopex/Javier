import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/security/rate-limit';
import { youtubeSearch, isYouTubeConfigured } from '@/lib/integrations/youtube';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`yt:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  if (!isYouTubeConfigured()) {
    return Response.json(
      { error: 'YouTube Data API not configured. Set YOUTUBE_API_KEY (docs/agents.md).' },
      { status: 501 }
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  if (!q) return Response.json({ error: 'q is required' }, { status: 400 });
  const order = url.searchParams.get('order');

  try {
    const results = await youtubeSearch(
      q,
      Number(url.searchParams.get('max')) || 12,
      order === 'viewCount' || order === 'date' ? order : 'relevance'
    );
    return Response.json({ results });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'YouTube search failed' },
      { status: 502 }
    );
  }
}
