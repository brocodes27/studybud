import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/Input';
import { User, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingAuth() {
  const { signUp, signIn, signInWithGoogle } = useAuth() as any;
  const { showToast } = useToast();

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

  const handleSubmit = async (e: FormEvent) => {
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

  return (
    <section id="auth" className="py-24 px-6 overflow-x-clip">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <span className="inline-block py-1 px-3 rounded-lg bg-neon-blue/10 border border-neon-blue/20 text-neon-blue font-medium text-sm">Get started</span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">{isSignUp ? 'Join ElevenFolks Today' : 'Welcome Back'}</h2>
            <p className="text-white/50 text-sm">{isSignUp ? 'Start your learning journey with AI-powered study tools' : 'Continue your learning journey'}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <>
                <Input label="Full Name" placeholder="Enter your full name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: (e.target as HTMLInputElement).value })} required className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-neon-blue" />

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-white/70">I am a:</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setSelectedRole('student')} className={`p-4 rounded-xl border transition flex flex-col items-center justify-center ${selectedRole === 'student' ? 'border-neon-blue bg-neon-blue/10 text-neon-blue' : 'border-white/10 text-white/60 hover:bg-white/5 hover:border-white/20'}`}>
                      <User className="w-5 h-5 mb-2" />
                      <span className="text-sm font-medium">Student</span>
                    </button>
                    <button type="button" onClick={() => setSelectedRole('teacher')} className={`p-4 rounded-xl border transition flex flex-col items-center justify-center ${selectedRole === 'teacher' ? 'border-neon-blue bg-neon-blue/10 text-neon-blue' : 'border-white/10 text-white/60 hover:bg-white/5 hover:border-white/20'}`}>
                      <Shield className="w-5 h-5 mb-2" />
                      <span className="text-sm font-medium">Teacher</span>
                    </button>
                  </div>
                </div>

                {selectedRole === 'student' && (
                  <Input label="Grade/Class" placeholder="e.g., Class 12, Grade 10" value={formData.grade} onChange={(e) => setFormData({ ...formData, grade: (e.target as HTMLInputElement).value })} required className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-neon-blue" />
                )}

                <Input label="School/Institution" placeholder="Enter your school name" value={formData.school} onChange={(e) => setFormData({ ...formData, school: (e.target as HTMLInputElement).value })} required className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-neon-blue" />
              </>
            )}

            <Input label="Email" type="email" placeholder="Enter your email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: (e.target as HTMLInputElement).value })} required className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-neon-blue" />
            <Input label="Password" type="password" placeholder="Enter your password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: (e.target as HTMLInputElement).value })} required className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-neon-blue" />

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formLoading ? 'Please wait…' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-white/60 hover:text-white text-sm transition-colors">
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="mx-3 text-white/40 text-sm">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
            className="w-full border border-white/10 bg-white/5 text-white hover:bg-white/10 py-3 rounded-xl transition-colors flex items-center justify-center font-medium"
          >
            <span className="mr-3 inline-flex bg-white rounded-full p-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 9.656 8.337 6.306 14.691z" /><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" /><path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.977 13.409-5.197l-6.19-5.236C29.133 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.553 5.047C9.482 39.556 16.227 44 24 44z" /><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-3.994 5.566l.003-.002 6.19 5.236C35.246 40.416 40 34.667 40 26c0-1.341-.138-2.65-.389-3.917z" /></svg>
            </span>
            {googleLoading ? 'Signing in…' : 'Continue with Google'}
          </button>
        </motion.div>
      </div>
    </section>
  );
}

export default LandingAuth;
