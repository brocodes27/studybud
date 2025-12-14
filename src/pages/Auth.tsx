import React, { useState } from 'react';
import { Brain, Mail, Lock, User, GraduationCap, Sparkles, Star, ArrowRight, Loader2 } from 'lucide-react';
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
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher'>('student');

  const { signIn, signUp } = useAuth();
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0b14]">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-neon-blue/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-neon-purple/10 rounded-full blur-[120px] animate-pulse animation-delay-2000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative group">
              <div className="w-16 h-16 bg-gradient-to-br from-neon-blue to-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(0,243,255,0.3)] group-hover:scale-110 transition-transform duration-300">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <Sparkles className="absolute -top-3 -right-3 h-6 w-6 text-neon-yellow animate-bounce" />
              <Star className="absolute -bottom-2 -left-2 h-5 w-5 text-neon-purple animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            ElevenFolks
          </h1>
          <p className="text-neon-blue font-medium tracking-wider text-sm uppercase mb-4">Future Learning</p>
          <p className="text-gray-400">
            {isSignUp ? 'Join the future of education today.' : 'Welcome back, future achiever.'}
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <>
                {/* Role Selection */}
                <div className="grid grid-cols-2 gap-4 p-1 bg-black/40 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('student')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${selectedRole === 'student'
                        ? 'bg-neon-blue text-black shadow-lg shadow-neon-blue/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('teacher')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${selectedRole === 'teacher'
                        ? 'bg-neon-purple text-white shadow-lg shadow-neon-purple/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <User className="h-4 w-4" />
                    Teacher
                  </button>
                </div>

                <div className="space-y-4 animate-fade-in">
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-neon-blue transition-colors" />
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 focus:outline-none transition-all"
                      placeholder="Full Name"
                    />
                  </div>

                  {selectedRole === 'student' && (
                    <div className="relative group">
                      <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-neon-blue transition-colors" />
                      <input
                        type="text"
                        required
                        value={formData.grade}
                        onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 focus:outline-none transition-all"
                        placeholder="Grade / Class (e.g., 12)"
                      />
                    </div>
                  )}

                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-neon-blue transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building-2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></svg>
                    </div>
                    <input
                      type="text"
                      value={formData.school}
                      onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 focus:outline-none transition-all"
                      placeholder="School Name (Optional)"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-neon-blue transition-colors" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 focus:outline-none transition-all"
                placeholder="Email Address"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-neon-blue transition-colors" />
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 focus:outline-none transition-all"
                placeholder="Password"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-neon-blue to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg shadow-neon-blue/25 hover:shadow-neon-blue/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Please wait...
                </>
              ) : (
                <>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
            >
              {isSignUp ? (
                <>Already have an account? <span className="text-neon-blue">Sign in</span></>
              ) : (
                <>Don't have an account? <span className="text-neon-blue">Sign up</span></>
              )}
            </button>
          </div>
        </div>

        {/* Footer Features */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-white/5 text-center hover:border-neon-blue/30 transition-colors">
            <Brain className="h-6 w-6 text-neon-blue mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">AI Powered</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-white/5 text-center hover:border-neon-yellow/30 transition-colors">
            <Star className="h-6 w-6 text-neon-yellow mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Personalized</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-white/5 text-center hover:border-neon-purple/30 transition-colors">
            <Sparkles className="h-6 w-6 text-neon-purple mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Smart Plans</p>
          </div>
        </div>
      </div>
    </div>
  );
}