import { Sparkles } from 'lucide-react';
import socialX from '../../assets/social-x.svg';
import socialInsta from '../../assets/social-insta.svg';
import socialLinkedIn from '../../assets/social-linkedin.svg';
import socialPin from '../../assets/social-pin.svg';
import socialYoutube from '../../assets/social-youtube.svg';

export function LandingFooter() {
  return (
    <footer className="bg-black border-t border-white/10 text-white/60 text-sm py-12 text-center relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-neon-blue/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="inline-flex relative before:content-[''] before:top-2 before:bottom-0 before:w-full before:blur before:bg-[linear-gradient(to_right,#f87bff,#FB92CF,#FFDD9B,#C2F0B1,#2FD8FE)] before:absolute before:opacity-0 active:before:opacity-100">
          <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
            <Sparkles className="h-6 w-6 text-neon-blue" />
          </div>
        </div>
        <nav className="flex flex-col md:flex-row md:justify-center gap-8 mt-8 font-medium">
          <a className="hover:text-neon-blue transition-colors" href="#benefits">Benefits</a>
          <a className="hover:text-neon-blue transition-colors" href="#features">Features</a>
          <a className="hover:text-neon-blue transition-colors" href="#testimonials">Testimonials</a>
          <a className="hover:text-neon-blue transition-colors" href="#auth">Contact</a>
        </nav>
        <div className="flex justify-center gap-6 mt-8">
          <img src={socialX} alt="X" className="h-5 w-5 invert opacity-60 hover:opacity-100 transition-opacity cursor-pointer" />
          <img src={socialInsta} alt="Instagram" className="h-5 w-5 invert opacity-60 hover:opacity-100 transition-opacity cursor-pointer" />
          <img src={socialLinkedIn} alt="LinkedIn" className="h-5 w-5 invert opacity-60 hover:opacity-100 transition-opacity cursor-pointer" />
          <img src={socialPin} alt="Pinterest" className="h-5 w-5 invert opacity-60 hover:opacity-100 transition-opacity cursor-pointer" />
          <img src={socialYoutube} alt="YouTube" className="h-5 w-5 invert opacity-60 hover:opacity-100 transition-opacity cursor-pointer" />
        </div>
        <p className="mt-8 text-white/40">&copy; {new Date().getFullYear()} ElevenFolks. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default LandingFooter;
