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
            <div className="min-h-screen bg-neo-bg flex flex-col items-center justify-center space-y-8">
                <div className="w-20 h-20 border-8 border-black border-t-neo-accent animate-spin" />
                <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">LOADING_UNIT_DATA...</h2>
            </div>
        );
    }

    if (!classInfo && !loading) {
        return (
            <div className="min-h-screen bg-neo-bg flex items-center justify-center p-4">
                <div className="bg-white p-12 border-8 border-black shadow-[16px_16px_0px_0px_#000] text-center max-w-lg">
                    <XCircle className="h-20 w-20 text-red-600 mx-auto mb-6 stroke-[3px]" />
                    <h2 className="text-4xl font-black text-black uppercase tracking-tighter italic mb-4">UNIT_NOT_FOUND</h2>
                    <p className="text-black font-bold uppercase tracking-tight mb-8">THE REQUESTED CLASS UNIT DOES NOT EXIST OR YOUR CREDENTIALS HAVE EXPIRED.</p>
                    <button
                        onClick={() => navigate('/my-classes')}
                        className="bg-black text-white px-10 py-4 font-black uppercase tracking-widest text-xl border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                        RETURN_TO_BASE
                    </button>
                </div>
            </div>
        );
    }

    if (!classInfo) {
        return null;
    }

    return (
        <div className="min-h-screen bg-neo-bg animate-fade-in pb-20">
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
                {/* Header */}
                <div className="mb-12 border-b-8 border-black pb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="bg-neo-accent p-3 border-4 border-black shadow-[4px_4px_0px_0px_#000] -rotate-2">
                                    <BookOpen className="h-8 w-8 text-white stroke-[3px]" />
                                </div>
                                <h1 className="text-4xl font-black text-black uppercase tracking-tighter italic leading-none whitespace-nowrap">
                                    {classInfo.class_name}
                                </h1>
                            </div>
                            <div className="flex items-center gap-3 mt-4">
                                <span className="text-xs font-black uppercase tracking-widest text-black/60">UNIT_SYNC_ID:</span>
                                <span className="font-mono text-lg font-black text-neo-accent bg-white border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_#000] select-all">
                                    {classInfo.class_code || classInfo.id}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {role === 'student' && (
                                <button
                                    className="flex items-center gap-2 bg-white text-red-600 px-6 py-3 font-black uppercase tracking-widest text-sm border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                                    onClick={handleLeaveClass}
                                >
                                    <LogOut className="h-5 w-5 stroke-[3px]" />
                                    ABANDON_UNIT
                                </button>
                            )}
                            {role === 'teacher' && (
                                <button
                                    className="flex items-center gap-2 bg-white text-red-600 px-6 py-3 font-black uppercase tracking-widest text-sm border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                                    onClick={handleDisbandClass}
                                >
                                    <AlertTriangle className="h-5 w-5 stroke-[3px]" />
                                    TERMINATE_UNIT
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-4 mb-10 pb-4 overflow-x-auto no-scrollbar">
                    {TABS.map(t => (
                        <button
                            key={t}
                            className={`px-8 py-4 font-black uppercase tracking-widest text-sm transition-all border-4 border-black ${activeTab === t
                                ? 'bg-neo-accent text-white shadow-[6px_6px_0px_0px_#000] -translate-y-1'
                                : 'bg-white text-black hover:bg-neo-secondary hover:shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5'
                                }`}
                            onClick={() => setActiveTab(t)}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* Tab Content Container */}
                <div className="bg-white border-8 border-black shadow-[16px_16px_0px_0px_#000] p-8 md:p-12 min-h-[500px] relative overflow-hidden">
                    {/* Visual noise/accent */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-black/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />

                    {activeTab === 'Overview' && (
                        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-4xl font-black text-black uppercase tracking-tighter italic mb-4 border-b-4 border-black inline-block pb-2">
                                    UNIT_INTELLIGENCE
                                </h2>
                                <p className="text-lg font-bold text-black/60 uppercase tracking-tight">STATUS_REPORT: ALL SYSTEMS OPERATIONAL. VIEW TASKS AND UPDATES BELOW.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="bg-neo-bg p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:-translate-y-1 transition-transform group">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="bg-neo-accent p-3 border-2 border-black group-hover:bg-white transition-colors">
                                            <Bell className="h-6 w-6 text-white group-hover:text-neo-accent stroke-[3px]" />
                                        </div>
                                        <h3 className="font-black text-black uppercase tracking-widest">LATEST_INTEL</h3>
                                    </div>
                                    {announcements.length > 0 ? (
                                        <div className="text-black font-bold text-sm leading-relaxed border-l-4 border-black pl-4">
                                            {announcements[0].message || announcements[0].content}
                                        </div>
                                    ) : (
                                        <div className="text-black/30 font-black uppercase tracking-widest text-xs italic">SYSTEM_IDLE: NO_ACTIVE_UPDATES</div>
                                    )}
                                </div>

                                <div className="bg-neo-bg p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:-translate-y-1 transition-transform group">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="bg-neo-secondary p-3 border-2 border-black group-hover:bg-white transition-colors">
                                            <FileText className="h-6 w-6 text-black stroke-[3px]" />
                                        </div>
                                        <h3 className="font-black text-black uppercase tracking-widest">ACTIVE_MISSION</h3>
                                    </div>
                                    {assignments.length > 0 ? (
                                        <div className="text-black font-bold text-sm leading-relaxed border-l-4 border-black pl-4">
                                            {assignments[0].title}
                                        </div>
                                    ) : (
                                        <div className="text-black/30 font-black uppercase tracking-widest text-xs italic">MISSION_NULL: NO_ASSIGNMENTS_PENDING</div>
                                    )}
                                </div>

                                <div className="bg-neo-bg p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:-translate-y-1 transition-transform group">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="bg-neo-green p-3 border-2 border-black group-hover:bg-white transition-colors">
                                            <LinkIcon className="h-6 w-6 text-black stroke-[3px]" />
                                        </div>
                                        <h3 className="font-black text-black uppercase tracking-widest">CORE_RESOURCES</h3>
                                    </div>
                                    {resources.length > 0 ? (
                                        <div className="text-black font-bold text-sm leading-relaxed border-l-4 border-black pl-4">
                                            {resources[0].title}
                                        </div>
                                    ) : (
                                        <div className="text-black/30 font-black uppercase tracking-widest text-xs italic">DATABASE_EMPTY: NO_RESOURCES_SYNCED</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Assignments' && (
                        <div className="animate-in fade-in duration-300">
                            {role === 'teacher' && (
                                <div className="mb-12 p-8 bg-neo-bg border-4 border-black shadow-[8px_8px_0px_0px_#000]">
                                    <h3 className="text-xl font-black mb-6 text-black uppercase tracking-tighter italic flex items-center gap-3 border-b-2 border-black pb-2">
                                        <Plus className="h-6 w-6 text-black stroke-[4px]" />
                                        DEPLOY_NEW_MISSION
                                    </h3>
                                    {formError && (
                                        <p className="bg-red-600 text-white font-black uppercase tracking-widest text-xs p-3 border-2 border-black mb-6">
                                            ERROR: {formError}
                                        </p>
                                    )}
                                    <form onSubmit={handleCreateAssignment} className="space-y-6">
                                        <input
                                            type="text"
                                            placeholder="MISSION_TITLE"
                                            value={assignmentTitle}
                                            onChange={e => setAssignmentTitle(e.target.value)}
                                            required
                                            className="w-full px-6 py-4 bg-white border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:text-black/20"
                                        />
                                        <textarea
                                            placeholder="MISSION_PARAMETERS_&_DETAILS"
                                            value={assignmentDesc}
                                            onChange={e => setAssignmentDesc(e.target.value)}
                                            className="w-full px-6 py-4 bg-white border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:text-black/20 min-h-[120px]"
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60 ml-2">DEADLINE_TIMESTAMP</label>
                                                <input
                                                    type="date"
                                                    value={assignmentDueDate}
                                                    onChange={e => setAssignmentDueDate(e.target.value)}
                                                    className="w-full px-6 py-4 bg-white border-4 border-black font-black uppercase text-black focus:outline-none focus:bg-neo-secondary transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60 ml-2">INTEL_ATTACHMENT</label>
                                                <input
                                                    type="file"
                                                    onChange={e => setAssignmentFile(e.target.files ? e.target.files[0] : null)}
                                                    className="w-full px-6 py-3.5 bg-white border-4 border-black font-bold text-black file:bg-black file:text-white file:border-none file:px-4 file:py-1 file:font-black file:uppercase file:text-[10px] file:mr-4 file:cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                        <button type="submit" className="bg-neo-accent text-white px-10 py-5 font-black uppercase tracking-widest text-xl border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 transition-all">
                                            AUTHORIZE_MISSION
                                        </button>
                                    </form>
                                </div>
                            )}

                            <h3 className="text-3xl font-black mb-8 text-black uppercase tracking-tighter italic flex items-center gap-4">
                                <div className="bg-neo-accent p-2 border-2 border-black rotate-3">
                                    <FileText className="h-8 w-8 text-white stroke-[3px]" />
                                </div>
                                ACTIVE_MISSIONS
                            </h3>

                            {assignments.length === 0 ? (
                                <div className="text-center py-20 bg-neo-bg border-4 border-black border-dashed">
                                    <FileText className="h-20 w-20 text-black/10 mx-auto mb-6 stroke-[2px]" />
                                    <p className="text-black font-black uppercase tracking-widest italic opacity-40">NO_ASSIGNMENTS_CURRENTLY_LOGGED</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {assignments.map(a => (
                                        <div key={a.id} className="bg-white p-8 border-4 border-black shadow-[10px_10px_0px_0px_#000] group hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[14px_14px_0px_0px_#000] transition-all">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b-2 border-black pb-4">
                                                <h4 className="text-2xl font-black text-black uppercase tracking-tighter italic">{a.title}</h4>
                                                {a.due_date && (
                                                    <div className="bg-neo-secondary text-black px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_#000] flex items-center gap-2">
                                                        <Clock className="h-4 w-4 stroke-[3px]" />
                                                        EXPIRY: {new Date(a.due_date).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-black font-bold leading-relaxed mb-8 border-l-8 border-neo-accent/20 pl-6">{a.description}</p>

                                            <div className="flex flex-wrap items-center gap-6 mt-8 pt-6 border-t-2 border-black/10">
                                                {a.file_url && (
                                                    a.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ? (
                                                        <div className="w-full mb-4 bg-neo-bg p-4 border-4 border-black shadow-[6px_6px_0px_0px_#000]">
                                                            <img src={a.file_url} alt={a.title} className="max-h-80 w-auto rounded-none border-2 border-black mx-auto" />
                                                        </div>
                                                    ) : (
                                                        <a
                                                            href={a.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-3 bg-white text-black px-6 py-3 font-black uppercase tracking-widest text-xs border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                                                        >
                                                            <Download className="h-4 w-4 stroke-[3px]" />
                                                            DOWNLOAD_INTEL
                                                        </a>
                                                    )
                                                )}

                                                {a.file_url && /\.json(\?|$)/i.test(a.file_url) && (
                                                    <button
                                                        className="flex items-center gap-3 bg-neo-green text-black px-8 py-3 font-black uppercase tracking-widest text-sm border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                                                        onClick={() => handleTakeMockTest(a)}
                                                    >
                                                        <Sparkles className="h-5 w-5 stroke-[3px]" />
                                                        ENGAGE_SIMULATION
                                                    </button>
                                                )}

                                                <div className="ml-auto flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-black/40">
                                                    <Calendar className="h-4 w-4" />
                                                    LOGGED: {new Date(a.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'Announcements' && (
                        <div className="animate-in fade-in duration-300">
                            {role === 'teacher' && (
                                <div className="mb-12 p-8 bg-neo-bg border-4 border-black shadow-[8px_8px_0px_0px_#000]">
                                    <h3 className="text-xl font-black mb-6 text-black uppercase tracking-tighter italic flex items-center gap-3 border-b-2 border-black pb-2">
                                        <Plus className="h-6 w-6 text-black stroke-[4px]" />
                                        BROADCAST_UPDATE
                                    </h3>
                                    {formError && (
                                        <p className="bg-red-600 text-white font-black uppercase tracking-widest text-xs p-3 border-2 border-black mb-6">
                                            ERROR: {formError}
                                        </p>
                                    )}
                                    <form onSubmit={handleCreateAnnouncement}>
                                        <textarea
                                            placeholder="ENTER_TRANSMISSION_DATA..."
                                            value={announcementContent}
                                            onChange={e => setAnnouncementContent(e.target.value)}
                                            className="w-full px-6 py-4 bg-white border-4 border-black font-bold text-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:text-black/20 min-h-[120px] mb-8"
                                        />
                                        <button type="submit" className="bg-neo-accent text-white px-10 py-5 font-black uppercase tracking-widest text-xl border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 transition-all">
                                            BROADCAST_NOW
                                        </button>
                                    </form>
                                </div>
                            )}

                            <h3 className="text-3xl font-black mb-8 text-black uppercase tracking-tighter italic flex items-center gap-4">
                                <div className="bg-neo-accent p-2 border-2 border-black -rotate-3">
                                    <Bell className="h-8 w-8 text-white stroke-[3px]" />
                                </div>
                                UNIT_ANNOUNCEMENTS
                            </h3>

                            {announcements.length === 0 ? (
                                <div className="text-center py-20 bg-neo-bg border-4 border-black border-dashed">
                                    <Bell className="h-20 w-20 text-black/10 mx-auto mb-6 stroke-[2px]" />
                                    <p className="text-black font-black uppercase tracking-widest italic opacity-40">NO_COMMUNICATIONS_EXCHANGED</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {announcements.map(a => (
                                        <div key={a.id} className="bg-white p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000] relative">
                                            <div className="absolute top-0 left-0 w-2 h-full bg-neo-accent" />
                                            <div className="text-black font-bold text-lg leading-relaxed mb-6 whitespace-pre-wrap">{a.message || a.content}</div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-black/40 flex items-center gap-2 pt-4 border-t-2 border-black/5">
                                                <Calendar className="h-4 w-4" />
                                                TIMESTAMP: {new Date(a.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'Resources' && (
                        <div className="animate-in fade-in duration-300">
                            <h3 className="text-3xl font-black mb-10 text-black uppercase tracking-tighter italic flex items-center gap-4">
                                <div className="bg-neo-green p-2 border-2 border-black rotate-2">
                                    <LinkIcon className="h-8 w-8 text-black stroke-[3px]" />
                                </div>
                                DATABASE_RESOURCES
                            </h3>

                            {resources.length === 0 ? (
                                <div className="text-center py-20 bg-neo-bg border-4 border-black border-dashed">
                                    <LinkIcon className="h-20 w-20 text-black/10 mx-auto mb-6 stroke-[2px]" />
                                    <p className="text-black font-black uppercase tracking-widest italic opacity-40">RESOURCE_VAULT_EMPTY</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {resources.map(r => (
                                        <div key={r.id} className="bg-white p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex flex-col group">
                                            <div className="flex-1">
                                                <div className="bg-neo-secondary/10 px-3 py-1 border-2 border-black inline-block mb-4 text-[10px] font-black uppercase tracking-widest">CONTENT_TYPE: {r.type || 'RAW_DATA'}</div>
                                                <h4 className="text-xl font-black text-black uppercase tracking-tight italic mb-6 line-clamp-2">{r.title}</h4>
                                            </div>

                                            <div className="pt-6 border-t-2 border-black flex items-center gap-4">
                                                {r.file_url && (
                                                    <a
                                                        href={r.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 flex items-center justify-center gap-3 bg-neo-accent text-white px-6 py-3 font-black uppercase tracking-widest text-xs border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-none transition-all"
                                                    >
                                                        <Download className="h-4 w-4 stroke-[3px]" />
                                                        FETCH_FILE
                                                    </a>
                                                )}
                                                {r.url && !r.file_url && (
                                                    <a
                                                        href={r.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 flex items-center justify-center gap-3 bg-neo-green text-black px-6 py-3 font-black uppercase tracking-widest text-xs border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-none transition-all"
                                                    >
                                                        <LinkIcon className="h-4 w-4 stroke-[3px]" />
                                                        EXTERNAL_LINK
                                                    </a>
                                                )}
                                            </div>

                                            <div className="text-[10px] font-black uppercase tracking-widest text-black/40 mt-6 text-right">
                                                SYNCED: {new Date(r.created_at).toLocaleDateString()}
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