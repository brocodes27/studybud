import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, BookOpen, X, Loader2 } from 'lucide-react';

const TeacherPanel: React.FC = () => {
  const { user, role, loading } = useAuth() as any;
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClasses = async () => {
      setLoadingClasses(true);
      if (!user) return;
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, teacher_id, subject')
        .eq('teacher_id', user.id);

      if (error) {
        setLoadingClasses(false);
        return;
      }

      // Fetch member count for each class
      const classesWithCounts = await Promise.all(
        data.map(async (cls) => {
          const { count, error: countError } = await supabase
            .from('class_members')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id);

          return {
            ...cls,
            student_count: countError ? 0 : count,
          };
        })
      );

      setClasses(classesWithCounts);
      setLoadingClasses(false);
    };
    if (role === 'teacher') fetchClasses();
  }, [user, role, showCreateModal]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    if (!newClassName.trim()) {
      setCreateError('Class name is required.');
      setCreating(false);
      return;
    }
    if (!newClassSubject.trim()) {
      setCreateError('Subject is required.');
      setCreating(false);
      return;
    }
    const { data, error } = await supabase
      .from('classes')
      .insert([{ name: newClassName.trim(), teacher_id: user.id, subject: newClassSubject.trim() }])
      .select();
    if (error) {
      setCreateError(error.message);
    } else if (data && data.length > 0) {
      setShowCreateModal(false);
      setNewClassName('');
      setNewClassSubject('');
      setClasses((prev: any[]) => [...prev, { ...data[0], student_count: 0 }]);
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl border border-red-500/20 text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-400">You must be a teacher to access this panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative p-4 md:p-8 animate-fade-in">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl -z-10"></div>

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Teacher Panel</h1>
            <p className="text-gray-400">Manage your classes and students</p>
          </div>
          <button
            className="bg-gradient-to-r from-neon-blue to-blue-600 text-white px-6 py-3 rounded-xl hover:from-neon-blue/80 hover:to-blue-600/80 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-neon-blue/20"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-5 w-5" />
            Create Class
          </button>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="glass-panel rounded-2xl p-8 w-full max-w-md border border-white/10 relative">
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
              <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-neon-blue" />
                Create New Class
              </h2>
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Class Name</label>
                  <input
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none placeholder-gray-600"
                    placeholder="e.g., Class 10 - Section A"
                    value={newClassName}
                    onChange={e => setNewClassName(e.target.value)}
                    disabled={creating}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Subject</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none appearance-none"
                    value={newClassSubject}
                    onChange={e => setNewClassSubject(e.target.value)}
                    disabled={creating}
                    required
                  >
                    <option value="" className="bg-gray-900">Select Subject</option>
                    {/* Class 10 Subjects */}
                    <option value="Mathematics" className="bg-gray-900">Mathematics</option>
                    <option value="Science" className="bg-gray-900">Science</option>
                    <option value="English" className="bg-gray-900">English</option>
                    <option value="Social Science" className="bg-gray-900">Social Science</option>
                    <option value="Hindi" className="bg-gray-900">Hindi</option>
                    <option value="Sanskrit" className="bg-gray-900">Sanskrit</option>
                    <option value="Information Technology" className="bg-gray-900">Information Technology</option>
                    <option value="Home Science" className="bg-gray-900">Home Science</option>
                    <option value="Computer Applications" className="bg-gray-900">Computer Applications</option>
                    {/* Science Stream */}
                    <option value="Physics" className="bg-gray-900">Physics</option>
                    <option value="Chemistry" className="bg-gray-900">Chemistry</option>
                    <option value="Biology" className="bg-gray-900">Biology</option>
                    <option value="Mathematics (Science)" className="bg-gray-900">Mathematics (Science)</option>
                    <option value="English (Science)" className="bg-gray-900">English (Science)</option>
                    <option value="Computer Science" className="bg-gray-900">Computer Science</option>
                    <option value="Physical Education (Science)" className="bg-gray-900">Physical Education (Science)</option>
                    <option value="Informatics Practices (Science)" className="bg-gray-900">Informatics Practices (Science)</option>
                    {/* Commerce Stream */}
                    <option value="Accountancy" className="bg-gray-900">Accountancy</option>
                    <option value="Business Studies" className="bg-gray-900">Business Studies</option>
                    <option value="Economics (Commerce)" className="bg-gray-900">Economics (Commerce)</option>
                    <option value="Mathematics (Commerce)" className="bg-gray-900">Mathematics (Commerce)</option>
                    <option value="English (Commerce)" className="bg-gray-900">English (Commerce)</option>
                    <option value="Informatics Practices (Commerce)" className="bg-gray-900">Informatics Practices (Commerce)</option>
                    <option value="Physical Education (Commerce)" className="bg-gray-900">Physical Education (Commerce)</option>
                    {/* Humanities Stream */}
                    <option value="History" className="bg-gray-900">History</option>
                    <option value="Geography" className="bg-gray-900">Geography</option>
                    <option value="Political Science" className="bg-gray-900">Political Science</option>
                    <option value="Economics (Humanities)" className="bg-gray-900">Economics (Humanities)</option>
                    <option value="Psychology" className="bg-gray-900">Psychology</option>
                    <option value="Sociology" className="bg-gray-900">Sociology</option>
                    <option value="English (Humanities)" className="bg-gray-900">English (Humanities)</option>
                    <option value="Mathematics (Humanities)" className="bg-gray-900">Mathematics (Humanities)</option>
                    <option value="Physical Education (Humanities)" className="bg-gray-900">Physical Education (Humanities)</option>
                  </select>
                </div>
                {createError && <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{createError}</div>}
                <button
                  type="submit"
                  className="w-full bg-neon-blue hover:bg-neon-blue/80 text-white py-3 rounded-xl transition-colors font-semibold flex items-center justify-center gap-2"
                  disabled={creating}
                >
                  {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Class'}
                </button>
              </form>
            </div>
          </div>
        )}

        {loadingClasses ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue"></div>
          </div>
        ) : classes.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center border border-white/10">
            <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No classes yet</h3>
            <p className="text-gray-400 mb-6">Create your first class to start managing students.</p>
            <button
              className="bg-neon-blue hover:bg-neon-blue/80 text-white px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-5 w-5" />
              Create Class
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map(cls => (
              <div
                key={cls.id}
                className="glass-card rounded-2xl p-6 border border-white/10 hover:border-neon-blue/30 transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(`/teacher/class/${cls.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-neon-blue transition-colors">{cls.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">{cls.subject}</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <BookOpen className="h-5 w-5 text-neon-blue" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{cls.student_count} Students</span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono bg-black/40 px-2 py-1 rounded border border-white/5">
                    ID: {cls.id.slice(0, 8)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherPanel;