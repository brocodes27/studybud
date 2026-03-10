import React, { useState } from 'react';
import { Brain, Mail, Lock, User, GraduationCap, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    grade: '',
    school: ''
  });
  const [selectedRole] = useState<'student' | 'teacher'>('student');

  const { signIn, signUp } = useAuth() as any;
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(formData.email, formData.password, {
          full_name: formData.full_name,
          grade: selectedRole === 'student' ? formData.grade : null,
          school: formData.school,
          role: selectedRole
        });
        if (error) throw error;
        showToast('Account created successfully!', 'success');
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) throw error;
        showToast('Welcome back!', 'success');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAFF] relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#00D1FF]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#F472B6]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative group">
              <div className="w-16 h-16 bg-[#00D1FF]/10 border-2 border-[#00D1FF]/20 rounded-[20px] flex items-center justify-center shadow-float-cyan group-hover:scale-110 transition-transform duration-300">
                <Brain className="h-8 w-8 text-[#00D1FF]" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-[#F472B6] animate-bounce" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-[#0A192F] mb-2 tracking-tight">ElevenFolks</h1>
          <p className="text-[#00D1FF] font-bold tracking-wider text-sm uppercase mb-2">Future Learning</p>
          <p className="text-[#64748B] font-medium">
            {isSignUp ? 'Join the future of education today.' : 'Welcome back, future achiever.'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-[32px] border-2 border-[#0A192F]/5 shadow-float-cyan p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="flex items-center gap-2 p-3 bg-[#00D1FF]/5 rounded-[12px] border border-[#00D1FF]/20 mb-2">
                  <GraduationCap className="h-4 w-4 text-[#00D1FF]" />
                  <span className="text-xs font-bold text-[#00D1FF] uppercase tracking-widest">Student Account</span>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full pl-11 pr-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 text-[#0A192F] placeholder-[#64748B]/50 focus:border-[#00D1FF]/40 focus:outline-none transition-all bg-white"
                      placeholder="Full Name"
                    />
                  </div>

                  {selectedRole === 'student' && (
                    <div className="relative">
                      <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
                      <input
                        type="text"
                        required
                        value={formData.grade}
                        onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
                        className="w-full pl-11 pr-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 text-[#0A192F] placeholder-[#64748B]/50 focus:border-[#00D1FF]/40 focus:outline-none transition-all bg-white"
                        placeholder="Grade / Class (e.g., 12)"
                      />
                    </div>
                  )}

                  <div className="relative">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></svg>
                    <input
                      type="text"
                      value={formData.school}
                      onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))}
                      className="w-full pl-11 pr-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 text-[#0A192F] placeholder-[#64748B]/50 focus:border-[#00D1FF]/40 focus:outline-none transition-all bg-white"
                      placeholder="School Name (Optional)"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full pl-11 pr-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 text-[#0A192F] placeholder-[#64748B]/50 focus:border-[#00D1FF]/40 focus:outline-none transition-all bg-white"
                placeholder="Email Address"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full pl-11 pr-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 text-[#0A192F] placeholder-[#64748B]/50 focus:border-[#00D1FF]/40 focus:outline-none transition-all bg-white"
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
                <>Already have an account? <span className="text-[#00D1FF] font-bold">Sign in</span></>
              ) : (
                <>Don't have an account? <span className="text-[#00D1FF] font-bold">Sign up</span></>
              )}
            </button>
          </div>
        </div>

        {/* Footer Features */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: Brain, label: 'AI Powered', color: 'text-[#00D1FF]', bg: 'bg-[#00D1FF]/10 border-[#00D1FF]/20' },
            { icon: Sparkles, label: 'Personalized', color: 'text-[#F472B6]', bg: 'bg-[#F472B6]/10 border-[#F472B6]/20' },
            { icon: GraduationCap, label: 'Smart Plans', color: 'text-[#34D399]', bg: 'bg-[#34D399]/10 border-[#34D399]/20' },
          ].map(({ icon: Icon, label, color, bg }, i) => (
            <div key={i} className={`bg-white rounded-[16px] border-2 ${bg.split(' ')[1]} p-4 text-center`}>
              <Icon className={`h-5 w-5 ${color} mx-auto mb-2`} />
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
