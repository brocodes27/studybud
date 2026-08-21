import { Link } from "react-router-dom";
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
  HeartHandshake,
  Menu,
  School,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useState } from "react";
import { schoolAuthHref } from "../lib/schoolAuth";

const stakeholderValue = [
  {
    icon: GraduationCap,
    eyebrow: "For students",
    title: "One clear next step.",
    body: "Teacher work comes first, then targeted gap repair, then stretch work when the foundation is ready.",
    tone: "bg-amber-50 text-amber-950",
  },
  {
    icon: BookOpenCheck,
    eyebrow: "For teachers",
    title: "Judgment, not admin.",
    body: "See the students who need you, approve focused interventions, and review only the work that needs a human eye.",
    tone: "bg-violet-50 text-violet-950",
  },
  {
    icon: BarChart3,
    eyebrow: "For leaders",
    title: "Movement, not activity.",
    body: "Follow concept progress, unresolved support and implementation health across a class, campus or school chain.",
    tone: "bg-emerald-50 text-emerald-950",
  },
];

const loop = [
  {
    number: "01",
    title: "Detect",
    detail:
      "Find the concept, misconception or execution signal holding a learner back.",
  },
  {
    number: "02",
    title: "Decide",
    detail:
      "Recommend the smallest useful action and put a teacher in control.",
  },
  {
    number: "03",
    title: "Act",
    detail:
      "Guide the student through focused work inside their daily learning queue.",
  },
  {
    number: "04",
    title: "Verify",
    detail:
      "Collect evidence, measure movement and refine what the system recommends next.",
  },
];

const roiSignals = [
  {
    icon: Clock3,
    label: "Teacher time returned",
    value: "Measured from real workflows",
  },
  {
    icon: Target,
    label: "Gap resolution speed",
    value: "Detection to verified repair",
  },
  {
    icon: CheckCircle2,
    label: "Learning movement",
    value: "Evidence before and after",
  },
  {
    icon: HeartHandshake,
    label: "Implementation health",
    value: "Adoption that leaders can act on",
  },
];

