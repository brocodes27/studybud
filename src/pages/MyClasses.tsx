import React, { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Class {
    id: string;
    name?: string;
    class_code?: string;
}

const MyClasses = () => {
    const { user, role } = useAuth() as any;
    const [classes, setClasses] = useState<Class[]>([]);
    const [className, setClassName] = useState('');
    const [classId, setClassId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showJoinModal, setShowJoinModal] = useState(false);

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
                .eq('user_id', user.id);
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
        if (!classId.trim()) {
            setError('Class ID is required.');
            return;
        }

        const { error } = await supabase.rpc('join_class', { class_id: classId });

        if (error) {
            setError('Failed to join class. Check the ID and try again.');
            console.error(error);
        } else {
            setClassId('');
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
                <>
                    <button
                        className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 mb-6"
                        onClick={() => setShowJoinModal(true)}
                    >
                        Join Class
                    </button>
                    {showJoinModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
                            <div className="relative bg-black rounded-2xl shadow-2xl p-8 w-full max-w-md mx-auto">
                                <button
                                    className="absolute top-3 right-4 text-gray-400 hover:text-white text-2xl font-bold"
                                    onClick={() => setShowJoinModal(false)}
                                    aria-label="Close"
                                >
                                    &times;
                                </button>
                                <form onSubmit={handleJoinClass}>
                                    <h2 className="text-xl font-semibold mb-4 text-white">Join a Class</h2>
                                    <input
                                        type="text"
                                        placeholder="Enter Class ID"
                                        value={classId}
                                        onChange={(e) => setClassId(e.target.value)}
                                        className="w-full p-3 border border-gray-700 rounded mb-4 bg-gray-900 text-white placeholder-gray-400"
                                    />
                                    <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 w-full font-semibold">
                                        Join Class
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <p>Loading classes...</p>
                ) : (
                    // Debug: log the classes array
                    console.log('Classes:', classes),
                    classes.map((c) => (
                        <Link to={`/class/${c.id}`} key={c.id} className="block p-4 bg-gray-900 rounded-lg shadow hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-bold text-white">{c.name || 'Unnamed Class'}</h3>
                            {!c.name && <p className="text-xs text-gray-400">ID: {c.id}</p>}
                            {role === 'teacher' && c.class_code && <p className="text-sm text-gray-400">Code: {c.class_code}</p>}
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
};

export default MyClasses; 