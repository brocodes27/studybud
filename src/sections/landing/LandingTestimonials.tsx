import { motion } from 'framer-motion';

const testimonials = [
  {
    name: 'Priya Sharma',
    grade: 'Class 12',
    text: 'ElevenFolks helped me improve my JEE preparation by 40%. The personalized study plans are incredible!',
  },
  {
    name: 'Arjun Patel',
    grade: 'Class 10',
    text: 'The AI flashcards and practice tests made studying so much more effective. Highly recommend!',
  },
  {
    name: 'Sneha Reddy',
    grade: 'Class 11',
    text: 'Study groups feature helped me connect with other students. We motivate each other every day!',
  },
];

const Column = ({ items, className = '', duration = 15 }: { items: typeof testimonials; className?: string; duration?: number }) => (
  <div className={className}>
    <motion.div
      animate={{ translateY: '-50%' }}
      transition={{ duration, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
      className="flex flex-col gap-6 pb-6"
    >
      {[...new Array(2)].fill(0).map((_, dupIndex) => (
        <div key={dupIndex} className="flex flex-col gap-6">
          {items.map((t) => (
            <div key={t.text} className="rounded-xl border border-border p-6 bg-card shadow-sm">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center mr-3">
                  <span className="text-sm font-semibold">{t.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{t.name}</h4>
                  <p className="text-gray-500 text-xs">{t.grade}</p>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed">"{t.text}"</p>
            </div>
          ))}
        </div>
      ))}
    </motion.div>
  </div>
);

export function LandingTestimonials() {
  const first = testimonials;
  const second = testimonials;
  const third = testimonials;
  return (
    <section id="testimonials" className="py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-3">Loved by students worldwide</h2>
          <p className="text-gray-600">Join thousands of learners who’ve transformed their study experience.</p>
        </div>
        <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[738px] overflow-hidden">
          <Column items={first} duration={15} />
          <Column items={second} className="hidden md:block" duration={19} />
          <Column items={third} className="hidden lg:block" duration={17} />
        </div>
      </div>
    </section>
  );
}

export default LandingTestimonials;
