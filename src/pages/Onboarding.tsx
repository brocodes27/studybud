import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAnalytics } from '../hooks/useAnalytics';
import {
  User, GraduationCap, BookOpen,
  ArrowRight, Loader2, Calendar, Brain, Clock, Target, Star, CheckCircle, ShieldCheck, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DIAGNOSTIC_PCM = [
  {
    question: "A particle moves in a circle of radius R with constant speed v. What is its acceleration?",
    options: ["0", "v²/R towards center", "v²/R along tangent", "v/R² towards center"],
    correct: 1,
    subject: "Physics",
    topic: "Circular Motion"
  },
  {
    question: "Which of these elements has the highest electronegativity?",
    options: ["Oxygen", "Nitrogen", "Fluorine", "Chlorine"],
    correct: 2,
    subject: "Chemistry",
    topic: "Periodic Table"
  },
  {
    question: "What is the derivative of sin(x²) with respect to x?",
    options: ["cos(x²)", "2x cos(x²)", "2 cos(x)", "-2x cos(x²)"],
    correct: 1,
    subject: "Mathematics",
    topic: "Calculus"
  }
];

const DIAGNOSTIC_K10 = [
  {
    question: "What is the SI unit of force?",
    options: ["Joule", "Watt", "Newton", "Pascal"],
    correct: 2,
    subject: "Science",
    topic: "Force and Laws of Motion"
  },
  {
    question: "Which gas is essential for human respiration?",
    options: ["Carbon dioxide", "Oxygen", "Nitrogen", "Helium"],
    correct: 1,
    subject: "Science",
    topic: "Respiration"
  },
  {
    question: "If 3x + 5 = 20, what is the value of x?",
    options: ["3", "5", "15", "6"],
    correct: 1,
    subject: "Mathematics",
    topic: "Linear Equations"
  }
];

type Step = 'basics' | 'session' | 'quiz' | 'aha' | 'loading_aha';

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  
  const [step, setStep] = useState<Step>('basics');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basics
  const initialRole = (user?.user_metadata?.role as 'student' | 'teacher') || 'student';
  const [role, setRole] = useState<'student' | 'teacher'>(initialRole);
  const [fullName, setFullName] = useState<string>(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
  const [grade, setGrade] = useState<string>('11');
  const [classCode, setClassCode] = useState<string>('');

  // Step 2: Session timing
  const [sessionTiming, setSessionTiming] = useState<'start' | 'middle'>('start');

  // Step 3 (Path A): Diagnostic Quiz
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);

  // Step 3 (Path B): Personality Quiz
  const [sleepPattern, setSleepPattern] = useState<'morning' | 'evening' | 'flexible'>('evening');
  const [previousScores, setPreviousScores] = useState<'top' | 'steady' | 'growth'>('steady');
  const [favoriteSubject, setFavoriteSubject] = useState<string>('');
  const [strongestSubject, setStrongestSubject] = useState<string>('');
  const [weakestSubject, setWeakestSubject] = useState<string>('');

  const isPCM = grade === '11' || grade === '12';
  const subjectsList = isPCM 
    ? ['Physics', 'Chemistry', 'Mathematics'] 
    : ['Science', 'Mathematics', 'English', 'Social Science'];

  const quizQuestions = isPCM ? DIAGNOSTIC_PCM : DIAGNOSTIC_K10;

  // Set default subjects when grade changes
  useEffect(() => {
    if (isPCM) {
      setFavoriteSubject('Physics');
      setStrongestSubject('Mathematics');
      setWeakestSubject('Chemistry');
    } else {
      setFavoriteSubject('Science');
      setStrongestSubject('Mathematics');
      setWeakestSubject('English');
    }
  }, [grade, isPCM]);

  const handleNextFromBasics = () => {
    if (!fullName.trim()) {
      setError('Please enter your name.');
      return;
    }
    setError(null);
    if (role === 'teacher') {
      // Teachers skip quizzes/AHA moment and go straight to DB upsert
      saveProfileAndSubmit();
    } else {
      setStep('session');
    }
  };

  const handleNextFromSession = () => {
    setError(null);
    setStep('quiz');
  };

  const handleQuizSubmit = () => {
    if (sessionTiming === 'middle') {
      // Calculate quiz score
      let score = 0;
      quizQuestions.forEach((q, idx) => {
        if (quizAnswers[idx] === q.correct) {
          score++;
        }
      });
      setQuizScore(score);

      // Auto-assign weak/strong subjects based on quiz answers
      const wrongSubjects = quizQuestions
        .filter((q, idx) => quizAnswers[idx] !== q.correct)
        .map(q => q.subject);
      const rightSubjects = quizQuestions
        .filter((q, idx) => quizAnswers[idx] === q.correct)
        .map(q => q.subject);

      if (wrongSubjects.length > 0) {
        setWeakestSubject(wrongSubjects[0]);
      }
      if (rightSubjects.length > 0) {
        setStrongestSubject(rightSubjects[0]);
      }
    }
    setStep('loading_aha');
  };

  // Simulate AI Cognitive Analysis loading before AHA Moment
  useEffect(() => {
    if (step === 'loading_aha') {
      const timer = setTimeout(() => {
        setStep('aha');
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const saveProfileAndSubmit = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Update user profile
      const profilePayload: any = {
        id: user.id,
        role,
        full_name: fullName.trim() || null,
        onboarding_completed: true,
        trial_active: false,
      };

      if (role === 'student') {
        profilePayload.grade = grade;
        profilePayload.account_type = 'school_student'; // Default school cohort student when they sign up
      } else {
        profilePayload.account_type = 'teacher';
      }

      const { error: profileError } = await supabase.from('user_profiles').upsert(profilePayload);
      if (profileError) throw profileError;

      // 2. If student, join class code if provided
      const trimmedCode = classCode.trim();
      if (role === 'student' && trimmedCode) {
        let result;
        if (trimmedCode.length <= 10 && !trimmedCode.includes('/')) {
          result = await supabase.rpc('join_class', { p_class_code: trimmedCode.toUpperCase() });
        } else {
          const slug = trimmedCode.replace(/^.*\/join\//, '');
          result = await supabase.rpc('join_class_by_invite', { p_invite_link: slug });
        }
        if (result.error) throw new Error(result.error.message);
      }

      // 3. Save student behavioral profile
      if (role === 'student') {
        const preferredTime = sleepPattern === 'morning' ? 'morning' : sleepPattern === 'evening' ? 'evening' : 'afternoon';
        const behaviorPayload = {
          user_id: user.id,
          preferred_time: preferredTime,
          typical_session_duration_min: 90,
          weak_subjects: [weakestSubject],
          strong_subjects: [strongestSubject],
          typical_slump_day: 'Wednesday',
          response_to_low_score: 'rebuild_concept',
          stress_signals: {
            sleep_pattern: sleepPattern,
            previous_scores: previousScores,
            favorite_subject: favoriteSubject,
            diagnostic_quiz_score: quizScore,
            session_context: sessionTiming
          }
        };

        const { error: behaviorError } = await supabase
          .from('student_behavioral_profiles')
          .upsert(behaviorPayload, { onConflict: 'user_id' });
        if (behaviorError) throw behaviorError;
      }

      // 4. Upsert Gamification Basics
      await supabase.from('user_gamification').upsert({
        user_id: user.id,
        total_xp: 50, // bonus XP for onboarding
        current_level: 1,
        current_streak: 1,
      }, { onConflict: 'user_id' });

      await refreshProfile();
      track('onboarding_complete', { role, grade, sessionTiming, quizScore });
      
      if (role === 'student') {
        navigate('/');
      } else {
        navigate('/my-classes');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to complete onboarding. Please try again.');
      setStep('basics'); // rollback to edit basics
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4 md:p-8 relative overflow-hidden text-[#2D2A26]">
      {/* Neo-brutalist background elements */}
      <div className="absolute inset-0 pointer-events-none noise-heavy opacity-5" />
      <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-[#00D1FF]/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-[#6366F1]/5 rounded-full blur-[120px]" />

      <AnimatePresence mode="wait">
        {/* STEP 1: BASICS */}
        {step === 'basics' && (
          <motion.div
            key="basics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg relative z-10"
          >
            <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-[#2D2A26] border-2 border-[#2D2A26] text-white flex items-center justify-center rounded-xl shadow-sm">
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight">Identity Profile</h1>
                  <p className="text-xs font-bold text-[#8A8279] mt-0.5">Let's set up your ElevenFolks credentials.</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Full Name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-[#2D2A26] text-[#2D2A26] font-bold text-lg focus:outline-none focus:bg-amber-50/10 placeholder:text-[#8A8279]/40 bg-[#FAF8F5]"
                    placeholder="Enter your name..."
                  />
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Role</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`flex items-center gap-3 p-4 rounded-xl border-3 text-left transition-all ${role === 'student' ? 'bg-[#8B7355]/10 border-[#8B7355] shadow-[4px_4px_0px_0px_#8B7355]' : 'bg-[#FAF8F5] border-[#2D2A26]/10 hover:border-[#2D2A26]/30'}`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${role === 'student' ? 'bg-[#8B7355] text-white' : 'bg-[#2D2A26]/5 text-[#8A8279]'}`}>
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-[#2D2A26]">Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('teacher')}
                      className={`flex items-center gap-3 p-4 rounded-xl border-3 text-left transition-all ${role === 'teacher' ? 'bg-[#8B7355]/10 border-[#8B7355] shadow-[4px_4px_0px_0px_#8B7355]' : 'bg-[#FAF8F5] border-[#2D2A26]/10 hover:border-[#2D2A26]/30'}`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${role === 'teacher' ? 'bg-[#8B7355] text-white' : 'bg-[#2D2A26]/5 text-[#8A8279]'}`}>
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-[#2D2A26]">Teacher</span>
                    </button>
                  </div>
                </div>

                {/* Grade and Class Code (Students Only) */}
                {role === 'student' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-1"
                  >
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Grade Level</label>
                      <div className="grid grid-cols-5 gap-2">
                        {['8', '9', '10', '11', '12'].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGrade(g)}
                            className={`py-2 px-3 rounded-lg border-2 text-center text-xs font-black transition-all ${grade === g ? 'bg-[#2D2A26] text-white border-[#2D2A26]' : 'bg-[#FAF8F5] border-[#2D2A26]/15 text-[#8A8279] hover:border-[#2D2A26]/40'}`}
                          >
                            Class {g}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] font-bold text-[#8A8279] mt-2">
                        {isPCM ? "⚡ PCM subjects: Physics, Chemistry & Mathematics (+ JEE prep active)" : "📋 CBSE subjects: Science, Mathematics & English"}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Class Cohort Code (Optional)</label>
                      <input
                        value={classCode}
                        onChange={(e) => setClassCode(e.target.value)}
                        placeholder="Paste class code: e.g. ABC123"
                        className="w-full px-4 py-3 rounded-xl border-2 border-[#2D2A26] text-[#2D2A26] font-bold text-sm focus:outline-none placeholder:text-[#8A8279]/40 bg-[#FAF8F5]"
                      />
                      <p className="text-[10px] font-bold text-[#8A8279] mt-1">If your school or teacher gave you a cohort code, paste it here.</p>
                    </div>
                  </motion.div>
                )}

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-xs font-bold text-red-600">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleNextFromBasics}
                  disabled={!fullName.trim()}
                  className="w-full py-4 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-sm rounded-xl transition-all shadow-md active:translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {role === 'student' ? 'Next: Study Settings' : 'Setup Profile'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: SESSION TIMING */}
        {step === 'session' && (
          <motion.div
            key="session"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg relative z-10"
          >
            <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-[#2D2A26] text-white flex items-center justify-center rounded-xl shadow-sm">
                  <Calendar className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight">Academic Timeline</h1>
                  <p className="text-xs font-bold text-[#8A8279] mt-0.5">Where is your school currently in the session?</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSessionTiming('start')}
                    className={`w-full flex items-center gap-4 p-5 rounded-xl border-3 text-left transition-all ${sessionTiming === 'start' ? 'bg-[#8B7355]/10 border-[#8B7355] shadow-[4px_4px_0px_0px_#8B7355]' : 'bg-[#FAF8F5] border-[#2D2A26]/10 hover:border-[#2D2A26]/30'}`}
                  >
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-[#2D2A26] uppercase">Just Started (Beginning)</p>
                      <p className="text-xs text-[#8A8279] mt-0.5">Classes are at chapter 1 or 2. Let's do a personality diagnostic to map your sleep & scores.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSessionTiming('middle')}
                    className={`w-full flex items-center gap-4 p-5 rounded-xl border-3 text-left transition-all ${sessionTiming === 'middle' ? 'bg-[#8B7355]/10 border-[#8B7355] shadow-[4px_4px_0px_0px_#8B7355]' : 'bg-[#FAF8F5] border-[#2D2A26]/10 hover:border-[#2D2A26]/30'}`}
                  >
                    <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center shrink-0">
                      <Brain className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-[#2D2A26] uppercase">In the Middle (Mid-Term)</p>
                      <p className="text-xs text-[#8A8279] mt-0.5">We're half-way. Let's take a quick 3-question conceptual diagnostic quiz to see what you remember.</p>
                    </div>
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('basics')}
                    className="flex-1 py-3.5 border-2 border-[#2D2A26] hover:bg-[#2D2A26]/5 font-black uppercase text-xs rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNextFromSession}
                    className="flex-[2] py-3.5 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: QUIZ (Diagnostic or Personality) */}
        {step === 'quiz' && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-xl relative z-10"
          >
            {sessionTiming === 'middle' ? (
              /* Diagnostic Quiz Panel */
              <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl space-y-6">
                <div className="flex items-center gap-3">
                  <Brain className="w-6 h-6 text-[#8B7355]" />
                  <h2 className="text-xl font-black uppercase tracking-tight">Diagnostic Progress Check</h2>
                </div>
                <p className="text-xs text-[#8A8279]">We've customized this quiz based on Class {grade} {isPCM ? 'PCM' : 'CBSE'} chapters typically covered by mid-term.</p>

                <div className="space-y-6 py-2">
                  {quizQuestions.map((q, idx) => (
                    <div key={idx} className="space-y-3">
                      <p className="text-sm font-bold leading-snug">
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-[#2D2A26] text-white rounded-full text-[10px] font-black mr-2 align-middle">{idx + 1}</span>
                        {q.question}
                      </p>
                      <div className="grid grid-cols-1 gap-2 pl-7">
                        {q.options.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            onClick={() => setQuizAnswers(prev => ({ ...prev, [idx]: oIdx }))}
                            className={`w-full p-3 rounded-lg border-2 text-left text-xs font-bold transition-all ${quizAnswers[idx] === oIdx ? 'bg-[#2D2A26] border-[#2D2A26] text-white' : 'bg-[#FAF8F5] border-[#2D2A26]/10 hover:border-[#2D2A26]/30'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStep('session')}
                    className="flex-1 py-3.5 border-2 border-[#2D2A26] hover:bg-[#2D2A26]/5 font-black uppercase text-xs rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleQuizSubmit}
                    disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                    className="flex-[2] py-3.5 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    Grade Quiz & Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Personality Quiz Panel */
              <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl space-y-6">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-[#8B7355]" />
                  <h2 className="text-xl font-black uppercase tracking-tight">Identity & Study Habits</h2>
                </div>
                <p className="text-xs text-[#8A8279]">No quiz since school just started! Tell us how you study to customize your AI Coach.</p>

                <div className="space-y-4">
                  {/* Sleep Pattern */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">When do you feel most productive?</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 'morning', label: '☀️ Early Bird' },
                        { val: 'evening', label: '🌙 Night Owl' },
                        { val: 'flexible', label: '🔄 Flexible' }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setSleepPattern(item.val as any)}
                          className={`py-2 px-3 rounded-lg border-2 text-center text-xs font-bold transition-all ${sleepPattern === item.val ? 'bg-[#2D2A26] text-white border-[#2D2A26]' : 'bg-[#FAF8F5] border-[#2D2A26]/10 hover:border-[#2D2A26]/30'}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Previous Scores */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Previous score bracket</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 'top', label: '90% + (Top)' },
                        { val: 'steady', label: '70% - 90%' },
                        { val: 'growth', label: 'Below 70%' }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setPreviousScores(item.val as any)}
                          className={`py-2 px-3 rounded-lg border-2 text-center text-xs font-bold transition-all ${previousScores === item.val ? 'bg-[#2D2A26] text-white border-[#2D2A26]' : 'bg-[#FAF8F5] border-[#2D2A26]/10 hover:border-[#2D2A26]/30'}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Favorite Subject */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Favorite STEM Subject</label>
                    <select
                      value={favoriteSubject}
                      onChange={(e) => setFavoriteSubject(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border-2 border-[#2D2A26] font-bold text-xs bg-[#FAF8F5]"
                    >
                      {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Strongest vs Weakest */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Strongest Subject</label>
                      <select
                        value={strongestSubject}
                        onChange={(e) => setStrongestSubject(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border-2 border-[#2D2A26] font-bold text-xs bg-[#FAF8F5]"
                      >
                        {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Weakest Subject</label>
                      <select
                        value={weakestSubject}
                        onChange={(e) => setWeakestSubject(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border-2 border-[#2D2A26] font-bold text-xs bg-[#FAF8F5]"
                      >
                        {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStep('session')}
                    className="flex-1 py-3.5 border-2 border-[#2D2A26] hover:bg-[#2D2A26]/5 font-black uppercase text-xs rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleQuizSubmit}
                    className="flex-[2] py-3.5 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    Generate Study Vibe <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 3.5: LOADING ANALYSIS */}
        {step === 'loading_aha' && (
          <motion.div
            key="loading_aha"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[50vh] text-center"
          >
            <div className="w-16 h-16 bg-[#2D2A26] border-2 border-[#2D2A26] rounded-2xl flex items-center justify-center shadow-lg mb-6 rotate-12 animate-pulse">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Syncing ATLAS Core...</h2>
            <p className="text-sm font-semibold text-[#8A8279] mt-2 max-w-xs leading-relaxed">Mapping your study habits, syllabus parameters, and strengths onto your cognitive advisor.</p>
          </motion.div>
        )}

        {/* STEP 4: AHA MOMENT */}
        {step === 'aha' && (
          <motion.div
            key="aha"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl relative z-10"
          >
            <div className="bg-[#2D2A26] border-4 border-[#2D2A26] p-8 text-white shadow-[12px_12px_0px_0px_#8B7355] rounded-3xl space-y-8 relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-20%] w-72 h-72 bg-[#00D1FF]/10 rounded-full blur-[80px] pointer-events-none" />
              
              <div className="space-y-2 relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-wider text-[#00D1FF]">
                  <Star className="w-3.5 h-3.5 fill-current" /> Blueprint Configured
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05] uppercase">
                  Welcome to <span className="bg-gradient-to-r from-[#00D1FF] to-[#6366F1] bg-clip-text text-transparent">elevenfolks.</span>
                </h1>
                <p className="text-sm text-white/60 font-medium">ATLAS has established your personal cognitive profile. Here is what we know about you:</p>
              </div>

              {/* AHA Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 text-[#2D2A26]">
                {/* Profile Card */}
                <div className="bg-white p-5 rounded-2xl border-2 border-white flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-[#8A8279] uppercase tracking-wider mb-2">Cognitive Blueprint</p>
                    <h3 className="text-lg font-black leading-tight uppercase mb-1">
                      {sleepPattern === 'morning' ? '☀️ Early Bird Scholar' : sleepPattern === 'evening' ? '🌙 Night Owl Warrior' : '🔄 Balanced Explorer'}
                    </h3>
                    <p className="text-xs text-[#8A8279] leading-relaxed">
                      Your peak alertness is modeled around <span className="font-extrabold text-[#2D2A26]">{sleepPattern === 'morning' ? 'mornings' : 'late evenings'}</span>. Harder subjects will automatically stack during this window.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-[11px] font-bold text-[#8B7355]">
                    <Clock className="w-4 h-4" /> Customized Daily Schedule Active
                  </div>
                </div>

                {/* Score Target Card */}
                <div className="bg-white p-5 rounded-2xl border-2 border-white flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-[#8A8279] uppercase tracking-wider mb-2">Performance Vector</p>
                    <h3 className="text-lg font-black leading-tight uppercase mb-1">
                      {previousScores === 'top' ? '🚀 Top-Rank Target' : previousScores === 'steady' ? '📈 Steady Growth' : '🌱 Conceptual Recovery'}
                    </h3>
                    <p className="text-xs text-[#8A8279] leading-relaxed">
                      Targeting a high performance threshold. Your revision cycles will emphasize rigor and retrieval checks.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-[11px] font-bold text-emerald-600">
                    <Target className="w-4 h-4" /> Rigor factor: {previousScores === 'top' ? '9.5/10' : '7.8/10'} locked
                  </div>
                </div>

                {/* Subjects & Diagnostic Card */}
                <div className="bg-white p-5 rounded-2xl border-2 border-white md:col-span-2">
                  <p className="text-[10px] font-black text-[#8A8279] uppercase tracking-wider mb-3">Adaptive Study Strategy</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-[#2D2A26]/5 pb-2">
                      <span className="font-bold text-[#8A8279]">Syllabus Stream</span>
                      <span className="font-black text-[#2D2A26] uppercase">Class {grade} {isPCM ? 'JEE (PCM)' : 'CBSE'}</span>
                    </div>
                    {quizScore !== null && (
                      <div className="flex items-center justify-between text-xs border-b border-[#2D2A26]/5 pb-2">
                        <span className="font-bold text-[#8A8279]">Diagnostic Recall Level</span>
                        <span className="font-black text-amber-600 uppercase">{quizScore} / {quizQuestions.length} Checked</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#8A8279]">Primary Remedial Target</span>
                      <span className="font-black text-red-600 uppercase">{weakestSubject}</span>
                    </div>
                  </div>

                  <div className="bg-[#FAF8F5] border border-[#2D2A26]/10 p-3 rounded-xl mt-4">
                    <p className="text-xs font-semibold text-[#8A8279] leading-relaxed">
                      💡 <span className="font-extrabold text-[#2D2A26]">ATLAS strategy:</span> Since <span className="font-black text-[#2D2A26]">{weakestSubject}</span> is marked as weakest, daily plans will automatically serve 15-minute concept rebuilds. Your strong subject, <span className="font-black text-[#2D2A26]">{strongestSubject}</span>, will feature higher-rigor problems to maximize score.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action button */}
              <div className="pt-2 relative z-10">
                <button
                  onClick={saveProfileAndSubmit}
                  disabled={loading}
                  className="w-full py-4.5 bg-[#8B7355] text-white border-2 border-white/20 hover:bg-[#9B8365] font-black uppercase text-sm rounded-xl transition-all shadow-[0_6px_20px_rgba(139,115,85,0.4)] active:translate-y-0.5 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Aligning Workspace...</>
                  ) : (
                    <><ShieldCheck className="w-5 h-5" /> Launch My Workspace</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
