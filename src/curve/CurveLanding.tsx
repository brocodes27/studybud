import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  FileUp,
  Files,
  LineChart,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

import { pdfFileToImageDataUrls } from '../lib/pdfToImages';
import { AhaForecastModal } from './AhaForecastModal';
import {
  parseMultiSyllabusImages,
  type ParsedSyllabus,
} from './ai';
import { stashPendingParse } from './onboardingHandoff';
import { CurveButton, CurveShell, Eyebrow, Panel } from './ui';
import './curve.css';

const PILLARS = [
  {
    icon: LineChart,
    title: 'A daily number, not a vibe',
    body: 'Every course gets a daily projected grade range. As scores land, the forecast adjusts so you never wonder where you stand.',
  },
  {
    icon: ShieldCheck,
    title: 'Deterministic current standing',
    body: 'Current standing is computed purely from your syllabus weights with zero AI guesswork. Only unearned points are forecasted.',
  },
  {
    icon: Zap,
    title: 'One highest-leverage action today',
    body: 'Curve calculates which 20-minute drill produces the biggest score lift per minute for your upcoming exam and deep-links you straight into it.',
  },
];

const WEEDER_COURSES = [
  { code: 'CHEM 2210', name: 'Organic Chemistry I', school: 'UC Berkeley', avg: 'C+' },
  { code: 'MATH 2400', name: 'Multivariable Calculus', school: 'UT Austin', avg: 'B-' },
  { code: 'PHYS 1100', name: 'General Physics: Mechanics', school: 'Georgia Tech', avg: 'C+' },
  { code: 'ECON 2010', name: 'Principles of Macroeconomics', school: 'NYU', avg: 'B' },
];

const FAQS = [
  {
    q: 'How does Curve calculate my grade forecast?',
    a: 'Curve splits forecasting into two layers. Layer 1 is deterministic: current standing calculated purely from syllabus weights and returned scores. Layer 2 forecasts remaining components using Bayesian Knowledge Tracing on your concept mastery, outputting a conservative letter range with confidence.',
  },
  {
    q: 'Why not just use Canvas or Excel?',
    a: 'Canvas only shows points already entered by your professor (often weeks late). Excel cannot model drop-lowest rules, unearned component weights, or predict performance on upcoming exams based on your concept gaps.',
  },
  {
    q: 'Do I need Canvas developer-key approval?',
    a: 'No LMS integration is required. Uploading your syllabus PDF or picking your course takes 30 seconds and keeps your student data entirely private under FERPA.',
  },
  {
    q: 'What is the Semester Pass?',
    a: 'The Semester Pass grants 4 months of full access across all your enrolled courses for $39, saving 30% compared to monthly billing and matching your academic calendar.',
  },
];

const SAMPLE_DEMO_COURSES: ParsedSyllabus[] = [];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

