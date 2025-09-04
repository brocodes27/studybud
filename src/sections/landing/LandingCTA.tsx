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
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Ready to transform your productivity?</h2>
          <p className="text-gray-600 mt-5">Join thousands of students already using ElevenFolks to achieve more.</p>

          <motion.img
            src={star}
            alt="Star"
            width={360}
            className="absolute -left-[350px] -top-[137px] hidden md:block"
            style={{ translateY }}
          />
          <motion.img
            src={spring}
            alt="Spring"
            width={360}
            className="absolute -right-[331px] -top-[19px] hidden md:block"
            style={{ translateY }}
          />
        </div>
        <div className="flex gap-2 mt-10 justify-center">
          <button
            className="btn bg-black text-white"
            onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Get for free
          </button>
          <button
            className="btn btn-text gap-1"
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span>Learn more</span>
            <img src={arrowRight} className="h-5 w-5" alt="arrow" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default LandingCTA;
