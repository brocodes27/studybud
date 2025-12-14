import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import arrowRight from '../../assets/arrow-right.svg';
import star from '../../assets/star.png';
import spring from '../../assets/spring.png';

export function LandingCTA() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const translateY = useTransform(scrollYProgress, [0, 1], [150, -150]);

  return (
    <section ref={sectionRef} className="py-24 overflow-x-clip">
      <div className="max-w-7xl mx-auto px-6">
        <div className="relative text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Ready to transform your productivity?</h2>
          <p className="text-white/60 mt-5 text-xl max-w-2xl mx-auto">Join thousands of students already using ElevenFolks to achieve more.</p>

          <motion.img
            src={star}
            alt="Star"
            width={360}
            className="absolute -left-[350px] -top-[137px] hidden md:block drop-shadow-[0_0_50px_rgba(255,255,0,0.2)]"
            style={{ translateY }}
          />
          <motion.img
            src={spring}
            alt="Spring"
            width={360}
            className="absolute -right-[331px] -top-[19px] hidden md:block drop-shadow-[0_0_50px_rgba(50,255,100,0.2)]"
            style={{ translateY }}
          />
        </div>
        <div className="flex gap-4 mt-10 justify-center">
          <button
            className="px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Get for free
          </button>
          <button
            className="px-6 py-3 text-white font-medium flex items-center gap-2 hover:text-neon-blue transition-colors"
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span>Learn more</span>
            <img src={arrowRight} className="h-5 w-5 invert" alt="arrow" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default LandingCTA;
