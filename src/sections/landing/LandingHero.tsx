import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Network, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LandingHero() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20 pb-16">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(139,115,85,0.06) 0%, transparent 60%)`
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        {/* Logo / Brand */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-[#8B7355]">
              <path d="M20 4C12 4 6 10 6 18c0 5 2.5 9.5 6.5 12.5L20 38l7.5-7.5C31.5 27.5 34 23 34 18c0-8-6-14-14-14z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M14 18c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5-2.5 5.5-6 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M20 12.5v-3M20 28.5v-3M12.5 20h-3M30.5 20h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold text-[#2D2A26] tracking-tight mb-3"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            elevenfolks
          </h1>
          <p className="text-[15px] text-[#8A8279] font-medium tracking-wide">
            Your AI study companion
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          <div className="relative max-w-lg mx-auto">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8279]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M7 12.5C10.0376 12.5 12.5 10.0376 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5Z" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M10.5 10.5L14.5 14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="What would you like to explore with elevenfolks today?"
              className="w-full pl-11 pr-5 py-3.5 bg-white border border-[#E8E2D9] rounded-full text-sm text-[#2D2A26] placeholder:text-[#B5AEA5] focus:outline-none focus:border-[#8B7355]/40 focus:ring-2 focus:ring-[#8B7355]/10 transition-all shadow-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate('/signup');
                }
              }}
            />
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16"
        >
          <button
            onClick={() => navigate('/signup')}
            className="inline-flex items-center gap-2 px-7 py-2.5 bg-[#2D2A26] text-white text-sm font-semibold rounded-full hover:bg-[#3D3833] transition-colors shadow-md"
          >
            Start thinking
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto mb-16"
        >
          <div className="flex flex-col items-center text-center p-5">
            <div className="w-14 h-14 mb-4 text-[#8B7355]">
              <BookOpen className="w-full h-full" strokeWidth={1.2} />
            </div>
            <h3 className="text-sm font-semibold text-[#2D2A26] mb-1.5" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              AI-Assisted Notes
            </h3>
            <p className="text-xs text-[#8A8279] leading-relaxed max-w-[200px]">
              elevenfolks AI assists in reviewing your course materials and motivations.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-5">
            <div className="w-14 h-14 mb-4 text-[#8B7355]">
              <Network className="w-full h-full" strokeWidth={1.2} />
            </div>
            <h3 className="text-sm font-semibold text-[#2D2A26] mb-1.5" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Structured Planning
            </h3>
            <p className="text-xs text-[#8A8279] leading-relaxed max-w-[200px]">
              Prepare a structured planning, outline your future, not a mind map.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-5">
            <div className="w-14 h-14 mb-4 text-[#8B7355]">
              <Calendar className="w-full h-full" strokeWidth={1.2} />
            </div>
            <h3 className="text-sm font-semibold text-[#2D2A26] mb-1.5" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Knowledge Management
            </h3>
            <p className="text-xs text-[#8A8279] leading-relaxed max-w-[200px]">
              Creative with knowledge management, momentum, and data creation.
            </p>
          </div>
        </motion.div>

        {/* Testimonial */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md mx-auto"
        >
          <div className="bg-[#F5F0E8] rounded-2xl p-6 border border-[#E8E2D9]">
            <p className="text-sm text-[#2D2A26] leading-relaxed italic mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              &ldquo;elevenfolks helps me organize my thoughts with clarity and creativity.&rdquo;
            </p>
            <p className="text-xs text-[#8A8279] font-medium">
              — Dr. Arya Sharma
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
