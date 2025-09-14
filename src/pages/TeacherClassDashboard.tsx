import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Bell, XCircle, Eye } from 'lucide-react';
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
  const [autoCleanupRunning, setAutoCleanupRunning] = useState(false);

  const handleNotificationClick = async (notif: any) => {
    if (!notif.attempt_id) return;
    // Fetch weaknesses for this attempt
    const { data } = await supabase
      .from('cbse_exam_attempts')
      .select('student_weaknesses')
      .eq('id', notif.attempt_id)
      .single();
    setNotifModalTitle(notif.title);
    setNotifModalContent(data?.student_weaknesses || 'No weaknesses found.');
    setShowNotifModal(true);
  };

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

  const handleDeleteNotification = async (notificationId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);
      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Failed to delete notification', err);
      alert('Failed to delete notification');
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
        try { const arr = JSON.parse(match[0]); return Array.isArray(arr) ? arr : []; } catch {}
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
    console.log('handleResourceUpload called');
    e.preventDefault();
    console.log('After preventDefault');
    if (!user) {
      console.log('No user!');
      return;
    }
    if (!id) {
      console.log('No class_id!');
      setUploadingResource(false);
      alert('No class selected. Please reload the page.');
      return;
    }
    setUploadingResource(true);
    let fileUrl = '';
    let type = resourceType;
    console.log('Before file upload, resourceType:', resourceType);
    if (resourceType === 'file' && resourceFile) {
      console.log('Uploading file:', resourceFile);
      const ext = resourceFile.name.split('.').pop();
      const filePath = `${id}/${Date.now()}_${resourceFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('class-resources')
        .upload(filePath, resourceFile);
      if (uploadError) {
        setUploadingResource(false);
        alert('File upload failed: ' + uploadError.message);
        console.log('File upload error:', uploadError);
        return;
      }
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('class-resources')
        .getPublicUrl(filePath);
      fileUrl = publicUrlData.publicUrl;
      type = ext?.toLowerCase() === 'pdf' ? 'pdf' : ['jpg','jpeg','png','gif','webp','bmp'].includes(ext?.toLowerCase() || '') ? 'image' : 'file';
      console.log('File uploaded, fileUrl:', fileUrl, 'type:', type);
    }
    const insertObj = {
      class_id: id,
      title: resourceTitle,
      url: resourceType === 'link' ? resourceUrl : null,
      file_url: resourceType === 'file' ? fileUrl : null,
      type,
      uploaded_by: user.id
    };
    console.log('Uploading resource as user:', user?.id, insertObj);
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

  // Add this useEffect to log when the resource upload form is rendered
  React.useEffect(() => {
    if (role === 'teacher' && tab === 'Resources') {
      console.log('Resource upload form rendered');
    }
  }, [role, tab]);

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
        console.log("Uploading to bucket: assignments, path:", filePath);
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
      const { data: assignmentData, error: fetchError } = await supabase
        .from('assignments')
        .select('*')
        .eq('class_id', id);
      if (fetchError) {
        console.error('Fetch assignments error:', fetchError);
      }
      setAssignments(assignmentData || []);
    } catch (err: any) {
      setAssignmentError('Failed to create assignment: ' + (err.message || err));
      console.error('Assignment creation error:', err);
      alert('Error: ' + (err.message || JSON.stringify(err, null, 2)));
    } finally {
      setPostingAssignment(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="loading-spinner w-12 h-12" />
        <p className="text-gray-500 text-sm mt-4">Loading class dashboard...</p>
      </div>
    );
  }

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow text-center border border-gray-200">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">You must be a teacher to access this dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-800">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-600 mb-2">{classInfo?.name || 'Class'}</h1>
        <div className="mb-4 text-gray-600 text-sm">Class Code: <span className="font-mono text-blue-600 select-all">{classInfo?.id}</span></div>
        <div className="mb-6 flex gap-4 flex-wrap">
          {TABS.map(t => (
            <button
              key={t}
              className={`px-4 py-2 rounded ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'} font-semibold transition-colors shadow-sm`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'Overview' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 mb-6 shadow-sm">
            <div className="mb-2 text-lg font-semibold text-blue-600">Class Overview</div>
            <div className="text-gray-700">Students: {students.length}</div>
            <div className="text-gray-700">Resources: {resources.length}</div>
            <div className="text-gray-700">Assignments: {assignments.length}</div>
            <div className="text-gray-700">Announcements: {announcements.length}</div>
          </div>
        )}

        {/* Student Responses Tab */}
        {tab === 'Student Responses' && (
          <div className="space-y-6">
            {attemptsLoading && (
              <div className="text-blue-600">Loading student responses...</div>
            )}
            {attemptsError && (
              <div className="text-red-600">{attemptsError}</div>
            )}
            {!attemptsLoading && !attemptsError && (
              <>
                {(() => {
                  // Build assignment map and group attempts by mock test
                  const assignmentMap = new Map<string, any>((assignments || []).map((a: any) => [a.id, a]));
                  // Groups for mock tests only
                  const mockAssignments = (assignments || []).filter((a: any) => a?.is_mock);
                  const groups = mockAssignments
                    .map((assn: any) => ({
                      assignment: assn,
                      attempts: (attempts || []).filter((at: any) => at.assignment_id === assn.id)
                    }))
                    .filter(g => g.attempts.length > 0);
                  // Other or ungrouped attempts
                  const otherAttempts = (attempts || []).filter((at: any) => {
                    const assn = assignmentMap.get(at.assignment_id);
                    return !assn || !assn.is_mock;
                  });

                  if (groups.length === 0 && otherAttempts.length === 0) {
                    return <div className="text-gray-500">No student responses found yet.</div>;
                  }

                  return (
                    <div className="space-y-8">
                      {groups.map((g) => (
                        <div key={g.assignment.id} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-blue-700">
                              {g.assignment.title}
                            </h3>
                            <div className="text-xs text-gray-500">
                              {g.assignment.created_at ? new Date(g.assignment.created_at).toLocaleString() : ''}
                              {g.assignment.expires_at && (
                                <span className="ml-2 text-red-600">(Expires: {new Date(g.assignment.expires_at).toLocaleString()})</span>
                              )}
                            </div>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-left text-gray-700">
                                  <th className="px-3 py-2">Date</th>
                                  <th className="px-3 py-2">Student</th>
                                  <th className="px-3 py-2">Score</th>
                                  <th className="px-3 py-2">Questions</th>
                                  <th className="px-3 py-2">Sheet</th>
                                  <th className="px-3 py-2">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.attempts.map((a: any, i: number) => {
                                  const prof = attemptProfiles[a.user_id] || {};
                                  const name = prof.full_name || prof.email || a.user_id;
                                  return (
                                    <tr key={a.id || i} className="border-t border-gray-200">
                                      <td className="px-3 py-2">{a.exam_date ? new Date(a.exam_date).toLocaleString() : '-'}</td>
                                      <td className="px-3 py-2">{name}</td>
                                      <td className="px-3 py-2">{a.total_score} / {a.max_score}</td>
                                      <td className="px-3 py-2">{a.questions_count || '-'}</td>
                                      <td className="px-3 py-2">
                                        {a.answer_sheet_url ? (
                                          <a href={a.answer_sheet_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
                                        ) : (
                                          <span className="text-gray-400">—</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2">
                                        <button
                                          className="inline-flex items-center gap-2 bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-900"
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

                      {otherAttempts.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-lg font-bold text-gray-700">Other / Ungrouped Submissions</h3>
                          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-left text-gray-700">
                                  <th className="px-3 py-2">Date</th>
                                  <th className="px-3 py-2">Student</th>
                                  <th className="px-3 py-2">Score</th>
                                  <th className="px-3 py-2">Questions</th>
                                  <th className="px-3 py-2">Sheet</th>
                                  <th className="px-3 py-2">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {otherAttempts.map((a: any, i: number) => {
                                  const prof = attemptProfiles[a.user_id] || {};
                                  const name = prof.full_name || prof.email || a.user_id;
                                  return (
                                    <tr key={a.id || i} className="border-t border-gray-200">
                                      <td className="px-3 py-2">{a.exam_date ? new Date(a.exam_date).toLocaleString() : '-'}</td>
                                      <td className="px-3 py-2">{name}</td>
                                      <td className="px-3 py-2">{a.total_score} / {a.max_score}</td>
                                      <td className="px-3 py-2">{a.questions_count || '-'}</td>
                                      <td className="px-3 py-2">
                                        {a.answer_sheet_url ? (
                                          <a href={a.answer_sheet_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
                                        ) : (
                                          <span className="text-gray-400">—</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2">
                                        <button
                                          className="inline-flex items-center gap-2 bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-900"
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
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {/* Attempt Details Modal */}
            {showAttemptModal && attemptModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 max-w-3xl w-full relative">
                  <button
                    className="absolute top-3 right-4 text-gray-500 hover:text-gray-800 text-2xl"
                    onClick={() => { setShowAttemptModal(false); setAttemptModal(null); }}
                    aria-label="Close"
                  >
                    &times;
                  </button>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">Student Response</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div><span className="font-semibold text-gray-700">Student:</span> {attemptProfiles[attemptModal.user_id]?.full_name || attemptProfiles[attemptModal.user_id]?.email || attemptModal.user_id}</div>
                    <div><span className="font-semibold text-gray-700">Date:</span> {attemptModal.exam_date ? new Date(attemptModal.exam_date).toLocaleString() : '-'}</div>
                    <div><span className="font-semibold text-gray-700">Score:</span> {attemptModal.total_score} / {attemptModal.max_score}</div>
                    <div><span className="font-semibold text-gray-700">Questions:</span> {attemptModal.questions_count || '-'}</div>
                  </div>

                  {attemptModal.student_weaknesses && (
                    <div className="mb-4">
                      <div className="font-semibold text-gray-800 mb-1">Weaknesses (summary)</div>
                      <div className="text-gray-700 whitespace-pre-wrap">{attemptModal.student_weaknesses}</div>
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="font-semibold text-gray-800 mb-2">Per-question Feedback</div>
                    {(() => {
                      const items = parseAttemptFeedback(attemptModal.ai_feedback);
                      if (!items || items.length === 0) return <div className="text-gray-500">No structured feedback available.</div>;
                      return (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs border border-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-2 py-1 text-left">Q#</th>
                                <th className="px-2 py-1 text-left">Marks</th>
                                <th className="px-2 py-1 text-left">Feedback</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((q: any, idx: number) => (
                                <tr key={idx} className="border-t">
                                  <td className="px-2 py-1 font-semibold">{q.question_number || idx + 1}</td>
                                  <td className="px-2 py-1">{q.marks_awarded} / {q.max_marks}</td>
                                  <td className="px-2 py-1 whitespace-pre-wrap">{q.feedback || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>

                  {attemptModal.answers_text && (
                    <div className="mb-2">
                      <div className="font-semibold text-gray-800 mb-1">Extracted Answers (OCR)</div>
                      <div className="max-h-56 overflow-auto whitespace-pre-wrap text-gray-700 bg-gray-50 p-2 rounded border border-gray-200 text-xs">
                        {attemptModal.answers_text}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 text-right">
                    <button
                      className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900"
                      onClick={() => { setShowAttemptModal(false); setAttemptModal(null); }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Daily Log & Mock Test Tab */}
        {tab === 'Daily Log & Mock Test' && (
          <div className="space-y-4">
            <form onSubmit={handleGenerateDailyMockTest} className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h3 className="font-bold mb-2 text-blue-600">Daily Log & Generate Mock Test</h3>
              {mockGenError && <p className="text-red-500 mb-2">{mockGenError}</p>}
              {mockSuccessMsg && <p className="text-green-600 mb-2">{mockSuccessMsg}</p>}
              <label className="block text-sm font-medium text-gray-700 mb-1">What did you teach today?</label>
              <textarea
                placeholder="e.g., Class 10 Science – Chemical Reactions: types (combination, decomposition), examples, equations balancing..."
                value={dailyTopics}
                onChange={e => setDailyTopics(e.target.value)}
                className="w-full p-2 mb-3 border rounded bg-gray-50 text-gray-800 border-gray-300"
                required
              />
              <div className="flex items-center gap-4 mb-3">
                <label className="text-sm text-gray-700">Number of questions</label>
                <input
                  type="number"
                  min={4}
                  max={20}
                  value={mockQuestionCount}
                  onChange={e => setMockQuestionCount(parseInt(e.target.value || '8'))}
                  className="w-24 p-2 border rounded bg-gray-50 text-gray-800 border-gray-300"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                disabled={generatingMock}
              >
                {generatingMock ? 'Generating…' : 'Generate Mock Test & Notify Students'}
              </button>
            </form>

            {mockPreview && (
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="font-semibold text-gray-800 mb-2">Preview</div>
                <pre className="whitespace-pre-wrap text-gray-700 text-sm">{mockPreview}</pre>
              </div>
            )}
          </div>
        )}

        {/* Students Tab */}
        {tab === 'Students' && (
          <div className="space-y-4">
            {students.length === 0 ? (
              <div className="text-gray-500">No students in this class yet.</div>
            ) : (
              students.map((s, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-blue-600">{s.full_name}</div>
                    <div className="text-sm text-gray-500">{s.email}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Resources Tab */}
        {tab === 'Resources' && (
          <div className="space-y-4">
            {/* Teacher upload form */}
            {role === 'teacher' && (
              <form onSubmit={handleResourceUpload} className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="mb-2 font-semibold text-gray-700">Upload/Share Resource</div>
                <input
                  className="w-full p-2 mb-2 rounded bg-gray-50 text-gray-800 border border-gray-300"
                  placeholder="Title"
                  value={resourceTitle || ''}
                  onChange={e => setResourceTitle(e.target.value)}
                  required
                />
                <select
                  className="w-full p-2 mb-2 rounded bg-gray-50 text-gray-800 border border-gray-300"
                  value={resourceType || 'link'}
                  onChange={e => setResourceType(e.target.value)}
                >
                  <option value="link">Link</option>
                  <option value="file">File Upload</option>
                </select>
                {resourceType === 'link' ? (
                  <input
                    className="w-full p-2 mb-2 rounded bg-gray-50 text-gray-800 border border-gray-300"
                    placeholder="Paste link here"
                    value={resourceUrl || ''}
                    onChange={e => setResourceUrl(e.target.value)}
                    required
                  />
                ) : (
                  <input
                    type="file"
                    className="w-full p-2 mb-2 rounded bg-gray-50 text-gray-800 border border-gray-300"
                    accept="*"
                    onChange={e => setResourceFile(e.target.files?.[0] || null)}
                    required
                  />
                )}
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                  disabled={uploadingResource}
                  onClick={() => { console.log('Resource upload button clicked'); }}
                >
                  {uploadingResource ? 'Uploading...' : 'Add Resource'}
                </button>
              </form>
            )}
            {resources.length === 0 ? (
              <div className="text-gray-500">No resources yet.</div>
            ) : (
              resources.map(r => (
                <div key={r.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-blue-600">{r.title}</div>
                    <div className="text-sm text-gray-600">
                      {r.type === 'link' && <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline text-blue-500">{r.url}</a>}
                      {r.type === 'pdf' && <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="underline text-blue-500">PDF File</a>}
                      {r.type === 'image' && <a href={r.file_url} target="_blank" rel="noopener noreferrer"><img src={r.file_url} alt={r.title} className="max-h-32 rounded mt-2" /></a>}
                      {r.type === 'file' && <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="underline text-blue-500">Download File</a>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2 md:mt-0">{r.file_url ? r.file_url.split('/').pop() : ''}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Announcements Tab */}
        {tab === 'Announcements' && (
          <div className="space-y-4">
            {role === 'teacher' && (
              <form onSubmit={handlePostAnnouncement} className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                <h3 className="font-bold mb-2 text-blue-600">Post New Announcement</h3>
                {announcementError && <p className="text-red-500 mb-2">{announcementError}</p>}
                <textarea
                  placeholder="Type your announcement..."
                  value={announcementContent}
                  onChange={e => setAnnouncementContent(e.target.value)}
                  required
                  className="w-full p-2 mb-2 border rounded bg-gray-50 text-gray-800 border-gray-300"
                />
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                  disabled={postingAnnouncement}
                >
                  {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
                </button>
              </form>
            )}
            {announcements.length === 0 ? (
              <div className="text-gray-500">No announcements yet.</div>
            ) : (
              announcements.map(a => (
                <div key={a.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="text-gray-700">{a.message}</div>
                  <div className="text-xs text-gray-500 mt-2">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Assignments Tab */}
        {tab === 'Assignments' && (
          <div className="space-y-4">
            {role === 'teacher' && (
              <form onSubmit={handlePostAssignment} className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                <h3 className="font-bold mb-2 text-blue-600">Create New Assignment</h3>
                {assignmentError && <p className="text-red-500 mb-2">{assignmentError}</p>}
                <input
                  type="text"
                  placeholder="Title"
                  value={assignmentTitle}
                  onChange={e => setAssignmentTitle(e.target.value)}
                  required
                  className="w-full p-2 mb-2 border rounded bg-gray-50 text-gray-800 border-gray-300"
                />
                <textarea
                  placeholder="Description"
                  value={assignmentDesc}
                  onChange={e => setAssignmentDesc(e.target.value)}
                  className="w-full p-2 mb-2 border rounded bg-gray-50 text-gray-800 border-gray-300"
                />
                <input
                  type="date"
                  value={assignmentDueDate}
                  onChange={e => setAssignmentDueDate(e.target.value)}
                  className="w-full p-2 mb-2 border rounded bg-gray-50 text-gray-800 border-gray-300"
                />
                <input
                  type="file"
                  onChange={e => setAssignmentFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full p-2 mb-2 border rounded bg-gray-50 text-gray-800 border-gray-300"
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                  disabled={postingAssignment}
                >
                  {postingAssignment ? 'Posting...' : 'Add Assignment'}
                </button>
              </form>
            )}
            {assignments.length === 0 ? (
              <div className="text-gray-500">No assignments yet.</div>
            ) : (
              assignments.map(a => (
                <div key={a.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="font-semibold text-blue-600">{a.title}</div>
                  <div className="text-gray-700 mb-2">{a.description}</div>
                  {a.due_date && <div className="text-xs text-orange-500">Due: {new Date(a.due_date).toLocaleDateString()}</div>}
                  {a.is_mock && a.expires_at && (
                    <div className="text-xs text-red-600">Expires: {new Date(a.expires_at).toLocaleString()}</div>
                  )}
                  {/* Show image preview if file_url is an image, else show download link */}
                  {a.file_url && (
                    a.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ? (
                      <img
                        src={a.file_url}
                        alt={a.title}
                        className="max-h-48 rounded mt-2"
                        style={{ maxWidth: '100%' }}
                      />
                    ) : (
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        Download File
                      </a>
                    )
                  )}
                  <div className="text-xs text-gray-500 mt-2">{new Date(a.created_at).toLocaleString()}</div>
                  {role === 'teacher' && (
                    <div className="mt-3 flex gap-3">
                      <button
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                        onClick={() => handleDeleteAssignment(a)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {tab === 'Analytics' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="mb-2 text-lg font-semibold text-blue-600">Class Analytics</div>
            <div className="text-gray-700">Students: {students.length}</div>
            <div className="text-gray-700">Resources: {resources.length}</div>
            <div className="text-gray-700">Assignments: {assignments.length}</div>
            <div className="text-gray-700">Announcements: {announcements.length}</div>
            {/* Add more analytics as needed */}
          </div>
        )}

        {/* AI Insights Tab */}
        {tab === 'AI Insights' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="mb-2 text-lg font-semibold text-blue-600">AI Insights</div>
            {aiLoading ? (
              <div className="text-gray-500">Generating insights...</div>
            ) : (
              <div className="text-gray-700 whitespace-pre-line">{aiSummary}</div>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {tab === 'Notifications' && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-blue-600 flex items-center gap-2 mb-2"><Bell className="w-6 h-6" /> Notifications</h2>
            {loadingNotifications ? (
              <div className="text-blue-600">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="text-gray-500">No notifications yet.</div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif, i) => (
                  <div
                    key={notif.id || i}
                    className={`p-4 rounded-lg border ${notif.is_read ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-blue-300 bg-blue-50'} transition-all cursor-pointer shadow-sm`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800 mb-1">{notif.title}</div>
                        <div className="text-gray-600 mb-1">{notif.message}</div>
                        <div className="text-xs text-gray-500">{notif.created_at ? new Date(notif.created_at).toLocaleString() : ''}</div>
                      </div>
                      <button
                        className="p-1 rounded hover:bg-red-100 text-red-600"
                        title="Delete notification"
                        onClick={(e) => { e.stopPropagation(); handleDeleteNotification(notif.id); }}
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Modal for weaknesses */}
            {showNotifModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-8 max-w-2xl w-full relative">
                  <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl" onClick={() => setShowNotifModal(false)}>&times;</button>
                  <h3 className="text-xl font-bold text-blue-600 mb-2">{notifModalTitle}</h3>
                  <div className="mb-4 text-gray-800 prose max-w-none" dangerouslySetInnerHTML={{ __html: marked(notifModalContent) as string }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherClassDashboard;