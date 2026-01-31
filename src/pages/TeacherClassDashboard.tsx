import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Bell, XCircle, Eye, Trash2, Upload, FileText, Link as LinkIcon, BarChart2, Brain, Users, BookOpen, AlertCircle, Loader2, Download, Clock, Sparkles } from 'lucide-react';
import { marked } from 'marked';

const TABS = ['Overview', 'Students', 'Resources', 'Announcements', 'Assignments', 'Daily Log & Mock Test', 'Student Responses', 'Weaknesses', 'AI Insights', 'Notifications'];

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



  // Student Responses (Exam Attempts)
  const [attempts, setAttempts] = useState<any[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [attemptProfiles, setAttemptProfiles] = useState<Record<string, { full_name?: string; email?: string }>>({});
  const [showAttemptModal, setShowAttemptModal] = useState(false);
  const [attemptModal, setAttemptModal] = useState<any | null>(null);
  const [responseGroupMode, setResponseGroupMode] = useState<'assignment' | 'student'>('assignment');
  const [viewingStudent, setViewingStudent] = useState<any | null>(null);

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

  // Generate an Atlas-style mock test based on today's taught topics and notify students
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
      const { data: funcData, error: funcError } = await supabase.functions.invoke('teacher-generate-mock', {
        body: { dailyTopics, mockQuestionCount }
      });

      if (funcError) throw new Error(funcError.message);
      if (funcData.error) throw new Error(funcData.error);

      const clean = funcData.content;
      let questions: any[];
      try {
        const parsed = JSON.parse(clean);
        // The edge function now returns { questions: [...] } structure
        questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
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
        .select('user_id')
        .eq('class_id', id);
      if (memErr) {
        console.warn('class_members fetch error:', memErr);
      }
      const studentIds: string[] = (members || [])
        .map((m: any) => m.user_id)
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
          .select('user_id')
          .eq('class_id', id);
        const userIds: string[] = (memberData || []).map((m: any) => m.user_id).filter(Boolean);
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
        const { data: members, error: memErr } = await supabase
          .from('class_members')
          .select('user_id')
          .eq('class_id', id);

        if (memErr) console.error('Error fetching members:', memErr);

        const userIds: string[] = (members || []).map((m: any) => m.user_id).filter(Boolean);
        console.log('Fetching attempts for user IDs:', userIds);

        if (userIds.length === 0) {
          setAttempts([]);
          setAttemptProfiles({});
          setAttemptsLoading(false);
          return;
        }
        const { data: attemptData, error: attemptErr } = await supabase
          .from('cbse_exam_attempts')
          .select('*')
          .in('user_id', userIds)
          .order('exam_date', { ascending: false })
          .limit(200);

        if (attemptErr) console.error('Error fetching attempts:', attemptErr);
        console.log('Attempts found:', attemptData?.length);
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
    <div className="min-h-screen bg-neo-bg animate-fade-in pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-12 border-b-8 border-black pb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <div className="bg-neo-accent p-3 border-4 border-black shadow-[4px_4px_0px_0px_#000] -rotate-2">
                  <BookOpen className="h-8 w-8 text-white stroke-[3px]" />
                </div>
                <h1 className="text-4xl font-black text-black uppercase tracking-tighter italic">{classInfo?.name || 'Class'}</h1>
              </div>
              <div className="flex items-center gap-3 ml-1">
                <span className="text-xs font-black uppercase tracking-widest text-black/60">CLASS_CODE:</span>
                <span className="text-sm font-black text-white bg-black px-3 py-1 -rotate-1 shadow-[2px_2px_0px_0px_#neo-secondary] select-all">{classInfo?.id}</span>
              </div>
            </div>

            <div className="flex gap-2 p-2 bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000]">
              <div className="text-xs font-black uppercase tracking-widest text-black/40 flex flex-col justify-center px-2 text-right leading-tight">
                <div>SESSION</div>
                <div>STATUS</div>
              </div>
              <div className="bg-neo-secondary text-black font-black uppercase px-4 py-2 text-xl border-2 border-black flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 border-2 border-black rounded-full animate-pulse" />
                LIVE
              </div>
            </div>
          </div>
        </div>

        <div className="mb-12 overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max px-1">
            {TABS.map(t => (
              <button
                key={t}
                className={`px-6 py-3 font-black uppercase tracking-widest text-sm transition-all border-4 border-black ${tab === t
                  ? 'bg-neo-accent text-white shadow-[6px_6px_0px_0px_#000] -translate-y-1'
                  : 'bg-white text-black hover:bg-neo-secondary hover:shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5'
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
          <div className="bg-white p-8 border-4 border-black shadow-[12px_12px_0px_0px_#000] mb-6">
            <div className="mb-8 text-2xl font-black text-black uppercase tracking-tighter italic flex items-center gap-3 border-b-4 border-black pb-4">
              <BarChart2 className="h-8 w-8 text-black stroke-[3px]" />
              COMMAND_CENTER_OVERVIEW
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-neo-bg p-6 border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                <div className="text-xs font-black uppercase tracking-widest text-black/60 mb-2">Total Students</div>
                <div className="text-5xl font-black text-black">{students.length}</div>
              </div>
              <div className="bg-neo-secondary p-6 border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                <div className="text-xs font-black uppercase tracking-widest text-black/60 mb-2">Resources</div>
                <div className="text-5xl font-black text-black">{resources.length}</div>
              </div>
              <div className="bg-neo-muted p-6 border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                <div className="text-xs font-black uppercase tracking-widest text-black/60 mb-2">Assignments</div>
                <div className="text-5xl font-black text-black">{assignments.length}</div>
              </div>
              <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                <div className="text-xs font-black uppercase tracking-widest text-black/60 mb-2">Announcements</div>
                <div className="text-5xl font-black text-black">{announcements.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Students Tab */}
        {tab === 'Students' && (
          <div className="bg-white p-8 border-4 border-black shadow-[12px_12px_0px_0px_#000]">
            <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-black pb-4">
              <Users className="h-8 w-8 stroke-[3px]" />
              ENROLLED_CADETS
            </h3>
            {students.length === 0 ? (
              <div className="text-center py-12 border-4 border-dashed border-black/20 bg-neo-bg">
                <p className="font-bold text-black uppercase tracking-widest">NO STUDENTS ENROLLED IN THIS SECTOR.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-4 border-black">
                  <thead className="bg-black text-white uppercase font-black tracking-wider">
                    <tr>
                      <th className="px-6 py-4">CADET_NAME</th>
                      <th className="px-6 py-4">CONTACT_VECTOR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-4 divide-black font-bold">
                    {students.map((s: any) => (
                      <tr key={s.id} className="hover:bg-neo-secondary transition-colors group">
                        <td className="px-6 py-4 text-black group-hover:underline decoration-2 underline-offset-4">{s.full_name || 'UNKNOWN_CADET'}</td>
                        <td className="px-6 py-4 text-black font-mono text-sm">{s.email}</td>
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
          <div className="space-y-8">
            <div className="bg-neo-bg p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000]">
              <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-6 flex items-center gap-3 border-b-4 border-black pb-4">
                <Upload className="h-8 w-8 text-black stroke-[3px]" />
                UPLOAD_RESOURCE_MATERIAL
              </h3>
              <form onSubmit={handleResourceUpload} className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-black/60">RESOURCE_TITLE</label>
                  <input
                    type="text"
                    placeholder="E.G. CHAPTER 5 NOTES"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:text-black/20"
                    required
                  />
                </div>

                <div className="flex gap-8">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 border-4 border-black flex items-center justify-center ${resourceType === 'link' ? 'bg-neo-accent' : 'bg-white'}`}>
                      {resourceType === 'link' && <div className="w-2 h-2 bg-white" />}
                    </div>
                    <input
                      type="radio"
                      name="resourceType"
                      value="link"
                      checked={resourceType === 'link'}
                      onChange={() => setResourceType('link')}
                      className="hidden"
                    />
                    <span className="font-black uppercase tracking-widest group-hover:underline">EXTERNAL_LINK</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 border-4 border-black flex items-center justify-center ${resourceType === 'file' ? 'bg-neo-accent' : 'bg-white'}`}>
                      {resourceType === 'file' && <div className="w-2 h-2 bg-white" />}
                    </div>
                    <input
                      type="radio"
                      name="resourceType"
                      value="file"
                      checked={resourceType === 'file'}
                      onChange={() => setResourceType('file')}
                      className="hidden"
                    />
                    <span className="font-black uppercase tracking-widest group-hover:underline">FILE_UPLOAD</span>
                  </label>
                </div>

                {resourceType === 'link' ? (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-black/60">URL_VECTOR</label>
                    <input
                      type="url"
                      placeholder="HTTPS://..."
                      value={resourceUrl}
                      onChange={(e) => setResourceUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:text-black/20"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-black/60">ATTACH_FILE</label>
                    <input
                      type="file"
                      onChange={(e) => setResourceFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full px-4 py-3 bg-white border-4 border-black font-bold text-black file:mr-4 file:py-2 file:px-4 file:border-2 file:border-black file:text-xs file:font-black file:bg-neo-secondary hover:file:bg-black hover:file:text-white transition-all"
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploadingResource}
                  className="bg-black text-white px-8 py-4 font-black uppercase tracking-widest text-lg border-4 border-transparent hover:bg-neo-accent hover:text-white hover:border-black hover:shadow-[4px_4px_0px_0px_#000] active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingResource ? 'UPLOADING...' : 'DEPLOY_RESOURCE'}
                </button>
              </form>
            </div>

            <div className="bg-white p-8 border-4 border-black shadow-[12px_12px_0px_0px_#000]">
              <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-black pb-4">
                <FileText className="h-8 w-8 stroke-[3px]" />
                CLASS_RESOURCES
              </h3>
              {resources.length === 0 ? (
                <div className="text-center py-12 border-4 border-dashed border-black/20 bg-neo-bg">
                  <p className="font-bold text-black uppercase tracking-widest">NO RESOURCES DEPLOYED.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {resources.map((r: any) => (
                    <div key={r.id} className="bg-white p-6 border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_#000] transition-all flex items-center justify-between group">
                      <div>
                        <h4 className="font-black text-lg text-black uppercase leading-tight group-hover:underline decoration-2 underline-offset-2">{r.title}</h4>
                        <p className="text-xs font-bold text-black/40 mt-1 uppercase tracking-wider">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <a
                        href={r.url || r.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-neo-secondary p-3 border-2 border-black hover:bg-black hover:text-white transition-colors"
                      >
                        <LinkIcon className="h-5 w-5 stroke-[3px]" />
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
          <div className="space-y-8">
            <div className="bg-neo-bg p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000]">
              <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-6 flex items-center gap-3 border-b-4 border-black pb-4">
                <Bell className="h-8 w-8 text-black stroke-[3px]" />
                BROADCAST_ANNOUNCEMENT
              </h3>
              <form onSubmit={handlePostAnnouncement} className="space-y-6">
                {announcementError && <div className="bg-red-100 border-4 border-black text-red-900 font-bold p-4 uppercase">{announcementError}</div>}
                <textarea
                  placeholder="TRANSMIT MESSAGE TO ENTIRE CLASS..."
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:text-black/20 min-h-[150px]"
                  required
                />
                <button
                  type="submit"
                  disabled={postingAnnouncement}
                  className="bg-black text-white px-8 py-4 font-black uppercase tracking-widest text-lg border-4 border-transparent hover:bg-neo-secondary hover:text-black hover:border-black hover:shadow-[4px_4px_0px_0px_#000] active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
                >
                  {postingAnnouncement ? 'TRANSMITTING...' : 'BROADCAST_MESSAGE'}
                </button>
              </form>
            </div>

            <div className="space-y-6">
              {announcements.map((a: any) => (
                <div key={a.id} className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_#000]">
                  <p className="text-black font-bold text-lg whitespace-pre-wrap leading-relaxed">{a.message}</p>
                  <p className="text-xs font-black text-black/40 mt-4 uppercase tracking-widest border-t-2 border-black/10 pt-2">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              ))}
              {announcements.length === 0 && (
                <div className="text-center py-12 border-4 border-dashed border-black/20 bg-neo-bg">
                  <p className="font-bold text-black uppercase tracking-widest">NO BROADCASTS TRANSMITTED.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assignments Tab */}
        {tab === 'Assignments' && (
          <div className="space-y-8">
            <div className="bg-neo-bg p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000]">
              <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-6 flex items-center gap-3 border-b-4 border-black pb-4">
                <FileText className="h-8 w-8 text-black stroke-[3px]" />
                CREATE_ASSIGNMENT
              </h3>
              <form onSubmit={handlePostAssignment} className="space-y-6">
                {assignmentError && <div className="bg-red-100 border-4 border-black text-red-900 font-bold p-4 uppercase">{assignmentError}</div>}
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-black/60">TITLE</label>
                  <input
                    type="text"
                    placeholder="E.G. MID-TERM PROJECT"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:text-black/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-black/60">DESCRIPTION</label>
                  <textarea
                    placeholder="DETAILS & INSTRUCTIONS..."
                    value={assignmentDesc}
                    onChange={(e) => setAssignmentDesc(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:text-black/20 min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-black/60">DUE_DATE</label>
                    <input
                      type="date"
                      value={assignmentDueDate}
                      onChange={(e) => setAssignmentDueDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-black/60">ATTACHMENT</label>
                    <input
                      type="file"
                      onChange={(e) => setAssignmentFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full px-4 py-3 bg-white border-4 border-black font-bold text-black file:mr-4 file:py-2 file:px-4 file:border-2 file:border-black file:text-xs file:font-black file:bg-neo-secondary hover:file:bg-black hover:file:text-white transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={postingAssignment}
                  className="bg-black text-white px-8 py-4 font-black uppercase tracking-widest text-lg border-4 border-transparent hover:bg-neo-accent hover:text-white hover:border-black hover:shadow-[4px_4px_0px_0px_#000] active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
                >
                  {postingAssignment ? 'CREATING...' : 'INITIALIZE_ASSIGNMENT'}
                </button>
              </form>
            </div>

            <div className="space-y-6">
              {assignments.map((a: any) => (
                <div key={a.id} className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000] relative group hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_#000] transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-8">
                      <h4 className="text-2xl font-black text-black uppercase italic">{a.title}</h4>
                      <p className="text-black/80 font-medium mt-2 whitespace-pre-wrap border-l-4 border-neo-secondary pl-4 py-1 bg-neo-bg/50">{a.description}</p>
                      {a.due_date && (
                        <p className="text-xs font-black text-black/60 mt-4 flex items-center gap-2 uppercase tracking-widest">
                          <Clock className="h-4 w-4 stroke-[3px]" />
                          DEADLINE: {new Date(a.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAssignment(a)}
                      className="text-black hover:bg-red-500 hover:text-white p-2 border-2 border-transparent hover:border-black transition-colors"
                      title="DELETE_ASSIGNMENT"
                    >
                      <Trash2 className="h-6 w-6 stroke-[3px]" />
                    </button>
                  </div>
                  {a.file_url && (
                    <div className="mt-6 pt-4 border-t-4 border-black/10">
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-neo-secondary text-black font-black uppercase text-xs px-4 py-2 border-2 border-black hover:bg-black hover:text-white transition-colors tracking-widest shadow-[2px_2px_0px_0px_#000]"
                      >
                        <Download className="h-4 w-4 stroke-[3px]" />
                        DOWNLOAD_ASSET
                      </a>
                    </div>
                  )}
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="text-center py-12 border-4 border-dashed border-black/20 bg-neo-bg">
                  <p className="font-bold text-black uppercase tracking-widest">NO ASSIGNMENTS ACTIVE.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Daily Log & Mock Test Tab */}
        {tab === 'Daily Log & Mock Test' && (
          <div className="bg-white p-8 border-4 border-black shadow-[12px_12px_0px_0px_#000]">
            <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-black pb-4">
              <Brain className="h-8 w-8 text-black stroke-[3px]" />
              DAILY_LOG_&_AI_MOCK_GEN
            </h3>
            <form onSubmit={handleGenerateDailyMockTest} className="space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2 text-black/60">TOPICS_COVERED_TODAY</label>
                <textarea
                  value={dailyTopics}
                  onChange={(e) => setDailyTopics(e.target.value)}
                  placeholder="E.G. NEWTON'S LAWS, INERTIA, MOMENTUM..."
                  className="w-full px-4 py-3 bg-neo-bg border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:text-black/20 min-h-[150px]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2 text-black/60">QUESTION_COUNT</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={mockQuestionCount}
                  onChange={(e) => setMockQuestionCount(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-neo-bg border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all"
                />
              </div>

              {mockGenError && <div className="bg-red-100 border-4 border-black text-red-900 font-bold p-4 uppercase">{mockGenError}</div>}
              {mockSuccessMsg && <div className="bg-green-100 border-4 border-black text-green-900 font-bold p-4 uppercase">{mockSuccessMsg}</div>}

              <button
                type="submit"
                disabled={generatingMock}
                className="bg-neo-accent text-white px-8 py-4 font-black uppercase tracking-widest text-lg border-4 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_#000] active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
              >
                {generatingMock ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin stroke-[3px]" />
                    GENERATING...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-6 w-6 stroke-[3px]" />
                    GENERATE_&_DEPLOY_MOCK
                  </>
                )}
              </button>
            </form>

            {mockPreview && (
              <div className="mt-12 pt-8 border-t-8 border-black">
                <h4 className="text-xl font-black text-black uppercase mb-4">PREVIEW_OUTPUT</h4>
                <div className="bg-neo-bg p-6 border-4 border-black font-mono text-sm text-black whitespace-pre-wrap">
                  {mockPreview}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Student Responses Tab */}
        {tab === 'Student Responses' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic flex items-center gap-3">
                <FileText className="h-8 w-8 text-black stroke-[3px]" />
                STUDENT_RESPONSES
              </h3>
              <div className="flex bg-white border-4 border-black p-1 shadow-[4px_4px_0px_0px_#000]">
                <button
                  onClick={() => setResponseGroupMode('assignment')}
                  className={`px-6 py-2 font-black uppercase tracking-widest text-sm transition-all ${responseGroupMode === 'assignment' ? 'bg-neo-accent text-white border-2 border-black' : 'text-black/40 hover:text-black'}`}
                >
                  BY_ASSIGNMENT
                </button>
                <button
                  onClick={() => setResponseGroupMode('student')}
                  className={`px-6 py-2 font-black uppercase tracking-widest text-sm transition-all ${responseGroupMode === 'student' ? 'bg-neo-accent text-white border-2 border-black' : 'text-black/40 hover:text-black'}`}
                >
                  BY_STUDENT
                </button>
              </div>
            </div>

            {attemptsLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-16 h-16 border-8 border-black border-t-neo-accent animate-spin rounded-full"></div>
              </div>
            )}
            {attemptsError && (
              <div className="bg-red-100 border-4 border-black text-red-900 font-bold p-6 uppercase shadow-[8px_8px_0px_0px_#000]">
                {attemptsError}
              </div>
            )}
            {!attemptsLoading && !attemptsError && (
              <>
                {(() => {
                  if (responseGroupMode === 'assignment') {
                    const assignmentMap = new Map<string, any>((assignments || []).map((a: any) => [a.id, a]));
                    const groupedByAssignment = (assignments || []).map((assnn: any) => ({
                      assignment: assnn,
                      attempts: (attempts || []).filter((at: any) => at.assignment_id === assnn.id)
                    })).filter(g => g.attempts.length > 0);

                    const otherAttempts = (attempts || []).filter(at => !assignmentMap.has(at.assignment_id));

                    if (groupedByAssignment.length === 0 && otherAttempts.length === 0) {
                      return (
                        <div className="text-center py-12 border-4 border-dashed border-black/20 bg-neo-bg">
                          <p className="font-bold text-black uppercase tracking-widest">NO RESPONSES RECORDED.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-12">
                        {groupedByAssignment.map((g) => (
                          <div key={g.assignment.id} className="space-y-4">
                            <div className="flex items-center justify-between border-b-4 border-black pb-2">
                              <h3 className="text-xl font-black text-black uppercase italic flex items-center gap-2">
                                <FileText className="h-6 w-6 stroke-[3px]" />
                                {g.assignment.title}
                              </h3>
                              <div className="text-xs font-bold text-black/60 uppercase tracking-widest">
                                {g.assignment.created_at ? new Date(g.assignment.created_at).toLocaleDateString() : ''}
                              </div>
                            </div>
                            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] overflow-x-auto">
                              <table className="min-w-full text-left">
                                <thead className="bg-black text-white uppercase font-black tracking-wider">
                                  <tr>
                                    <th className="px-6 py-4">DATE</th>
                                    <th className="px-6 py-4">CADET</th>
                                    <th className="px-6 py-4">SCORE</th>
                                    <th className="px-6 py-4">Q_COUNT</th>
                                    <th className="px-6 py-4 text-right">ACTIONS</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y-4 divide-black font-bold">
                                  {g.attempts.map((a: any, i: number) => {
                                    const prof = attemptProfiles[a.user_id] || {};
                                    const name = prof.full_name || prof.email || a.user_id;
                                    return (
                                      <tr key={a.id || i} className="hover:bg-neo-bg transition-colors">
                                        <td className="px-6 py-4 text-black">{a.exam_date ? new Date(a.exam_date).toLocaleDateString() : '-'}</td>
                                        <td className="px-6 py-4 text-black">
                                          <button
                                            onClick={() => {
                                              const s = students.find(st => st.id === a.user_id || st.user_id === a.user_id);
                                              if (s) setViewingStudent(s);
                                            }}
                                            className="hover:underline decoration-2 underline-offset-4 uppercase"
                                          >
                                            {name}
                                          </button>
                                        </td>
                                        <td className="px-6 py-4 text-black font-mono bg-neo-green/20">{a.total_score} / {a.max_score}</td>
                                        <td className="px-6 py-4 text-black">{a.questions_count || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                          <button
                                            className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 border-2 border-black hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_#000]"
                                            onClick={() => { setAttemptModal(a); setShowAttemptModal(true); }}
                                          >
                                            <Eye className="w-4 h-4 stroke-[3px]" /> VIEW
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
                  } else {
                    // Group by Student
                    const groupedByStudent = students.map((s: any) => ({
                      student: s,
                      attempts: (attempts || []).filter((at: any) => at.user_id === s.user_id || at.user_id === s.id)
                    })).filter(g => g.attempts.length > 0);

                    if (groupedByStudent.length === 0) {
                      return (
                        <div className="text-center py-12 border-4 border-dashed border-black/20 bg-neo-bg">
                          <p className="font-bold text-black uppercase tracking-widest">NO RESPONSES RECORDED.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {groupedByStudent.map((g) => (
                          <div
                            key={g.student.id || g.student.user_id}
                            className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_#000] transition-all cursor-pointer group flex items-center gap-4"
                            onClick={() => setViewingStudent(g.student)}
                          >
                            <div className="w-16 h-16 bg-neo-secondary border-4 border-black flex items-center justify-center text-black font-black text-2xl group-hover:bg-neo-accent group-hover:text-white transition-colors">
                              {g.student.full_name?.[0] || g.student.email?.[0] || '?'}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <h3 className="text-xl font-black text-black uppercase truncate group-hover:underline decoration-2 underline-offset-2">
                                {g.student.full_name || g.student.email}
                              </h3>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="bg-black text-white text-xs font-bold px-2 py-1 uppercase">{g.attempts.length} EXAMS</span>
                              </div>
                            </div>
                            <Eye className="w-6 h-6 text-black stroke-[3px]" />
                          </div>
                        ))}
                      </div>
                    );
                  }
                })()}
              </>
            )}
          </div>
        )}

        {/* Weaknesses Tab */}
        {tab === 'Weaknesses' && (
          <div className="space-y-8">
            <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-black pb-4">
              <AlertCircle className="h-8 w-8 text-neo-secondary stroke-[3px]" />
              WEAKNESS_ANALYSIS
            </h3>
            <div className="grid grid-cols-1 gap-6">
              {students.map((s: any) => {
                const studentAttempts = (attempts || []).filter(a => (a.user_id === s.user_id || a.user_id === s.id) && a.student_weaknesses);
                if (studentAttempts.length === 0) return null;
                return (
                  <div
                    key={s.id || s.user_id}
                    className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer group flex items-center justify-between"
                    onClick={() => setViewingStudent(s)}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-neo-bg border-4 border-black flex items-center justify-center text-black font-black text-2xl">
                        {s.full_name?.[0] || s.email?.[0] || '?'}
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-black uppercase group-hover:underline decoration-2 underline-offset-2">{s.full_name || s.email}</h4>
                        <p className="text-sm font-bold text-black/60 uppercase tracking-widest mt-1">{studentAttempts.length} ANALYSES_LOGGED</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-black text-black bg-neo-secondary border-2 border-black px-3 py-1 uppercase tracking-widest animate-pulse">NEEDS_ATTENTION</span>
                      <Eye className="w-6 h-6 text-black stroke-[3px]" />
                    </div>
                  </div>
                );
              })}
              {students.every(s => !(attempts || []).some(a => (a.user_id === s.user_id || a.user_id === s.id) && a.student_weaknesses)) && (
                <div className="text-center py-12 border-4 border-dashed border-black/20 bg-neo-bg">
                  <p className="font-bold text-black uppercase tracking-widest">NO WEAKNESS DATA DETECTED.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Insights Tab */}
        {tab === 'AI Insights' && (
          <div className="bg-white p-8 border-4 border-black shadow-[12px_12px_0px_0px_#000]">
            <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-black pb-4">
              <Brain className="h-8 w-8 text-black stroke-[3px]" />
              TACTICAL_AI_INSIGHTS
            </h3>
            {aiLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-16 h-16 border-8 border-black border-t-neo-purple animate-spin rounded-full"></div>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none text-black">
                {/* Note: prose-invert usually makes text white. We want black. Using 'prose-xl' and custom colors.
                     Since we installed @tailwindcss/typography without custom config, prose-invert forces white.
                     Instead, let's just use 'prose' and ensure text is black.
                  */}
                <div className="prose prose-lg max-w-none prose-headings:font-black prose-headings:uppercase prose-p:font-medium prose-strong:font-black prose-a:text-neo-accent" dangerouslySetInnerHTML={{ __html: marked(aiSummary) as string }} />
              </div>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {tab === 'Notifications' && (
          <div className="bg-white p-8 border-4 border-black shadow-[12px_12px_0px_0px_#000]">
            <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-black pb-4">
              <Bell className="h-8 w-8 text-black stroke-[3px]" />
              SYSTEM_LOGS
            </h3>
            <div className="text-center py-12 border-4 border-dashed border-black/20 bg-neo-bg">
              <p className="font-bold text-black uppercase tracking-widest">NO NEW LOGS.</p>
            </div>
          </div>
        )}

        {/* Attempt Details Modal */}
        {showAttemptModal && attemptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neo-bg/90 backdrop-blur-none p-4 animate-fade-in">
            <div className="bg-white border-4 border-black shadow-[16px_16px_0px_0px_#000] p-8 max-w-4xl w-full relative max-h-[90vh] overflow-y-auto">
              <button
                className="absolute top-6 right-6 p-2 bg-black text-white hover:bg-red-600 transition-colors"
                onClick={() => { setShowAttemptModal(false); setAttemptModal(null); }}
                aria-label="Close"
              >
                <XCircle className="h-6 w-6 stroke-[3px]" />
              </button>
              <h3 className="text-3xl font-black text-black uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-black pb-4">
                <FileText className="h-8 w-8 text-black stroke-[3px]" />
                RESPONSE_ANALYSIS
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-sm">
                <div className="bg-neo-bg p-4 border-4 border-black shadow-[4px_4px_0px_0px_#000]">
                  <div className="font-black uppercase tracking-widest text-black/60 mb-1">CADET</div>
                  <div className="font-bold text-lg text-black">{attemptProfiles[attemptModal.user_id]?.full_name || attemptProfiles[attemptModal.user_id]?.email || attemptModal.user_id}</div>
                </div>
                <div className="bg-neo-bg p-4 border-4 border-black shadow-[4px_4px_0px_0px_#000]">
                  <div className="font-black uppercase tracking-widest text-black/60 mb-1">TIMESTAMP</div>
                  <div className="font-bold text-lg text-black">{attemptModal.exam_date ? new Date(attemptModal.exam_date).toLocaleString() : '-'}</div>
                </div>
                <div className="bg-neo-bg p-4 border-4 border-black shadow-[4px_4px_0px_0px_#000]">
                  <div className="font-black uppercase tracking-widest text-black/60 mb-1">SCORE</div>
                  <div className="font-black text-2xl text-black bg-neo-green/20 inline-block px-2">{attemptModal.total_score} / {attemptModal.max_score}</div>
                </div>
              </div>

              {attemptModal.student_weaknesses && (
                <div className="mb-8">
                  <div className="font-black text-black uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 stroke-[3px]" />
                    WEAKNESS_SUMMARY
                  </div>
                  <div className="text-black font-medium leading-relaxed whitespace-pre-wrap bg-red-50 p-6 border-4 border-black">
                    {attemptModal.student_weaknesses}
                  </div>
                </div>
              )}

              <div className="mb-8">
                <div className="font-black text-black uppercase tracking-widest mb-4">DETAILED_FEEDBACK_MATRIX</div>
                {(() => {
                  const items = parseAttemptFeedback(attemptModal.ai_feedback);
                  if (!items || items.length === 0) return <div className="text-black/60 italic border-4 border-dashed border-black/10 p-4 text-center">NO STRUCTURED DATA.</div>;
                  return (
                    <div className="overflow-x-auto border-4 border-black">
                      <table className="min-w-full text-sm text-left">
                        <thead className="bg-black text-white uppercase font-black">
                          <tr>
                            <th className="px-4 py-3 border-b-4 border-black">Q#</th>
                            <th className="px-4 py-3 border-b-4 border-black">MARKS</th>
                            <th className="px-4 py-3 border-b-4 border-black">FEEDBACK</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y-4 divide-black font-bold">
                          {items.map((q: any, idx: number) => (
                            <tr key={idx} className="bg-white">
                              <td className="px-4 py-3 text-black border-r-4 border-black">{q.question_number || idx + 1}</td>
                              <td className="px-4 py-3 text-black font-mono border-r-4 border-black bg-neo-bg">{q.marks_awarded} / {q.max_marks}</td>
                              <td className="px-4 py-3 text-black whitespace-pre-wrap bg-white">{q.feedback || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-8 text-right">
                <button
                  className="bg-black text-white px-8 py-3 font-black uppercase tracking-widest hover:bg-neo-accent hover:text-white hover:shadow-[4px_4px_0px_0px_#000] transition-all border-4 border-transparent hover:border-black"
                  onClick={() => { setShowAttemptModal(false); setAttemptModal(null); }}
                >
                  CLOSE_PANEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Student Detail Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neo-bg/90 backdrop-blur-none" onClick={() => setViewingStudent(null)}></div>
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden border-4 border-black shadow-[20px_20px_0px_0px_#000] flex flex-col">
            <div className="p-8 border-b-4 border-black flex items-center justify-between bg-neo-accent">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white border-4 border-black flex items-center justify-center text-black font-black text-3xl shadow-[4px_4px_0px_0px_#000]">
                  {viewingStudent.full_name?.[0] || viewingStudent.email?.[0] || '?'}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter text-shadow-sm">{viewingStudent.full_name || viewingStudent.email}</h3>
                  <p className="text-black font-bold bg-white/50 px-2 mt-1 inline-block border-2 border-black">{viewingStudent.email}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingStudent(null)}
                className="p-2 bg-black text-white hover:bg-white hover:text-black border-4 border-black transition-colors shadow-[4px_4px_0px_0px_#000]"
              >
                <XCircle className="w-8 h-8 stroke-[3px]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-neo-bg">
              <div className="grid grid-cols-2 gap-8">
                <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000]">
                  <div className="text-black/60 font-black uppercase tracking-widest text-xs mb-2">TOTAL_ASSESSMENTS</div>
                  <div className="text-5xl font-black text-black">
                    {(attempts || []).filter(a => a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id).length}
                  </div>
                </div>
                <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000]">
                  <div className="text-black/60 font-black uppercase tracking-widest text-xs mb-2">PERFORMANCE_INDEX</div>
                  <div className="text-5xl font-black text-black">
                    {(() => {
                      const satts = (attempts || []).filter(a => a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id);
                      if (satts.length === 0) return 'N/A';
                      const avg = satts.reduce((acc, at) => acc + (at.total_score / at.max_score), 0) / satts.length;
                      return Math.round(avg * 100) + '%';
                    })()}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-2xl font-black text-black uppercase italic tracking-tighter flex items-center gap-3 border-b-4 border-black pb-2">
                  <AlertCircle className="w-6 h-6 stroke-[3px]" />
                  IDENTIFIED_WEAKNESSES
                </h4>
                <div className="space-y-6">
                  {(attempts || [])
                    .filter(a => (a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id) && a.student_weaknesses)
                    .map((at, idx) => (
                      <div key={at.id || idx} className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_#000]">
                        <div className="flex justify-between items-start mb-4 border-b-2 border-dashed border-black pb-2">
                          <span className="font-black text-lg text-black uppercase">
                            {(assignments || []).find(as => as.id === at.assignment_id)?.title || 'MOCK_TEST'}
                          </span>
                          <span className="font-bold text-black/40 text-sm">
                            {new Date(at.exam_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-black font-medium leading-relaxed whitespace-pre-wrap">
                          {at.student_weaknesses}
                        </p>
                      </div>
                    ))}
                  {(attempts || []).filter(a => (a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id) && a.student_weaknesses).length === 0 && (
                    <div className="text-center py-8 font-bold text-black/40 uppercase">NO WEAKNESSES LOGGED.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t-4 border-black bg-white">
              <button
                onClick={() => setViewingStudent(null)}
                className="w-full bg-black text-white font-black uppercase tracking-widest py-4 border-4 border-transparent hover:bg-white hover:text-black hover:border-black hover:shadow-[4px_4px_0px_0px_#000] transition-all"
              >
                CLOSE_ANALYSIS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherClassDashboard;