import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { loadStudentQueue, QueueItem, trackLearningEvent } from "./data";
import { PageHeader } from "./ClosedLoopShell";
import { StudentVideoRecommendations } from "./StudentVideoRecommendations";

const kindCopy = {
  homework: {
    label: "Teacher assigned",
    icon: BookOpenCheck,
    tone: "bg-stone-900 text-white",
  },
  repair: {
    label: "Close a gap",
    icon: Brain,
    tone: "bg-amber-100 text-amber-900",
  },
  stretch: {
    label: "Stretch",
    icon: Sparkles,
    tone: "bg-violet-100 text-violet-900",
  },
};

function QueueCard({
  item,
  index,
  onStart,
}: {
  item: QueueItem;
  index: number;
  onStart: () => void;
}) {
  const config = kindCopy[item.kind];
  const Icon = config.icon;
  return (
    <article
      className={`group rounded-[28px] border border-stone-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-6 ${
        index === 0 ? "ring-2 ring-[var(--neo-accent)]/20" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${config.tone}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--neo-muted)]">
              {config.label}
            </span>
            {index === 0 && (
              <span className="rounded-full bg-[var(--neo-accent)]/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--neo-accent)]">
                Next
              </span>
            )}
          </div>
          <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
            {item.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--neo-muted)]">
            {item.draftQuestions && item.draftQuestions.length > 0
              ? `${item.draftQuestions.length} questions · ${item.topic || item.subject}`
              : item.description}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold text-stone-500">
            <span>{item.subject}</span>
            <span className="h-1 w-1 rounded-full bg-stone-300" />
            <span className="flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {item.minutes} min
            </span>
            {item.dueAt && (
              <>
                <span className="h-1 w-1 rounded-full bg-stone-300" />
                <span>
                  Due{" "}
                  {new Date(item.dueAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--neo-ink)] px-5 py-3.5 text-sm font-black text-white shadow-md shadow-stone-900/10 hover:bg-stone-700 sm:w-auto"
      >
        Start with guidance
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>
    </article>
  );
}

export default function StudentToday() {
  const { user, fullName } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      setItems(await loadStudentQueue(user.id));
    } catch (nextError: unknown) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Your learning queue could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const pending = useMemo(
    () => items.filter((item) => !item.completed),
    [items],
  );
  const totalMinutes = pending.reduce((sum, item) => sum + item.minutes, 0);
  const nextTopic =
    pending[0]?.topic || pending[0]?.title || "today’s learning";

  const openAtlas = (message: string) => {
    void trackLearningEvent("student_atlas_opened", user?.id, {
      source: "student_dashboard",
      topic: nextTopic,
    });
    navigate("/atlas", { state: { initialMessage: message } });
  };

  const start = (item: QueueItem) => {
    sessionStorage.setItem("elevenfolks:guided-item", JSON.stringify(item));
    void trackLearningEvent("guided_session_started", user?.id, {
      source: item.kind,
      source_id: item.sourceId,
      subject: item.subject,
    });
    navigate("/session");
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Your learning day"
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}${fullName ? `, ${fullName.split(" ")[0]}` : ""}.`}
        description="One clear queue, ordered for learning impact: finish what your teacher assigned, repair what is shaky, then stretch."
        actions={
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-2xl font-semibold">{totalMinutes}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--neo-muted)]">
              focused minutes
            </p>
          </div>
        }
      />

      <section className="mt-8 overflow-hidden rounded-[30px] bg-[var(--neo-ink)] text-white shadow-xl shadow-stone-900/10">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
              <Brain className="h-4 w-4" />
              Atlas is back
            </div>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">
              Ask, practise, or untangle the next idea.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
              Atlas knows your current queue and can explain{" "}
              <span className="font-bold text-white">{nextTopic}</span>, quiz
              you, or turn it into a short study plan.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                `Explain ${nextTopic} with a simple example, then ask me to explain it back.`,
                `Quiz me on ${nextTopic}. Start easy and adapt to my answers.`,
                `Make me a focused 20-minute plan for ${nextTopic}.`,
              ].map((prompt, index) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => openAtlas(prompt)}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                >
                  {index === 0
                    ? "Explain it"
                    : index === 1
                      ? "Quiz me"
                      : "Plan 20 min"}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              openAtlas(
                `Help me start ${nextTopic}. First ask what I already understand.`,
              )
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[var(--neo-ink)] shadow-lg sm:w-fit"
          >
            Open Atlas
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {loading ? (
        <div className="grid min-h-[45vh] place-items-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--neo-accent)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--neo-muted)]">
              Ordering today by learning impact…
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">We could not build your queue</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-xl bg-white p-2"
            aria-label="Retry"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      ) : pending.length === 0 ? (
        <div className="mt-10 rounded-[32px] border border-emerald-200 bg-emerald-50 p-8 text-center sm:p-12">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="mt-5 text-3xl font-semibold">Today is complete.</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-emerald-900/70">
            You closed every assigned and prescribed task. Step away, rest, and
            let the learning settle.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            {pending.map((item, index) => (
              <QueueCard
                key={item.id}
                item={item}
                index={index}
                onStart={() => start(item)}
              />
            ))}
          </div>
          <aside className="h-fit rounded-[28px] bg-[var(--neo-ink)] p-6 text-white lg:sticky lg:top-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/50">
              Why this order?
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Less choosing. More learning.
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Teacher work comes first. Gap repair follows while the idea is
              fresh. Stretch work appears only when the foundation is ready.
            </p>
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-4xl font-semibold text-white">
                {pending.length}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-white/50">
                meaningful steps left
              </p>
            </div>
          </aside>
        </div>
      )}

      {!loading && !error && pending.length > 0 && (
        <StudentVideoRecommendations nextItem={pending[0]} userId={user?.id} />
      )}
    </div>
  );
}
