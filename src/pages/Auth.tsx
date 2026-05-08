import React, { useState } from 'react';
import { Brain, Mail, Lock, User, GraduationCap, Sparkles, ArrowRight, Loader2, Shield, BookOpen, Users, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

type OnboardingPath = 'select' | 'self-paced' | 'self-curriculum' | 'join-class';

export function Auth() {
  const [selectedPath, setSelectedPath] = useState<OnboardingPath | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [userRole, setUserRole] = useState<'student' | 'teacher'>('student');
  const [loading, setLoading] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [classLookupResult, setClassLookupResult] = useState<{
    class_name: string;
    teacher_name: string;
    role: 'student' | 'teacher';
    class_id: string;
  } | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    grade: '',
    school: ''
  });

  const { signIn, signUp } = useAuth() as any;
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const role = userRole;
        const { error } = await signUp(formData.email, formData.password, {
          full_name: formData.full_name,
          grade: role === 'student' ? formData.grade : null,
          school: formData.school || null,
          role
        });

        if (error) throw error;

        if (classLookupResult) {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            await supabase.from('class_enrollments').insert({
              user_id: userData.user.id,
              class_id: classLookupResult.class_id,
              role: classLookupResult.role
            });
          }
        }

        showToast('Account created!', 'success');
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) throw error;

        if (classLookupResult) {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const { data: existing } = await supabase
              .from('class_enrollments')
              .select('id')
              .eq('user_id', userData.user.id)
              .eq('class_id', classLookupResult.class_id)
              .single();

            if (!existing) {
              await supabase.from('class_enrollments').insert({
                user_id: userData.user.id,
                class_id: classLookupResult.class_id,
                role: classLookupResult.role
              });
            }
          }
        }

        showToast('Welcome back!', 'success');
      }

      if (selectedPath === 'join-class' || classLookupResult) {
        navigate(userRole === 'teacher' ? '/my-classes' : '/dashboard');
      } else if (selectedPath === 'self-curriculum') {
        navigate('/onboarding/curriculum');
      } else {
        navigate(userRole === 'teacher' ? '/my-classes' : '/dashboard');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClassCodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode.trim()) return;

    setCodeLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, teacher:user_profiles!classes_teacher_id_fkey(full_name), class_code')
        .eq('class_code', classCode.trim().toUpperCase())
        .single();

      if (error || !data) {
        showToast('Invalid class code. Check and try again.', 'error');
        setCodeLoading(false);
        return;
      }

      setClassLookupResult({
        class_id: data.id,
        class_name: data.name,
        teacher_name: data.teacher?.full_name || 'Teacher',
        role: 'student'
      });
    } catch (err) {
      showToast('Error looking up class code.', 'error');
    } finally {
      setCodeLoading(false);
    }
  };

  const resetToSelection = () => {
    setSelectedPath(null);
    setClassLookupResult(null);
    setClassCode('');
    setUserRole('student');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#FAFBFF' }}>
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-[#00D1FF]/[0.07] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#6366F1]/[0.06] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-[40%] right-[10%] w-[30%] h-[30%] bg-[#F472B6]/[0.04] rounded-full blur-[100px] pointer-events-none" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative group">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-float-indigo group-hover:scale-110 transition-transform duration-300"
                style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)' }}>
                <Brain className="h-7 w-7" />
              </div>
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-[#00D1FF] to-[#6366F1] opacity-0 group-hover:opacity-15 blur-lg transition-opacity duration-500" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-[#0A192F] mb-2 tracking-tight font-display">Elevenfolks</h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#6366F1]/[0.08] rounded-full mb-3">
            <Shield className="w-3 h-3 text-[#6366F1]" />
            <p className="text-[#6366F1] font-bold tracking-wider text-[10px] uppercase">Secure Access</p>
          </div>
        </div>

        {/* PATH SELECTION - always first */}
        {selectedPath === null && (
          <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-[#0A192F]/[0.06] shadow-neo-lg p-8">
            <p className="text-center text-[#64748B] font-medium mb-6">How do you want to get started?</p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSelectedPath('self-paced')}
                className="w-full bg-[#F8FAFF] hover:bg-[#00D1FF]/[0.05] rounded-[16px] border border-[#0A192F]/[0.06] p-4 text-left transition-all hover:border-[#00D1FF]/20 hover:scale-[1.01]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#34D399] to-[#00D1FF] flex items-center justify-center text-white flex-shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0A192F] text-base">Self-Paced Course</p>
                    <p className="text-[#64748B] text-sm">Learn at your own speed with curated content</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPath('self-curriculum')}
                className="w-full bg-[#F8FAFF] hover:bg-[#00D1FF]/[0.05] rounded-[16px] border border-[#0A192F]/[0.06] p-4 text-left transition-all hover:border-[#00D1FF]/20 hover:scale-[1.01]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#F59E0B] flex items-center justify-center text-white flex-shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0A192F] text-base">Build Your Curriculum</p>
                    <p className="text-[#64748B] text-sm">Create personalized learning paths</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPath('join-class')}
                className="w-full bg-[#F8FAFF] hover:bg-[#00D1FF]/[0.05] rounded-[16px] border border-[#0A192F]/[0.06] p-4 text-left transition-all hover:border-[#00D1FF]/20 hover:scale-[1.01]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#00D1FF] flex items-center justify-center text-white flex-shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0A192F] text-base">Join a Class</p>
                    <p className="text-[#64748B] text-sm">Enter class code from your teacher</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* CLASS CODE ENTRY */}
        {selectedPath === 'join-class' && !classLookupResult && (
          <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-[#0A192F]/[0.06] shadow-neo-lg p-8">
            <button
              onClick={resetToSelection}
              className="text-[#64748B] hover:text-[#0A192F] text-sm font-medium mb-4 flex items-center gap-1"
            >
              <ArrowRight className="h-4 w-4 rotate-180" /> Back
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#00D1FF] flex items-center justify-center text-white mx-auto mb-3">
                <Hash className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-[#0A192F]">Enter Class Code</h2>
              <p className="text-[#64748B] text-sm mt-1">Ask your teacher for the code.</p>
            </div>

            <form onSubmit={handleClassCodeLookup} className="space-y-4">
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#94A3B8]" />
                <input
                  type="text"
                  required
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  className="neo-input w-full pl-11 text-center text-xl font-mono tracking-widest"
                  placeholder="XXXXXX"
                  maxLength={10}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={codeLoading || !classCode.trim()}
                className="neo-button w-full py-3.5 flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {codeLoading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Looking up...</>
                ) : (
                  <>Continue <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
          </div>
        )}

        {/* CLASS CONFIRMED - proceed to auth */}
        {selectedPath === 'join-class' && classLookupResult && (
          <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-[#0A192F]/[0.06] shadow-neo-lg p-8">
            <button
              onClick={resetToSelection}
              className="text-[#64748B] hover:text-[#0A192F] text-sm font-medium mb-4 flex items-center gap-1"
            >
              <ArrowRight className="h-4 w-4 rotate-180" /> Back
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#34D399] to-[#00D1FF] flex items-center justify-center text-white mx-auto mb-4">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold text-[#0A192F]">Class Found!</h2>
              <div className="bg-[#F8FAFF] rounded-xl p-4 mt-4">
                <p className="font-bold text-[#0A192F] text-lg">{classLookupResult.class_name}</p>
                <p className="text-[#64748B] text-sm mt-1">with {classLookupResult.teacher_name}</p>
              </div>
            </div>

            {/* Auth form for join-class */}
            <div className="flex items-center gap-2 p-1 bg-[#F8FAFF] rounded-[14px] mb-3">
              <button
                type="button"
                onClick={() => setUserRole('student')}
                className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all ${userRole === 'student' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setUserRole('teacher')}
                className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all ${userRole === 'teacher' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
              >
                Teacher
              </button>
            </div>

            <div className="flex items-center gap-2 p-1 bg-[#F8FAFF] rounded-[14px] mb-4">
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all ${!isSignUp ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all ${isSignUp ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && !classLookupResult && (
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="neo-input w-full pl-11"
                    placeholder={userRole === 'teacher' ? 'Dr. Sarah Chen' : 'Full Name'}
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="neo-input w-full pl-11"
                  placeholder="Email Address"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="neo-input w-full pl-11"
                  placeholder="Password"
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="neo-button w-full py-3.5 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Please wait...</>
                ) : (
                  <>{isSignUp ? 'Create Account' : 'Sign In'} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>

            <button
              onClick={() => { setClassLookupResult(null); setSelectedPath('join-class'); }}
              className="w-full text-center text-[#64748B] hover:text-[#0A192F] text-sm font-medium mt-4"
            >
              Use different code
            </button>
          </div>
        )}

        {/* SELF-PACED or SELF-CURRICULUM - auth form */}
        {(selectedPath === 'self-paced' || selectedPath === 'self-curriculum') && (
          <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-[#0A192F]/[0.06] shadow-neo-lg p-8">
            <button
              onClick={resetToSelection}
              className="text-[#64748B] hover:text-[#0A192F] text-sm font-medium mb-4 flex items-center gap-1"
            >
              <ArrowRight className="h-4 w-4 rotate-180" /> Back
            </button>

            <div className="flex items-center gap-2 p-1 bg-[#F8FAFF] rounded-[14px] mb-3">
              <button
                type="button"
                onClick={() => setUserRole('student')}
                className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all ${userRole === 'student' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setUserRole('teacher')}
                className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all ${userRole === 'teacher' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
              >
                Teacher
              </button>
            </div>

            <div className="flex items-center gap-2 p-1 bg-[#F8FAFF] rounded-[14px] mb-4">
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all ${!isSignUp ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all ${isSignUp ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
              >
                Sign Up
              </button>
            </div>

            <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-[#00D1FF]/[0.06] to-[#6366F1]/[0.06] rounded-xl border border-[#6366F1]/10 mb-4">
              {selectedPath === 'self-paced' && <><BookOpen className="h-4 w-4 text-[#6366F1]" /><span className="text-xs font-bold text-[#0A192F] uppercase tracking-wider">Self-Paced Course</span></>}
              {selectedPath === 'self-curriculum' && <><Sparkles className="h-4 w-4 text-[#6366F1]" /><span className="text-xs font-bold text-[#0A192F] uppercase tracking-wider">Build Your Curriculum</span></>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="neo-input w-full pl-11"
                      placeholder="Full Name"
                    />
                  </div>

                  {selectedPath === 'self-curriculum' && (
                    <div className="relative">
                      <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                      <input
                        type="text"
                        value={formData.grade}
                        onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
                        className="neo-input w-full pl-11"
                        placeholder="Grade / Class (optional)"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="neo-input w-full pl-11"
                  placeholder="Email Address"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="neo-input w-full pl-11"
                  placeholder="Password"
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="neo-button w-full py-3.5 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Please wait...</>
                ) : (
                  <>{isSignUp ? 'Create Account' : 'Sign In'} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
export default Auth;