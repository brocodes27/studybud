import { LineChart, Zap, Target } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingFooter() {
  return (
    <footer className="bg-[#0A192F] text-white pt-32 pb-12 relative overflow-hidden rounded-t-[40px] md:rounded-t-[80px] mt-10">

      {/* Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00D1FF]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row gap-16 mb-24 items-center lg:items-end">

          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white">
              Ready to see your <br />
              <span className="text-[#00D1FF]">score jump?</span>
            </h2>
            <p className="text-slate-400 text-xl font-medium mb-10 max-w-lg mx-auto lg:mx-0">
              Join the students who have transformed their study habits and unlocked their dream colleges with Elevenfolks.
            </p>
            <button
              className="neo-button bg-[#00D1FF] text-[#0A192F] px-8 py-4 text-lg shadow-[0_8px_16px_rgba(0,209,255,0.3)] hover:scale-105 transition-transform"
              onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Start Free Trial
            </button>
          </div>

          <div className="flex-1 w-full max-w-lg relative">
            {/* The "Analytics Chart" Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-[#112240] p-6 rounded-[32px] border border-white/5 shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-slate-400 font-bold mb-1">Projected SAT Score</p>
                  <p className="text-3xl font-extrabold text-white">1550</p>
                </div>
                <div className="w-12 h-12 bg-[#00D1FF]/20 rounded-full flex items-center justify-center text-[#00D1FF]">
                  <LineChart className="w-6 h-6 stroke-[2.5px]" />
                </div>
              </div>

              {/* Fake Graph */}
              <div className="h-40 w-full relative flex items-end gap-2 border-b border-white/10 pb-2">
                {[40, 50, 45, 60, 75, 85, 95, 100].map((height, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${height}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.8, type: 'spring' }}
                    className={`flex-1 rounded-t-lg opacity-80 ${i === 7 ? 'bg-[#00D1FF]' : 'bg-[#00D1FF]/40'}`}
                  />
                ))}
              </div>
              <div className="absolute -top-6 -right-6 w-16 h-16 bg-[#F472B6] rounded-full flex items-center justify-center shadow-float-pink animate-bounce-snappy">
                <Target className="w-8 h-8 text-white stroke-[2.5px]" />
              </div>
            </motion.div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between border-t border-white/10 pt-10 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00D1FF] text-[#0A192F] rounded-full flex items-center justify-center font-extrabold text-sm">
              EF
            </div>
            <span className="text-xl font-extrabold tracking-tight">Elevenfolks</span>
          </div>

          <nav className="flex gap-8 font-bold text-slate-400 text-sm">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#benefits" className="hover:text-white transition-colors">Benefits</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Stories</a>
          </nav>

          <p className="font-medium text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} Elevenfolks. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;

