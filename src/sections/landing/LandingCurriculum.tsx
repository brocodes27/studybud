import { motion } from 'framer-motion';
import { BookOpen, FlaskConical, Calculator, ChevronRight, Calendar } from 'lucide-react';

const weekData = [
  { week: 1, physics: 'Kinematics', chemistry: 'Mole Concept & Atomic Structure', math: 'Complex Numbers & Quadratics', type: 'lecture' },
  { week: 2, physics: 'Laws of Motion', chemistry: 'Chemical Bonding', math: 'Permutations & Combinations', type: 'test' },
  { week: 3, physics: 'Work, Energy & Power', chemistry: 'Thermodynamics', math: 'Binomial Theorem', type: 'lecture' },
  { week: 4, physics: 'Electrostatics', chemistry: 'Hydrocarbons', math: 'Sequences & Series', type: 'test' },
  { week: 5, physics: 'Current Electricity', chemistry: 'Basic Organic Concepts', math: 'Straight Lines', type: 'lecture' },
  { week: 6, physics: 'Magnetic Effects', chemistry: 'Halogen Derivatives', math: 'Circles', type: 'test' },
  { week: 7, physics: 'EMI & AC Basics', chemistry: 'Alcohols & Ethers', math: 'Parabola', type: 'lecture' },
  { week: 8, physics: 'Revision — Mechanics', chemistry: 'Revision — Organic Basics', math: 'Revision — Algebra & Coordinate', type: 'major' },
];

const subjectColors: Record<string, string> = {
  physics: 'bg-[#8B7355]/10 text-[#8B7355] border-[#8B7355]/20',
  chemistry: 'bg-[#A0938D]/10 text-[#A0938D] border-[#A0938D]/20',
  math: 'bg-[#C4A882]/10 text-[#C4A882] border-[#C4A882]/20',
};

const subjectIcons = {
  physics: BookOpen,
  chemistry: FlaskConical,
  math: Calculator,
};

export function LandingCurriculum() {
  return (
    <section id="curriculum" className="py-24 md:py-32 px-6 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-lg mx-auto mb-14">
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-[#2D2A26]/[0.06] shadow-xs mb-5"
          >
            <Calendar className="w-3.5 h-3.5 text-[#8B7355]" />
            <span className="text-[12px] font-bold text-[#8A8279] uppercase tracking-widest">Curriculum</span>
          </motion.div>
          <motion.h2
            initial={{ y: 16, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-semibold tracking-tight text-[#2D2A26] mb-4 leading-[1.05]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            A plan built for{' '}
            <span className="text-[#8B7355]">your batch.</span>
          </motion.h2>
          <motion.p
            initial={{ y: 12, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-[#8A8279] text-lg font-medium"
          >
            JEE Mains + Advanced 2026 — 52 weeks, 22 tests, full syllabus coverage.
          </motion.p>
        </div>

        {/* Schedule cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {[
            { label: 'Total Weeks', value: '52', color: '#8B7355' },
            { label: 'Tests Scheduled', value: '22', color: '#A0938D' },
            { label: 'Subjects', value: '3', color: '#C4A882' },
            { label: 'Topics Covered', value: '120+', color: '#8B7355' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl border border-[#2D2A26]/[0.05] p-5 text-center hover:shadow-[0_8px_30px_rgba(45,42,38,0.06)] transition-shadow"
            >
              <p className="text-3xl font-semibold mb-1" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-[11px] font-bold text-[#8A8279] uppercase tracking-wider">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Week timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-[#2D2A26]/[0.05] shadow-[0_4px_24px_rgba(45,42,38,0.04)] overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[#2D2A26]/[0.04]">
                  <th className="text-left px-5 py-3.5 text-[10px] font-bold text-[#8A8279] uppercase tracking-widest w-20">Week</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-bold text-[#8A8279] uppercase tracking-widest">Physics</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-bold text-[#8A8279] uppercase tracking-widest">Chemistry</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-bold text-[#8A8279] uppercase tracking-widest">Mathematics</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-bold text-[#8A8279] uppercase tracking-widest w-24">Type</th>
                </tr>
              </thead>
              <tbody>
                {weekData.map((row, i) => (
                  <motion.tr
                    key={row.week}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-[#2D2A26]/[0.03] hover:bg-[#FAF8F5] transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-[12px] font-bold text-[#2D2A26]">W{row.week}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-[#8B7355]" />
                        <span className="text-[12px] font-medium text-[#2D2A26]">{row.physics}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-3.5 h-3.5 text-[#A0938D]" />
                        <span className="text-[12px] font-medium text-[#2D2A26]">{row.chemistry}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-3.5 h-3.5 text-[#C4A882]" />
                        <span className="text-[12px] font-medium text-[#2D2A26]">{row.math}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        row.type === 'test'
                          ? 'bg-[#8B7355]/10 text-[#8B7355]'
                          : row.type === 'major'
                          ? 'bg-[#A0938D]/10 text-[#A0938D]'
                          : 'bg-[#F5F0E8] text-[#8A8279]'
                      }`}>
                        {row.type}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[#2D2A26]/[0.04] bg-[#FAF8F5]">
            <p className="text-[11px] text-[#8A8279] font-medium flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3" />
              Showing first 8 weeks of 52. Full curriculum available after enrollment.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default LandingCurriculum;
