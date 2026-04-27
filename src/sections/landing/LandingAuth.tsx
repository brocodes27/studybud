import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { useAnalytics } from '../../hooks/useAnalytics';
import { Input } from '../../components/Input';
import { ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { trackDubEvent } from '../../lib/dub';

export function LandingAuth() {
  const { signUp, signIn, signInWithGoogle } = useAuth() as any;
  const { showToast } = useToast();
  const { track } = useAnalytics();

  const [isSignUp, setIsSignUp] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    grade: '',
    school: '',
    subject: ''
  });

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const { error } = await signInWithGoogle();
      if (error) showToast(error.message || 'Google sign-in failed', 'error');
      else trackDubEvent('signup', { metadata: { method: 'google' } });
    } catch (e: any) {
      showToast(e.message || 'Google sign-in failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    track('signup_start', { method: isSignUp ? 'email' : 'signin' });
    setFormLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(formData.email, formData.password, {
          full_name: formData.full_name,
          grade: formData.grade,
          school: formData.school,
          subject: formData.subject,
          role: role
        });
        if (error) showToast(error.message, 'error');
        else {
          showToast('Account created! Welcome!', 'success');
          trackDubEvent('signup', { customerId: formData.email, customerEmail: formData.email, customerName: formData.full_name, metadata: { method: 'email' } });
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) showToast(error.message, 'error');
        else showToast('Welcome back!', 'success');
      }
    } catch (error: any) {
      showToast(error.message || 'An error occurred', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <section id="auth" className="py-20 md:py-28 px-6">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-8">
          <motion.h2
            initial={{ y: 14, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-2xl md:text-3xl font-semibold tracking-tight text-[#2D2A26]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {isSignUp ? 'Start your journey' : 'Welcome back'}
          </motion.h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-[#2D2A26]/[0.05] shadow-[0_4px_20px_rgba(45,42,38,0.04)] p-6"
        >
          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-5 rounded-xl border border-[#2D2A26]/[0.07] bg-white text-[#2D2A26] font-semibold text-[12px] hover:border-[#2D2A26]/12 transition-all active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.977 13.409-5.197l-6.19-5.236C29.133 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.553 5.047C9.482 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-3.994 5.566l.003-.002 6.19 5.236C35.246 40.416 40 34.667 40 26c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>

          <div className="flex items-center my-5">
            <div className="flex-1 h-px bg-[#2D2A26]/[0.05]" />
            <span className="mx-3 text-[10px] font-semibold text-[#8A8279] uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-[#2D2A26]/[0.05]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <>
                {/* Role Toggle */}
                <div className="bg-[#F8FAFF] p-1 rounded-[14px] flex">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`flex-1 py-2 rounded-[12px] text-xs font-bold transition-all ${role === 'student' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`flex-1 py-2 rounded-[12px] text-xs font-bold transition-all ${role === 'teacher' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
                  >
                    Teacher
                  </button>
                </div>

                <Input label="Full Name" placeholder={role === 'teacher' ? 'Dr. Priya Sharma' : 'Alex Rivers'} value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: (e.target as HTMLInputElement).value })} required className="neo-input" />
                {role === 'student' && (
                  <>
                    <Input label="Grade / Class" placeholder="Class 12" value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: (e.target as HTMLInputElement).value })} required className="neo-input" />
                    <Input label="School / Institute" placeholder="Delhi Public School" value={formData.school}
                      onChange={(e) => setFormData({ ...formData, school: (e.target as HTMLInputElement).value })} required className="neo-input" />
                  </>
                )}
                {role === 'teacher' && (
                  <>
                    <Input label="Subject (optional)" placeholder="Physics, Mathematics..." value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: (e.target as HTMLInputElement).value })} className="neo-input" />
                    <Input label="School / Institute (optional)" placeholder="Delhi Public School" value={formData.school}
                      onChange={(e) => setFormData({ ...formData, school: (e.target as HTMLInputElement).value })} className="neo-input" />
                  </>
                )}
              </>
            )}
            <Input label="Email" type="email" placeholder="alex@example.com" value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: (e.target as HTMLInputElement).value })} required className="neo-input" />
            <Input label="Password" type="password" placeholder="••••••••" value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: (e.target as HTMLInputElement).value })} required className="neo-input" />

            <button type="submit" disabled={formLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-bold text-white bg-[#2D2A26] hover:bg-[#3E3A35] transition-colors active:scale-[0.98] mt-1">
              {formLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                : <>{isSignUp ? (role === 'teacher' ? 'Create Teacher Account' : 'Create Account') : 'Sign In'} <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button type="button" onClick={() => setIsSignUp(!isSignUp)}
              className="text-[#8A8279] font-medium text-[12px] hover:text-[#2D2A26] transition-colors">
              {isSignUp ? <>Already have an account? <span className="text-[#8B7355] font-bold">Sign in</span></>
                : <>No account? <span className="text-[#8B7355] font-bold">Sign up</span></>}
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default LandingAuth;
