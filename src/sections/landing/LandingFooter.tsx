import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="bg-black border-t-8 border-black text-white text-sm py-20 relative overflow-hidden">
      {/* Decorative Halftone */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-20 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '15px 15px' }} />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col items-center">
          {/* Logo Box */}
          <div className="w-16 h-16 bg-neo-accent border-4 border-white flex items-center justify-center shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] mb-8 -rotate-2">
            <span className="text-3xl font-black italic text-white">EF</span>
          </div>

          <h3 className="text-4xl font-black uppercase tracking-tighter mb-8 italic">
            ELEVENFOLKS
          </h3>

          <nav className="flex flex-wrap justify-center gap-x-12 gap-y-6 mb-12 font-black uppercase tracking-widest text-lg">
            <a className="hover:text-neo-secondary transition-colors underline decoration-transparent hover:decoration-neo-secondary decoration-4 underline-offset-8" href="https://elevenfolks.com#benefits">Benefits</a>
            <a className="hover:text-neo-accent transition-colors underline decoration-transparent hover:decoration-neo-accent decoration-4 underline-offset-8" href="https://elevenfolks.com#features">Features</a>
            <a className="hover:text-neo-muted transition-colors underline decoration-transparent hover:decoration-neo-muted decoration-4 underline-offset-8" href="https://elevenfolks.com#testimonials">Testimonials</a>
            <a className="hover:text-neo-secondary transition-colors underline decoration-transparent hover:decoration-neo-secondary decoration-4 underline-offset-8" href="https://elevenfolks.com#auth">Contact</a>
          </nav>

          <div className="w-full border-t-4 border-white/20 pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="font-bold text-white/40 uppercase tracking-widest italic">&copy; {new Date().getFullYear()} ElevenFolks. All rights reserved.</p>
            <div className="flex gap-8 font-black uppercase text-xs tracking-widest text-white/60">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;

