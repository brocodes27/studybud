import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Youtube,
} from "lucide-react";
import {
  buildVideoRecommendationQuery,
  type VideoRecommendation,
} from "../lib/videoRecommendations";
import {
  loadVideoRecommendations,
  type QueueItem,
  trackLearningEvent,
} from "./data";

function RecommendationCard({
  item,
  subject,
  userId,
}: {
  item: VideoRecommendation;
  subject: string;
  userId?: string;
}) {
  return (
    <a
      href={item.watchUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        void trackLearningEvent("student_video_recommendation_opened", userId, {
          recommendation_id: item.id,
          source: item.source,
          subject,
        });
      }}
      className="group overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-video overflow-hidden bg-[var(--neo-ink)]">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-red-600 to-stone-950">
            <Youtube className="h-11 w-11 text-white" />
          </div>
        )}
        <span className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-full bg-white text-stone-950 shadow-lg">
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        </span>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 text-base font-semibold leading-5 text-[var(--neo-ink)]">
          {item.title}
        </p>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--neo-muted)]">
          {item.description}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.12em] text-[var(--neo-accent)]">
            {item.channelTitle || item.reason}
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-stone-400 transition group-hover:text-stone-900" />
        </div>
      </div>
    </a>
  );
}

export function StudentVideoRecommendations({
  nextItem,
  userId,
}: {
  nextItem?: QueueItem;
  userId?: string;
}) {
  const query = useMemo(
    () => buildVideoRecommendationQuery(nextItem),
    [nextItem],
  );
  const [recommendations, setRecommendations] = useState<VideoRecommendation[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    loadVideoRecommendations(
      query,
      nextItem?.id || "student-today",
      attempt > 0,
    )
      .then((result) => {
        if (cancelled) return;
        setRecommendations(result);
        if (!result.length) {
          setError("No useful video matches were found for this topic yet.");
        }
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setRecommendations([]);
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Video recommendations could not be loaded.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, nextItem?.id, query]);

  return (
    <section className="mt-8" aria-labelledby="recommended-videos-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">
            <Sparkles className="h-4 w-4" />
            Chosen for your next step
          </div>
          <h2
            id="recommended-videos-title"
            className="mt-2 text-2xl font-semibold sm:text-3xl"
          >
            Watch it another way
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--neo-muted)]">
            Topic-matched YouTube lessons for{" "}
            <span className="font-bold text-[var(--neo-ink)]">
              {nextItem?.topic || nextItem?.title || "better study habits"}
            </span>
            . Videos open on YouTube in a new tab.
          </p>
        </div>
        {!loading && (
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm hover:text-stone-950"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-5 grid min-h-44 place-items-center rounded-[28px] border border-stone-200 bg-white">
          <div className="text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[var(--neo-accent)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--neo-muted)]">
              Finding clear explanations for this topic…
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-[28px] border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold text-amber-950">
              Recommendations are taking a break
            </p>
            <p className="mt-1 text-sm text-amber-900/70">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-amber-950 shadow-sm"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((item) => (
            <RecommendationCard
              key={item.id}
              item={item}
              subject={nextItem?.subject || "Study skills"}
              userId={userId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
