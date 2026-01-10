import { motion } from 'framer-motion';

const testimonials = [
  {
    name: 'Priya Sharma',
    grade: 'Class 12',
    text: 'ElevenFolks helped me improve my JEE preparation by 40%. The personalized study plans are incredible!',
    color: 'bg-neo-accent'
  },
  {
    name: 'Arjun Patel',
    grade: 'Class 10',
    text: 'The AI flashcards and practice tests made studying so much more effective. Highly recommend!',
    color: 'bg-neo-secondary'
  },
  {
    name: 'Sneha Reddy',
    grade: 'Class 11',
    text: 'Study groups feature helped me connect with other students. We motivate each other every day!',
    color: 'bg-neo-muted'
  },
  {
    name: 'Vikram Singh',
    grade: 'Class 12',
    text: 'The AI Study Buddy is like having a private tutor 24/7. It explains complex concepts so simply.',
    color: 'bg-neo-accent'
  },
  {
    name: 'Ananya Iyer',
    grade: 'Class 9',
    text: 'I used to struggle with organization, but ElevenFolks automated everything for me. Game changer!',
    color: 'bg-neo-secondary'
  }
];

const Column = ({ items, className = '', duration = 15, reverse = false }: { items: typeof testimonials; className?: string; duration?: number; reverse?: boolean }) => (
  <div className={`overflow-hidden max-h-[800px] ${className}`}>
    <motion.div
      animate={{ translateY: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
      className="flex flex-col gap-8 pb-8"
    >
      {[...items, ...items].map((t, i) => (
        <div
          key={i}
          className={`neo-card bg-white ${i % 2 === 0 ? 'rotate-1' : '-rotate-1'} hover:rotate-0 p-8`}
        >
          <div className="flex items-center mb-6">
            <div className={`w-14 h-14 border-4 border-black flex items-center justify-center mr-4 shadow-[3px_3px_0px_0px_#000] ${t.color}`}>
              <span className="text-xl font-black italic">{t.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
            </div>
            <div>
              <h4 className="text-xl font-black uppercase tracking-tight text-black">{t.name}</h4>
              <p className="text-black/50 font-bold uppercase text-sm">{t.grade}</p>
            </div>
          </div>
          <p className="text-black/80 font-bold text-lg leading-snug italic">"{t.text}"</p>
        </div>
      ))}
    </motion.div>
  </div>
);

export function LandingTestimonials() {
  return (
    <section id="testimonials" className="py-32 px-6 bg-neo-bg relative border-t-8 border-black overflow-hidden">
      {/* Halftone Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '20px 20px' }} />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <motion.span
            initial={{ rotate: 1 }}
            whileInView={{ rotate: -1 }}
            className="sticker bg-neo-secondary border-4 border-black mb-4 px-6 text-sm py-2"
          >
            TESTIMONIALS
          </motion.span>
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-black mt-6 leading-none">
            LOVED BY <span className="text-neo-accent italic underline decoration-8">STUDENTS</span><br />
            WORLDWIDE
          </h2>
          <p className="text-black/60 mt-6 text-xl font-bold max-w-2xl mx-auto">
            Join thousands of learners who've transformed their study experience with ElevenFolks.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16 max-h-[800px] overflow-hidden rounded-none border-4 border-black bg-black/5">
          <Column items={testimonials} duration={20} />
          <Column items={testimonials} className="hidden md:block" duration={25} reverse={true} />
          <Column items={testimonials} className="hidden lg:block" duration={22} />
        </div>
      </div>
    </section>
  );
}

export default LandingTestimonials;

