import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, CalendarCheck, CheckCircle2, Flame, ShieldCheck, Target, Trophy, Users } from 'lucide-react';

const steps = [
  {
    title: 'Start every morning with Daily Briefing',
    outcome: 'Know exactly what to study today instead of guessing.',
    action: 'Open Daily Briefing and complete the 2-3 prescribed tasks.',
    route: '/',
    icon: CalendarCheck,
    color: 'bg-[#00D1FF]',
    marks: '+3 clarity points',
  },
  {
    title: 'Prove one weak JEE topic',
    outcome: 'Convert practice into verified understanding.',
    action: 'Use Prove-It for one high-impact topic like Rotational Dynamics or Electrostatics.',
    route: '/prove-it?subject=JEE%20Physics&topic=Rotational%20Dynamics',
    icon: ShieldCheck,
    color: 'bg-[#34D399]',
    marks: '+5 mastery points',
  },
  {
    title: 'Review your Mastery Tree',
    outcome: 'See which branches are strong, weak, or unproven.',
    action: 'Use the tree to pick tomorrow’s highest-return topic.',
    route: '/mastery-tree',
    icon: Trophy,
    color: 'bg-[#F472B6]',
    marks: '+2 strategy points',
  },
  {
    title: 'Join a Squad streak',
    outcome: 'Stay accountable with friends doing the same topic.',
    action: 'Create a squad invite and ask friends to prove the same weekly topic.',
    route: '/squad-prove-it',
    icon: Users,
    color: 'bg-[#0A192F]',
    marks: '+4 consistency points',
  },
  {
    title: 'Track marks, not minutes',
    outcome: 'Measure score movement from actual mastery receipts.',
    action: 'Check Outcomes to see estimated score gain and next topics to prove.',
    route: '/outcomes',
    icon: BarChart3,
    color: 'bg-[#00D1FF]',
    marks: '+6 outcome points',
  },
];

export function InteractiveDemo() {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const activeStep = steps[active];
  const score = useMemo(() => completed.length * 20, [completed.length]);

  const completeStep = () => {
    setCompleted((prev) => prev.includes(active) ? prev : [...prev, active]);
    setActive((prev) => Math.min(steps.length - 1, prev + 1));
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="neo-card bg-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-72 h-72 bg-[#00D1FF]/10 rounded-full blur-3xl" />
          <div className="relative z-10 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A192F]/5 text-[#0A192F] text-xs font-extrabold mb-4">
                <Flame className="w-4 h-4 text-[#F472B6]" /> Daily marks improvement simulator
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-[#0A192F] tracking-tight leading-tight">Learn the full ElevenFolks workflow in 5 minutes.</h1>
              <p className="mt-4 text-[#64748B] font-medium leading-relaxed max-w-2xl">This interactive demo shows how a JEE student should use the app every day: get a plan, prove mastery, fix weak branches, study with a squad, and track marks growth.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => navigate('/prove-it?subject=JEE%20Physics&topic=Rotational%20Dynamics')} className="px-5 py-3 rounded-[14px] bg-[#0A192F] text-white text-sm font-bold flex items-center gap-2">
                  Try Prove-It now <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => navigate('/')} className="px-5 py-3 rounded-[14px] bg-white border-2 border-[#0A192F]/10 text-[#0A192F] text-sm font-bold">Go to daily dashboard</button>
              </div>
            </div>
            <div className="rounded-[28px] bg-[#0A192F] p-6 text-white shadow-float-cyan">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">Readiness score</span>
                <Target className="w-5 h-5 text-[#00D1FF]" />
              </div>
              <div className="text-6xl font-extrabold">{score}%</div>
              <div className="mt-4 h-3 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-[#00D1FF] rounded-full transition-all" style={{ width: `${score}%` }} />
              </div>
              <p className="mt-4 text-sm text-white/70">Complete each workflow card to understand how daily effort turns into marks improvement.</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="neo-card bg-white space-y-3">
            <h2 className="font-extrabold text-[#0A192F] mb-4">Daily workflow</h2>
            {steps.map((step, index) => {
              const Icon = step.icon;
              const done = completed.includes(index);
              return (
                <button key={step.title} onClick={() => setActive(index)} className={`w-full text-left p-4 rounded-[18px] border-2 transition-all ${active === index ? 'border-[#00D1FF] bg-[#00D1FF]/5' : 'border-[#0A192F]/10 bg-white hover:bg-[#F8FAF9]'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-[14px] ${step.color} text-white flex items-center justify-center`}><Icon className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold text-[#0A192F]">Day step {index + 1}: {step.title}</div>
                      <div className="text-xs text-[#64748B] mt-1">{step.marks}</div>
                    </div>
                    {done && <CheckCircle2 className="w-5 h-5 text-[#34D399]" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="neo-card bg-white">
            <div className={`w-14 h-14 rounded-[18px] ${activeStep.color} text-white flex items-center justify-center mb-5`}>
              <activeStep.icon className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0A192F]">{activeStep.title}</h2>
            <div className="mt-5 grid sm:grid-cols-2 gap-4">
              <div className="rounded-[18px] bg-[#F8FAF9] border-2 border-[#0A192F]/10 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-[#64748B] mb-2">Why it improves marks</div>
                <p className="text-sm font-medium text-[#0A192F] leading-relaxed">{activeStep.outcome}</p>
              </div>
              <div className="rounded-[18px] bg-[#F8FAF9] border-2 border-[#0A192F]/10 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-[#64748B] mb-2">What to do daily</div>
                <p className="text-sm font-medium text-[#0A192F] leading-relaxed">{activeStep.action}</p>
              </div>
            </div>
            <div className="mt-6 rounded-[18px] bg-[#0A192F] text-white p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2">Simple rule</div>
              <p className="text-sm leading-relaxed">If you complete briefing + one Prove-It + one review every day, you build a verified chain of mastery. That is what moves marks, not just time spent.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={completeStep} className="px-5 py-3 rounded-[14px] bg-[#34D399] text-[#0A192F] text-sm font-extrabold">I understand this step</button>
              <button onClick={() => navigate(activeStep.route)} className="px-5 py-3 rounded-[14px] bg-[#0A192F] text-white text-sm font-bold flex items-center gap-2">Open feature <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <div className="neo-card bg-white">
          <h2 className="text-xl font-extrabold text-[#0A192F] mb-4">Your ideal daily routine</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <Routine time="10 min" title="Briefing" detail="See today’s tasks and weak topic." />
            <Routine time="25 min" title="Deep study" detail="Use Atlas or notes to learn the concept." />
            <Routine time="15 min" title="Prove-It" detail="Answer Socratic questions until you earn a receipt." />
            <Routine time="5 min" title="Review outcome" detail="Check mastery tree, squad streak, and score movement." />
          </div>
        </div>
      </div>
    </div>
  );
}

function Routine({ time, title, detail }: { time: string; title: string; detail: string }) {
  return (
    <div className="rounded-[18px] bg-[#F8FAF9] border-2 border-[#0A192F]/10 p-4">
      <div className="text-2xl font-extrabold text-[#00D1FF]">{time}</div>
      <div className="mt-2 font-extrabold text-[#0A192F]">{title}</div>
      <p className="mt-1 text-sm text-[#64748B]">{detail}</p>
    </div>
  );
}
