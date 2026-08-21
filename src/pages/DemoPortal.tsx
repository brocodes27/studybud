import { useMemo, useReducer, type Dispatch } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  Lightbulb,
  RefreshCw,
  School,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Users,
} from 'lucide-react';
import {
  completedDemoSteps,
  createDemoPortalState,
  demoPortalReducer,
  type DemoPortalAction,
  type DemoPortalState,
  type DemoRole,
} from '../lib/demoPortal';

type DemoDispatch = Dispatch<DemoPortalAction>;

const roles: Array<{
  id: DemoRole;
  label: string;
  detail: string;
  icon: typeof GraduationCap;
}> = [
  { id: 'teacher', label: 'Teacher', detail: 'Detect and act', icon: BookOpenCheck },
  { id: 'student', label: 'Student', detail: 'Practise and prove', icon: GraduationCap },
  { id: 'principal', label: 'Principal', detail: 'Inspect outcomes', icon: BarChart3 },
];

function DemoHeader({
  state,
  dispatch,
}: {
  state: DemoPortalState;
  dispatch: DemoDispatch;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[#faf8f5]/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-2xl bg-stone-950 text-white" aria-label="Back to Elevenfolks">
            <GraduationCap className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-extrabold">Elevenfolks</p>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-violet-800">Demo portal</span>
            </div>
            <p className="mt-0.5 text-[10px] font-bold text-stone-400">Greenfield Public School · Class 9 Mathematics</p>
          </div>
        </div>

        <nav className="order-3 flex w-full gap-1 rounded-2xl border border-stone-200 bg-white p-1 md:order-none md:w-auto" aria-label="Demo roles">
          {roles.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => dispatch({ type: 'switch_role', role: id })}
              aria-pressed={state.activeRole === id}
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition md:flex-none ${
                state.activeRole === id ? 'bg-stone-950 text-white shadow-sm' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => dispatch({ type: 'reset' })}
          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-extrabold text-stone-600 hover:border-stone-300 hover:text-stone-950"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>
    </header>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = 'bg-white',
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Clock3;
  tone?: string;
}) {
  return (
    <article className={`rounded-[24px] border border-stone-200/80 p-5 shadow-sm ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400">{label}</p>
        <Icon className="h-4 w-4 text-stone-400" />
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-stone-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-stone-500">{note}</p>
    </article>
  );
}

function TeacherView({
  state,
  dispatch,
}: {
  state: DemoPortalState;
  dispatch: DemoDispatch;
}) {
  const actionCount = state.evidenceReviewed ? 2 : state.repairAssigned ? 2 : 3;

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-700">Teacher command center</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">See the class. Choose the next action.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">Assignments, live completion, knowledge gaps, and targeted interventions in one operating view.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold text-stone-400">Class selected</p>
          <p className="mt-1 text-sm font-black">9-B · Mathematics</p>
        </div>
      </div>

      <section className="mt-8 overflow-hidden rounded-[28px] bg-stone-950 p-6 text-white shadow-xl shadow-stone-900/10 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Today’s decisions</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">{actionCount} learning actions and 1 review need you.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">Start with unresolved support, review only uncertain work, then monitor the rest without opening every submission.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">Teacher-time ROI</p>
            <p className="mt-2 text-3xl font-semibold text-white">42m</p>
            <p className="mt-1 text-xs text-white/45">returned this week</p>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Completion" value="82%" note="23 of 28 students on track" icon={CheckCircle2} />
        <MetricCard label="Weak signals" value={state.evidenceSubmitted ? '5' : '6'} note="Below 65% confidence" icon={Brain} />
        <MetricCard label="Human review" value="1" note="Only uncertain evidence" icon={ShieldCheck} />
        <MetricCard label="Verified movement" value={state.evidenceSubmitted ? '75%' : '71%'} note="Comparable before/after checks" icon={Target} tone="bg-emerald-50" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Ranked support queue</p>
              <h2 className="mt-2 text-2xl font-semibold">Where your judgment matters</h2>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase text-amber-800">High priority</span>
          </div>

          <article className={`mt-5 rounded-2xl border p-4 ${state.evidenceReviewed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${state.evidenceReviewed ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}`}>
                  {state.evidenceReviewed ? <CheckCircle2 className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-stone-950">Riya Sharma</p>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-black uppercase text-stone-500">Linear equations</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-stone-600">Repeated sign errors across two assignments · confidence {state.evidenceSubmitted ? '74%' : '48%'}</p>
                  <p className="mt-2 text-xs font-bold text-stone-500">
                    {state.evidenceReviewed
                      ? 'Evidence accepted. Support resolved.'
                      : state.evidenceSubmitted
                        ? 'Fresh evidence is ready for teacher confirmation.'
                        : state.repairAssigned
                          ? '12-minute targeted repair is in Riya’s queue.'
                          : 'Recommended: targeted guided repair before the next chapter.'}
                  </p>
                </div>
              </div>

              {!state.repairAssigned ? (
                <button type="button" onClick={() => dispatch({ type: 'assign_repair' })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white hover:bg-stone-800">
                  <Sparkles className="h-3.5 w-3.5" /> Assign repair
                </button>
              ) : !state.evidenceSubmitted ? (
                <button type="button" onClick={() => dispatch({ type: 'start_session' })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-600">
                  Continue as Riya <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : !state.evidenceReviewed ? (
                <button type="button" onClick={() => dispatch({ type: 'review_evidence' })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Accept evidence
                </button>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white"><Check className="h-3.5 w-3.5" /> Closed</span>
              )}
            </div>
          </article>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between"><p className="font-bold">Arjun Mehta</p><span className="text-[9px] font-black uppercase text-red-600">Attendance risk</span></div>
              <p className="mt-2 text-xs leading-5 text-stone-500">Missed two prescribed tasks this week.</p>
            </article>
            <article className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between"><p className="font-bold">Meera Nair</p><span className="text-[9px] font-black uppercase text-violet-700">Stretch ready</span></div>
              <p className="mt-2 text-xs leading-5 text-stone-500">Three verified checks above 85%.</p>
            </article>
          </div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">Only the exceptions</p>
          <h2 className="mt-2 text-2xl font-semibold">Review queue</h2>
          <p className="mt-2 text-sm text-stone-500">1 needs attention · 9 already evidence-checked</p>
          <article className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-black">Kabir Singh</p><p className="mt-1 text-xs text-stone-500">Reasoning is correct; uploaded working is unclear.</p></div>
              <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase text-violet-700">Review</span>
            </div>
            <button type="button" className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-violet-800">Open evidence <ChevronRight className="h-3.5 w-3.5" /></button>
          </article>
          <div className="mt-5 border-t border-stone-100 pt-5">
            <div className="flex items-center justify-between text-xs"><span className="font-bold text-stone-500">AI-checked submissions</span><span className="font-black">9</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full w-[90%] rounded-full bg-violet-500" /></div>
            <p className="mt-3 text-xs leading-5 text-stone-400">Automation stays separate from teacher-approved evidence.</p>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-400">Assignment movement</p><h2 className="mt-2 text-2xl font-semibold">This week’s work</h2></div><span className="text-xs font-bold text-stone-400">3 assignments</span></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ['Linear equations practice', state.evidenceSubmitted ? '25/28' : '24/28', state.evidenceSubmitted ? 89 : 86],
            ['Polynomials exit ticket', '21/28', 75],
            ['Coordinate geometry warm-up', '18/28', 64],
          ].map(([title, count, percent]) => (
            <article key={String(title)} className="rounded-2xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-black">{title}</p><span className="text-xs font-black">{percent}%</span></div><p className="mt-2 text-xs text-stone-400">{count} submitted</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} /></div></article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StudentView({
  state,
  dispatch,
}: {
  state: DemoPortalState;
  dispatch: DemoDispatch;
}) {
  const isCorrect = state.selectedAnswer === 'x = 7';

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-700">Riya’s learning day</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Good morning, Riya.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">One clear queue: teacher work first, gap repair next, then stretch.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-right shadow-sm"><p className="text-2xl font-semibold">37</p><p className="text-[9px] font-black uppercase tracking-wider text-stone-400">focused minutes</p></div>
      </div>

      {!state.sessionStarted || state.evidenceSubmitted ? (
        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <article className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-stone-950 text-white"><BookOpenCheck className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400">Teacher assigned</p><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">Complete</span></div><h2 className="mt-2 text-xl font-semibold">Polynomials exit ticket</h2><p className="mt-2 text-sm text-stone-500">5 questions · Mathematics · 15 min</p></div></div>
            </article>

            <article className={`rounded-[28px] border p-5 shadow-sm sm:p-6 ${state.evidenceSubmitted ? 'border-emerald-200 bg-emerald-50' : state.repairAssigned ? 'border-amber-200 bg-white ring-2 ring-amber-200/60' : 'border-stone-200 bg-stone-50'}`}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${state.evidenceSubmitted ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{state.evidenceSubmitted ? <CheckCircle2 className="h-5 w-5" /> : <Brain className="h-5 w-5" />}</span><div><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">Close a gap</p>{state.repairAssigned && !state.evidenceSubmitted && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800">Next</span>}</div><h2 className="mt-2 text-xl font-semibold">Repair sign errors in equations</h2><p className="mt-2 max-w-xl text-sm leading-6 text-stone-500">A short guided practice created from your recent work. Questions and hints, never the answer.</p><div className="mt-3 flex gap-3 text-xs font-bold text-stone-400"><span>Mathematics</span><span>·</span><span>12 min</span></div></div></div>
                {state.evidenceSubmitted ? (
                  <button type="button" onClick={() => dispatch({ type: 'switch_role', role: 'teacher' })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white">Show teacher <ArrowRight className="h-3.5 w-3.5" /></button>
                ) : state.repairAssigned ? (
                  <button type="button" onClick={() => dispatch({ type: 'start_session' })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white">Start with guidance <ArrowRight className="h-3.5 w-3.5" /></button>
                ) : (
                  <button type="button" onClick={() => dispatch({ type: 'switch_role', role: 'teacher' })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-black text-stone-500">Waiting for teacher</button>
                )}
              </div>

              {state.evidenceSubmitted && (
                <div className="mt-5 grid gap-3 border-t border-emerald-200 pt-5 sm:grid-cols-3">
                  <div><p className="text-[9px] font-black uppercase text-emerald-700">Before</p><p className="mt-1 text-2xl font-semibold">{state.masteryBefore}%</p></div>
                  <div><p className="text-[9px] font-black uppercase text-emerald-700">Fresh check</p><p className="mt-1 text-2xl font-semibold">{state.masteryAfter}%</p></div>
                  <div><p className="text-[9px] font-black uppercase text-emerald-700">Evidence</p><p className="mt-2 text-sm font-black">3 of 4 checks passed</p></div>
                </div>
              )}
            </article>

            <article className="rounded-[28px] border border-stone-200 bg-white p-5 opacity-70 shadow-sm sm:p-6"><div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-900"><Sparkles className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-violet-700">Stretch</p><h2 className="mt-2 text-xl font-semibold">Equation challenge set</h2><p className="mt-2 text-sm text-stone-500">Unlocks when the repair evidence is ready.</p></div></div></article>
          </div>

          <aside className="h-fit rounded-[28px] bg-stone-950 p-6 text-white lg:sticky lg:top-24"><p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/45">Why this order?</p><h2 className="mt-3 text-2xl font-semibold text-white">Less choosing. More learning.</h2><p className="mt-3 text-sm leading-6 text-white/55">Teacher work comes first. Gap repair follows while the idea is fresh. Stretch appears only when the foundation is ready.</p><div className="mt-6 border-t border-white/10 pt-5"><p className="text-4xl font-semibold text-white">2</p><p className="mt-1 text-[9px] font-black uppercase tracking-wider text-white/40">meaningful steps left</p></div></aside>
        </div>
      ) : (
        <section className="mt-8 overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-xl shadow-stone-900/10">
          <div className="border-b border-stone-100 bg-stone-950 p-5 text-white sm:p-7">
            <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.17em] text-amber-300">Guided repair · Step 2 of 3</p><h2 className="mt-2 text-2xl font-semibold text-white">Undo the operation, one move at a time.</h2></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">08:42 left</span></div>
          </div>
          <div className="grid lg:grid-cols-[1fr_320px]">
            <div className="p-5 sm:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">Fresh evidence check</p>
              <h3 className="mt-4 text-3xl font-semibold">Solve: 3x − 5 = 16</h3>
              <p className="mt-3 text-sm leading-6 text-stone-500">Which value of x keeps both sides equal?</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {['x = 5', 'x = 7', 'x = 11'].map((answer) => (
                  <button key={answer} type="button" onClick={() => dispatch({ type: 'select_answer', answer })} aria-pressed={state.selectedAnswer === answer} className={`rounded-2xl border px-4 py-5 text-lg font-black transition ${state.selectedAnswer === answer ? 'border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-200' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'}`}>{answer}</button>
                ))}
              </div>

              {state.selectedAnswer && !isCorrect && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Almost. First add 5 to both sides. What does 3x equal then?</div>}
              {state.hintVisible && <div className="mt-5 flex gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" /><div><p className="text-sm font-black text-violet-950">Hint, not the answer</p><p className="mt-1 text-sm leading-6 text-violet-900/65">Reverse subtraction first: add 5 to both sides. Then divide both sides by 3.</p></div></div>}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => dispatch({ type: 'show_hint' })} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-black text-stone-700"><Lightbulb className="h-4 w-4" /> Ask for a hint</button>
                <button type="button" disabled={!isCorrect} onClick={() => dispatch({ type: 'submit_evidence' })} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35">Submit evidence <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
            <aside className="border-t border-stone-100 bg-[#f7f6f2] p-5 sm:p-7 lg:border-l lg:border-t-0"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-violet-700"><Brain className="h-4 w-4" /> Why this question?</div><p className="mt-4 text-sm leading-6 text-stone-600">Riya’s earlier work suggests she divides before undoing subtraction. This check isolates that exact misconception.</p><div className="mt-6 space-y-3"><div className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-[9px] font-black uppercase text-stone-400">Previous pattern</p><p className="mt-2 text-sm font-bold">Sign errors · 2 assignments</p></div><div className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-[9px] font-black uppercase text-stone-400">Teacher control</p><p className="mt-2 text-sm font-bold">Repair approved by Ms. Rao</p></div></div></aside>
          </div>
        </section>
      )}
    </div>
  );
}

