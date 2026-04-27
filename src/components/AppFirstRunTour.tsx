import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, CalendarCheck, CheckCircle2, Flame, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const GLOBAL_ACTIVE_KEY = 'tour:global:v1:active';

const steps = [
  {
    title: 'Task 1: Start from today’s briefing',
    body: 'Click the highlighted Prove today button. This teaches the daily habit: begin with one high-return action.',
    success: 'Great. You started your day from the briefing instead of guessing what to study.',
    icon: CalendarCheck,
    route: '/',
    selector: '[data-app-action="briefing-prove-today"]',
  },
  {
    title: 'Task 2: Start a Prove-It session',
    body: 'Click Start Grilling. This is how study time becomes a verified mastery attempt.',
    success: 'Nice. You now know how to begin proving a weak topic.',
    icon: ShieldCheck,
    route: '/prove-it?subject=JEE%20Physics&topic=Rotational%20Dynamics',
    selector: '[data-app-action="prove-start"]',
  },
  {
    title: 'Task 3: Pick a weak branch from Mastery Tree',
    body: 'Click the highlighted unproven topic. This teaches how to choose tomorrow’s work from data.',
    success: 'Perfect. You used the tree to choose the next topic instead of studying randomly.',
    icon: Trophy,
    route: '/mastery-tree',
    selector: '[data-app-action="mastery-topic"]',
  },
  {
    title: 'Task 4: Create a squad invite',
    body: 'Click Copy squad invite. This teaches how to turn a topic into accountability with friends.',
    success: 'Squad created. Now accountability is attached to a real topic.',
    icon: Users,
    route: '/squad-prove-it',
    selector: '[data-app-action="squad-copy-invite"]',
  },
  {
    title: 'Task 5: Review your outcome path',
    body: 'Click the highlighted score path card. This teaches the final daily habit: track marks movement.',
    success: 'Excellent. You completed the full daily loop: plan, prove, choose, share, track.',
    icon: BarChart3,
    route: '/outcomes',
    selector: '[data-app-action="outcome-score-path"]',
  },
];

