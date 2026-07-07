import { Brain, BookOpen, BarChart3, Mic, MessageSquare, Zap, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const showcase = {
  icon: Brain,
  title: 'AI Study Buddy',
  description: 'Context-aware help that remembers your notes, weak topics, and chat history. Not generic — personal.',
  tag: 'Atlas',
  color: '#8B7355',
};

const features = [
  {
    icon: Mic,
    title: 'Feynman Method',
    description: 'Explain concepts aloud. AI listens, identifies gaps, and guides you to mastery.',
    tag: 'Voice',
    color: '#B8956A',
    span: 'sm:col-span-2',
  },
  {
    icon: BookOpen,
    title: 'Daily Prescriptions',
    description: 'Auto-generated nightly plans based on today\'s class and your progress.',
    tag: 'New',
    color: '#6B8E6B',
    span: '',
  },
  {
    icon: BarChart3,
    title: 'Test Analysis',
    description: 'Upload a test photo. Get weak topics, failure modes, and a correction sprint.',
    tag: 'Vision',
    color: '#7A6B8A',
    span: '',
  },
  {
    icon: MessageSquare,
    title: 'Study Groups',
    description: 'Collaborate, compete on leaderboards, and keep each other accountable.',
    tag: 'Social',
    color: '#B87B6B',
    span: '',
  },
  {
    icon: Zap,
    title: 'Gamification',
    description: 'XP, streaks, levels, and achievements that make studying addictive.',
    tag: 'Fun',
    color: '#C4A882',
    span: '',
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-24 md:py-32 px-6 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-lg mx-auto mb-16">
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-[#2D2A26]/[0.06] shadow-xs mb-5"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C4A882]" />
            <span className="text-[12px] font-bold text-[#8A8279] uppercase tracking-widest">Platform</span>
          </motion.div>
          <motion.h2
            initial={{ y: 16, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-semibold tracking-tight text-[#2D2A26] mb-4 leading-[1.05]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Everything you need to{' '}
            <span className="text-[#8B7355]">ace exams.</span>
          </motion.h2>
          <motion.p
            initial={{ y: 12, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-[#8A8279] text-lg font-medium"
          >
            From AI tutoring to mock tests — one platform, zero friction.
          </motion.p>
        </div>

        {/* Asymmetric layout: tall showcase + supporting grid */}
        <div className="grid lg:grid-cols-3 gap-5 items-stretch">
          {/* Showcase — AI Study Buddy with mock chat */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
            className="group relative lg:row-span-2"
          >
            <div
              className="absolute -inset-px rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[2px]"
              style={{ backgroundColor: showcase.color }}
            />
            <div className="relative h-full noise bg-white rounded-[24px] border border-[#2D2A26]/[0.05] p-7 hover:shadow-float-cyan hover:-translate-y-1 transition-all duration-500 overflow-hidden flex flex-col">
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-[60px] opacity-[0.06]" style={{ backgroundColor: showcase.color }} />

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                    style={{ backgroundColor: showcase.color }}
                  >
                    <showcase.icon className="w-6 h-6" />
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: `${showcase.color}14`, color: showcase.color }}
                  >
                    {showcase.tag}
                  </span>
                </div>
                <h3
                  className="font-semibold text-2xl text-[#2D2A26] mb-2 tracking-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {showcase.title}
                </h3>
                <p className="text-[#8A8279] font-medium text-[14px] leading-relaxed mb-6">{showcase.description}</p>

                {/* Mock chat visual */}
                <div className="mt-auto space-y-2.5">
                  <div className="ml-auto max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[#F5F0E8] text-[12px] font-medium text-[#2D2A26]">
                    I keep messing up rotational dynamics problems…
                  </div>
                  <div className="mr-auto max-w-[90%] px-4 py-2.5 rounded-2xl rounded-bl-md text-white text-[12px] font-medium shadow-lg" style={{ backgroundColor: showcase.color }}>
                    Last week you struggled with torque direction. Let's start there — what happens to angular momentum when…
                  </div>
                  <div className="flex items-center gap-1.5 pl-1 pt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]/40 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]/40 animate-pulse [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]/40 animate-pulse [animation-delay:300ms]" />
                    <span className="text-[10px] font-bold text-[#8A8279] uppercase tracking-wider ml-1.5">Atlas remembers you</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Supporting cards */}
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className={`group relative ${f.span}`}
              >
                <div
                  className="absolute -inset-px rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[2px]"
                  style={{ backgroundColor: f.color }}
                />

                <div className="relative h-full bg-white rounded-[24px] border border-[#2D2A26]/[0.05] p-6 hover:shadow-[0_20px_60px_rgba(45,42,38,0.08)] hover:-translate-y-1 transition-all duration-500 overflow-hidden flex flex-col">
                  <div
                    className="absolute top-0 left-6 right-6 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ backgroundColor: f.color }}
                  />
                  <div
                    className="absolute -top-10 -right-10 w-32 h-32 opacity-[0.03] rounded-full blur-[40px] group-hover:opacity-[0.08] transition-opacity"
                    style={{ backgroundColor: f.color }}
                  />

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg"
                        style={{ backgroundColor: f.color }}
                      >
                        <f.icon className="w-5 h-5" />
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: `${f.color}14`, color: f.color }}
                      >
                        {f.tag}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg text-[#2D2A26] mb-1.5 tracking-tight">{f.title}</h3>
                    <p className="text-[#8A8279] font-medium text-[13px] leading-relaxed flex-1">{f.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingFeatures;
