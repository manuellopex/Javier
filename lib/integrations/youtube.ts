/**
 * YouTube Data API v3 — plain REST, server-side only.
 * Activates with YOUTUBE_API_KEY (free quota: 10k units/day; a search costs
 * 100 units). Used by the YouTube Research Agent and the /youtube workspace.
 */

const BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeResult {
  video_id: string;
  url: string;
  title: string;
  channel: string;
  description: string;
  published_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  duration: string | null;
  thumbnail: string | null;
}

export function isYouTubeConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

export async function youtubeSearch(
  query: string,
  maxResults = 10,
  order: 'relevance' | 'viewCount' | 'date' = 'relevance'
): Promise<YouTubeResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY not configured (see docs/agents.md)');

  const searchParams = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(Math.min(maxResults, 25)),
    order,
    key,
  });
  const searchRes = await fetch(`${BASE}/search?${searchParams}`);
  if (!searchRes.ok) {
    throw new Error(`YouTube search failed ${searchRes.status}: ${(await searchRes.text()).slice(0, 200)}`);
  }
  const search = (await searchRes.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: { high?: { url?: string }; default?: { url?: string } };
      };
    }[];
  };

  const items = (search.items ?? []).filter((i) => i.id?.videoId);
  if (items.length === 0) return [];

  // Second call: public statistics + duration for the found videos.
  const ids = items.map((i) => i.id!.videoId).join(',');
  const statsParams = new URLSearchParams({ part: 'statistics,contentDetails', id: ids, key });
  const statsRes = await fetch(`${BASE}/videos?${statsParams}`);
  const stats = statsRes.ok
    ? ((await statsRes.json()) as {
        items?: {
          id?: string;
          statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
          contentDetails?: { duration?: string };
        }[];
      })
    : { items: [] };

  const statsById = new Map((stats.items ?? []).map((s) => [s.id, s]));

  return items.map((item) => {
    const videoId = item.id!.videoId!;
    const s = statsById.get(videoId);
    return {
      video_id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: item.snippet?.title ?? '',
      channel: item.snippet?.channelTitle ?? '',
      description: (item.snippet?.description ?? '').slice(0, 300),
      published_at: item.snippet?.publishedAt ?? '',
      views: s?.statistics?.viewCount ? Number(s.statistics.viewCount) : null,
      likes: s?.statistics?.likeCount ? Number(s.statistics.likeCount) : null,
      comments: s?.statistics?.commentCount ? Number(s.statistics.commentCount) : null,
      duration: s?.contentDetails?.duration ?? null,
      thumbnail:
        item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    };
  });
}
