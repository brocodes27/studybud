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
    content: string;
    created_at: string;
}

const ClassPage = () => {
    const { id } = useParams<{ id: string }>();
    const { user, role } = useAuth();
    const navigate = useNavigate();
    const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
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

        if (classError || !classData) {
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
        else setAssignments(assignmentsData);

        // Fetch announcements
        const { data: announcementsData, error: announcementsError } = await supabase
            .from('announcements')
            .select('*')
            .eq('class_id', id)
            .order('created_at', { ascending: false });

        if(announcementsError) console.error('Error fetching announcements:', announcementsError);
        else setAnnouncements(announcementsData);

        setLoading(false);
    }, [id, user, navigate]);

    useEffect(() => {
        fetchClassData();
    }, [fetchClassData]);

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
        if (!announcementContent.trim() || !id) return;

        const { error } = await supabase.from('announcements').insert({
            class_id: id,
            content: announcementContent,
        });

        if (error) {
            setFormError('Failed to post announcement.');
        } else {
            setAnnouncementContent('');
            setFormError('');
            fetchClassData(); // Refresh list
        }
    };

    if (loading) {
        return <div>Loading class data...</div>;
    }

    if (!classInfo) {
        return <div>Class not found.</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">{classInfo.class_name}</h1>
            <p className="mb-4">Class Code: <code>{classInfo.class_code}</code></p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-semibold mb-2">Assignments</h2>
                    {role === 'teacher' && (
                        <form onSubmit={handleCreateAssignment} className="mb-6 p-4 bg-gray-100 rounded-lg">
                            <h3 className="font-bold mb-2">Create New Assignment</h3>
                            {formError && <p className="text-red-500">{formError}</p>}
                            <input type="text" placeholder="Title" value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} required className="w-full p-2 mb-2 border rounded" />
                            <textarea placeholder="Description" value={assignmentDesc} onChange={e => setAssignmentDesc(e.target.value)} className="w-full p-2 mb-2 border rounded" />
                            <input type="date" value={assignmentDueDate} onChange={e => setAssignmentDueDate(e.target.value)} className="w-full p-2 mb-2 border rounded" />
                            <input type="file" onChange={e => setAssignmentFile(e.target.files ? e.target.files[0] : null)} className="w-full p-2 mb-2 border rounded" />
                            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Add Assignment</button>
                        </form>
                    )}
                    <div className="space-y-4">
                        {assignments.map(a => (
                            <div key={a.id} className="p-4 bg-white rounded-lg shadow">
                                <h4 className="font-bold">{a.title}</h4>
                                <p>{a.description}</p>
                                {a.due_date && <p className="text-sm text-gray-600">Due: {new Date(a.due_date).toLocaleDateString()}</p>}
                                {a.file_url && <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Download File</a>}
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h2 className="text-xl font-semibold mb-2">Announcements</h2>
                    {role === 'teacher' && (
                        <form onSubmit={handleCreateAnnouncement} className="mb-6 p-4 bg-gray-100 rounded-lg">
                             <h3 className="font-bold mb-2">Post New Announcement</h3>
                            <textarea placeholder="Type your announcement..." value={announcementContent} onChange={e => setAnnouncementContent(e.target.value)} required className="w-full p-2 mb-2 border rounded" />
                            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Post</button>
                        </form>
                    )}
                    <div className="space-y-4">
                        {announcements.map(a => (
                            <div key={a.id} className="p-4 bg-white rounded-lg shadow">
                                <p>{a.content}</p>
                                <p className="text-xs text-gray-500 mt-2">{new Date(a.created_at).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClassPage; 