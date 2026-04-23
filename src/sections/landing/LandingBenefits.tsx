import { motion } from 'framer-motion';
import { Calendar, BrainCircuit, Target, ArrowRight } from 'lucide-react';

const steps = [
  {
    icon: Calendar,
    title: 'Teacher logs class',
    description: 'What was taught, homework assigned, topics covered — all captured in one place.',
    color: '#8B7355',
    bgGlow: 'bg-[#8B7355]/[0.08]',
  },
  {
    icon: BrainCircuit,
    title: 'AI builds your plan',
    description: 'Ranjan Sir reads your class sessions, test history, and behavioral profile to generate tonight\'s prescription.',
    color: '#8B7355',
    bgGlow: 'bg-[#8B7355]/[0.08]',
  },
  {
    icon: Target,
    title: 'You just study',
    description: 'Open your daily briefing. One prioritized task. Implementation intentions. No decision fatigue.',
    color: '#8B7355',
    bgGlow: 'bg-[#8B7355]/[0.08]',
  },
];

export function LandingBenefits() {
  return (
    <section id="benefits" className="py-24 md:py-32 px-6 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-lg mx-auto mb-16">
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-[#2D2A26]/[0.06] shadow-xs mb-5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]" />
            <span className="text-[12px] font-bold text-[#8A8279] uppercase tracking-widest">How it works</span>
          </motion.div>
          <motion.h2
            initial={{ y: 16, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-semibold tracking-tight text-[#2D2A26] mb-4 leading-[1.05]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            From classroom to{' '}
            <span className="text-[#8B7355]">completion.</span>
          </motion.h2>
          <motion.p
            initial={{ y: 12, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-[#8A8279] text-lg font-medium"
          >
            Three layers working together so you never study blind again.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: i * 0.15, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="group relative"
            >
              <div className="absolute -inset-px rounded-[24px] bg-[#8B7355] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />

              <div className="relative bg-white rounded-[24px] border border-[#2D2A26]/[0.05] p-7 hover:shadow-[0_20px_60px_rgba(45,42,38,0.08)] transition-all duration-500 h-full overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 ${step.bgGlow} rounded-full blur-[50px] opacity-60`} />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-[#8B7355] flex items-center justify-center shadow-lg">
                      <step.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[24px] font-semibold text-[#2D2A26]/[0.06]">0{i + 1}</span>
                  </div>

                  <h3 className="font-semibold text-xl text-[#2D2A26] mb-2.5 tracking-tight">{step.title}</h3>
                  <p className="text-[#8A8279] font-medium leading-relaxed text-[14px] mb-6">{step.description}</p>

                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#2D2A26]/40 group-hover:text-[#8B7355] transition-colors">
                    <span>Learn more</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>

              {i < 2 && (
                <div className="hidden md:flex absolute top-10 -right-4 z-20 items-center justify-center w-8 h-8 rounded-full bg-white border border-[#2D2A26]/[0.06] shadow-sm">
                  <ArrowRight className="w-3.5 h-3.5 text-[#8A8279]" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default LandingBenefits;
