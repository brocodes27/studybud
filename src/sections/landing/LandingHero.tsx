import { motion } from 'framer-motion';
import arrowRight from '../../assets/arrow-right.svg';

export function LandingHero() {
  return (
    <section className="pt-24 pb-20 md:pt-32 md:pb-32 relative overflow-hidden bg-slate-950">
      {/* Halftone Dot Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '30px 30px' }} />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ rotate: -2, opacity: 0 }}
              animate={{ rotate: -1, opacity: 1 }}
              className="inline-block bg-neo-secondary border border-white/10 px-4 py-1 mb-8 shadow-neo"
            >
              <span className="font-black uppercase tracking-widest text-sm">NEW: AI BLACKBOARD VIDEOS</span>
            </motion.div>

            <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-black uppercase leading-[0.95] sm:leading-[0.85] tracking-tighter mb-8">
              STOP STUDYING.<br />
              <span className="text-neo-accent" style={{ WebkitTextStroke: '2px black' }}>START</span> <br />
              ARCHITECTING.
            </h1>

            <p className="text-xl md:text-2xl font-bold max-w-2xl mx-auto lg:mx-0 mb-10 leading-snug">
              The first Operating System for STEM mastery. Centralize your logic, automate the grind,
              and out-engineer your exams. Built for the students who lead.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 items-center lg:items-start justify-center lg:justify-start">
              <button
                className="neo-button text-xl px-10 py-5 bg-neo-accent"
                onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
              >
                GET STARTED FOR FREE
              </button>
              <button
                className="neo-button-white text-xl px-10 py-5"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <span>EXPLORE FEATURES</span>
                <img src={arrowRight} className="h-6 w-6 stroke-[3px]" alt="arrow" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative">
            <motion.div
              animate={{ rotate: [2, -2, 2], y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className="relative z-10 bg-slate-800 border border-white/10 p-4 shadow-neo -rotate-2"
            >
              <div className="bg-neo-ink aspect-video flex items-center justify-center p-8">
                <span className="text-white font-black text-4xl text-center uppercase tracking-widest">
                  BLACKBOARD <br /> PLAYER.EXE
                </span>
              </div>
              <div className="h-4 border-t-4 border-white/10 mt-4 flex items-center gap-2">
                <div className="w-3 h-3 bg-neo-accent border border-white/10 rounded-full" />
                <div className="w-3 h-3 bg-neo-secondary border border-white/10 rounded-full" />
                <div className="w-3 h-3 bg-neo-muted border border-white/10 rounded-full" />
              </div>
            </motion.div>

            {/* Background Stickers */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-neo-muted border border-white/10 rotate-12 shadow-neo flex items-center justify-center -z-10">
              <span className="font-black text-4xl">AI</span>
            </div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-neo-accent border border-white/10 rounded-full rotate-[-15deg] shadow-neo flex items-center justify-center -z-10">
              <span className="font-black text-2xl text-center uppercase">NEO- <br /> BRUTAL</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingHero;
