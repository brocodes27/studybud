import React, { useState } from 'react';
import { Brain, Mail, Lock, User, GraduationCap, BookOpen, ArrowRight, Loader2, Shield, Hash, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

async function enrollStudentInClass(userId: string, classId: string) {
  // Try inserting with user_id
  const { error: err1 } = await supabase.from('class_members').insert({
    user_id: userId,
    class_id: classId
  });
  if (!err1) return { success: true };

  // Fallback: try inserting with student_id
  const { error: err2 } = await supabase.from('class_members').insert({
    student_id: userId,
    class_id: classId
  });
  if (!err2) return { success: true };

  console.error('Failed to enroll student:', err1, err2);
  throw new Error(err1.message || err2.message || 'Failed to join class');
}

async function checkEnrollmentExists(userId: string, classId: string) {
  // Check with user_id first
  const { data: d1 } = await supabase
    .from('class_members')
    .select('id')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .maybeSingle();
  if (d1) return true;

  // Fallback check with student_id
  const { data: d2 } = await supabase
    .from('class_members')
    .select('id')
    .eq('student_id', userId)
    .eq('class_id', classId)
    .maybeSingle();
  return !!d2;
}

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [userRole, setUserRole] = useState<'student' | 'teacher'>('student');
  const [loading, setLoading] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [classLookupResult, setClassLookupResult] = useState<{
    class_name: string;
    teacher_name: string;
    class_id: string;
  } | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
  });

  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth() as any;
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (error: any) {
      showToast(error.message || 'Google sign-in failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const role = userRole;
      const fullName = formData.full_name.trim();

      if (isSignUp) {
        if (!fullName) {
          throw new Error('Please enter your full name.');
        }
        if (role === 'student' && !classLookupResult) {
          throw new Error('Please enter a class code to join your class.');
        }

        const { error, data: signUpData } = await signUp(formData.email, formData.password, {
          full_name: fullName,
          role
        });

        if (error) throw error;

        if (classLookupResult && signUpData?.user) {
          await enrollStudentInClass(signUpData.user.id, classLookupResult.class_id);
        }

        showToast('Account created!', 'success');
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) throw error;

        if (classLookupResult) {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const isEnrolled = await checkEnrollmentExists(userData.user.id, classLookupResult.class_id);
            if (!isEnrolled) {
              await enrollStudentInClass(userData.user.id, classLookupResult.class_id);
            }
          }
        }

        showToast('Welcome back!', 'success');
      }

      navigate('/my-classes');
    } catch (error: any) {
      let msg = error.message;
      const isCredentialError = 
        msg?.toLowerCase().includes('credential') || 
        msg?.toLowerCase().includes('invalid') || 
        msg?.toLowerCase().includes('email') || 
        error.status === 400 || error.status === 401 ||
        error.statusCode === 400 || error.statusCode === 401 ||
        error.status_code === 400 || error.status_code === 401;

      if (!isSignUp && isCredentialError) {
        msg = "The password is wrong, entered wrong, or whatever the issue is.";
      }
      showToast(msg, 'error');
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
        setClassLookupResult(null);
        setCodeLoading(false);
        return;
      }

      setClassLookupResult({
        class_id: data.id,
        class_name: data.name,
        teacher_name: data.teacher?.full_name || 'Teacher',
      });
    } catch (err) {
      showToast('Error looking up class code.', 'error');
      setClassLookupResult(null);
    } finally {
      setCodeLoading(false);
    }
  };

  const resetClassLookup = () => {
    setClassLookupResult(null);
    setClassCode('');
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

        <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-[#0A192F]/[0.06] shadow-neo-lg p-8">
          {/* Role Selection */}
          <div className="flex items-center gap-2 p-1 bg-[#F8FAFF] rounded-[14px] mb-4">
            <button
              type="button"
              onClick={() => { setUserRole('student'); resetClassLookup(); }}
              className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${userRole === 'student' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
            >
              <GraduationCap className="w-4 h-4" /> Student
            </button>
            <button
              type="button"
              onClick={() => { setUserRole('teacher'); resetClassLookup(); }}
              className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${userRole === 'teacher' ? 'bg-white text-[#8B7355] shadow-sm' : 'text-[#64748B]'}`}
            >
              <BookOpen className="w-4 h-4" /> Teacher
            </button>
          </div>

          {/* Sign In / Sign Up Toggle */}
          <div className="flex items-center gap-2 p-1 bg-[#F8FAFF] rounded-[14px] mb-6">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); resetClassLookup(); }}
              className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all ${!isSignUp ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); resetClassLookup(); }}
              className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all ${isSignUp ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
            >
              Sign Up
            </button>
          </div>

          {/* Student: Class Code */}
          {userRole === 'student' && isSignUp && !classLookupResult && (
            <form onSubmit={handleClassCodeLookup} className="space-y-4 mb-6">
              <div className="text-center">
                <h2 className="text-lg font-bold text-[#0A192F]">Join Your Class</h2>
                <p className="text-[#64748B] text-sm mt-1">Ask your teacher for the class code.</p>
              </div>
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
                className="neo-button w-full py-3 flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {codeLoading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Looking up...</>
                ) : (
                  <>Continue <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
          )}

          {/* Student: Class Confirmed */}
          {userRole === 'student' && classLookupResult && (
            <div className="bg-[#F8FAFF] rounded-xl p-4 mb-6 text-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#34D399] to-[#00D1FF] flex items-center justify-center text-white mx-auto mb-2">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="font-bold text-[#0A192F]">{classLookupResult.class_name}</p>
              <p className="text-[#64748B] text-sm">with {classLookupResult.teacher_name}</p>
              <button
                onClick={resetClassLookup}
                className="text-[#64748B] hover:text-[#0A192F] text-xs font-medium mt-2"
              >
                Use different code
              </button>
            </div>
          )}

          {/* Teacher: Info */}
          {userRole === 'teacher' && (
            <div className="bg-[#F8FAFF] rounded-xl p-4 mb-6 text-center">
              <p className="text-sm text-[#64748B]">Sign in to manage your classes and students.</p>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input
                  type="text"
                  required={isSignUp}
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="neo-input w-full pl-11"
                  placeholder="Full Name"
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
              disabled={loading || (userRole === 'student' && isSignUp && !classLookupResult)}
              className="neo-button w-full py-3.5 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Please wait...</>
              ) : (
                <>{isSignUp ? 'Create Account' : 'Sign In'} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-4">
            <div className="flex-1 h-px bg-[#0A192F]/[0.08]" />
            <span className="mx-3 text-[#64748B] text-xs font-semibold uppercase tracking-wider">Or</span>
            <div className="flex-1 h-px bg-[#0A192F]/[0.08]" />
          </div>

          {/* Google Sign-In */}
          <button
            type="button"
            disabled={googleLoading || loading}
            onClick={handleGoogleSignIn}
            className="neo-button-secondary w-full py-3.5 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.977 13.409-5.197l-6.19-5.236C29.133 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.553 5.047C9.482 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-3.994 5.566l.003-.002 6.19 5.236C35.246 40.416 40 34.667 40 26c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
            )}
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

export default Auth;
