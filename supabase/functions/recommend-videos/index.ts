import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCors } from "../_shared/cors.ts";

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
};

type CachedRecommendations = {
  recommendations: unknown;
  mode: string;
  expires_at: string;
};

type UserProfile = {
  role: string | null;
  account_type: string | null;
  is_admin: boolean | null;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HOURLY_REQUEST_LIMIT = 20;

const fallbackRecommendations = (query: string, limit: number) => {
  const searches = [
    {
      suffix: "explained simply",
      title: `Understand ${query}`,
      reason: "Start with a clear explanation",
    },
    {
      suffix: "worked examples",
      title: `Practise ${query}`,
      reason: "See the idea used step by step",
    },
    {
      suffix: "revision summary",
      title: `Revise ${query}`,
      reason: "Finish with a compact recap",
    },
  ];

  return searches.slice(0, limit).map((item, index) => {
    const searchQuery = `${query} ${item.suffix}`;
    return {
      id: `youtube-search-${index}`,
      title: item.title,
      description:
        "Open this focused YouTube search and choose the explanation that fits you best.",
      thumbnail_url: null,
      channel_title: null,
      watch_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
      source: "youtube_search",
      reason: item.reason,
    };
  });
};

serve(async (req) => {
  const cors = getCors(req);
  const headers = { ...cors.headers, "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
      status: 403,
      headers,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Video recommendations are not configured");
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await callerClient.auth.getUser(authHeader.slice("Bearer ".length));
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("role, account_type, is_admin")
      .eq("id", user.id)
      .maybeSingle<UserProfile>();
    const role = String(profile?.role || "").toLowerCase();
    const accountType = String(profile?.account_type || "").toLowerCase();
    const hasStudentAccountType =
      accountType === "b2c_student" || accountType === "school_student";
    const isStudent =
      !profile?.is_admin &&
      (role === "student" || (!role && hasStudentAccountType)) &&
      (!accountType || hasStudentAccountType);
    if (profileError || !isStudent) throw new Error("Forbidden");

    const body = await req.json();
    const query = String(body?.query_text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
    const requestedLimit = Number(body?.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(4, Math.max(1, Math.floor(requestedLimit)))
      : 3;
    if (!query) throw new Error("Add a topic for video recommendations");

    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY") || "";
    if (!youtubeApiKey) {
      return new Response(
        JSON.stringify({
          recommendations: fallbackRecommendations(query, limit),
          mode: "youtube_search",
        }),
        { status: 200, headers },
      );
    }

    const cacheKey = `${limit}:${query.toLocaleLowerCase()}`;
    const now = new Date().toISOString();
    const { error: cacheCleanupError } = await adminClient
      .from("video_recommendation_cache")
      .delete()
      .lt("expires_at", now);
    if (cacheCleanupError) {
      console.error("Video recommendation cache cleanup failed:", cacheCleanupError);
    }
    const { data: cached, error: cacheReadError } = await adminClient
      .from("video_recommendation_cache")
      .select("recommendations, mode, expires_at")
      .eq("cache_key", cacheKey)
      .gt("expires_at", now)
      .maybeSingle<CachedRecommendations>();
    if (cacheReadError) {
      console.error("Video recommendation cache read failed:", cacheReadError);
    } else if (
      cached &&
      Array.isArray(cached.recommendations) &&
      cached.recommendations.length > 0
    ) {
      return new Response(
        JSON.stringify({
          recommendations: cached.recommendations,
          mode: cached.mode,
          cached: true,
        }),
        { status: 200, headers },
      );
    }

    const { data: withinQuota, error: quotaError } = await adminClient.rpc(
      "consume_video_recommendation_quota",
      {
        p_user_id: user.id,
        p_limit: HOURLY_REQUEST_LIMIT,
        p_window_seconds: 3600,
      },
    );
    if (quotaError) {
      console.error("Video recommendation quota check failed:", quotaError);
      throw new Error("Video recommendations are temporarily unavailable");
    }
    if (!withinQuota) throw new Error("Rate limit exceeded");

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: String(limit),
      safeSearch: "strict",
      videoEmbeddable: "true",
      relevanceLanguage: "en",
      key: youtubeApiKey,
    });
    const youtubeResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );

    if (!youtubeResponse.ok) {
      console.error(
        "YouTube search failed:",
        youtubeResponse.status,
        await youtubeResponse.text(),
      );
      return new Response(
        JSON.stringify({
          recommendations: fallbackRecommendations(query, limit),
          mode: "youtube_search",
        }),
        { status: 200, headers },
      );
    }

    const payload = await youtubeResponse.json();
    const recommendations = (
      Array.isArray(payload?.items) ? payload.items : []
    ).flatMap((item: YouTubeSearchItem) => {
      const videoId = item.id?.videoId || "";
      const title = item.snippet?.title?.trim() || "";
      if (!videoId || !title) return [];
      return [
        {
          id: videoId,
          video_id: videoId,
          title,
          description:
            item.snippet?.description?.trim() ||
            "A YouTube lesson matched to your next learning step.",
          thumbnail_url:
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            null,
          channel_title: item.snippet?.channelTitle?.trim() || null,
          watch_url: `https://www.youtube.com/watch?v=${videoId}`,
          source: "youtube",
          reason: `Matches “${query}”`,
        },
      ];
    });
    const responseRecommendations =
      recommendations.length > 0
        ? recommendations
        : fallbackRecommendations(query, limit);
    const responseMode =
      recommendations.length > 0 ? "youtube" : "youtube_search";

    const { error: cacheWriteError } = await adminClient
      .from("video_recommendation_cache")
      .upsert({
        cache_key: cacheKey,
        query_text: query,
        recommendations: responseRecommendations,
        mode: responseMode,
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        updated_at: new Date().toISOString(),
      });
    if (cacheWriteError) {
      console.error(
        "Video recommendation cache write failed:",
        cacheWriteError,
      );
    }

    return new Response(
      JSON.stringify({
        recommendations: responseRecommendations,
        mode: responseMode,
        cached: false,
      }),
      { status: 200, headers },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Video recommendations could not be loaded";
    return new Response(JSON.stringify({ error: message }), {
      status:
        message === "Unauthorized"
          ? 401
          : message === "Forbidden"
            ? 403
            : message === "Rate limit exceeded"
              ? 429
              : 400,
      headers,
    });
  }
});
