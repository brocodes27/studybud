import { Brain, Target, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingFeatures() {
  return (
    <section id="features" className="py-32 px-6 bg-white relative">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F472B6]/10 text-[#F472B6] rounded-full font-bold text-sm mb-6 border border-[#F472B6]/20"
          >
            <span>Supercharged Learning</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#0A192F] mb-6 leading-tight">
            Built for your <br />
            <span className="text-[#00D1FF]">productivity.</span>
          </h2>
          <p className="text-[#64748B] text-xl font-medium">From custom study planning to dynamic exam simulators, we provide exactly what you need to succeed.</p>
        </div>

        <div className="flex flex-col gap-24">

          {/* Feature 1 - Zig */}
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="flex-1"
            >
              <div className="w-20 h-20 bg-[#00D1FF]/10 rounded-[24px] flex items-center justify-center mb-6 border border-[#00D1FF]/20 shadow-[0_8px_16px_rgba(0,209,255,0.15)]">
                <Brain className="w-10 h-10 text-[#00D1FF] stroke-[2.5px]" />
              </div>
              <h3 className="font-extrabold text-3xl text-[#0A192F] mb-6 tracking-tight">AI Study Buddy</h3>
              <p className="text-[#64748B] text-lg font-medium leading-relaxed mb-6">
                Context-aware answers that tap directly into your personal notes and chat memory. No more searching manuals or wrestling with generic chatbots.
              </p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              className="flex-1 w-full"
            >
              <div className="aspect-[4/3] bg-[#0A192F]/5 rounded-[40px] flex items-center justify-center border-4 border-white shadow-float-cyan relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#00D1FF]/20 to-transparent opacity-50" />
                <Brain className="w-32 h-32 text-[#00D1FF] opacity-80" />
              </div>
            </motion.div>
          </div>

          {/* Feature 2 - Zag */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-20">
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="flex-1"
            >
              <div className="w-20 h-20 bg-[#F472B6]/10 rounded-[24px] flex items-center justify-center mb-6 border border-[#F472B6]/20 shadow-[0_8px_16px_rgba(244,114,182,0.15)]">
                <Target className="w-10 h-10 text-[#F472B6] stroke-[2.5px]" />
              </div>
              <h3 className="font-extrabold text-3xl text-[#0A192F] mb-6 tracking-tight">Personalized Plans</h3>
              <p className="text-[#64748B] text-lg font-medium leading-relaxed mb-6">
                Generate day-wise schedules perfectly tailored to your syllabus and timeline. Exactly what you need, right when you need it most.
              </p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              className="flex-1 w-full"
            >
              <div className="aspect-[4/3] bg-[#0A192F]/5 rounded-[40px] flex items-center justify-center border-4 border-white shadow-float-pink relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tl from-[#F472B6]/20 to-transparent opacity-50" />
                <Target className="w-32 h-32 text-[#F472B6] opacity-80" />
              </div>
            </motion.div>
          </div>

          {/* Feature 3 - Zig */}
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="flex-1"
            >
              <div className="w-20 h-20 bg-[#34D399]/10 rounded-[24px] flex items-center justify-center mb-6 border border-[#34D399]/20 shadow-[0_8px_16px_rgba(52,211,153,0.15)]">
                <BarChart3 className="w-10 h-10 text-[#34D399] stroke-[2.5px]" />
              </div>
              <h3 className="font-extrabold text-3xl text-[#0A192F] mb-6 tracking-tight">Exam Simulators</h3>
              <p className="text-[#64748B] text-lg font-medium leading-relaxed mb-6">
                Practice with highly adaptive SAT and AP test simulators featuring robust section resume. Feel the heat of the exam room before the big day.
              </p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              className="flex-1 w-full"
            >
              <div className="aspect-[4/3] bg-[#0A192F]/5 rounded-[40px] flex items-center justify-center border-4 border-white shadow-float-mint relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#34D399]/20 to-transparent opacity-50" />
                <BarChart3 className="w-32 h-32 text-[#34D399] opacity-80" />
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}

export default LandingFeatures;