function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-xl">
      <div className="absolute -inset-10 -z-10 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_32px_100px_-42px_rgba(28,25,23,0.55)]">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-stone-950 text-white">
              <GraduationCap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-stone-950">
                Teacher command center
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">
                Class 9 · Mathematics
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">
            Product preview
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-stone-50 p-4">
          {[
            ["82%", "Work complete"],
            ["6", "Need action"],
            ["3", "Review only"],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-2xl border border-stone-100 bg-white p-3"
            >
              <p className="text-xl font-semibold text-stone-950 sm:text-2xl">
                {value}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-stone-400">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-violet-700">
                Today’s decisions
              </p>
              <p className="mt-1 text-lg font-semibold text-stone-950">
                Where your judgment matters
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-violet-500" />
          </div>

          <div className="mt-4 space-y-2.5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-900">
                  <Brain className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-extrabold text-amber-950">
                      Linear equations
                    </p>
                    <span className="text-[9px] font-black uppercase text-amber-700">
                      6 students
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-amber-900/65">
                    Sign errors are repeating across two assignments.
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-amber-950">
                    Review repair group <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-stone-200 p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                <BookOpenCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-stone-900">
                  Three submissions need review
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  The remaining work has high-confidence feedback.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-stone-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SchoolsLanding() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-stone-950">
      <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#f7f6f2]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2.5"
            aria-label="Elevenfolks for schools home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-stone-950 text-white">
              <GraduationCap className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-extrabold leading-none">elevenfolks</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-stone-400">
                For schools
              </p>
            </div>
          </Link>

          <nav
            className="hidden items-center gap-7 md:flex"
            aria-label="Primary navigation"
          >
            <a
              href="#learning-loop"
              className="text-sm font-bold text-stone-500 transition hover:text-stone-950"
            >
              How it works
            </a>
            <a
              href="#stakeholders"
              className="text-sm font-bold text-stone-500 transition hover:text-stone-950"
            >
              For your team
            </a>
            <a
              href="#roi"
              className="text-sm font-bold text-stone-500 transition hover:text-stone-950"
            >
              ROI
            </a>
            <Link
              to="/students"
              className="text-sm font-bold text-stone-500 transition hover:text-stone-950"
            >
              For students
            </Link>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              to={schoolAuthHref()}
              className="rounded-xl px-4 py-2.5 text-sm font-extrabold text-stone-600 hover:bg-white hover:text-stone-950"
            >
              School sign in
            </Link>
            <a
              href="#pilot"
              className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-stone-800"
            >
              Explore a pilot <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <button
            type="button"
            className="rounded-xl border border-stone-200 bg-white p-2.5 md:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {mobileOpen && (
          <nav
            className="border-t border-stone-200 bg-white px-4 py-4 md:hidden"
            aria-label="Mobile navigation"
          >
            <div className="mx-auto grid max-w-7xl gap-1">
              {[
                ["#learning-loop", "How it works"],
                ["#stakeholders", "For your team"],
                ["#roi", "ROI"],
                ["/students", "For students"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50"
                >
                  {label}
                </a>
              ))}
              <Link
                to={schoolAuthHref()}
                className="mt-2 rounded-xl bg-stone-950 px-4 py-3 text-center text-sm font-extrabold text-white"
              >
                School sign in
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main>
        <section className="overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.13em] text-stone-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />A closed
                learning loop for schools
              </div>
              <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-stone-950 sm:text-6xl lg:text-7xl">
                Every learning gap gets a next action.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600 sm:text-xl">
                Elevenfolks helps schools detect where students are stuck,
                coordinate the right intervention, and verify what
                changed—without adding another dashboard teachers must manage.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#pilot"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-stone-900/10 hover:bg-stone-800"
                >
                  See the school pilot <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#learning-loop"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-6 py-3.5 text-sm font-extrabold text-stone-800 hover:border-stone-300"
                >
                  Follow the learning loop
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-stone-500">
                {[
                  "Teacher-controlled AI",
                  "Evidence-aware outcomes",
                  "Student-safe by design",
                ].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section
          id="learning-loop"
          className="scroll-mt-24 bg-stone-950 px-4 py-20 text-white sm:px-6 sm:py-28 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  One operating rhythm
                </p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-5xl">
                  From signal to verified support.
                </h2>
                <p className="mt-5 max-w-md text-base leading-7 text-white/55">
                  The system becomes useful when each signal ends in a decision,
                  an owner and evidence—not another chart.
                </p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-[28px] border border-white/10 bg-white/10 sm:grid-cols-2">
                {loop.map((item) => (
                  <article
                    key={item.number}
                    className="bg-stone-950 p-6 sm:p-8"
                  >
                    <p className="text-xs font-black tracking-[0.2em] text-violet-300">
                      {item.number}
                    </p>
                    <h3 className="mt-8 text-2xl font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-white/55">
                      {item.detail}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="stakeholders"
          className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                One loop, three useful views
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                Less software to operate. More clarity to act on.
              </h2>
            </div>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {stakeholderValue.map(
                ({ icon: Icon, eyebrow, title, body, tone }) => (
                  <article
                    key={eyebrow}
                    className={`rounded-[30px] p-7 sm:p-8 ${tone}`}
                  >
                    <Icon className="h-6 w-6" />
                    <p className="mt-10 text-[11px] font-black uppercase tracking-[0.16em] opacity-55">
                      {eyebrow}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold">{title}</h3>
                    <p className="mt-3 text-sm leading-6 opacity-65">{body}</p>
                  </article>
                ),
              )}
            </div>
          </div>
        </section>

        <section
          id="roi"
          className="scroll-mt-24 px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8"
        >
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[36px] border border-stone-200 bg-white">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-stone-200 p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                  ROI leaders can inspect
                </p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em]">
                  Measure value in learning and time.
                </h2>
                <p className="mt-5 text-base leading-7 text-stone-600">
                  A pilot should establish a baseline, show the intervention and
                  verify the result. Elevenfolks is being built around that
                  evidence trail.
                </p>
                <div className="mt-8 flex items-center gap-3 rounded-2xl bg-stone-950 p-4 text-white">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-300" />
                  <p className="text-xs font-bold leading-5 text-white/70">
                    Estimated signals stay separate from independently verified
                    outcomes.
                  </p>
                </div>
              </div>
              <div className="grid gap-px bg-stone-200 sm:grid-cols-2">
                {roiSignals.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-white p-7 sm:p-9">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-stone-100 text-stone-800">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-8 text-lg font-extrabold">{label}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="pilot"
          className="scroll-mt-24 border-y border-stone-200 bg-amber-50 px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-amber-900">
                <School className="h-5 w-5" />
                <p className="text-xs font-black uppercase tracking-[0.18em]">
                  A focused school pilot
                </p>
              </div>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                Start with one measurable learning problem.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-amber-950/65">
                Choose a grade, subject and priority concept set. Establish a
                baseline, run the closed loop, and finish with an outcome and
                teacher-time report.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                to={schoolAuthHref()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-6 py-3.5 text-sm font-extrabold text-white"
              >
                School sign in <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#learning-loop"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-amber-200 bg-white px-6 py-3.5 text-sm font-extrabold text-amber-950"
              >
                Review the workflow
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-stone-950 px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="h-5 w-5" />
            <span className="font-extrabold">elevenfolks</span>
          </div>
          <div className="flex flex-wrap gap-5 text-xs font-bold text-white/45">
            <Link to="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link to="/students" className="hover:text-white">
              Student product
            </Link>
          </div>
          <p className="text-xs text-white/35">
            Learning gaps should never stay invisible.
          </p>
        </div>
      </footer>
    </div>
  );
}
