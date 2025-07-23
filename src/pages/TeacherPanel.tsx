import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import { Bell } from 'lucide-react';

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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

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

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      setLoadingNotifications(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications(data || []);
      setLoadingNotifications(false);
    };
    if (role === 'teacher') fetchNotifications();
  }, [user, role]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-gray-800 p-8 rounded-xl shadow text-center border border-gray-700">
          <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-300">You must be a teacher to access this panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6 text-gray-100">
      <div className="max-w-3xl mx-auto">
        {/* Notifications Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2 mb-2"><Bell className="w-6 h-6" /> Notifications</h2>
          {loadingNotifications ? (
            <div className="text-blue-400">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="text-gray-400">No notifications yet.</div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif, i) => (
                <div key={notif.id || i} className={`p-4 rounded-lg border ${notif.is_read ? 'border-gray-700 bg-gray-800 opacity-60' : 'border-blue-700 bg-blue-950'} transition-all` }>
                  <div className="font-semibold text-white mb-1">{notif.title}</div>
                  <div className="text-gray-300 mb-1">{notif.message}</div>
                  <div className="text-xs text-gray-400">{notif.created_at ? new Date(notif.created_at).toLocaleString() : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
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
            <div className="bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md relative border border-gray-700">
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
                  className="w-full p-2 border rounded mb-4 bg-gray-900 text-gray-100 border-gray-700"
                  placeholder="Class Name"
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  disabled={creating}
                />
                <select
                  className="w-full p-2 border rounded mb-4 bg-gray-900 text-gray-100 border-gray-700"
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
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : classes.length === 0 ? (
          <div className="text-gray-400 text-center py-16">No classes found. Click "+ Create Class" to get started.</div>
        ) : (
          <div className="grid gap-6">
            {classes.map(cls => (
              <div
                key={cls.id}
                className="bg-gray-800 rounded-xl shadow p-6 border border-gray-700 hover:border-blue-500 transition text-gray-100 cursor-pointer"
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

// CBSE Exam Analytics Section
function CBSEExamAnalytics() {
  const { user } = useAuth() as any;
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);

  useEffect(() => {
    const fetchAttempts = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('cbse_exam_attempts')
          .select('*')
          .order('exam_date', { ascending: false });
        if (error) throw error;
        setAttempts(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch attempts');
      }
      setLoading(false);
    };
    fetchAttempts();
  }, []);

  return (
    <div className="mt-12 p-6 bg-gray-900 rounded-xl border border-blue-800">
      <h2 className="text-2xl font-bold text-blue-400 mb-4">CBSE Exam Analytics</h2>
      {loading && <div className="text-blue-400">Loading...</div>}
      {error && <div className="text-red-400">{error}</div>}
      {!loading && attempts.length === 0 && <div className="text-gray-400">No exam attempts found.</div>}
      {!loading && attempts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-300 mb-4">
            <thead className="bg-blue-900 text-blue-200">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Sheet</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a, i) => (
                <tr key={a.id || i} className="border-b border-blue-800 hover:bg-blue-950 cursor-pointer">
                  <td className="px-3 py-2">{a.user_id}</td>
                  <td className="px-3 py-2">{a.exam_date ? new Date(a.exam_date).toLocaleString() : ''}</td>
                  <td className="px-3 py-2">{a.total_score} / {a.max_score}</td>
                  <td className="px-3 py-2">{a.answer_sheet_url && <a href={a.answer_sheet_url} target="_blank" rel="noopener noreferrer" className="underline text-blue-400">View</a>}</td>
                  <td className="px-3 py-2">
                    <button className="bg-green-700 hover:bg-green-800 text-white px-3 py-1 rounded" onClick={() => setSelectedAttempt(a)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Modal or expandable section for details */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-gray-900 rounded-xl border border-blue-800 p-8 max-w-2xl w-full relative">
            <button className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl" onClick={() => setSelectedAttempt(null)}>&times;</button>
            <h3 className="text-xl font-bold text-blue-300 mb-2">Exam Report</h3>
            <div className="mb-2 text-gray-300"><b>Student:</b> {selectedAttempt.user_id}</div>
            <div className="mb-2 text-gray-300"><b>Date:</b> {selectedAttempt.exam_date ? new Date(selectedAttempt.exam_date).toLocaleString() : ''}</div>
            <div className="mb-2 text-gray-300"><b>Score:</b> {selectedAttempt.total_score} / {selectedAttempt.max_score}</div>
            <div className="mb-2 text-gray-300"><b>Sheet:</b> {selectedAttempt.answer_sheet_url && <a href={selectedAttempt.answer_sheet_url} target="_blank" rel="noopener noreferrer" className="underline text-blue-400">View</a>}</div>
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-green-300 mb-1">AI Feedback</h4>
              <textarea className="w-full p-3 rounded bg-gray-800 text-white border border-green-700 mb-2" rows={8} value={selectedAttempt.ai_feedback || ''} readOnly />
            </div>
            {selectedAttempt.improvement_plan && (
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-purple-300 mb-1">Improvement Plan</h4>
                <textarea className="w-full p-3 rounded bg-gray-800 text-white border border-purple-700" rows={6} value={selectedAttempt.improvement_plan} readOnly />
              </div>
            )}
            {selectedAttempt.student_weaknesses && (
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-red-300 mb-1">Student Weaknesses</h4>
                <div className="w-full p-3 rounded bg-gray-800 text-white border border-red-700 prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked(selectedAttempt.student_weaknesses) as string }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherPanel; 