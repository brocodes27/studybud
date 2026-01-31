import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/Input';
import { User, ArrowRight } from 'lucide-react';
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
  const [selectedRole] = useState<'student' | 'teacher'>('student');

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const { error } = await signInWithGoogle();
      if (error) {
        showToast(error.message || 'Google sign-in failed', 'error');
      }
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
    <section id="auth" className="py-32 px-6 bg-neo-bg relative border-t-8 border-black">
      {/* Decorative dots */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '24px 24px' }} />

      <div className="max-w-xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <motion.span
            initial={{ rotate: -1 }}
            whileInView={{ rotate: 1 }}
            className="sticker bg-neo-muted border-4 border-black mb-4 px-6 text-sm py-2"
          >
            SECURE ACCESS
          </motion.span>
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-black mt-6 leading-none">
            {isSignUp ? 'JOIN THE' : 'WELCOME'}<br />
            <span className="text-neo-accent" style={{ WebkitTextStroke: '2px black' }}>REVOLUTION</span>
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="neo-card bg-white p-10 md:p-12"
        >
          <div className="text-center mb-10">
            <h3 className="text-3xl font-black uppercase tracking-tight text-black mb-2">
              {isSignUp ? 'New Account' : 'Returning User'}
            </h3>
            <p className="text-black/50 font-bold uppercase text-sm">
              {isSignUp ? 'Start your AI learning journey' : 'Resume your study sessions'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <>
                <Input
                  label="FULL NAME"
                  placeholder="e.g., Alex Rivers"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: (e.target as HTMLInputElement).value })}
                  required
                  className="neo-input"
                />

                <div className="flex items-center gap-3 p-4 bg-neo-accent border-4 border-black mb-6">
                  <User className="h-6 w-6 text-black stroke-[3px]" />
                  <span className="text-sm font-black uppercase tracking-widest text-black">Student Account Security</span>
                </div>

                {selectedRole === 'student' && (
                  <Input
                    label="GRADE / CLASS"
                    placeholder="e.g., Class 12"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: (e.target as HTMLInputElement).value })}
                    required
                    className="neo-input"
                  />
                )}

                <Input
                  label="INSTITUTION"
                  placeholder="Enter school name"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: (e.target as HTMLInputElement).value })}
                  required
                  className="neo-input"
                />
              </>
            )}

            <Input
              label="EMAIL ADDRESS"
              type="email"
              placeholder="alex@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: (e.target as HTMLInputElement).value })}
              required
              className="neo-input"
            />
            <Input
              label="PASSWORD"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: (e.target as HTMLInputElement).value })}
              required
              className="neo-input"
            />

            <button
              type="submit"
              disabled={formLoading}
              className="neo-button w-full bg-black text-white text-xl py-5"
            >
              {formLoading ? 'PROCESSING...' : (isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN')}
              <ArrowRight className="h-6 w-6 stroke-[3px]" />
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-black font-black uppercase tracking-widest text-sm hover:underline underline-offset-8 decoration-4 decoration-neo-accent transition-all"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="flex items-center my-10">
            <div className="flex-1 h-1 bg-black" />
            <span className="mx-4 font-black uppercase text-black italic text-xl">OR</span>
            <div className="flex-1 h-1 bg-black" />
          </div>

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
            className="neo-button w-full bg-white text-black text-lg py-4"
          >
            <span className="mr-3 inline-flex bg-white border-2 border-black rounded-none p-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 9.656 8.337 6.306 14.691z" /><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" /><path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.977 13.409-5.197l-6.19-5.236C29.133 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.553 5.047C9.482 39.556 16.227 44 24 44z" /><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-3.994 5.566l.003-.002 6.19 5.236C35.246 40.416 40 34.667 40 26c0-1.341-.138-2.65-.389-3.917z" /></svg>
            </span>
            {googleLoading ? 'WAITING...' : 'CONTINUE WITH GOOGLE'}
          </button>
        </motion.div>
      </div>
    </section>
  );
}

export default LandingAuth;

