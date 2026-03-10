import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Jenkins',
    grade: 'Senior Year',
    text: 'Atlas helped me improve my SAT score by 200 points. The personalized study plans are incredible!',
    accent: '#00D1FF',
    bg: 'bg-[#00D1FF]/8',
  },
  {
    name: 'Michael Chen',
    grade: 'Grade 11',
    text: 'The AI flashcards and practice tests made AP Bio so much more manageable. Highly recommend!',
    accent: '#F472B6',
    bg: 'bg-[#F472B6]/8',
  },
  {
    name: 'Emily Davis',
    grade: 'Junior Year',
    text: 'Study groups feature helped me connect with other students. We motivate each other every day!',
    accent: '#34D399',
    bg: 'bg-[#34D399]/8',
  },
  {
    name: 'James Wilson',
    grade: 'Sophomore Year',
    text: 'The AI Study Buddy is like having a private tutor 24/7. It explains complex concepts so simply.',
    accent: '#00D1FF',
    bg: 'bg-[#00D1FF]/8',
  },
  {
    name: 'Olivia Martinez',
    grade: 'Grade 9',
    text: 'I used to struggle with organization, but Atlas automated everything for me. Game changer!',
    accent: '#F472B6',
    bg: 'bg-[#F472B6]/8',
  },
];

const Column = ({ items, duration = 15, reverse = false, className = '' }: { items: typeof testimonials; duration?: number; reverse?: boolean; className?: string }) => (
  <div className={`overflow-hidden max-h-[760px] ${className}`}>
    <motion.div
      animate={{ translateY: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
      className="flex flex-col gap-6 pb-6"
    >
      {[...items, ...items].map((t, i) => (
        <div
          key={i}
          className="bg-white rounded-[32px] p-6 shadow-float-cyan border border-[#0A192F]/5 hover:-translate-y-1 transition-transform"
        >
          <div className="flex items-center mb-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mr-3 font-extrabold text-sm"
              style={{ backgroundColor: `${t.accent}20`, color: t.accent }}
            >
              {t.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 className="font-extrabold text-[#0A192F] tracking-tight">{t.name}</h4>
              <p className="text-[#64748B] text-sm font-medium">{t.grade}</p>
            </div>
          </div>
          <div className="flex gap-0.5 mb-3">
            {[...Array(5)].map((_, s) => (
              <Star key={s} className="w-3.5 h-3.5 fill-current" style={{ color: t.accent }} />
            ))}
          </div>
          <p className="text-[#64748B] font-medium leading-relaxed text-sm">"{t.text}"</p>
        </div>
      ))}
    </motion.div>
  </div>
);

export function LandingTestimonials() {
  return (
    <section id="testimonials" className="py-32 px-6 bg-[#F8FAFF] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-[#00D1FF]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D1FF]/10 text-[#00D1FF] rounded-full font-bold text-sm mb-6 border border-[#00D1FF]/20"
          >
            <Star className="w-4 h-4 fill-current" />
            <span>Student Stories</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#0A192F] mb-6 leading-tight">
            Loved by <br />
            <span className="text-[#00D1FF]">students worldwide.</span>
          </h2>
          <p className="text-[#64748B] text-xl font-medium max-w-2xl mx-auto">
            Join thousands of learners who've transformed their study experience with Elevenfolks.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12 max-h-[760px] overflow-hidden rounded-[40px]">
          <Column items={testimonials} duration={20} />
          <Column items={testimonials} className="hidden md:block" duration={25} reverse />
          <Column items={testimonials} className="hidden lg:block" duration={22} />
        </div>
      </div>
    </section>
  );
}

export default LandingTestimonials;
