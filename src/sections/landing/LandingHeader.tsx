import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { label: 'How it works', href: '#benefits' },
    { label: 'Features', href: '#features' },
    { label: 'Curriculum', href: '#curriculum' },
    { label: 'Stories', href: '#testimonials' },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <motion.nav
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            className={`flex items-center justify-between h-[52px] px-2 rounded-2xl transition-all duration-500 ${
              scrolled
                ? 'bg-white/80 backdrop-blur-2xl shadow-[0_4px_30px_rgba(45,42,38,0.06)] border border-[#2D2A26]/[0.06]'
                : 'bg-transparent'
            }`}
          >
            <a href="/" className="flex items-center gap-2.5 pl-2.5 group">
              <span className="text-[17px] font-semibold tracking-tight text-[#2D2A26] hidden sm:block" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                elevenfolks
              </span>
            </a>

            <div className="hidden md:flex items-center gap-0.5">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#8A8279] hover:text-[#2D2A26] hover:bg-[#2D2A26]/[0.03] transition-all duration-200"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <a
                href="#auth"
                className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[12px] font-bold text-white bg-[#2D2A26] hover:bg-[#3D3833] transition-all duration-300 hover:-translate-y-[1px]"
              >
                Get Started
              </a>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-xl hover:bg-[#2D2A26]/5 transition-colors"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </motion.nav>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-0 top-20 z-50 px-6 md:hidden"
          >
            <div className="bg-white/95 backdrop-blur-2xl rounded-2xl border border-[#2D2A26]/[0.06] shadow-xl p-2">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-xl text-[15px] font-semibold text-[#2D2A26] hover:bg-[#2D2A26]/[0.03] transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#auth"
                onClick={() => setMobileOpen(false)}
                className="block mx-2 mt-2 px-4 py-3 rounded-xl text-[13px] font-bold text-white bg-[#2D2A26] text-center"
              >
                Get Started Free
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default LandingHeader;
