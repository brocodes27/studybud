import { BookOpen, BarChart3, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingBenefits() {
  return (
    <section id="benefits" className="px-6 py-24 overflow-x-clip relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-block py-1 px-3 rounded-lg bg-neon-blue/10 border border-neon-blue/20 text-neon-blue font-medium text-sm mb-4">Benefits</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mt-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">One space for your study and your work</h2>
          <p className="text-white/60 mt-4 text-lg">Keep everything in one place, from your plan to practice tests. With ElevenFolks, organize, collaborate, and learn faster.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            className="rounded-2xl border border-white/10 p-8 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-neon-blue/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><BookOpen className="w-6 h-6" /></div>
            <h3 className="font-bold text-xl text-white mb-3">Connect your plan</h3>
            <p className="text-white/50 leading-relaxed">Create AI-powered study plans aligned to your goals and exam dates.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            className="rounded-2xl border border-white/10 p-8 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-blue-500/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><BarChart3 className="w-6 h-6" /></div>
            <h3 className="font-bold text-xl text-white mb-3">Stay organized</h3>
            <p className="text-white/50 leading-relaxed">Track progress, analyse performance, and keep notes that the AI remembers.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.25 }}
            className="rounded-2xl border border-white/10 p-8 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-amber-500/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><MessageCircle className="w-6 h-6" /></div>
            <h3 className="font-bold text-xl text-white mb-3">Collaborate effectively</h3>
            <p className="text-white/50 leading-relaxed">Use AI Study Buddy for instant help and explanations across topics.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default LandingBenefits;
