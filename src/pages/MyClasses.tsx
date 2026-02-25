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
        <div className="min-h-screen bg-slate-950 animate-fade-in pb-20">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6 border-b-8 border-white/10 pb-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-neo-accent p-4 border border-white/10 shadow-neo -rotate-2">
                            <BookOpen className="h-10 w-10 text-white stroke-[3px]" />
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-100 uppercase tracking-tighter italic leading-none">
                                MY_CLASSES
                            </h1>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-100/60 mt-2">
                                {role === 'teacher' ? 'CENTRAL_COMMAND_&_MANAGEMENT' : 'ENROLLED_OPERATIONS_LIST'}
                            </p>
                        </div>
                    </div>
                    {role === 'student' && (
                        <button
                            className="bg-neo-secondary text-slate-100 px-8 py-4 font-black uppercase tracking-widest text-lg border border-white/10 shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 transition-all flex items-center gap-3"
                            onClick={() => setShowJoinModal(true)}
                        >
                            <Plus className="h-6 w-6 stroke-[4px]" />
                            JOIN_NEW_CLASS
                        </button>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-slate-800 border border-white/10 p-6 mb-10 shadow-neo animate-bounce-short">
                        <div className="flex items-center gap-4">
                            <div className="w-4 h-4 bg-red-600 border border-white/10 rounded-full" />
                            <span className="font-black text-red-600 uppercase tracking-tight italic">{error}</span>
                        </div>
                    </div>
                )}

                {/* Teacher: Create Class Form */}
                {role === 'teacher' && (
                    <div className="bg-slate-800 p-8 border border-white/10 shadow-neo mb-12 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-neo-green/10 -rotate-12 translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-500" />

                        <div className="flex items-center gap-3 mb-8 border-b-4 border-white/10 pb-4">
                            <Plus className="h-8 w-8 text-slate-100 stroke-[3px]" />
                            <h2 className="text-2xl font-black text-slate-100 uppercase italic tracking-tighter text-shadow-sm">INITIATE_NEW_CLASS</h2>
                        </div>

                        <form onSubmit={handleCreateClass} className="flex flex-col sm:flex-row gap-6 relative z-10">
                            <input
                                type="text"
                                placeholder="ENTER_CLASS_IDENTIFIER (E.G. PHYSICS_101)"
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                className="flex-1 px-6 py-4 bg-slate-900 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/30 text-lg"
                            />
                            <button
                                type="submit"
                                className="bg-neo-green text-slate-100 px-10 py-4 font-black uppercase tracking-widest text-xl border border-white/10 shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 transition-all"
                            >
                                CREATE_UNIT
                            </button>
                        </form>
                    </div>
                )}

                {/* Join Class Modal */}
                {showJoinModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-none p-4 animate-fade-in">
                        <div className="bg-slate-800 border border-white/10 shadow-neo p-10 w-full max-w-lg relative animate-scale-up">
                            <button
                                className="absolute -top-4 -right-4 p-2 bg-slate-900 text-white hover:bg-red-600 border border-white/10 transition-colors rotate-12 hover:rotate-0"
                                onClick={() => setShowJoinModal(false)}
                                aria-label="Close"
                            >
                                <X className="h-8 w-8 stroke-[4px]" />
                            </button>

                            <form onSubmit={handleJoinClass}>
                                <div className="flex items-center gap-4 mb-10 border-b-4 border-white/10 pb-4">
                                    <div className="bg-neo-accent p-3 border border-white/10 shadow-neo -rotate-3">
                                        <Users className="h-8 w-8 text-white stroke-[3px]" />
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-100 uppercase tracking-tighter italic">JOIN_ENROLLMENT</h2>
                                </div>
                                <div className="space-y-8">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest mb-2 text-slate-100/60">CLASS_IDENTIFIER_CODE</label>
                                        <input
                                            type="text"
                                            placeholder="PASTE_ID_HERE..."
                                            value={classId}
                                            onChange={(e) => setClassId(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-900 border border-white/10 font-bold text-slate-100 focus:outline-none focus:shadow-neo transition-all placeholder:text-slate-100/30 text-xl font-mono uppercase"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full bg-neo-accent text-white px-8 py-5 font-black uppercase tracking-widest text-xl border border-white/10 shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 transition-all"
                                    >
                                        VERIFY_&_JOIN
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Classes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {loading ? (
                        [...Array(6)].map((_, i) => (
                            <div key={i} className="bg-slate-800 p-8 border border-white/10 shadow-neo animate-pulse">
                                <div className="h-10 bg-slate-900 border border-white/10 mb-6 w-3/4" />
                                <div className="h-20 bg-slate-900 border border-white/10" />
                            </div>
                        ))
                    ) : classes.length === 0 ? (
                        <div className="col-span-full text-center py-20 bg-slate-800 border border-white/10 border-dashed flex flex-col items-center justify-center">
                            <div className="bg-slate-900 border border-white/10 p-8 mb-8 rotate-3 shadow-neo">
                                <BookOpen className="h-20 w-20 text-slate-100/20" />
                            </div>
                            <h3 className="text-4xl font-black text-slate-100 uppercase tracking-tighter italic mb-4">NO_CLASS_UNITS_LOADED</h3>
                            <p className="text-slate-100 font-bold max-w-md mx-auto uppercase tracking-wide mb-8">
                                {role === 'teacher' ? 'COMMAND_AUTH_REQUIRED: CREATE YOUR FIRST UNIT TO BEGIN OPERATIONS.' : 'SYSTEM_IDLE: REQUEST CLASS CODES FROM INSTRUCTORS TO SYNC.'}
                            </p>
                            {role === 'student' && (
                                <button
                                    onClick={() => setShowJoinModal(true)}
                                    className="bg-neo-secondary text-slate-100 px-10 py-5 font-black uppercase tracking-widest text-xl border border-white/10 shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                                >
                                    INITIALIZE_ENROLLMENT
                                </button>
                            )}
                        </div>
                    ) : (
                        classes.map((c) => (
                            <Link
                                to={`/class/${c.id}`}
                                key={c.id}
                                className="group bg-slate-800 p-8 border border-white/10 shadow-neo hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-neo transition-all relative flex flex-col min-h-[280px]"
                            >
                                <div className="absolute top-4 right-4 bg-neo-accent text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-white/10 group-hover:rotate-6 transition-transform">
                                    UNIT_ACTIVE
                                </div>

                                <div className="flex-1">
                                    <div className="mb-6 flex items-center gap-4">
                                        <div className="bg-slate-900 p-3 border border-white/10 shadow-neo group-hover:bg-neo-secondary transition-colors">
                                            <BookOpen className="h-6 w-6 text-slate-100 stroke-[2.5px]" />
                                        </div>
                                    </div>

                                    <h3 className="text-3xl font-black text-slate-100 uppercase tracking-tighter italic mb-4 group-hover:underline decoration-4 underline-offset-4 line-clamp-2">
                                        {c.name || 'UNNAMED_UNIT'}
                                    </h3>
                                </div>

                                <div className="space-y-4">
                                    {role === 'teacher' && c.class_code && (
                                        <div className="bg-slate-900 border border-white/10 p-4 rotate-[-1deg] shadow-neo">
                                            <p className="text-[10px] font-black text-slate-100/60 uppercase tracking-widest mb-1">UNIT_SYNC_CODE:</p>
                                            <p className="text-2xl font-black text-neo-accent font-mono tracking-tighter">{c.class_code}</p>
                                        </div>
                                    )}
                                    {!c.name && (
                                        <div className="bg-slate-900/5 p-2 border border-white/10 inline-block">
                                            <p className="text-[10px] font-mono font-bold text-slate-100/40">
                                                ID: {c.id.substring(0, 12)}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 pt-4 border-t-4 border-white/10 flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-widest group-hover:bg-slate-900 group-hover:text-white px-2 py-1 transition-colors">ACCESS_UNIT</span>
                                    <div className="bg-slate-900 text-white p-2 border border-white/10 group-hover:bg-neo-accent transition-colors">
                                        <svg className="w-6 h-6 transform font-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
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