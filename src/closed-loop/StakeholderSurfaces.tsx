/* Stakeholder aggregates combine several evolving Supabase JSONB record shapes. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  GraduationCap,
  HeartHandshake,
  Lightbulb,
  Loader2,
  Plus,
  School,
  Target,
  Users,
  Building2,
  CalendarRange,
  BookMarked,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  createAcademicYear,
  createGradeSection,
  createSubject,
  createTeachingAssignment,
  importSchoolInvitations,
  linkTeacherToSchool,
  loadChainOverview,
  loadParentDigest,
  loadPrincipalOutcomes,
  loadSchoolSetup,
  adminInviteSchoolAdmin,
} from "./data";
import { PageHeader } from "./ClosedLoopShell";
import { calculateMasteryPerMinute, summarizeVerifiedMastery } from "./metrics";

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--neo-accent)]" />
        <p className="mt-3 text-sm font-bold text-[var(--neo-muted)]">
          {label}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mt-8 rounded-[32px] border-2 border-dashed border-stone-200 bg-white p-10 text-center">
      <Users className="mx-auto h-10 w-10 text-stone-300" />
      <h2 className="mt-4 text-2xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--neo-muted)]">
        {detail}
      </p>
    </div>
  );
}

export function ParentDailyDigest() {
  const { user } = useAuth();
  const [digests, setDigests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    loadParentDigest(user.id)
      .then(setDigests)
      .catch((nextError: any) =>
        setError(nextError?.message || "The daily digest could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <LoadingScreen label="Writing today’s family digest…" />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="For families"
        title="Today, in plain language."
        description="What your child worked on, what moved forward, and one useful conversation to have — without another dashboard to decode."
      />
      {error && (
        <div className="mt-5 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {!digests.length ? (
        <EmptyState
          title="No child is linked yet"
          detail="Ask the school administrator to link your parent account. Daily learning summaries will appear here automatically."
        />
      ) : (
        <div className="mt-8 space-y-6">
          {digests.map((digest) => {
            const name = digest.profile?.full_name || "Your child";
            const done = digest.completed.length;
            const total = digest.taskRows.length;
            return (
              <article
                key={digest.id}
                className="overflow-hidden rounded-[34px] border border-stone-200 bg-white shadow-sm"
              >
                <div className="bg-[var(--neo-ink)] p-6 text-white sm:p-8">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">
                    {new Date().toLocaleDateString([], {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-semibold text-white">
                        {name}
                      </h2>
                      <p className="mt-2 text-sm text-white/65">
                        {total
                          ? `${done} of ${total} focused tasks completed today`
                          : "No prescribed work was scheduled today"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-semibold text-white">
                        {total ? Math.round((done / total) * 100) : 0}%
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-wider text-white/45">
                        day complete
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-8">
                  <div className="rounded-2xl bg-emerald-50 p-5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800/60">
                      Moved forward
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-emerald-950">
                      {digest.strongest?.topic
                        ? `${digest.strongest.subject || "Learning"}: ${digest.strongest.topic}`
                        : done
                          ? digest.completed[0]?.title ||
                            digest.completed[0]?.topic ||
                            "Completed today’s focused work"
                          : "Progress will appear after the first completed task"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-5">
                    <Target className="h-5 w-5 text-amber-700" />
                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800/60">
                      Still developing
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-amber-950">
                      {digest.weakest?.topic
                        ? `${digest.weakest.subject || "Concept"}: ${digest.weakest.topic}`
                        : digest.support
                          ? String(
                              digest.support.trigger_type || "Targeted support",
                            ).replaceAll("_", " ")
                          : "No urgent learning gap is currently flagged"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-violet-50 p-5">
                    <Lightbulb className="h-5 w-5 text-violet-700" />
                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-violet-800/60">
                      Ask at dinner
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-violet-950">
                      “What was one mistake that helped you understand something
                      better today?”
                    </p>
                  </div>
                </div>
                {digest.latestTest && (
                  <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 px-5 py-4 sm:mx-8 sm:mb-8">
                    <div className="flex items-center gap-3">
                      <BookOpenCheck className="h-5 w-5 text-[var(--neo-accent)]" />
                      <div>
                        <p className="text-sm font-bold">
                          {digest.latestTest.test_name}
                        </p>
                        <p className="text-xs text-[var(--neo-muted)]">
                          Most recent assessment
                        </p>
                      </div>
                    </div>
                    <p className="text-xl font-semibold">
                      {digest.latestTest.score_obtained ?? 0}/
                      {digest.latestTest.score_total ?? 100}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function summarizeOutcomes(data: any) {
  if (!data) return null;
  const confidences = data.knowledge
    .map((row: any) => Number(row.confidence))
    .filter((value: number) => Number.isFinite(value));
  const mastery = confidences.length
    ? Math.round(
        (confidences.reduce((sum: number, value: number) => sum + value, 0) /
          confidences.length) *
          100,
      )
    : 0;
  const activeInterventions = data.interventions.filter(
    (row: any) => row.status === "active",
  );
  const tasks = data.prescriptions.flatMap((row: any) =>
    Array.isArray(row.tasks) ? row.tasks : [],
  );
  const completed = tasks.filter((task: any) => task.completed).length;
  const measuredSessions = data.learningSessions.filter(
    (row: any) => row.mastery_delta != null && Number(row.duration_seconds) > 0,
  );
  const verifiedMastery = summarizeVerifiedMastery(data.learningSessions);
  return {
    estimatedMastery: mastery,
    verifiedMastery,
    activeInterventions,
    highRisk: activeInterventions.filter((row: any) =>
      ["high", "critical"].includes(row.severity),
    ).length,
    completion: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    masteryPerMinute: calculateMasteryPerMinute(measuredSessions),
    measuredSessions: measuredSessions.length,
  };
}

function mergeOutcomes(
  parts: Array<{ schoolId: string; schoolName: string; data: any }>,
) {
  const merged = {
    students: 0,
    teachers: 0,
    sections: [] as any[],
    classes: [] as any[],
    knowledge: [] as any[],
    interventions: [] as any[],
    prescriptions: [] as any[],
    learningSessions: [] as any[],
    campuses: [] as Array<{
      schoolId: string;
      schoolName: string;
      data: any;
      metrics: ReturnType<typeof summarizeOutcomes>;
    }>,
  };
  for (const part of parts) {
    merged.students += part.data.students || 0;
    merged.teachers += part.data.teachers || 0;
    merged.sections.push(
      ...(part.data.sections || []).map((row: any) => ({
        ...row,
        __schoolName: part.schoolName,
      })),
    );
    merged.classes.push(
      ...(part.data.classes || []).map((row: any) => ({
        ...row,
        __schoolName: part.schoolName,
      })),
    );
    merged.knowledge.push(...(part.data.knowledge || []));
    merged.interventions.push(...(part.data.interventions || []));
    merged.prescriptions.push(...(part.data.prescriptions || []));
    merged.learningSessions.push(...(part.data.learningSessions || []));
    merged.campuses.push({
      schoolId: part.schoolId,
      schoolName: part.schoolName,
      data: part.data,
      metrics: summarizeOutcomes(part.data),
    });
  }
  return merged;
}

export function PrincipalOutcomes() {
  const { schoolId, setActiveSchoolId, isChainAdmin, accessibleSchools } =
    useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialScope =
    searchParams.get("scope") === "campus" ? "campus" : "all";
  const [scope, setScope] = useState<"all" | "campus">(
    isChainAdmin ? initialScope : "campus",
  );
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // School admins / principals never get the chain-wide toggle.
  const canViewAllCampuses = isChainAdmin && accessibleSchools.length > 1;
  const effectiveScope = canViewAllCampuses ? scope : "campus";

  const updateScope = (next: "all" | "campus") => {
    setScope(next);
    const params = new URLSearchParams(searchParams);
    if (next === "campus") params.set("scope", "campus");
    else params.delete("scope");
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        if (effectiveScope === "all" && canViewAllCampuses) {
          const parts = await Promise.all(
            accessibleSchools.map(async (school) => {
              const outcomes = await loadPrincipalOutcomes(school.id);
              return {
                schoolId: school.id,
                schoolName: school.name,
                data: outcomes,
              };
            }),
          );
          if (!cancelled) setData(mergeOutcomes(parts));
        } else if (schoolId) {
          const outcomes = await loadPrincipalOutcomes(schoolId);
          if (!cancelled) {
            setData({
              ...outcomes,
              campuses: [
                {
                  schoolId,
                  schoolName:
                    accessibleSchools.find((school) => school.id === schoolId)
                      ?.name || "Campus",
                  data: outcomes,
                  metrics: summarizeOutcomes(outcomes),
                },
              ],
            });
          }
        } else {
          if (!cancelled) setData(null);
        }
      } catch (nextError: any) {
        if (!cancelled)
          setError(
            nextError?.message || "School outcomes could not be loaded.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accessibleSchools, canViewAllCampuses, effectiveScope, schoolId]);

  const metrics = useMemo(() => summarizeOutcomes(data), [data]);
  const activeSchoolName =
    accessibleSchools.find((school) => school.id === schoolId)?.name ||
    "This campus";

  if (loading) return <LoadingScreen label="Aggregating mastery movement…" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow={
          effectiveScope === "all" ? "Chain outcomes" : "School outcomes"
        }
        title="Academic movement, not app activity."
        description={
          effectiveScope === "all"
            ? "See mastery, completion, and risk across every campus in your chain — then open one school when you need a decision."
            : "Drill from school-wide mastery to the classes and concepts where a human decision can change the outcome."
        }
        actions={
          canViewAllCampuses ? (
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="inline-flex rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => updateScope("all")}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wide ${
                    effectiveScope === "all"
                      ? "bg-[var(--neo-ink)] text-white"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  All campuses
                </button>
                <button
                  type="button"
                  onClick={() => updateScope("campus")}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wide ${
                    effectiveScope === "campus"
                      ? "bg-[var(--neo-ink)] text-white"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  One campus
                </button>
              </div>
              {effectiveScope === "campus" && (
                <select
                  className="neo-input min-w-[220px] text-xs"
                  value={schoolId || ""}
                  onChange={async (event) => {
                    try {
                      await setActiveSchoolId(event.target.value || null);
                    } catch (nextError: any) {
                      setError(
                        nextError?.message || "Could not switch campuses.",
                      );
                    }
                  }}
                >
                  {accessibleSchools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : undefined
        }
      />
      {!schoolId && effectiveScope === "campus" ? (
        <EmptyState
          title="No school linked"
          detail="This outcomes view is available to principals and school administrators with an active school membership."
        />
      ) : error && !data ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : data && metrics ? (
        <>
          {effectiveScope === "campus" && (
            <p className="mt-5 text-sm font-semibold text-[var(--neo-muted)]">
              Showing {activeSchoolName}
            </p>
          )}
          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              {
                label:
                  effectiveScope === "all"
                    ? "Students across chain"
                    : "Students supported",
                value: data.students,
                icon: GraduationCap,
                detail: `${data.teachers} teachers${effectiveScope === "all" ? ` · ${data.campuses?.length || 0} campuses` : ""}`,
              },
              {
                label: "Estimated mastery",
                value: `${metrics.estimatedMastery}%`,
                icon: BarChart3,
                detail:
                  "Model estimate across tracked concepts — not a verified academic outcome",
              },
              {
                label: "Verified mastery",
                value:
                  metrics.verifiedMastery.score == null
                    ? "—"
                    : `${metrics.verifiedMastery.score}%`,
                icon: CheckCircle2,
                detail: metrics.verifiedMastery.evidenceCount
                  ? `${metrics.verifiedMastery.improvedCount} improved · ${metrics.verifiedMastery.evidenceCount} comparable checks`
                  : "Appears after comparable evidence meets the quality threshold",
              },
              {
                label: "Mastery / minute",
                value:
                  metrics.masteryPerMinute == null
                    ? "—"
                    : `${metrics.masteryPerMinute >= 0 ? "+" : ""}${metrics.masteryPerMinute.toFixed(2)}`,
                icon: Target,
                detail: metrics.measuredSessions
                  ? `Percentage points per student-minute · ${metrics.measuredSessions} measured sessions`
                  : "Appears after two comparable evidence checks",
              },
              {
                label: "Today complete",
                value: `${metrics.completion}%`,
                icon: CheckCircle2,
                detail: "Prescribed learning tasks closed",
              },
              {
                label: "Needs action",
                value: metrics.highRisk,
                icon: CircleAlert,
                detail: `${metrics.activeInterventions.length} total open supports`,
              },
            ].map(({ label, value, icon: Icon, detail }) => (
              <div
                key={label}
                className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm"
              >
                <Icon className="h-5 w-5 text-[var(--neo-accent)]" />
                <p className="mt-4 text-3xl font-semibold">{value}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.13em] text-stone-500">
                  {label}
                </p>
                <p className="mt-2 text-xs text-[var(--neo-muted)]">{detail}</p>
              </div>
            ))}
          </div>

          {effectiveScope === "all" && (
            <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">
                    Campus breakdown
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    Every school in the chain
                  </h2>
                </div>
                <Building2 className="h-5 w-5 text-stone-300" />
              </div>
              <div className="mt-5 grid gap-3">
                {(data.campuses || []).map((campus: any) => (
                  <div
                    key={campus.schoolId}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--neo-surface)] p-4"
                  >
                    <div>
                      <p className="font-bold">{campus.schoolName}</p>
                      <p className="mt-1 text-xs text-[var(--neo-muted)]">
                        {campus.data.students} students ·{" "}
                        {campus.metrics?.estimatedMastery ?? 0}% estimated
                        mastery · {campus.metrics?.highRisk ?? 0} high-risk
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await setActiveSchoolId(campus.schoolId);
                          updateScope("campus");
                        } catch (nextError: any) {
                          setError(
                            nextError?.message || "Could not switch campuses.",
                          );
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--neo-ink)] px-4 py-2.5 text-[10px] font-black uppercase tracking-wide text-white"
                    >
                      View campus <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">
                    Class movement
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    Where to look next
                  </h2>
                </div>
                <ArrowUpRight className="h-5 w-5 text-stone-300" />
              </div>
              <div className="mt-5 space-y-3">
                {data.classes.map((classroom: any) => {
                  const classRisks = metrics.activeInterventions.filter(
                    (row: any) => row.class_id === classroom.id,
                  );
                  return (
                    <div
                      key={`${classroom.__schoolName || ""}-${classroom.id}`}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--neo-surface)] p-4"
                    >
                      <div>
                        <p className="font-bold">{classroom.name}</p>
                        <p className="mt-1 text-xs text-[var(--neo-muted)]">
                          {classroom.__schoolName
                            ? `${classroom.__schoolName} · `
                            : ""}
                          {classroom.subject || "General curriculum"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${
                          classRisks.length
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {classRisks.length
                          ? `${classRisks.length} open`
                          : "On track"}
                      </span>
                    </div>
                  );
                })}
                {!data.classes.length && (
                  <p className="text-sm text-[var(--neo-muted)]">
                    No classes are linked to active teachers yet.
                  </p>
                )}
              </div>
            </section>
            <section className="rounded-[28px] bg-[var(--neo-ink)] p-6 text-white shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                Leadership alert
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {metrics.highRisk
                  ? `${metrics.highRisk} students need a same-day response.`
                  : "No high-risk divergence today."}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Alerts are based on unresolved learning supports and concept
                confidence, not time spent in the app.
              </p>
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="text-4xl font-semibold text-white">
                  {data.sections.length}
                </p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-white/45">
                  {effectiveScope === "all"
                    ? "configured grade sections across chain"
                    : "configured grade sections"}
                </p>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ChainOverview() {
  const navigate = useNavigate();
  const { chainIds, setActiveSchoolId, schoolId, isAdmin, accessibleSchools } =
    useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSchoolId, setInviteSchoolId] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const openCampus = async (campusId: string) => {
    try {
      await setActiveSchoolId(campusId);
      navigate("/principal?scope=campus");
    } catch (nextError: any) {
      setError(nextError?.message || "Could not switch campuses.");
    }
  };

  const effectiveChainIds = useMemo(() => {
    if (chainIds.length) return chainIds;
    return Array.from(
      new Set(
        accessibleSchools
          .map((school) => school.chain_id)
          .filter(Boolean) as string[],
      ),
    );
  }, [chainIds, accessibleSchools]);

  const load = useCallback(() => {
    if (!effectiveChainIds.length && !isAdmin) {
      setLoading(false);
      setData({ chains: [], campuses: [] });
      return;
    }
    setLoading(true);
    loadChainOverview(effectiveChainIds, {
      allChains: isAdmin && !effectiveChainIds.length,
    })
      .then((result) => {
        setData(result);
        setInviteSchoolId((prev) => prev || result.campuses[0]?.id || "");
      })
      .catch((nextError: any) =>
        setError(nextError?.message || "Chain overview could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, [effectiveChainIds, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const inviteSchoolAdmin = async (event: FormEvent) => {
    event.preventDefault();
    if (!inviteSchoolId || !inviteEmail.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await adminInviteSchoolAdmin(
        inviteSchoolId,
        inviteEmail.trim(),
      );
      const provisionedEmail = inviteEmail.trim().toLowerCase();
      setInviteEmail("");
      setNotice(
        result?.status === "existing_account"
          ? `Principal access is ready for ${provisionedEmail}. They can use secure email sign-in.`
          : `Principal access was created for ${provisionedEmail}, and a secure invitation was sent.`,
      );
    } catch (nextError: any) {
      setError(nextError?.message || "Could not provision the principal.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Loading chain campuses…" />;

  const campuses = data?.campuses || [];
  const totalStudents = campuses.reduce(
    (sum: number, campus: any) => sum + (campus.outcomes?.students || 0),
    0,
  );
  const totalTeachers = campuses.reduce(
    (sum: number, campus: any) => sum + (campus.outcomes?.teachers || 0),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Chain head"
        title={data?.chains?.[0]?.name || "Your school chain"}
        description="See every campus under your network, provision each principal, and jump into campus outcomes or setup."
      />
      {(notice || error) && (
        <div
          className={`mt-6 rounded-2xl border p-4 text-sm font-semibold ${
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || notice}
        </div>
      )}
      {!campuses.length ? (
        <EmptyState
          title="No campuses in your chain yet"
          detail="Ask a platform admin to attach schools to your chain. Once campuses exist, outcomes and setup appear here."
        />
      ) : (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--neo-muted)]">
                Campuses
              </p>
              <p className="mt-2 text-4xl font-semibold">{campuses.length}</p>
            </div>
            <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--neo-muted)]">
                Students
              </p>
              <p className="mt-2 text-4xl font-semibold">{totalStudents}</p>
            </div>
            <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--neo-muted)]">
                Teachers
              </p>
              <p className="mt-2 text-4xl font-semibold">{totalTeachers}</p>
            </div>
          </div>

          <form
            onSubmit={inviteSchoolAdmin}
            className="mt-6 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--neo-surface)] text-[var(--neo-accent)]">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">Provision a principal</h2>
                <p className="text-xs text-[var(--neo-muted)]">
                  Choose the campus and email. Elevenfolks creates the access
                  and sends a secure invitation.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.2fr_auto]">
              <select
                className="neo-input"
                value={inviteSchoolId}
                onChange={(event) => setInviteSchoolId(event.target.value)}
                required
              >
                <option value="">Campus</option>
                {campuses.map((campus: any) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
              <input
                className="neo-input"
                type="email"
                placeholder="principal@school.org"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--neo-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Provision"
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 grid gap-4">
            {campuses.map((campus: any) => {
              const active = campus.id === schoolId;
              return (
                <article
                  key={campus.id}
                  className={`rounded-[28px] border bg-white p-6 shadow-sm ${
                    active ? "border-[var(--neo-ink)]" : "border-stone-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--neo-muted)]">
                        {campus.entitlement?.plan || "no plan"} ·{" "}
                        {campus.code || "no code"}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold">
                        {campus.name}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--neo-muted)]">
                        {campus.outcomes?.students || 0} students ·{" "}
                        {campus.outcomes?.teachers || 0} teachers ·{" "}
                        {campus.outcomes?.sections?.length || 0} sections
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openCampus(campus.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--neo-ink)] px-4 py-3 text-xs font-black text-white"
                      >
                        Open campus <ArrowUpRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await setActiveSchoolId(campus.id);
                            navigate("/school-setup");
                          } catch (nextError: any) {
                            setError(
                              nextError?.message ||
                                "Could not switch campuses.",
                            );
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-black text-[var(--neo-ink)]"
                      >
                        Setup
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function SchoolSetup() {
  const { schoolId, isChainAdmin, isAdmin } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importText, setImportText] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    if (!schoolId) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    loadSchoolSetup(schoolId)
      .then(setData)
      .catch((nextError: any) =>
        setError(nextError?.message || "School setup could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const runSave = async (action: () => Promise<void>, success: string) => {
    setSaving(true);
    setError("");
    try {
      await action();
      setNotice(success);
      await load();
    } catch (nextError: any) {
      setError(nextError?.message || "Could not save school setup changes.");
    } finally {
      setSaving(false);
    }
  };

  const importPeople = async (event: FormEvent) => {
    event.preventDefault();
    if (!schoolId) return;
    setSaving(true);
    setError("");
    try {
      const count = await importSchoolInvitations(schoolId, importText);
      setImportText("");
      setNotice(`${count} invitation${count === 1 ? "" : "s"} ready.`);
      await load();
    } catch (nextError: any) {
      setError(nextError?.message || "Could not save school setup changes.");
    } finally {
      setSaving(false);
    }
  };

  const addTeacher = async (event: FormEvent) => {
    event.preventDefault();
    if (!schoolId || !teacherEmail.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await linkTeacherToSchool(schoolId, teacherEmail.trim());
      setTeacherEmail("");
      setNotice(
        result.status === "linked"
          ? `${result.email} is now on this campus roster.`
          : `Invite prepared for ${result.email}. They appear here after signing up with that email.`,
      );
      await load();
    } catch (nextError: any) {
      setError(nextError?.message || "Could not add teacher.");
    } finally {
      setSaving(false);
    }
  };

  const assignTeacher = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await runSave(async () => {
      await createTeachingAssignment({
        teacherId: String(form.get("teacherId") || ""),
        sectionId: String(form.get("sectionId") || ""),
        subjectId: String(form.get("subjectId") || ""),
        academicYearId: String(form.get("academicYearId") || ""),
      });
      formEl.reset();
    }, "Teaching responsibility assigned.");
  };

  const addYear = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!schoolId) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await runSave(async () => {
      await createAcademicYear({
        schoolId,
        name: String(form.get("name") || ""),
        startDate: String(form.get("startDate") || ""),
        endDate: String(form.get("endDate") || ""),
        isActive: form.get("isActive") === "on",
      });
      formEl.reset();
    }, "Academic year added.");
  };

  const addSection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!schoolId) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await runSave(async () => {
      await createGradeSection({
        schoolId,
        grade: String(form.get("grade") || ""),
        section: String(form.get("section") || ""),
      });
      formEl.reset();
    }, "Grade section added.");
  };

  const addSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!schoolId) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await runSave(async () => {
      await createSubject({
        schoolId,
        name: String(form.get("name") || ""),
      });
      formEl.reset();
    }, "Subject added.");
  };

  if (loading) return <LoadingScreen label="Loading school structure…" />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="School setup"
        title={data?.school?.name || "Connect your school structure."}
        description="Create academic years, grade sections, and subjects, then invite teachers and students."
      />
      {!schoolId ? (
        <EmptyState
          title="No school linked"
          detail={
            isChainAdmin || isAdmin
              ? "Pick an active campus from the sidebar, or ask platform admin to attach campuses to your chain."
              : "Ask your chain head or platform admin to provision you as principal for this school. Then use school sign-in with that email."
          }
        />
      ) : error && !data ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : data ? (
        <>
          {(notice || error) && (
            <div
              className={`mt-6 rounded-2xl border p-4 text-sm font-semibold ${
                error
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {error || notice}
            </div>
          )}

          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            <form
              onSubmit={addYear}
              className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <CalendarRange className="h-5 w-5 text-[var(--neo-accent)]" />
                <h2 className="text-lg font-semibold">Add academic year</h2>
              </div>
              <input
                name="name"
                required
                placeholder="2026-27"
                className="neo-input mt-4 w-full"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  name="startDate"
                  type="date"
                  required
                  className="neo-input"
                />
                <input
                  name="endDate"
                  type="date"
                  required
                  className="neo-input"
                />
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[var(--neo-muted)]">
                <input name="isActive" type="checkbox" /> Active year
              </label>
              <button
                type="submit"
                disabled={saving}
                className="mt-3 w-full rounded-xl bg-[var(--neo-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"
              >
                Save year
              </button>
            </form>

            <form
              onSubmit={addSection}
              className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-[var(--neo-accent)]" />
                <h2 className="text-lg font-semibold">Add grade section</h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <input
                  name="grade"
                  required
                  placeholder="10"
                  className="neo-input"
                />
                <input
                  name="section"
                  required
                  placeholder="A"
                  className="neo-input"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-3 w-full rounded-xl bg-[var(--neo-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"
              >
                Save section
              </button>
            </form>

            <form
              onSubmit={addSubject}
              className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <BookMarked className="h-5 w-5 text-[var(--neo-accent)]" />
                <h2 className="text-lg font-semibold">Add subject</h2>
              </div>
              <input
                name="name"
                required
                placeholder="Mathematics"
                className="neo-input mt-4 w-full"
              />
              <button
                type="submit"
                disabled={saving}
                className="mt-3 w-full rounded-xl bg-[var(--neo-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"
              >
                Save subject
              </button>
            </form>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <form
              onSubmit={addTeacher}
              className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--neo-surface)] text-[var(--neo-accent)]">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold">
                    Add teacher to this campus
                  </h2>
                  <p className="text-xs text-[var(--neo-muted)]">
                    Links an existing account instantly, or invites by email.
                    School code:{" "}
                    <span className="font-bold text-[var(--neo-ink)]">
                      {data.school?.code || "not set"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  required
                  value={teacherEmail}
                  onChange={(event) => setTeacherEmail(event.target.value)}
                  className="neo-input w-full"
                  placeholder="teacher@school.org"
                />
                <button
                  type="submit"
                  disabled={saving || !teacherEmail.trim()}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--neo-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add teacher
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--neo-muted)]">
                  On roster ({data.teachers.length})
                </p>
                {data.teachers.length ? (
                  data.teachers.slice(0, 8).map((teacher: any) => (
                    <p
                      key={teacher.id}
                      className="rounded-xl bg-[var(--neo-surface)] px-3 py-2 text-sm font-semibold"
                    >
                      {teacher.full_name || "Teacher"} · {teacher.email}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-[var(--neo-muted)]">
                    No teachers linked yet. Add their email above, or have them
                    sign up as Teacher with school code{" "}
                    <span className="font-bold">
                      {data.school?.code || "—"}
                    </span>
                    .
                  </p>
                )}
                {(data.pendingTeacherInvites || []).length > 0 && (
                  <div className="pt-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700/80">
                      Pending invites ({data.pendingTeacherInvites.length})
                    </p>
                    {data.pendingTeacherInvites
                      .slice(0, 6)
                      .map((invite: any) => (
                        <p
                          key={invite.id}
                          className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
                        >
                          {invite.email} · waiting to sign up
                        </p>
                      ))}
                  </div>
                )}
              </div>
            </form>

            <form
              onSubmit={importPeople}
              className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--neo-surface)] text-[var(--neo-accent)]">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold">Bulk import people</h2>
                  <p className="text-xs text-[var(--neo-muted)]">
                    One line per person: email, role
                  </p>
                </div>
              </div>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                className="neo-input mt-5 min-h-32 w-full font-mono text-xs"
                placeholder={
                  "student@school.org,student\nteacher@school.org,teacher"
                }
              />
              <button
                type="submit"
                disabled={saving || !importText.trim()}
                className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--neo-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Prepare invitations
              </button>
            </form>
          </div>

          <form
            onSubmit={assignTeacher}
            className="mt-5 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--neo-surface)] text-[var(--neo-accent)]">
                <HeartHandshake className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">
                  Assign teaching responsibility
                </h2>
                <p className="text-xs text-[var(--neo-muted)]">
                  Teacher · section · subject · year
                </p>
              </div>
            </div>
            {!data.teachers.length && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Add at least one teacher to this campus first. Until then the
                teacher dropdown stays empty.
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <select
                name="teacherId"
                required
                className="neo-input"
                disabled={!data.teachers.length}
              >
                <option value="">
                  {data.teachers.length ? "Teacher" : "No teachers on roster"}
                </option>
                {data.teachers.map((row: any) => (
                  <option key={row.id} value={row.id}>
                    {row.full_name || row.email}
                  </option>
                ))}
              </select>
              <select name="sectionId" required className="neo-input">
                <option value="">Section</option>
                {data.sections.map((row: any) => (
                  <option key={row.id} value={row.id}>
                    Grade {row.grade} · {row.section}
                  </option>
                ))}
              </select>
              <select name="subjectId" required className="neo-input">
                <option value="">Subject</option>
                {data.subjects.map((row: any) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              <select name="academicYearId" required className="neo-input">
                <option value="">Academic year</option>
                {data.years.map((row: any) => (
                  <option key={row.id} value={row.id}>
                    {row.name || row.start_date}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving || !data.teachers.length}
              className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--neo-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Assign teacher
            </button>
          </form>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {[
              {
                title: "Academic years",
                count: data.years.length,
                icon: School,
                rows: data.years.map(
                  (row: any) =>
                    row.name || `${row.start_date} – ${row.end_date}`,
                ),
              },
              {
                title: "Grade sections",
                count: data.sections.length,
                icon: Users,
                rows: data.sections.map(
                  (row: any) => `Grade ${row.grade} · ${row.section}`,
                ),
              },
              {
                title: "Subjects",
                count: data.subjects.length,
                icon: BookOpenCheck,
                rows: data.subjects.map((row: any) => row.name),
              },
              {
                title: "Teaching assignments",
                count: data.teachingAssignments.length,
                icon: HeartHandshake,
                rows: data.teachingAssignments.map(
                  (row: any) =>
                    `${row.user_profiles?.full_name || row.user_profiles?.email || "Teacher"} · ${row.subjects?.name || "Subject"} · Grade ${row.grade_sections?.grade || "—"} ${row.grade_sections?.section || ""}`,
                ),
              },
            ].map(({ title, count, icon: Icon, rows }) => (
              <section
                key={title}
                className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-[var(--neo-muted)]">
                      {title}
                    </p>
                    <p className="mt-2 text-4xl font-semibold">{count}</p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--neo-surface)] text-[var(--neo-accent)]">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-5 space-y-2">
                  {rows.slice(0, 6).map((row: string, index: number) => (
                    <p
                      key={`${row}-${index}`}
                      className="rounded-xl bg-[var(--neo-surface)] px-3 py-2.5 text-sm font-semibold"
                    >
                      {row}
                    </p>
                  ))}
                  {!rows.length && (
                    <p className="text-sm text-[var(--neo-muted)]">
                      Not configured yet.
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
