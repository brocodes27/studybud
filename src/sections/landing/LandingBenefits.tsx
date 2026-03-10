import { BookOpen, BarChart3, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const benefits = [
  {
    icon: BookOpen,
    color: '#00D1FF',
    bg: 'bg-[#00D1FF]/10',
    border: 'border-[#00D1FF]/20',
    shadow: 'shadow-[0_8px_16px_rgba(0,209,255,0.15)]',
    title: 'Connect your plan',
    description: 'Create AI-powered study plans aligned to your goals and exam dates. No more guesswork.',
  },
  {
    icon: BarChart3,
    color: '#F472B6',
    bg: 'bg-[#F472B6]/10',
    border: 'border-[#F472B6]/20',
    shadow: 'shadow-[0_8px_16px_rgba(244,114,182,0.15)]',
    title: 'Stay organized',
    description: 'Track progress, analyse performance, and keep notes that the AI remembers. Everything in focus.',
  },
  {
    icon: MessageCircle,
    color: '#34D399',
    bg: 'bg-[#34D399]/10',
    border: 'border-[#34D399]/20',
    shadow: 'shadow-[0_8px_16px_rgba(52,211,153,0.15)]',
    title: 'Collaborate effectively',
    description: 'Use AI Study Buddy for instant help and explanations across topics. Your 24/7 tutor.',
  },
];

export function LandingBenefits() {
  return (
    <section id="benefits" className="px-6 py-32 bg-[#F8FAFF] relative overflow-hidden">
      {/* Subtle bg orbs */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#F472B6]/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#34D399]/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#34D399]/10 text-[#34D399] rounded-full font-bold text-sm mb-6 border border-[#34D399]/20"
          >
            <span>Why Elevenfolks</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#0A192F] mb-6 leading-tight">
            Everything in <br />
            <span className="text-[#F472B6]">one space.</span>
          </h2>
          <p className="text-[#64748B] text-xl font-medium">
            Keep everything in one place — from your plan to practice tests. Organize, collaborate, and learn faster.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="neo-card group"
            >
              <div className={`w-16 h-16 ${b.bg} rounded-[20px] flex items-center justify-center mb-6 border ${b.border} ${b.shadow}`}>
                <b.icon className="w-8 h-8 stroke-[2.5px]" style={{ color: b.color }} />
              </div>
              <h3 className="font-extrabold text-xl text-[#0A192F] mb-3 tracking-tight">{b.title}</h3>
              <p className="text-[#64748B] font-medium leading-relaxed">{b.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default LandingBenefits;
