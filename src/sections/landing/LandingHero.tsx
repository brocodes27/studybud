import { motion } from 'framer-motion';
import arrowRight from '../../assets/arrow-right.svg';

export function LandingHero() {
  return (
    <section className="pt-24 pb-20 md:pt-32 md:pb-32 relative overflow-hidden bg-neo-bg">
      {/* Halftone Dot Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '30px 30px' }} />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ rotate: -2, opacity: 0 }}
              animate={{ rotate: -1, opacity: 1 }}
              className="inline-block bg-neo-secondary border-4 border-black px-4 py-1 mb-8 shadow-[4px_4px_0px_0px_#000]"
            >
              <span className="font-black uppercase tracking-widest text-sm">NEW: AI BLACKBOARD VIDEOS</span>
            </motion.div>

            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black uppercase leading-[0.85] tracking-tighter mb-8">
              THE ALL-IN-ONE <br />
              <span className="text-neo-accent" style={{ WebkitTextStroke: '3px black' }}>STUDY</span> <br />
              WORKSPACE
            </h1>

            <p className="text-xl md:text-2xl font-bold max-w-2xl mx-auto lg:mx-0 mb-10 leading-snug">
              Centralize your plans, progress, and practice. Learn smarter with your AI mentor,
              personalized plans, and exam simulators. No fluff, just structure.
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
              className="relative z-10 bg-white border-8 border-black p-4 shadow-[16px_16px_0px_0px_#FFD93D] -rotate-2"
            >
              <div className="bg-neo-ink aspect-video flex items-center justify-center p-8">
                <span className="text-white font-black text-4xl text-center uppercase tracking-widest">
                  BLACKBOARD <br /> PLAYER.EXE
                </span>
              </div>
              <div className="h-4 border-t-4 border-black mt-4 flex items-center gap-2">
                <div className="w-3 h-3 bg-neo-accent border-2 border-black rounded-full" />
                <div className="w-3 h-3 bg-neo-secondary border-2 border-black rounded-full" />
                <div className="w-3 h-3 bg-neo-muted border-2 border-black rounded-full" />
              </div>
            </motion.div>

            {/* Background Stickers */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-neo-muted border-4 border-black rotate-12 shadow-[8px_8px_0px_0px_#000] flex items-center justify-center -z-10">
              <span className="font-black text-4xl">AI</span>
            </div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-neo-accent border-4 border-black rounded-full rotate-[-15deg] shadow-[8px_8px_0px_0px_#000] flex items-center justify-center -z-10">
              <span className="font-black text-2xl text-center uppercase">NEO- <br /> BRUTAL</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingHero;
