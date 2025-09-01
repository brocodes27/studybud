import React, { useState } from 'react';
import heroIllustration from '../../anime-style-character-with-water.jpg';
import { Brain, Star, BarChart3, Shield, Sparkles, Target, BookOpen, MessageCircle, User, Rocket } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Navigate } from 'react-router-dom';

// Light marketing landing (no heavy animations)

const Landing: React.FC = () => {
  const { role, loading, signUp, signIn, signInWithGoogle } = useAuth() as any;
  const { showToast } = useToast();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner w-12 h-12"></div>
      </div>
    );
  }

  if (role === 'teacher') {
    return <Navigate to="/teacher" replace />;
  }
  
  const [isSignUp, setIsSignUp] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    grade: '',
    school: ''
  });
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher'>('student');

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const { error } = await signInWithGoogle();
      if (error) {
        showToast(error.message || 'Google sign-in failed', 'error');
      }
      // On success, Supabase will redirect; no further action needed here.
    } catch (e: any) {
      showToast(e.message || 'Google sign-in failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(formData.email, formData.password, {
          full_name: formData.full_name,
          grade: selectedRole === 'student' ? formData.grade : undefined,
          school: formData.school,
          role: selectedRole
        });
        
        if (error) {
          showToast(error.message, 'error');
        } else {
          showToast('Account created successfully! Welcome to ElevenFolks!', 'success');
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);
        
        if (error) {
          showToast(error.message, 'error');
        } else {
          showToast('Welcome back!', 'success');
        }
      }
    } catch (error: any) {
      showToast(error.message || 'An error occurred', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  

  const testimonials = [
    {
      name: 'Priya Sharma',
      grade: 'Class 12',
      text: 'ElevenFolks helped me improve my JEE preparation by 40%. The personalized study plans are incredible!',
      rating: 5,
      avatar: 'PS'
    },
    {
      name: 'Arjun Patel',
      grade: 'Class 10',
      text: 'The AI flashcards and practice tests made studying so much more effective. Highly recommend!',
      rating: 5,
      avatar: 'AP'
    },
    {
      name: 'Sneha Reddy',
      grade: 'Class 11',
      text: 'Study groups feature helped me connect with other students. We motivate each other every day!',
      rating: 5,
      avatar: 'SR'
    }
  ];

  

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">ElevenFolks</span>
            </div>
            <div className="hidden md:flex items-center space-x-8 text-sm">
              <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="#benefits" className="text-gray-600 hover:text-gray-900">Benefits</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900">Testimonials</a>
              <Button variant="outline" size="sm" onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}>Sign in</Button>
              <Button variant="primary" size="sm" onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}>Get started</Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Card */}
      <section className="px-6 pt-10 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl bg-card border border-border p-8 md:p-12 relative overflow-hidden">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">The all-in-one study workspace</h1>
                <p className="text-lg text-gray-600 mb-6">Centralize your plans, progress, and practice. Learn smarter with AI Study Buddy, personalized plans, and exam simulators.</p>
                <div className="flex items-center gap-3">
                  <Button variant="primary" size="lg" icon={<Rocket className="w-5 h-5" />} onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}>Get started for free</Button>
                  <Button variant="outline" size="lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Explore features</Button>
                </div>
              </div>
              <div className="aspect-video md:aspect-auto">
                <div className="w-full h-64 md:h-80 rounded-xl bg-gradient-to-br from-emerald-100 to-amber-100 border border-border flex items-center justify-center overflow-hidden">
                  <img
                    src={heroIllustration}
                    alt="Student studying on laptop illustration"
                    className="w-full h-full object-contain p-4 opacity-95"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      

      {/* Benefits row */}
      <section id="benefits" className="px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">One space for your study and your work</h2>
            <p className="text-gray-600 mt-3">Keep everything in one place, from your plan to practice tests. With ElevenFolks, organize, collaborate, and learn faster.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border p-6 bg-card">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3"><BookOpen className="w-5 h-5"/></div>
              <h3 className="font-semibold text-gray-900 mb-2">Connect your plan</h3>
              <p className="text-gray-600 text-sm">Create AI-powered study plans aligned to your goals and exam dates.</p>
            </div>
            <div className="rounded-xl border border-border p-6 bg-card">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3"><BarChart3 className="w-5 h-5"/></div>
              <h3 className="font-semibold text-gray-900 mb-2">Stay organized</h3>
              <p className="text-gray-600 text-sm">Track progress, analyse performance, and keep notes that the AI remembers.</p>
            </div>
            <div className="rounded-xl border border-border p-6 bg-card">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-3"><MessageCircle className="w-5 h-5"/></div>
              <h3 className="font-semibold text-gray-900 mb-2">Collaborate effectively</h3>
              <p className="text-gray-600 text-sm">Use AI Study Buddy for instant help and explanations across topics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features designed for productivity */}
      <section id="features" className="px-6 py-12 bg-background border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">Features designed for productivity</h2>
            <p className="text-gray-600 mt-3">From study planning to exam practice, we’ve got you covered.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border p-6 bg-card">
              <div className="mb-3 w-full h-28 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <Brain className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">AI Study Buddy</h3>
              <p className="text-gray-600 text-sm">Context-aware answers with your personal notes and chat memory.</p>
            </div>
            <div className="rounded-xl border border-border p-6 bg-card">
              <div className="mb-3 w-full h-28 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Target className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Personalized Plans</h3>
              <p className="text-gray-600 text-sm">Generate day-wise schedules tailored to your syllabus and timeline.</p>
            </div>
            <div className="rounded-xl border border-border p-6 bg-card">
              <div className="mb-3 w-full h-28 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Exam Simulators</h3>
              <p className="text-gray-600 text-sm">Practice with CBSE and CUET simulators with robust section resume.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Ready to transform your productivity?</h2>
          <p className="text-gray-600 mb-6">Join thousands of students already using ElevenFolks to achieve more.</p>
          <Button variant="primary" size="xl" icon={<Rocket className="w-5 h-5" />} onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}>Get started</Button>
        </div>
      </section>

      {/* Auth Form */}
      <section id="auth" className="py-16 px-6 bg-background border-t border-border">
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-1">{isSignUp ? 'Join ElevenFolks Today' : 'Welcome Back'}</h2>
              <p className="text-gray-600 text-sm">{isSignUp ? 'Start your learning journey with AI-powered study tools' : 'Continue your learning journey'}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <>
                  <Input label="Full Name" placeholder="Enter your full name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />

                  <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">I am a:</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setSelectedRole('student')} className={`p-4 rounded-xl border transition ${selectedRole === 'student' ? 'border-gray-900 bg-gray-900/5 text-gray-900' : 'border-border text-gray-600 hover:border-border'}`}>
                      <User className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm font-medium">Student</span>
                    </button>
                    <button type="button" onClick={() => setSelectedRole('teacher')} className={`p-4 rounded-xl border transition ${selectedRole === 'teacher' ? 'border-gray-900 bg-gray-900/5 text-gray-900' : 'border-border text-gray-600 hover:border-border'}`}>
                      <Shield className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm font-medium">Teacher</span>
                    </button>
                  </div>
                </div>

                  {selectedRole === 'student' && (
                    <Input label="Grade/Class" placeholder="e.g., Class 12, Grade 10" value={formData.grade} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} required />
                  )}

                  <Input label="School/Institution" placeholder="Enter your school name" value={formData.school} onChange={(e) => setFormData({ ...formData, school: e.target.value })} required />
                </>
              )}

              <Input label="Email" type="email" placeholder="Enter your email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
              <Input label="Password" type="password" placeholder="Enter your password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />

              <Button type="submit" variant="primary" size="lg" loading={formLoading} className="w-full">{isSignUp ? 'Create Account' : 'Sign In'}</Button>
            </form>

            <div className="mt-5 text-center">
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-gray-700 hover:text-gray-900 transition-colors">
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>

            <div className="flex items-center my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="mx-3 text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button type="button" variant="outline" size="lg" loading={googleLoading} onClick={handleGoogleSignIn} className="w-full" icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.977 13.409-5.197l-6.19-5.236C29.133 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.553 5.047C9.482 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-3.994 5.566l.003-.002 6.19 5.236C35.246 40.416 40 34.667 40 26c0-1.341-.138-2.65-.389-3.917z"/></svg>}>
              Continue with Google
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-3">Loved by students worldwide</h2>
            <p className="text-gray-600">Join thousands of learners who’ve transformed their study experience.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="testimonial-card rounded-xl border border-border p-6 bg-card shadow-sm">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center mr-3">
                    <span className="text-sm font-semibold">{testimonial.avatar}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{testimonial.name}</h4>
                    <p className="text-gray-500 text-xs">{testimonial.grade}</p>
                  </div>
                  <div className="ml-auto flex items-center">{[...Array(testimonial.rating)].map((_, i) => (<Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />))}</div>
                </div>
                <p className="text-gray-700 leading-relaxed italic">"{testimonial.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">ElevenFolks</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <a href="#features">Features</a>
              <a href="#benefits">Benefits</a>
              <a href="#testimonials">Testimonials</a>
              <a href="#auth">Contact</a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border text-center text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} ElevenFolks. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;