export type VideoRecommendationSource = "youtube" | "youtube_search";

export interface VideoRecommendation {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  watchUrl: string;
  source: VideoRecommendationSource;
  reason: string;
}

type RecommendationInput = {
  id?: unknown;
  video_id?: unknown;
  title?: unknown;
  description?: unknown;
  thumbnail_url?: unknown;
  channel_title?: unknown;
  watch_url?: unknown;
  source?: unknown;
  reason?: unknown;
};

type TopicInput = {
  title?: string | null;
  subject?: string | null;
  topic?: string | null;
  description?: string | null;
};

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function buildVideoRecommendationQuery(item?: TopicInput | null) {
  if (!item) return "effective study techniques for students";

  const subject = text(item.subject);
  const topic = text(item.topic) || text(item.title);
  const description = text(item.description);
  const parts = [subject, topic, description]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);

  return (parts.join(" ") || "effective study techniques for students").slice(
    0,
    180,
  );
}

export function youtubeSearchUrl(query: string) {
  const safeQuery = text(query, "study skills").slice(0, 180);
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(safeQuery)}`;
}

function safeWatchUrl(input: RecommendationInput) {
  const videoId = text(input.video_id);
  if (YOUTUBE_VIDEO_ID.test(videoId)) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  const candidate = text(input.watch_url);
  try {
    const url = new URL(candidate);
    const trustedHost =
      url.hostname === "www.youtube.com" || url.hostname === "youtube.com";
    const videoCandidate = url.searchParams.get("v") || "";
    const validWatchPage =
      url.pathname === "/watch" && YOUTUBE_VIDEO_ID.test(videoCandidate);
    const validSearchPage =
      url.pathname === "/results" && url.searchParams.has("search_query");
    return trustedHost && (validWatchPage || validSearchPage)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function safeThumbnailUrl(value: unknown) {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeVideoRecommendations(
  value: unknown,
): VideoRecommendation[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const input = raw as RecommendationInput;
    const watchUrl = safeWatchUrl(input);
    const title = text(input.title);
    if (!watchUrl || !title) return [];

    const source: VideoRecommendationSource =
      input.source === "youtube_search" ? "youtube_search" : "youtube";

    return [
      {
        id: text(input.id) || text(input.video_id) || `video-${index}`,
        title,
        description: text(
          input.description,
          source === "youtube"
            ? "A topic-matched lesson selected for your next learning step."
            : "Open this focused search to choose a lesson from YouTube.",
        ),
        thumbnailUrl: safeThumbnailUrl(input.thumbnail_url),
        channelTitle: text(input.channel_title) || null,
        watchUrl,
        source,
        reason: text(
          input.reason,
          source === "youtube"
            ? "Matches your next topic"
            : "Focused search for your next topic",
        ),
      },
    ];
  });
}