export function CurveLanding() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Drag & Drop Hero Parser State
  const [parsing, setParsing] = useState(false);
  const [parsePass, setParsePass] = useState<{ pass: number; passes: number } | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [parsedCourses, setParsedCourses] = useState<ParsedSyllabus[]>([]);
  const [showAhaModal, setShowAhaModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interactive Simulator State
  const [simPsScore, setSimPsScore] = useState<number>(88);
  const [simMidtermScore, setSimMidtermScore] = useState<number>(76);

  // Calculated simulated percent: PS (20%) + Midterm (30%) + Final projected (50% at 85% pace)
  const simWeightedStanding = simPsScore * 0.2 + simMidtermScore * 0.3 + 85 * 0.5;
  const simLetter =
    simWeightedStanding >= 90
      ? 'A-'
      : simWeightedStanding >= 84
      ? 'B+'
      : simWeightedStanding >= 78
      ? 'B'
      : 'C+';

  async function handleFiles(files: FileList) {
    if (!files || files.length === 0) return;

    setParsing(true);
    const names = Array.from(files).map((f) => f.name);
    setFileNames(names);

    try {
      const imageBatches: string[][] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const images = isPdf ? await pdfFileToImageDataUrls(file) : [await readFileAsDataUrl(file)];
        if (images.length > 0) {
          imageBatches.push(images);
        }
      }

      if (imageBatches.length > 0) {
        const parsedMulti = await parseMultiSyllabusImages(imageBatches, (pass, passes) =>
          setParsePass(passes > 1 ? { pass, passes } : null),
        );
        if (parsedMulti.courses.length > 0) {
          setParsedCourses(parsedMulti.courses);
          // P1.2: keep the parsed syllabi through the /auth round-trip so
          // onboarding lands pre-filled instead of making the user re-upload.
          stashPendingParse(parsedMulti);
        } else {
          setParsedCourses([]);
        }
      } else {
        setParsedCourses([]);
      }
    } catch {
      setParsedCourses([]);
    } finally {
      setParsing(false);
      setParsePass(null);
      setShowAhaModal(true);
    }
  }

  function handleDemoAha() {
    // Demo: no real parse, nothing to carry through auth.
    setParsedCourses([]);
    setShowAhaModal(true);
  }

  return (
    <CurveShell>
      {/* Aha! Instant Forecast Reveal Modal */}
      {showAhaModal ? (
        <AhaForecastModal
          parsedCourses={parsedCourses}
          onContinue={() => navigate('/auth')}
        />
      ) : null}

      {/* Navigation Header */}
      <header className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8b5cf6] text-sm font-bold text-white shadow-md">
            C
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">Curve</span>
        </div>
        <div className="flex items-center gap-3">
          <CurveButton ghost onClick={() => navigate('/auth')} className="!px-4 !py-2 !text-sm">
            Sign in
          </CurveButton>
          <CurveButton onClick={() => navigate('/auth')} className="!px-4 !py-2 !text-sm">
            Start free
          </CurveButton>
        </div>
      </header>

      {/* Hero Section with Multi-PDF Drag & Drop Hero */}
      <section className="mx-auto max-w-4xl pt-12 text-center sm:pt-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-curve-violet/30 bg-curve-violet/15 px-3.5 py-1.5 text-xs font-semibold text-curve-violet-soft">
          <Sparkles className="h-3.5 w-3.5 text-[#fbbf24]" />
          <span>The 10-Second Magic Onboarding</span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl leading-tight">
          Know your grade{' '}
          <span className="bg-gradient-to-r from-[#a78bfa] to-[#f472b6] bg-clip-text text-transparent">
            before your professor does
          </span>
          .
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base text-curve-muted sm:text-lg leading-relaxed">
          Drop your syllabus PDFs below. Curve extracts your weighted categories, weekly topics, and calculates your instant GPA forecast in 10 seconds.
        </p>

        {/* Hero Multi-Syllabus Drag-and-Drop Parser */}
        <div className="mx-auto mt-8 max-w-2xl">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
              dragActive
                ? 'border-emerald-400 bg-emerald-500/10 scale-[1.02]'
                : 'border-purple-500/40 bg-gradient-to-b from-[#181136]/90 to-[#0e0a24]/90 hover:border-purple-400 hover:bg-[#1a123d]'
            } shadow-2xl backdrop-blur-xl`}
          >
            {parsing ? (
              <div className="flex flex-col items-center justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-[#a78bfa]" />
                <p className="mt-3 text-sm font-bold text-white">
                  {parsePass
                    ? `Reading pass ${parsePass.pass} of ${parsePass.passes}…`
                    : 'Extracting Multi-Subject Syllabi...'}
                </p>
                <p className="text-xs text-curve-muted mt-1">
                  Parsing course weights, midterm dates, and BKT mastery parameters.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40">
                  <Files className="h-7 w-7 text-amber-400" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">
                  Drop Your Syllabus PDFs (or Photos) Here
                </h3>
                <p className="mt-1 text-xs text-curve-muted max-w-md">
                  One file with every subject, or one file per course — both work. Instantly reveals your projected GPA trajectory before you sign up.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-300">
                    PDF / Images
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Instant "Aha!" Forecast Reveal
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Demo Option */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-curve-faint">
            <span>Don't have a syllabus file handy?</span>
            <button
              type="button"
              onClick={handleDemoAha}
              className="font-bold text-[#a78bfa] underline hover:text-white"
            >
              Try Instant Demo Forecast Reveal
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-curve-faint">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-[#34d399]" /> No credit card needed
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-[#34d399]" /> 10-second AI extraction
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-[#34d399]" /> FERPA private
          </span>
        </div>
      </section>

      {/* Interactive Grade Simulator Widget */}
      <section className="mx-auto max-w-3xl pt-16">
        <Panel className="border-white/10 bg-gradient-to-b from-[#16112a] to-[#0d091a] !p-6 sm:!p-8">
          <div className="mb-6 text-center">
            <Eyebrow>Interactive Grade Engine</Eyebrow>
            <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
              Try the daily forecast algorithm
            </h2>
            <p className="mt-1 text-xs text-curve-muted">
              Adjust returned scores below and watch the forecast letter band re-calculate in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 rounded-2xl border border-white/5 bg-white/5 p-4 sm:grid-cols-2 sm:p-6">
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-white/80">
                  <span>Problem Set 2 (20% weight)</span>
                  <span className="text-[#a78bfa]">{simPsScore}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={simPsScore}
                  onChange={(e) => setSimPsScore(Number(e.target.value))}
                  className="w-full cursor-pointer accent-[#8b5cf6]"
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-white/80">
                  <span>Midterm 1 (30% weight)</span>
                  <span className="text-[#a78bfa]">{simMidtermScore}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={simMidtermScore}
                  onChange={(e) => setSimMidtermScore(Number(e.target.value))}
                  className="w-full cursor-pointer accent-[#8b5cf6]"
                />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#0a0814] p-4 text-center">
              <span className="text-[10px] font-bold tracking-widest text-curve-faint uppercase">
                PROJECTED FORECAST
              </span>
              <div className="mt-1 text-5xl font-extrabold text-[#f472b6]">
                {simLetter}
              </div>
              <div className="mt-1 text-sm font-bold text-[#34d399]">
                {simWeightedStanding.toFixed(1)}%
              </div>
              <span className="mt-2 text-[11px] text-curve-muted">50% graded · 12 days to Final</span>
            </div>
          </div>
        </Panel>
      </section>

      {/* Pre-loaded Weeder Courses */}
      <section className="pt-16">
        <div className="mb-8 text-center">
          <Eyebrow>Pre-Loaded Catalog</Eyebrow>
          <h2 className="mt-1 text-2xl font-bold text-white">Syllabi ready for top weeders</h2>
          <p className="text-sm text-curve-muted">Instant enrollment with pre-parsed grading weights for your campus.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {WEEDER_COURSES.map((c) => (
            <Panel key={c.code} className="transition-all hover:border-white/20 !p-4">
              <div className="text-xs font-bold text-[#a78bfa]">{c.code}</div>
              <div className="mt-0.5 truncate text-sm font-bold text-white">{c.name}</div>
              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-xs text-curve-muted">
                <span>{c.school}</span>
                <span className="text-white/40">Historical Avg: {c.avg}</span>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      {/* Anti-Positioning: Curve vs ChatGPT */}
      <section className="pt-16">
        <div className="mb-8 text-center">
          <Eyebrow>Anti-Positioning</Eyebrow>
          <h2 className="mt-1 text-2xl font-bold text-white">Why ChatGPT fails at college grades</h2>
          <p className="text-sm text-curve-muted">ChatGPT gives instant answers that create a false sense of mastery.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Panel className="border-red-500/20 bg-red-950/10 !p-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-red-300">
              <span className="h-2 w-2 rounded-full bg-red-400" /> Generic AI & Answer Bots
            </h3>
            <ul className="space-y-3 text-sm text-curve-muted">
              <li className="flex items-start gap-2">
                <span className="shrink-0 text-red-400">✕</span> Zero memory of your syllabus weights or midterm dates
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 text-red-400">✕</span> Sycophantic praise that hides concept gaps
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 text-red-400">✕</span> Gives direct answers so you bomb the closed-book exam
              </li>
            </ul>
          </Panel>

          <Panel className="border-[#34d399]/20 bg-[#34d399]/5 !p-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#34d399]">
              <span className="h-2 w-2 rounded-full bg-[#34d399]" /> Curve Grade Spine
            </h3>
            <ul className="space-y-3 text-sm text-white/80">
              <li className="flex items-start gap-2">
                <span className="shrink-0 text-[#34d399]">✓</span> Persistent syllabus weights & exact standing calculation
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 text-[#34d399]">✓</span> Honest confidence range derived from Bayesian Knowledge Tracing
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 text-[#34d399]">✓</span> Single highest-leverage action ranked by grade lift / min
              </li>
            </ul>
          </Panel>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="grid grid-cols-1 gap-4 pt-16 md:grid-cols-3">
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <Panel key={pillar.title}>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-curve-violet/20 ring-1 ring-white/10">
                <Icon className="h-5 w-5 text-curve-violet-soft" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-curve-muted">{pillar.body}</p>
            </Panel>
          );
        })}
      </section>

      {/* Pricing Section */}
      <section className="pt-16 text-center">
        <Eyebrow>Simple Transparent Pricing</Eyebrow>
        <h2 className="mt-1 text-3xl font-bold text-white">Invest in your GPA before finals</h2>

        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-6 text-left md:grid-cols-2">
          {/* Free Tier */}
          <Panel className="!p-6">
            <div className="text-xs font-bold uppercase text-curve-faint">Free Tier</div>
            <div className="mt-2 text-3xl font-extrabold text-white">$0</div>
            <p className="mt-1 text-xs text-curve-muted">Track 1 course preview with current standing calculation.</p>
            <CurveButton ghost onClick={() => navigate('/auth')} className="mt-6 w-full !py-2.5">
              Get Started Free
            </CurveButton>
          </Panel>

          {/* Semester Pass */}
          <Panel className="relative border-[#8b5cf6] bg-gradient-to-b from-[#181033] to-[#0e091f] ring-2 ring-[#8b5cf6]/30 !p-6">
            <div className="absolute top-3 right-6 rounded-full bg-[#8b5cf6] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Best Value
            </div>
            <div className="text-xs font-bold uppercase text-[#a78bfa]">Curve Pro Pass</div>
            <div className="mt-2 text-3xl font-extrabold text-white">
              $14 <span className="text-xs font-normal text-curve-muted">/ month</span>
            </div>
            <p className="mt-1 text-xs text-curve-muted">Unlimited multi-subject syllabi, 72h Exam Emergency Mode, and Socratic BKT AI Coach.</p>
            <CurveButton onClick={() => navigate('/auth')} className="mt-6 w-full !py-2.5">
              Get Pro Pass
            </CurveButton>
          </Panel>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="mx-auto max-w-3xl pt-16">
        <div className="mb-8 text-center">
          <Eyebrow>Frequently Asked Questions</Eyebrow>
          <h2 className="mt-1 text-2xl font-bold text-white">Got questions? We have answers.</h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className="cursor-pointer"
              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
            >
              <Panel className="transition-all hover:border-white/20 !p-4">
                <div className="flex items-center justify-between text-sm font-semibold text-white">
                  <span>{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="h-4 w-4 text-[#a78bfa]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-curve-faint" />
                  )}
                </div>
                {openFaq === idx && (
                  <p className="mt-3 border-t border-white/5 text-xs leading-relaxed text-curve-muted pt-3">
                    {faq.a}
                  </p>
                )}
              </Panel>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action Footer */}
      <section className="pt-16">
        <Panel className="border-white/10 bg-gradient-to-b from-[#181135] to-[#0a0814] text-center !p-8 sm:!p-12">
          <h2 className="text-2xl font-extrabold text-white sm:text-4xl">
            Stop finding out how you did after it is too late.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-curve-muted">
            Add a syllabus in under a minute and see your real grade trajectory today.
          </p>
          <div className="mt-6 flex justify-center">
            <CurveButton onClick={() => navigate('/auth')} className="!px-8 !py-3.5 !text-base">
              Start free today
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </CurveButton>
          </div>
        </Panel>
      </section>

      {/* Footer */}
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-14 text-xs text-curve-faint">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">Curve</span>
          <span>© 2026</span>
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={() => navigate('/privacy')} className="hover:text-white">
            Privacy
          </button>
          <button type="button" onClick={() => navigate('/terms')} className="hover:text-white">
            Terms
          </button>
          <button type="button" onClick={() => navigate('/schools')} className="hover:text-white">
            For schools
          </button>
        </div>
      </footer>
    </CurveShell>
  );
}

export default CurveLanding;
