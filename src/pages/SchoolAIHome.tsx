import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  GraduationCap,
  Leaf,
  LineChart,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Sparkles,
  Target,
  Trophy,
  WandSparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type LearningTask = {
  title: string;
  subject: string;
  duration: string;
  tone: string;
  complete: boolean;
};

const subjects = [
  { name: 'Physics', icon: '⚛', tone: 'bg-[#e8eeff] text-[#5663b5]', note: '2 topics ready' },
  { name: 'Mathematics', icon: '∑', tone: 'bg-[#e1f5fa] text-[#23778e]', note: '1 practice set' },
  { name: 'Chemistry', icon: '🧪', tone: 'bg-[#fce8f5] text-[#ae4b94]', note: 'Revision due' },
  { name: 'English', icon: '✦', tone: 'bg-[#ebf8df] text-[#54833e]', note: 'Read 20 min' },
];

const initialTasks: LearningTask[] = [
  { title: 'Revise Ray Optics', subject: 'Physics', duration: '25 min', tone: 'bg-[#e8eeff]', complete: false },
  { title: 'Solve 10 integration questions', subject: 'Mathematics', duration: '35 min', tone: 'bg-[#e1f5fa]', complete: false },
  { title: 'Make a formula recall card', subject: 'Physics', duration: '10 min', tone: 'bg-[#fff2ca]', complete: true },
];

const weeklyActivity = [44, 57, 48, 70, 63, 82, 76, 95, 64, 88, 96, 72, 84, 98, 78, 68, 91, 100, 70, 87, 94, 76, 66, 90];

