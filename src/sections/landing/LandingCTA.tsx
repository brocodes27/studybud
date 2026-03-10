import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

export function LandingCTA() {
  return (
    <section className="py-32 bg-[#0A192F] relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00D1FF]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#F472B6]/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D1FF]/10 text-[#00D1FF] rounded-full font-bold text-sm mb-8 border border-[#00D1FF]/20"
        >
          <Sparkles className="w-4 h-4" />
          <span>Start for free, no credit card needed</span>
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight mb-6"
        >
          Ready to transform <br />
          <span className="text-[#00D1FF]">your productivity?</span>
        </motion.h2>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-slate-400 text-xl font-medium max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Join thousands of students already using Elevenfolks to achieve more, stress less, and score higher.
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button
            className="neo-button text-lg px-10 py-4 shadow-[0_8px_24px_rgba(0,209,255,0.4)]"
            onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 ml-1 stroke-[3px]" />
          </button>
          <button
            className="px-10 py-4 rounded-full border-2 border-white/20 text-white font-bold text-lg hover:border-[#00D1FF]/50 hover:text-[#00D1FF] transition-all"
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          >
            See Features
          </button>
        </motion.div>
      </div>
    </section>
  );
}

export default LandingCTA;
