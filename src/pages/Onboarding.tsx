import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAnalytics } from '../hooks/useAnalytics';
import {
  Target, Calendar, Clock, Brain,
  ChevronRight, ChevronLeft, Check,
  User, GraduationCap,
  Sparkles, Shield, Crown,
  BookOpen, Layers, Flame, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExamType {
  code: string;
  name: string;
  description: string;
  total_score_max: number;
}

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [role] = useState<'student' | 'teacher'>((user?.user_metadata?.role as 'student' | 'teacher') || 'student');
  const [fullName, setFullName] = useState<string>(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
  const [targetExam, setTargetExam] = useState<string>('jee');
  const [targetScore, setTargetScore] = useState<number>(180);
  const [examDate, setExamDate] = useState<string>('');
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(10);
  const [weakAreas, setWeakAreas] = useState<string[]>([]);
  const [studyStyle] = useState<'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'balanced'>('balanced');

  // Roadmap Engine States
  const [instituteChoice, setInstituteChoice] = useState<'template' | 'custom' | 'join_class'>('template');
  const [instituteName, setInstituteName] = useState<string>('Standard JEE');
  const [batchName, setBatchName] = useState<string>('');
  const [yearLevel, setYearLevel] = useState<'11' | '12' | 'Dropper'>('11');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [classCode, setClassCode] = useState<string>('');
  const [accountType, setAccountType] = useState<string>('b2c_student');

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      const { data } = await supabase.from('user_profiles').select('account_type').eq('id', user.id).single();
      if (data?.account_type) {
        setAccountType(data.account_type);
        if (data.account_type === 'school_student') {
          setInstituteChoice('join_class');
        }
      }
    }
    loadProfile();
  }, [user]);

  const examTypes: ExamType[] = [
    { code: 'jee', name: 'JEE (Mains + Advanced)', description: 'Joint Entrance Examination for IITs and NITs', total_score_max: 360 }
  ];
  const [coachingTemplates, setCoachingTemplates] = useState<any[]>([]);

  useEffect(() => {
    fetchCoachingTemplates();
  }, []);

  const fetchCoachingTemplates = async () => {
    const { data } = await supabase.from('coaching_templates').select('id, institute_name, program, year_level, description, total_weeks');
    if (data) {
       setCoachingTemplates(data);
       const defaultTmpl = data.find(t => t.institute_name === 'Standard JEE');
       if (defaultTmpl) setActiveTemplateId(defaultTmpl.id);
    }
  };

  const selectedExamData = examTypes.find(e => e.code === targetExam);

  const saveOnboarding = async () => {
    if (!user || !role) return;
    try {
      setLoading(true);

      const profilePayload = {
        id: user.id,
        role,
        full_name: fullName || null,
        onboarding_completed: true,
        trial_active: false,
      };
      const { error: profileError } = await supabase.from('user_profiles').upsert(profilePayload);
      if (profileError) throw profileError;

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

        if (accountType === 'school_student' || instituteChoice === 'join_class') {
          const trimmed = (accountType === 'school_student' ? classCode : classCode).trim();
          if (!trimmed) {
            throw new Error('Please enter a class code or invite link to join your school class.');
          }
          let result;
          if (trimmed.length <= 10 && !trimmed.includes('/')) {
            result = await supabase.rpc('join_class', { p_class_code: trimmed });
          } else {
            const slug = trimmed.replace(/^.*\/join\//, '');
            result = await supabase.rpc('join_class_by_invite', { p_invite_link: slug });
          }
          if (result.error) throw new Error(result.error.message);
        } else {
          // Trigger Roadmap Engine Onboarding Edge Function (B2C only)
          await supabase.functions.invoke('roadmap-onboarding', {
            body: {
              template_id: instituteChoice === 'template' ? activeTemplateId : null,
              institute_name: instituteChoice === 'template' ? coachingTemplates.find(t=>t.id===activeTemplateId)?.institute_name : instituteName,
              year_level: yearLevel,
              current_week: currentWeek,
              batch_name: batchName || 'Standard'
            }
          });
        }
      }

      await supabase.from('user_gamification').upsert({
        user_id: user.id,
        total_xp: 0,
        current_level: 1,
        current_streak: 0,
      }, { onConflict: 'user_id' });

      await refreshProfile();
      track('onboarding_complete', { role, target_exam: targetExam, year_level: yearLevel });
      navigate(role === 'teacher' ? '/my-classes' : '/prove-it?subject=JEE%20Physics&topic=Rotational%20Dynamics');
    } catch (e: any) {
      alert(e.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#00D1FF]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#F472B6]/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        {/* Progress Steps */}
        <div className="mb-10 flex items-center justify-between px-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm transition-all duration-300 border-2 ${step >= i ? 'bg-[#00D1FF] border-[#00D1FF] text-white shadow-float-cyan' : 'bg-white border-[#0A192F]/10 text-[#64748B]'} ${step === i ? 'scale-110' : ''}`}>
                {step > i ? <Check className="w-4 h-4" /> : i}
              </div>
              {i < 5 && (
                <div className={`h-1 flex-1 mx-2 rounded-full transition-all duration-500 ${step > i ? 'bg-[#00D1FF]/30' : 'bg-[#0A192F]/5'}`} />
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
              className="neo-card"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[18px] flex items-center justify-center shadow-float-cyan">
                  <User className="w-7 h-7 text-[#00D1FF]" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-[#0A192F] tracking-tight">Who are you?</h1>
                  <p className="text-xs font-medium text-[#64748B] mt-1">Let's set up your profile</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Your Full Name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-2 border-[#0A192F]/10 text-[#0A192F] font-semibold text-lg focus:outline-none focus:border-[#00D1FF]/40 bg-white placeholder-[#64748B]/40"
                    placeholder="Enter your name..."
                  />
                </div>

                {role === 'student' ? (
                  <div className="p-5 bg-[#00D1FF]/5 rounded-[16px] border-2 border-[#00D1FF]/15 flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[12px] flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-[#00D1FF]" />
                    </div>
                    <div>
                      <p className="font-extrabold text-[#0A192F] tracking-tight">Student Account</p>
                      <p className="text-xs font-medium text-[#64748B]">Profile configured for peak learning performance</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 bg-[#8B7355]/5 rounded-[16px] border-2 border-[#8B7355]/15 flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#8B7355]/10 border border-[#8B7355]/20 rounded-[12px] flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-[#8B7355]" />
                    </div>
                    <div>
                      <p className="font-extrabold text-[#0A192F] tracking-tight">Teacher Account</p>
                      <p className="text-xs font-medium text-[#64748B]">Create classes, assign tasks, and track student progress</p>
                    </div>
                  </div>
                )}

                {role === 'teacher' ? (
                  <button
                    onClick={saveOnboarding}
                    disabled={!fullName || loading}
                    className="neo-button w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {loading ? 'Setting up...' : 'Get Started'} <ChevronRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={nextStep}
                    disabled={!role || !fullName}
                    className="neo-button w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    Next <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 2: EXAM SELECTION */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="neo-card"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-[#F472B6]/10 border border-[#F472B6]/20 rounded-[18px] flex items-center justify-center">
                  <Target className="w-7 h-7 text-[#F472B6]" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-[#0A192F] tracking-tight">Target Exam</h1>
                  <p className="text-xs font-medium text-[#64748B] mt-1">What are we preparing for?</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 mb-6">
                {examTypes.map((exam) => (
                  <button
                    key={exam.code}
                    onClick={() => setTargetExam(exam.code)}
                    className={`w-full p-4 rounded-[16px] border-2 text-left flex items-center justify-between transition-all ${targetExam === exam.code ? 'bg-[#00D1FF]/10 border-[#00D1FF] shadow-float-cyan' : 'bg-[#F8FAFF] border-[#0A192F]/5 hover:border-[#00D1FF]/30'}`}
                  >
                    <div>
                      <span className="font-extrabold text-[#0A192F] tracking-tight">{exam.name}</span>
                      {exam.description && <p className="text-xs font-medium text-[#64748B] mt-0.5">{exam.description}</p>}
                    </div>
                    {targetExam === exam.code && (
                      <div className="w-7 h-7 bg-[#00D1FF] rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={prevStep} className="w-12 h-12 rounded-[12px] border-2 border-[#0A192F]/10 flex items-center justify-center text-[#64748B] hover:border-[#0A192F]/20 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextStep} className="flex-1 neo-button py-3 flex items-center justify-center gap-2">
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: SCORE & SCHEDULE */}
          {step === 3 && role === 'student' && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="neo-card"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-[#34D399]/10 border border-[#34D399]/20 rounded-[18px] flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-[#34D399]" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-[#0A192F] tracking-tight">Your Mission</h1>
                  <p className="text-xs font-medium text-[#64748B] mt-1">Goals and study intensity</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">
                      <Target className="w-3.5 h-3.5" /> Target Score
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={targetScore}
                        onChange={(e) => setTargetScore(parseInt(e.target.value))}
                        className="w-full px-4 py-3.5 rounded-[14px] border-2 border-[#0A192F]/10 text-[#0A192F] font-extrabold text-2xl focus:outline-none focus:border-[#34D399]/40 bg-white"
                      />
                      <div className="absolute right-4 bottom-3 text-xs font-medium text-[#64748B]">/ {selectedExamData?.total_score_max || '—'}</div>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">
                      <Calendar className="w-3.5 h-3.5" /> Exam Date
                    </label>
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-[14px] border-2 border-[#0A192F]/10 text-[#0A192F] font-semibold focus:outline-none focus:border-[#34D399]/40 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center justify-between text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Weekly Practice</span>
                    <span className="text-[#0A192F] font-extrabold">{hoursPerWeek} hrs/week</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="40"
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(parseInt(e.target.value))}
                    className="w-full h-2 rounded-full accent-[#00D1FF] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-medium text-[#64748B] mt-2">
                    <span>Casual</span>
                    <span>Dedicated</span>
                    <span>All-in</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={prevStep} className="w-12 h-12 rounded-[12px] border-2 border-[#0A192F]/10 flex items-center justify-center text-[#64748B] hover:border-[#0A192F]/20 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={nextStep} className="flex-1 neo-button py-3 flex items-center justify-center gap-2">
                    Final Step <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: WEAK AREAS */}
          {step === 4 && role === 'student' && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="neo-card"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-[#0A192F]/5 border border-[#0A192F]/10 rounded-[18px] flex items-center justify-center">
                  <Brain className="w-7 h-7 text-[#0A192F]" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-[#0A192F] tracking-tight">Where to focus?</h1>
                  <p className="text-xs font-medium text-[#64748B] mt-1">Select your weak areas (optional)</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-2">
                  {['Mechanics', 'Electrostatics', 'Organic Chemistry', 'Physical Chemistry', 'Calculus', 'Coordinate Geometry', 'Algebra', 'Vectors'].map((area) => (
                    <button
                      key={area}
                      onClick={() => setWeakAreas(areas => areas.includes(area) ? areas.filter(a => a !== area) : [...areas, area])}
                      className={`p-3.5 rounded-[12px] border-2 font-semibold text-sm transition-all flex items-center gap-2 ${weakAreas.includes(area) ? 'bg-[#00D1FF]/10 border-[#00D1FF] text-[#00D1FF]' : 'bg-[#F8FAFF] border-[#0A192F]/5 text-[#64748B] hover:border-[#00D1FF]/30'}`}
                    >
                      {weakAreas.includes(area) && <Check className="w-4 h-4 shrink-0" />}
                      {area}
                    </button>
                  ))}
                </div>

                <div className="bg-[#F8FAFF] rounded-[16px] border-2 border-[#0A192F]/5 p-5">
                  <h5 className="font-bold text-[#0A192F] text-sm mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#34D399]" /> Our Promise
                  </h5>
                  <p className="text-sm font-medium text-[#64748B] leading-relaxed">We'll turn your JEE weak areas into verified mastery credentials. Your first Prove-It starts today.</p>
                </div>

                <div className="flex gap-3">
                  <button onClick={prevStep} className="w-12 h-12 rounded-[12px] border-2 border-[#0A192F]/10 flex items-center justify-center text-[#64748B] hover:border-[#0A192F]/20 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextStep}
                    className="flex-1 neo-button py-3 flex items-center justify-center gap-2 group"
                  >
                    Continue
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: ROADMAP SETUP */}
          {step === 5 && role === 'student' && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="neo-card"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 rounded-[18px] flex items-center justify-center">
                  <Calendar className="w-7 h-7 text-[#8B5CF6]" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-[#0A192F] tracking-tight">Pick Your Path</h1>
                  <p className="text-xs font-medium text-[#64748B] mt-1">Choose a structured roadmap or build your own</p>
                </div>
              </div>

              <div className="space-y-5">

                {/* Mode Toggle — school students only see Join a Class */}
                <div className="bg-[#F8FAFF] p-1 rounded-[14px] flex">
                  {accountType !== 'school_student' && (
                    <button
                      onClick={() => setInstituteChoice('template')}
                      className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all ${instituteChoice === 'template' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
                    >
                      <Layers className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                      Coaching Roadmap
                    </button>
                  )}
                  <button
                    onClick={() => setInstituteChoice('join_class')}
                    className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all ${instituteChoice === 'join_class' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
                  >
                    <MapPin className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                    Join a Class
                  </button>
                  {accountType !== 'school_student' && (
                    <button
                      onClick={() => setInstituteChoice('custom')}
                      className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all ${instituteChoice === 'custom' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
                    >
                      <BookOpen className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                      Self Study
                    </button>
                  )}
                </div>

                {/* Join Class Input */}
                {instituteChoice === 'join_class' && (
                  <div>
                    <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Class Code or Invite Link</label>
                    <input
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value)}
                      placeholder="Paste class code or invite link..."
                      className="w-full px-4 py-3.5 rounded-[14px] border-2 border-[#0A192F]/10 text-[#0A192F] font-semibold text-sm focus:outline-none focus:border-[#00D1FF]/40 bg-white"
                    />
                    <p className="text-xs text-[#64748B] mt-1.5">Ask your teacher for the class code or invite link.</p>
                  </div>
                )}

                {/* Template Cards */}
                {instituteChoice === 'template' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider">Available Roadmaps</label>
                    <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                      {coachingTemplates.map((t) => {
                        const selected = activeTemplateId === t.id;
                        const programColor = t.program === 'JEE' ? 'bg-[#00D1FF]/10 text-[#00D1FF]' : t.program === 'CBSE' ? 'bg-[#F472B6]/10 text-[#F472B6]' : 'bg-[#8B5CF6]/10 text-[#8B5CF6]';
                        return (
                          <button
                            key={t.id}
                            onClick={() => { setActiveTemplateId(t.id); setYearLevel(t.year_level); setCurrentWeek(1); }}
                            className={`w-full text-left p-4 rounded-[16px] border-2 transition-all ${selected ? 'border-[#00D1FF] bg-[#00D1FF]/5 shadow-float-cyan' : 'border-[#0A192F]/5 bg-white hover:border-[#0A192F]/10'}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide ${programColor}`}>
                                  {t.program}
                                </span>
                                <span className="text-[10px] font-bold text-[#64748B] bg-[#F8FAFF] px-2 py-0.5 rounded-full">
                                  Class {t.year_level}
                                </span>
                              </div>
                              {selected && <Check className="w-4 h-4 text-[#00D1FF]" />}
                            </div>
                            <h3 className="font-bold text-[#0A192F] text-sm mb-1">{t.institute_name}</h3>
                            <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed">{t.description}</p>
                            <div className="flex items-center gap-3 mt-2.5">
                              <span className="flex items-center gap-1 text-[10px] font-bold text-[#64748B]">
                                <Flame className="w-3 h-3 text-[#FBBF24]" />
                                {t.total_weeks} Weeks
                              </span>
                              <span className="flex items-center gap-1 text-[10px] font-bold text-[#64748B]">
                                <Calendar className="w-3 h-3 text-[#8B5CF6]" />
                                {t.total_weeks >= 50 ? 'Full Year' : t.total_weeks >= 40 ? 'Board Cycle' : 'Short Term'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Self Study */}
                {instituteChoice === 'custom' && (
                  <div>
                    <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Give Your Plan a Name</label>
                    <input
                      value={instituteName}
                      onChange={(e) => setInstituteName(e.target.value)}
                      placeholder="E.g. Online Self Paced JEE"
                      className="w-full px-4 py-3.5 rounded-[14px] border-2 border-[#0A192F]/10 text-[#0A192F] font-semibold text-sm focus:outline-none focus:border-[#00D1FF]/40 bg-white"
                    />
                  </div>
                )}

                {/* Batch Name */}
                <div>
                  <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Batch / Group Name <span className="normal-case font-medium text-[#94A3B8]">(optional)</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <input
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="E.g. Morning Batch, Alpha Group"
                      className="w-full pl-10 pr-4 py-3 rounded-[14px] border-2 border-[#0A192F]/10 text-[#0A192F] font-semibold text-sm focus:outline-none focus:border-[#00D1FF]/40 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Current Class</label>
                    <select
                      value={yearLevel}
                      onChange={(e) => setYearLevel(e.target.value as '11' | '12' | 'Dropper')}
                      className="w-full px-4 py-3 rounded-[14px] border-2 border-[#0A192F]/10 text-[#0A192F] font-semibold text-sm focus:outline-none focus:border-[#00D1FF]/40 bg-white"
                    >
                      <option value="11">Class 11</option>
                      <option value="12">Class 12</option>
                      <option value="Dropper">Dropper (13th)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Current Week</label>
                    <input
                      type="number"
                      min="1" max="52"
                      value={currentWeek}
                      onChange={(e) => setCurrentWeek(Math.min(52, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full px-4 py-3 rounded-[14px] border-2 border-[#0A192F]/10 text-[#0A192F] font-semibold text-sm focus:outline-none focus:border-[#00D1FF]/40 bg-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={prevStep} className="w-12 h-12 rounded-[12px] border-2 border-[#0A192F]/10 flex items-center justify-center text-[#64748B] hover:border-[#0A192F]/20 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={nextStep} className="flex-1 neo-button py-3 flex items-center justify-center gap-2 group">
                    Final Step <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 6: TRIAL */}
          {step === 6 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="neo-card"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-[#FBBF24]/10 border border-[#FBBF24]/20 rounded-[18px] flex items-center justify-center">
                  <Crown className="w-7 h-7 text-[#FBBF24]" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-[#0A192F] tracking-tight">Start Your Trial</h1>
                  <p className="text-xs font-bold text-[#34D399] mt-1">7 Days Free Access</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gradient-to-br from-[#00D1FF]/5 to-[#F472B6]/5 rounded-[20px] border-2 border-[#00D1FF]/15 p-6">
                  <h3 className="text-lg font-extrabold text-[#0A192F] mb-2 tracking-tight">7-Day Free Trial</h3>
                  <p className="text-sm font-medium text-[#64748B] mb-5">Start with a JEE Prove-It challenge, then unlock smart plans, practice, and mastery credentials.</p>

                  <ul className="space-y-3">
                    {['JEE Prove-It credentials', 'Personalized JEE roadmap', 'Unlimited adaptive practice'].map(f => (
                      <li key={f} className="flex items-center gap-3 text-sm font-medium text-[#0A192F]">
                        <div className="w-5 h-5 bg-[#34D399]/10 border border-[#34D399]/30 rounded-full flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-[#34D399]" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={saveOnboarding}
                  disabled={loading}
                  className="neo-button w-full py-4 flex items-center justify-center gap-2 group disabled:opacity-50 text-base"
                >
                  {loading ? 'Setting up...' : 'Start First Prove-It'}
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                <p className="text-center text-xs font-medium text-[#64748B]">You won't be charged for 7 days</p>

                <button onClick={prevStep} className="w-full text-[#64748B] font-medium text-sm hover:text-[#0A192F] transition-colors">
                  Back
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
