import { Sparkles, ArrowRight, Menu } from 'lucide-react';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-black/20 border-b border-white/10">
      {/* Top promo bar */}
      <div className="flex justify-center items-center py-3 bg-white/5 text-white/80 text-sm gap-3 backdrop-blur-md border-b border-white/5">
        <button
          className="inline-flex gap-1 items-center hover:opacity-90"
          onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent font-medium">New: AI Video Lessons</span>
          <span className="text-white/40 mx-2">|</span>
          <span>Get started for free</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="py-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue/20 to-purple-500/20 border border-white/10 flex items-center justify-center backdrop-blur-lg">
                <Sparkles className="w-5 h-5 text-neon-blue" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">ElevenFolks</span>
            </div>

            <Menu className="h-6 w-6 md:hidden text-white" />

            <nav className="hidden md:flex gap-8 text-sm font-medium text-white/70 items-center">
              <a href="#benefits" className="hover:text-white transition-colors">Benefits</a>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#testimonials" className="hover:text-white transition-colors">Testimonials</a>
              <button
                className="bg-white text-black px-5 py-2.5 rounded-full font-semibold hover:bg-gray-200 transition-colors"
                onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Get for free
              </button>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

export default LandingHeader;
