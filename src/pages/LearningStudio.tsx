import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Check, ChevronRight, CirclePlay, Lightbulb, LockKeyhole, MessageCircle, Sparkles, Target, Timer, Trophy, WandSparkles } from 'lucide-react';

const pathways = [
  { title: 'Concept lab', subtitle: 'Understand before you memorise', icon: BrainCircuit, tone: 'bg-[#e3f3f7] text-[#30768c]', action: 'Explain ray optics with a real-world example, then check my understanding.' },
  { title: 'Guided practice', subtitle: 'Build confidence step by step', icon: Target, tone: 'bg-[#e7e9fc] text-[#5968b8]', action: 'Create a guided practice set for my current Physics weak areas.' },
  { title: 'Recall studio', subtitle: 'Make it stick with active recall', icon: Lightbulb, tone: 'bg-[#fff0c8] text-[#b97814]', action: 'Quiz me with active recall questions from my recent study topics.' },
];

const lessons = [
  { subject: 'Physics', title: 'Ray optics: image formation', meta: '12 min lesson · 6 checkpoints', color: 'bg-[#e7e9fc]', emoji: '⚛' },
  { subject: 'Mathematics', title: 'Integration by parts', meta: '18 min practice · adaptive', color: 'bg-[#e3f3f7]', emoji: '∑' },
  { subject: 'Chemistry', title: 'Chemical equilibrium', meta: '10 min recall · 12 cards', color: 'bg-[#fde5f4]', emoji: '🧪' },
];

