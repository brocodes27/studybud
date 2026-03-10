import { Menu } from 'lucide-react';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b-2 border-[#0A192F]/10">
      {/* Top marquee promo bar */}
      <div className="marquee-container bg-[#0A192F] text-white overflow-hidden py-1.5 font-bold text-xs uppercase tracking-widest">
        <div className="marquee-content whitespace-nowrap">
          NEW: AI VIDEO LESSONS AVAILABLE NOW • GET STARTED FOR FREE • NEW: AI VIDEO LESSONS AVAILABLE NOW • GET STARTED FOR FREE • NEW: AI VIDEO LESSONS AVAILABLE NOW • GET STARTED FOR FREE •
        </div>
      </div>

      <div className="py-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4 cursor-pointer group">
              <div className="w-12 h-12 bg-[#00D1FF] text-[#0A192F] rounded-full flex items-center justify-center font-extrabold text-xl shadow-[0_4px_12px_rgba(0,209,255,0.4)] group-hover:scale-105 transition-transform duration-300">
                EF
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-[#0A192F] hidden sm:block">
                Elevenfolks
              </span>
            </div>

            <Menu className="h-8 w-8 md:hidden text-[#0A192F] stroke-[3px]" />

            <nav className="hidden md:flex gap-6 text-[15px] font-bold text-[#0A192F] items-center">
              <a href="#features" className="hover:text-[#00D1FF] transition-colors">Features</a>
              <a href="#benefits" className="hover:text-[#F472B6] transition-colors">Benefits</a>
              <a href="#testimonials" className="hover:text-[#34D399] transition-colors">Stories</a>
              <button
                className="px-6 py-2.5 rounded-full bg-[#0A192F] text-white font-bold hover:-translate-y-1 active:scale-95 transition-all ml-2 shadow-[0_8px_16px_rgba(10,25,47,0.2)]"
                onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Get Started
              </button>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

export default LandingHeader;

