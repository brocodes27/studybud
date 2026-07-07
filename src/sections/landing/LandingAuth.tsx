import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingAuth() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/auth');
  };

  return (
    <section id="auth" className="py-20 md:py-28 px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md mx-auto text-center neo-card-glass gradient-border !p-10 relative"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#8B7355]/[0.08] text-[#8B7355] text-[11px] font-bold uppercase tracking-widest mb-5">
          <Sparkles className="w-3.5 h-3.5" />
          Students &amp; Teachers
        </div>
        <h2
          className="text-3xl md:text-4xl font-semibold tracking-tight text-[#2D2A26] mb-3"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Start your journey
        </h2>
        <p className="text-[14px] text-[#8A8279] font-medium leading-relaxed mb-8">
          One account for prescriptions, prove-it credentials, and squad streaks.
        </p>
        <button
          type="button"
          onClick={handleClick}
          className="neo-button w-full text-[14px] group"
        >
          Sign Up / Sign In
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </motion.div>
    </section>
  );
}

export default LandingAuth;