import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, FileText, Bell, Link as LinkIcon, Download, LogOut, AlertTriangle, Calendar, Clock, Plus } from 'lucide-react';

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
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue"></div>
            </div>
        );
    }

    if (!classInfo && !loading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="glass-panel p-8 rounded-2xl border border-red-500/20 text-center max-w-md">
                    <h2 className="text-2xl font-bold text-red-400 mb-2">Class Not Found</h2>
                    <p className="text-gray-400">The class you are looking for does not exist or you don't have access.</p>
                    <button
                        onClick={() => navigate('/my-classes')}
                        className="mt-6 bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!classInfo) {
        return null;
    }

    return (
        <div className="min-h-screen relative p-4 md:p-8 animate-fade-in">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl -z-10"></div>

            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <BookOpen className="h-8 w-8 text-neon-blue" />
                        {classInfo.class_name}
                    </h1>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <span>Class Code:</span>
                        <span className="font-mono text-neon-blue bg-black/40 px-2 py-1 rounded border border-white/10 select-all">{classInfo.class_code || classInfo.id}</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === tab
                                ? 'bg-neon-blue text-white shadow-lg shadow-neon-blue/20'
                                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
                                }`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="glass-panel rounded-2xl p-6 border border-white/10 min-h-[400px]">
                    {activeTab === 'Overview' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Welcome to {classInfo.class_name}</h2>
                                <p className="text-gray-400">Here you can see announcements, assignments, and resources.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="glass-card p-6 rounded-xl border border-white/10 hover:border-neon-purple/30 transition-colors">
                                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                        <Bell className="h-5 w-5 text-neon-purple" />
                                        Latest Announcement
                                    </h3>
                                    {announcements.length > 0 ? (
                                        <div className="text-gray-300 line-clamp-3">{announcements[0].message || announcements[0].content}</div>
                                    ) : <div className="text-gray-500 italic">No announcements yet.</div>}
                                </div>

                                <div className="glass-card p-6 rounded-xl border border-white/10 hover:border-neon-blue/30 transition-colors">
                                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-neon-blue" />
                                        Latest Assignment
                                    </h3>
                                    {assignments.length > 0 ? (
                                        <div className="text-gray-300 line-clamp-2">{assignments[0].title}</div>
                                    ) : <div className="text-gray-500 italic">No assignments yet.</div>}
                                </div>

                                <div className="glass-card p-6 rounded-xl border border-white/10 hover:border-neon-green/30 transition-colors">
                                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                        <LinkIcon className="h-5 w-5 text-neon-green" />
                                        Latest Resource
                                    </h3>
                                    {resources.length > 0 ? (
                                        <div className="text-gray-300 line-clamp-2">{resources[0].title}</div>
                                    ) : <div className="text-gray-500 italic">No resources yet.</div>}
                                </div>
                            </div>

                            {/* Leave/Disband Class Buttons */}
                            <div className="pt-8 border-t border-white/10">
                                {role === 'student' && (
                                    <button
                                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-6 py-3 rounded-xl transition-colors border border-red-500/20"
                                        onClick={handleLeaveClass}
                                    >
                                        <LogOut className="h-5 w-5" />
                                        Leave Class
                                    </button>
                                )}
                                {role === 'teacher' && (
                                    <button
                                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-6 py-3 rounded-xl transition-colors border border-red-500/20"
                                        onClick={handleDisbandClass}
                                    >
                                        <AlertTriangle className="h-5 w-5" />
                                        Disband Class
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'Assignments' && (
                        <div>
                            {role === 'teacher' && (
                                <form onSubmit={handleCreateAssignment} className="mb-8 p-6 bg-black/40 rounded-xl border border-white/10">
                                    <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                                        <Plus className="h-5 w-5 text-neon-blue" />
                                        Create New Assignment
                                    </h3>
                                    {formError && <p className="text-red-400 mb-4 text-sm bg-red-500/10 p-2 rounded border border-red-500/20">{formError}</p>}
                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            placeholder="Title"
                                            value={assignmentTitle}
                                            onChange={e => setAssignmentTitle(e.target.value)}
                                            required
                                            className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none placeholder-gray-600"
                                        />
                                        <textarea
                                            placeholder="Description"
                                            value={assignmentDesc}
                                            onChange={e => setAssignmentDesc(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none placeholder-gray-600 min-h-[100px]"
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-1">Due Date</label>
                                                <input
                                                    type="date"
                                                    value={assignmentDueDate}
                                                    onChange={e => setAssignmentDueDate(e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-1">Attachment</label>
                                                <input
                                                    type="file"
                                                    onChange={e => setAssignmentFile(e.target.files ? e.target.files[0] : null)}
                                                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neon-blue/10 file:text-neon-blue hover:file:bg-neon-blue/20"
                                                />
                                            </div>
                                        </div>
                                        <button type="submit" className="bg-neon-blue hover:bg-neon-blue/80 text-white px-6 py-3 rounded-xl transition-colors font-semibold shadow-lg shadow-neon-blue/20">
                                            Add Assignment
                                        </button>
                                    </div>
                                </form>
                            )}
                            <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                                <FileText className="h-6 w-6 text-neon-blue" />
                                Assignments
                            </h3>
                            {assignments.length === 0 ? (
                                <div className="text-center py-12 bg-white/5 rounded-xl border border-white/5">
                                    <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-400">No assignments yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {assignments.map(a => (
                                        <div key={a.id} className="glass-card p-6 rounded-xl border border-white/10 hover:border-neon-blue/30 transition-all duration-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="text-lg font-bold text-white">{a.title}</h4>
                                                {a.due_date && (
                                                    <span className="text-xs font-medium px-2 py-1 rounded bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/20 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        Due: {new Date(a.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-300 mb-4 whitespace-pre-wrap">{a.description}</p>

                                            <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-white/5">
                                                {a.file_url && (
                                                    a.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ? (
                                                        <div className="w-full mb-2">
                                                            <img src={a.file_url} alt={a.title} className="max-h-64 rounded-lg border border-white/10" />
                                                        </div>
                                                    ) : (
                                                        <a
                                                            href={a.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 text-neon-blue hover:text-neon-blue/80 bg-neon-blue/10 px-3 py-1.5 rounded-lg transition-colors border border-neon-blue/20"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                            Download Attachment
                                                        </a>
                                                    )
                                                )}

                                                {/* Take Mock Test action if JSON is attached */}
                                                {a.file_url && /\.json(\?|$)/i.test(a.file_url) && (
                                                    <button
                                                        className="flex items-center gap-2 bg-neon-green hover:bg-neon-green/80 text-black font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-neon-green/20"
                                                        onClick={() => handleTakeMockTest(a)}
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                        Take Mock Test
                                                    </button>
                                                )}

                                                <div className="ml-auto text-xs text-gray-500 flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    Posted: {new Date(a.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'Announcements' && (
                        <div>
                            {role === 'teacher' && (
                                <form onSubmit={handleCreateAnnouncement} className="mb-8 p-6 bg-black/40 rounded-xl border border-white/10">
                                    <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                                        <Plus className="h-5 w-5 text-neon-purple" />
                                        Create Announcement
                                    </h3>
                                    {formError && <p className="text-red-400 mb-4 text-sm bg-red-500/10 p-2 rounded border border-red-500/20">{formError}</p>}
                                    <textarea
                                        placeholder="Write your announcement here..."
                                        value={announcementContent}
                                        onChange={e => setAnnouncementContent(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-purple focus:outline-none placeholder-gray-600 min-h-[100px] mb-4"
                                    />
                                    <button type="submit" className="bg-neon-purple hover:bg-neon-purple/80 text-white px-6 py-3 rounded-xl transition-colors font-semibold shadow-lg shadow-neon-purple/20">
                                        Post Announcement
                                    </button>
                                </form>
                            )}
                            <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                                <Bell className="h-6 w-6 text-neon-purple" />
                                Announcements
                            </h3>
                            {announcements.length === 0 ? (
                                <div className="text-center py-12 bg-white/5 rounded-xl border border-white/5">
                                    <Bell className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-400">No announcements yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {announcements.map(a => (
                                        <div key={a.id} className="glass-card p-6 rounded-xl border border-white/10 hover:border-neon-purple/30 transition-all duration-200">
                                            <div className="text-gray-200 whitespace-pre-wrap mb-3">{a.message || a.content}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1 pt-3 border-t border-white/5">
                                                <Calendar className="h-3 w-3" />
                                                Posted: {new Date(a.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'Resources' && (
                        <div>
                            <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                                <LinkIcon className="h-6 w-6 text-neon-green" />
                                Resources
                            </h3>
                            {resources.length === 0 ? (
                                <div className="text-center py-12 bg-white/5 rounded-xl border border-white/5">
                                    <LinkIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-400">No resources yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {resources.map(r => (
                                        <div key={r.id} className="glass-card p-5 rounded-xl border border-white/10 hover:border-neon-green/30 transition-all duration-200 flex flex-col">
                                            <h4 className="font-bold text-white mb-3">{r.title}</h4>

                                            <div className="mt-auto pt-3 flex items-center gap-3">
                                                {r.file_url && (
                                                    <a
                                                        href={r.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-sm text-neon-blue hover:text-neon-blue/80 bg-neon-blue/10 px-3 py-1.5 rounded-lg transition-colors border border-neon-blue/20"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                        Download
                                                    </a>
                                                )}
                                                {r.url && !r.file_url && (
                                                    <a
                                                        href={r.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-sm text-neon-green hover:text-neon-green/80 bg-neon-green/10 px-3 py-1.5 rounded-lg transition-colors border border-neon-green/20"
                                                    >
                                                        <LinkIcon className="h-4 w-4" />
                                                        Open Link
                                                    </a>
                                                )}
                                            </div>

                                            <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-white/5">
                                                {new Date(r.created_at).toLocaleDateString()}
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