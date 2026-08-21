import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Zap,
  CheckCircle2,
  Brain,
  FileText,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Activity,
  Play,
  RotateCcw
} from 'lucide-react';
import { CurveButton, CurveShell, Display, Eyebrow, Panel } from './ui';
import { fetchCourseSnapshots, type CourseSnapshot } from './data';
import { useAuth } from '../contexts/AuthContext';
import './curve.css';

export function ExamEmergencySprint() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [snapshot, setSnapshot] = useState<CourseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  // 72-Hour Countdown Timer (in seconds)
  const [secondsLeft, setSecondsLeft] = useState<number>(72 * 3600 - 1420); // ~71.5 hours remaining

  // Interactive Checklist State
  const [completedItems, setCompletedItems] = useState<number[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    fetchCourseSnapshots(user.id)
      .then((res) => {
        const found = res.find((s) => s.enrollmentId === enrollmentId) || res[0] || null;
        setSnapshot(found);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [user?.id, enrollmentId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;

  // Panic Relief Meter Math
  const baselineScore = 68; // Starting predicted score without triage
  const scoreBoost = completedItems.length * 6.5; // +6.5% per item completed
  const currentPredictedScore = Math.min(96, Math.round(baselineScore + scoreBoost));

  const triageTopics = [
    {
      id: 1,
      day: 'Day 1: Concept Repair',
      title: 'Sn1 vs Sn2 Reaction Mechanisms & Stereochemistry',
      weight: '35% Exam Weight',
      bktMastery: '42% Mastery (High Risk)',
      action: 'Socratic AI Concept Repair Drill',
      mins: 25,
    },
    {
      id: 2,
      day: 'Day 2: High-Probability Exam Patterns',
      title: 'Electrophilic Addition & Carbocation Rearrangements',
      weight: '25% Exam Weight',
      bktMastery: '58% Mastery (Medium Risk)',
      action: 'Practice Top 5 Historical Exam Questions',
      mins: 30,
    },
    {
      id: 3,
      day: 'Day 3: Timed Mock Exam & Cognitive Check',
      title: 'Synthesis Roadmaps & NMR Spectroscopy Integration',
      weight: '30% Exam Weight',
      bktMastery: '64% Mastery (Moderate)',
      action: '20-Minute Timed Emergency Mock Exam',
      mins: 20,
    },
  ];

  function toggleItem(id: number) {
    setCompletedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  const courseTitle = snapshot?.course.title || 'Organic Chemistry I';
  const courseCode = snapshot?.course.courseCode || 'CHEM 2210';

  return (
    <CurveShell>
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-curve-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      {/* Hero Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-red-300">
            <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse" />
            72-Hour Exam Emergency Mode Activated
          </div>
          <Display lead={courseCode} className="mt-2">
            {courseTitle}
          </Display>
          <p className="mt-1 text-sm text-curve-muted">
            High-density surgical triage: Curve isolated the 3 highest-weight topics with your lowest Bayesian mastery.
          </p>
        </div>

        {/* 72-Hour Countdown Box */}
        <Panel className="border-red-500/30 bg-gradient-to-br from-red-950/30 to-[#12071a] p-4 text-center shrink-0">
          <Eyebrow className="text-red-300">Exam Countdown</Eyebrow>
          <div className="mt-1 font-mono text-3xl font-black text-white tracking-widest">
            {String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
          <p className="mt-1 text-[11px] text-red-200/70">Time to Midterm Exam</p>
        </Panel>
      </div>

      {/* Panic Relief Meter */}
      <section className="mt-8">
        <Panel className="border-purple-500/30 bg-gradient-to-r from-[#170e33] to-[#0e0921] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Eyebrow className="text-purple-300">Panic Relief Engine</Eyebrow>
              <h3 className="text-lg font-bold text-white mt-0.5">Predicted Exam Score Trajectory</h3>
              <p className="text-xs text-curve-muted mt-1">
                Complete the 3-day recovery sprint items below to raise your predicted score from 68% to 88%+.
              </p>
            </div>

            <div className="flex items-center gap-4 text-center">
              <div className="rounded-2xl bg-white/[0.04] p-3 border border-white/10">
                <span className="text-[10px] text-curve-faint uppercase font-bold">Unprepared</span>
                <div className="text-2xl font-black text-red-400">68%</div>
                <span className="text-[10px] text-red-300">Grade C</span>
              </div>
              <div className="text-purple-400 font-bold">→</div>
              <div className="rounded-2xl bg-emerald-500/10 p-3 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-300 uppercase font-bold">Current Target</span>
                <div className="text-3xl font-black text-emerald-400">{currentPredictedScore}%</div>
                <span className="text-[10px] font-bold text-emerald-300">
                  {currentPredictedScore >= 90 ? 'Grade A' : currentPredictedScore >= 80 ? 'Grade B+' : 'Grade C+'}
                </span>
              </div>
            </div>
          </div>

          {/* Meter Bar */}
          <div className="mt-5">
            <div className="flex justify-between text-xs font-bold mb-1.5">
              <span className="text-curve-muted">Sprint Progress</span>
              <span className="text-emerald-400">{completedItems.length} of {triageTopics.length} Sprint Modules Done</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/10 p-0.5 border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.max(15, (currentPredictedScore / 100) * 100)}%` }}
              />
            </div>
          </div>
        </Panel>
      </section>

      {/* 3-Day Recovery Sprint Modules */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Eyebrow>Surgical Topic Triage Queue</Eyebrow>
            <h3 className="text-xl font-bold text-white">3-Day Emergency Sprint Items</h3>
          </div>
          <span className="text-xs text-curve-faint">Ranked by exam weight & concept gap</span>
        </div>

        <div className="space-y-4">
          {triageTopics.map((item) => {
            const isCompleted = completedItems.includes(item.id);
            return (
              <Panel
                key={item.id}
                className={`transition-all ${
                  isCompleted
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : 'border-white/10 hover:border-purple-500/40'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300">
                        {item.day}
                      </span>
                      <span className="text-xs font-semibold text-amber-400">{item.weight}</span>
                      <span className="text-xs text-curve-faint">· {item.bktMastery}</span>
                    </div>

                    <h4 className="text-base font-bold text-white mt-1">{item.title}</h4>
                    <p className="text-xs text-curve-muted flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      Recommended Action: <span className="text-white font-medium">{item.action}</span> ({item.mins} mins)
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        isCompleted
                          ? 'bg-emerald-500 text-black'
                          : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isCompleted ? 'Completed' : 'Mark Completed'}
                    </button>

                    <CurveButton
                      onClick={() => navigate(`/session/${snapshot?.enrollmentId || 'demo'}`)}
                      className="!px-4 !py-2 !text-xs"
                    >
                      <Play className="h-3.5 w-3.5" /> Start
                    </CurveButton>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      {/* Socratic AI Coach Emergency Assistant */}
      <section className="mt-8">
        <Panel className="border-purple-500/20 bg-gradient-to-b from-[#110b26] to-[#0a0814] p-6 text-center">
          <Brain className="h-8 w-8 text-purple-400 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-white">Need 1-on-1 Socratic Concept Coaching?</h3>
          <p className="text-xs text-curve-muted max-w-md mx-auto mt-1">
            Curve's adaptive AI coach uses Bayesian Knowledge Tracing (BKT) to guide you through tough problem sets step-by-step without spoiling answers.
          </p>
          <div className="mt-4 flex justify-center">
            <CurveButton onClick={() => navigate(`/session/${snapshot?.enrollmentId || 'demo'}`)}>
              Launch Emergency AI Socratic Session
            </CurveButton>
          </div>
        </Panel>
      </section>
    </CurveShell>
  );
}

export default ExamEmergencySprint;
