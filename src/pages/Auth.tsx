import React, { useState } from 'react';
import { Brain, Mail, Lock, User, GraduationCap, Sparkles, Star } from 'lucide-react';
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

  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(formData.email, formData.password, {
          full_name: formData.full_name,
          grade: formData.grade,
          school: formData.school
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
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4 relative overflow-hidden">
      {/* Floating elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse animation-delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl shadow-2xl glow-blue">
                <Brain className="h-10 w-10 text-white" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-yellow-400 animate-bounce" />
              <Star className="absolute -bottom-1 -left-1 h-4 w-4 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-4xl font-bold gradient-text">
                AI Study Planner
              </h1>
              <p className="text-blue-300 text-sm">Powered by Advanced AI</p>
            </div>
          </div>
          <p className="text-gray-300 text-lg">
            {isSignUp ? 'Join thousands of successful students' : 'Welcome back, future achiever!'}
          </p>
        </div>

        {/* Form */}
        <div className="glass rounded-2xl border border-gray-700/50 p-8 card-hover">
          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <>
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
                    <User className="h-4 w-4" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full px-4 py-4 rounded-xl bg-gray-800/50 border border-gray-600 focus:border-blue-500 focus:outline-none transition-all duration-300 text-white placeholder-gray-400"
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
                      <GraduationCap className="h-4 w-4" />
                      Grade/Class
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.grade}
                      onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
                      className="w-full px-4 py-4 rounded-xl bg-gray-800/50 border border-gray-600 focus:border-blue-500 focus:outline-none transition-all duration-300 text-white placeholder-gray-400"
                      placeholder="e.g., 12"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-300 mb-3 block">
                      School
                    </label>
                    <input
                      type="text"
                      value={formData.school}
                      onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))}
                      className="w-full px-4 py-4 rounded-xl bg-gray-800/50 border border-gray-600 focus:border-blue-500 focus:outline-none transition-all duration-300 text-white placeholder-gray-400"
                      placeholder="School name"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
                <Mail className="h-4 w-4" />
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-4 rounded-xl bg-gray-800/50 border border-gray-600 focus:border-blue-500 focus:outline-none transition-all duration-300 text-white placeholder-gray-400"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
                <Lock className="h-4 w-4" />
                Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-4 rounded-xl bg-gray-800/50 border border-gray-600 focus:border-blue-500 focus:outline-none transition-all duration-300 text-white placeholder-gray-400"
                placeholder="Enter your password"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-2xl glow-blue btn-pulse"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Please wait...
                </div>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-200"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="glass rounded-xl p-4 border border-gray-700/50">
            <Brain className="h-6 w-6 text-blue-400 mx-auto mb-2" />
            <p className="text-xs text-gray-300">AI Powered</p>
          </div>
          <div className="glass rounded-xl p-4 border border-gray-700/50">
            <Star className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-xs text-gray-300">Personalized</p>
          </div>
          <div className="glass rounded-xl p-4 border border-gray-700/50">
            <Sparkles className="h-6 w-6 text-purple-400 mx-auto mb-2" />
            <p className="text-xs text-gray-300">Smart Plans</p>
          </div>
        </div>
      </div>
    </div>
  );
}