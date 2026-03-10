import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

export function LandingHero() {
  return (
    <section className="pt-20 pb-20 md:pt-32 md:pb-32 relative overflow-hidden bg-white">
      {/* Soft Background Gradient Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#00D1FF]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#F472B6]/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D1FF]/10 text-[#0A192F] rounded-full font-bold text-sm mb-8 border border-[#00D1FF]/20 shadow-[0_4px_12px_rgba(0,209,255,0.1)]"
        >
          <Sparkles className="w-4 h-4 text-[#00D1FF]" />
          <span>Meet the new Elevenfolks AI</span>
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl sm:text-7xl md:text-[120px] font-extrabold text-[#0A192F] leading-[0.9] tracking-tight mb-6"
        >
          Your dream score <br />
          starts <span className="text-[#00D1FF] relative inline-block">
            here.
            <svg className="absolute -bottom-2 left-0 w-full h-4 text-[#F472B6]" viewBox="0 0 100 20" preserveAspectRatio="none">
              <path d="M0 10 Q 50 20 100 10" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
            </svg>
          </span>
        </motion.h1>

        {/* The Massive 1600 Graphic */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.2, type: 'spring' }}
          className="relative my-12"
        >
          <div className="text-[120px] sm:text-[200px] md:text-[280px] font-extrabold text-[#0A192F] leading-none tracking-tighter drop-shadow-[0_20px_40px_rgba(10,25,47,0.1)] relative z-10">
            1600
          </div>

          {/* Playful Floating Elements behind/around 1600 */}
          <motion.div
            animate={{ y: [-15, 15, -15], rotate: [-10, 10, -10] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-10 -left-10 md:-top-20 md:-left-20 w-32 h-32 md:w-48 md:h-48 bg-[#00D1FF] rounded-[40px] opacity-20 blur-xl -z-10"
          />
          <motion.div
            animate={{ y: [15, -15, 15], rotate: [10, -10, 10] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-10 -right-10 md:-bottom-20 md:-right-20 w-40 h-40 md:w-56 md:h-56 bg-[#F472B6] rounded-full opacity-20 blur-xl -z-10"
          />
        </motion.div>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-xl md:text-2xl text-[#64748B] font-medium max-w-3xl mx-auto mb-10 leading-relaxed"
        >
          A playful, powerful AI tutor that transforms the SAT grind into a guided adventure. Join thousands of students scoring higher with less stress.
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full sm:w-auto"
        >
          <button
            className="w-full sm:w-auto neo-button text-xl px-12 py-5 shadow-float-cyan"
            onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Get Started Free
            <ArrowRight className="w-6 h-6 ml-2 stroke-[3px]" />
          </button>
        </motion.div>

      </div>
    </section>
  );
}

export default LandingHero;
