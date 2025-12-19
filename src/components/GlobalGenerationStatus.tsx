import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Terminal, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface GenerationStatus {
    id: string;
    topic: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    current_step: string;
}

export const GlobalGenerationStatus = () => {
    const { user } = useAuth() as any;
    const [activeGenerations, setActiveGenerations] = useState<GenerationStatus[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;

        // Fetch initially active generations
        const fetchActive = async () => {
            const { data } = await supabase
                .from('video_generations')
                .select('id, topic, status, progress, current_step')
                .eq('user_id', user.id)
                .in('status', ['pending', 'processing'])
                .order('created_at', { ascending: false });

            if (data) setActiveGenerations(data as GenerationStatus[]);
        };

        fetchActive();

        // Subscribe to changes for this user
        const channel = supabase
            .channel(`global-generations-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'video_generations',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const newItem = payload.new as GenerationStatus;
                    const oldItem = payload.old as { id: string };

                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        setActiveGenerations((prev: GenerationStatus[]) => {
                            // If it's finished (completed or failed), remove it after a delay or keep for notification
                            if (newItem.status === 'completed' || newItem.status === 'failed') {
                                // Filter out after 10 seconds to give user time to see success
                                setTimeout(() => {
                                    setActiveGenerations((current: GenerationStatus[]) => current.filter((g: GenerationStatus) => g.id !== newItem.id));
                                }, 10000);
                                return prev.map((g: GenerationStatus) => g.id === newItem.id ? newItem : g);
                            }

                            const exists = prev.find((g: GenerationStatus) => g.id === newItem.id);
                            if (exists) {
                                return prev.map((g: GenerationStatus) => g.id === newItem.id ? newItem : g);
                            } else if (newItem.status === 'pending' || newItem.status === 'processing') {
                                return [newItem, ...prev];
                            }
                            return prev;
                        });
                    } else if (payload.eventType === 'DELETE') {
                        setActiveGenerations((prev: GenerationStatus[]) => prev.filter((g: GenerationStatus) => g.id !== oldItem.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    if (activeGenerations.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 pointer-events-none">
            {activeGenerations.map((gen) => (
                <div
                    key={gen.id}
                    className="pointer-events-auto group relative animate-in slide-in-from-right-10 duration-500"
                >
                    <div className={`glass-card p-4 rounded-2xl border ${gen.status === 'completed' ? 'border-neon-green/30 bg-neon-green/5' :
                        gen.status === 'failed' ? 'border-red-500/30 bg-red-500/5' :
                            'border-white/10 bg-black/60 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                        } backdrop-blur-xl min-w-[280px] max-w-[320px] transition-all hover:scale-[1.02]`}>
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-xl ${gen.status === 'completed' ? 'bg-neon-green/20 text-neon-green' :
                                gen.status === 'failed' ? 'bg-red-500/20 text-red-500' :
                                    'bg-neon-blue/20 text-neon-blue'
                                }`}>
                                {gen.status === 'completed' ? <CheckCircle2 size={20} /> :
                                    gen.status === 'failed' ? <AlertCircle size={20} /> :
                                        <Loader2 size={20} className="animate-spin" />}
                            </div>

                            <div className="flex-1 min-w-0 pr-6">
                                <h4 className="text-sm font-bold text-white truncate">{gen.topic}</h4>
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
                                    {gen.status === 'completed' ? 'Video Ready!' :
                                        gen.status === 'failed' ? 'Generation Failed' :
                                            `Generating... ${gen.progress}%`}
                                </p>

                                {gen.status !== 'completed' && gen.status !== 'failed' && (
                                    <div className="mt-3 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-neon-blue transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                            style={{ width: `${gen.progress}%` }}
                                        />
                                    </div>
                                )}

                                {gen.status === 'completed' && (
                                    <button
                                        onClick={() => navigate('/videos')}
                                        className="mt-3 w-full py-2 rounded-lg bg-neon-green/20 text-neon-green text-xs font-bold border border-neon-green/30 hover:bg-neon-green/30 transition-all"
                                    >
                                        Watch Now
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => setActiveGenerations((prev: GenerationStatus[]) => prev.filter((g: GenerationStatus) => g.id !== gen.id))}
                                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Detail Hover/Click Log */}
                        {(gen.status === 'processing' || gen.status === 'pending') && gen.current_step && (
                            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-[10px] text-emerald-400 font-mono italic">
                                <Terminal size={12} />
                                <span className="truncate">{gen.current_step}</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
