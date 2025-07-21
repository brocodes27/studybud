import React, { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Class {
    id: string;
    class_name: string;
    class_code: string;
}

const MyClasses = () => {
    const { user, role } = useAuth();
    const [classes, setClasses] = useState<Class[]>([]);
    const [className, setClassName] = useState('');
    const [classCode, setClassCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClasses();
    }, [user, role]);

    const fetchClasses = async () => {
        if (!user) return;
        setLoading(true);

        let query;
        if (role === 'teacher') {
            query = supabase.from('classes').select('*').eq('teacher_id', user.id);
        } else {
            query = supabase
                .from('class_members')
                .select('classes(*)')
                .eq('student_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
            setError('Failed to fetch classes.');
            console.error(error);
        } else {
            if (role === 'teacher') {
                setClasses(data as Class[]);
            } else {
                // When fetching through class_members, the classes are nested
                const studentClasses = data.map((item: any) => item.classes).filter(Boolean);
                setClasses(studentClasses as Class[]);
            }
        }
        setLoading(false);
    };

    const handleCreateClass = async (e: FormEvent) => {
        e.preventDefault();
        if (!className.trim()) {
            setError('Class name is required.');
            return;
        }

        const { data, error } = await supabase.rpc('create_class', { class_name: className });

        if (error) {
            setError('Failed to create class.');
            console.error(error);
        } else {
            setClassName('');
            fetchClasses(); // Refresh list
        }
    };

    const handleJoinClass = async (e: FormEvent) => {
        e.preventDefault();
        if (!classCode.trim()) {
            setError('Class code is required.');
            return;
        }

        const { error } = await supabase.rpc('join_class', { class_code: classCode });

        if (error) {
            setError('Failed to join class. Check the code and try again.');
            console.error(error);
        } else {
            setClassCode('');
            fetchClasses(); // Refresh list
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">My Classes</h1>

            {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{error}</p>}

            {role === 'teacher' && (
                <form onSubmit={handleCreateClass} className="mb-6 p-4 bg-gray-100 rounded-lg">
                    <h2 className="text-xl font-semibold mb-2">Create a New Class</h2>
                    <input
                        type="text"
                        placeholder="Class Name"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        className="w-full p-2 border rounded mb-2"
                    />
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Create Class
                    </button>
                </form>
            )}

            {role === 'student' && (
                <form onSubmit={handleJoinClass} className="mb-6 p-4 bg-gray-100 rounded-lg">
                    <h2 className="text-xl font-semibold mb-2">Join a Class</h2>
                    <input
                        type="text"
                        placeholder="Enter Class Code"
                        value={classCode}
                        onChange={(e) => setClassCode(e.target.value)}
                        className="w-full p-2 border rounded mb-2"
                    />
                    <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                        Join Class
                    </button>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <p>Loading classes...</p>
                ) : (
                    classes.map((c) => (
                        <Link to={`/class/${c.id}`} key={c.id} className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-bold">{c.class_name}</h3>
                            {role === 'teacher' && <p className="text-sm text-gray-600">Code: {c.class_code}</p>}
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
};

export default MyClasses; 