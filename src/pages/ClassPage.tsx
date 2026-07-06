import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, FileText, Bell, Link as LinkIcon, Download, LogOut, AlertTriangle, Calendar, Clock, Plus, XCircle, Sparkles } from 'lucide-react';

interface ClassInfo {
    id: string;
    teacher_id: string;
    class_name: string;
    class_code: string;
    created_at: string;
    subject?: string;
}

interface Assignment {
    id: string;
    class_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    file_url: string | null;
    created_at: string;
    is_mock?: boolean;
    expires_at?: string | null;
}

interface Announcement {
    id: string;
    class_id: string;
    content?: string;
    message?: string;
    created_at: string;
}

interface Resource {
    id: string;
    class_id: string;
    title: string;
    url: string | null;
    file_url: string | null;
    type: string | null;
    uploaded_by: string | null;
    created_at: string;
}

const TABS = ['Overview', 'Assignments', 'Announcements', 'Resources'];

const ClassPage = () => {
    const { id } = useParams<{ id: string }>();
    const { user, role } = useAuth() as any;
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Overview');
    const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);

    // New state for forms
    const [assignmentTitle, setAssignmentTitle] = useState('');
    const [assignmentDesc, setAssignmentDesc] = useState('');
    const [assignmentDueDate, setAssignmentDueDate] = useState('');
    const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
    const [announcementContent, setAnnouncementContent] = useState('');
    const [formError, setFormError] = useState('');

    // Phase 2 submissions state
    const [submissions, setSubmissions] = useState<Record<string, any>>({});
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [subText, setSubText] = useState<Record<string, string>>({});
    const [subFile, setSubFile] = useState<Record<string, File | null>>({});

    const fetchClassData = useCallback(async () => {
        if (!user || !id) return;

        setLoading(true);

        // Fetch class details
        const { data: classData, error: classError } = await supabase
            .from('classes')
            .select('*')
            .eq('id', id)
            .single();

        // Only redirect if not loading and data is missing
        if (!user || (!classData && !loading)) {
            console.error('Error fetching class data:', classError);
            navigate('/my-classes');
            return;
        }
        setClassInfo(classData);

        // Fetch assignments
        const { data: assignmentsData, error: assignmentsError } = await supabase
            .from('assignments')
            .select('*')
            .eq('class_id', id)
            .order('created_at', { ascending: false });

        if (assignmentsError) console.error('Error fetching assignments:', assignmentsError);
        else {
            const now = new Date();
            const filtered = (assignmentsData || []).filter((a: Assignment) => {
                if (!a.is_mock) return true;
                if (!a.expires_at) return true;
                return new Date(a.expires_at) > now;
            });
            setAssignments(filtered);
        }

        // Fetch announcements (FIX: use class_announcements)
        const { data: announcementsData, error: announcementsError } = await supabase
            .from('class_announcements')
            .select('*')
            .eq('class_id', id)
            .order('created_at', { ascending: false });

        if (announcementsError) console.error('Error fetching announcements:', announcementsError);
        else {
            setAnnouncements(announcementsData);
        }

        // Fetch resources
        const { data: resourcesData, error: resourcesError } = await supabase
            .from('class_resources')
            .select('*')
            .eq('class_id', id)
            .order('created_at', { ascending: false });

        if (resourcesError) console.error('Error fetching resources:', resourcesError);
        else {
            setResources(resourcesData);
        }

        // Fetch student submissions for the class assignments
        if (role === 'student' && user) {
            const { data: submissionsData, error: submissionsError } = await supabase
                .from('assignment_submissions')
                .select('*')
                .eq('student_id', user.id);
            
            if (!submissionsError && submissionsData) {
                const subMap = submissionsData.reduce((acc: any, sub: any) => {
                    acc[sub.assignment_id] = sub;
                    return acc;
                }, {});
                setSubmissions(subMap);
            }
        }

        setLoading(false);
    }, [id, user, navigate]);

    useEffect(() => {
        fetchClassData();
    }, [fetchClassData]);

    // Refetch data when switching tabs
    useEffect(() => {
        if (activeTab === 'Assignments' || activeTab === 'Announcements' || activeTab === 'Resources') {
            fetchClassData();
        }
    }, [activeTab]);

    const handleCreateAssignment = async (e: FormEvent) => {
        e.preventDefault();
        if (!assignmentTitle.trim() || !user || !id) return;

        let fileUrl: string | null = null;
        if (assignmentFile) {
            const filePath = `${user.id}/${id}/${Date.now()}_${assignmentFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('assignments')
                .upload(filePath, assignmentFile);

            if (uploadError) {
                setFormError('Error uploading file.');
                console.error(uploadError);
                return;
            }

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

        if (error) {
            setFormError('Failed to create assignment.');
            console.error('Error creating assignment:', error);
        } else {
            setAssignmentTitle('');
            setAssignmentDesc('');
            setAssignmentDueDate('');
            setAssignmentFile(null);
            setFormError('');
            fetchClassData(); // Refresh list
        }
    };

    const handleCreateAnnouncement = async (e: FormEvent) => {
        e.preventDefault();
        if (!announcementContent.trim() || !user || !id) return;
        const { error } = await supabase.from('class_announcements').insert({
            class_id: id,
            message: announcementContent,
            posted_by: user.id,
        });
        if (error) {
            setFormError('Failed to create announcement.');
            console.error('Error creating announcement:', error);
        } else {
            setAnnouncementContent('');
            setFormError('');
            fetchClassData(); // Refresh list
        }
    };

    const handleUploadSubmission = async (assignmentId: string) => {
        if (!user) return;
        setSubmittingId(assignmentId);
        setFormError('');
        try {
            const text = subText[assignmentId] || '';
            const file = subFile[assignmentId] || null;

            let attachmentUrl = null;
            if (file) {
                const filePath = `${user.id}/${assignmentId}/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('submissions')
                    .upload(filePath, file);

                if (uploadError) {
                    setFormError('Error uploading submission attachment.');
                    console.error(uploadError);
                    return;
                }

                const { data: publicURLData } = supabase.storage.from('submissions').getPublicUrl(filePath);
                attachmentUrl = publicURLData.publicUrl;
            }

            const { error: subError } = await supabase
                .from('assignment_submissions')
                .upsert({
                    assignment_id: assignmentId,
                    student_id: user.id,
                    submission_text: text,
                    attachment_url: attachmentUrl,
                    submitted_at: new Date().toISOString()
                }, { onConflict: 'assignment_id,student_id' });

            if (subError) throw subError;

            // Clear inputs
            setSubText(prev => ({ ...prev, [assignmentId]: '' }));
            setSubFile(prev => ({ ...prev, [assignmentId]: null }));
            fetchClassData();
        } catch (err: any) {
            console.error(err);
            setFormError(err.message || 'Failed to upload submission.');
        } finally {
            setSubmittingId(null);
        }
    };

    const handleLeaveClass = async () => {
        if (!user || !id) return;
        if (!window.confirm('Are you sure you want to leave this class? You will lose access to all its resources and assignments.')) return;
        const { error } = await supabase
            .from('class_members')
            .delete()
            .eq('user_id', user.id)
            .eq('class_id', id);
        if (!error) navigate('/my-classes');
    };

    const handleDisbandClass = async () => {
        if (!id) return;
        if (!window.confirm('Are you sure you want to disband this class? This will permanently delete the class and all its assignments, announcements, and resources for all students.')) return;
        // Delete all related data (assignments, announcements, resources, class_members)
        await supabase.from('assignments').delete().eq('class_id', id);
        await supabase.from('class_announcements').delete().eq('class_id', id);
        await supabase.from('class_resources').delete().eq('class_id', id);
        await supabase.from('class_members').delete().eq('class_id', id);
        await supabase.from('classes').delete().eq('id', id);
        navigate('/my-classes');
    };

    // Take mock test from assignment JSON
    const handleTakeMockTest = async (assignment: Assignment) => {
        try {
            if (!assignment.file_url) return;
            const res = await fetch(assignment.file_url);
            if (!res.ok) throw new Error('Failed to fetch mock test file');
            const json = await res.json();
            const rawQuestions = Array.isArray(json) ? json : json.questions;
            if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) throw new Error('No questions found in mock file');
            const transformed = rawQuestions.map((q: any, i: number) => ({
                section: q.section || (q.type === 'mcq' ? 'A' : q.type === 'short' ? 'B' : 'C'),
                type: q.type || 'short',
                marks: q.marks ?? (q.type === 'mcq' ? 1 : q.type === 'short' ? 3 : 5),
                question: q.question || q.prompt || `Q${i + 1}`,
                options: Array.isArray(q.options) ? q.options : undefined,
            }));
            const totalMarks = transformed.reduce((sum: number, q: any) => sum + (q.marks || 0), 0);
            const subjectName = (classInfo as any)?.subject || classInfo?.class_name || 'Mock Test';
            navigate('/cbse-exam-session', {
                state: {
                    questions: transformed,
                    selectedSubject: subjectName,
                    totalMarks,
                    useCustomMarks: true,
                    assignmentId: assignment.id,
                    assignmentTitle: assignment.title,
                    classId: classInfo?.id,
                },
            });
        } catch (err) {
            console.error('Failed to start mock test:', err);
            setFormError('Failed to start mock test. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center space-y-8">
                <div className="w-12 h-12 border-2 border-[#8B7355]/20 border-t-[#8B7355] rounded-full animate-spin" />
                <p className="font-semibold text-[#8A8279] text-sm">Loading class...</p>
            </div>
        );
    }

    if (!classInfo && !loading) {
        return (
            <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
                <div className="bg-white p-12 rounded-2xl border border-[#E8E4DF] shadow-sm text-center max-w-lg">
                    <XCircle className="h-16 w-16 text-red-500 mx-auto mb-6 stroke-[2px]" />
                    <h2 className="text-2xl font-bold text-[#2D2A26] mb-3">Class not found</h2>
                    <p className="text-[#8A8279] font-medium mb-8">The requested class does not exist or your credentials have expired.</p>
                    <button
                        onClick={() => navigate('/my-classes')}
                        className="bg-[#2D2A26] text-white px-8 py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all"
                    >
                        Back to My Classes
                    </button>
                </div>
            </div>
        );
    }

    if (!classInfo) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#FAF8F5] animate-fade-in pb-20">
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
                {/* Header */}
                <div className="mb-8 border-b border-[#E8E4DF] pb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="bg-[#8B7355]/10 p-3 rounded-2xl">
                                    <BookOpen className="h-8 w-8 text-[#8B7355] stroke-[2.5px]" />
                                </div>
                                <h1 className="text-3xl font-bold text-[#2D2A26] leading-tight">
                                    {classInfo.class_name}
                                </h1>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-[#8A8279]">Class Code:</span>
                                <span className="font-mono text-sm font-bold text-[#8B7355] bg-[#F5F0E8] border border-[#E8E4DF] px-3 py-1 rounded-lg select-all">
                                    {classInfo.class_code || classInfo.id}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {role === 'student' && (
                                <button
                                    className="flex items-center gap-2 bg-white text-red-600 px-5 py-2.5 font-bold text-sm rounded-[14px] border border-[#E8E4DF] shadow-sm hover:shadow-md hover:bg-red-50 active:scale-95 transition-all"
                                    onClick={handleLeaveClass}
                                >
                                    <LogOut className="h-5 w-5 stroke-[2.5px]" />
                                    Leave Class
                                </button>
                            )}
                            {role === 'teacher' && (
                                <button
                                    className="flex items-center gap-2 bg-white text-red-600 px-5 py-2.5 font-bold text-sm rounded-[14px] border border-[#E8E4DF] shadow-sm hover:shadow-md hover:bg-red-50 active:scale-95 transition-all"
                                    onClick={handleDisbandClass}
                                >
                                    <AlertTriangle className="h-5 w-5 stroke-[2.5px]" />
                                    Disband Class
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-3 mb-8 pb-4 overflow-x-auto no-scrollbar">
                    {TABS.map(t => (
                        <button
                            key={t}
                            className={`px-6 py-3 font-bold text-sm rounded-[14px] transition-all border border-[#E8E4DF] ${activeTab === t
                                ? 'bg-[#8B7355] text-white shadow-sm'
                                : 'bg-white text-[#2D2A26] hover:bg-[#F5F0E8] hover:shadow-sm'
                                }`}
                            onClick={() => setActiveTab(t)}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* Tab Content Container */}
                <div className="bg-white border border-[#E8E4DF] rounded-[24px] shadow-sm p-6 md:p-10 min-h-[500px] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B7355]/[0.03] rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />

                    {activeTab === 'Overview' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-2xl font-bold text-[#2D2A26] mb-2">Class Overview</h2>
                                <p className="text-sm font-medium text-[#8A8279]">View announcements, assignments, and resources at a glance.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-[#FAFBFF] p-6 rounded-2xl border border-[#E8E4DF] hover:shadow-md hover:-translate-y-0.5 transition-all group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#8B7355]/10 flex items-center justify-center group-hover:bg-[#8B7355] transition-colors">
                                            <Bell className="h-5 w-5 text-[#8B7355] group-hover:text-white stroke-[2.5px]" />
                                        </div>
                                        <h3 className="font-bold text-[#2D2A26] text-sm uppercase tracking-wider">Latest Announcement</h3>
                                    </div>
                                    {announcements.length > 0 ? (
                                        <div className="text-[#2D2A26] font-medium text-sm leading-relaxed border-l-2 border-[#8B7355]/20 pl-3">
                                            {announcements[0].message || announcements[0].content}
                                        </div>
                                    ) : (
                                        <div className="text-[#8A8279] font-medium text-sm">No announcements yet.</div>
                                    )}
                                </div>

                                <div className="bg-[#FAFBFF] p-6 rounded-2xl border border-[#E8E4DF] hover:shadow-md hover:-translate-y-0.5 transition-all group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#F5F0E8] flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                                        </div>
                                        <h3 className="font-bold text-[#2D2A26] text-sm uppercase tracking-wider">Latest Assignment</h3>
                                    </div>
                                    {assignments.length > 0 ? (
                                        <div className="text-[#2D2A26] font-medium text-sm leading-relaxed border-l-2 border-[#8B7355]/20 pl-3">
                                            {assignments[0].title}
                                        </div>
                                    ) : (
                                        <div className="text-[#8A8279] font-medium text-sm">No assignments pending.</div>
                                    )}
                                </div>

                                <div className="bg-[#FAFBFF] p-6 rounded-2xl border border-[#E8E4DF] hover:shadow-md hover:-translate-y-0.5 transition-all group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#6B8E6B]/10 flex items-center justify-center">
                                            <LinkIcon className="h-5 w-5 text-[#6B8E6B] stroke-[2.5px]" />
                                        </div>
                                        <h3 className="font-bold text-[#2D2A26] text-sm uppercase tracking-wider">Latest Resource</h3>
                                    </div>
                                    {resources.length > 0 ? (
                                        <div className="text-[#2D2A26] font-medium text-sm leading-relaxed border-l-2 border-[#8B7355]/20 pl-3">
                                            {resources[0].title}
                                        </div>
                                    ) : (
                                        <div className="text-[#8A8279] font-medium text-sm">No resources uploaded.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Assignments' && (
                        <div className="animate-in fade-in duration-300">
                            {role === 'teacher' && (
                                <div className="mb-10 p-6 bg-[#FAFBFF] rounded-2xl border border-[#E8E4DF] shadow-sm">
                                    <h3 className="text-lg font-bold mb-4 text-[#2D2A26] flex items-center gap-2 border-b border-[#E8E4DF] pb-3">
                                        <Plus className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                                        Create Assignment
                                    </h3>
                                    {formError && (
                                        <p className="bg-red-50 text-red-600 font-bold text-xs p-3 rounded-lg border border-red-100 mb-4">
                                            {formError}
                                        </p>
                                    )}
                                    <form onSubmit={handleCreateAssignment} className="space-y-5">
                                        <input
                                            type="text"
                                            placeholder="Assignment title"
                                            value={assignmentTitle}
                                            onChange={e => setAssignmentTitle(e.target.value)}
                                            required
                                            className="w-full px-4 py-3 bg-white border border-[#E8E4DF] rounded-[14px] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50"
                                        />
                                        <textarea
                                            placeholder="Description and details"
                                            value={assignmentDesc}
                                            onChange={e => setAssignmentDesc(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-[#E8E4DF] rounded-[14px] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50 min-h-[120px]"
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-wide text-[#8A8279]">Due Date</label>
                                                <input
                                                    type="date"
                                                    value={assignmentDueDate}
                                                    onChange={e => setAssignmentDueDate(e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-[#E8E4DF] rounded-[14px] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-wide text-[#8A8279]">Attachment</label>
                                                <input
                                                    type="file"
                                                    onChange={e => setAssignmentFile(e.target.files ? e.target.files[0] : null)}
                                                    className="w-full px-4 py-3 bg-white border border-[#E8E4DF] rounded-[14px] font-medium text-[#2D2A26] file:bg-[#F5F0E8] file:text-[#2D2A26] file:border-none file:px-4 file:py-2 file:font-bold file:rounded-lg file:mr-4 file:cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                        <button type="submit" className="bg-[#8B7355] text-white px-8 py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all">
                                            Create Assignment
                                        </button>
                                    </form>
                                </div>
                            )}

                            <h3 className="text-xl font-bold mb-6 text-[#2D2A26] flex items-center gap-3">
                                <div className="bg-[#8B7355]/10 p-2 rounded-xl">
                                    <FileText className="h-6 w-6 text-[#8B7355] stroke-[2.5px]" />
                                </div>
                                Assignments
                            </h3>

                            {assignments.length === 0 ? (
                                <div className="text-center py-16 bg-[#FAFBFF] rounded-2xl border border-dashed border-[#E8E4DF]">
                                    <FileText className="h-12 w-12 text-[#8A8279]/30 mx-auto mb-4 stroke-[2px]" />
                                    <p className="text-[#8A8279] font-medium text-sm">No assignments yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {assignments.map(a => {
                                        const submission = submissions[a.id];
                                        return (
                                            <div key={a.id} className="bg-[#FAFBFF] p-6 rounded-2xl border border-[#E8E4DF] shadow-sm group hover:shadow-md hover:-translate-y-0.5 transition-all">
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-[#E8E4DF] pb-4">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-lg font-bold text-[#2D2A26]">{a.title}</h4>
                                                        {role === 'student' && (
                                                            submission ? (
                                                                submission.grade ? (
                                                                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-100">
                                                                        Graded: {submission.grade}
                                                                    </span>
                                                                ) : (
                                                                    <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-blue-100">
                                                                        Submitted
                                                                    </span>
                                                                )
                                                            ) : (
                                                                <span className="bg-red-50 text-red-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-red-100">
                                                                    Not Submitted
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                    {a.due_date && (
                                                        <div className="bg-[#F5F0E8] text-[#2D2A26] px-3 py-1.5 text-xs font-bold rounded-lg border border-[#E8E4DF] flex items-center gap-2">
                                                            <Clock className="h-4 w-4 stroke-[2.5px]" />
                                                            Due: {new Date(a.due_date).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-[#2D2A26] font-medium leading-relaxed mb-6">{a.description}</p>

                                                <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-[#E8E4DF]">
                                                    {a.file_url && (
                                                        a.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ? (
                                                            <div className="w-full mb-4 bg-white p-4 rounded-xl border border-[#E8E4DF]">
                                                                <img src={a.file_url} alt={a.title} className="max-h-80 w-auto rounded-2xl border border-[#E8E4DF] mx-auto" />
                                                            </div>
                                                        ) : (
                                                            <a
                                                                href={a.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 bg-white text-[#2D2A26] px-4 py-2.5 font-bold text-xs rounded-[14px] border border-[#E8E4DF] shadow-sm hover:shadow-md active:scale-95 transition-all"
                                                            >
                                                                <Download className="h-4 w-4 stroke-[2.5px]" />
                                                                Download File
                                                            </a>
                                                        )
                                                    )}

                                                    {a.file_url && /\.json(\?|$)/i.test(a.file_url) && (
                                                        <button
                                                            className="flex items-center gap-2 bg-[#6B8E6B] text-white px-5 py-2.5 font-bold text-sm rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all"
                                                            onClick={() => handleTakeMockTest(a)}
                                                        >
                                                            <Sparkles className="h-5 w-5 stroke-[2.5px]" />
                                                            Take Mock Test
                                                        </button>
                                                    )}

                                                    <div className="ml-auto flex items-center gap-2 text-xs font-medium text-[#8A8279]">
                                                        <Calendar className="h-4 w-4" />
                                                        Posted: {new Date(a.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>

                                                {/* Student Submission Display or Form */}
                                                {role === 'student' && (
                                                    <div className="mt-4 pt-4 border-t border-[#E8E4DF] bg-[#FAF8F5]/60 p-4 rounded-xl border border-[#E8E4DF]/60">
                                                        {submission ? (
                                                            <div className="space-y-3">
                                                                <h5 className="text-xs font-black uppercase text-[#8A8279] tracking-wider">Your Submission</h5>
                                                                <p className="text-sm font-semibold text-[#2D2A26]">{submission.submission_text || 'No text submitted.'}</p>
                                                                {submission.attachment_url && (
                                                                    <a
                                                                        href={submission.attachment_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                                                                    >
                                                                        <FileText className="w-3.5 h-3.5" /> View Submitted File
                                                                    </a>
                                                                )}
                                                                
                                                                {submission.grade && (
                                                                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg mt-3">
                                                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-1">Teacher Feedback</span>
                                                                        <p className="text-xs font-bold text-emerald-950">{submission.feedback || 'No feedback left.'}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                <h5 className="text-xs font-black uppercase text-[#2D2A26] tracking-wider">Submit Assignment</h5>
                                                                
                                                                <textarea
                                                                    value={subText[a.id] || ''}
                                                                    onChange={(e) => setSubText({ ...subText, [a.id]: e.target.value })}
                                                                    placeholder="Type your submission description or comments..."
                                                                    className="w-full px-4 py-2.5 bg-white border border-[#E8E4DF] rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20"
                                                                    rows={3}
                                                                />

                                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                                    <input
                                                                        type="file"
                                                                        onChange={(e) => setSubFile({ ...subFile, [a.id]: e.target.files ? e.target.files[0] : null })}
                                                                        className="text-xs font-medium file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border file:border-[#E8E4DF] file:bg-[#F5F0E8] file:text-[#2D2A26] file:font-bold file:cursor-pointer"
                                                                    />
                                                                    <button
                                                                        onClick={() => handleUploadSubmission(a.id)}
                                                                        disabled={submittingId === a.id || !(subText[a.id]?.trim() || subFile[a.id])}
                                                                        className="bg-[#8B7355] text-white px-5 py-2 text-xs font-black uppercase rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-40"
                                                                    >
                                                                        {submittingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'Announcements' && (
                        <div className="animate-in fade-in duration-300">
                            {role === 'teacher' && (
                                <div className="mb-10 p-6 bg-[#FAFBFF] rounded-2xl border border-[#E8E4DF] shadow-sm">
                                    <h3 className="text-lg font-bold mb-4 text-[#2D2A26] flex items-center gap-2 border-b border-[#E8E4DF] pb-3">
                                        <Plus className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                                        Post Announcement
                                    </h3>
                                    {formError && (
                                        <p className="bg-red-50 text-red-600 font-bold text-xs p-3 rounded-lg border border-red-100 mb-4">
                                            {formError}
                                        </p>
                                    )}
                                    <form onSubmit={handleCreateAnnouncement}>
                                        <textarea
                                            placeholder="Write your announcement..."
                                            value={announcementContent}
                                            onChange={e => setAnnouncementContent(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-[#E8E4DF] rounded-[14px] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50 min-h-[120px] mb-4"
                                        />
                                        <button type="submit" className="bg-[#8B7355] text-white px-8 py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all">
                                            Post Announcement
                                        </button>
                                    </form>
                                </div>
                            )}

                            <h3 className="text-xl font-bold mb-6 text-[#2D2A26] flex items-center gap-3">
                                <div className="bg-[#8B7355]/10 p-2 rounded-xl">
                                    <Bell className="h-6 w-6 text-[#8B7355] stroke-[2.5px]" />
                                </div>
                                Announcements
                            </h3>

                            {announcements.length === 0 ? (
                                <div className="text-center py-16 bg-[#FAFBFF] rounded-2xl border border-dashed border-[#E8E4DF]">
                                    <Bell className="h-12 w-12 text-[#8A8279]/30 mx-auto mb-4 stroke-[2px]" />
                                    <p className="text-[#8A8279] font-medium text-sm">No announcements yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {announcements.map(a => (
                                        <div key={a.id} className="bg-white p-6 rounded-2xl border border-[#E8E4DF] shadow-sm relative">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8B7355] rounded-l-2xl" />
                                            <div className="text-[#2D2A26] font-medium leading-relaxed mb-4 whitespace-pre-wrap pl-3">{a.message || a.content}</div>
                                            <div className="text-xs font-medium text-[#8A8279] flex items-center gap-2 pt-3 border-t border-[#E8E4DF] pl-3">
                                                <Calendar className="h-4 w-4" />
                                                {new Date(a.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'Resources' && (
                        <div className="animate-in fade-in duration-300">
                            <h3 className="text-xl font-bold mb-6 text-[#2D2A26] flex items-center gap-3">
                                <div className="bg-[#6B8E6B]/10 p-2 rounded-xl">
                                    <LinkIcon className="h-6 w-6 text-[#6B8E6B] stroke-[2.5px]" />
                                </div>
                                Resources
                            </h3>

                            {resources.length === 0 ? (
                                <div className="text-center py-16 bg-[#FAFBFF] rounded-2xl border border-dashed border-[#E8E4DF]">
                                    <LinkIcon className="h-12 w-12 text-[#8A8279]/30 mx-auto mb-4 stroke-[2px]" />
                                    <p className="text-[#8A8279] font-medium text-sm">No resources uploaded yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {resources.map(r => (
                                        <div key={r.id} className="bg-white p-6 rounded-2xl border border-[#E8E4DF] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col group">
                                            <div className="flex-1">
                                                <div className="bg-[#F5F0E8] px-3 py-1 rounded-md inline-block mb-3 text-xs font-bold uppercase tracking-wide text-[#8A8279]">{r.type || 'File'}</div>
                                                <h4 className="text-lg font-bold text-[#2D2A26] mb-4 line-clamp-2">{r.title}</h4>
                                            </div>

                                            <div className="pt-4 border-t border-[#E8E4DF] flex items-center gap-3">
                                                {r.file_url && (
                                                    <a
                                                        href={r.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 flex items-center justify-center gap-2 bg-[#8B7355] text-white px-4 py-2.5 font-bold text-xs rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all"
                                                    >
                                                        <Download className="h-4 w-4 stroke-[2.5px]" />
                                                        Download
                                                    </a>
                                                )}
                                                {r.url && !r.file_url && (
                                                    <a
                                                        href={r.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 flex items-center justify-center gap-2 bg-[#6B8E6B] text-white px-4 py-2.5 font-bold text-xs rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all"
                                                    >
                                                        <LinkIcon className="h-4 w-4 stroke-[2.5px]" />
                                                        Open Link
                                                    </a>
                                                )}
                                            </div>

                                            <div className="text-xs font-medium text-[#8A8279] mt-4 text-right">
                                                Added: {new Date(r.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export { ClassPage };