import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Bell, XCircle, Eye, Trash2, Upload, Plus, FileText, Link as LinkIcon, MessageSquare, BarChart2, Brain, Calendar, Users, BookOpen, AlertCircle, CheckCircle, Loader2, Send, Search, Download, Clock, Sparkles } from 'lucide-react';
import { marked } from 'marked';

const TABS = ['Overview', 'Students', 'Resources', 'Announcements', 'Assignments', 'Daily Log & Mock Test', 'Student Responses', 'Analytics', 'AI Insights', 'Notifications'];

const TeacherClassDashboard: React.FC = () => {
  const { id } = useParams();
  const { user, role, loading } = useAuth() as any;
  const [classInfo, setClassInfo] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [tab, setTab] = useState('Overview');
  const [loadingData, setLoadingData] = useState(true);
  // For AI Insights
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // Resource upload state
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState('link');
  const [uploadingResource, setUploadingResource] = useState(false);
  const [resourceFile, setResourceFile] = useState<File | null>(null);

  // Add state for forms above component
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementError, setAnnouncementError] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDesc, setAssignmentDesc] = useState('');
  const [assignmentDueDate, setAssignmentDueDate] = useState('');
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [assignmentError, setAssignmentError] = useState('');
  const [postingAssignment, setPostingAssignment] = useState(false);

  // Daily Log & Mock Test state
  const [dailyTopics, setDailyTopics] = useState('');
  const [mockQuestionCount, setMockQuestionCount] = useState(8);
  const [generatingMock, setGeneratingMock] = useState(false);
  const [mockGenError, setMockGenError] = useState('');
  const [mockPreview, setMockPreview] = useState<string>('');
  const [mockSuccessMsg, setMockSuccessMsg] = useState('');

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifModalContent, setNotifModalContent] = useState<string>('');
  const [notifModalTitle, setNotifModalTitle] = useState<string>('');

  // Student Responses (Exam Attempts)
  const [attempts, setAttempts] = useState<any[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [attemptProfiles, setAttemptProfiles] = useState<Record<string, { full_name?: string; email?: string }>>({});
  const [showAttemptModal, setShowAttemptModal] = useState(false);
  const [attemptModal, setAttemptModal] = useState<any | null>(null);

  // Helper to extract storage path from a public URL for the 'assignments' bucket
  const getAssignmentsStoragePath = (publicUrl?: string | null) => {
    if (!publicUrl) return null;
    const marker = '/storage/v1/object/public/assignments/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  };

  // Delete an assignment (and try to remove attached storage file)
  const handleDeleteAssignment = async (assignment: any) => {
    if (!user || !id) return;
    const confirmed = window.confirm(`Delete assignment "${assignment.title}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      // Attempt storage cleanup first (best-effort)
      const key = getAssignmentsStoragePath(assignment.file_url);
      if (key) {
        await supabase.storage.from('assignments').remove([key]);
      }
      // Delete DB row
      const { error } = await supabase.from('assignments').delete().eq('id', assignment.id).eq('class_id', id);
      if (error) throw error;
      // Refresh list
      const { data: assignmentData } = await supabase.from('assignments').select('*').eq('class_id', id).order('created_at', { ascending: false });
      setAssignments(assignmentData || []);
    } catch (err: any) {
      console.error('Delete assignment failed:', err);
      alert('Failed to delete assignment: ' + (err.message || 'Unknown error'));
    }
  };

  // Generate a CBSE-style mock test based on today's taught topics and notify students
  const handleGenerateDailyMockTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    if (!dailyTopics.trim()) {
      setMockGenError('Please describe what you taught today.');
      return;
    }
    setMockGenError('');
    setMockSuccessMsg('');
    setGeneratingMock(true);

    try {
      const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
      if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY');

      const prompt = `You are an expert CBSE question setter. Create a short mock test strictly based on the following topics taught today. Keep it aligned with latest CBSE patterns.

Topics taught today:
${dailyTopics}

Rules:
- Total questions: ${mockQuestionCount}
- Include a balanced mix: MCQs (with 4 options A-D, exactly one correct), Short Answer (2-4 lines), Long Answer (6-10 lines)
- Provide marks per question: MCQ 1 mark, Short 2-3 marks, Long 4-5 marks
- Output JSON array only, no extra text. Each item: {"index": number, "type": "mcq"|"short"|"long", "question": string, "marks": number, "options"?: string[]}
`;

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;
      const body = { contents: [{ parts: [{ text: prompt }] }] } as any;
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) throw new Error('Gemini API error: ' + resp.statusText);
      const data = await resp.json();
      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let clean = text.trim().replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
      let questions: any[];
      try {
        questions = JSON.parse(clean);
      } catch {
        const match = clean.match(/\[.*\]/s);
        if (match) questions = JSON.parse(match[0]);
        else throw new Error('Failed to parse AI response');
      }
      if (!Array.isArray(questions) || questions.length === 0) throw new Error('AI did not return questions');

      // Build a plain text preview and description
      const preview = questions.map((q: any, i: number) => {
        const head = `${i + 1}. [${q.marks} mark${q.marks > 1 ? 's' : ''}] ${q.question}`;
        if (q.type === 'mcq' && Array.isArray(q.options)) {
          const opts = q.options.map((o: string, idx: number) => `   (${String.fromCharCode(65 + idx)}) ${o}`).join('\n');
          return `${head}\n${opts}`;
        }
        return head;
      }).join('\n\n');
      setMockPreview(preview);

      // Upload structured JSON to storage (assignments bucket)
      const jsonPayload = {
        generated_at: new Date().toISOString(),
        class_id: id,
        topics: dailyTopics,
        questions,
      };
      const jsonBlob = new Blob([JSON.stringify(jsonPayload, null, 2)], { type: 'application/json' });
      const jsonPath = `${user.id}/${id}/mock_${Date.now()}.json`;
      const { error: uploadErr } = await supabase.storage
        .from('assignments')
        .upload(jsonPath, jsonBlob, { contentType: 'application/json', upsert: false });
      if (uploadErr) throw new Error('Failed to upload mock JSON: ' + uploadErr.message);
      const { data: jsonPublic } = supabase.storage.from('assignments').getPublicUrl(jsonPath);
      const jsonUrl = jsonPublic?.publicUrl || '';

      // Save as an assignment so students can see it in their portal
      const today = new Date();
      const title = `Mock Test - ${today.toLocaleDateString()}`;
      const description = `Topics covered today:\n${dailyTopics}\n\nMock Test (preview):\n\n${preview}\n\n(Attached JSON contains the structured questions.)`;
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const { error: assignErr } = await supabase.from('assignments').insert({
        class_id: id,
        title,
        description,
        due_date: null,
        file_url: jsonUrl,
        is_mock: true,
        expires_at: expiresAt,
      });
      if (assignErr) throw new Error(assignErr.message);

      // Post an announcement summarizing the day
      await supabase.from('class_announcements').insert({ class_id: id, message: `Taught today: ${dailyTopics}` });

      // Notify all students in this class
      const { data: members, error: memErr } = await supabase
        .from('class_members')
        .select('user_id, student_id')
        .eq('class_id', id);
      if (memErr) {
        console.warn('class_members fetch error:', memErr);
      }
      const studentIds: string[] = (members || [])
        .map((m: any) => m.user_id || m.student_id)
        .filter((uid: string) => uid && uid !== user.id);
      if (studentIds.length > 0) {
        const rows = studentIds.map(uid => ({
          user_id: uid,
          type: 'system',
          title: 'New Mock Test Available',
          message: `Based on today\'s topics: ${dailyTopics.substring(0, 140)}${dailyTopics.length > 140 ? '…' : ''}`,
          is_read: false,
          action_url: `/class/${id}`,
          priority: 'high',
          class_id: id,
        }));
        const { error: notifErr } = await supabase.from('notifications').insert(rows);
        if (notifErr) {
          console.error('Insert notifications error:', notifErr);
        }
      }

      setMockSuccessMsg('Mock test generated, posted as an assignment, and students have been notified.');
    } catch (err: any) {
      setMockGenError(err.message || 'Failed to generate mock test');
    } finally {
      setGeneratingMock(false);
    }
  };

  // Initial data fetch (class info, students, resources, announcements, assignments)
  useEffect(() => {
    if (!user || !id) return;
    const fetchAll = async () => {
      setLoadingData(true);
      try {
        // Class info
        const { data: classData } = await supabase.from('classes').select('*').eq('id', id).single();
        setClassInfo(classData || null);

        // Students (support user_id or student_id schema)
        const { data: memberData } = await supabase
          .from('class_members')
          .select('user_id, student_id')
          .eq('class_id', id);
        const userIds: string[] = (memberData || []).map((m: any) => m.user_id || m.student_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: studentProfiles } = await supabase
            .from('user_profiles')
            .select('id, full_name, email')
            .in('id', userIds);
          setStudents(studentProfiles || []);
        } else {
          setStudents([]);
        }

        // Resources
        const { data: resourceData } = await supabase.from('class_resources').select('*').eq('class_id', id);
        setResources(resourceData || []);

        // Announcements
        const { data: announcementData } = await supabase.from('class_announcements').select('*').eq('class_id', id);
        setAnnouncements(announcementData || []);

        // Assignments
        const { data: assignmentData } = await supabase
          .from('assignments')
          .select('*')
          .eq('class_id', id)
          .order('created_at', { ascending: false });
        setAssignments(assignmentData || []);
      } finally {
        setLoadingData(false);
      }
    };
    fetchAll();
  }, [user, id]);

  // Fetch Student Responses when tab is opened
  useEffect(() => {
    const fetchAttempts = async () => {
      if (tab !== 'Student Responses' || !user || !id) return;
      setAttemptsLoading(true);
      setAttemptsError(null);
      try {
        const { data: members } = await supabase
          .from('class_members')
          .select('user_id, student_id')
          .eq('class_id', id);
        const userIds: string[] = (members || []).map((m: any) => m.user_id || m.student_id).filter(Boolean);
        if (userIds.length === 0) {
          setAttempts([]);
          setAttemptProfiles({});
          setAttemptsLoading(false);
          return;
        }
        const { data: attemptData } = await supabase
          .from('cbse_exam_attempts')
          .select('*')
          .in('user_id', userIds)
          .order('exam_date', { ascending: false })
          .limit(200);
        setAttempts(attemptData || []);
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        if (Array.isArray(profiles)) {
          const map: Record<string, { full_name?: string; email?: string }> = {};
          profiles.forEach((p: any) => { map[p.id] = { full_name: p.full_name, email: p.email }; });
          setAttemptProfiles(map);
        }
      } catch (e: any) {
        setAttemptsError(e.message || 'Failed to fetch attempts');
      } finally {
        setAttemptsLoading(false);
      }
    };
    fetchAttempts();
  }, [tab, user, id]);

  // Parse JSON feedback saved in attempts
  const parseAttemptFeedback = (text?: string) => {
    if (!text) return [] as any[];
    let clean = text.trim();
    clean = clean.replace(/^(```json|```|'''json|''')/i, '').replace(/(```|''')$/i, '').trim();
    try {
      const arr = JSON.parse(clean);
      return Array.isArray(arr) ? arr : [];
    } catch {
      const match = clean.match(/\[.*\]/s);
      if (match) {
        try { const arr = JSON.parse(match[0]); return Array.isArray(arr) ? arr : []; } catch { }
      }
      return [] as any[];
    }
  };

  // AI Insights: Call Supabase Edge Function for Gemini
  const fetchAiSummary = async () => {
    setAiLoading(true);
    setAiSummary('');
    try {
      const { data, error } = await supabase.functions.invoke('teacher-ai-insights', {
        body: {
          classId: id,
          students,
          resources,
          assignments,
          prompt: 'Summarize class performance and suggest interventions for the teacher.'
        }
      });
      if (error) throw error;
      setAiSummary(data?.summary || 'No summary returned.');
    } catch (err: any) {
      setAiSummary('Failed to generate AI insights: ' + (err.message || err));
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'AI Insights') fetchAiSummary();
  }, [tab, students, resources]);

  // Resource upload handler (teacher only)
  const handleResourceUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    setUploadingResource(true);
    let fileUrl = '';
    let type = resourceType;

    if (resourceType === 'file' && resourceFile) {
      const ext = resourceFile.name.split('.').pop();
      const filePath = `${id}/${Date.now()}_${resourceFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('class-resources')
        .upload(filePath, resourceFile);
      if (uploadError) {
        setUploadingResource(false);
        alert('File upload failed: ' + uploadError.message);
        return;
      }
      const { data: publicUrlData } = supabase.storage
        .from('class-resources')
        .getPublicUrl(filePath);
      fileUrl = publicUrlData.publicUrl;
      type = ext?.toLowerCase() === 'pdf' ? 'pdf' : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext?.toLowerCase() || '') ? 'image' : 'file';
    }
    const insertObj = {
      class_id: id,
      title: resourceTitle,
      url: resourceType === 'link' ? resourceUrl : null,
      file_url: resourceType === 'file' ? fileUrl : null,
      type,
      uploaded_by: user.id
    };
    await supabase.from('class_resources').insert(insertObj);
    setResourceTitle('');
    setResourceUrl('');
    setResourceType('link');
    setResourceFile(null);
    setUploadingResource(false);
    // Refresh
    const { data: resourceData } = await supabase.from('class_resources').select('*').eq('class_id', id);
    setResources(resourceData || []);
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementContent.trim()) {
      setAnnouncementError('Announcement cannot be empty.');
      return;
    }
    setPostingAnnouncement(true);
    setAnnouncementError('');
    const { error } = await supabase.from('class_announcements').insert({
      class_id: id,
      message: announcementContent,
    });
    if (error) {
      setAnnouncementError('Failed to post announcement.');
    } else {
      setAnnouncementContent('');
      // Refresh announcements
      const { data: announcementData } = await supabase.from('class_announcements').select('*').eq('class_id', id);
      setAnnouncements(announcementData || []);
    }
    setPostingAnnouncement(false);
  };

  const handlePostAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentTitle.trim()) {
      setAssignmentError('Title is required.');
      return;
    }
    setPostingAssignment(true);
    setAssignmentError('');
    let fileUrl: string | null = null;
    try {
      if (assignmentFile) {
        const filePath = `${user.id}/${id}/${Date.now()}_${assignmentFile.name}`;
        const { error: uploadError } = await supabase.storage.from('assignments').upload(filePath, assignmentFile);
        if (uploadError) throw new Error(uploadError.message);
        const { data: publicURLData } = supabase.storage.from('assignments').getPublicUrl(filePath);
        fileUrl = publicURLData.publicUrl;
      }
      const { error } = await supabase.from('assignments').insert({
        class_id: id,
        title: assignmentTitle,
        description: assignmentDesc,
        due_date: assignmentDueDate || null,
        file_url: fileUrl,
      });
      if (error) throw new Error(error.message);

      setAssignmentTitle('');
      setAssignmentDesc('');
      setAssignmentDueDate('');
      setAssignmentFile(null);

      // Refresh assignments
      const { data: assignmentData } = await supabase
        .from('assignments')
        .select('*')
        .eq('class_id', id);
      setAssignments(assignmentData || []);
    } catch (err: any) {
      setAssignmentError('Failed to create assignment: ' + (err.message || err));
    } finally {
      setPostingAssignment(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue" />
        <p className="text-gray-400 text-sm mt-4">Loading class dashboard...</p>
      </div>
    );
  }

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl border border-red-500/20 text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-400">You must be a teacher to access this dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative p-4 md:p-8 animate-fade-in">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl -z-10"></div>

      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-neon-blue" />
            {classInfo?.name || 'Class'}
          </h1>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <span>Class Code:</span>
            <span className="font-mono text-neon-blue bg-black/40 px-2 py-1 rounded border border-white/10 select-all">{classInfo?.id}</span>
          </div>
        </div>

        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-max">
            {TABS.map(t => (
              <button
                key={t}
                className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 whitespace-nowrap ${tab === t
                  ? 'bg-neon-blue text-white shadow-lg shadow-neon-blue/20'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
                  }`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {tab === 'Overview' && (
          <div className="glass-panel p-6 rounded-2xl border border-white/10 mb-6">
            <div className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-neon-purple" />
              Class Overview
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <div className="text-gray-400 text-sm mb-1">Students</div>
                <div className="text-2xl font-bold text-white">{students.length}</div>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <div className="text-gray-400 text-sm mb-1">Resources</div>
                <div className="text-2xl font-bold text-white">{resources.length}</div>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <div className="text-gray-400 text-sm mb-1">Assignments</div>
                <div className="text-2xl font-bold text-white">{assignments.length}</div>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <div className="text-gray-400 text-sm mb-1">Announcements</div>
                <div className="text-2xl font-bold text-white">{announcements.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Students Tab */}
        {tab === 'Students' && (
          <div className="glass-panel p-6 rounded-2xl border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-neon-blue" />
              Students
            </h3>
            {students.length === 0 ? (
              <p className="text-gray-400">No students enrolled yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/10">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {students.map((s: any) => (
                      <tr key={s.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{s.full_name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-gray-400">{s.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Resources Tab */}
        {tab === 'Resources' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5 text-neon-green" />
                Upload Resource
              </h3>
              <form onSubmit={handleResourceUpload} className="space-y-4">
                <input
                  type="text"
                  placeholder="Resource Title"
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-green focus:outline-none"
                  required
                />
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="resourceType"
                      value="link"
                      checked={resourceType === 'link'}
                      onChange={() => setResourceType('link')}
                      className="text-neon-green focus:ring-neon-green"
                    />
                    Link
                  </label>
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="resourceType"
                      value="file"
                      checked={resourceType === 'file'}
                      onChange={() => setResourceType('file')}
                      className="text-neon-green focus:ring-neon-green"
                    />
                    File
                  </label>
                </div>
                {resourceType === 'link' ? (
                  <input
                    type="url"
                    placeholder="Resource URL"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-green focus:outline-none"
                    required
                  />
                ) : (
                  <input
                    type="file"
                    onChange={(e) => setResourceFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-gray-400"
                    required
                  />
                )}
                <button
                  type="submit"
                  disabled={uploadingResource}
                  className="bg-neon-green hover:bg-neon-green/80 text-black font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-neon-green/20 disabled:opacity-50"
                >
                  {uploadingResource ? 'Uploading...' : 'Add Resource'}
                </button>
              </form>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Class Resources</h3>
              {resources.length === 0 ? (
                <p className="text-gray-400">No resources uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resources.map((r: any) => (
                    <div key={r.id} className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-white">{r.title}</h4>
                        <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <a
                        href={r.url || r.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neon-green hover:text-neon-green/80"
                      >
                        <LinkIcon className="h-5 w-5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Announcements Tab */}
        {tab === 'Announcements' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5 text-neon-purple" />
                Post Announcement
              </h3>
              <form onSubmit={handlePostAnnouncement} className="space-y-4">
                {announcementError && <p className="text-red-400">{announcementError}</p>}
                <textarea
                  placeholder="Write your announcement here..."
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-purple focus:outline-none min-h-[100px]"
                  required
                />
                <button
                  type="submit"
                  disabled={postingAnnouncement}
                  className="bg-neon-purple hover:bg-neon-purple/80 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-neon-purple/20 disabled:opacity-50"
                >
                  {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {announcements.map((a: any) => (
                <div key={a.id} className="glass-panel p-6 rounded-2xl border border-white/10">
                  <p className="text-white whitespace-pre-wrap">{a.message}</p>
                  <p className="text-xs text-gray-500 mt-2">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              ))}
              {announcements.length === 0 && <p className="text-gray-400">No announcements yet.</p>}
            </div>
          </div>
        )}

        {/* Assignments Tab */}
        {tab === 'Assignments' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-neon-blue" />
                Create Assignment
              </h3>
              <form onSubmit={handlePostAssignment} className="space-y-4">
                {assignmentError && <p className="text-red-400">{assignmentError}</p>}
                <input
                  type="text"
                  placeholder="Title"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none"
                  required
                />
                <textarea
                  placeholder="Description"
                  value={assignmentDesc}
                  onChange={(e) => setAssignmentDesc(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none min-h-[100px]"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={assignmentDueDate}
                      onChange={(e) => setAssignmentDueDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Attachment</label>
                    <input
                      type="file"
                      onChange={(e) => setAssignmentFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-gray-400"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={postingAssignment}
                  className="bg-neon-blue hover:bg-neon-blue/80 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-neon-blue/20 disabled:opacity-50"
                >
                  {postingAssignment ? 'Creating...' : 'Create Assignment'}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {assignments.map((a: any) => (
                <div key={a.id} className="glass-panel p-6 rounded-2xl border border-white/10 relative group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xl font-bold text-white">{a.title}</h4>
                      <p className="text-gray-300 mt-2 whitespace-pre-wrap">{a.description}</p>
                      {a.due_date && (
                        <p className="text-sm text-neon-yellow mt-2 flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Due: {new Date(a.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAssignment(a)}
                      className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Delete Assignment"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                  {a.file_url && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-neon-blue hover:text-neon-blue/80 bg-neon-blue/10 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download Attachment
                      </a>
                    </div>
                  )}
                </div>
              ))}
              {assignments.length === 0 && <p className="text-gray-400">No assignments yet.</p>}
            </div>
          </div>
        )}

        {/* Daily Log & Mock Test Tab */}
        {tab === 'Daily Log & Mock Test' && (
          <div className="glass-panel p-6 rounded-2xl border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-neon-purple" />
              Daily Log & AI Mock Test
            </h3>
            <form onSubmit={handleGenerateDailyMockTest} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">What did you teach today?</label>
                <textarea
                  value={dailyTopics}
                  onChange={(e) => setDailyTopics(e.target.value)}
                  placeholder="e.g., Newton's Laws of Motion, Inertia, and Momentum..."
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-purple focus:outline-none min-h-[150px]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Number of Questions</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={mockQuestionCount}
                  onChange={(e) => setMockQuestionCount(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-purple focus:outline-none"
                />
              </div>

              {mockGenError && <p className="text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">{mockGenError}</p>}
              {mockSuccessMsg && <p className="text-neon-green bg-neon-green/10 p-3 rounded-xl border border-neon-green/20">{mockSuccessMsg}</p>}

              <button
                type="submit"
                disabled={generatingMock}
                className="bg-gradient-to-r from-neon-purple to-pink-600 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-neon-purple/20 disabled:opacity-50 flex items-center gap-2"
              >
                {generatingMock ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate & Post Mock Test
                  </>
                )}
              </button>
            </form>

            {mockPreview && (
              <div className="mt-8 pt-8 border-t border-white/10">
                <h4 className="text-white font-semibold mb-4">Preview (Last Generated)</h4>
                <div className="bg-black/40 p-6 rounded-xl border border-white/5 text-gray-300 whitespace-pre-wrap font-mono text-sm">
                  {mockPreview}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Student Responses Tab */}
        {tab === 'Student Responses' && (
          <div className="space-y-6">
            {attemptsLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
              </div>
            )}
            {attemptsError && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400">
                {attemptsError}
              </div>
            )}
            {!attemptsLoading && !attemptsError && (
              <>
                {(() => {
                  const assignmentMap = new Map<string, any>((assignments || []).map((a: any) => [a.id, a]));
                  const mockAssignments = (assignments || []).filter((a: any) => a?.is_mock);
                  const groups = mockAssignments
                    .map((assn: any) => ({
                      assignment: assn,
                      attempts: (attempts || []).filter((at: any) => at.assignment_id === assn.id)
                    }))
                    .filter(g => g.attempts.length > 0);
                  const otherAttempts = (attempts || []).filter((at: any) => {
                    const assn = assignmentMap.get(at.assignment_id);
                    return !assn || !assn.is_mock;
                  });

                  if (groups.length === 0 && otherAttempts.length === 0) {
                    return (
                      <div className="glass-panel p-8 rounded-2xl border border-white/10 text-center">
                        <p className="text-gray-400">No student responses found yet.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-8">
                      {groups.map((g) => (
                        <div key={g.assignment.id} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              <FileText className="h-5 w-5 text-neon-blue" />
                              {g.assignment.title}
                            </h3>
                            <div className="text-xs text-gray-400">
                              {g.assignment.created_at ? new Date(g.assignment.created_at).toLocaleString() : ''}
                            </div>
                          </div>
                          <div className="glass-panel p-4 rounded-xl border border-white/10 overflow-x-auto">
                            <table className="min-w-full text-sm text-left">
                              <thead>
                                <tr className="text-gray-400 border-b border-white/10">
                                  <th className="px-3 py-3 font-medium">Date</th>
                                  <th className="px-3 py-3 font-medium">Student</th>
                                  <th className="px-3 py-3 font-medium">Score</th>
                                  <th className="px-3 py-3 font-medium">Questions</th>
                                  <th className="px-3 py-3 font-medium">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {g.attempts.map((a: any, i: number) => {
                                  const prof = attemptProfiles[a.user_id] || {};
                                  const name = prof.full_name || prof.email || a.user_id;
                                  return (
                                    <tr key={a.id || i} className="hover:bg-white/5 transition-colors">
                                      <td className="px-3 py-3 text-gray-300">{a.exam_date ? new Date(a.exam_date).toLocaleString() : '-'}</td>
                                      <td className="px-3 py-3 text-white font-medium">{name}</td>
                                      <td className="px-3 py-3 text-neon-green font-mono">{a.total_score} / {a.max_score}</td>
                                      <td className="px-3 py-3 text-gray-300">{a.questions_count || '-'}</td>
                                      <td className="px-3 py-3">
                                        <button
                                          className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-lg transition-colors border border-white/10"
                                          onClick={() => { setAttemptModal(a); setShowAttemptModal(true); }}
                                        >
                                          <Eye className="w-4 h-4" /> View
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {tab === 'Analytics' && (
          <div className="glass-panel p-8 rounded-2xl border border-white/10 text-center">
            <BarChart2 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Class Analytics</h3>
            <p className="text-gray-400">Detailed analytics coming soon. Check "AI Insights" for a summary.</p>
          </div>
        )}

        {/* AI Insights Tab */}
        {tab === 'AI Insights' && (
          <div className="glass-panel p-6 rounded-2xl border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-neon-purple" />
              AI Class Insights
            </h3>
            {aiLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-purple"></div>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: marked(aiSummary) }} />
              </div>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {tab === 'Notifications' && (
          <div className="glass-panel p-6 rounded-2xl border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-neon-blue" />
              Notifications
            </h3>
            <p className="text-gray-400">System notifications for this class will appear here.</p>
          </div>
        )}

        {/* Attempt Details Modal */}
        {showAttemptModal && attemptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl p-6 max-w-3xl w-full relative max-h-[90vh] overflow-y-auto">
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                onClick={() => { setShowAttemptModal(false); setAttemptModal(null); }}
                aria-label="Close"
              >
                <XCircle className="h-6 w-6" />
              </button>
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <FileText className="h-6 w-6 text-neon-blue" />
                Student Response
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6 bg-black/40 p-4 rounded-xl border border-white/5">
                <div><span className="font-semibold text-gray-400">Student:</span> <span className="text-white ml-2">{attemptProfiles[attemptModal.user_id]?.full_name || attemptProfiles[attemptModal.user_id]?.email || attemptModal.user_id}</span></div>
                <div><span className="font-semibold text-gray-400">Date:</span> <span className="text-white ml-2">{attemptModal.exam_date ? new Date(attemptModal.exam_date).toLocaleString() : '-'}</span></div>
                <div><span className="font-semibold text-gray-400">Score:</span> <span className="text-neon-green font-mono ml-2">{attemptModal.total_score} / {attemptModal.max_score}</span></div>
              </div>

              {attemptModal.student_weaknesses && (
                <div className="mb-6">
                  <div className="font-semibold text-white mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-neon-yellow" />
                    Weaknesses (summary)
                  </div>
                  <div className="text-gray-300 whitespace-pre-wrap bg-black/40 p-4 rounded-xl border border-white/5 text-sm">
                    {attemptModal.student_weaknesses}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="font-semibold text-white mb-3">Per-question Feedback</div>
                {(() => {
                  const items = parseAttemptFeedback(attemptModal.ai_feedback);
                  if (!items || items.length === 0) return <div className="text-gray-500 italic">No structured feedback available.</div>;
                  return (
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                      <table className="min-w-full text-xs text-left">
                        <thead className="bg-white/5">
                          <tr>
                            <th className="px-3 py-2 font-medium text-gray-300">Q#</th>
                            <th className="px-3 py-2 font-medium text-gray-300">Marks</th>
                            <th className="px-3 py-2 font-medium text-gray-300">Feedback</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-black/20">
                          {items.map((q: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-semibold text-white">{q.question_number || idx + 1}</td>
                              <td className="px-3 py-2 text-neon-green font-mono">{q.marks_awarded} / {q.max_marks}</td>
                              <td className="px-3 py-2 text-gray-300 whitespace-pre-wrap">{q.feedback || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-6 text-right">
                <button
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl transition-colors border border-white/10"
                  onClick={() => { setShowAttemptModal(false); setAttemptModal(null); }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherClassDashboard;