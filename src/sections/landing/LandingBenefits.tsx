import { BookOpen, BarChart3, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingBenefits() {
  return (
    <section id="benefits" className="px-6 py-32 bg-slate-950 relative border-t-8 border-white/10 overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.span
            initial={{ rotate: -1 }}
            whileInView={{ rotate: 1 }}
            className="sticker bg-neo-accent border border-white/10 mb-4"
          >
            BENEFITS
          </motion.span>
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-slate-100 mt-6 leading-none">
            EVERYTHING IN <br />
            <span className="text-neo-muted" style={{ WebkitTextStroke: '2px black' }}>ONE SPACE</span>
          </h2>
          <p className="text-slate-100/70 mt-6 text-xl font-bold max-w-2xl mx-auto">
            Keep everything in one place, from your plan to practice tests.
            With <span className="text-slate-100 underline decoration-neo-accent decoration-4">ElevenFolks</span>, organize, collaborate, and learn faster.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10 mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="neo-card bg-slate-800 group"
          >
            <div className="w-16 h-16 bg-neo-accent border border-white/10 flex items-center justify-center mb-8 shadow-neo -rotate-3 transition-transform group-hover:rotate-0">
              <BookOpen className="w-8 h-8 text-slate-100 stroke-[2.5px]" />
            </div>
            <h3 className="font-black text-2xl text-slate-100 mb-4 uppercase tracking-tight">Connect your plan</h3>
            <p className="text-slate-100/60 font-bold leading-snug">Create AI-powered study plans aligned to your goals and exam dates. No more guesswork.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="neo-card bg-slate-800 group"
          >
            <div className="w-16 h-16 bg-neo-secondary border border-white/10 flex items-center justify-center mb-8 shadow-neo rotate-2 transition-transform group-hover:rotate-0">
              <BarChart3 className="w-8 h-8 text-slate-100 stroke-[2.5px]" />
            </div>
            <h3 className="font-black text-2xl text-slate-100 mb-4 uppercase tracking-tight">Stay organized</h3>
            <p className="text-slate-100/60 font-bold leading-snug">Track progress, analyse performance, and keep notes that the AI remembers. Everything in focus.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="neo-card bg-slate-800 group"
          >
            <div className="w-16 h-16 bg-neo-muted border border-white/10 flex items-center justify-center mb-8 shadow-neo -rotate-2 transition-transform group-hover:rotate-0">
              <MessageCircle className="w-8 h-8 text-slate-100 stroke-[2.5px]" />
            </div>
            <h3 className="font-black text-2xl text-slate-100 mb-4 uppercase tracking-tight">Collaborate effectively</h3>
            <p className="text-slate-100/60 font-bold leading-snug">Use AI Study Buddy for instant help and explanations across topics. Your 24/7 tutor.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default LandingBenefits;

