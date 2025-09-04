import { Sparkles } from 'lucide-react';
import socialX from '../../assets/social-x.svg';
import socialInsta from '../../assets/social-insta.svg';
import socialLinkedIn from '../../assets/social-linkedin.svg';
import socialPin from '../../assets/social-pin.svg';
import socialYoutube from '../../assets/social-youtube.svg';

export function LandingFooter() {
  return (
    <footer className="bg-black text-[#BCBCBC] text-sm py-10 text-center">
      <div className="max-w-7xl mx-auto px-6">
        <div className="inline-flex relative before:content-[''] before:top-2 before:bottom-0 before:w-full before:blur before:bg-[linear-gradient(to_right,#f87bff,#FB92CF,#FFDD9B,#C2F0B1,#2FD8FE)] before:absolute">
          <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white">
            <Sparkles className="h-5 w-5 text-black" />
          </div>
        </div>
        <nav className="flex flex-col md:flex-row md:justify-center gap-6 mt-6">
          <a className="hover:text-white transition-colors" href="#benefits">Benefits</a>
          <a className="hover:text-white transition-colors" href="#features">Features</a>
          <a className="hover:text-white transition-colors" href="#testimonials">Testimonials</a>
          <a className="hover:text-white transition-colors" href="#auth">Contact</a>
        </nav>
        <div className="flex justify-center gap-6 mt-6">
          <img src={socialX} alt="X" className="h-5 w-5" />
          <img src={socialInsta} alt="Instagram" className="h-5 w-5" />
          <img src={socialLinkedIn} alt="LinkedIn" className="h-5 w-5" />
          <img src={socialPin} alt="Pinterest" className="h-5 w-5" />
          <img src={socialYoutube} alt="YouTube" className="h-5 w-5" />
        </div>
        <p className="mt-6">&copy; {new Date().getFullYear()} dbuck. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default LandingFooter;
