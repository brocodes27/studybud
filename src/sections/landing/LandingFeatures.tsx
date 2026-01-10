import { Brain, Target, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingFeatures() {
  return (
    <section id="features" className="px-6 py-32 bg-neo-bg relative overflow-hidden border-t-8 border-black">
      {/* Halftone Dot Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '20px 20px' }} />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.span
            initial={{ rotate: 1 }}
            whileInView={{ rotate: -1 }}
            className="sticker bg-neo-muted border-4 border-black mb-4"
          >
            FEATURES
          </motion.span>
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-black mt-6 leading-none">
            BUILT FOR <br />
            <span className="text-neo-secondary" style={{ WebkitTextStroke: '2px black' }}>PRODUCTIVITY</span>
          </h2>
          <p className="text-black/70 mt-6 text-xl font-bold">From study planning to exam practice, we’ve got you covered.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-10 mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="neo-card bg-white"
          >
            <div className="mb-8 w-full h-48 bg-neo-accent border-4 border-black flex items-center justify-center -rotate-2 shadow-[8px_8px_0px_0px_#000]">
              <Brain className="w-16 h-16 text-black stroke-[2.5px]" />
            </div>
            <h3 className="font-black text-2xl text-black mb-4 uppercase tracking-tight">AI Study Buddy</h3>
            <p className="text-black/60 font-bold leading-snug">Context-aware answers with your personal notes and chat memory. No more searching manuals.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="neo-card bg-white"
          >
            <div className="mb-8 w-full h-48 bg-neo-secondary border-4 border-black flex items-center justify-center rotate-1 shadow-[8px_8px_0px_0px_#000]">
              <Target className="w-16 h-16 text-black stroke-[2.5px]" />
            </div>
            <h3 className="font-black text-2xl text-black mb-4 uppercase tracking-tight">Personalized Plans</h3>
            <p className="text-black/60 font-bold leading-snug">Generate day-wise schedules tailored to your syllabus and timeline. Exactly what you need, when you need it.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="neo-card bg-white"
          >
            <div className="mb-8 w-full h-48 bg-neo-muted border-4 border-black flex items-center justify-center -rotate-1 shadow-[8px_8px_0px_0px_#000]">
              <BarChart3 className="w-16 h-16 text-black stroke-[2.5px]" />
            </div>
            <h3 className="font-black text-2xl text-black mb-4 uppercase tracking-tight">Exam Simulators</h3>
            <p className="text-black/60 font-bold leading-snug">Practice with CBSE and CUET simulators with robust section resume. Feel the heat of the exam room.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default LandingFeatures;

