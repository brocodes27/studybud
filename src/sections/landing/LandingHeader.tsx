import { Sparkles, ArrowRight, Menu } from 'lucide-react';

export function LandingHeader() {
  return (
    <header className="sticky top-0 backdrop-blur-sm z-20">
      {/* Top promo bar (kept text minimal to preserve original content) */}
      <div className="flex justify-center items-center py-3 bg-black text-white text-sm gap-3">
        <button
          className="inline-flex gap-1 items-center hover:opacity-90"
          onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span>Get started for free</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="py-5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">ElevenFolks</span>
            </div>

            <Menu className="h-5 w-5 md:hidden text-gray-700" />

            <nav className="hidden md:flex gap-6 text-black/60 items-center">
              <a href="#benefits" className="hover:text-black">Benefits</a>
              <a href="#features" className="hover:text-black">Features</a>
              <a href="#testimonials" className="hover:text-black">Testimonials</a>
              <button
                className="bg-black text-white px-4 py-2 rounded-lg font-medium inline-flex items-center justify-center tracking-tight"
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