export default function LearningStudio() {
  const navigate = useNavigate();
  const [activePathway, setActivePathway] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);

  const startWithAtlas = (message: string) => {
    window.dispatchEvent(new CustomEvent('trigger-atlas-chat', { detail: { message, clear: false } }));
    navigate('/atlas');
  };

  const toggleSave = (title: string) => setSaved((items) => items.includes(title) ? items.filter((item) => item !== title) : [...items, title]);

  return (
    <div className="min-h-screen bg-[#f4f8fc] px-4 py-6 sm:px-7 lg:px-10 lg:py-9 [font-family:Manrope,Inter,sans-serif]">
      <div className="mx-auto max-w-[1350px]">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#71909b]">Learning studio</p>
            <h1 className="!mt-1 !text-3xl !font-extrabold !text-[#1d3b48]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>Learn in the way your brain needs.</h1>
            <p className="mt-2 text-sm font-semibold text-[#64818c]">Short lessons, useful practice, and a tutor that knows when to give a clue.</p>
          </div>
          <Link to="/" className="rounded-xl border border-[#dce9ed] bg-white px-4 py-2.5 text-xs font-extrabold text-[#53727e] shadow-sm hover:bg-[#f8fcfc]">Back to today</Link>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {pathways.map((pathway, index) => {
            const Icon = pathway.icon;
            const active = index === activePathway;
            return <button key={pathway.title} onClick={() => setActivePathway(index)} className={`rounded-[25px] p-5 text-left transition-all ${pathway.tone} ${active ? 'ring-2 ring-[#367d92] ring-offset-2' : 'hover:-translate-y-0.5'}`}>
              <span className="mb-9 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/75 shadow-sm"><Icon className="h-5 w-5" /></span>
              <span className="block text-base font-extrabold">{pathway.title}</span>
              <span className="mt-1 block text-xs font-bold opacity-75">{pathway.subtitle}</span>
              <span className="mt-5 inline-flex items-center gap-1 text-[11px] font-extrabold">{active ? 'Selected path' : 'Choose this path'} <ChevronRight className="h-3.5 w-3.5" /></span>
            </button>;
          })}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[30px] bg-white p-6 shadow-[0_12px_32px_rgba(37,75,89,.06)] ring-1 ring-[#e0ebef] sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-[#72909b]">Continue learning</p><h2 className="!mt-1 !text-2xl !font-extrabold !text-[#264552]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>{pathways[activePathway].title} for today</h2></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f7f8] text-[#4e93a6]"><Sparkles className="h-5 w-5" /></span></div>
            <div className="mt-6 rounded-[24px] bg-[#eef9fb] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d9edf3] text-2xl">⚛</span><div><p className="text-sm font-extrabold text-[#315563]">Ray optics: image formation</p><p className="mt-1 text-[11px] font-bold text-[#6e909b]">A focused 25-minute learning loop</p></div></div><span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold text-[#418298]">Ready now</span></div>
              <div className="mt-5 h-2 rounded-full bg-white/80"><div className="h-full w-[38%] rounded-full bg-[#61aabd]" /></div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-[#6e909b]"><span>3 of 8 ideas explored</span><span>38%</span></div>
              <button onClick={() => startWithAtlas(pathways[activePathway].action)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2e6c83] px-4 py-3 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(46,108,131,.2)] hover:-translate-y-0.5"><CirclePlay className="h-4 w-4" /> Continue with Nia</button>
            </div>
            <div className="mt-6 flex flex-wrap gap-3"><FeatureChip icon={<Timer className="h-3.5 w-3.5" />} text="Paced for 25 min" /><FeatureChip icon={<MessageCircle className="h-3.5 w-3.5" />} text="Ask at any point" /><FeatureChip icon={<Check className="h-3.5 w-3.5" />} text="Checks understanding" /></div>
          </div>

          <div className="relative overflow-hidden rounded-[30px] bg-[#fff1c8] p-6"><div className="absolute -right-16 -top-14 h-48 w-48 rounded-full bg-white/40" /><div className="relative"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#c4861b] shadow-sm"><WandSparkles className="h-5 w-5" /></span><p className="mt-6 text-[11px] font-extrabold uppercase tracking-[.13em] text-[#a8731b]">A better kind of help</p><h2 className="!mt-2 !text-2xl !font-extrabold !leading-tight !text-[#4b391b]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>Nia teaches with questions, not shortcuts.</h2><p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-[#80683b]">She notices the misconception behind an answer and gives the smallest helpful nudge.</p><button onClick={() => startWithAtlas('I am stuck. Please help me understand my mistake without giving me the answer.')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-[#855f1c] shadow-sm">Try a guided hint <ArrowRight className="h-3.5 w-3.5" /></button></div></div>
        </section>

        <section className="mt-6 rounded-[30px] bg-white p-6 shadow-[0_12px_32px_rgba(37,75,89,.06)] ring-1 ring-[#e0ebef] sm:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-[#72909b]">Made for your next step</p><h2 className="!mt-1 !text-xl !font-extrabold !text-[#264552]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>Pick up where you left off</h2></div><Link to="/curriculum" className="text-xs font-extrabold text-[#3b7f92] hover:text-[#24576a]">Browse curriculum</Link></div>
          <div className="grid gap-3 md:grid-cols-3">{lessons.map((lesson) => <div key={lesson.title} className="rounded-2xl border border-[#e5eef1] p-4"><div className={`mb-6 flex h-10 w-10 items-center justify-center rounded-xl text-xl ${lesson.color}`}>{lesson.emoji}</div><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#78939d]">{lesson.subject}</p><h3 className="!mt-1 !text-sm !font-extrabold !text-[#31515c]" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>{lesson.title}</h3><p className="mt-2 text-[11px] font-bold text-[#8299a1]">{lesson.meta}</p><div className="mt-5 flex items-center justify-between"><button onClick={() => startWithAtlas(`Help me learn ${lesson.title}.`)} className="text-[11px] font-extrabold text-[#347b90]">Open lesson</button><button onClick={() => toggleSave(lesson.title)} aria-label={`Save ${lesson.title}`} className={`rounded-lg p-1.5 ${saved.includes(lesson.title) ? 'bg-[#e6f4d9] text-[#60964a]' : 'bg-[#f4f8f9] text-[#91a7af]'}`}>{saved.includes(lesson.title) ? <Check className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}</button></div></div>)}</div>
        </section>
        <section className="mt-6 flex flex-col gap-4 rounded-[26px] bg-[#e9e9ff] px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#6672bd] shadow-sm"><Trophy className="h-5 w-5" /></span><div><p className="text-sm font-extrabold text-[#465184]">Want to prove what you know?</p><p className="text-xs font-bold text-[#6f79a4]">Try a Socratic mastery challenge—your understanding, not just your score.</p></div></div><Link to="/prove-it" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5e6db9] px-4 py-3 text-xs font-extrabold text-white">Start mastery challenge <ArrowRight className="h-3.5 w-3.5" /></Link></section>
      </div>
    </div>
  );
}

function FeatureChip({ icon, text }: { icon: React.ReactNode; text: string }) { return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f8f9] px-3 py-2 text-[10px] font-extrabold text-[#5b7a85]">{icon}{text}</span>; }
