import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/Input';
import { User, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { trackDubEvent } from '../../lib/dub';

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
      } else {
        trackDubEvent('signup', { metadata: { method: 'google' } });
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
          trackDubEvent('signup', {
            customerId: formData.email,
            customerEmail: formData.email,
            customerName: formData.full_name,
            metadata: { method: 'email' }
          });
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
    <section id="auth" className="py-32 px-6 bg-white relative overflow-hidden">
      {/* Soft background orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#00D1FF]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#F472B6]/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-lg mx-auto relative z-10">
        <div className="text-center mb-12">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F472B6]/10 text-[#F472B6] rounded-full font-bold text-sm mb-6 border border-[#F472B6]/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Secure Access</span>
          </motion.div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#0A192F] leading-tight">
            {isSignUp ? 'Join the' : 'Welcome'} <br />
            <span className="text-[#00D1FF]">revolution.</span>
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="neo-card p-8 md:p-10"
        >
          <div className="text-center mb-8">
            <h3 className="text-2xl font-extrabold text-[#0A192F] mb-1 tracking-tight">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </h3>
            <p className="text-[#64748B] font-medium text-sm">
              {isSignUp ? 'Start your AI learning journey today' : 'Resume your study sessions'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <>
                <Input
                  label="Full Name"
                  placeholder="e.g., Alex Rivers"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: (e.target as HTMLInputElement).value })}
                  required
                  className="neo-input"
                />

                <div className="flex items-center gap-3 p-3.5 bg-[#00D1FF]/10 rounded-[16px] border border-[#00D1FF]/20">
                  <User className="h-5 w-5 text-[#00D1FF] stroke-[2.5px] shrink-0" />
                  <span className="text-sm font-bold text-[#0A192F]">Student Account</span>
                </div>

                {selectedRole === 'student' && (
                  <Input
                    label="Grade / Class"
                    placeholder="e.g., Class 12"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: (e.target as HTMLInputElement).value })}
                    required
                    className="neo-input"
                  />
                )}

                <Input
                  label="Institution"
                  placeholder="Enter school name"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: (e.target as HTMLInputElement).value })}
                  required
                  className="neo-input"
                />
              </>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="alex@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: (e.target as HTMLInputElement).value })}
              required
              className="neo-input"
            />
            <Input
              label="Password"
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
              className="neo-button w-full py-4 text-base"
            >
              {formLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
              <ArrowRight className="h-5 w-5 stroke-[2.5px]" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[#64748B] font-bold text-sm hover:text-[#00D1FF] transition-colors underline underline-offset-4 decoration-[#00D1FF]/40"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="flex items-center my-8">
            <div className="flex-1 h-px bg-[#0A192F]/10" />
            <span className="mx-4 font-bold text-[#64748B] text-sm">OR</span>
            <div className="flex-1 h-px bg-[#0A192F]/10" />
          </div>

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-full border-2 border-[#0A192F]/10 bg-white text-[#0A192F] font-bold text-sm hover:border-[#00D1FF]/40 hover:bg-[#00D1FF]/5 transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.977 13.409-5.197l-6.19-5.236C29.133 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.553 5.047C9.482 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-3.994 5.566l.003-.002 6.19 5.236C35.246 40.416 40 34.667 40 26c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            {googleLoading ? 'Waiting...' : 'Continue with Google'}
          </button>
        </motion.div>
      </div>
    </section>
  );
}

export default LandingAuth;