function PrincipalView({ state }: { state: DemoPortalState }) {
  const verifiedScore = state.evidenceSubmitted ? 76 : 74;
  return (
    <div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">School outcomes</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Academic movement, not app activity.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">Drill from school-wide mastery to the classes and concepts where a human decision can change the outcome.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Students" value="428" note="Across 14 active sections" icon={Users} />
        <MetricCard label="Weekly adoption" value="91%" note="23 of 25 teachers active" icon={School} />
        <MetricCard label="Estimated mastery" value="79%" note="Model estimate · not verified" icon={Brain} tone="bg-amber-50" />
        <MetricCard label="Verified mastery" value={`${verifiedScore}%`} note={state.evidenceSubmitted ? '128 comparable checks · Riya included' : '127 comparable checks'} icon={ShieldCheck} tone="bg-emerald-50" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Class movement</p><h2 className="mt-2 text-2xl font-semibold">Where learning is moving</h2></div><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[9px] font-black uppercase text-emerald-800">Last 30 days</span></div>
          <div className="mt-6 space-y-5">
            {[
              ['9-B Mathematics', state.evidenceSubmitted ? 78 : 76, '+8 pts', 'emerald'],
              ['8-A Science', 72, '+5 pts', 'emerald'],
              ['10-C Mathematics', 61, '-2 pts', 'red'],
              ['9-A Science', 69, '+3 pts', 'emerald'],
            ].map(([name, score, movement, tone]) => (
              <div key={String(name)}><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-black">{name}</p><p className="mt-0.5 text-xs text-stone-400">Verified concept checks</p></div><div className="text-right"><p className="text-lg font-black">{score}%</p><p className={`text-xs font-black ${tone === 'red' ? 'text-red-600' : 'text-emerald-600'}`}>{movement}</p></div></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${tone === 'red' ? 'bg-red-400' : 'bg-emerald-500'}`} style={{ width: `${score}%` }} /></div></div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] bg-stone-950 p-6 text-white shadow-xl shadow-stone-900/10 sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-300">Inspect the evidence</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">The number and its source stay together.</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">Estimated signals guide attention. Only comparable before-and-after checks count as verified movement.</p>
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-white/55">Estimated concepts</span><span className="font-black">312</span></div><p className="mt-2 text-[10px] leading-5 text-white/35">Behaviour and response model</p></div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-emerald-200">Verified checks</span><span className="font-black text-emerald-200">{state.evidenceSubmitted ? 128 : 127}</span></div><p className="mt-2 text-[10px] leading-5 text-white/40">Comparable evidence before and after</p></div>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">Pilot ROI</p><h2 className="mt-2 text-3xl font-semibold">Value leaders can inspect.</h2><p className="mt-3 text-sm leading-6 text-stone-500">Baseline and current movement remain visible throughout the pilot.</p></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#f7f6f2] p-4"><Clock3 className="h-4 w-4 text-stone-400" /><p className="mt-5 text-2xl font-semibold">8.4h</p><p className="mt-1 text-xs text-stone-500">teacher time returned / month</p></div><div className="rounded-2xl bg-[#f7f6f2] p-4"><Target className="h-4 w-4 text-stone-400" /><p className="mt-5 text-2xl font-semibold">2.1×</p><p className="mt-1 text-xs text-stone-500">faster gap resolution</p></div><div className="rounded-2xl bg-[#f7f6f2] p-4"><CheckCircle2 className="h-4 w-4 text-stone-400" /><p className="mt-5 text-2xl font-semibold">74%</p><p className="mt-1 text-xs text-stone-500">interventions verified</p></div></div>
        </div>
        <p className="mt-5 border-t border-stone-100 pt-4 text-[10px] leading-5 text-stone-400">Illustrative demo targets. A live pilot reports actual results against a baseline agreed with the school.</p>
      </section>
    </div>
  );
}

function PresenterRail({
  state,
  dispatch,
}: {
  state: DemoPortalState;
  dispatch: DemoDispatch;
}) {
  const completed = completedDemoSteps(state);
  const nextAction = useMemo(() => {
    if (!state.repairAssigned) return { label: 'Assign Riya’s repair', role: 'teacher' as DemoRole };
    if (!state.sessionStarted) return { label: 'Continue as Riya', role: 'student' as DemoRole };
    if (!state.evidenceSubmitted) return { label: 'Complete fresh check', role: 'student' as DemoRole };
    if (!state.evidenceReviewed) return { label: 'Accept teacher evidence', role: 'teacher' as DemoRole };
    return { label: 'Show principal outcomes', role: 'principal' as DemoRole };
  }, [state]);

  return (
    <aside className="h-fit rounded-[28px] border border-stone-200 bg-white p-5 shadow-lg shadow-stone-900/5 xl:sticky xl:top-24">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">Presenter guide</p><h2 className="mt-1 text-xl font-semibold">Riya’s closed loop</h2></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-sm font-black text-violet-800">{completed}/5</span></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-violet-600 transition-all duration-500" style={{ width: `${(completed / 5) * 100}%` }} /></div>

      <div className="mt-5 space-y-4">
        {[
          ['signal_detected', 'Detect', 'Teacher sees the misconception'],
          ['repair_assigned', 'Decide', 'Teacher approves targeted support'],
          ['session_started', 'Act', 'Student opens guided repair'],
          ['evidence_submitted', 'Verify', 'Fresh evidence measures movement'],
          ['evidence_reviewed', 'Learn', 'Teacher closes the loop'],
        ].map(([id, label, detail], index) => {
          const done = state.timeline.some((event) => event.id === id);
          return <div key={id} className="flex gap-3"><span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${done ? 'bg-emerald-600 text-white' : 'border border-stone-200 bg-white text-stone-300'}`}>{done ? <Check className="h-3.5 w-3.5" /> : <span className="text-[9px] font-black">{index + 1}</span>}</span><div><p className={`text-xs font-black ${done ? 'text-stone-950' : 'text-stone-400'}`}>{label}</p><p className="mt-0.5 text-[10px] leading-4 text-stone-400">{detail}</p></div></div>;
        })}
      </div>

      <button type="button" onClick={() => dispatch({ type: 'switch_role', role: nextAction.role })} className="mt-6 flex w-full items-center justify-between rounded-2xl bg-stone-950 px-4 py-3 text-left text-xs font-black text-white hover:bg-stone-800"><span><span className="block text-[8px] uppercase tracking-[0.15em] text-white/40">Next demo move</span><span className="mt-1 block">{nextAction.label}</span></span><ArrowRight className="h-4 w-4" /></button>

      <div className="mt-5 rounded-2xl bg-amber-50 p-4"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-800">What to say</p><p className="mt-2 text-xs font-bold leading-5 text-amber-950/70">“The AI proposes. The teacher decides. The outcome is verified with fresh evidence.”</p></div>
    </aside>
  );
}

export default function DemoPortal() {
  const [state, dispatch] = useReducer(demoPortalReducer, undefined, createDemoPortalState);

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-950">
      <DemoHeader state={state} dispatch={dispatch} />
      <div className="mx-auto grid max-w-[1480px] gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">
          {state.activeRole === 'teacher' && <TeacherView state={state} dispatch={dispatch} />}
          {state.activeRole === 'student' && <StudentView state={state} dispatch={dispatch} />}
          {state.activeRole === 'principal' && <PrincipalView state={state} />}
        </main>
        <PresenterRail state={state} dispatch={dispatch} />
      </div>
      <footer className="border-t border-stone-200 bg-white/60 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-2 text-[10px] font-bold text-stone-400 sm:flex-row sm:items-center sm:justify-between"><span>Seeded presentation environment · no student data is real</span><Link to="/" className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-950">Back to school landing <ArrowRight className="h-3 w-3" /></Link></div>
      </footer>
    </div>
  );
}
