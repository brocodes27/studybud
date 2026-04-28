import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Bell, XCircle, Eye, Trash2, Upload, FileText, Link as LinkIcon, BarChart2, Brain, Users, BookOpen, AlertCircle, Loader2, Download, Clock, Sparkles, GraduationCap, CheckCircle2, CalendarCheck } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const TABS = ['Class Workflow', 'Attendance', 'Students', 'Assignments', 'Resources', 'Strengths & Weaknesses'];

const TeacherClassDashboard: React.FC = () => {
  const { id } = useParams();
  const { user, role, loading } = useAuth() as any;
  const [classInfo, setClassInfo] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [tab, setTab] = useState('Class Workflow');
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
  const [homeworkEnabled, setHomeworkEnabled] = useState(false);
  const [homeworkType, setHomeworkType] = useState<'practice' | 'prove-it' | 'reading' | 'worksheet'>('practice');
  const [sessionDuration, setSessionDuration] = useState(60);
  const [loggingSession, setLoggingSession] = useState(false);
  const [sessionLogError, setSessionLogError] = useState('');
  const [sessionLogSuccess, setSessionLogSuccess] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, string>>({});
  const [attendanceNotes, setAttendanceNotes] = useState<Record<string, string>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const [attendanceError, setAttendanceError] = useState('');

  const setAllAttendance = (status: string) => {
    const next: Record<string, string> = {};
    students.forEach((student: any) => {
      next[student.id] = status;
    });
    setAttendanceStatus(next);
  };

  const fetchAttendanceForDate = async () => {
    if (!id || students.length === 0) return;
    setAttendanceLoading(true);
    setAttendanceError('');
    setAttendanceMessage('');
    try {
      const { data: sessionRow, error: sessionError } = await supabase
        .from('class_attendance_sessions')
        .select('id')
        .eq('class_id', id)
        .eq('session_date', attendanceDate)
        .maybeSingle();
      if (sessionError) throw sessionError;

      if (!sessionRow?.id) {
        setAllAttendance('present');
        setAttendanceNotes({});
        return;
      }

      const { data: records, error: recordsError } = await supabase
        .from('class_attendance_records')
        .select('student_id, status, notes')
        .eq('attendance_session_id', sessionRow.id);
      if (recordsError) throw recordsError;

      const statusMap: Record<string, string> = {};
      const notesMap: Record<string, string> = {};
      students.forEach((student: any) => {
        statusMap[student.id] = 'present';
      });
      (records || []).forEach((record: any) => {
        statusMap[record.student_id] = record.status || 'present';
        notesMap[record.student_id] = record.notes || '';
      });
      setAttendanceStatus(statusMap);
      setAttendanceNotes(notesMap);
    } catch (err: any) {
      setAttendanceError(err?.message || 'Failed to load attendance.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!user || !id) return;
    if (students.length === 0) {
      setAttendanceError('No students enrolled in this class.');
      return;
    }
    setAttendanceSaving(true);
    setAttendanceError('');
    setAttendanceMessage('');
    try {
      const { data: sessionRow, error: sessionError } = await supabase
        .from('class_attendance_sessions')
        .upsert({
          class_id: id,
          teacher_id: user.id,
          session_date: attendanceDate,
          subject: sessionSubject,
          topics_covered: sessionTopics.split(',').map(t => t.trim()).filter(Boolean),
          duration_minutes: sessionDuration,
        }, { onConflict: 'class_id,session_date' })
        .select('id')
        .single();
      if (sessionError) throw sessionError;

      const rows = students.map((student: any) => ({
        attendance_session_id: sessionRow.id,
        class_id: id,
        student_id: student.id,
        status: attendanceStatus[student.id] || 'present',
        notes: attendanceNotes[student.id] || null,
        marked_by: user.id,
      }));

      const { error: recordsError } = await supabase
        .from('class_attendance_records')
        .upsert(rows, { onConflict: 'attendance_session_id,student_id' });
      if (recordsError) throw recordsError;

      await Promise.all(students.map((student: any) => supabase.rpc('refresh_student_attendance_profile', { p_student_id: student.id })));
      setAttendanceMessage('Attendance saved. Ranjan Sir will use this signal for catch-up and risk analysis.');
    } catch (err: any) {
      setAttendanceError(err?.message || 'Failed to save attendance.');
    } finally {
      setAttendanceSaving(false);
    }
  };

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
      const { data: members } = await supabase.from('class_members').select('user_id').eq('class_id', id);
      const studentIds = (members || []).map((m: any) => m.user_id).filter(Boolean);
      if (studentIds.length === 0) {
        setSessionLogError('No students enrolled in this class.');
        setLoggingSession(false);
        return;
      }
      const { data: roadmaps } = await supabase
        .from('student_roadmaps')
        .select('id, user_id')
        .in('user_id', studentIds)
        .eq('scope', 'school')
        .eq('class_id', id)
        .eq('is_active', true);
      const roadmapRows = (roadmaps || []).map((r: any) => ({
        roadmap_id: r.id,
        class_id: id,
        teacher_id: user.id,
        session_date: new Date().toISOString().split('T')[0],
        subject: sessionSubject,
        topics_covered: topicsArray,
        homework_assigned: sessionHomework || null,
        duration_minutes: sessionDuration,
      }));
      if (roadmapRows.length === 0) {
        const noTemplate = !classInfo?.template_id && !classInfo?.custom_curriculum;
        setSessionLogError(
          noTemplate
            ? 'Students in this class have no study roadmap. Link a coaching template in the Curriculum tab first.'
            : 'Some students have not received a study roadmap. Ask them to complete onboarding or re-join the class.'
        );
        setLoggingSession(false);
        return;
      }

      if (homeworkEnabled && sessionHomework.trim()) {
        const due = new Date();
        due.setDate(due.getDate() + 1);
        const homeworkTitle = homeworkType === 'prove-it'
          ? `Prove-It Homework: ${topicsArray[0] || sessionSubject}`
          : `${sessionSubject} Homework: ${topicsArray[0] || 'Class Practice'}`;
        const homeworkDescription = [
          `Teacher-assigned homework from today's class.`,
          `Type: ${homeworkType.replace('-', ' ')}`,
          `Topics taught: ${topicsArray.join(', ')}`,
          '',
          sessionHomework.trim(),
        ].join('\n');
        const { error: homeworkError } = await supabase.from('assignments').insert({
          class_id: id,
          title: homeworkTitle,
          description: homeworkDescription,
          due_date: due.toISOString(),
          file_url: null,
        });
        if (homeworkError) throw homeworkError;
      }

      const { error } = await supabase.rpc('log_class_sessions', {
        p_rows: roadmapRows,
      });
      if (error) throw error;
      setSessionLogSuccess(homeworkEnabled && sessionHomework.trim()
        ? `Class logged and homework assigned to ${roadmapRows.length} student${roadmapRows.length > 1 ? 's' : ''}. Homework will appear before AI tasks.`
        : `Class logged for ${roadmapRows.length} student${roadmapRows.length > 1 ? 's' : ''}. AI tasks will adapt to today's lesson.`
      );
      setSessionTopics('');
      setSessionHomework('');
      setHomeworkEnabled(false);

      const { data: assignmentData } = await supabase
        .from('assignments')
        .select('*')
        .eq('class_id', id)
        .order('created_at', { ascending: false });
      setAssignments(assignmentData || []);
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
  const [behaviorProfiles, setBehaviorProfiles] = useState<Record<string, any>>({});
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
        const { data: members } = await supabase.from('class_members').select('user_id').eq('class_id', id);
        const studentIds = (members || []).map((m: any) => m.user_id).filter(Boolean);
        if (studentIds.length > 0) {
          const { data: roadmaps } = await supabase
            .from('student_roadmaps')
            .select('id, user_id')
            .in('user_id', studentIds);
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
            await supabase.rpc('log_class_sessions', { p_rows: roadmapRows });
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

  // Fetch student response data for strengths and weaknesses
  useEffect(() => {
    const fetchAttempts = async () => {
      if (tab !== 'Strengths & Weaknesses' || !user || !id) return;
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
          setBehaviorProfiles({});
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
        const { data: behaviorData, error: behaviorErr } = await supabase
          .from('student_behavioral_profiles')
          .select('*')
          .in('user_id', userIds);
        if (behaviorErr) console.error('Error fetching behavioral profiles:', behaviorErr);
        if (Array.isArray(behaviorData)) {
          const map: Record<string, any> = {};
          behaviorData.forEach((p: any) => { map[p.user_id] = p; });
          setBehaviorProfiles(map);
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

  useEffect(() => {
    if (tab === 'Attendance') fetchAttendanceForDate();
  }, [tab, attendanceDate, students.length]);

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
    <div className="min-h-screen bg-[#FAF8F5] pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-8 pb-8 border-b border-[#E8E4DF]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <div className="bg-[#8B7355]/10 p-3 rounded-2xl">
                  <BookOpen className="h-8 w-8 text-[#8B7355] stroke-[2.5px]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#2D2A26]">{classInfo?.name || 'Class'}</h1>
                  <p className="text-sm text-[#8A8279] mt-0.5">{classInfo?.subject || 'No subject set'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-1 flex-wrap">
                {classInfo?.class_code && (
                  <div className="flex items-center gap-1.5 bg-[#F5F0E8] rounded-lg px-2.5 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#8A8279]">Code:</span>
                    <code className="text-xs font-mono font-bold text-[#2D2A26]">{classInfo.class_code}</code>
                  </div>
                )}
                {classInfo?.invite_link && (
                  <div className="flex items-center gap-1.5 bg-[#F5F0E8] rounded-lg px-2.5 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#8A8279]">Invite:</span>
                    <code className="text-xs font-mono font-bold text-[#2D2A26] truncate max-w-[140px]">{window.location.origin}/join/{classInfo.invite_link}</code>
                  </div>
                )}
                {classInfo?.curriculum_source === 'template' && (
                  <span className="text-[10px] font-bold bg-[#8B7355]/10 text-[#8B7355] px-2 py-1 rounded-md">Template Linked</span>
                )}
                {classInfo?.curriculum_source === 'upload' && (
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md">Custom Curriculum</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-[#E8E4DF] shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-[#2D2A26]">Active</span>
            </div>
          </div>
        </div>

        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-max px-1">
            {TABS.map(t => (
              <button
                key={t}
                className={`px-4 py-2.5 font-bold text-sm rounded-[14px] transition-all whitespace-nowrap ${tab === t
                  ? 'bg-[#2D2A26] text-white shadow-sm'
                  : 'bg-white text-[#8A8279] border border-[#E8E4DF] hover:text-[#2D2A26] hover:shadow-sm'
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
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#2D2A26] mb-5 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                Class Overview
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#F5F0E8] rounded-xl p-5">
                  <p className="text-xs font-bold text-[#8A8279] uppercase tracking-wide mb-1">Students</p>
                  <p className="text-3xl font-bold text-[#2D2A26]">{students.length}</p>
                </div>
                <div className="bg-[#F5F0E8] rounded-xl p-5">
                  <p className="text-xs font-bold text-[#8A8279] uppercase tracking-wide mb-1">Resources</p>
                  <p className="text-3xl font-bold text-[#2D2A26]">{resources.length}</p>
                </div>
                <div className="bg-[#F5F0E8] rounded-xl p-5">
                  <p className="text-xs font-bold text-[#8A8279] uppercase tracking-wide mb-1">Assignments</p>
                  <p className="text-3xl font-bold text-[#2D2A26]">{assignments.length}</p>
                </div>
                <div className="bg-[#F5F0E8] rounded-xl p-5">
                  <p className="text-xs font-bold text-[#8A8279] uppercase tracking-wide mb-1">Announcements</p>
                  <p className="text-3xl font-bold text-[#2D2A26]">{announcements.length}</p>
                </div>
              </div>
            </div>

            {/* Curriculum Info Card */}
            <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#2D2A26] mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                Curriculum
              </h2>
              {classInfo?.curriculum_source === 'template' ? (
                <div className="flex items-center gap-3 bg-[#8B7355]/5 rounded-xl p-4">
                  <div className="w-10 h-10 bg-[#8B7355]/10 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-[#8B7355]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#2D2A26]">Linked to Coaching Template</p>
                    <p className="text-xs text-[#8A8279]">Students joining this class will automatically receive the linked roadmap.</p>
                  </div>
                </div>
              ) : classInfo?.curriculum_source === 'upload' ? (
                <div className="flex items-center gap-3 bg-emerald-50 rounded-xl p-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#2D2A26]">Custom Curriculum Uploaded</p>
                    <p className="text-xs text-[#8A8279]">A custom curriculum is attached to this class.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-[#F8FAFF] rounded-xl p-4">
                  <div className="w-10 h-10 bg-[#E8E4DF] rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-[#8A8279]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#2D2A26]">No Curriculum Linked</p>
                    <p className="text-xs text-[#8A8279]">Link a template or upload a curriculum so students get a roadmap on join.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {tab === 'Attendance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-start gap-4">
                  <div className="bg-[#8B7355]/10 p-3 rounded-2xl">
                    <CalendarCheck className="h-6 w-6 text-[#8B7355] stroke-[2.5px]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#2D2A26]">Class Attendance</h2>
                    <p className="text-sm text-[#8A8279] mt-1">Mark attendance so Ranjan Sir can adapt catch-up tasks and risk analysis.</p>
                  </div>
                </div>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-bold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Subject</label>
                  <select
                    value={sessionSubject}
                    onChange={(e) => setSessionSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20"
                  >
                    {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Duration</label>
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Topics covered</label>
                  <input
                    type="text"
                    value={sessionTopics}
                    onChange={(e) => setSessionTopics(e.target.value)}
                    placeholder="Kinematics, graphs..."
                    className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 placeholder:text-[#8A8279]/50"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {['present', 'absent', 'late', 'excused'].map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setAllAttendance(status)}
                    className="px-4 py-2 rounded-xl bg-[#F5F0E8] text-[#2D2A26] font-bold text-sm hover:bg-[#2D2A26] hover:text-white transition-colors capitalize"
                  >
                    Mark all {status}
                  </button>
                ))}
              </div>

              {attendanceLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#8B7355]" />
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#E8E4DF] bg-[#F8FAFF] rounded-xl">
                  <p className="font-bold text-[#8A8279]">No students enrolled yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {students.map((student: any) => (
                    <div key={student.id} className="grid grid-cols-1 lg:grid-cols-[1fr_220px_1fr] gap-3 items-center bg-[#F8FAFF] border border-[#E8E4DF] rounded-2xl p-4">
                      <div>
                        <p className="font-bold text-[#2D2A26]">{student.full_name || 'Unnamed Student'}</p>
                        <p className="text-xs font-medium text-[#8A8279]">{student.email}</p>
                      </div>
                      <select
                        value={attendanceStatus[student.id] || 'present'}
                        onChange={(e) => setAttendanceStatus(prev => ({ ...prev, [student.id]: e.target.value }))}
                        className="px-4 py-3 bg-white rounded-[14px] border border-[#E8E4DF] font-bold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 capitalize"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="excused">Excused</option>
                        <option value="left_early">Left early</option>
                      </select>
                      <input
                        type="text"
                        value={attendanceNotes[student.id] || ''}
                        onChange={(e) => setAttendanceNotes(prev => ({ ...prev, [student.id]: e.target.value }))}
                        placeholder="Optional note"
                        className="px-4 py-3 bg-white rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 placeholder:text-[#8A8279]/50"
                      />
                    </div>
                  ))}
                </div>
              )}

              {attendanceError && <div className="mt-6 bg-red-50 border border-red-100 text-red-600 font-bold p-4 rounded-xl">{attendanceError}</div>}
              {attendanceMessage && <div className="mt-6 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold p-4 rounded-xl flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />{attendanceMessage}</div>}
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={attendanceSaving || students.length === 0}
                className="mt-6 bg-[#2D2A26] text-white px-6 py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
              >
                {attendanceSaving ? <><Loader2 className="h-5 w-5 animate-spin stroke-[2.5px]" />Saving...</> : <><CalendarCheck className="h-5 w-5 stroke-[2.5px]" />Save Attendance</>}
              </button>
            </div>
          </div>
        )}

        {/* Students Tab */}
        {tab === 'Students' && (
          <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#2D2A26] mb-5 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
              Enrolled Students
            </h3>
            {students.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#E8E4DF] bg-[#F8FAFF] rounded-xl">
                <p className="font-bold text-[#8A8279]">No students enrolled yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-[#F5F0E8] text-[#8A8279] text-xs font-bold uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 rounded-l-xl">Student</th>
                      <th className="px-4 py-3 rounded-r-xl">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DF] font-medium">
                    {students.map((s: any) => (
                      <tr key={s.id} className="hover:bg-[#F8FAFF] transition-colors">
                        <td className="px-4 py-4 text-[#2D2A26] font-bold">{s.full_name || 'Unnamed Student'}</td>
                        <td className="px-4 py-4 text-[#8A8279] text-sm">{s.email}</td>
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
            <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#2D2A26] mb-5 flex items-center gap-2">
                <Upload className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                Upload Resource
              </h3>
              <form onSubmit={handleResourceUpload} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Resource Title</label>
                  <input
                    type="text"
                    placeholder="Example: Chapter 5 notes"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50"
                    required
                  />
                </div>

                <div className="flex gap-2 bg-[#F8FAFF] p-1 rounded-[14px]">
                  <label className={`flex-1 text-center py-2 rounded-xl text-sm font-bold cursor-pointer transition-all ${resourceType === 'link' ? 'bg-white text-[#8B7355] shadow-sm' : 'text-[#8A8279]'}`}>
                    <input
                      type="radio"
                      name="resourceType"
                      value="link"
                      checked={resourceType === 'link'}
                      onChange={() => setResourceType('link')}
                      className="hidden"
                    />
                    Link
                  </label>
                  <label className={`flex-1 text-center py-2 rounded-xl text-sm font-bold cursor-pointer transition-all ${resourceType === 'file' ? 'bg-white text-[#8B7355] shadow-sm' : 'text-[#8A8279]'}`}>
                    <input
                      type="radio"
                      name="resourceType"
                      value="file"
                      checked={resourceType === 'file'}
                      onChange={() => setResourceType('file')}
                      className="hidden"
                    />
                    File Upload
                  </label>
                </div>

                {resourceType === 'link' ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={resourceUrl}
                      onChange={(e) => setResourceUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Attach File</label>
                    <input
                      type="file"
                      onChange={(e) => setResourceFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:bg-white file:text-[#8B7355]"
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploadingResource}
                  className="bg-[#2D2A26] text-white px-6 py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
                >
                  {uploadingResource ? 'Uploading...' : 'Upload Resource'}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#2D2A26] mb-5 flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                Class Resources
              </h3>
              {resources.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#E8E4DF] bg-[#F8FAFF] rounded-xl">
                  <p className="font-bold text-[#8A8279]">No resources uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {resources.map((r: any) => (
                    <div key={r.id} className="bg-[#F8FAFF] rounded-xl p-4 border border-[#E8E4DF] flex items-center justify-between group">
                      <div>
                        <h4 className="font-bold text-[#2D2A26] leading-tight">{r.title}</h4>
                        <p className="text-xs font-medium text-[#8A8279] mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <a
                        href={r.url || r.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white p-2.5 rounded-lg text-[#8B7355] hover:bg-[#8B7355] hover:text-white transition-colors"
                      >
                        <LinkIcon className="h-5 w-5 stroke-[2.5px]" />
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
            <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#2D2A26] mb-5 flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                Broadcast Announcement
              </h3>
              <form onSubmit={handlePostAnnouncement} className="space-y-5">
                {announcementError && <div className="bg-red-50 border border-red-100 text-red-600 font-bold p-4 rounded-xl">{announcementError}</div>}
                <textarea
                  placeholder="Write a message to the entire class..."
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50 min-h-[140px]"
                  required
                />
                <button
                  type="submit"
                  disabled={postingAnnouncement}
                  className="bg-[#2D2A26] text-white px-6 py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
                >
                  {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {announcements.map((a: any) => (
                <div key={a.id} className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-5 shadow-sm">
                  <p className="text-[#2D2A26] font-medium whitespace-pre-wrap leading-relaxed">{a.message}</p>
                  <p className="text-xs font-bold text-[#8A8279] mt-4 border-t border-[#E8E4DF] pt-3">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              ))}
              {announcements.length === 0 && (
                <div className="text-center py-12 border border-dashed border-[#E8E4DF] bg-white rounded-2xl">
                  <p className="font-bold text-[#8A8279]">No announcements posted yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assignments Tab */}
        {tab === 'Assignments' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#2D2A26] mb-5 flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                Create Assignment
              </h3>
              <form onSubmit={handlePostAssignment} className="space-y-6">
                {assignmentError && <div className="bg-red-50 border border-red-100 text-red-600 font-bold p-4 rounded-xl">{assignmentError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAssignmentMode('prove-it')}
                    className={`p-3 rounded-[14px] font-bold text-sm transition-all ${assignmentMode === 'prove-it' ? 'bg-[#2D2A26] text-white shadow-sm' : 'bg-[#F8FAFF] text-[#8A8279] hover:text-[#2D2A26]'}`}
                  >
                    Assign Prove-It
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignmentMode('standard')}
                    className={`p-3 rounded-[14px] font-bold text-sm transition-all ${assignmentMode === 'standard' ? 'bg-[#2D2A26] text-white shadow-sm' : 'bg-[#F8FAFF] text-[#8A8279] hover:text-[#2D2A26]'}`}
                  >
                    Standard Task
                  </button>
                </div>
                {assignmentMode === 'prove-it' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F5F0E8] rounded-2xl p-4 border border-[#E8E4DF]">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Subject</label>
                      <select
                        value={proveItSubject}
                        onChange={(e) => setProveItSubject(e.target.value)}
                        className="w-full px-4 py-3 bg-white rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all"
                      >
                        <option>JEE Physics</option>
                        <option>JEE Chemistry</option>
                        <option>JEE Mathematics</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Topic</label>
                      <input
                        type="text"
                        placeholder="Example: Rotational dynamics"
                        value={proveItTopic}
                        onChange={(e) => setProveItTopic(e.target.value)}
                        className="w-full px-4 py-3 bg-white rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50"
                      />
                    </div>
                  </div>
                )}
                {assignmentMode === 'standard' && <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Title</label>
                  <input
                    type="text"
                    placeholder="Example: Mid-term project"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50"
                    required
                  />
                </div>}
                {assignmentMode === 'standard' && <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Description</label>
                  <textarea
                    placeholder="Details and instructions..."
                    value={assignmentDesc}
                    onChange={(e) => setAssignmentDesc(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50 min-h-[100px]"
                  />
                </div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Due Date</label>
                    <input
                      type="date"
                      value={assignmentDueDate}
                      onChange={(e) => setAssignmentDueDate(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all"
                    />
                  </div>
                  {assignmentMode === 'standard' && <div>
                    <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Attachment</label>
                    <input
                      type="file"
                      onChange={(e) => setAssignmentFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:bg-white file:text-[#8B7355]"
                    />
                  </div>}
                </div>

                <button
                  type="submit"
                  disabled={postingAssignment}
                  className="bg-[#2D2A26] text-white px-6 py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
                >
                  {postingAssignment ? 'Creating...' : assignmentMode === 'prove-it' ? 'Assign Prove-It Challenge' : 'Create Assignment'}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {assignments.map((a: any) => (
                <div key={a.id} className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-5 shadow-sm relative group hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-8">
                      <h4 className="text-lg font-bold text-[#2D2A26]">{a.title}</h4>
                      <p className="text-[#8A8279] text-sm font-medium mt-2 whitespace-pre-wrap border-l-4 border-[#8B7355]/20 pl-4 py-1 bg-[#F8FAFF] rounded-r-lg">{a.description}</p>
                      {a.due_date && (
                        <p className="text-xs font-bold text-[#8A8279] mt-4 flex items-center gap-2">
                          <Clock className="h-4 w-4 stroke-[2.5px]" />
                          Due {new Date(a.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAssignment(a)}
                      className="text-[#8A8279] hover:bg-red-50 hover:text-red-600 p-2 rounded-lg transition-colors"
                      title="Delete assignment"
                    >
                      <Trash2 className="h-5 w-5 stroke-[2.5px]" />
                    </button>
                  </div>
                  {a.file_url && (
                    <div className="mt-4 pt-4 border-t border-[#E8E4DF]">
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#F5F0E8] text-[#8B7355] font-bold text-xs px-4 py-2 rounded-xl hover:bg-[#8B7355] hover:text-white transition-colors"
                      >
                        <Download className="h-4 w-4 stroke-[2.5px]" />
                        Download
                      </a>
                    </div>
                  )}
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="text-center py-12 border border-dashed border-[#E8E4DF] bg-white rounded-2xl">
                  <p className="font-bold text-[#8A8279]">No assignments active.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Class Workflow Tab */}
        {tab === 'Class Workflow' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm">
              <div className="flex items-start gap-4 mb-6">
                <div className="bg-[#8B7355]/10 p-3 rounded-2xl">
                  <GraduationCap className="h-6 w-6 text-[#8B7355] stroke-[2.5px]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#2D2A26]">What did you teach today?</h2>
                  <p className="text-sm text-[#8A8279] mt-1">Log today’s lesson, optionally assign homework, then students receive homework before AI-generated tasks.</p>
                </div>
              </div>

              <form onSubmit={handleLogClassSession} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Subject</label>
                    <select
                      value={sessionSubject}
                      onChange={(e) => setSessionSubject(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all"
                    >
                      {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Duration</label>
                    <input
                      type="number"
                      min={15}
                      max={180}
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(parseInt(e.target.value))}
                      className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">What did you teach in class?</label>
                  <textarea
                    value={sessionTopics}
                    onChange={(e) => setSessionTopics(e.target.value)}
                    placeholder="Example: Kinematics 1D, equations of motion, graphical analysis..."
                    className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50 min-h-[120px]"
                    required
                  />
                </div>

                <div className="bg-[#F5F0E8] rounded-2xl p-4 border border-[#E8E4DF]">
                  <p className="text-sm font-bold text-[#2D2A26] mb-3">Do you want to give homework?</p>
                  <div className="flex gap-2 mb-4">
                    <button type="button" onClick={() => setHomeworkEnabled(true)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${homeworkEnabled ? 'bg-[#2D2A26] text-white' : 'bg-white text-[#8A8279]'}`}>Yes</button>
                    <button type="button" onClick={() => setHomeworkEnabled(false)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${!homeworkEnabled ? 'bg-[#2D2A26] text-white' : 'bg-white text-[#8A8279]'}`}>No</button>
                  </div>

                  {homeworkEnabled && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Homework type</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            ['practice', 'Practice'],
                            ['prove-it', 'Prove-It'],
                            ['reading', 'Reading'],
                            ['worksheet', 'Worksheet'],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setHomeworkType(value as typeof homeworkType)}
                              className={`py-2 px-3 rounded-xl text-sm font-bold transition-all ${homeworkType === value ? 'bg-[#8B7355] text-white' : 'bg-white text-[#8A8279]'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Homework details</label>
                        <textarea
                          value={sessionHomework}
                          onChange={(e) => setSessionHomework(e.target.value)}
                          placeholder="Example: HC Verma Ch 3 Q1-15, DPP Sheet 7, or a concept to Prove-It..."
                          className="w-full px-4 py-3 bg-white rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50 min-h-[90px]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {sessionLogError && <div className="bg-red-50 border border-red-100 text-red-600 font-bold p-4 rounded-xl">{sessionLogError}</div>}
                {sessionLogSuccess && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold p-4 rounded-xl flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />{sessionLogSuccess}</div>}
                <button
                  type="submit"
                  disabled={loggingSession || (homeworkEnabled && !sessionHomework.trim())}
                  className="bg-[#2D2A26] text-white px-6 py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
                >
                  {loggingSession ? (
                    <><Loader2 className="h-5 w-5 animate-spin stroke-[2.5px]" />Saving...</>
                  ) : (
                    <><GraduationCap className="h-5 w-5 stroke-[2.5px]" />Save Class Workflow</>
                  )}
                </button>
              </form>
            </div>

            {/* Mock Test Generator */}
            <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#2D2A26] mb-5 flex items-center gap-2">
                <Brain className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                Optional AI Mock Test
              </h3>
              <form onSubmit={handleGenerateDailyMockTest} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Topics for mock test</label>
                <textarea
                  value={dailyTopics}
                  onChange={(e) => setDailyTopics(e.target.value)}
                  placeholder="Example: Newton's laws, inertia, momentum..."
                  className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50 min-h-[120px]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-2 text-[#8A8279]">Question count</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={mockQuestionCount}
                  onChange={(e) => setMockQuestionCount(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all"
                />
              </div>

              {mockGenError && <div className="bg-red-50 border border-red-100 text-red-600 font-bold p-4 rounded-xl">{mockGenError}</div>}
              {mockSuccessMsg && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold p-4 rounded-xl">{mockSuccessMsg}</div>}

              <button
                type="submit"
                disabled={generatingMock}
                className="bg-[#2D2A26] text-white px-6 py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50"
              >
                {generatingMock ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin stroke-[2.5px]" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 stroke-[2.5px]" />
                    Generate Mock Test
                  </>
                )}
              </button>
            </form>

            {mockPreview && (
              <div className="mt-8 pt-6 border-t border-[#E8E4DF]">
                <h4 className="text-sm font-bold text-[#2D2A26] mb-4">Preview</h4>
                <div className="bg-[#F8FAFF] rounded-xl p-5 border border-[#E8E4DF] font-mono text-sm text-[#2D2A26] whitespace-pre-wrap">
                  {mockPreview}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Student Responses Tab */}
        {tab === 'Student Responses' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold text-[#2D2A26] flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                Student Responses
              </h3>
              <div className="flex bg-[#F8FAFF] border border-[#E8E4DF] p-1 rounded-[14px]">
                <button
                  onClick={() => setResponseGroupMode('assignment')}
                  className={`px-4 py-2 font-bold text-sm rounded-xl transition-all ${responseGroupMode === 'assignment' ? 'bg-white text-[#8B7355] shadow-sm' : 'text-[#8A8279]'}`}
                >
                  By Assignment
                </button>
                <button
                  onClick={() => setResponseGroupMode('student')}
                  className={`px-4 py-2 font-bold text-sm rounded-xl transition-all ${responseGroupMode === 'student' ? 'bg-white text-[#8B7355] shadow-sm' : 'text-[#8A8279]'}`}
                >
                  By Student
                </button>
              </div>
            </div>

            {attemptsLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-16 h-16 border border-white/10 border-t-neo-accent animate-spin rounded-full"></div>
              </div>
            )}
            {attemptsError && (
              <div className="bg-red-50 border border-red-100 text-red-600 font-bold p-4 rounded-xl">
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
                        <div className="text-center py-12 border border-dashed border-[#E8E4DF] bg-white rounded-2xl">
                          <p className="font-bold text-[#8A8279]">No responses recorded yet.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {groupedByAssignment.map((g) => (
                          <div key={g.assignment.id} className="space-y-3">
                            <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-2">
                              <h3 className="text-base font-bold text-[#2D2A26] flex items-center gap-2">
                                <FileText className="h-4 w-4 text-[#8B7355] stroke-[2.5px]" />
                                {g.assignment.title}
                              </h3>
                              <div className="text-xs font-bold text-[#8A8279]">
                                {g.assignment.created_at ? new Date(g.assignment.created_at).toLocaleDateString() : ''}
                              </div>
                            </div>
                            <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] shadow-sm overflow-x-auto">
                              <table className="min-w-full text-left">
                                <thead className="bg-[#F5F0E8] text-[#8A8279] text-xs font-bold uppercase tracking-wide">
                                  <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Student</th>
                                    <th className="px-4 py-3">Score</th>
                                    <th className="px-4 py-3">Questions</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E8E4DF] font-medium">
                                  {g.attempts.map((a: any, i: number) => {
                                    const prof = attemptProfiles[a.user_id] || {};
                                    const name = prof.full_name || prof.email || a.user_id;
                                    return (
                                      <tr key={a.id || i} className="hover:bg-[#F8FAFF] transition-colors">
                                        <td className="px-4 py-4 text-[#8A8279]">{a.exam_date ? new Date(a.exam_date).toLocaleDateString() : '-'}</td>
                                        <td className="px-4 py-4 text-[#2D2A26] font-bold">
                                          <button
                                            onClick={() => {
                                              const s = students.find(st => st.id === a.user_id || st.user_id === a.user_id);
                                              if (s) setViewingStudent(s);
                                            }}
                                            className="hover:underline decoration-2 underline-offset-4"
                                          >
                                            {name}
                                          </button>
                                        </td>
                                        <td className="px-4 py-4 text-[#2D2A26] font-mono">{a.total_score} / {a.max_score}</td>
                                        <td className="px-4 py-4 text-[#8A8279]">{a.questions_count || '-'}</td>
                                        <td className="px-4 py-4 text-right">
                                          <button
                                            className="inline-flex items-center gap-2 bg-[#F5F0E8] text-[#8B7355] px-3 py-2 rounded-xl font-bold text-xs hover:bg-[#8B7355] hover:text-white transition-all"
                                            onClick={() => { setAttemptModal(a); setShowAttemptModal(true); }}
                                          >
                                            <Eye className="w-4 h-4 stroke-[2.5px]" /> View
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
                        <div className="text-center py-12 border border-dashed border-[#E8E4DF] bg-white rounded-2xl">
                          <p className="font-bold text-[#8A8279]">No responses recorded yet.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupedByStudent.map((g) => (
                          <div
                            key={g.student.id || g.student.user_id}
                            className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center gap-4"
                            onClick={() => setViewingStudent(g.student)}
                          >
                            <div className="w-12 h-12 bg-[#F5F0E8] rounded-xl flex items-center justify-center text-[#8B7355] font-bold text-lg">
                              {g.student.full_name?.[0] || g.student.email?.[0] || '?'}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <h3 className="text-base font-bold text-[#2D2A26] truncate">
                                {g.student.full_name || g.student.email}
                              </h3>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="bg-[#F5F0E8] text-[#8B7355] text-xs font-bold px-2 py-1 rounded-md">{g.attempts.length} exams</span>
                              </div>
                            </div>
                            <Eye className="w-5 h-5 text-[#8A8279] stroke-[2.5px]" />
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

        {/* Strengths & Weaknesses Tab */}
        {tab === 'Strengths & Weaknesses' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-[#2D2A26] mb-5 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
              Strengths & Weaknesses
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((s: any) => {
                const studentAttempts = (attempts || []).filter(a => (a.user_id === s.user_id || a.user_id === s.id) && a.student_weaknesses);
                const allStudentAttempts = (attempts || []).filter(a => a.user_id === s.user_id || a.user_id === s.id);
                const behavior = behaviorProfiles[s.user_id || s.id];
                const avgScore = allStudentAttempts.length
                  ? Math.round((allStudentAttempts.reduce((acc, at) => acc + ((at.total_score || 0) / (at.max_score || 1)), 0) / allStudentAttempts.length) * 100)
                  : null;
                return (
                  <div
                    key={s.id || s.user_id}
                    className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => setViewingStudent(s)}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-[#F5F0E8] rounded-xl flex items-center justify-center text-[#8B7355] font-bold text-lg">
                        {s.full_name?.[0] || s.email?.[0] || '?'}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-[#2D2A26]">{s.full_name || s.email}</h4>
                        <p className="text-sm font-medium text-[#8A8279] mt-1">{allStudentAttempts.length} responses recorded</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-bold text-[#8B7355] bg-[#F5F0E8] px-3 py-1 rounded-full">
                        {studentAttempts.length > 0 ? `${studentAttempts.length} weakness notes` : 'No weakness notes'}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                        {avgScore !== null ? `${avgScore}% avg` : 'No score yet'}
                      </span>
                    </div>
                    {(behavior?.strong_subjects?.length > 0 || behavior?.weak_subjects?.length > 0) && (
                      <div className="mt-4 grid grid-cols-1 gap-2 text-xs">
                        {behavior?.strong_subjects?.length > 0 && (
                          <p className="text-emerald-700 font-semibold">Strong: {behavior.strong_subjects.slice(0, 3).join(', ')}</p>
                        )}
                        {behavior?.weak_subjects?.length > 0 && (
                          <p className="text-[#8B7355] font-semibold">Weak: {behavior.weak_subjects.slice(0, 3).join(', ')}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {students.length === 0 && (
                <div className="text-center py-12 border border-dashed border-[#E8E4DF] bg-white rounded-2xl">
                  <p className="font-bold text-[#8A8279]">No students enrolled yet.</p>
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
                <div className="prose prose-lg max-w-none prose-headings:font-black prose-headings:uppercase prose-p:font-medium prose-strong:font-black prose-a:text-neo-accent" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(aiSummary) as string) }} />
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
          <div className="absolute inset-0 bg-[#2D2A26]/40 backdrop-blur-sm" onClick={() => setViewingStudent(null)}></div>
          <div className="relative bg-[#FAF8F5] w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[28px] border border-[#E8E4DF] shadow-2xl flex flex-col">
            <div className="p-6 border-b border-[#E8E4DF] flex items-center justify-between bg-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-[#F5F0E8] rounded-2xl flex items-center justify-center text-[#8B7355] font-bold text-2xl">
                  {viewingStudent.full_name?.[0] || viewingStudent.email?.[0] || '?'}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#2D2A26]">{viewingStudent.full_name || viewingStudent.email}</h3>
                  <p className="text-sm font-medium text-[#8A8279] mt-1">{viewingStudent.email}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingStudent(null)}
                className="p-2 bg-[#F5F0E8] text-[#8B7355] hover:bg-[#8B7355] hover:text-white rounded-xl transition-colors"
              >
                <XCircle className="w-6 h-6 stroke-[2.5px]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-[#E8E4DF]">
                  <div className="text-[#8A8279] font-bold uppercase tracking-wide text-xs mb-1">Assessments</div>
                  <div className="text-3xl font-bold text-[#2D2A26]">
                    {(attempts || []).filter(a => a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id).length}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-[#E8E4DF]">
                  <div className="text-[#8A8279] font-bold uppercase tracking-wide text-xs mb-1">Average Score</div>
                  <div className="text-3xl font-bold text-[#2D2A26]">
                    {(() => {
                      const satts = (attempts || []).filter(a => a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id);
                      if (satts.length === 0) return 'N/A';
                      const avg = satts.reduce((acc, at) => acc + (at.total_score / at.max_score), 0) / satts.length;
                      return Math.round(avg * 100) + '%';
                    })()}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-[#E8E4DF]">
                  <div className="text-[#8A8279] font-bold uppercase tracking-wide text-xs mb-1">Strength</div>
                  <div className="text-xl font-bold text-emerald-700">
                    {(() => {
                      const satts = (attempts || []).filter(a => a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id);
                      if (satts.length === 0) return 'Building profile';
                      const avg = satts.reduce((acc, at) => acc + (at.total_score / at.max_score), 0) / satts.length;
                      if (avg >= 0.8) return 'Strong mastery';
                      if (avg >= 0.6) return 'Steady progress';
                      return 'Needs support';
                    })()}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-lg font-bold text-[#2D2A26] flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#8B7355] stroke-[2.5px]" />
                  What we know
                </h4>
                {(() => {
                  const behavior = behaviorProfiles[viewingStudent.user_id || viewingStudent.id];
                  if (!behavior) return null;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                        <h5 className="text-sm font-bold text-emerald-800 mb-3">Overall strengths Ranjan Sir has observed</h5>
                        {behavior.strong_subjects?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {behavior.strong_subjects.map((item: string) => (
                              <span key={item} className="px-3 py-1 bg-white text-emerald-700 rounded-full text-xs font-bold">{item}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-emerald-700/70 font-medium">No long-term strengths recorded yet.</p>
                        )}
                      </div>
                      <div className="bg-[#F5F0E8] rounded-2xl p-5 border border-[#E8E4DF]">
                        <h5 className="text-sm font-bold text-[#8B7355] mb-3">Overall weaknesses Ranjan Sir has observed</h5>
                        {behavior.weak_subjects?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {behavior.weak_subjects.map((item: string) => (
                              <span key={item} className="px-3 py-1 bg-white text-[#8B7355] rounded-full text-xs font-bold">{item}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-[#8B7355]/70 font-medium">No long-term weaknesses recorded yet.</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <div className="space-y-4">
                  {(attempts || [])
                    .filter(a => (a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id) && a.student_weaknesses)
                    .map((at, idx) => (
                      <div key={at.id || idx} className="bg-white rounded-2xl p-5 border border-[#E8E4DF]">
                        <div className="flex justify-between items-start mb-3 border-b border-[#E8E4DF] pb-3">
                          <span className="font-bold text-[#2D2A26]">
                            {(assignments || []).find(as => as.id === at.assignment_id)?.title || 'Mock Test'}
                          </span>
                          <span className="font-medium text-[#8A8279] text-sm">
                            {new Date(at.exam_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[#8A8279] font-medium leading-relaxed whitespace-pre-wrap">
                          {at.student_weaknesses}
                        </p>
                      </div>
                    ))}
                  {(attempts || []).filter(a => (a.user_id === viewingStudent.id || a.user_id === viewingStudent.user_id) && a.student_weaknesses).length === 0 && (
                    <div className="text-center py-8 font-bold text-[#8A8279] bg-white rounded-2xl border border-[#E8E4DF]">No weaknesses logged yet.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-[#E8E4DF] bg-white">
              <button
                onClick={() => setViewingStudent(null)}
                className="w-full bg-[#2D2A26] text-white font-bold py-3 rounded-[14px] hover:shadow-md transition-all"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherClassDashboard;