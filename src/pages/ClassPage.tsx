import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ClassInfo {
    id: string;
    teacher_id: string;
    class_name: string;
    class_code: string;
    created_at: string;
}

interface Assignment {
    id: string;
    class_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    file_url: string | null;
    created_at: string;
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
        
        if(assignmentsError) console.error('Error fetching assignments:', assignmentsError);
        else {
            setAssignments(assignmentsData);
            console.log('Assignments:', assignmentsData);
        }

        // Fetch announcements (FIX: use class_announcements)
        const { data: announcementsData, error: announcementsError } = await supabase
            .from('class_announcements')
            .select('*')
            .eq('class_id', id)
            .order('created_at', { ascending: false });

        if(announcementsError) console.error('Error fetching announcements:', announcementsError);
        else {
            setAnnouncements(announcementsData);
            console.log('Announcements:', announcementsData);
        }

        // Fetch resources
        const { data: resourcesData, error: resourcesError } = await supabase
            .from('class_resources')
            .select('*')
            .eq('class_id', id)
            .order('created_at', { ascending: false });

        if(resourcesError) console.error('Error fetching resources:', resourcesError);
        else {
            setResources(resourcesData);
            console.log('Resources:', resourcesData);
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
            const { data, error: uploadError } = await supabase.storage
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

    if (loading) {
        return <div>Loading class data...</div>;
    }

    if (!classInfo && !loading) {
        return <div>Class not found.</div>;
    }

    if (!classInfo) {
        // Still loading or not yet set
        return null;
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">{classInfo.class_name}</h1>
            <p className="mb-4">Class Code: <code>{classInfo.class_code}</code></p>
            
            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-700">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className={`px-4 py-2 font-semibold focus:outline-none transition-colors duration-200 ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>
            {/* Tab Content */}
            {activeTab === 'Overview' && (
                <div className="text-gray-300">
                    <h2 className="font-bold text-lg mb-2">Welcome to the class overview.</h2>
                    <p className="mb-4">Here you can see announcements, assignments, and resources.</p>
                    <div className="mb-4">
                        <h3 className="font-semibold text-white">Latest Announcement</h3>
                        {announcements.length > 0 ? (
                            <div className="bg-gray-800 p-2 rounded mb-2">{announcements[0].message || announcements[0].content}</div>
                        ) : <div className="text-gray-500">No announcements yet.</div>}
                    </div>
                    <div className="mb-4">
                        <h3 className="font-semibold text-white">Latest Assignment</h3>
                        {assignments.length > 0 ? (
                            <div className="bg-gray-800 p-2 rounded mb-2">{assignments[0].title}</div>
                        ) : <div className="text-gray-500">No assignments yet.</div>}
                    </div>
                    <div className="mb-4">
                        <h3 className="font-semibold text-white">Latest Resource</h3>
                        {resources.length > 0 ? (
                            <div className="bg-gray-800 p-2 rounded mb-2">{resources[0].title}</div>
                        ) : <div className="text-gray-500">No resources yet.</div>}
                    </div>
                    {/* Leave/Disband Class Buttons */}
                    <div className="mt-6 flex gap-4">
                        {role === 'student' && (
                            <button
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow"
                                onClick={handleLeaveClass}
                            >
                                Leave Class
                            </button>
                        )}
                        {role === 'teacher' && (
                            <button
                                className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded shadow"
                                onClick={handleDisbandClass}
                            >
                                Disband Class
                            </button>
                        )}
                    </div>
                </div>
            )}
            {activeTab === 'Assignments' && (
                <div>
                    {role === 'teacher' && (
                        <form onSubmit={handleCreateAssignment} className="mb-6 p-4 bg-gray-800 rounded-lg">
                            <h3 className="font-bold mb-2 text-white">Create New Assignment</h3>
                            {formError && <p className="text-red-500">{formError}</p>}
                            <input type="text" placeholder="Title" value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} required className="w-full p-2 mb-2 border rounded" />
                            <textarea placeholder="Description" value={assignmentDesc} onChange={e => setAssignmentDesc(e.target.value)} className="w-full p-2 mb-2 border rounded" />
                            <input type="date" value={assignmentDueDate} onChange={e => setAssignmentDueDate(e.target.value)} className="w-full p-2 mb-2 border rounded" />
                            <input type="file" onChange={e => setAssignmentFile(e.target.files ? e.target.files[0] : null)} className="w-full p-2 mb-2 border rounded" />
                            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Add Assignment</button>
                        </form>
                    )}
                    <h3 className="font-bold mb-2 text-white">Assignments</h3>
                    {assignments.length === 0 ? (
                        <div className="text-gray-400">No assignments yet.</div>
                    ) : (
                        assignments.map(a => (
                            <div key={a.id} className="bg-gray-800 p-4 rounded-lg mb-4">
                                <div className="font-semibold text-blue-300">{a.title}</div>
                                <div className="text-gray-200 mb-2">{a.description}</div>
                                {a.due_date && <div className="text-xs text-yellow-400">Due: {new Date(a.due_date).toLocaleDateString()}</div>}
                                {a.file_url && (
                                    a.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ? (
                                        <img src={a.file_url} alt={a.title} className="max-h-48 rounded mt-2" style={{ maxWidth: '100%' }} />
                                    ) : (
                                        <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Download File</a>
                                    )
                                )}
                                <div className="text-xs text-gray-500 mt-2">{new Date(a.created_at).toLocaleString()}</div>
                            </div>
                        ))
                    )}
                </div>
            )}
            {activeTab === 'Announcements' && (
                <div>
                    {role === 'teacher' && (
                        <form onSubmit={handleCreateAnnouncement} className="mb-6 p-4 bg-gray-800 rounded-lg">
                            <h3 className="font-bold mb-2 text-white">Create Announcement</h3>
                            {formError && <p className="text-red-500">{formError}</p>}
                            <textarea placeholder="Announcement" value={announcementContent} onChange={e => setAnnouncementContent(e.target.value)} className="w-full p-2 mb-2 border rounded" />
                            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Add Announcement</button>
                        </form>
                    )}
                    <h3 className="font-bold mb-2 text-white">Announcements</h3>
                    {announcements.length === 0 ? (
                        <div className="text-gray-400">No announcements yet.</div>
                    ) : (
                        announcements.map(a => (
                            <div key={a.id} className="bg-gray-800 p-4 rounded-lg mb-4">
                                <div className="text-gray-200">{a.message || a.content}</div>
                                <div className="text-xs text-gray-500 mt-2">{new Date(a.created_at).toLocaleString()}</div>
                            </div>
                        ))
                    )}
                </div>
            )}
            {activeTab === 'Resources' && (
                <div>
                    <h3 className="font-bold mb-2 text-white">Resources</h3>
                    {resources.length === 0 ? (
                        <div className="text-gray-400">No resources yet.</div>
                    ) : (
                        resources.map(r => (
                            <div key={r.id} className="bg-gray-800 p-4 rounded-lg mb-4">
                                <div className="font-semibold text-blue-300">{r.title}</div>
                                {r.file_url && (
                                    <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Download File</a>
                                )}
                                {r.url && !r.file_url && (
                                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Open Link</a>
                                )}
                                <div className="text-xs text-gray-500 mt-2">{new Date(r.created_at).toLocaleString()}</div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export { ClassPage }; 