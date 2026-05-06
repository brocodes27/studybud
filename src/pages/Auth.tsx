import React, { useState } from 'react';
import { Brain, Mail, Lock, User, GraduationCap, Sparkles, ArrowRight, Loader2, Shield, BookOpen, Users, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

type OnboardingPath = 'select' | 'self-paced' | 'self-curriculum' | 'join-class' | 'auth';
type AuthMode = 'signin' | 'signup';

export function Auth() {
  const [onboardingPath, setOnboardingPath] = useState<OnboardingPath>('select');
  const [classCode, setClassCode] = useState('');
  const [classLookupResult, setClassLookupResult] = useState<{
    class_name: string;
    teacher_name: string;
    role: 'student' | 'teacher';
    class_id: string;
  } | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const handleClassCodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode.trim()) return;

    setCodeLoading(true);
    try {
      // Look up class by invite code
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, teacher:users!classes_teacher_id_fkey(full_name), invite_code')
        .eq('invite_code', classCode.trim().toUpperCase())
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
        role: 'student' // Default, teacher codes handled differently
      });
      setOnboardingPath('auth');
    } catch (err) {
      showToast('Error looking up class code.', 'error');
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up with determined role (from class or default to student)
        const role = classLookupResult?.role || 'student';
        const { error } = await signUp(formData.email, formData.password, {
          full_name: formData.full_name,
          grade: role === 'student' ? formData.grade : null,
          school: formData.school || null,
          role
        });

        if (error) throw error;

        // If joining via class code, add to class
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

        // If joining via class code, add to class
        if (classLookupResult) {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            // Check if already enrolled
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

      // Navigate based on path
      if (onboardingPath === 'join-class' || classLookupResult) {
        navigate('/dashboard');
      } else if (onboardingPath === 'self-curriculum') {
        navigate('/onboarding/curriculum');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetToSelection = () => {
    setOnboardingPath('select');
    setClassLookupResult(null);
    setClassCode('');
    setIsSignUp(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#FAFBFF' }}>
      {/* Mesh gradient background */}
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

        {/* PATH SELECTION - Step 1 */}
        {onboardingPath === 'select' && (
          <div className="space-y-3">
            <p className="text-center text-[#64748B] font-medium mb-6">How do you want to get started?</p>

            {/* Self-Paced Course */}
            <button
              onClick={() => setOnboardingPath('self-paced')}
              className="w-full bg-white/80 backdrop-blur-xl rounded-[20px] border border-[#0A192F]/[0.06] shadow-neo-md p-5 text-left hover:scale-[1.02] transition-transform group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#34D399] to-[#00D1FF] flex items-center justify-center text-white flex-shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0A192F] text-lg mb-1">Self-Paced Course</h3>
                  <p className="text-[#64748B] text-sm">Start learning at your own speed with our curated content library.</p>
                </div>
              </div>
            </button>

            {/* Self-Curriculum */}
            <button
              onClick={() => setOnboardingPath('self-curriculum')}
              className="w-full bg-white/80 backdrop-blur-xl rounded-[20px] border border-[#0A192F]/[0.06] shadow-neo-md p-5 text-left hover:scale-[1.02] transition-transform group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#F59E0B] flex items-center justify-center text-white flex-shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0A192F] text-lg mb-1">Build Your Curriculum</h3>
                  <p className="text-[#64748B] text-sm">Create personalized learning paths tailored to your goals.</p>
                </div>
              </div>
            </button>

            {/* Join with Class Code */}
            <button
              onClick={() => setOnboardingPath('join-class')}
              className="w-full bg-white/80 backdrop-blur-xl rounded-[20px] border border-[#0A192F]/[0.06] shadow-neo-md p-5 text-left hover:scale-[1.02] transition-transform group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#00D1FF] flex items-center justify-center text-white flex-shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0A192F] text-lg mb-1">Join a Class</h3>
                  <p className="text-[#64748B] text-sm">Enter class code from your teacher to join.</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* CLASS CODE ENTRY - Step 2 for join-class */}
        {onboardingPath === 'join-class' && !classLookupResult && (
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

        {/* CLASS CONFIRMED - Show class info, proceed to auth */}
        {onboardingPath === 'join-class' && classLookupResult && (
          <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-[#0A192F]/[0.06] shadow-neo-lg p-8">
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

            <button
              onClick={() => setOnboardingPath('auth')}
              className="neo-button w-full py-3.5 flex items-center justify-center gap-2 group"
            >
              Create Account / Sign In <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => { setClassLookupResult(null); setOnboardingPath('join-class'); }}
              className="w-full text-center text-[#64748B] hover:text-[#0A192F] text-sm font-medium mt-4"
            >
              Use different code
            </button>
          </div>
        )}

        {/* AUTH FORM - Self-paced / Self-curriculum / Class join */}
        {(onboardingPath === 'self-paced' || onboardingPath === 'self-curriculum' || (onboardingPath === 'auth' && !classLookupResult)) && (
          <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-[#0A192F]/[0.06] shadow-neo-lg p-8">
            <button
              onClick={resetToSelection}
              className="text-[#64748B] hover:text-[#0A192F] text-sm font-medium mb-4 flex items-center gap-1"
            >
              <ArrowRight className="h-4 w-4 rotate-180" /> Back
            </button>

            <form onSubmit={handleSubmit} className="space-y-4">
              {onboardingPath !== 'auth' && (
                <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-[#00D1FF]/[0.06] to-[#6366F1]/[0.06] rounded-xl border border-[#6366F1]/10 mb-2">
                  {onboardingPath === 'self-paced' && <><BookOpen className="h-4 w-4 text-[#6366F1]" /><span className="text-xs font-bold text-[#0A192F] uppercase tracking-wider">Self-Paced Course</span></>}
                  {onboardingPath === 'self-curriculum' && <><Sparkles className="h-4 w-4 text-[#6366F1]" /><span className="text-xs font-bold text-[#0A192F] uppercase tracking-wider">Build Your Curriculum</span></>}
                </div>
              )}

              <div className="space-y-3">
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

                {(onboardingPath === 'self-curriculum' || onboardingPath === 'auth') && (
                  <div className="relative">
                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                    <input
                      type="text"
                      required
                      value={formData.grade}
                      onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
                      className="neo-input w-full pl-11"
                      placeholder="Grade / Class (e.g., 12)"
                    />
                  </div>
                )}

                <div className="relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></svg>
                  <input
                    type="text"
                    value={formData.school}
                    onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))}
                    className="neo-input w-full pl-11"
                    placeholder="School Name (Optional)"
                  />
                </div>
              </div>

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

            <div className="mt-5 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-[#64748B] hover:text-[#0A192F] transition-colors text-sm font-medium"
              >
                {isSignUp ? (
                  <>Already have an account? <span className="text-gradient font-bold">Sign in</span></>
                ) : (
                  <>Don't have an account? <span className="text-gradient font-bold">Sign up</span></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer Features */}
        {onboardingPath === 'select' && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { icon: Brain, label: 'AI Powered', gradient: 'from-[#00D1FF] to-[#6366F1]' },
              { icon: Sparkles, label: 'Personalized', gradient: 'from-[#F472B6] to-[#F59E0B]' },
              { icon: GraduationCap, label: 'Smart Plans', gradient: 'from-[#34D399] to-[#00D1FF]' },
            ].map(({ icon: Icon, label, gradient }, i) => (
              <div key={i} className="bg-white/60 backdrop-blur-sm rounded-xl border border-[#0A192F]/[0.04] p-4 text-center">
                <div className={`w-9 h-9 mx-auto mb-2 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}