import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
 

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
        .select('id, name, teacher_id')
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
      setClasses((prev: any[]) => [...prev, data[0]]);
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner w-12 h-12" />
      </div>
    );
  }

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card p-8 rounded-xl shadow text-center border border-border">
          <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-600">You must be a teacher to access this panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-blue-400">Teacher Panel</h1>
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition"
            onClick={() => setShowCreateModal(true)}
          >
            + Create Class
          </button>
        </div>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md relative border border-border">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-200"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                &times;
              </button>
              <h2 className="text-2xl font-bold mb-4 text-blue-400">Create New Class</h2>
              <form onSubmit={handleCreateClass}>
                <input
                  className="form-input mb-4"
                  placeholder="Class Name"
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  disabled={creating}
                />
                <select
                  className="form-input mb-4"
                  value={newClassSubject}
                  onChange={e => setNewClassSubject(e.target.value)}
                  disabled={creating}
                  required
                >
                  <option value="">Select Subject</option>
                  {/* Class 10 Subjects */}
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                  <option value="English">English</option>
                  <option value="Social Science">Social Science</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Sanskrit">Sanskrit</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Home Science">Home Science</option>
                  <option value="Computer Applications">Computer Applications</option>
                  {/* Science Stream */}
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                  <option value="Mathematics (Science)">Mathematics (Science)</option>
                  <option value="English (Science)">English (Science)</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Physical Education (Science)">Physical Education (Science)</option>
                  <option value="Informatics Practices (Science)">Informatics Practices (Science)</option>
                  {/* Commerce Stream */}
                  <option value="Accountancy">Accountancy</option>
                  <option value="Business Studies">Business Studies</option>
                  <option value="Economics (Commerce)">Economics (Commerce)</option>
                  <option value="Mathematics (Commerce)">Mathematics (Commerce)</option>
                  <option value="English (Commerce)">English (Commerce)</option>
                  <option value="Informatics Practices (Commerce)">Informatics Practices (Commerce)</option>
                  <option value="Physical Education (Commerce)">Physical Education (Commerce)</option>
                  {/* Humanities Stream */}
                  <option value="History">History</option>
                  <option value="Geography">Geography</option>
                  <option value="Political Science">Political Science</option>
                  <option value="Economics (Humanities)">Economics (Humanities)</option>
                  <option value="Psychology">Psychology</option>
                  <option value="Sociology">Sociology</option>
                  <option value="English (Humanities)">English (Humanities)</option>
                  <option value="Mathematics (Humanities)">Mathematics (Humanities)</option>
                  <option value="Physical Education (Humanities)">Physical Education (Humanities)</option>
                  {/* Add more as needed */}
                </select>
                {createError && <div className="text-red-400 mb-2">{createError}</div>}
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition w-full"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Class'}
                </button>
              </form>
            </div>
          </div>
        )}
        {loadingClasses ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="loading-spinner w-12 h-12" />
          </div>
        ) : classes.length === 0 ? (
          <div className="text-gray-400 text-center py-16">No classes found. Click "+ Create Class" to get started.</div>
        ) : (
          <div className="grid gap-6">
            {classes.map(cls => (
              <div
                key={cls.id}
                className="bg-card rounded-xl shadow p-6 border border-border hover:border-blue-500 transition text-foreground cursor-pointer"
                onClick={() => navigate(`/teacher/class/${cls.id}`)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl font-semibold text-blue-300">{cls.name}</span>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">Code: <span className="font-mono text-blue-400 select-all">{cls.id}</span></span>
                    <div className="text-sm text-gray-300 mt-1">{cls.student_count} student(s)</div>
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