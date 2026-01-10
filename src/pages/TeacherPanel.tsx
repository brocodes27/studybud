import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, BookOpen, X, Loader2, GraduationCap, Settings, Lock } from 'lucide-react';

const TeacherPanel: React.FC = () => {
  const { user, role, loading } = useAuth() as any;
  const isTeacher = role === 'teacher';
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
    <div className="min-h-screen bg-neo-bg animate-fade-in pb-20">
      {/* Header */}
      <div className="bg-white border-b-8 border-black sticky top-0 z-10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-neo-accent p-3 border-4 border-black shadow-[4px_4px_0px_0px_#000] -rotate-2">
                <GraduationCap className="h-8 w-8 text-white stroke-[3px]" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-black uppercase tracking-tighter italic leading-none">TEACHER_HUB</h1>
                <p className="text-xs font-black uppercase tracking-widest text-black/60 mt-1">CLASSROOM_MANAGEMENT_SYSTEM_V1</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-neo-secondary text-black px-6 py-3 font-black uppercase tracking-widest border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="h-5 w-5 stroke-[3px]" /> CREATE_CLASS
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!isTeacher ? (
          <div className="text-center py-20 bg-white border-4 border-black border-dashed">
            <div className="w-24 h-24 bg-neo-muted border-4 border-black mx-auto mb-8 flex items-center justify-center rotate-3 shadow-[8px_8px_0px_0px_#000]">
              <Lock className="h-10 w-10 text-black stroke-[3px]" />
            </div>
            <h3 className="text-4xl font-black text-black uppercase tracking-tighter italic mb-4">ACCESS DENIED</h3>
            <p className="text-black font-bold max-w-xl mx-auto uppercase tracking-wide">
              You must be a verified instructor to access this panel.
            </p>
          </div>
        ) : loading || loadingClasses ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
            <div className="w-20 h-20 border-8 border-black border-t-neo-accent animate-spin" />
            <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">LOADING_CLASSES...</h2>
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-20 bg-white border-4 border-black border-dashed">
            <div className="w-24 h-24 bg-neo-bg border-4 border-black mx-auto mb-8 flex items-center justify-center -rotate-3 shadow-[8px_8px_0px_0px_#000]">
              <BookOpen className="h-10 w-10 text-black stroke-[3px]" />
            </div>
            <h3 className="text-4xl font-black text-black uppercase tracking-tighter italic mb-4">NO CLASSES FOUND</h3>
            <p className="text-black font-bold max-w-xl mx-auto uppercase tracking-wide">
              Create your first class to start managing students and operations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {classes.map((cls) => (
              <div
                key={cls.id}
                onClick={() => navigate(`/teacher/class/${cls.id}`)}
                className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] transition-all cursor-pointer group relative"
              >
                <div className="absolute top-4 right-4 bg-neo-accent text-white px-2 py-1 text-xs font-black uppercase tracking-widest border-2 border-black rotate-3">
                  ACTIVE
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-neo-muted border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000] group-hover:rotate-6 transition-transform">
                    <Users className="h-8 w-8 text-black stroke-[3px]" />
                  </div>
                </div>

                <h3 className="text-2xl font-black text-black uppercase tracking-tight italic mb-2 line-clamp-1 group-hover:underline">{cls.name}</h3>
                <p className="text-sm font-bold text-black/60 uppercase tracking-widest mb-6 border-b-4 border-black pb-4">{cls.subject}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest">CODE:</span>
                    <span className="bg-black text-white px-2 py-1 text-xs font-mono font-bold tracking-wider -rotate-1 shadow-[2px_2px_0px_0px_#neo-accent]">
                      {cls.code}
                    </span>
                  </div>
                  <div className="bg-neo-bg border-2 border-black p-1 hover:bg-black hover:text-white transition-colors">
                    <Settings className="h-5 w-5 stroke-[2.5px]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Class Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-neo-bg border-4 border-black w-full max-w-md p-8 shadow-[16px_16px_0px_0px_#000] relative animate-in zoom-in-95 duration-200">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-black hover:rotate-90 transition-transform"
              >
                <X className="h-8 w-8 stroke-[4px]" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="bg-neo-secondary p-2 border-4 border-black shadow-[4px_4px_0px_0px_#000]">
                  <Plus className="h-6 w-6 stroke-[4px]" />
                </div>
                <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">NEW_CLASS</h2>
              </div>

              <form onSubmit={handleCreateClass} className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2">Class Name</label>
                  <input
                    type="text"
                    required
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full bg-white border-4 border-black px-4 py-3 font-bold text-lg focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:text-black/20"
                    placeholder="e.g. Physics 101"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2">Subject</label>
                  <select
                    className="w-full bg-white border-4 border-black px-4 py-3 font-bold text-lg focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] appearance-none"
                    value={newClassSubject}
                    onChange={e => setNewClassSubject(e.target.value)}
                    disabled={creating}
                    required
                  >
                    <option value="" className="text-gray-400">Select Subject</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Science">Science</option>
                    <option value="English">English</option>
                    <option value="Social Science">Social Science</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Accountancy">Accountancy</option>
                    <option value="Business Studies">Business Studies</option>
                    <option value="Economics">Economics</option>
                  </select>
                </div>

                {createError && <div className="text-white font-bold bg-neo-accent border-4 border-black p-3 uppercase tracking-wide text-xs">{createError}</div>}

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-black text-white py-4 font-black uppercase tracking-widest text-xl border-4 border-black shadow-[8px_8px_0px_0px_#neo-accent] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" /> CREATING...
                    </>
                  ) : (
                    'INITIALIZE CLASS'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherPanel;