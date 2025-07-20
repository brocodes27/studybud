import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link, Navigate } from 'react-router-dom';

const MyClasses: React.FC = () => {
  const { user, role, loading } = useAuth() as any;
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  // Join class state
  const [classCode, setClassCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }
  if (role === 'teacher') {
    return <Navigate to="/teacher" replace />;
  }

  useEffect(() => {
    const fetchClasses = async () => {
      setLoadingClasses(true);
      if (!user) return;
      if (role === 'teacher') {
        setLoadingClasses(false);
        return;
      }
      if (role === 'student') {
        // Fetch classes user has joined
        const { data: memberData, error: memberError } = await supabase
          .from('class_members')
          .select('class_id');
        if (!memberError && memberData.length > 0) {
          const classIds = memberData.map((m: any) => m.class_id);
          const { data: classData, error: classError } = await supabase
            .from('classes')
            .select('id, name, teacher_id')
            .in('id', classIds);
          if (!classError) setClasses(classData);
        }
      }
      setLoadingClasses(false);
    };
    fetchClasses();
  }, [user, role, success]);

  // Join class handler (for students)
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setSuccess(null);
    setError(null);
    if (!classCode.trim()) {
      setError('Class code is required.');
      setJoining(false);
      return;
    }
    // Check if class exists
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, name')
      .eq('id', classCode.trim())
      .single();
    if (classError || !classData) {
      setError('Class not found. Please check the code.');
      setJoining(false);
      return;
    }
    // Check if already a member
    const { data: memberData } = await supabase
      .from('class_members')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('class_id', classCode.trim());
    if (memberData && memberData.length > 0) {
      setError('You are already a member of this class.');
      setJoining(false);
      return;
    }
    // Join class
    const { error: joinError } = await supabase
      .from('class_members')
      .insert([{ class_id: classCode.trim(), user_id: user.id }]);
    if (joinError) {
      setError(joinError.message);
    } else {
      setSuccess(`Successfully joined class: ${classData.name}`);
      setClassCode('');
    }
    setJoining(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-400 mb-8">My Classes</h1>
        {role === 'student' && (
          <form onSubmit={handleJoin} className="mb-8 bg-gray-800 rounded-xl shadow p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-blue-300 mb-4">Join a Class</h2>
            <input
              className="w-full p-2 border rounded mb-4 bg-gray-900 text-gray-100 border-gray-700"
              placeholder="Enter Class Code"
              value={classCode}
              onChange={e => setClassCode(e.target.value)}
              disabled={joining}
            />
            {error && <div className="text-red-400 mb-2">{error}</div>}
            {success && <div className="text-green-400 mb-2">{success}</div>}
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition w-full"
              disabled={joining}
            >
              {joining ? 'Joining...' : 'Join Class'}
            </button>
          </form>
        )}
        {classes.length === 0 ? (
          <div className="text-gray-400 text-center py-16">No classes found.</div>
        ) : (
          <div className="grid gap-6">
            {classes.map(cls => (
              <Link
                to={`/class/${cls.id}`}
                key={cls.id}
                className="block bg-gray-800 rounded-xl shadow p-6 border border-gray-700 hover:border-blue-500 transition text-gray-100"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl font-semibold text-blue-300">{cls.name}</span>
                </div>
                <div className="mt-2 text-sm text-gray-400">Class Code: <span className="font-mono text-blue-400 select-all">{cls.id}</span></div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyClasses; 