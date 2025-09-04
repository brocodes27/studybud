import { Brain, Target, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingFeatures() {
  return (
    <section id="features" className="px-6 py-24 overflow-x-clip">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <span className="tag">Features</span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mt-3">Features designed for productivity</h2>
          <p className="text-gray-600 mt-4">From study planning to exam practice, we’ve got you covered.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            className="rounded-2xl border border-border p-6 bg-card hover:shadow-md transition-shadow"
          >
            <div className="mb-3 w-full h-28 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Brain className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">AI Study Buddy</h3>
            <p className="text-gray-600 text-sm">Context-aware answers with your personal notes and chat memory.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            className="rounded-2xl border border-border p-6 bg-card hover:shadow-md transition-shadow"
          >
            <div className="mb-3 w-full h-28 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Target className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Personalized Plans</h3>
            <p className="text-gray-600 text-sm">Generate day-wise schedules tailored to your syllabus and timeline.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.25 }}
            className="rounded-2xl border border-border p-6 bg-card hover:shadow-md transition-shadow"
          >
            <div className="mb-3 w-full h-28 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Exam Simulators</h3>
            <p className="text-gray-600 text-sm">Practice with CBSE and CUET simulators with robust section resume.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default LandingFeatures;
