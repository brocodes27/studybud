import { Link } from 'react-router-dom';
import { Logo } from '../../components/Logo';

export function LandingFooter() {
  return (
    <footer className="bg-[#2D2A26] text-white pt-16 pb-10 relative overflow-hidden">
      {/* Oversized watermark for depth */}
      <span
        aria-hidden="true"
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-[22vw] leading-none font-semibold text-white/[0.03] whitespace-nowrap pointer-events-none select-none"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        elevenfolks
      </span>
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-14 mb-14">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <Logo size={20} className="text-[#8B7355]" />
              <span className="text-[17px] font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                elevenfolks
              </span>
            </div>
            <p className="text-white/35 text-[14px] font-medium leading-relaxed mb-6">
              An AI-powered study companion that plans, tracks, and adapts — so you can focus on learning, not logistics.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
            <div>
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-4">Product</p>
              <div className="flex flex-col gap-2.5">
                {['Daily Briefing', 'AI Study Buddy', 'Mock Tests', 'Study Groups', 'Gamification'].map((item) => (
                  <a key={item} href="#features" className="text-[13px] font-medium text-white/45 hover:text-white/80 transition-colors">
                    {item}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-4">Resources</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Curriculum', href: '#curriculum' },
                  { label: 'Live Demo', href: '#demo' },
                  { label: 'Help Center', href: 'mailto:hello@elevenfolks.com' },
                ].map((item) => (
                  <a key={item.label} href={item.href} className="text-[13px] font-medium text-white/45 hover:text-white/80 transition-colors">
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-4">Company</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Privacy Policy', href: '/privacy' },
                  { label: 'Terms of Service', href: '/terms' },
                  { label: 'Contact', href: 'mailto:hello@elevenfolks.com' }
                ].map((item) => (
                  item.href.startsWith('/') ? (
                    <Link key={item.label} to={item.href} className="text-[13px] font-medium text-white/45 hover:text-white/80 transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <a key={item.label} href={item.href} className="text-[13px] font-medium text-white/45 hover:text-white/80 transition-colors">
                      {item.label}
                    </a>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] font-medium text-white/15">
            &copy; {new Date().getFullYear()} elevenfolks. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-[12px] font-medium text-white/20 hover:text-white/40 transition-colors">Privacy</Link>
            <Link to="/terms" className="text-[12px] font-medium text-white/20 hover:text-white/40 transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;
