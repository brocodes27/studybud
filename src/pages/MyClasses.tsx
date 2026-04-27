import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Plus, Users, X, Copy, Check } from 'lucide-react';

interface Class {
    id: string;
    name?: string;
    subject?: string;
    class_code?: string;
    invite_link?: string;
    curriculum_source?: string;
}

const MyClasses = () => {
    const { user, role } = useAuth() as any;
    const [classes, setClasses] = useState<Class[]>([]);
    const [className, setClassName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [joinMode, setJoinMode] = useState<'code' | 'link'>('code');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        fetchClasses();
    }, [user, role]);

    const fetchClasses = async () => {
        if (!user) return;
        setLoading(true);

        let query;
        if (role === 'teacher') {
            query = supabase.from('classes').select('id, name, subject, class_code, invite_link, curriculum_source').eq('teacher_id', user.id);
        } else {
            query = supabase
                .from('class_members')
                .select('classes(id, name, subject, class_code, invite_link, curriculum_source)')
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
        setError('');
        if (!className.trim()) {
            setError('Class name is required.');
            return;
        }

        const { data, error } = await supabase.rpc('create_class', { p_name: className.trim() });

        if (error || !data || data.length === 0) {
            setError('Failed to create class.');
            console.error(error);
        } else {
            setClassName('');
            fetchClasses();
        }
    };

    const handleJoinClass = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (!joinCode.trim()) {
            setError(joinMode === 'code' ? 'Class code is required.' : 'Invite link is required.');
            return;
        }

        const trimmed = joinCode.trim();
        let result;
        if (joinMode === 'code') {
            result = await supabase.rpc('join_class', { p_class_code: trimmed.toUpperCase() });
        } else {
            // Could be full URL or just the slug
            const slug = trimmed.replace(/^.*\/join\//, '');
            result = await supabase.rpc('join_class_by_invite', { p_invite_link: slug });
        }

        if (result.error) {
            setError(result.error.message || 'Failed to join class. Check the code/link and try again.');
            console.error(result.error);
        } else {
            setJoinCode('');
            setShowJoinModal(false);
            fetchClasses();
        }
    };

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedId(code);
        setTimeout(() => setCopiedId(null), 1500);
    };

    return (
        <div className="min-h-screen bg-[#FAF8F5] pb-20">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6 border-b border-[#E8E4DF] pb-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#8B7355]/10 p-3 rounded-2xl">
                            <BookOpen className="h-8 w-8 text-[#8B7355] stroke-[2.5px]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#2D2A26] leading-none">
                                My Classes
                            </h1>
                            <p className="text-sm text-[#8A8279] mt-1">
                                {role === 'teacher' ? 'Manage your classes' : 'Your enrolled classes'}
                            </p>
                        </div>
                    </div>
                    {role === 'student' && (
                        <button
                            className="bg-[#2D2A26] text-white px-5 py-2.5 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center gap-2"
                            onClick={() => setShowJoinModal(true)}
                        >
                            <Plus className="h-5 w-5 stroke-[2.5px]" />
                            Join Class
                        </button>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8 flex items-center gap-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <span className="text-sm font-bold text-red-600">{error}</span>
                    </div>
                )}

                {/* Teacher: Create Class Form */}
                {role === 'teacher' && (
                    <div className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm mb-8">
                        <h2 className="text-lg font-bold text-[#2D2A26] mb-4 flex items-center gap-2">
                            <Plus className="h-5 w-5 text-[#00D1FF] stroke-[2.5px]" />
                            Create New Class
                        </h2>
                        <form onSubmit={handleCreateClass} className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                placeholder="e.g. JEE Advanced Physics"
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                className="flex-1 px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50"
                            />
                            <button
                                type="submit"
                                className="bg-[#2D2A26] text-white px-6 py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all"
                            >
                                Create
                            </button>
                        </form>
                    </div>
                )}

                {/* Join Class Modal */}
                {showJoinModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2A26]/40 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8 relative">
                            <button
                                className="absolute top-4 right-4 text-[#8A8279] hover:text-[#2D2A26] transition-colors"
                                onClick={() => setShowJoinModal(false)}
                                aria-label="Close"
                            >
                                <X className="h-6 w-6 stroke-[2.5px]" />
                            </button>

                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-[#00D1FF]/10 p-2 rounded-xl">
                                    <Users className="h-5 w-5 text-[#00D1FF] stroke-[2.5px]" />
                                </div>
                                <h2 className="text-xl font-bold text-[#2D2A26]">Join a Class</h2>
                            </div>

                            <div className="bg-[#F8FAFF] p-1 rounded-[14px] flex mb-5">
                                <button
                                    type="button"
                                    onClick={() => setJoinMode('code')}
                                    className={`flex-1 py-2 rounded-[12px] text-sm font-bold transition-all ${joinMode === 'code' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
                                >
                                    Class Code
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setJoinMode('link')}
                                    className={`flex-1 py-2 rounded-[12px] text-sm font-bold transition-all ${joinMode === 'link' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
                                >
                                    Invite Link
                                </button>
                            </div>

                            <form onSubmit={handleJoinClass} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-[#2D2A26] mb-1.5">
                                        {joinMode === 'code' ? 'Class Code' : 'Invite Link'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={joinMode === 'code' ? 'e.g. ABC123' : 'Paste the invite link here'}
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-[#2D2A26] text-white py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all"
                                >
                                    Join Class
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Classes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        [...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm animate-pulse h-40" />
                        ))
                    ) : classes.length === 0 ? (
                        <div className="col-span-full text-center py-16 bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] border-dashed flex flex-col items-center justify-center">
                            <div className="bg-[#F5F0E8] rounded-2xl p-5 mb-4">
                                <BookOpen className="h-10 w-10 text-[#8A8279]" />
                            </div>
                            <h3 className="text-lg font-bold text-[#2D2A26] mb-1">No Classes Yet</h3>
                            <p className="text-sm text-[#8A8279] max-w-md mx-auto mb-4">
                                {role === 'teacher' ? 'Create your first class to get started.' : 'Ask your teacher for a class code or invite link.'}
                            </p>
                            {role === 'student' && (
                                <button
                                    onClick={() => setShowJoinModal(true)}
                                    className="bg-[#2D2A26] text-white px-5 py-2.5 font-bold rounded-[14px] shadow-sm hover:shadow-md transition-all"
                                >
                                    Join a Class
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {classes.map((c) => (
                                <Link
                                    to={role === 'teacher' ? `/teacher/class/${c.id}` : `/class/${c.id}`}
                                    key={c.id}
                                    className="group bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm hover:shadow-md transition-all relative flex flex-col min-h-[200px]"
                                >
                                    <div className="absolute top-4 right-4 bg-[#00D1FF]/10 text-[#00D1FF] px-2.5 py-1 text-[10px] font-bold rounded-lg">
                                        Active
                                    </div>

                                    <div className="flex-1">
                                        <div className="mb-4 flex items-center gap-3">
                                            <div className="bg-[#F5F0E8] p-2.5 rounded-xl group-hover:scale-105 transition-transform">
                                                <BookOpen className="h-5 w-5 text-[#8B7355] stroke-[2.5px]" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-[#2D2A26] line-clamp-1">
                                                    {c.name || 'Unnamed Class'}
                                                </h3>
                                                {c.subject && <p className="text-xs text-[#8A8279]">{c.subject}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {role === 'teacher' && c.class_code && (
                                            <div className="bg-[#F5F0E8] rounded-lg p-3 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-bold text-[#8A8279] uppercase tracking-wide">Class Code</p>
                                                    <p className="text-sm font-mono font-bold text-[#2D2A26]">{c.class_code}</p>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopyCode(c.class_code!); }}
                                                    className="bg-white p-1.5 rounded-md shadow-sm hover:shadow-md transition-all"
                                                >
                                                    {copiedId === c.class_code ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-[#8A8279]" />}
                                                </button>
                                            </div>
                                        )}
                                        {c.curriculum_source === 'template' && (
                                            <span className="text-[10px] font-bold bg-[#8B7355]/10 text-[#8B7355] px-2 py-1 rounded-md">Template Linked</span>
                                        )}
                                        {c.curriculum_source === 'upload' && (
                                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md">Custom Curriculum</span>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-[#E8E4DF] flex items-center justify-between">
                                        <span className="text-xs font-bold text-[#8A8279]">Open Dashboard</span>
                                        <div className="bg-[#F5F0E8] text-[#2D2A26] p-1.5 rounded-lg group-hover:bg-[#8B7355] group-hover:text-white transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            {role === 'student' && (
                                <button
                                    onClick={() => setShowJoinModal(true)}
                                    className="group flex flex-col items-center justify-center min-h-[200px] rounded-2xl border-2 border-dashed border-[#2D2A26]/[0.12] bg-[#FAF8F5] hover:bg-white hover:border-[#2D2A26]/[0.25] hover:shadow-sm transition-all p-6"
                                >
                                    <div className="bg-[#F5F0E8] p-3 rounded-2xl mb-3 group-hover:scale-105 transition-transform">
                                        <Plus className="h-6 w-6 text-[#8B7355] stroke-[2.5px]" />
                                    </div>
                                    <span className="text-sm font-bold text-[#2D2A26]">Join Another Class</span>
                                    <span className="text-xs text-[#8A8279] mt-1">Enter a class code or invite link</span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );

};

export default MyClasses;