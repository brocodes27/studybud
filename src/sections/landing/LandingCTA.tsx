import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

export function LandingCTA() {
  return (
    <section className="py-24 md:py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#F5F0E8]" />

      {/* Subtle warm orbs */}
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#C4A484]/[0.08] rounded-full blur-[120px]"
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#8B7355]/[0.06] rounded-full blur-[100px]"
      />

      <div className="max-w-3xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-[#2D2A26]/[0.08] text-[#8A8279] text-[11px] font-bold uppercase tracking-widest mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#8B7355]" />
          Free forever tier available
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-[#2D2A26] leading-[1.1] mb-5"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Ready to stop studying{' '}
          <span className="text-[#8B7355]">in the dark?</span>
        </motion.h2>

        <motion.p
          initial={{ y: 16, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-[#8A8279] text-lg md:text-xl font-medium max-w-lg mx-auto mb-10 leading-relaxed"
        >
          Join thousands of students who let AI handle the planning so they can focus on the learning.
        </motion.p>

        <motion.div
          initial={{ y: 16, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <button
            onClick={() => window.location.href = '/auth'}
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-[15px] font-bold text-white bg-[#2D2A26] hover:bg-[#3D3833] transition-all duration-300 hover:-translate-y-[2px] shadow-lg"
          >
            Start for free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <a
            href="#features"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-[15px] font-semibold text-[#2D2A26]/70 border border-[#2D2A26]/[0.12] hover:border-[#2D2A26]/20 hover:text-[#2D2A26] hover:bg-white/50 transition-all"
          >
            Explore features
          </a>
        </motion.div>

        <motion.div
          initial={{ y: 12, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6 text-[11px] font-semibold text-[#8A8279]/60 uppercase tracking-widest"
        >
          {['No credit card', 'Cancel anytime', 'GDPR compliant'].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[#6B8E6B]/60" />
              {t}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export default LandingCTA;
