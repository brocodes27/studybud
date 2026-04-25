import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Bell, XCircle, Eye, Trash2, Upload, FileText, Link as LinkIcon, BarChart2, Brain, Users, BookOpen, AlertCircle, Loader2, Download, Clock, Sparkles, GraduationCap, CheckCircle2 } from 'lucide-react';
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
  const [assignmentMode, setAssignmentMode] = useState<'standard' | 'prove-it'>('prove-it');
  const [proveItSubject, setProveItSubject] = useState('JEE Physics');
  const [proveItTopic, setProveItTopic] = useState('');

  // Daily Log & Mock Test state
  const [dailyTopics, setDailyTopics] = useState('');
  const [mockQuestionCount, setMockQuestionCount] = useState(8);
  const [generatingMock, setGeneratingMock] = useState(false);
  const [mockGenError, setMockGenError] = useState('');
  const [mockPreview, setMockPreview] = useState<string>('');
  const [mockSuccessMsg, setMockSuccessMsg] = useState('');

  // Class Session Logger state
  const [sessionSubject, setSessionSubject] = useState('Physics');
  const [sessionTopics, setSessionTopics] = useState('');
  const [sessionHomework, setSessionHomework] = useState('');
  const [sessionDuration, setSessionDuration] = useState(60);
  const [loggingSession, setLoggingSession] = useState(false);
  const [sessionLogError, setSessionLogError] = useState('');
  const [sessionLogSuccess, setSessionLogSuccess] = useState('');

  const handleLogClassSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    if (!sessionTopics.trim()) {
      setSessionLogError('Please enter the topics covered.');
      return;
    }
    setSessionLogError('');
    setSessionLogSuccess('');
    setLoggingSession(true);
    try {
      const topicsArray = sessionTopics.split(',').map(t => t.trim()).filter(Boolean);
      const { data: members } = await supabase.from('class_members').select('student_id').eq('class_id', id);
      const studentIds = (members || []).map((m: any) => m.student_id).filter(Boolean);
      if (studentIds.length === 0) {
        setSessionLogError('No students enrolled in this class.');
        setLoggingSession(false);
        return;
      }
      const { data: roadmaps } = await supabase
        .from('student_roadmaps')
        .select('id, user_id')
        .in('user_id', studentIds)
        .eq('is_active', true);
      const roadmapRows = (roadmaps || []).map((r: any) => ({
        roadmap_id: r.id,
        teacher_id: user.id,
        session_date: new Date().toISOString().split('T')[0],
        subject: sessionSubject,
        topics_covered: topicsArray,
        homework_assigned: sessionHomework || null,
        duration_minutes: sessionDuration,
      }));
      if (roadmapRows.length === 0) {
        setSessionLogError('No students have an active study roadmap. Ask them to complete onboarding first.');
        setLoggingSession(false);
        return;
      }
      const { error } = await supabase.from('class_sessions').insert(roadmapRows);
      if (error) throw error;
      setSessionLogSuccess(`Class logged for ${roadmapRows.length} student${roadmapRows.length > 1 ? 's' : ''}! Prescriptions will auto-regenerate.`);
      setSessionTopics('');
      setSessionHomework('');
    } catch (err: any) {
      setSessionLogError(err?.message || 'Failed to log class session.');
    } finally {
      setLoggingSession(false);
    }
  };



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
      // Also log to class_sessions for each student's roadmap
      const topicsArray = dailyTopics.split(',').map(t => t.trim()).filter(Boolean);
      if (topicsArray.length > 0) {
        const { data: members } = await supabase.from('class_members').select('student_id').eq('class_id', id);
        const studentIds = (members || []).map((m: any) => m.student_id).filter(Boolean);
        if (studentIds.length > 0) {
          const { data: roadmaps } = await supabase
            .from('student_roadmaps')
            .select('id, user_id')
            .in('user_id', studentIds)
            .eq('is_active', true);
          const roadmapRows = (roadmaps || []).map((r: any) => ({
            roadmap_id: r.id,
            teacher_id: user.id,
            session_date: new Date().toISOString().split('T')[0],
            subject: 'Mock Test Topics',
            topics_covered: topicsArray,
            homework_assigned: `Mock test on: ${dailyTopics}`,
            duration_minutes: 0,
          }));
          if (roadmapRows.length > 0) {
            await supabase.from('class_sessions').insert(roadmapRows);
          }
        }
      }

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
    if (assignmentMode === 'prove-it' && !proveItTopic.trim()) {
      setAssignmentError('Prove-It topic is required.');
      return;
    }
    if (assignmentMode === 'standard' && !assignmentTitle.trim()) {
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
      const proveItUrl = `/prove-it?subject=${encodeURIComponent(proveItSubject)}&topic=${encodeURIComponent(proveItTopic)}`;
      const title = assignmentMode === 'prove-it' ? `Prove-It: ${proveItTopic}` : assignmentTitle;
      const description = assignmentMode === 'prove-it'
        ? `Socratic mastery challenge assigned by your teacher.\n\nSubject: ${proveItSubject}\nTopic: ${proveItTopic}\n\nOpen: ${proveItUrl}`
        : assignmentDesc;
      const { error } = await supabase.from('assignments').insert({
        class_id: id,
        title,
        description,
        due_date: assignmentDueDate || null,
        file_url: fileUrl,
      });
      if (error) throw new Error(error.message);

      const { data: members } = await supabase
        .from('class_members')
        .select('user_id')
        .eq('class_id', id);
      const studentIds: string[] = (members || []).map((m: any) => m.user_id).filter((uid: string) => uid && uid !== user.id);
      if (studentIds.length > 0) {
        await supabase.from('notifications').insert(studentIds.map(uid => ({
          user_id: uid,
          type: 'assignment',
          title: assignmentMode === 'prove-it' ? 'New Prove-It Challenge' : 'New Assignment',
          message: assignmentMode === 'prove-it' ? `${proveItSubject}: ${proveItTopic}` : title,
          is_read: false,
          action_url: assignmentMode === 'prove-it' ? proveItUrl : `/class/${id}`,
          priority: assignmentMode === 'prove-it' ? 'high' : 'normal',
          class_id: id,
        })));
      }

      setAssignmentTitle('');
      setAssignmentDesc('');
      setAssignmentDueDate('');
      setAssignmentFile(null);
      setProveItTopic('');

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
    <div className="min-h-screen bg-slate-950 animate-fade-in pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-12 border-b-8 border-white/10 pb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <div className="bg-neo-accent p-3 border border-white/10 shadow-neo -rotate-2">
                  <BookOpen className="h-8 w-8 text-white stroke-[3px]" />
                </div>
                <h1 className="text-4xl font-black text-slate-100 uppercase tracking-tighter italic">{classInfo?.name || 'Class'}</h1>
              </div>
              <div className="flex items-center gap-3 ml-1">
                <span className="text-xs font-black uppercase tracking-widest text-slate-100/60">CLASS_CODE:</span>
                <span className="text-sm font-black text-white bg-slate-900 px-3 py-1 -rotate-1 shadow-neo select-all">{classInfo?.id}</span>
              </div>
            </div>

            <div className="flex gap-2 p-2 bg-slate-800 border border-white/10 shadow-neo">
              <div className="text-xs font-black uppercase tracking-widest text-slate-100/40 flex flex-col justify-center px-2 text-right leading-tight">
                <div>SESSION</div>
                <div>STATUS</div>
              </div>
              <div className="bg-neo-secondary text-slate-100 font-black uppercase px-4 py-2 text-xl border border-white/10 flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 border border-white/10 rounded-full animate-pulse" />
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
                className={`px-6 py-3 font-black uppercase tracking-widest text-sm transition-all border border-white/10 ${tab === t
                  ? 'bg-neo-accent text-white shadow-neo -translate-y-1'
                  : 'bg-slate-800 text-slate-100 hover:bg-neo-secondary hover:shadow-neo hover:-translate-y-0.5'
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
          <div className="bg-slate-800 p-8 border border-white/10 shadow-neo mb-6">
            <div className="mb-8 text-2xl font-black text-slate-100 uppercase tracking-tighter italic flex items-center gap-3 border-b-4 border-white/10 pb-4">
              <BarChart2 className="h-8 w-8 text-slate-100 stroke-[3px]" />
              COMMAND_CENTER_OVERVIEW
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-slate-900 p-6 border border-white/10 shadow-neo hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                <div className="text-xs font-black uppercase tracking-widest text-slate-100/60 mb-2">Total Students</div>
                <div className="text-5xl font-black text-slate-100">{students.length}</div>
              </div>
              <div className="bg-neo-secondary p-6 border border-white/10 shadow-neo hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                <div className="text-xs font-black uppercase tracking-widest text-slate-100/60 mb-2">Resources</div>
                <div className="text-5xl font-black text-slate-100">{resources.length}</div>
              </div>
              <div className="bg-neo-muted p-6 border border-white/10 shadow-neo hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                <div className="text-xs font-black uppercase tracking-widest text-slate-100/60 mb-2">Assignments</div>
                <div className="text-5xl font-black text-slate-100">{assignments.length}</div>
              </div>
              <div className="bg-slate-800 p-6 border border-white/10 shadow-neo hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                <div className="text-xs font-black uppercase tracking-widest text-slate-100/60 mb-2">Announcements</div>
                <div className="text-5xl font-black text-slate-100">{announcements.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Students Tab */}
        {tab === 'Students' && (
          <div className="bg-slate-800 p-8 border border-white/10 shadow-neo">
            <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-white/10 pb-4">
              <Users className="h-8 w-8 stroke-[3px]" />
              ENROLLED_CADETS
            </h3>
            {students.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10/20 bg-slate-900">
                <p className="font-bold text-slate-100 uppercase tracking-widest">NO STUDENTS ENROLLED IN THIS SECTOR.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border border-white/10">
                  <thead className="bg-slate-900 text-white uppercase font-black tracking-wider">
                    <tr>
                      <th className="px-6 py-4">CADET_NAME</th>
                      <th className="px-6 py-4">CONTACT_VECTOR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-4 divide-black font-bold">
                    {students.map((s: any) => (
                      <tr key={s.id} className="hover:bg-neo-secondary transition-colors group">
                        <td className="px-6 py-4 text-slate-100 group-hover:underline decoration-2 underline-offset-4">{s.full_name || 'UNKNOWN_CADET'}</td>
                        <td className="px-6 py-4 text-slate-100 font-mono text-sm">{s.email}</td>
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
            <div className="bg-slate-900 p-8 border border-white/10 shadow-neo">
              <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic mb-6 flex items-center gap-3 border-b-4 border-white/10 pb-4">
                <Upload className="h-8 w-8 text-slate-100 stroke-[3px]" />
                UPLOAD_RESOURCE_MATERIAL
              </h3>
              <form onSubmit={handleResourceUpload} className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">RESOURCE_TITLE</label>
                  <input
                    type="text"
                    placeholder="E.G. CHAPTER 5 NOTES"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/20"
                    required
                  />
                </div>

                <div className="flex gap-8">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 border border-white/10 flex items-center justify-center ${resourceType === 'link' ? 'bg-neo-accent' : 'bg-slate-800'}`}>
                      {resourceType === 'link' && <div className="w-2 h-2 bg-slate-800" />}
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
                    <div className={`w-6 h-6 border border-white/10 flex items-center justify-center ${resourceType === 'file' ? 'bg-neo-accent' : 'bg-slate-800'}`}>
                      {resourceType === 'file' && <div className="w-2 h-2 bg-slate-800" />}
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
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">URL_VECTOR</label>
                    <input
                      type="url"
                      placeholder="HTTPS://..."
                      value={resourceUrl}
                      onChange={(e) => setResourceUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/20"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">ATTACH_FILE</label>
                    <input
                      type="file"
                      onChange={(e) => setResourceFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full px-4 py-3 bg-slate-800 border border-white/10 font-bold text-slate-100 file:mr-4 file:py-2 file:px-4 file:border file:border-white/10 file:text-xs file:font-black file:bg-neo-secondary hover:file:bg-slate-900 hover:file:text-white transition-all"
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploadingResource}
                  className="bg-slate-900 text-white px-8 py-4 font-black uppercase tracking-widest text-lg border border-transparent hover:bg-neo-accent hover:text-white hover:border-white/10 hover:shadow-neo active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingResource ? 'UPLOADING...' : 'DEPLOY_RESOURCE'}
                </button>
              </form>
            </div>

            <div className="bg-slate-800 p-8 border border-white/10 shadow-neo">
              <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-white/10 pb-4">
                <FileText className="h-8 w-8 stroke-[3px]" />
                CLASS_RESOURCES
              </h3>
              {resources.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10/20 bg-slate-900">
                  <p className="font-bold text-slate-100 uppercase tracking-widest">NO RESOURCES DEPLOYED.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {resources.map((r: any) => (
                    <div key={r.id} className="bg-slate-800 p-6 border border-white/10 shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo transition-all flex items-center justify-between group">
                      <div>
                        <h4 className="font-black text-lg text-slate-100 uppercase leading-tight group-hover:underline decoration-2 underline-offset-2">{r.title}</h4>
                        <p className="text-xs font-bold text-slate-100/40 mt-1 uppercase tracking-wider">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <a
                        href={r.url || r.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-neo-secondary p-3 border border-white/10 hover:bg-slate-900 hover:text-white transition-colors"
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
            <div className="bg-slate-900 p-8 border border-white/10 shadow-neo">
              <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic mb-6 flex items-center gap-3 border-b-4 border-white/10 pb-4">
                <Bell className="h-8 w-8 text-slate-100 stroke-[3px]" />
                BROADCAST_ANNOUNCEMENT
              </h3>
              <form onSubmit={handlePostAnnouncement} className="space-y-6">
                {announcementError && <div className="bg-red-100 border border-white/10 text-red-900 font-bold p-4 uppercase">{announcementError}</div>}
                <textarea
                  placeholder="TRANSMIT MESSAGE TO ENTIRE CLASS..."
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/20 min-h-[150px]"
                  required
                />
                <button
                  type="submit"
                  disabled={postingAnnouncement}
                  className="bg-slate-900 text-white px-8 py-4 font-black uppercase tracking-widest text-lg border border-transparent hover:bg-neo-secondary hover:text-slate-100 hover:border-white/10 hover:shadow-neo active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
                >
                  {postingAnnouncement ? 'TRANSMITTING...' : 'BROADCAST_MESSAGE'}
                </button>
              </form>
            </div>

            <div className="space-y-6">
              {announcements.map((a: any) => (
                <div key={a.id} className="bg-slate-800 p-6 border border-white/10 shadow-neo">
                  <p className="text-slate-100 font-bold text-lg whitespace-pre-wrap leading-relaxed">{a.message}</p>
                  <p className="text-xs font-black text-slate-100/40 mt-4 uppercase tracking-widest border-t-2 border-white/10/10 pt-2">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              ))}
              {announcements.length === 0 && (
                <div className="text-center py-12 border border-dashed border-white/10/20 bg-slate-900">
                  <p className="font-bold text-slate-100 uppercase tracking-widest">NO BROADCASTS TRANSMITTED.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assignments Tab */}
        {tab === 'Assignments' && (
          <div className="space-y-8">
            <div className="bg-slate-900 p-8 border border-white/10 shadow-neo">
              <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic mb-6 flex items-center gap-3 border-b-4 border-white/10 pb-4">
                <FileText className="h-8 w-8 text-slate-100 stroke-[3px]" />
                CREATE_ASSIGNMENT
              </h3>
              <form onSubmit={handlePostAssignment} className="space-y-6">
                {assignmentError && <div className="bg-red-100 border border-white/10 text-red-900 font-bold p-4 uppercase">{assignmentError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAssignmentMode('prove-it')}
                    className={`p-4 border border-white/10 font-black uppercase tracking-widest text-sm transition-all ${assignmentMode === 'prove-it' ? 'bg-neo-accent text-white shadow-neo' : 'bg-slate-800 text-slate-100/70 hover:bg-slate-700'}`}
                  >
                    ASSIGN_PROVE_IT
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignmentMode('standard')}
                    className={`p-4 border border-white/10 font-black uppercase tracking-widest text-sm transition-all ${assignmentMode === 'standard' ? 'bg-neo-accent text-white shadow-neo' : 'bg-slate-800 text-slate-100/70 hover:bg-slate-700'}`}
                  >
                    STANDARD_TASK
                  </button>
                </div>
                {assignmentMode === 'prove-it' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-800 p-5 border border-white/10">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">JEE_SUBJECT</label>
                      <select
                        value={proveItSubject}
                        onChange={(e) => setProveItSubject(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-900 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all"
                      >
                        <option>JEE Physics</option>
                        <option>JEE Chemistry</option>
                        <option>JEE Mathematics</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">TOPIC_TO_PROVE</label>
                      <input
                        type="text"
                        placeholder="E.G. ROTATIONAL DYNAMICS"
                        value={proveItTopic}
                        onChange={(e) => setProveItTopic(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-900 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/20"
                      />
                    </div>
                  </div>
                )}
                {assignmentMode === 'standard' && <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">TITLE</label>
                  <input
                    type="text"
                    placeholder="E.G. MID-TERM PROJECT"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/20"
                    required
                  />
                </div>}
                {assignmentMode === 'standard' && <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">DESCRIPTION</label>
                  <textarea
                    placeholder="DETAILS & INSTRUCTIONS..."
                    value={assignmentDesc}
                    onChange={(e) => setAssignmentDesc(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/20 min-h-[100px]"
                  />
                </div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">DUE_DATE</label>
                    <input
                      type="date"
                      value={assignmentDueDate}
                      onChange={(e) => setAssignmentDueDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all"
                    />
                  </div>
                  {assignmentMode === 'standard' && <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">ATTACHMENT</label>
                    <input
                      type="file"
                      onChange={(e) => setAssignmentFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full px-4 py-3 bg-slate-800 border border-white/10 font-bold text-slate-100 file:mr-4 file:py-2 file:px-4 file:border file:border-white/10 file:text-xs file:font-black file:bg-neo-secondary hover:file:bg-slate-900 hover:file:text-white transition-all"
                    />
                  </div>}
                </div>

                <button
                  type="submit"
                  disabled={postingAssignment}
                  className="bg-slate-900 text-white px-8 py-4 font-black uppercase tracking-widest text-lg border border-transparent hover:bg-neo-accent hover:text-white hover:border-white/10 hover:shadow-neo active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
                >
                  {postingAssignment ? 'CREATING...' : assignmentMode === 'prove-it' ? 'ASSIGN_PROVE_IT_CHALLENGE' : 'INITIALIZE_ASSIGNMENT'}
                </button>
              </form>
            </div>

            <div className="space-y-6">
              {assignments.map((a: any) => (
                <div key={a.id} className="bg-slate-800 p-6 border border-white/10 shadow-neo relative group hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-8">
                      <h4 className="text-2xl font-black text-slate-100 uppercase italic">{a.title}</h4>
                      <p className="text-slate-100/80 font-medium mt-2 whitespace-pre-wrap border-l-4 border-neo-secondary pl-4 py-1 bg-slate-900/50">{a.description}</p>
                      {a.due_date && (
                        <p className="text-xs font-black text-slate-100/60 mt-4 flex items-center gap-2 uppercase tracking-widest">
                          <Clock className="h-4 w-4 stroke-[3px]" />
                          DEADLINE: {new Date(a.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAssignment(a)}
                      className="text-slate-100 hover:bg-red-500 hover:text-white p-2 border border-transparent hover:border-white/10 transition-colors"
                      title="DELETE_ASSIGNMENT"
                    >
                      <Trash2 className="h-6 w-6 stroke-[3px]" />
                    </button>
                  </div>
                  {a.file_url && (
                    <div className="mt-6 pt-4 border-t-4 border-white/10/10">
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-neo-secondary text-slate-100 font-black uppercase text-xs px-4 py-2 border border-white/10 hover:bg-slate-900 hover:text-white transition-colors tracking-widest shadow-neo"
                      >
                        <Download className="h-4 w-4 stroke-[3px]" />
                        DOWNLOAD_ASSET
                      </a>
                    </div>
                  )}
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="text-center py-12 border border-dashed border-white/10/20 bg-slate-900">
                  <p className="font-bold text-slate-100 uppercase tracking-widest">NO ASSIGNMENTS ACTIVE.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Daily Log & Mock Test Tab */}
        {tab === 'Daily Log & Mock Test' && (
          <div className="space-y-8">
            {/* Class Session Logger */}
            <div className="bg-slate-800 p-8 border border-white/10 shadow-neo">
              <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-white/10 pb-4">
                <GraduationCap className="h-8 w-8 text-slate-100 stroke-[3px]" />
                LOG_TODAY&apos;S_CLASS
              </h3>
              <form onSubmit={handleLogClassSession} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">Subject</label>
                    <select
                      value={sessionSubject}
                      onChange={(e) => setSessionSubject(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-900 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all"
                    >
                      {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">Duration (min)</label>
                    <input
                      type="number"
                      min={15}
                      max={180}
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(parseInt(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-900 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">Topics Covered (comma-separated)</label>
                  <textarea
                    value={sessionTopics}
                    onChange={(e) => setSessionTopics(e.target.value)}
                    placeholder="E.G. Kinematics 1D, Equations of Motion, Graphical Analysis..."
                    className="w-full px-4 py-3 bg-slate-900 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/20 min-h-[100px]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">Homework / DPP Assigned</label>
                  <textarea
                    value={sessionHomework}
                    onChange={(e) => setSessionHomework(e.target.value)}
                    placeholder="E.G. HC Verma Chap 3 Q1-15, DPP Sheet 7..."
                    className="w-full px-4 py-3 bg-slate-900 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/20 min-h-[80px]"
                  />
                </div>
                {sessionLogError && <div className="bg-red-100 border border-white/10 text-red-900 font-bold p-4 uppercase">{sessionLogError}</div>}
                {sessionLogSuccess && <div className="bg-green-100 border border-white/10 text-green-900 font-bold p-4 uppercase flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />{sessionLogSuccess}</div>}
                <button
                  type="submit"
                  disabled={loggingSession}
                  className="bg-neo-accent text-white px-8 py-4 font-black uppercase tracking-widest text-lg border border-white/10 hover:bg-slate-800 hover:text-slate-100 hover:shadow-neo active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
                >
                  {loggingSession ? (
                    <><Loader2 className="h-6 w-6 animate-spin stroke-[3px]" />LOGGING...</>
                  ) : (
                    <><GraduationCap className="h-6 w-6 stroke-[3px]" />LOG_CLASS_SESSION</>
                  )}
                </button>
              </form>
            </div>

            {/* Mock Test Generator */}
            <div className="bg-slate-800 p-8 border border-white/10 shadow-neo">
              <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-white/10 pb-4">
                <Brain className="h-8 w-8 text-slate-100 stroke-[3px]" />
                AI_MOCK_TEST_GENERATOR
              </h3>
              <form onSubmit={handleGenerateDailyMockTest} className="space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">TOPICS_COVERED_TODAY</label>
                <textarea
                  value={dailyTopics}
                  onChange={(e) => setDailyTopics(e.target.value)}
                  placeholder="E.G. NEWTON'S LAWS, INERTIA, MOMENTUM..."
                  className="w-full px-4 py-3 bg-slate-900 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/20 min-h-[150px]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">QUESTION_COUNT</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={mockQuestionCount}
                  onChange={(e) => setMockQuestionCount(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-900 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all"
                />
              </div>

              {mockGenError && <div className="bg-red-100 border border-white/10 text-red-900 font-bold p-4 uppercase">{mockGenError}</div>}
              {mockSuccessMsg && <div className="bg-green-100 border border-white/10 text-green-900 font-bold p-4 uppercase">{mockSuccessMsg}</div>}

              <button
                type="submit"
                disabled={generatingMock}
                className="bg-neo-accent text-white px-8 py-4 font-black uppercase tracking-widest text-lg border border-white/10 hover:bg-slate-800 hover:text-slate-100 hover:shadow-neo active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
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
              <div className="mt-12 pt-8 border-t-8 border-white/10">
                <h4 className="text-xl font-black text-slate-100 uppercase mb-4">PREVIEW_OUTPUT</h4>
                <div className="bg-slate-900 p-6 border border-white/10 font-mono text-sm text-slate-100 whitespace-pre-wrap">
                  {mockPreview}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Student Responses Tab */}
        {tab === 'Student Responses' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic flex items-center gap-3">
                <FileText className="h-8 w-8 text-slate-100 stroke-[3px]" />
                STUDENT_RESPONSES
              </h3>
              <div className="flex bg-slate-800 border border-white/10 p-1 shadow-neo">
                <button
                  onClick={() => setResponseGroupMode('assignment')}
                  className={`px-6 py-2 font-black uppercase tracking-widest text-sm transition-all ${responseGroupMode === 'assignment' ? 'bg-neo-accent text-white border border-white/10' : 'text-slate-100/40 hover:text-slate-100'}`}
                >
                  BY_ASSIGNMENT
                </button>
                <button
                  onClick={() => setResponseGroupMode('student')}
                  className={`px-6 py-2 font-black uppercase tracking-widest text-sm transition-all ${responseGroupMode === 'student' ? 'bg-neo-accent text-white border border-white/10' : 'text-slate-100/40 hover:text-slate-100'}`}
                >
                  BY_STUDENT
                </button>
              </div>
            </div>

            {attemptsLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-16 h-16 border border-white/10 border-t-neo-accent animate-spin rounded-full"></div>
              </div>
            )}
            {attemptsError && (
              <div className="bg-red-100 border border-white/10 text-red-900 font-bold p-6 uppercase shadow-neo">
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
                        <div className="text-center py-12 border border-dashed border-white/10/20 bg-slate-900">
                          <p className="font-bold text-slate-100 uppercase tracking-widest">NO RESPONSES RECORDED.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-12">
                        {groupedByAssignment.map((g) => (
                          <div key={g.assignment.id} className="space-y-4">
                            <div className="flex items-center justify-between border-b-4 border-white/10 pb-2">
                              <h3 className="text-xl font-black text-slate-100 uppercase italic flex items-center gap-2">
                                <FileText className="h-6 w-6 stroke-[3px]" />
                                {g.assignment.title}
                              </h3>
                              <div className="text-xs font-bold text-slate-100/60 uppercase tracking-widest">
                                {g.assignment.created_at ? new Date(g.assignment.created_at).toLocaleDateString() : ''}
                              </div>
                            </div>
                            <div className="bg-slate-800 border border-white/10 shadow-neo overflow-x-auto">
                              <table className="min-w-full text-left">
                                <thead className="bg-slate-900 text-white uppercase font-black tracking-wider">
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
                                      <tr key={a.id || i} className="hover:bg-slate-900 transition-colors">
                                        <td className="px-6 py-4 text-slate-100">{a.exam_date ? new Date(a.exam_date).toLocaleDateString() : '-'}</td>
                                        <td className="px-6 py-4 text-slate-100">
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
                                        <td className="px-6 py-4 text-slate-100 font-mono bg-neo-green/20">{a.total_score} / {a.max_score}</td>
                                        <td className="px-6 py-4 text-slate-100">{a.questions_count || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                          <button
                                            className="inline-flex items-center gap-2 bg-slate-800 text-slate-100 px-4 py-2 border border-white/10 hover:bg-slate-900 hover:text-white transition-all shadow-neo"
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
                        <div className="text-center py-12 border border-dashed border-white/10/20 bg-slate-900">
                          <p className="font-bold text-slate-100 uppercase tracking-widest">NO RESPONSES RECORDED.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {groupedByStudent.map((g) => (
                          <div
                            key={g.student.id || g.student.user_id}
                            className="bg-slate-800 p-6 border border-white/10 shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo transition-all cursor-pointer group flex items-center gap-4"
                            onClick={() => setViewingStudent(g.student)}
                          >
                            <div className="w-16 h-16 bg-neo-secondary border border-white/10 flex items-center justify-center text-slate-100 font-black text-2xl group-hover:bg-neo-accent group-hover:text-white transition-colors">
                              {g.student.full_name?.[0] || g.student.email?.[0] || '?'}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <h3 className="text-xl font-black text-slate-100 uppercase truncate group-hover:underline decoration-2 underline-offset-2">
                                {g.student.full_name || g.student.email}
                              </h3>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="bg-slate-900 text-white text-xs font-bold px-2 py-1 uppercase">{g.attempts.length} EXAMS</span>
                              </div>
                            </div>
                            <Eye className="w-6 h-6 text-slate-100 stroke-[3px]" />
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
            <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-white/10 pb-4">
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
                    className="bg-slate-800 p-6 border border-white/10 shadow-neo hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer group flex items-center justify-between"
                    onClick={() => setViewingStudent(s)}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-slate-900 border border-white/10 flex items-center justify-center text-slate-100 font-black text-2xl">
                        {s.full_name?.[0] || s.email?.[0] || '?'}
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-100 uppercase group-hover:underline decoration-2 underline-offset-2">{s.full_name || s.email}</h4>
                        <p className="text-sm font-bold text-slate-100/60 uppercase tracking-widest mt-1">{studentAttempts.length} ANALYSES_LOGGED</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-black text-slate-100 bg-neo-secondary border border-white/10 px-3 py-1 uppercase tracking-widest animate-pulse">NEEDS_ATTENTION</span>
                      <Eye className="w-6 h-6 text-slate-100 stroke-[3px]" />
                    </div>
                  </div>
                );
              })}
              {students.every(s => !(attempts || []).some(a => (a.user_id === s.user_id || a.user_id === s.id) && a.student_weaknesses)) && (
                <div className="text-center py-12 border border-dashed border-white/10/20 bg-slate-900">
                  <p className="font-bold text-slate-100 uppercase tracking-widest">NO WEAKNESS DATA DETECTED.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Insights Tab */}
        {tab === 'AI Insights' && (
          <div className="bg-slate-800 p-8 border border-white/10 shadow-neo">
            <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-white/10 pb-4">
              <Brain className="h-8 w-8 text-slate-100 stroke-[3px]" />
              TACTICAL_AI_INSIGHTS
            </h3>
            {aiLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-16 h-16 border border-white/10 border-t-neo-purple animate-spin rounded-full"></div>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none text-slate-100">
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
          <div className="bg-slate-800 p-8 border border-white/10 shadow-neo">
            <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-white/10 pb-4">
              <Bell className="h-8 w-8 text-slate-100 stroke-[3px]" />
              SYSTEM_LOGS
            </h3>
            <div className="text-center py-12 border border-dashed border-white/10/20 bg-slate-900">
              <p className="font-bold text-slate-100 uppercase tracking-widest">NO NEW LOGS.</p>
            </div>
          </div>
        )}

        {/* Attempt Details Modal */}
        {showAttemptModal && attemptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-none p-4 animate-fade-in">
            <div className="bg-slate-800 border border-white/10 shadow-neo p-8 max-w-4xl w-full relative max-h-[90vh] overflow-y-auto">
              <button
                className="absolute top-6 right-6 p-2 bg-slate-900 text-white hover:bg-red-600 transition-colors"
                onClick={() => { setShowAttemptModal(false); setAttemptModal(null); }}
                aria-label="Close"
              >
                <XCircle className="h-6 w-6 stroke-[3px]" />
              </button>
              <h3 className="text-3xl font-black text-slate-100 uppercase tracking-tighter italic mb-8 flex items-center gap-3 border-b-4 border-white/10 pb-4">
                <FileText className="h-8 w-8 text-slate-100 stroke-[3px]" />
                RESPONSE_ANALYSIS
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-sm">
                <div className="bg-slate-900 p-4 border border-white/10 shadow-neo">
                  <div className="font-black uppercase tracking-widest text-slate-100/60 mb-1">CADET</div>
                  <div className="font-bold text-lg text-slate-100">{attemptProfiles[attemptModal.user_id]?.full_name || attemptProfiles[attemptModal.user_id]?.email || attemptModal.user_id}</div>
                </div>
                <div className="bg-slate-900 p-4 border border-white/10 shadow-neo">
                  <div className="font-black uppercase tracking-widest text-slate-100/60 mb-1">TIMESTAMP</div>
                  <div className="font-bold text-lg text-slate-100">{attemptModal.exam_date ? new Date(attemptModal.exam_date).toLocaleString() : '-'}</div>
                </div>
                <div className="bg-slate-900 p-4 border border-white/10 shadow-neo">
                  <div className="font-black uppercase tracking-widest text-slate-100/60 mb-1">SCORE</div>
                  <div className="font-black text-2xl text-slate-100 bg-neo-green/20 inline-block px-2">{attemptModal.total_score} / {attemptModal.max_score}</div>
                </div>
              </div>

              {attemptModal.student_weaknesses && (
                <div className="mb-8">
                  <div className="font-black text-slate-100 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 stroke-[3px]" />
                    WEAKNESS_SUMMARY
                  </div>
                  <div className="text-slate-100 font-medium leading-relaxed whitespace-pre-wrap bg-red-50 p-6 border border-white/10">
                    {attemptModal.student_weaknesses}
                  </div>
                </div>
              )}

              <div className="mb-8">
                <div className="font-black text-slate-100 uppercase tracking-widest mb-4">DETAILED_FEEDBACK_MATRIX</div>
                {(() => {
                  const items = parseAttemptFeedback(attemptModal.ai_feedback);
                  if (!items || items.length === 0) return <div className="text-slate-100/60 italic border border-dashed border-white/10/10 p-4 text-center">NO STRUCTURED DATA.</div>;
                  return (
                    <div className="overflow-x-auto border border-white/10">
                      <table className="min-w-full text-sm text-left">
                        <thead className="bg-slate-900 text-white uppercase font-black">
                          <tr>
                            <th className="px-4 py-3 border-b-4 border-white/10">Q#</th>
                            <th className="px-4 py-3 border-b-4 border-white/10">MARKS</th>
                            <th className="px-4 py-3 border-b-4 border-white/10">FEEDBACK</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y-4 divide-black font-bold">
                          {items.map((q: any, idx: number) => (
                            <tr key={idx} className="bg-slate-800">
                              <td className="px-4 py-3 text-slate-100 border-r-4 border-white/10">{q.question_number || idx + 1}</td>
                              <td className="px-4 py-3 text-slate-100 font-mono border-r-4 border-white/10 bg-slate-900">{q.marks_awarded} / {q.max_marks}</td>
                              <td className="px-4 py-3 text-slate-100 whitespace-pre-wrap bg-slate-800">{q.feedback || '-'}</td>
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
                  className="bg-slate-900 text-white px-8 py-3 font-black uppercase tracking-widest hover:bg-neo-accent hover:text-white hover:shadow-neo transition-all border border-transparent hover:border-white/10"
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
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-none" onClick={() => setViewingStudent(null)}></div>
          <div className="relative bg-slate-800 w-full max-w-4xl max-h-[90vh] overflow-hidden border border-white/10 shadow-neo flex flex-col">
            <div className="p-8 border-b-4 border-white/10 flex items-center justify-between bg-neo-accent">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-slate-800 border border-white/10 flex items-center justify-center text-slate-100 font-black text-3xl shadow-neo">
                  {viewingStudent.full_name?.[0] || viewingStudent.email?.[0] || '?'}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter text-shadow-sm">{viewingStudent.full_name || viewingStudent.email}</h3>
                  <p className="text-slate-100 font-bold bg-slate-800/50 px-2 mt-1 inline-block border border-white/10">{viewingStudent.email}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingStudent(null)}
                className="p-2 bg-slate-900 text-white hover:bg-slate-800 hover:text-slate-100 border border-white/10 transition-colors shadow-neo"
              >
                <XCircle className="w-8 h-8 stroke-[3px]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-900">
              <div className="grid grid-cols-2 gap-8">
                <div className="bg-slate-800 p-6 border border-white/10 shadow-neo">
                  <div className="text-slate-100/60 font-black uppercase tracking-widest text-xs mb-2">TOTAL_ASSESSMENTS</div>
                  <div className="text-5xl font-black text-slate-100">
                    {(attempts || []).filter(a => a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id).length}
                  </div>
                </div>
                <div className="bg-slate-800 p-6 border border-white/10 shadow-neo">
                  <div className="text-slate-100/60 font-black uppercase tracking-widest text-xs mb-2">PERFORMANCE_INDEX</div>
                  <div className="text-5xl font-black text-slate-100">
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
                <h4 className="text-2xl font-black text-slate-100 uppercase italic tracking-tighter flex items-center gap-3 border-b-4 border-white/10 pb-2">
                  <AlertCircle className="w-6 h-6 stroke-[3px]" />
                  IDENTIFIED_WEAKNESSES
                </h4>
                <div className="space-y-6">
                  {(attempts || [])
                    .filter(a => (a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id) && a.student_weaknesses)
                    .map((at, idx) => (
                      <div key={at.id || idx} className="bg-slate-800 p-6 border border-white/10 shadow-neo">
                        <div className="flex justify-between items-start mb-4 border-b-2 border-dashed border-white/10 pb-2">
                          <span className="font-black text-lg text-slate-100 uppercase">
                            {(assignments || []).find(as => as.id === at.assignment_id)?.title || 'MOCK_TEST'}
                          </span>
                          <span className="font-bold text-slate-100/40 text-sm">
                            {new Date(at.exam_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-100 font-medium leading-relaxed whitespace-pre-wrap">
                          {at.student_weaknesses}
                        </p>
                      </div>
                    ))}
                  {(attempts || []).filter(a => (a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id) && a.student_weaknesses).length === 0 && (
                    <div className="text-center py-8 font-bold text-slate-100/40 uppercase">NO WEAKNESSES LOGGED.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t-4 border-white/10 bg-slate-800">
              <button
                onClick={() => setViewingStudent(null)}
                className="w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 border border-transparent hover:bg-slate-800 hover:text-slate-100 hover:border-white/10 hover:shadow-neo transition-all"
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