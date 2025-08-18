import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Onboarding() {
  const { user } = useAuth() as any;
  const [role, setRole] = useState<'student' | 'teacher' | null>(null);
  const [fullName, setFullName] = useState<string>(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
  const [loading, setLoading] = useState(false);

  const saveProfile = async () => {
    if (!user || !role) return;
    try {
      setLoading(true);
      const payload: any = {
        id: user.id,
        role,
        full_name: fullName || null,
        is_admin: false,
      };
      const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      // Reload app so AuthContext re-fetches profile and role
      window.location.replace('/');
    } catch (e: any) {
      alert(e.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-900/70 backdrop-blur rounded-2xl p-6 shadow-2xl border border-white/10">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 text-center">Welcome!</h1>
        <p className="text-gray-300 text-center mb-6">Tell us how you'll use ElevenFolks</p>

        <label className="block text-sm text-gray-300 mb-2">Your full name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter your name"
        />

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`p-4 rounded-xl border transition ${role === 'student' ? 'border-primary-500 bg-primary-500/10 text-white' : 'border-gray-700 bg-gray-800 text-gray-200'}`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setRole('teacher')}
            className={`p-4 rounded-xl border transition ${role === 'teacher' ? 'border-primary-500 bg-primary-500/10 text-white' : 'border-gray-700 bg-gray-800 text-gray-200'}`}
          >
            Teacher
          </button>
        </div>

        <button
          type="button"
          onClick={saveProfile}
          disabled={!role || loading}
          className="w-full btn-primary py-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
