import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Plus, Users, X } from 'lucide-react';

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

        const { error } = await supabase.rpc('create_class', { class_name: className });

        if (error) {
            setError('Failed to create class.');
            console.error(error);
        } else {
            setClassName('');
            fetchClasses();
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
            setShowJoinModal(false);
            fetchClasses();
        }
    };

    return (
        <div className="min-h-screen relative p-4 md:p-8 animate-fade-in">
            {/* Enhanced Background Glows */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-neon-blue/10 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-neon-green/5 rounded-full blur-3xl -z-10"></div>

            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
                    <div>
                        <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
                            <div className="bg-gradient-to-br from-neon-blue to-blue-600 p-3 rounded-2xl shadow-lg shadow-neon-blue/30">
                                <BookOpen className="h-8 w-8 text-white" />
                            </div>
                            My Classes
                        </h1>
                        <p className="text-gray-400 text-sm ml-0 md:ml-16">
                            {role === 'teacher' ? 'Manage and create your classes' : 'Join and access your enrolled classes'}
                        </p>
                    </div>
                    {role === 'student' && (
                        <button
                            className="group relative bg-gradient-to-r from-neon-blue via-blue-600 to-blue-700 text-white px-6 py-3.5 rounded-xl hover:shadow-xl hover:shadow-neon-blue/40 transition-all duration-300 flex items-center gap-2 hover:scale-105"
                            onClick={() => setShowJoinModal(true)}
                        >
                            <div className="absolute inset-0 bg-white/10 rounded-xl blur group-hover:blur-md transition-all"></div>
                            <Plus className="h-5 w-5 relative z-10" />
                            <span className="relative z-10 font-semibold">Join Class</span>
                        </button>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/30 p-4 rounded-2xl text-red-400 mb-8 flex items-center gap-3 backdrop-blur-sm">
                        <div className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="flex-1">{error}</span>
                    </div>
                )}

                {/* Teacher: Create Class Form */}
                {role === 'teacher' && (
                    <form onSubmit={handleCreateClass} className="mb-10 p-8 glass-panel rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-gradient-to-br from-neon-green to-green-600 p-2.5 rounded-xl shadow-lg shadow-neon-green/30">
                                <Plus className="h-5 w-5 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Create a New Class</h2>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <input
                                type="text"
                                placeholder="Enter class name (e.g., 'Physics 12A')"
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                className="flex-1 px-5 py-4 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-green focus:shadow-lg focus:shadow-neon-green/20 focus:outline-none placeholder-gray-500 transition-all duration-200"
                            />
                            <button
                                type="submit"
                                className="group relative bg-gradient-to-r from-neon-green to-green-600 hover:from-neon-green/90 hover:to-green-600/90 text-black font-bold px-8 py-4 rounded-xl transition-all duration-200 shadow-lg shadow-neon-green/30 hover:shadow-xl hover:shadow-neon-green/40 hover:scale-105"
                            >
                                <div className="absolute inset-0 bg-white/10 rounded-xl blur group-hover:blur-md transition-all"></div>
                                <span className="relative z-10">Create Class</span>
                            </button>
                        </div>
                    </form>
                )}

                {/* Join Class Modal */}
                {showJoinModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                        <div className="relative glass-panel rounded-3xl border border-white/20 shadow-2xl p-10 w-full max-w-lg mx-auto animate-scale-in">
                            <div className="absolute -inset-1 bg-gradient-to-r from-neon-blue/20 to-blue-600/20 rounded-3xl blur-xl -z-10"></div>

                            <button
                                className="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg"
                                onClick={() => setShowJoinModal(false)}
                                aria-label="Close"
                            >
                                <X className="h-6 w-6" />
                            </button>

                            <form onSubmit={handleJoinClass}>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="bg-gradient-to-br from-neon-blue to-blue-600 p-3 rounded-2xl shadow-lg shadow-neon-blue/30">
                                        <Users className="h-6 w-6 text-white" />
                                    </div>
                                    <h2 className="text-3xl font-bold text-white">Join a Class</h2>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Class ID</label>
                                        <input
                                            type="text"
                                            placeholder="Paste the class ID from your teacher"
                                            value={classId}
                                            onChange={(e) => setClassId(e.target.value)}
                                            className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:shadow-lg focus:shadow-neon-blue/20 focus:outline-none placeholder-gray-500 transition-all duration-200 font-mono text-sm"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full group relative bg-gradient-to-r from-neon-blue to-blue-600 hover:from-neon-blue/90 hover:to-blue-600/90 text-white font-bold px-6 py-4 rounded-xl transition-all duration-200 shadow-lg shadow-neon-blue/30 hover:shadow-xl hover:shadow-neon-blue/40 hover:scale-105"
                                    >
                                        <div className="absolute inset-0 bg-white/10 rounded-xl blur group-hover:blur-md transition-all"></div>
                                        <span className="relative z-10">Join Class</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Classes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        [...Array(3)].map((_, i) => (
                            <div key={i} className="glass-card p-6 rounded-2xl border border-white/10 animate-pulse">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="h-6 bg-white/10 rounded w-2/3"></div>
                                    <div className="h-10 w-10 bg-white/10 rounded-lg"></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-4 bg-white/10 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))
                    ) : classes.length === 0 ? (
                        <div className="col-span-full text-center py-20 glass-panel rounded-3xl border border-white/10">
                            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-xl">
                                <BookOpen className="h-12 w-12 text-gray-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3">No Classes Yet</h3>
                            <p className="text-gray-400 max-w-md mx-auto mb-6">
                                {role === 'teacher' ? 'Create your first class to start organizing your students.' : 'Get the class ID from your teacher and join your first class.'}
                            </p>
                            {role === 'student' && (
                                <button
                                    onClick={() => setShowJoinModal(true)}
                                    className="bg-gradient-to-r from-neon-blue to-blue-600 text-white px-6 py-3 rounded-xl hover:shadow-xl hover:shadow-neon-blue/40 transition-all duration-300 inline-flex items-center gap-2"
                                >
                                    <Plus className="h-5 w-5" />
                                    Join Your First Class
                                </button>
                            )}
                        </div>
                    ) : (
                        classes.map((c) => (
                            <Link
                                to={`/class/${c.id}`}
                                key={c.id}
                                className="group relative block glass-card p-7 rounded-2xl border border-white/10 hover:border-neon-blue/40 transition-all duration-300 hover:shadow-2xl hover:shadow-neon-blue/20 hover:-translate-y-1"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/0 to-blue-600/0 group-hover:from-neon-blue/5 group-hover:to-blue-600/5 rounded-2xl transition-all duration-300 -z-10"></div>

                                <div className="flex items-start justify-between mb-5">
                                    <h3 className="text-xl font-bold text-white group-hover:text-neon-blue transition-colors line-clamp-2 flex-1 pr-2">
                                        {c.name || 'Unnamed Class'}
                                    </h3>
                                    <div className="flex-shrink-0 bg-gradient-to-br from-white/5 to-white/10 p-3 rounded-xl group-hover:from-neon-blue/20 group-hover:to-blue-600/20 transition-all duration-300 shadow-lg">
                                        <BookOpen className="h-6 w-6 text-gray-400 group-hover:text-neon-blue transition-colors" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {!c.name && (
                                        <div className="bg-black/40 px-3 py-2 rounded-lg border border-white/5 inline-block">
                                            <p className="text-xs text-gray-500 font-mono">
                                                ID: {c.id.substring(0, 8)}...
                                            </p>
                                        </div>
                                    )}
                                    {role === 'teacher' && c.class_code && (
                                        <div className="bg-gradient-to-r from-neon-blue/10 to-blue-600/10 px-4 py-3 rounded-lg border border-neon-blue/20">
                                            <p className="text-sm text-gray-300 mb-1">Class Code:</p>
                                            <p className="text-lg text-neon-blue font-mono font-bold tracking-wider">{c.class_code}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-5 flex items-center justify-end text-gray-500 group-hover:text-neon-blue transition-colors">
                                    <span className="text-sm font-medium mr-2 opacity-0 group-hover:opacity-100 transition-opacity">Open Class</span>
                                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyClasses;