import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Target, Calendar, Clock, Brain,
  ChevronRight, ChevronLeft, Check,
  User, GraduationCap,
  Sparkles, Shield, Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExamType {
  code: string;
  name: string;
  description: string;
  total_score_max: number;
}

export default function Onboarding() {
  const { user } = useAuth() as any;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Data State
  const [role] = useState<'student' | 'teacher'>('student');
  const [fullName, setFullName] = useState<string>(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
  const [targetExam, setTargetExam] = useState<string>('sat');
  const [targetScore, setTargetScore] = useState<number>(1400);
  const [examDate, setExamDate] = useState<string>('');
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(10);
  const [weakAreas, setWeakAreas] = useState<string[]>([]);
  const [studyStyle] = useState<'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'balanced'>('balanced');

  const [examTypes, setExamTypes] = useState<ExamType[]>([]);

  useEffect(() => {
    fetchExamTypes();
  }, []);

  const fetchExamTypes = async () => {
    const { data } = await supabase.from('us_exam_types').select('*').eq('is_active', true);
    if (data) setExamTypes(data);
  };

  const selectedExamData = examTypes.find(e => e.code === targetExam);

  const saveOnboarding = async () => {
    if (!user || !role) return;
    try {
      setLoading(true);

      // 1. Update Profile
      const profilePayload = {
        id: user.id,
        role,
        full_name: fullName || null,
        onboarding_completed: true,
        trial_active: true,
      };
      const { error: profileError } = await supabase.from('user_profiles').upsert(profilePayload);
      if (profileError) throw profileError;

      // 2. Save Study Goals (if student)
      if (role === 'student') {
        const goalPayload = {
          user_id: user.id,
          target_exam: targetExam,
          target_score: targetScore,
          exam_date: examDate || null,
          hours_per_week: hoursPerWeek,
          weak_areas: weakAreas,
          study_style: studyStyle,
          onboarding_completed: true,
        };
        const { error: goalError } = await supabase.from('user_study_goals').upsert(goalPayload);
        if (goalError) throw goalError;
      }

      // Initialize gamification
      await supabase.from('user_gamification').upsert({
        user_id: user.id,
        total_xp: 0,
        current_level: 1,
        current_streak: 0,
      }, { onConflict: 'user_id' });

      window.location.replace('/pricing');
    } catch (e: any) {
      alert(e.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="min-h-screen bg-neo-bg flex items-center justify-center p-4 md:p-8 font-sans selection:bg-neo-accent selection:text-black">
      {/* Background patterns */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '30px 30px' }} />

      <div className="w-full max-w-2xl relative">
        {/* Progress Bar */}
        <div className="mb-12 flex items-center justify-between px-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={`
                        w-10 h-10 border-4 border-black font-black flex items-center justify-center transition-all duration-500
                        ${step >= i ? 'bg-neo-accent shadow-[4px_4px_0px_0px_#000]' : 'bg-white text-black/20'}
                        ${step === i ? 'scale-110 -rotate-3' : 'rotate-0'}
                    `}>
                {i}
              </div>
              {i < 4 && (
                <div className={`h-1 flex-1 mx-2 transition-all duration-500 ${step > i ? 'bg-black' : 'bg-black/10'}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border-8 border-black p-8 md:p-12 shadow-[20px_20px_0px_0px_#000] rotate-1"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-neo-secondary border-4 border-black p-3 -rotate-12">
                  <User className="w-8 h-8 font-black" />
                </div>
                <div>
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">WHO ARE YOU?</h1>
                  <p className="text-xs font-black text-black/40 uppercase tracking-widest mt-2">IDENTITY SETTINGS</p>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-3 opacity-40">Your Full Name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-neo-bg border-4 border-black p-5 font-black text-2xl italic focus:bg-neo-secondary outline-none transition-all shadow-none focus:shadow-[8px_8px_0px_0px_#000]"
                    placeholder="ENTER NAME..."
                  />
                </div>

                <div>
                  <div className="p-8 border-4 border-black bg-neo-accent flex flex-col items-center gap-4 transition-all">
                    <GraduationCap className="w-12 h-12" />
                    <span className="font-black text-xl italic uppercase">STUDENT IDENTITY</span>
                    <p className="text-[10px] font-bold text-center opacity-40 leading-tight">Your profile is being configured for peak learning performance</p>
                  </div>
                </div>

                <button
                  onClick={nextStep}
                  disabled={!role || !fullName}
                  className="w-full bg-black text-white p-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-accent hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000] disabled:opacity-20 flex items-center justify-center gap-4"
                >
                  NEXT <ChevronRight className="w-8 h-8" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: EXAM SELECTION (Only for students) */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border-8 border-black p-8 md:p-12 shadow-[20px_20px_0px_0px_#000] -rotate-1"
            >
              <>
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-neo-accent border-4 border-black p-3 rotate-6">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">TARGET EXAM</h1>
                    <p className="text-xs font-black text-black/40 uppercase tracking-widest mt-2">WHAT ARE WE CONQUERING?</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar mb-8">
                  {examTypes.map((exam) => (
                    <button
                      key={exam.code}
                      onClick={() => setTargetExam(exam.code)}
                      className={`
                          p-6 border-4 border-black text-left flex items-center justify-between transition-all
                          ${targetExam === exam.code ? 'bg-neo-secondary shadow-none translate-x-1 translate-y-1' : 'bg-neo-bg/10 hover:bg-neo-bg shadow-[6px_6px_0px_0px_#000]'}
                        `}
                    >
                      <div>
                        <span className="font-black text-2xl italic uppercase">{exam.name}</span>
                        <p className="text-[10px] font-bold opacity-40 uppercase max-w-[80%]">{exam.description || 'CONCENTRATE YOUR FOCUS'}</p>
                      </div>
                      {targetExam === exam.code && <div className="bg-black text-white p-2 rotate-12"><Check className="w-6 h-6" /></div>}
                    </button>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button onClick={prevStep} className="bg-white border-4 border-black p-6 font-black uppercase"><ChevronLeft className="w-8 h-8" /></button>
                  <button onClick={nextStep} className="flex-1 bg-black text-white p-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-accent shadow-[8px_8px_0px_0px_#000] transition-all flex items-center justify-center gap-4">CONTINUE</button>
                </div>
              </>
            </motion.div>
          )}

          {/* STEP 3: SCORE & SCHEDULE */}
          {step === 3 && role === 'student' && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border-8 border-black p-8 md:p-12 shadow-[20px_20px_0px_0px_#000] rotate-1"
            >
              <div className="flex items-center gap-4 mb-10">
                <div className="bg-neo-muted border-4 border-black p-3 -rotate-6">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">THE MISSION</h1>
                  <p className="text-xs font-black text-black/40 uppercase tracking-widest mt-2">GOALS & INTENSITY</p>
                </div>
              </div>

              <div className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-40">
                      <Target className="w-4 h-4" /> Target Score
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={targetScore}
                        onChange={(e) => setTargetScore(parseInt(e.target.value))}
                        className="w-full bg-neo-bg border-4 border-black p-5 font-black text-4xl italic outline-none shadow-none focus:shadow-[8px_8px_0px_0px_#000] transition-all"
                      />
                      <div className="absolute right-4 bottom-4 text-[10px] font-black opacity-30">/ {selectedExamData?.total_score_max || 'MAX'}</div>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-40">
                      <Calendar className="w-4 h-4" /> Exam Date
                    </label>
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full bg-neo-bg border-4 border-black p-5 font-black text-xl italic outline-none shadow-none focus:shadow-[8px_8px_0px_0px_#000] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] mb-6 opacity-40">
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Weekly Practice Intensity</span>
                    <span className="text-black italic font-black text-lg">{hoursPerWeek} HOURS / WEEK</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="40"
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(parseInt(e.target.value))}
                    className="w-full h-4 bg-neo-bg border-4 border-black accent-neo-accent cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] font-black mt-2 opacity-30 uppercase tracking-widest">
                    <span>Casual</span>
                    <span>Dedicated</span>
                    <span>Absolute Beast</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={prevStep} className="bg-white border-4 border-black p-6 font-black uppercase"><ChevronLeft className="w-8 h-8" /></button>
                  <button onClick={nextStep} className="flex-1 bg-black text-white p-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-accent shadow-[8px_8px_0px_0px_#000] transition-all flex items-center justify-center gap-4">FINAL STEP</button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: WEAK AREAS & FINISH */}
          {step === 4 && role === 'student' && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border-8 border-black p-8 md:p-12 shadow-[20px_20px_0px_0px_#000] -rotate-1"
            >
              <div className="flex items-center gap-4 mb-10">
                <div className="bg-neo-secondary border-4 border-black p-3 rotate-12">
                  <Brain className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">PRE-DIAGNOSIS</h1>
                  <p className="text-xs font-black text-black/40 uppercase tracking-widest mt-2">WHERE DO WE START?</p>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-40">SELECT YOUR STRUGGLE (OPTIONAL)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Algebra', 'Geometry', 'Trig', 'Reading', 'Writing', 'Data Analysis', 'Calculus', 'Vocabulary'].map((area) => (
                      <button
                        key={area}
                        onClick={() => {
                          setWeakAreas(areas =>
                            areas.includes(area) ? areas.filter(a => a !== area) : [...areas, area]
                          );
                        }}
                        className={`
                                        p-4 border-2 border-black font-black text-xs uppercase tracking-tight transition-all
                                        ${weakAreas.includes(area) ? 'bg-neo-accent shadow-none translate-x-0.5 translate-y-0.5' : 'bg-white shadow-[3px_3px_0px_0px_#000] hover:bg-neo-bg'}
                                    `}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-neo-bg border-4 border-black p-6">
                  <h5 className="font-black uppercase text-xs mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> THE ATLAS PROMISE</h5>
                  <p className="text-xs font-bold leading-relaxed opacity-60">I will architect a plan that converts these weaknesses into high-performance metrics. Your streak starts today.</p>
                </div>

                <div className="flex gap-4">
                  <button onClick={prevStep} className="bg-white border-4 border-black p-6 font-black uppercase"><ChevronLeft className="w-8 h-8" /></button>
                  <button
                    onClick={nextStep}
                    className="flex-1 bg-neo-accent text-black p-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-ink hover:text-white shadow-[8px_8px_0px_0px_#000] transition-all flex items-center justify-center gap-4 group"
                  >
                    CONTINUE
                    <ChevronRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: TRIAL & PAYMENT */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border-8 border-black p-8 md:p-12 shadow-[20px_20px_0px_0px_#000] rotate-1"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-neo-secondary border-4 border-black p-3 -rotate-12">
                  <Crown className="w-8 h-8 text-black" />
                </div>
                <div>
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">START YOUR TRIAL</h1>
                  <p className="text-xs font-black text-black/40 uppercase tracking-widest mt-2">7 DAYS FREE ACCESS</p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-neo-bg border-4 border-black p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-black text-white px-4 py-1 font-black text-[10px] uppercase rotate-45 translate-x-4 translate-y-2">LIMITED</div>
                  <h3 className="text-2xl font-black uppercase italic mb-2 tracking-tighter">7-DAY FREE NEURO TRIAL</h3>
                  <p className="text-sm font-bold opacity-60 leading-tight mb-6">Experience full neural augmentation, smart plans, and college roadmaps free for 7 days. Then just $5/mo.</p>

                  <ul className="space-y-3">
                    {['Full AI Strategy', 'US College Roadmaps', 'Unlimited Mock Exams'].map(f => (
                      <li key={f} className="flex items-center gap-3 text-xs font-black uppercase tracking-tight">
                        <div className="w-4 h-4 bg-neo-accent border-2 border-black flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={saveOnboarding}
                    disabled={loading}
                    className="w-full bg-neo-accent text-black p-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-black hover:text-white shadow-[8px_8px_0px_0px_#000] transition-all flex items-center justify-center gap-4 group"
                  >
                    {loading ? 'INITIALIZING...' : 'COMPLETE ONBOARDING'}
                    <ChevronRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
                  </button>

                  <p className="text-center text-[10px] font-bold opacity-30 uppercase tracking-widest">YOU WON'T BE CHARGED FOR 7 DAYS</p>
                </div>

                <button onClick={prevStep} className="w-full text-black/40 font-black uppercase text-[10px] tracking-widest hover:text-black transition-colors">BACK TO MISSION</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
