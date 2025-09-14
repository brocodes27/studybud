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
      className="pt-8 pb-20 md:pt-5 md:pb-10 overflow-x-clip"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="md:flex items-center">
          <div className="md:w-[478px]">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-b from-black to-[#001e80] text-transparent bg-clip-text mt-6">
              The all-in-one study workspace
            </h1>
            <p className="text-xl text-[#010d3e] tracking-tight mt-6">
              Centralize your plans, progress, and practice. Learn smarter with your AI mentor, personalized plans, and exam simulators.
            </p>
            <div className="flex gap-1 items-center mt-[30px]">
              <button
                className="btn bg-black text-white"
                onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Get started for free
              </button>
              <button
                className="btn btn-text gap-1"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <span>Explore features</span>
                <img src={arrowRight} className="h-5 w-5" alt="arrow" />
              </button>
            </div>
          </div>

          <div className="mt-20 md:mt-0 md:h-[648px] md:flex-1 relative">
            <motion.img
              src={cog}
              alt="Cog image"
              className="md:absolute md:h-full md:w-auto md:max-w-none md:-left-6 lg:left-0"
              animate={{ translateY: [-30, 30] }}
              transition={{ repeat: Infinity, repeatType: 'mirror', duration: 3, ease: 'easeInOut' }}
            />
            <motion.img
              src={cylinder}
              alt="Cylinder image"
              width={220}
              height={220}
              className="hidden md:block -top-8 -left-32 md:absolute"
              style={{ translateY }}
            />
            <motion.img
              src={noodle}
              width={220}
              alt="Noodle image"
              className="hidden lg:block absolute top-[524px] left-[448px] rotate-[30deg]"
              style={{ translateY, rotate: 30 }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingHero;
