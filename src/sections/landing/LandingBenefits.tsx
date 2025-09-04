import { BookOpen, BarChart3, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingBenefits() {
  return (
    <section id="benefits" className="px-6 py-24 overflow-x-clip">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <span className="tag">Benefits</span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mt-3">One space for your study and your work</h2>
          <p className="text-gray-600 mt-4">Keep everything in one place, from your plan to practice tests. With ElevenFolks, organize, collaborate, and learn faster.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            className="rounded-2xl border border-border p-6 bg-card hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3"><BookOpen className="w-5 h-5"/></div>
            <h3 className="font-semibold text-gray-900 mb-2">Connect your plan</h3>
            <p className="text-gray-600 text-sm">Create AI-powered study plans aligned to your goals and exam dates.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            className="rounded-2xl border border-border p-6 bg-card hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3"><BarChart3 className="w-5 h-5"/></div>
            <h3 className="font-semibold text-gray-900 mb-2">Stay organized</h3>
            <p className="text-gray-600 text-sm">Track progress, analyse performance, and keep notes that the AI remembers.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.25 }}
            className="rounded-2xl border border-border p-6 bg-card hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-3"><MessageCircle className="w-5 h-5"/></div>
            <h3 className="font-semibold text-gray-900 mb-2">Collaborate effectively</h3>
            <p className="text-gray-600 text-sm">Use AI Study Buddy for instant help and explanations across topics.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default LandingBenefits;
