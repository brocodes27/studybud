import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, Landmark, GraduationCap, Compass, CheckCircle2, ChevronRight, Sparkles, BookOpen, Target, Search } from 'lucide-react';

const ROADMAPS = [
  {
    id: 'ivy-league',
    name: 'Ivy League / T10 Track',
    focus: 'Holistic Excellence',
    description: 'A strategy for top-tier US universities focusing on GPA, SAT, and impactful ECs.',
    steps: [
      { year: 'Freshman', task: 'Build strong GPA foundation & join 2-3 key clubs.' },
      { year: 'Sophomore', task: 'Leadership roles in ECs & start early SAT/ACT prep.' },
      { year: 'Junior', task: 'Take SAT/ACT & AP exams. Finalize college list.' },
      { year: 'Senior', task: 'Early Decision apps & personal statement crafting.' },
    ],
    color: 'bg-neo-accent'
  },
  {
    id: 'uk-russel-group',
    name: 'UK Russell Group',
    focus: 'Subject Depth',
    description: 'Strategic roadmap for Oxford, Cambridge, and LSE focusing on A-Levels/IB.',
    steps: [
      { year: 'Year 11', task: 'Focus on GCSE scores & picking subject-specific A-Levels.' },
      { year: 'Year 12', task: 'Super-curricular reading & preparing for entrance tests (UCAT/LNAT).' },
      { year: 'Year 13', task: 'UCAS application & subject-focused personal statement.' },
    ],
    color: 'bg-neo-secondary'
  },
  {
    id: 'stem-honors',
    name: 'STEM Honors (US/UK)',
    focus: 'Technical Research',
    description: 'Path for competitive engineering and CS programs (MIT, Stanford, Imperial).',
    steps: [
      { year: 'Early', task: 'Math competitions (AMC/Olympiads) & Coding projects.' },
      { year: 'Mid', task: 'Independent research or tech internships.' },
      { year: 'Late', task: 'Showcasing technical portfolio in applications.' },
    ],
    color: 'bg-neo-muted'
  }
];

export function CollegeRoadmaps() {
  const [selected, setSelected] = useState(ROADMAPS[0]);
  const navigate = useNavigate();

  const handleConsultAtlas = () => {
    // Navigate to Atlas Workspace and set a context or prompt for the AI
    navigate('/atlas', { state: { initialMessage: `Help me create a detailed personal roadmap for the ${selected.name} track.` } });
  };

  return (
    <div className="space-y-12 animate-fade-in pb-20 text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b-8 border-white/10 pb-8">
        <div>
          <div className="flex items-center gap-6 mb-4">
            <div className="bg-neo-accent p-4 border border-white/10 shadow-neo rotate-2">
              <Map className="h-8 w-8 text-white stroke-[3px]" />
            </div>
            <div>
              <h1 className="text-5xl font-black text-slate-100 uppercase tracking-tighter italic leading-none">ROADMAPS</h1>
              <div className="bg-slate-900 text-white px-3 py-1 text-xs font-black uppercase tracking-widest inline-block mt-2">
                GLOBAL_ADMISSIONS_v1.0
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-4">
          {ROADMAPS.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={`w-full text-left p-6 border border-white/10 font-black transition-all ${selected.id === r.id ? `${r.color} -translate-y-1 shadow-neo` : 'bg-slate-800 hover:bg-slate-900 opacity-70 hover:opacity-100'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl uppercase">{r.name}</span>
                <ChevronRight className="h-6 w-6" />
              </div>
              <p className="text-[10px] mt-2 opacity-60 font-black uppercase tracking-widest">{r.focus}</p>
            </button>
          ))}

          <div className="p-8 bg-slate-900 text-white border border-white/10 shadow-neo mt-12 italic">
            <Sparkles className="h-8 w-8 mb-4 text-neo-accent" />
            <p className="font-bold text-lg leading-snug">Atlas can build a custom personal roadmap for your profile.</p>
            <button
              onClick={handleConsultAtlas}
              className="mt-6 bg-neo-accent text-slate-100 px-6 py-3 font-black uppercase text-sm hover:translate-x-1 transition-all flex items-center gap-2 shadow-neo"
            >
              CONSULT ATLAS <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="neo-card bg-slate-800 border border-white/10 p-10 shadow-neo">
            <div className="flex items-start justify-between mb-10 border-b-4 border-white/10/5 pb-8">
              <div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter">{selected.name}</h2>
                <p className="text-lg font-bold text-slate-100/40 mt-2">{selected.description}</p>
              </div>
              <Landmark className="h-16 w-16 text-slate-100/10 shrink-0" />
            </div>

            <div className="space-y-8">
              {selected.steps.map((step, i) => (
                <div key={i} className="flex gap-8 group">
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full border border-white/10 bg-slate-900 flex items-center justify-center font-black group-hover:bg-neo-secondary transition-colors text-xl">
                      {i + 1}
                    </div>
                    {i < selected.steps.length - 1 && <div className="w-1.5 bg-slate-900/10 flex-1 my-2" />}
                  </div>
                  <div className="flex-1 pb-10">
                    <div className="text-xs font-black text-neo-accent uppercase tracking-[0.2em] mb-1">{step.year}</div>
                    <div className="text-2xl font-bold leading-tight">{step.task}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-10 border-t-4 border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-white/10 p-6 flex items-center gap-5">
                <BookOpen className="h-8 w-8" />
                <div>
                  <div className="text-[10px] font-black opacity-30 tracking-widest uppercase">Required_Tests</div>
                  <div className="font-black text-sm uppercase">SAT / AP / IB / A-LEVELS</div>
                </div>
              </div>
              <div className="bg-slate-900 border border-white/10 p-6 flex items-center gap-5">
                <Target className="h-8 w-8" />
                <div>
                  <div className="text-[10px] font-black opacity-30 tracking-widest uppercase">Target_Goal</div>
                  <div className="font-black text-sm uppercase">Global Top 1% Ranking</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CollegeRoadmaps;
