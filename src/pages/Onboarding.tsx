import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAnalytics } from '../hooks/useAnalytics';
import {
  User, GraduationCap, BookOpen, Building, Plus, Trash2, Upload, Check,
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
    options: ["Carbon dioxide", "Oxygen", "Respiration", "Helium"],
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

type Step = 
  | 'basics' 
  // Student steps
  | 'session' | 'quiz' | 'loading_aha' | 'aha'
  // Teacher steps
  | 'teacher_sections' | 'teacher_roster'
  // Admin steps
  | 'admin_school' | 'admin_grades' | 'admin_teachers' | 'admin_roster';

interface SectionInput {
  grade: string;
  section: string;
  subject: string;
}

interface TeacherInviteInput {
  name: string;
  email: string;
  grade: string;
  section: string;
  subject: string;
}

interface StudentRosterInput {
  name: string;
  email: string;
  grade: string;
  section: string;
  rollNumber: string;
}

export default function Onboarding() {
  const { user, refreshProfile, schoolId } = useAuth();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  
  const [step, setStep] = useState<Step>('basics');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // General fields
  const [fullName, setFullName] = useState<string>(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
  const [role, setRole] = useState<'student' | 'teacher' | 'school_admin'>('student');
  const [grade, setGrade] = useState<string>('10');
  const [classCode, setClassCode] = useState<string>('');

  // Student specific
  const [sessionTiming, setSessionTiming] = useState<'start' | 'middle'>('start');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [sleepPattern, setSleepPattern] = useState<'morning' | 'evening' | 'flexible'>('evening');
  const [previousScores, setPreviousScores] = useState<'top' | 'steady' | 'growth'>('steady');
  const [favoriteSubject, setFavoriteSubject] = useState<string>('');
  const [strongestSubject, setStrongestSubject] = useState<string>('');
  const [weakestSubject, setWeakestSubject] = useState<string>('');

  // Teacher specific
  const [teacherSections, setTeacherSections] = useState<SectionInput[]>([
    { grade: '10', section: 'A', subject: 'Science' }
  ]);
  const [studentInvitesText, setStudentInvitesText] = useState<string>('');
  const [createdClasses, setCreatedClasses] = useState<Array<{ name: string; code: string }>>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Admin specific
  const [schoolName, setSchoolName] = useState<string>('');
  const [schoolCode, setSchoolCode] = useState<string>('');
  const [schoolDomain, setSchoolDomain] = useState<string>('');
  const [schoolAddress, setSchoolAddress] = useState<string>('');
  const [createdSchoolId, setCreatedSchoolId] = useState<string | null>(null);

  const [definedGrades, setDefinedGrades] = useState<Array<{ grade: string; sections: string[]; subjects: string[] }>>([
    { grade: '10', sections: ['A', 'B'], subjects: ['Science', 'Mathematics', 'English'] },
    { grade: '12', sections: ['A', 'B', 'C'], subjects: ['Physics', 'Chemistry', 'Mathematics'] }
  ]);

  const [teacherInvites, setTeacherInvites] = useState<TeacherInviteInput[]>([
    { name: 'Teacher John', email: 'john@school.com', grade: '10', section: 'A', subject: 'Science' }
  ]);

  const [studentRoster, setStudentRoster] = useState<StudentRosterInput[]>([
    { name: 'Student Alice', email: 'alice@school.com', grade: '10', section: 'A', rollNumber: '101' }
  ]);

  const isPCM = grade === '11' || grade === '12';
  const subjectsList = isPCM 
    ? ['Physics', 'Chemistry', 'Mathematics'] 
    : ['Science', 'Mathematics', 'English', 'Social Science'];

  const quizQuestions = isPCM ? DIAGNOSTIC_PCM : DIAGNOSTIC_K10;

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
      if (!schoolId) {
        setError('Access Denied: Your school domain has not been registered or given access. Please contact your administrator.');
        return;
      }
      setStep('teacher_sections');
    } else {
      setStep('session');
    }
  };

  // Student Flow Actions
  const handleQuizSubmit = () => {
    if (sessionTiming === 'middle') {
      let score = 0;
      quizQuestions.forEach((q, idx) => {
        if (quizAnswers[idx] === q.correct) score++;
      });
      setQuizScore(score);

      const wrongSubjects = quizQuestions
        .filter((q, idx) => quizAnswers[idx] !== q.correct)
        .map(q => q.subject);
      const rightSubjects = quizQuestions
        .filter((q, idx) => quizAnswers[idx] === q.correct)
        .map(q => q.subject);

      if (wrongSubjects.length > 0) setWeakestSubject(wrongSubjects[0]);
      if (rightSubjects.length > 0) setStrongestSubject(rightSubjects[0]);
    }
    setStep('loading_aha');
  };

  useEffect(() => {
    if (step === 'loading_aha') {
      const timer = setTimeout(() => {
        setStep('aha');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const saveStudentProfile = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: user.id,
        role: 'student',
        full_name: fullName.trim(),
        onboarding_completed: true,
        account_type: 'school_student',
        grade
      });
      if (profileError) throw profileError;

      if (classCode.trim()) {
        const trimmed = classCode.trim().toUpperCase();
        const result = await supabase.rpc('join_class', { p_class_code: trimmed });
        if (result.error) throw new Error(result.error.message);
      }

      await supabase.from('student_behavioral_profiles').upsert({
        user_id: user.id,
        preferred_time: sleepPattern === 'morning' ? 'morning' : sleepPattern === 'evening' ? 'evening' : 'afternoon',
        typical_session_duration_min: 90,
        weak_subjects: [weakestSubject],
        strong_subjects: [strongestSubject],
        typical_slump_day: 'Wednesday',
        response_to_low_score: 'rebuild_concept',
        stress_signals: { sleep_pattern: sleepPattern, previous_scores: previousScores }
      }, { onConflict: 'user_id' });

      await supabase.from('user_gamification').upsert({
        user_id: user.id,
        total_xp: 50,
        current_level: 1,
        current_streak: 1,
      }, { onConflict: 'user_id' });

      await refreshProfile();
      navigate('/');
    } catch (e: any) {
      setError(e.message || 'Failed to complete student onboarding.');
    } finally {
      setLoading(false);
    }
  };

  // Teacher Onboarding Actions
  const handleTeacherSectionsSubmit = async () => {
    if (teacherSections.length === 0) {
      setError('Please add at least one section you teach.');
      return;
    }
    setError(null);
    await saveTeacherProfile();
  };

  const saveTeacherProfile = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Update Profile
      const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: user.id,
        role: 'teacher',
        full_name: fullName.trim(),
        onboarding_completed: true,
        account_type: 'teacher'
      });
      if (profileError) throw profileError;

      // 2. Create Sections, Subjects, and Teaching Assignments (in parallel)
      const academicYearRes = await supabase.from('academic_years').select('id').eq('is_active', true).limit(1);
      const ayId = academicYearRes.data?.[0]?.id;

      const tempClasses: Array<{ name: string; code: string }> = [];

      if (ayId) {
        for (const sec of teacherSections) {
          // Get or create grade section
          let sectionId;
          const sectionRes = await supabase
            .from('grade_sections')
            .select('id')
            .eq('grade_name', sec.grade)
            .eq('section_name', sec.section)
            .limit(1)
            .maybeSingle();

          if (sectionRes.data?.id) {
            sectionId = sectionRes.data.id;
          } else {
            const newSec = await supabase
              .from('grade_sections')
              .insert({ grade_name: sec.grade, section_name: sec.section, academic_year_id: ayId })
              .select('id')
              .single();
            sectionId = newSec.data?.id;
          }

          // Get or create subject
          let subjectId;
          const subjectRes = await supabase
            .from('subjects')
            .select('id')
            .eq('name', sec.subject)
            .limit(1)
            .maybeSingle();

          if (subjectRes.data?.id) {
            subjectId = subjectRes.data.id;
          } else {
            const newSub = await supabase
              .from('subjects')
              .insert({ name: sec.subject })
              .select('id')
              .single();
            subjectId = newSub.data?.id;
          }

          // Insert teaching assignment
          if (sectionId && subjectId) {
            await supabase.from('teaching_assignments').insert({
              teacher_id: user.id,
              section_id: sectionId,
              subject_id: subjectId,
              academic_year_id: ayId
            });

            // Auto-create class room
            const classCodeValue = `CLS-${uuidShort()}`;
            const classNameValue = `Class ${sec.grade}-${sec.section} ${sec.subject}`;
            await supabase.from('classes').insert({
              teacher_id: user.id,
              name: classNameValue,
              subject: sec.subject.toLowerCase(),
              class_code: classCodeValue
            });

            tempClasses.push({ name: classNameValue, code: classCodeValue });
          }
        }
      }

      setCreatedClasses(tempClasses);
      await refreshProfile();
      setStep('teacher_roster');
    } catch (e: any) {
      setError(e.message || 'Failed to complete teacher onboarding.');
    } finally {
      setLoading(false);
    }
  };

  // School Admin Onboarding Actions
  const handleAdminSchoolSubmit = async () => {
    if (!schoolName.trim() || !schoolCode.trim() || !schoolDomain.trim()) {
      setError('Please fill in all school profile fields.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: rpcError } = await supabase.rpc('create_school_and_admin', {
        p_school_name: schoolName.trim(),
        p_school_code: schoolCode.trim().toUpperCase(),
        p_school_domain: schoolDomain.trim().toLowerCase(),
        p_address: schoolAddress.trim()
      });
      if (rpcError) throw rpcError;
      
      setCreatedSchoolId(data.school_id);
      setStep('admin_grades');
    } catch (e: any) {
      setError(e.message || 'Failed to create school profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminGradesSubmit = async () => {
    if (!createdSchoolId) return;
    try {
      setLoading(true);
      setError(null);

      // Create Academic Year
      const ayRes = await supabase
        .from('academic_years')
        .insert({ school_id: createdSchoolId, name: 'AY 2026-27', is_active: true })
        .select('id')
        .single();
      const ayId = ayRes.data?.id;

      if (ayId) {
        for (const g of definedGrades) {
          // Create grade sections
          for (const sec of g.sections) {
            await supabase.from('grade_sections').insert({
              school_id: createdSchoolId,
              grade_name: g.grade,
              section_name: sec,
              academic_year_id: ayId
            });
          }
          // Create subjects
          for (const sub of g.subjects) {
            await supabase.from('subjects').insert({
              school_id: createdSchoolId,
              name: sub
            });
          }
        }
      }
      setStep('admin_teachers');
    } catch (e: any) {
      setError(e.message || 'Failed to configure grades and sections.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminTeachersSubmit = async () => {
    if (!createdSchoolId) return;
    try {
      setLoading(true);
      setError(null);

      // Bulk invite teachers
      const inviteRows = [];
      for (const t of teacherInvites) {
        if (!t.email.trim()) continue;

        // Get grade section ID
        const gsRes = await supabase
          .from('grade_sections')
          .select('id')
          .eq('school_id', createdSchoolId)
          .eq('grade_name', t.grade)
          .eq('section_name', t.section)
          .limit(1)
          .maybeSingle();

        // Get subject ID
        const subRes = await supabase
          .from('subjects')
          .select('id')
          .eq('school_id', createdSchoolId)
          .eq('name', t.subject)
          .limit(1)
          .maybeSingle();

        inviteRows.push({
          school_id: createdSchoolId,
          email: t.email.trim(),
          role: 'teacher',
          grade_section_id: gsRes.data?.id || null,
          subject_id: subRes.data?.id || null
        });
      }

      if (inviteRows.length > 0) {
        const { error: inviteError } = await supabase.from('school_invitations').insert(inviteRows);
        if (inviteError) throw inviteError;
      }

      setStep('admin_roster');
    } catch (e: any) {
      setError(e.message || 'Failed to register teacher invitations.');
    } finally {
      setLoading(false);
    }
  };

  const saveAdminProfileAndRoster = async () => {
    if (!user || !createdSchoolId) return;
    try {
      setLoading(true);
      setError(null);

      // Bulk invite students
      const inviteRows = [];
      for (const s of studentRoster) {
        if (!s.email.trim()) continue;

        const gsRes = await supabase
          .from('grade_sections')
          .select('id')
          .eq('school_id', createdSchoolId)
          .eq('grade_name', s.grade)
          .eq('section_name', s.section)
          .limit(1)
          .maybeSingle();

        inviteRows.push({
          school_id: createdSchoolId,
          email: s.email.trim(),
          role: 'student',
          grade_section_id: gsRes.data?.id || null
        });
      }

      if (inviteRows.length > 0) {
        const { error: inviteError } = await supabase.from('school_invitations').insert(inviteRows);
        if (inviteError) throw inviteError;
      }

      // Update admin user profile completion
      await supabase.from('user_profiles').upsert({
        id: user.id,
        role: 'org_admin',
        full_name: fullName.trim(),
        onboarding_completed: true,
        account_type: 'school_admin',
        school_id: createdSchoolId
      });

      await refreshProfile();
      navigate('/school-admin');
    } catch (e: any) {
      setError(e.message || 'Failed to import student roster.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to generate unique class tags
  const uuidShort = () => Math.random().toString(36).substring(2, 7).toUpperCase();

  const parseStudentRosterCSV = (text: string) => {
    try {
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length <= 1) return;
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const students: StudentRosterInput[] = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((h, index) => {
          row[h] = values[index] || '';
        });
        return {
          name: row.name || row.full_name || '',
          email: row.email || '',
          grade: row.grade || '10',
          section: row.section || 'A',
          rollNumber: row.roll_number || row.roll || ''
        };
      }).filter(s => s.email !== '');

      if (students.length > 0) {
        setStudentRoster(students);
        setError(null);
      }
    } catch (e) {
      setError('Error parsing student CSV roster.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4 md:p-8 relative overflow-hidden text-[#2D2A26]">
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
                  <h2 className="text-2xl font-black uppercase tracking-tight">Identity Profile</h2>
                  <p className="text-xs font-bold text-[#8A8279] mt-0.5">Let's setup your ElevenFolks credentials.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Full Name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-[#2D2A26] text-[#2D2A26] font-bold text-lg focus:outline-none focus:bg-amber-50/10 placeholder:text-[#8A8279]/40 bg-[#FAF8F5]"
                    placeholder="Enter your name..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Role</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all ${role === 'student' ? 'bg-[#8B7355]/10 border-[#8B7355] shadow-[4px_4px_0px_0px_#8B7355]' : 'bg-[#FAF8F5] border-[#2D2A26]/10 hover:border-[#2D2A26]/30'}`}
                    >
                      <GraduationCap className="w-6 h-6 text-[#8B7355]" />
                      <span className="font-extrabold text-[11px] text-[#2D2A26]">Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('teacher')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all ${role === 'teacher' ? 'bg-[#8B7355]/10 border-[#8B7355] shadow-[4px_4px_0px_0px_#8B7355]' : 'bg-[#FAF8F5] border-[#2D2A26]/10 hover:border-[#2D2A26]/30'}`}
                    >
                      <BookOpen className="w-6 h-6 text-[#8B7355]" />
                      <span className="font-extrabold text-[11px] text-[#2D2A26]">Teacher</span>
                    </button>
                  </div>
                </div>

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
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Class Cohort Code (Optional)</label>
                      <input
                        value={classCode}
                        onChange={(e) => setClassCode(e.target.value)}
                        placeholder="Paste class code: e.g. ABC123"
                        className="w-full px-4 py-3 rounded-xl border-2 border-[#2D2A26] text-[#2D2A26] font-bold text-sm focus:outline-none placeholder:text-[#8A8279]/40 bg-[#FAF8F5]"
                      />
                    </div>
                  </motion.div>
                )}

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-xs font-bold text-red-600">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleNextFromBasics}
                  disabled={!fullName.trim()}
                  className="w-full py-4 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-sm rounded-xl transition-all shadow-md active:translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {role === 'student' ? 'Next: Study Settings' : 'Next Step'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* TEACHER STEP 2: SECTIONS CONFIGURATION */}
        {step === 'teacher_sections' && (
          <motion.div
            key="teacher_sections"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg relative z-10"
          >
            <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl">
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">Claim Your Sections</h2>
              <p className="text-xs font-bold text-[#8A8279] mb-5">Define the grades, sections, and subjects you teach at this school.</p>

              <div className="space-y-4">
                {teacherSections.map((sec, index) => (
                  <div key={index} className="flex gap-2 items-center bg-[#FAF8F5] p-3 rounded-xl border-2 border-[#2D2A26]/10">
                    <select
                      value={sec.grade}
                      onChange={(e) => {
                        const next = [...teacherSections];
                        next[index].grade = e.target.value;
                        setTeacherSections(next);
                      }}
                      className="bg-white border-2 border-[#2D2A26] text-xs font-black p-2 rounded-lg"
                    >
                      {['8', '9', '10', '11', '12'].map(g => <option key={g} value={g}>Class {g}</option>)}
                    </select>
                    
                    <input
                      type="text"
                      value={sec.section}
                      onChange={(e) => {
                        const next = [...teacherSections];
                        next[index].section = e.target.value.toUpperCase();
                        setTeacherSections(next);
                      }}
                      placeholder="Sec"
                      className="w-16 bg-white border-2 border-[#2D2A26] text-xs font-black p-2 rounded-lg text-center"
                    />

                    <input
                      type="text"
                      value={sec.subject}
                      onChange={(e) => {
                        const next = [...teacherSections];
                        next[index].subject = e.target.value;
                        setTeacherSections(next);
                      }}
                      placeholder="Subject"
                      className="flex-1 bg-white border-2 border-[#2D2A26] text-xs font-bold p-2 rounded-lg"
                    />

                    <button
                      onClick={() => setTeacherSections(teacherSections.filter((_, i) => i !== index))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => setTeacherSections([...teacherSections, { grade: '10', section: 'A', subject: 'Science' }])}
                  className="w-full py-2.5 border-2 border-dashed border-[#2D2A26]/30 hover:border-[#2D2A26]/60 text-xs font-black uppercase rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Another Subject/Section
                </button>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStep('basics')}
                    className="flex-1 py-3.5 border-2 border-[#2D2A26] hover:bg-[#2D2A26]/5 font-black uppercase text-xs rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleTeacherSectionsSubmit}
                    disabled={loading}
                    className="flex-[2] py-3.5 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Classes'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TEACHER STEP 3: SHARE CLASS CODES */}
        {step === 'teacher_roster' && (
          <motion.div
            key="teacher_roster"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg relative z-10"
          >
            <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl">
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">Class Rooms Active!</h2>
              <p className="text-xs font-bold text-[#8A8279] mb-5">Your classes have been created. Share these unique codes with your students so they can join instantly.</p>

              <div className="space-y-4">
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {createdClasses.map((cls, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-[#FAF8F5] p-3 rounded-xl border-2 border-[#2D2A26]/10">
                      <div>
                        <p className="font-extrabold text-xs text-[#2D2A26]">{cls.name}</p>
                        <p className="font-mono text-[10px] font-bold text-[#8B7355] mt-0.5">{cls.code}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(cls.code);
                          setCopiedCode(cls.code);
                          setTimeout(() => setCopiedCode(null), 2000);
                        }}
                        className={`px-3 py-1.5 rounded-lg border-2 text-[10px] font-black uppercase transition-all ${
                          copiedCode === cls.code
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white border-[#2D2A26] text-[#2D2A26] hover:bg-[#2D2A26]/5'
                        }`}
                      >
                        {copiedCode === cls.code ? 'Copied!' : 'Copy Code'}
                      </button>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-xs font-bold text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => navigate('/my-classes')}
                    className="w-full py-3.5 bg-[#8B7355] text-white border-2 border-white/20 hover:bg-[#9B8365] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ADMIN STEP 2: CREATE SCHOOL PROFILE */}
        {step === 'admin_school' && (
          <motion.div
            key="admin_school"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg relative z-10"
          >
            <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl">
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">School Profile Setup</h2>
              <p className="text-xs font-bold text-[#8A8279] mb-5">Spin up a new secure tenant environment for your school cohort.</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">School Name</label>
                    <input
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="e.g. Delhi Public School"
                      className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border-2 border-[#2D2A26] rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">School Code</label>
                    <input
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value)}
                      placeholder="e.g. DPS-DEL"
                      className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border-2 border-[#2D2A26] rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">Official Email Domain</label>
                  <input
                    value={schoolDomain}
                    onChange={(e) => setSchoolDomain(e.target.value)}
                    placeholder="e.g. dpsdelhi.edu.in"
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border-2 border-[#2D2A26] rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-2">School Address</label>
                  <textarea
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    placeholder="Address..."
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border-2 border-[#2D2A26] rounded-xl text-xs font-bold min-h-[60px]"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-xs font-bold text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('basics')}
                    className="flex-1 py-3.5 border-2 border-[#2D2A26] hover:bg-[#2D2A26]/5 font-black uppercase text-xs rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleAdminSchoolSubmit}
                    disabled={loading}
                    className="flex-[2] py-3.5 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create School'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ADMIN STEP 3: CONFIGURE GRADES & SECTIONS */}
        {step === 'admin_grades' && (
          <motion.div
            key="admin_grades"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg relative z-10"
          >
            <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl">
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">Academic Structure Setup</h2>
              <p className="text-xs font-bold text-[#8A8279] mb-5">Construct classrooms and assign core study subjects.</p>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {definedGrades.map((g, index) => (
                  <div key={index} className="bg-[#FAF8F5] p-4 rounded-xl border-2 border-[#2D2A26]/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#2D2A26]/5 pb-2">
                      <span className="font-black text-sm uppercase text-[#2D2A26]">Class {g.grade}</span>
                      <button
                        onClick={() => setDefinedGrades(definedGrades.filter((_, i) => i !== index))}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="font-bold text-[#8A8279] block mb-1">Sections</span>
                        <input
                          type="text"
                          value={g.sections.join(', ')}
                          onChange={(e) => {
                            const next = [...definedGrades];
                            next[index].sections = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                            setDefinedGrades(next);
                          }}
                          placeholder="e.g. A, B, C"
                          className="w-full bg-white border-2 border-[#2D2A26] p-2 rounded-lg font-bold"
                        />
                      </div>
                      <div>
                        <span className="font-bold text-[#8A8279] block mb-1">Subjects</span>
                        <input
                          type="text"
                          value={g.subjects.join(', ')}
                          onChange={(e) => {
                            const next = [...definedGrades];
                            next[index].subjects = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            setDefinedGrades(next);
                          }}
                          placeholder="e.g. Physics, Chemistry"
                          className="w-full bg-white border-2 border-[#2D2A26] p-2 rounded-lg font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setDefinedGrades([...definedGrades, { grade: '11', sections: ['A'], subjects: ['Physics', 'Chemistry', 'Mathematics'] }])}
                  className="w-full py-2 border-2 border-dashed border-[#2D2A26]/30 hover:border-[#2D2A26]/60 text-xs font-black uppercase rounded-xl flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Grade
                </button>

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-xs font-bold text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStep('admin_school')}
                    className="flex-1 py-3.5 border-2 border-[#2D2A26] hover:bg-[#2D2A26]/5 font-black uppercase text-xs rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleAdminGradesSubmit}
                    disabled={loading}
                    className="flex-[2] py-3.5 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lock Structure'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ADMIN STEP 4: INVITE TEACHERS */}
        {step === 'admin_teachers' && (
          <motion.div
            key="admin_teachers"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg relative z-10"
          >
            <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl">
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">Invite Faculty Members</h2>
              <p className="text-xs font-bold text-[#8A8279] mb-5">Map teacher emails onto classrooms and subjects.</p>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {teacherInvites.map((t, index) => (
                  <div key={index} className="bg-[#FAF8F5] p-3 rounded-xl border-2 border-[#2D2A26]/10 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={t.name}
                        onChange={(e) => {
                          const next = [...teacherInvites];
                          next[index].name = e.target.value;
                          setTeacherInvites(next);
                        }}
                        placeholder="Teacher Name"
                        className="bg-white border-2 border-[#2D2A26] p-2 rounded-lg font-bold"
                      />
                      <input
                        type="email"
                        value={t.email}
                        onChange={(e) => {
                          const next = [...teacherInvites];
                          next[index].email = e.target.value;
                          setTeacherInvites(next);
                        }}
                        placeholder="Teacher Email"
                        className="bg-white border-2 border-[#2D2A26] p-2 rounded-lg font-bold"
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        type="text"
                        value={t.grade}
                        onChange={(e) => {
                          const next = [...teacherInvites];
                          next[index].grade = e.target.value;
                          setTeacherInvites(next);
                        }}
                        placeholder="Class"
                        className="bg-white border-2 border-[#2D2A26] p-1.5 rounded-lg text-center font-bold"
                      />
                      <input
                        type="text"
                        value={t.section}
                        onChange={(e) => {
                          const next = [...teacherInvites];
                          next[index].section = e.target.value.toUpperCase();
                          setTeacherInvites(next);
                        }}
                        placeholder="Sec"
                        className="bg-white border-2 border-[#2D2A26] p-1.5 rounded-lg text-center font-bold"
                      />
                      <input
                        type="text"
                        value={t.subject}
                        onChange={(e) => {
                          const next = [...teacherInvites];
                          next[index].subject = e.target.value;
                          setTeacherInvites(next);
                        }}
                        placeholder="Subject"
                        className="bg-white border-2 border-[#2D2A26] p-1.5 rounded-lg text-center font-bold"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setTeacherInvites([...teacherInvites, { name: '', email: '', grade: '10', section: 'A', subject: 'Science' }])}
                  className="w-full py-2 border-2 border-dashed border-[#2D2A26]/30 hover:border-[#2D2A26]/60 text-xs font-black uppercase rounded-xl flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Invite Another Teacher
                </button>

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-xs font-bold text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStep('admin_grades')}
                    className="flex-1 py-3.5 border-2 border-[#2D2A26] hover:bg-[#2D2A26]/5 font-black uppercase text-xs rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleAdminTeachersSubmit}
                    disabled={loading}
                    className="flex-[2] py-3.5 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Teacher Invites'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ADMIN STEP 5: IMPORT STUDENT ROSTER */}
        {step === 'admin_roster' && (
          <motion.div
            key="admin_roster"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg relative z-10"
          >
            <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl">
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">Import Student Roster</h2>
              <p className="text-xs font-bold text-[#8A8279] mb-5">Upload student roster to configure school accounts.</p>

              <div className="space-y-4">
                {/* CSV File Upload */}
                <div className="rounded-xl border-3 border-dashed border-[#2D2A26]/30 bg-[#FAF8F5] p-5 text-center">
                  <Upload className="w-8 h-8 text-[#8A8279]/60 mx-auto mb-3" />
                  <span className="text-xs font-black uppercase text-[#2D2A26] block mb-1">Roster CSV File</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const text = evt.target?.result as string;
                          parseStudentRosterCSV(text);
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="w-full text-xs text-[#8A8279] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-2 file:border-[#2D2A26] file:text-[10px] file:font-black file:bg-[#2D2A26] file:text-white cursor-pointer"
                  />
                  <p className="text-[9px] font-bold text-[#8A8279] mt-2">Required headers: name, email, grade, section, roll_number</p>
                </div>

                <div className="max-h-[140px] overflow-y-auto space-y-1">
                  {studentRoster.map((s, idx) => (
                    <div key={idx} className="text-[10px] font-semibold text-[#8A8279] bg-[#FAF8F5] p-2 rounded border border-[#2D2A26]/5 flex justify-between">
                      <span>{s.name} ({s.email})</span>
                      <span className="font-bold text-[#2D2A26]">Class {s.grade}-{s.section}</span>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-xs font-bold text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('admin_teachers')}
                    className="flex-1 py-3.5 border-2 border-[#2D2A26] hover:bg-[#2D2A26]/5 font-black uppercase text-xs rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={saveAdminProfileAndRoster}
                    disabled={loading}
                    className="flex-[2] py-3.5 bg-[#8B7355] text-white border-2 border-white/20 hover:bg-[#9B8365] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Launch Admin Console'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: SESSION TIMING (STUDENT) */}
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
                  <Clock className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Focus Rhythm</h2>
                  <p className="text-xs font-bold text-[#8A8279] mt-0.5">Let's coordinate when ATLAS stacks study topics.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-3">Study Time Preference</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSleepPattern('morning')}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${sleepPattern === 'morning' ? 'bg-[#2D2A26] text-white border-[#2D2A26]' : 'bg-[#FAF8F5] border-[#2D2A26]/15 text-[#2D2A26] hover:border-[#2D2A26]/30'}`}
                    >
                      <span className="font-extrabold text-sm block">☀️ Early Bird</span>
                      <span className="text-[10px] opacity-75 mt-0.5 block">Mornings are best</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSleepPattern('evening')}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${sleepPattern === 'evening' ? 'bg-[#2D2A26] text-white border-[#2D2A26]' : 'bg-[#FAF8F5] border-[#2D2A26]/15 text-[#2D2A26] hover:border-[#2D2A26]/30'}`}
                    >
                      <span className="font-extrabold text-sm block">🌙 Night Owl</span>
                      <span className="text-[10px] opacity-75 mt-0.5 block">Late evenings are best</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-3">Target Performance Threshold</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { val: 'growth', label: '🌱 recovery', desc: 'Strengthen core' },
                      { val: 'steady', label: '📈 steady', desc: 'Main school track' },
                      { val: 'top', label: '🚀 top marks', desc: 'JEE/Competitive' }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setPreviousScores(opt.val as any)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${previousScores === opt.val ? 'bg-[#8B7355]/10 border-[#8B7355] shadow-[4px_4px_0px_0px_#8B7355]' : 'bg-[#FAF8F5] border-[#2D2A26]/15 hover:border-[#2D2A26]/30'}`}
                      >
                        <span className="font-extrabold text-xs block text-[#2D2A26] uppercase">{opt.label}</span>
                        <span className="text-[9px] text-[#8A8279] mt-0.5 block leading-tight">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
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
                    className="flex-[2] py-3.5 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    Next: Quick Recall Check <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: DIAGNOSTIC QUIZ (STUDENT) */}
        {step === 'quiz' && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg relative z-10"
          >
            <div className="bg-white border-4 border-[#2D2A26] p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] rounded-2xl">
              <div className="flex items-center justify-between border-b-2 border-[#2D2A26]/10 pb-4 mb-5">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Recall Verification</h2>
                  <p className="text-xs font-bold text-[#8A8279] mt-0.5">Let's check your baseline recall level.</p>
                </div>
                <div className="inline-flex items-center gap-1 bg-[#8B7355]/10 border border-[#8B7355]/20 text-[#8B7355] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  <Star className="w-3 h-3 fill-current" /> {quizQuestions.length} Topics
                </div>
              </div>

              <div className="space-y-6">
                {quizQuestions.map((q, qidx) => (
                  <div key={qidx} className="space-y-2 border-b border-[#2D2A26]/5 pb-4 last:border-b-0">
                    <p className="text-sm font-black leading-tight text-[#2d2a26]">
                      Q{qidx + 1}: {q.question}
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, oidx) => (
                        <button
                          key={oidx}
                          onClick={() => setQuizAnswers({ ...quizAnswers, [qidx]: oidx })}
                          className={`p-2.5 rounded-lg border-2 text-left text-xs font-bold transition-all ${quizAnswers[qidx] === oidx ? 'bg-[#2D2A26] text-white border-[#2D2A26]' : 'bg-[#FAF8F5] border-[#2D2A26]/15 hover:border-[#2D2A26]/35'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

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
                    className="flex-[2] py-3.5 bg-[#2D2A26] text-white border-2 border-[#2D2A26] hover:bg-[#3D3833] font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    Build Dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3.5: LOADING COGNITIVE BUILDER */}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 text-[#2D2A26]">
                <div className="bg-white p-5 rounded-2xl border-2 border-white flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-[#8A8279] uppercase tracking-wider mb-2">Cognitive Blueprint</p>
                    <h3 className="text-lg font-black leading-tight uppercase mb-1 font-black">
                      {sleepPattern === 'morning' ? '☀️ Early Bird Scholar' : '🌙 Night Owl Scholar'}
                    </h3>
                    <p className="text-xs text-[#8A8279] leading-relaxed">
                      Your peak alertness is modeled around <span className="font-extrabold text-[#2D2A26]">{sleepPattern === 'morning' ? 'mornings' : 'late evenings'}</span>.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border-2 border-white flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-[#8A8279] uppercase tracking-wider mb-2">Performance Vector</p>
                    <h3 className="text-lg font-black leading-tight uppercase mb-1 font-black">
                      {previousScores === 'top' ? '🚀 Top-Rank Target' : previousScores === 'steady' ? '📈 Steady Growth' : '🌱 Conceptual Recovery'}
                    </h3>
                    <p className="text-xs text-[#8A8279] leading-relaxed">
                      Revision cycles are calibrated for {previousScores === 'top' ? 'maximum rigor' : 'balanced conceptual pace'}.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border-2 border-white md:col-span-2">
                  <p className="text-[10px] font-black text-[#8A8279] uppercase tracking-wider mb-3">Adaptive Study Strategy</p>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-[#2D2A26]/5 pb-1.5">
                      <span className="font-bold text-[#8A8279]">Syllabus Class</span>
                      <span className="font-black text-[#2D2A26]">Class {grade} {isPCM ? 'JEE (PCM)' : 'CBSE'}</span>
                    </div>
                    {quizScore !== null && (
                      <div className="flex items-center justify-between border-b border-[#2D2A26]/5 pb-1.5">
                        <span className="font-bold text-[#8A8279]">Recall Baseline</span>
                        <span className="font-black text-[#2D2A26]">{quizScore} / {quizQuestions.length} Correct</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#8A8279]">Focus Remedial Subject</span>
                      <span className="font-black text-red-600 uppercase">{weakestSubject}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 relative z-10">
                <button
                  onClick={saveStudentProfile}
                  disabled={loading}
                  className="w-full py-4.5 bg-[#8B7355] text-white border-2 border-white/20 hover:bg-[#9B8365] font-black uppercase text-sm rounded-xl transition-all shadow-[0_6px_20px_rgba(139,115,85,0.4)] active:translate-y-0.5 flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShieldCheck className="w-5 h-5" /> Launch My Workspace</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
