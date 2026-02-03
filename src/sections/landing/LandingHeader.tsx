import { ArrowRight, Menu } from 'lucide-react';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-neo-bg border-b-4 border-black">
      {/* Top marquee promo bar */}
      <div className="marquee-container bg-black border-b-4 border-black font-black">
        <div className="marquee-content py-1 text-sm bg-neo-secondary text-black">
          NEW: AI VIDEO LESSONS AVAILABLE NOW • GET STARTED FOR FREE • NEW: AI VIDEO LESSONS AVAILABLE NOW • GET STARTED FOR FREE • NEW: AI VIDEO LESSONS AVAILABLE NOW • GET STARTED FOR FREE •
        </div>
      </div>

      <div className="py-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="w-12 h-12 bg-neo-secondary border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000] group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-none transition-all">
                <span className="text-2xl font-black italic">EF</span>
              </div>
              <span className="text-3xl font-black uppercase tracking-tighter text-black hidden sm:block">
                ELEVENFOLKS
              </span>
            </div>

            <Menu className="h-8 w-8 md:hidden text-black stroke-[3px]" />

            <nav className="hidden md:flex gap-4 text-sm font-black text-black items-center">
              <a href="https://elevenfolks.com#benefits" className="px-3 py-2 hover:bg-neo-muted border-4 border-transparent hover:border-black uppercase transition-all">Benefits</a>
              <a href="https://elevenfolks.com#features" className="px-3 py-2 hover:bg-neo-accent border-4 border-transparent hover:border-black uppercase transition-all">Features</a>
              <a href="https://elevenfolks.com#testimonials" className="px-3 py-2 hover:bg-neo-secondary border-4 border-transparent hover:border-black uppercase transition-all text-black">Testimonials</a>
              <button
                className="neo-button bg-black text-white ml-4"
                onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
              >
                GET STARTED
                <ArrowRight className="h-4 w-4 stroke-[3px]" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

export default LandingHeader;

