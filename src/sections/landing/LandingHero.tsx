import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import arrowRight from '../../assets/arrow-right.svg';
import cog from '../../assets/cog.png';
import cylinder from '../../assets/cylinder.png';
import noodle from '../../assets/noodle.png';

export function LandingHero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start end', 'end start'],
  });
  const translateY = useTransform(scrollYProgress, [0, 1], [150, -150]);

  return (
    <section
      ref={heroRef}
      className="pt-20 pb-20 md:pt-28 md:pb-24 overflow-x-clip relative"
    >
      <div className="absolute top-0 right-0 -z-10 w-[500px] h-[500px] bg-neon-blue/20 rounded-full blur-[120px] opacity-40" />
      <div className="absolute bottom-0 left-0 -z-10 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[100px] opacity-30" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="md:flex items-center">
          <div className="md:w-[500px]">
            <div className="inline-flex border border-white/10 rounded-full px-3 py-1 bg-white/5 backdrop-blur text-xs font-medium text-neon-blue mb-6">
              <span className="mr-2 px-1 py-0.5 bg-neon-blue/20 rounded text-[10px] text-neon-blue font-bold">NEW</span>
              AI-Powered Blackboard Videos
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-b from-white via-white to-white/60 text-transparent bg-clip-text">
              The all-in-one study workspace
            </h1>
            <p className="text-xl text-white/50 tracking-tight mt-6 leading-relaxed">
              Centralize your plans, progress, and practice. Learn smarter with your AI mentor, personalized plans, and exam simulators.
            </p>
            <div className="flex gap-4 items-center mt-[30px]">
              <button
                className="px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Get started for free
              </button>
              <button
                className="px-6 py-3 text-white font-medium flex items-center gap-2 hover:text-neon-blue transition-colors"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <span>Explore features</span>
                <img src={arrowRight} className="h-5 w-5 invert" alt="arrow" />
              </button>
            </div>
          </div>

          <div className="mt-20 md:mt-0 md:h-[648px] md:flex-1 relative perspective-1000">
            <motion.img
              src={cog}
              alt="Cog image"
              className="md:absolute md:h-full md:w-auto md:max-w-none md:-left-6 lg:left-0 drop-shadow-[0_0_50px_rgba(66,133,244,0.3)] filter brightness-110"
              animate={{ translateY: [-20, 20], rotate: [0, 5, 0] }}
              transition={{ repeat: Infinity, repeatType: 'mirror', duration: 4, ease: 'easeInOut' }}
            />
            <motion.img
              src={cylinder}
              alt="Cylinder image"
              width={220}
              height={220}
              className="hidden md:block -top-8 -left-32 md:absolute drop-shadow-[0_0_30px_rgba(168,85,247,0.3)] opacity-80"
              style={{ translateY }}
            />
            <motion.img
              src={noodle}
              width={220}
              alt="Noodle image"
              className="hidden lg:block absolute top-[524px] left-[448px] rotate-[30deg] drop-shadow-[0_0_30px_rgba(255,100,100,0.2)] opacity-80"
              style={{ translateY, rotate: 30 }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingHero;
