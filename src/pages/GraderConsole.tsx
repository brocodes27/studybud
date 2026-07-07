import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Camera, RefreshCw, Play, Pause, PlusCircle, Loader2, AlertCircle,
  CheckCircle2, ScanLine, FileText, Cpu
} from 'lucide-react';

interface GradingSession {
  id: string;
  teacher_id: string;
  student_user_id: string | null;
  class_id: string | null;
  device_id: string;
  test_name: string;
  question_paper: any[];
  status: 'capturing' | 'paused' | 'checking' | 'graded' | 'failed' | 'cancelled';
  command: string | null;
  command_seq: number;
  error_message: string | null;
  result: { total?: number; max?: number; per_question?: EvaluationItem[] };
  test_result_id: string | null;
  created_at: string;
}

interface EvaluationItem {
  question_number: number;
  marks_awarded: number;
  max_marks: number;
  feedback: string;
}

interface GradingPage {
  id: string;
  session_id: string;
  page_number: number;
  storage_path: string;
  signedUrl?: string;
}

const STATUS_LABELS: Record<GradingSession['status'], string> = {
  capturing: 'Capturing pages',
  paused: 'Paused',
  checking: 'Checking (OCR + AI grading)...',
  graded: 'Graded',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const GraderConsole: React.FC = () => {
  const { user, role } = useAuth() as any;
  const [searchParams] = useSearchParams();

  // Setup state
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get('class') || '');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [deviceId, setDeviceId] = useState('grader-local-1');
  const [testName, setTestName] = useState('Notebook Check');
  const [questionPaperText, setQuestionPaperText] = useState('');

  // Session state
  const [session, setSession] = useState<GradingSession | null>(null);
  const [pages, setPages] = useState<GradingPage[]>([]);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [sendingCommand, setSendingCommand] = useState<string | null>(null);
  const [error, setError] = useState('');
  const commandSeqRef = useRef(0);

  // Load the teacher's classes
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('classes')
        .select('id, name, subject')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });
      setClasses(data || []);
    })();
  }, [user?.id]);

  // Load the roster when a class is selected (same pattern as TeacherClassDashboard)
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    (async () => {
      const { data: memberData } = await supabase
        .from('class_members')
        .select('user_id')
        .eq('class_id', selectedClassId);
      const userIds: string[] = (memberData || []).map((m: any) => m.user_id).filter(Boolean);
      if (userIds.length === 0) {
        setStudents([]);
        return;
      }
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      setStudents(profiles || []);
    })();
  }, [selectedClassId]);

  const refreshSignedUrl = useCallback(async (page: GradingPage): Promise<GradingPage> => {
    const { data } = await supabase.storage
      .from('notebook-scans')
      .createSignedUrl(page.storage_path, 60 * 60);
    return { ...page, signedUrl: data?.signedUrl };
  }, []);

  // Realtime: watch the active session + its pages + live camera feed
  useEffect(() => {
    if (!session?.id) {
      setLiveFrame(null);
      return;
    }
    const sessionId = session.id;
    const deviceId = session.device_id;

    // Database changes channel
    const dbChannel = supabase
      .channel(`grader-console-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'grading_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as GradingSession;
          commandSeqRef.current = Math.max(commandSeqRef.current, updated.command_seq || 0);
          setSession(updated);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'grading_pages', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          const page = await refreshSignedUrl(payload.new as GradingPage);
          setPages((prev) => {
            const withoutDup = prev.filter((p) => p.id !== page.id);
            return [...withoutDup, page].sort((a, b) => a.page_number - b.page_number);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'grading_pages', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          const page = await refreshSignedUrl(payload.new as GradingPage);
          setPages((prev) => prev.map((p) => (p.id === page.id ? page : p)));
        }
      )
      .subscribe();

    // Broadcast live camera feed channel
    const feedChannel = supabase
      .channel(`grader-${deviceId}`)
      .on('broadcast', { event: 'live-frame' }, (payload) => {
        setLiveFrame(payload.payload.image);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(feedChannel);
    };
  }, [session?.id, session?.device_id, refreshSignedUrl]);

  const handleCreateSession = async () => {
    if (!user?.id) return;
    setError('');

    let questionPaper: any[] = [];
    if (questionPaperText.trim()) {
      try {
        const parsed = JSON.parse(questionPaperText);
        questionPaper = Array.isArray(parsed) ? parsed : parsed.questions || [];
      } catch {
        setError('Question paper must be valid JSON (an array of { question, marks } objects). Leave empty to let the AI infer questions from the answers.');
        return;
      }
    }

    setCreating(true);
    try {
      const { data, error: insertErr } = await supabase
        .from('grading_sessions')
        .insert({
          teacher_id: user.id,
          student_user_id: selectedStudentId || null,
          class_id: selectedClassId || null,
          device_id: deviceId.trim() || 'grader-local-1',
          test_name: testName.trim() || 'Notebook Check',
          question_paper: questionPaper,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      commandSeqRef.current = data.command_seq || 0;
      setSession(data as GradingSession);
      setPages([]);
    } catch (err: any) {
      setError(err.message || 'Failed to create grading session');
    } finally {
      setCreating(false);
    }
  };

  const sendCommand = async (command: string) => {
    if (!session?.id) return;
    setError('');
    setSendingCommand(command);
    try {
      const nextSeq = commandSeqRef.current + 1;
      const { error: updateErr } = await supabase
        .from('grading_sessions')
        .update({ command, command_seq: nextSeq })
        .eq('id', session.id);
      if (updateErr) throw updateErr;
      commandSeqRef.current = nextSeq;
    } catch (err: any) {
      setError(err.message || `Failed to send command: ${command}`);
    } finally {
      setSendingCommand(null);
    }
  };

  const handleEndSession = () => {
    setSession(null);
    setPages([]);
    setError('');
    commandSeqRef.current = 0;
  };

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-red-500/20 text-center max-w-md shadow">
          <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
          <p className="text-[#64748B]">You must be a teacher to use the Notebook Grader.</p>
        </div>
      </div>
    );
  }

  const busy = session?.status === 'checking';
  const perQuestion: EvaluationItem[] = session?.result?.per_question || [];
  const studentName =
    students.find((s) => s.id === session?.student_user_id)?.full_name ||
    students.find((s) => s.id === selectedStudentId)?.full_name ||
    '';

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <header className="flex items-center gap-4">
        <div className="w-12 h-12 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-2xl flex items-center justify-center text-[#00D1FF]">
          <ScanLine className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0A192F]">Notebook Grader</h1>
          <p className="text-sm text-[#64748B]">
            Remotely capture notebook / answer-sheet pages on the grader machine, then let AI check them.
          </p>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!session ? (
        <section className="bg-white border-2 border-[#0A192F]/10 rounded-[24px] p-6 sm:p-8 space-y-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#0A192F] flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-[#00D1FF]" /> New Grading Session
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="font-semibold text-[#0A192F]">Class</span>
              <select
                value={selectedClassId}
                onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudentId(''); }}
                className="mt-1 w-full border border-[#0A192F]/15 rounded-xl px-3 py-2.5 bg-white text-[#0A192F]"
              >
                <option value="">Select a class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.subject ? ` — ${c.subject}` : ''}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-[#0A192F]">Student</span>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={!selectedClassId}
                className="mt-1 w-full border border-[#0A192F]/15 rounded-xl px-3 py-2.5 bg-white text-[#0A192F] disabled:opacity-50"
              >
                <option value="">Select a student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-[#0A192F] flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-[#64748B]" /> Device ID
              </span>
              <input
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="grader-local-1"
                className="mt-1 w-full border border-[#0A192F]/15 rounded-xl px-3 py-2.5 text-[#0A192F]"
              />
              <span className="text-xs text-[#64748B]">Must match GRADER_DEVICE_ID on the grader machine.</span>
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-[#0A192F]">Test name</span>
              <input
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Notebook Check"
                className="mt-1 w-full border border-[#0A192F]/15 rounded-xl px-3 py-2.5 text-[#0A192F]"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-semibold text-[#0A192F] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#64748B]" /> Question paper (optional JSON)
            </span>
            <textarea
              value={questionPaperText}
              onChange={(e) => setQuestionPaperText(e.target.value)}
              rows={4}
              placeholder='[{"question_number": 1, "question": "State Newton\u0027s second law.", "marks": 3}]'
              className="mt-1 w-full border border-[#0A192F]/15 rounded-xl px-3 py-2.5 font-mono text-xs text-[#0A192F]"
            />
            <span className="text-xs text-[#64748B]">
              Leave empty to let the AI infer questions and marks from the student's answers.
            </span>
          </label>

          <button
            onClick={handleCreateSession}
            disabled={creating || !selectedStudentId}
            className="inline-flex items-center gap-2 bg-[#00D1FF] text-[#0A192F] font-bold px-6 py-3 rounded-xl hover:opacity-90 transition disabled:opacity-40"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            Start Session
          </button>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Session control */}
              <section className="bg-white border-2 border-[#0A192F]/10 rounded-[24px] p-6 sm:p-8 space-y-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#0A192F]">{session.test_name}</h2>
                    <p className="text-sm text-[#64748B]">
                      {studentName ? `Student: ${studentName} · ` : ''}Device: {session.device_id}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
                      session.status === 'graded'
                        ? 'bg-emerald-100 text-emerald-700'
                        : session.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : session.status === 'checking'
                            ? 'bg-[#00D1FF]/15 text-[#0084a8]'
                            : 'bg-[#0A192F]/5 text-[#0A192F]'
                    }`}
                  >
                    {busy && <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />}
                    {STATUS_LABELS[session.status] || session.status}
                  </span>
                </div>

                {session.status === 'failed' && session.error_message && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{session.error_message}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => sendCommand('capture_page')}
                    disabled={!!sendingCommand || busy}
                    className="inline-flex items-center gap-2 bg-[#0A192F] text-white font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-40"
                  >
                    {sendingCommand === 'capture_page' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Capture Page
                  </button>
                  <button
                    onClick={() => sendCommand('retake_last')}
                    disabled={!!sendingCommand || busy || pages.length === 0}
                    className="inline-flex items-center gap-2 border-2 border-[#0A192F]/15 text-[#0A192F] font-bold px-5 py-2.5 rounded-xl hover:bg-[#0A192F]/5 transition disabled:opacity-40"
                  >
                    {sendingCommand === 'retake_last' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Retake Last
                  </button>
                  <button
                    onClick={() => sendCommand(session.status === 'paused' ? 'resume' : 'start_checking')}
                    disabled={!!sendingCommand || busy || pages.length === 0}
                    className="inline-flex items-center gap-2 bg-[#00D1FF] text-[#0A192F] font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-40"
                  >
                    {sendingCommand === 'start_checking' || sendingCommand === 'resume'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Play className="w-4 h-4" />}
                    {session.status === 'paused' ? 'Resume Checking' : 'Start Checking'}
                  </button>
                  <button
                    onClick={() => sendCommand('pause')}
                    disabled={!!sendingCommand || busy || session.status === 'paused'}
                    className="inline-flex items-center gap-2 border-2 border-[#0A192F]/15 text-[#0A192F] font-bold px-5 py-2.5 rounded-xl hover:bg-[#0A192F]/5 transition disabled:opacity-40"
                  >
                    {sendingCommand === 'pause' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                    Pause
                  </button>
                  <button
                    onClick={handleEndSession}
                    className="ml-auto inline-flex items-center gap-2 text-[#64748B] font-semibold px-4 py-2.5 rounded-xl hover:text-[#0A192F] transition"
                  >
                    New Session
                  </button>
                </div>
              </section>
            </div>

            <div className="lg:col-span-1">
              {/* Live feed preview */}
              <section className="bg-[#0A192F] text-white border border-[#0A192F]/15 rounded-[24px] p-6 space-y-4 shadow-md flex flex-col h-full min-h-[300px]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold tracking-wider uppercase text-[#00D1FF] flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${liveFrame && session.status === 'capturing' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    Live Camera Feed
                  </h3>
                  <span className="text-xs text-white/50">{session.device_id}</span>
                </div>
                
                <div className="flex-1 border border-white/10 rounded-xl overflow-hidden bg-black flex items-center justify-center relative min-h-[180px]">
                  {liveFrame && session.status === 'capturing' ? (
                    <img 
                      src={liveFrame} 
                      alt="Camera feed" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center space-y-2 p-4">
                      <Camera className="w-8 h-8 mx-auto text-white/30" />
                      <p className="text-xs text-white/50">
                        {session.status === 'capturing' 
                          ? 'Waiting for camera feed...' 
                          : `Live feed paused (${STATUS_LABELS[session.status] || session.status})`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          {/* Captured pages */}
          <section className="bg-white border-2 border-[#0A192F]/10 rounded-[24px] p-6 sm:p-8 space-y-4 shadow-sm">
            <h3 className="text-base font-bold text-[#0A192F]">
              Captured pages ({pages.length})
            </h3>
            {pages.length === 0 ? (
              <p className="text-sm text-[#64748B]">
                Place the notebook on the stand, then press <strong>Capture Page</strong>. Flip the page and capture again for each page.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {pages.map((page) => (
                  <figure key={page.id} className="border border-[#0A192F]/10 rounded-xl overflow-hidden bg-[#F8FAF9]">
                    {page.signedUrl ? (
                      <img src={page.signedUrl} alt={`Page ${page.page_number}`} className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 flex items-center justify-center text-[#64748B] text-xs">Loading...</div>
                    )}
                    <figcaption className="px-3 py-2 text-xs font-semibold text-[#0A192F]">Page {page.page_number}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>

          {/* Grading results */}
          {session.status === 'graded' && (
            <section className="bg-white border-2 border-emerald-200 rounded-[24px] p-6 sm:p-8 space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <div>
                  <h3 className="text-lg font-bold text-[#0A192F]">Grading complete</h3>
                  <p className="text-sm text-[#64748B]">
                    Score: <strong className="text-[#0A192F]">{session.result?.total ?? 0} / {session.result?.max ?? 0}</strong>
                    {' '}— appended to the student's record (visible in the class dashboard and the student's own dashboard).
                  </p>
                </div>
              </div>

              {perQuestion.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-widest text-[#64748B] border-b border-[#0A192F]/10">
                        <th className="py-2 pr-4">Q#</th>
                        <th className="py-2 pr-4">Marks</th>
                        <th className="py-2">Feedback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perQuestion.map((q) => (
                        <tr key={q.question_number} className="border-b border-[#0A192F]/5 align-top">
                          <td className="py-2.5 pr-4 font-bold text-[#0A192F]">Q{q.question_number}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">
                            <span className={`font-bold ${q.marks_awarded >= q.max_marks ? 'text-emerald-600' : q.marks_awarded === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                              {q.marks_awarded}
                            </span>
                            <span className="text-[#64748B]"> / {q.max_marks}</span>
                          </td>
                          <td className="py-2.5 text-[#0A192F]/80">{q.feedback}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default GraderConsole;