export function AppFirstRunTour() {
  const { user, onboardingCompleted } = useAuth() as any;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [celebrating, setCelebrating] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[index];
  const storageKey = user?.id ? `tour:app:first-day-real-flow:v1:${user.id}` : '';
  const allDone = completed.length >= steps.length;

  useEffect(() => {
    if (!user?.id || !onboardingCompleted || !storageKey) return;
    if (localStorage.getItem(storageKey)) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      // If the user already has activity in the DB, skip the tour so it
      // does not reappear after clearing browser cache/cookies.
      try {
        const { count } = await supabase
          .from('task_completions_v2')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if ((count || 0) > 0) {
          localStorage.setItem(storageKey, 'completed');
          return;
        }
      } catch {
        // fall through to default behaviour
      }
      if (!cancelled) {
        localStorage.setItem(GLOBAL_ACTIVE_KEY, '1');
        setOpen(true);
      }
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user?.id, onboardingCompleted, storageKey]);

  useEffect(() => {
    if (!open || allDone || celebrating) return;
    navigate(step.route);
  }, [open, index, allDone, celebrating]);

  useEffect(() => {
    if (!open || allDone || celebrating) return;
    const update = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      setRect(el?.getBoundingClientRect() || null);
    };
    update();
    const interval = window.setInterval(update, 400);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, index, allDone, celebrating]);

  useEffect(() => {
    if (!open || allDone || celebrating) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(step.selector)) return;
      event.preventDefault();
      event.stopPropagation();
      setCompleted((prev) => prev.includes(index) ? prev : [...prev, index]);
      setCelebrating(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [open, index, allDone, celebrating]);

  const coachPosition = useMemo(() => {
    const width = 360;
    const margin = 16;
    if (!rect) return { right: margin, bottom: margin, width };
    const canRight = rect.right + margin + width < window.innerWidth;
    const left = canRight ? rect.right + margin : Math.max(margin, Math.min(window.innerWidth - width - margin, rect.left));
    const top = Math.max(margin, Math.min(window.innerHeight - 240, rect.bottom + margin));
    return { left, top, width };
  }, [rect]);

  if (!open || !step) return null;

  const finish = () => {
    if (storageKey) localStorage.setItem(storageKey, 'completed');
    localStorage.removeItem(GLOBAL_ACTIVE_KEY);
    setOpen(false);
  };

  const continueAfterCelebration = () => {
    setCelebrating(false);
    if (index < steps.length - 1) setIndex(index + 1);
  };

  const completeCurrentStep = () => {
    setCompleted((prev) => prev.includes(index) ? prev : [...prev, index]);
    setCelebrating(true);
  };

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-none">
      {!rect && !celebrating && !allDone && (
        <div className="absolute inset-0 bg-[#0A192F]/30 pointer-events-none" />
      )}
      {rect && !celebrating && !allDone && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            border: '4px solid #00D1FF',
            boxShadow: '0 0 0 9999px rgba(10,25,47,0.55), 0 0 0 6px rgba(0,209,255,0.35), 0 0 40px rgba(0,209,255,0.95)',
            borderRadius: 18,
            animation: 'tour-pulse 1.4s ease-in-out infinite',
          }}
        />
      )}
      <style>{`@keyframes tour-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }`}</style>
      <div className={`absolute pointer-events-auto neo-card bg-white shadow-float-cyan ${allDone || celebrating ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,420px)]' : ''}`} style={allDone || celebrating ? undefined : coachPosition}>
        {allDone ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#34D399]/15 text-[#34D399] flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F472B6]/10 text-[#F472B6] text-[10px] font-extrabold uppercase tracking-widest mb-3">
              <Flame className="w-3.5 h-3.5" /> Day 1 complete
            </div>
            <h2 className="text-2xl font-extrabold text-[#0A192F]">Congratulations — you completed your first day’s first mission.</h2>
            <p className="mt-3 text-sm text-[#64748B] leading-relaxed">You now know the daily loop: briefing, prove a topic, review mastery, stay accountable, and track score movement. Come back tomorrow and repeat this loop.</p>
            <button onClick={finish} className="mt-6 w-full px-4 py-3 rounded-[14px] bg-[#0A192F] text-white text-sm font-extrabold">
              Enter my workspace
            </button>
          </div>
        ) : celebrating ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#34D399]/15 text-[#34D399] flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0A192F]">Task complete!</h2>
            <p className="mt-3 text-sm text-[#64748B] leading-relaxed">{step.success}</p>
            <button onClick={continueAfterCelebration} className="mt-6 w-full px-4 py-3 rounded-[14px] bg-[#0A192F] text-white text-sm font-extrabold flex items-center justify-center gap-2">
              {index >= steps.length - 1 ? 'See final congratulations' : 'Continue to next demo task'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-[16px] bg-[#00D1FF]/10 text-[#00D1FF] flex items-center justify-center shrink-0">
                <step.icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#00D1FF]">Interactive demo task {index + 1} of {steps.length}</div>
                <h2 className="mt-1 text-2xl font-extrabold text-[#0A192F]">{step.title}</h2>
              </div>
            </div>
            <p className="text-sm text-[#64748B] leading-relaxed">{step.body}</p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const done = completed.includes(i);
                return (
                  <div key={s.title} className={`h-12 rounded-[12px] flex items-center justify-center border-2 ${done ? 'bg-[#34D399]/10 border-[#34D399]/30 text-[#34D399]' : i === index ? 'bg-[#00D1FF]/10 border-[#00D1FF]/40 text-[#00D1FF]' : 'bg-[#F8FAF9] border-[#0A192F]/10 text-[#64748B]'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-[16px] bg-[#F8FAF9] border border-[#0A192F]/10 p-3">
              <p className="text-xs font-bold text-[#0A192F] leading-relaxed">Do it in the real app: click the highlighted element on this screen to complete the task.</p>
            </div>
            <button onClick={completeCurrentStep} className="mt-3 w-full px-4 py-2.5 rounded-[12px] bg-[#00D1FF] text-[#0A192F] text-xs font-extrabold flex items-center justify-center gap-2">
              I clicked it / continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