export default function SchoolAIHome() {
  const { fullName } = useAuth() as { fullName?: string };
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(initialTasks);
  const [activeSubject, setActiveSubject] = useState('Physics');
  const [chatOpen, setChatOpen] = useState(false);
  const [streak, setStreak] = useState(12);
  const [showCelebration, setShowCelebration] = useState(false);

  const firstName = (fullName || 'Aarav').trim().split(/\s+/)[0];
  const initials = (fullName || 'Aarav Sharma')
    .split(/\s+/)
    .map((part: string) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const completedCount = tasks.filter((task) => task.complete).length;
  const progress = Math.round((completedCount / tasks.length) * 100);
  const day = new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(new Date());

  const learningMessage = useMemo(() => {
    if (progress === 100) return 'Brilliant work. Your next best step is a 10-minute recall round.';
    if (progress >= 66) return 'You are nearly there. A focused final task will lock in today’s learning.';
    return 'Your plan is paced for deep work, not busy work. Start with the one that matters most.';
  }, [progress]);

  const toggleTask = (index: number) => {
    const completedNow = !tasks[index].complete;
    setTasks((current) => current.map((task, taskIndex) => taskIndex === index ? { ...task, complete: !task.complete } : task));
    if (completedNow) {
      setStreak((current) => current + (completedCount === 0 ? 1 : 0));
      setShowCelebration(true);
      window.setTimeout(() => setShowCelebration(false), 2200);
    }
  };

  const askTutor = (message: string) => {
    window.dispatchEvent(new CustomEvent('trigger-atlas-chat', { detail: { message, clear: false } }));
    navigate('/atlas');
  };

  return (
    <div className="min-h-screen bg-[#f4f8fc] px-4 py-5 sm:px-6 lg:px-9 lg:py-8 [font-family:Manrope,Inter,sans-serif]">
      <div className="mx-auto max-w-[1480px]">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2e6c83] text-lg font-black tracking-[-0.12em] text-white shadow-[0_8px_22px_rgba(46,108,131,0.25)]">E11</div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#6e8595]">Elevenfolks learning OS</p>
              <p className="text-sm font-bold text-[#213642]">Your thoughtful study space</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/daily" className="hidden items-center gap-2 rounded-xl border border-[#dce8ee] bg-white px-3.5 py-2.5 text-xs font-extrabold text-[#496573] shadow-sm transition-transform hover:-translate-y-0.5 sm:flex">
              <CalendarDays className="h-4 w-4" /> Daily briefing
            </Link>
            <button aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce8ee] bg-white text-[#476170] shadow-sm hover:bg-[#f9fcfd]">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ef6d70] ring-2 ring-white" />
            </button>
            <Link to="/profile" className="flex items-center gap-2 rounded-2xl bg-white py-1.5 pl-1.5 pr-3 shadow-sm ring-1 ring-[#dce8ee]">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f6d6b6] text-[11px] font-black text-[#7b4a2c]">{initials}</span>
              <span className="hidden text-xs font-extrabold text-[#2d4755] sm:block">{firstName}</span>
            </Link>
          </div>
        </header>

        <main className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 space-y-6">
            <section className="relative overflow-hidden rounded-[30px] bg-[#dff3f8] px-6 py-7 sm:px-9 sm:py-8">
              <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#c9e9f0]" />
              <div className="absolute bottom-0 right-24 h-24 w-24 rounded-full border-[18px] border-white/35" />
              <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#39748a]">
                    <Sparkles className="h-3.5 w-3.5" /> {day} momentum
                  </div>
                  <h1 className="!mb-3 !text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.04] !text-[#173442]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>
                    Good morning, {firstName}.<br />Let’s make today <span className="text-[#2e778b]">count.</span>
                  </h1>
                  <p className="max-w-xl text-sm font-semibold leading-6 text-[#527486] sm:text-base">{learningMessage}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-white/80 p-3.5 shadow-[0_10px_24px_rgba(59,115,132,0.1)] backdrop-blur-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0c9] text-[#cc8a16]"><Flame className="h-5 w-5 fill-current" /></div>
                  <div>
                    <p className="text-xl font-black leading-none text-[#243f4d]">{streak}</p>
                    <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-[#6c8997]">day streak</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Today’s focus" value={`${completedCount}/${tasks.length}`} detail="learning blocks" icon={<Target className="h-5 w-5" />} tone="bg-[#dfe4fa] text-[#4d61ad]" />
              <MetricCard label="Mastery pulse" value="78%" detail="up 6% this week" icon={<LineChart className="h-5 w-5" />} tone="bg-[#f6dff4] text-[#a14793]" />
              <MetricCard label="Deep work" value="1h 20m" detail="of 2h daily goal" icon={<Clock3 className="h-5 w-5" />} tone="bg-[#e5f4d8] text-[#5f8b43]" />
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
              <div className="rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(33,70,85,0.06)] ring-1 ring-[#e3edf1] sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#6f8a98]">Your adaptive plan</p>
                    <h2 className="!mt-1 !text-xl !font-extrabold !text-[#1e3947]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>The right next steps</h2>
                  </div>
                  <span className="rounded-full bg-[#edf7e7] px-3 py-1.5 text-[11px] font-extrabold text-[#568238]">{progress}% done</span>
                </div>

                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <button key={task.title} onClick={() => toggleTask(index)} className="group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-[#f7fbfc]">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${task.tone} text-[#355b6b]`}>
                        {task.subject === 'Mathematics' ? <span className="text-lg font-black">∑</span> : task.subject === 'Physics' ? <span className="text-lg">⚛</span> : <BookOpen className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-extrabold ${task.complete ? 'text-[#91a6ae] line-through' : 'text-[#284553]'}`}>{task.title}</span>
                        <span className="mt-0.5 block text-[11px] font-bold text-[#7c969f]">{task.subject} · {task.duration}</span>
                      </span>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${task.complete ? 'border-[#67aa66] bg-[#67aa66] text-white' : 'border-[#c7d9df] bg-white group-hover:border-[#69aabc]'}`}>
                        {task.complete && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf3f5]"><div className="h-full rounded-full bg-[#5eafc2] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button onClick={() => askTutor('Help me begin my next study task with a 25 minute focus plan.')} className="inline-flex items-center gap-2 text-xs font-extrabold text-[#34758a] hover:text-[#20576a]"><Play className="h-3.5 w-3.5 fill-current" /> Start a focus sprint</button>
                  <Link to="/daily" className="inline-flex items-center gap-1 text-xs font-extrabold text-[#6a8792] hover:text-[#284a58]">See full plan <ChevronRight className="h-3.5 w-3.5" /></Link>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[28px] bg-[#fff3c8] p-6 shadow-[0_10px_30px_rgba(136,108,38,0.08)]">
                <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/45" />
                <div className="absolute bottom-5 right-6 flex h-28 w-28 items-center justify-center rounded-[32px] bg-[#d7ecf6] text-5xl shadow-[0_16px_22px_rgba(78,132,153,0.17)]">🧠</div>
                <div className="relative max-w-[62%]">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#d48a15] shadow-sm"><WandSparkles className="h-5 w-5" /></div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#a96b16]">Meet Nia, your tutor</p>
                  <h2 className="!mt-2 !text-2xl !font-extrabold !leading-tight !text-[#46351d]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>Stuck? Let’s think it through.</h2>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#7b653b]">Get clues and practice, never just the answer.</p>
                  <button onClick={() => setChatOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2e6c83] px-4 py-2.5 text-xs font-extrabold text-white shadow-[0_7px_16px_rgba(46,108,131,0.22)] transition-transform hover:-translate-y-0.5">Ask Nia <ArrowRight className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(33,70,85,0.06)] ring-1 ring-[#e3edf1] sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div><p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#6f8a98]">Learn your way</p><h2 className="!mt-1 !text-xl !font-extrabold !text-[#1e3947]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>Choose a subject</h2></div>
                <button className="rounded-xl border border-[#dce9ed] p-2 text-[#72909b] hover:bg-[#f7fbfc]" aria-label="Add subject"><Plus className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {subjects.map((subject) => (
                  <button key={subject.name} onClick={() => setActiveSubject(subject.name)} className={`rounded-2xl p-4 text-left transition-all ${subject.tone} ${activeSubject === subject.name ? 'ring-2 ring-[#2e6c83] ring-offset-2' : 'hover:-translate-y-0.5'}`}>
                    <span className="mb-6 flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-xl shadow-sm">{subject.icon}</span>
                    <span className="block text-sm font-extrabold">{subject.name}</span>
                    <span className="mt-1 block text-[10px] font-bold opacity-75">{subject.note}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f3f8fa] px-4 py-3 text-xs font-bold text-[#52717d]">
                <span>{activeSubject} is selected for your next session.</span>
                <button onClick={() => askTutor(`Create a guided ${activeSubject} practice session for me.`)} className="inline-flex items-center gap-1.5 font-extrabold text-[#2d7287]">Open practice <ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
            </section>
          </section>

          <aside className="space-y-6">
            <section className="overflow-hidden rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(33,70,85,0.06)] ring-1 ring-[#e3edf1]">
              <div className="mb-5 flex items-center justify-between"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#6f8a98]">Learning rhythm</p><h2 className="!mt-1 !text-lg !font-extrabold !text-[#1e3947]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>Your focus this week</h2></div><MoreHorizontal className="h-5 w-5 text-[#90a6ae]" /></div>
              <div className="flex h-28 items-end gap-1.5 border-b border-[#e5eef1] pb-2">
                {weeklyActivity.map((height, index) => <span key={index} className={`min-w-0 flex-1 rounded-t-full ${index > 17 ? 'bg-[#4c9db2]' : 'bg-[#c6e3eb]'}`} style={{ height: `${height}%` }} />)}
              </div>
              <div className="mt-3 flex justify-between text-[10px] font-bold text-[#8ba0a8]"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Today</span></div>
              <div className="mt-5 flex gap-3 rounded-2xl bg-[#edf8e8] p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#65a14e]"><Leaf className="h-4 w-4" /></div><p className="text-xs font-bold leading-5 text-[#527540]">You focus best between <strong>6:30–8:00 PM</strong>. Nia protected that time for you.</p></div>
            </section>

            <section className="rounded-[28px] bg-[#e9eaff] p-5">
              <div className="mb-4 flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#6372bf] shadow-sm"><GraduationCap className="h-5 w-5" /></span><span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-extrabold text-[#6372bf]">Class update</span></div>
              <h2 className="!text-lg !font-extrabold !leading-snug !text-[#313d74]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>Your teacher added a worksheet</h2>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#6670a3]">Integration by Parts · due tomorrow, 8:00 AM</p>
              <Link to="/my-classes" className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#4e5eaf] hover:text-[#33448b]">Open classroom <ChevronRight className="h-3.5 w-3.5" /></Link>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(33,70,85,0.06)] ring-1 ring-[#e3edf1]">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#6f8a98]">Wins to keep</p><h2 className="!mt-1 !text-lg !font-extrabold !text-[#1e3947]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>Growing stronger</h2></div><Trophy className="h-5 w-5 text-[#e5a92c]" /></div>
              <Achievement icon={<CheckCircle2 className="h-4 w-4" />} name="Recall builder" detail="3 formula cards reviewed" tone="bg-[#e5f4d8] text-[#638c45]" />
              <Achievement icon={<BrainCircuit className="h-4 w-4" />} name="Curious thinker" detail="Asked a great why-question" tone="bg-[#e1f5fa] text-[#337e96]" />
              <Link to="/mastery-tree" className="mt-4 flex items-center justify-between rounded-xl bg-[#f6f9fa] px-3 py-2.5 text-xs font-extrabold text-[#57737e] hover:bg-[#eef5f6]"><span>See your mastery map</span><ChevronRight className="h-4 w-4" /></Link>
            </section>
          </aside>
        </main>
      </div>

      {showCelebration && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#254b59] px-5 py-3 text-xs font-extrabold text-white shadow-2xl"><Sparkles className="h-4 w-4 text-[#ffe28a]" /> Nice work — progress saved</div>}

      {chatOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#18343d]/25 p-4 backdrop-blur-[2px] sm:items-center">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl ring-1 ring-[#dce9ed]">
            <div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff1c7] text-xl">🧠</span><div><h2 className="!text-lg !font-extrabold !text-[#294653]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>Hi, I’m Nia</h2><p className="text-xs font-bold text-[#73909b]">Your calm study co-pilot</p></div></div><button onClick={() => setChatOpen(false)} className="rounded-xl p-2 text-[#78939d] hover:bg-[#f2f7f8]"><X className="h-4 w-4" /></button></div>
            <div className="mt-6 rounded-2xl bg-[#f3f9fa] p-4 text-sm font-semibold leading-6 text-[#42636f]">What feels hardest right now? I’ll help you break it into one useful next move.</div>
            <div className="mt-4 grid gap-2">
              {['Explain a Physics idea with a real-world example', 'Quiz me on my weak areas', 'Plan a gentle 25-minute study sprint'].map((prompt) => <button key={prompt} onClick={() => askTutor(prompt)} className="flex items-center justify-between rounded-xl border border-[#dce9ed] px-4 py-3 text-left text-xs font-extrabold text-[#466673] transition-colors hover:border-[#76afbf] hover:bg-[#f8fcfc]"><span>{prompt}</span><ArrowRight className="h-3.5 w-3.5 text-[#4e9bb0]" /></button>)}
            </div>
            <button onClick={() => askTutor('I need help studying today.')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2e6c83] py-3 text-xs font-extrabold text-white"><MessageCircle className="h-4 w-4" /> Open full conversation</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: React.ReactNode; tone: string }) {
  return <div className={`rounded-[22px] p-4 ${tone}`}><div className="mb-5 flex items-center justify-between"><span className="text-[11px] font-extrabold uppercase tracking-[0.11em] opacity-80">{label}</span><span className="rounded-xl bg-white/65 p-2 shadow-sm">{icon}</span></div><p className="text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-[11px] font-bold opacity-75">{detail}</p></div>;
}

function Achievement({ icon, name, detail, tone }: { icon: React.ReactNode; name: string; detail: string; tone: string }) {
  return <div className="flex items-center gap-3 border-b border-[#edf2f3] py-3 last:border-0 last:pb-0"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</span><span><span className="block text-xs font-extrabold text-[#35515c]">{name}</span><span className="block text-[10px] font-bold text-[#8ba0a8]">{detail}</span></span></div>;
}
