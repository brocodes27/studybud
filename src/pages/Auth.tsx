import React, { useState } from 'react';
import { Brain, Mail, Lock, User, GraduationCap, Sparkles, ArrowRight, Loader2, Shield } from 'lucide-react';
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
          <p className="text-[#64748B] font-medium">
            {isSignUp ? 'Join the future of education today.' : 'Welcome back, future achiever.'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-[#0A192F]/[0.06] shadow-neo-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-[#00D1FF]/[0.06] to-[#6366F1]/[0.06] rounded-xl border border-[#6366F1]/10 mb-2">
                  <GraduationCap className="h-4 w-4 text-[#6366F1]" />
                  <span className="text-xs font-bold text-[#0A192F] uppercase tracking-wider">Student Account</span>
                </div>

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

                  {selectedRole === 'student' && (
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

        {/* Footer Features */}
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
      </div>
    </div>
  );
}
