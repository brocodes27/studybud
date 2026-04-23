import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Jenkins',
    grade: 'Senior Year',
    text: 'The daily prescription feature is a game changer. I open the app and know exactly what to study based on what we did in class. No more wondering "what should I do today?"',
    score: '+200 SAT pts',
    color: '#8B7355',
  },
  {
    name: 'Michael Chen',
    grade: 'Grade 11',
    text: 'I uploaded my test photo and within minutes got a full analysis of my weak topics plus a 7-day repair plan. The AI actually understands where I went wrong.',
    score: 'JEE Mains',
    color: '#A0938D',
  },
  {
    name: 'Emily Davis',
    grade: 'Junior Year',
    text: 'The AI actually remembers what I struggle with. When I miss days, it does not guilt-trip — it reschedules everything. That empathy is rare in study apps.',
    score: '14 day streak',
    color: '#C4A882',
  },
  {
    name: 'James Wilson',
    grade: 'Sophomore Year',
    text: 'Study groups + gamification makes it feel like a game. I have never been this consistent with my prep. The streak feature alone keeps me coming back daily.',
    score: '1520 SAT',
    color: '#8B7355',
  },
  {
    name: 'Priya Sharma',
    grade: 'Class 12',
    text: 'Ranjan Sir knows my weak subjects and always gives me the right task at the right time. It is genuinely like having a personal coach who remembers everything.',
    score: 'CBSE 98%',
    color: '#A0938D',
  },
  {
    name: 'Olivia Martinez',
    grade: 'Grade 9',
    text: 'I used to struggle with organization. Now everything is automated — plans, reminders, even break suggestions. My parents are shocked at my consistency.',
    score: '+150 pts',
    color: '#C4A882',
  },
];

const Column = ({
  items,
  duration = 20,
  reverse = false,
  className = '',
}: {
  items: typeof testimonials;
  duration?: number;
  reverse?: boolean;
  className?: string;
}) => (
  <div className={`overflow-hidden max-h-[680px] relative ${className}`}>
    <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#FAF8F5] to-transparent z-10 pointer-events-none" />
    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#FAF8F5] to-transparent z-10 pointer-events-none" />

    <motion.div
      animate={{ translateY: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
      className="flex flex-col gap-4 pb-4"
    >
      {[...items, ...items].map((t, i) => (
        <div
          key={i}
          className="group bg-white rounded-2xl p-5 border border-[#2D2A26]/[0.05] hover:shadow-[0_8px_32px_rgba(45,42,38,0.08)] hover:-translate-y-0.5 transition-all duration-300"
        >
          <Quote className="w-5 h-5 text-[#2D2A26]/[0.05] mb-3" />

          <div className="flex items-center gap-0.5 mb-3">
            {[...Array(5)].map((_, s) => (
              <Star key={s} className="w-3 h-3 fill-[#C4A882] text-[#C4A882]" />
            ))}
          </div>

          <p className="text-[#2D2A26]/70 font-medium leading-relaxed text-[13px] mb-4">
            "{t.text}"
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                style={{ backgroundColor: t.color }}
              >
                {t.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h4 className="font-bold text-[13px] text-[#2D2A26] tracking-tight">{t.name}</h4>
                <p className="text-[#8A8279] text-[11px] font-medium">{t.grade}</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold text-[#8B7355] bg-[#8B7355]/10 px-2.5 py-1 rounded-lg uppercase tracking-wider">
              {t.score}
            </span>
          </div>
        </div>
      ))}
    </motion.div>
  </div>
);

export function LandingTestimonials() {
  return (
    <section id="testimonials" className="py-24 md:py-32 px-6 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-[#2D2A26]/[0.06] shadow-xs mb-5"
          >
            <Star className="w-3.5 h-3.5 fill-[#C4A882] text-[#C4A882]" />
            <span className="text-[12px] font-bold text-[#8A8279] uppercase tracking-widest">Testimonials</span>
          </motion.div>
          <motion.h2
            initial={{ y: 16, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-semibold tracking-tight text-[#2D2A26] mb-3 leading-[1.05]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Loved by{' '}
            <span className="text-[#8B7355]">students worldwide.</span>
          </motion.h2>
          <motion.p
            initial={{ y: 12, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-[#8A8279] text-lg font-medium max-w-md mx-auto"
          >
            Real stories from real students using Elevenfolks every day.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[680px] overflow-hidden rounded-[28px]">
          <Column items={testimonials} duration={26} />
          <Column items={testimonials} className="hidden md:block" duration={32} reverse />
          <Column items={testimonials} className="hidden lg:block" duration={28} />
        </div>
      </div>
    </section>
  );
}

export default LandingTestimonials;
