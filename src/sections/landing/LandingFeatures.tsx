import { Brain, Target, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingFeatures() {
  return (
    <section id="features" className="px-6 py-24 overflow-x-clip relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-block py-1 px-3 rounded-lg bg-neon-blue/10 border border-neon-blue/20 text-neon-blue font-medium text-sm mb-4">Features</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mt-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Features designed for productivity</h2>
          <p className="text-white/60 mt-4 text-lg">From study planning to exam practice, we’ve got you covered.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            className="rounded-2xl border border-white/10 p-8 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors"
          >
            <div className="mb-6 w-full h-32 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-white/10 flex items-center justify-center">
              <Brain className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="font-bold text-xl text-white mb-3">AI Study Buddy</h3>
            <p className="text-white/50 leading-relaxed">Context-aware answers with your personal notes and chat memory.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            className="rounded-2xl border border-white/10 p-8 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors"
          >
            <div className="mb-6 w-full h-32 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-white/10 flex items-center justify-center">
              <Target className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="font-bold text-xl text-white mb-3">Personalized Plans</h3>
            <p className="text-white/50 leading-relaxed">Generate day-wise schedules tailored to your syllabus and timeline.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.25 }}
            className="rounded-2xl border border-white/10 p-8 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors"
          >
            <div className="mb-6 w-full h-32 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-white/10 flex items-center justify-center">
              <BarChart3 className="w-10 h-10 text-amber-400" />
            </div>
            <h3 className="font-bold text-xl text-white mb-3">Exam Simulators</h3>
            <p className="text-white/50 leading-relaxed">Practice with CBSE and CUET simulators with robust section resume.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default LandingFeatures;
