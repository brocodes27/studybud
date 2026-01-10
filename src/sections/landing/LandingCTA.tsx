import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, Sparkles, Zap } from 'lucide-react';

export function LandingCTA() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const translateY = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 45]);

  return (
    <section ref={sectionRef} className="py-32 bg-neo-bg relative border-t-8 border-black overflow-hidden">
      {/* Halftone Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '25px 25px' }} />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="relative text-center max-w-4xl mx-auto">
          <motion.div
            style={{ translateY, rotate }}
            className="absolute -left-20 -top-20 hidden md:flex w-32 h-32 bg-neo-accent border-4 border-black items-center justify-center shadow-[8px_8px_0px_0px_#000]"
          >
            <Sparkles className="w-16 h-16 text-black stroke-[2.5px]" />
          </motion.div>

          <motion.div
            style={{ translateY: useTransform(scrollYProgress, [0, 1], [-100, 100]), rotate: useTransform(scrollYProgress, [0, 1], [0, -45]) }}
            className="absolute -right-20 -bottom-20 hidden md:flex w-32 h-32 bg-neo-secondary border-4 border-black items-center justify-center shadow-[8px_8px_0px_0px_#000]"
          >
            <Zap className="w-16 h-16 text-black stroke-[2.5px]" />
          </motion.div>

          <h2 className="text-5xl md:text-8xl font-black uppercase tracking-tighter text-black leading-none italic">
            READY TO <span className="text-neo-accent" style={{ WebkitTextStroke: '2px black' }}>TRANSFORM</span> <br />
            YOUR PRODUCTIVITY?
          </h2>
          <p className="text-black/70 mt-8 text-2xl font-bold max-w-2xl mx-auto italic leading-tight">
            Join thousands of students already using <span className="underline decoration-neo-secondary decoration-8">ElevenFolks</span> to achieve more.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 mt-16 justify-center">
          <button
            className="neo-button bg-neo-accent text-black text-2xl py-6 px-12"
            onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
          >
            GET STARTED FOR FREE
            <ArrowRight className="h-8 w-8 stroke-[3.5px]" />
          </button>
          <button
            className="neo-button-muted border-4 border-black text-2xl py-6 px-12"
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          >
            LEARN MORE
          </button>
        </div>
      </div>
    </section>
  );
}

export default LandingCTA;

