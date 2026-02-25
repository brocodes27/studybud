import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ChevronRight, BarChart3, TrendingUp, Sparkles } from 'lucide-react';

interface MasteryData {
    domain: string;
    subdomain: string;
    mastery_score: number;
    questions_attempted: number;
    questions_correct: number;
}

export function MasteryHeatmap() {
    const { user } = useAuth() as any;
    const [masteryData, setMasteryData] = useState<MasteryData[]>([]);
    const [loading, setLoading] = useState(true);
    const [examType, setExamType] = useState('sat');

    useEffect(() => {
        if (user) fetchMastery();
    }, [user, examType]);

    const fetchMastery = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_subject_mastery')
                .select('*')
                .eq('user_id', user.id)
                .eq('exam_type', examType);

            if (error) throw error;
            setMasteryData(data || []);
        } catch (e) {
            console.error('Error fetching mastery:', e);
        } finally {
            setLoading(false);
        }
    };



    const getHeatColor = (score: number) => {
        if (score < 20) return 'bg-[#FFEDED]';
        if (score < 40) return 'bg-[#FFD9D9]';
        if (score < 60) return 'bg-[#FECACA]';
        if (score < 80) return 'bg-[#93C5FD]';
        return 'bg-[#2D9E64]/30';
    };

    const domains = [...new Set(masteryData.map(d => d.domain))];

    if (loading) return (
        <div className="p-20 text-center bg-slate-900 border border-white/10 shadow-neo flex flex-col items-center gap-6">
            <div className="w-16 h-16 border border-white/10 border-t-neo-accent animate-spin" />
            <span className="text-xl font-black italic tracking-widest uppercase">SCANNING_NEURAL_WEAKNESSES...</span>
        </div>
    );

    return (
        <div className="space-y-8">
            {/* 1. OVERVIEW HUD */}
            <div className="bg-slate-900 text-white p-6 border border-white/10 shadow-neo flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden">
                <div className="flex items-center gap-4">
                    <div className="bg-neo-accent p-2 border border-white shadow-neo shrink-0">
                        <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase leading-none truncate">MASTERY_GRID</h2>
                        <p className="text-neo-accent font-black uppercase tracking-[0.3em] text-[8px] md:text-[10px] mt-1">KNOWLEDGE_TOPOLOGY_v2.1</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {['SAT', 'ACT'].map(t => (
                        <button
                            key={t}
                            onClick={() => setExamType(t.toLowerCase())}
                            className={`px-4 py-2 border border-white/10 font-black uppercase tracking-widest text-[10px] transition-all shadow-neo hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none ${examType === t.toLowerCase() ? 'bg-neo-accent text-white' : 'bg-slate-800 text-slate-100'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. THE HEATMAP GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {domains.length === 0 ? (
                    <div className="md:col-span-2 py-16 bg-slate-800 border border-white/10 flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, black 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                        <div className="relative">
                            <Sparkles className="h-16 w-16 text-slate-100/10 animate-pulse" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/10/5 rounded-full animate-ping" />
                        </div>

                        <div className="space-y-2 relative z-10">
                            <h3 className="text-4xl font-black uppercase italic tracking-tighter text-slate-100/20">Zero_Data_Detected</h3>
                            <p className="font-bold text-[10px] max-w-xs uppercase tracking-widest leading-relaxed opacity-40">
                                INITIALIZE NEURAL PROBE BY COMPLETING A STUDY UNIT OR REFRESHING YOUR SESSION DATA.
                            </p>
                        </div>

                        <div className="grid grid-cols-8 gap-2 opacity-10">
                            {Array.from({ length: 16 }).map((_, i) => (
                                <div key={i} className="w-6 h-6 border border-white/10 bg-neo-muted" />
                            ))}
                        </div>

                        <button className="bg-slate-900 text-white px-10 py-4 font-black uppercase italic shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo active:translate-x-0 active:translate-y-0 active:shadow-none transition-all text-sm z-10">
                            INITIATE_PROBE_SESSION
                        </button>
                    </div>
                ) : domains.map((domain, idx) => {
                    const domainData = masteryData.filter(d => d.domain === domain);
                    const domainMastery = domainData.reduce((acc, d) => acc + Number(d.mastery_score), 0) / domainData.length;

                    return (
                        <div key={idx} className="bg-slate-800 border border-white/10 shadow-neo p-5 space-y-6 hover:-translate-y-1 transition-transform relative group">
                            <div className="absolute top-0 right-0 bg-slate-900 text-white px-3 py-0.5 text-[8px] font-black uppercase italic">CORE_DOMAIN</div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-black uppercase italic tracking-tight truncate max-w-[150px]">{domain}</h3>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <TrendingUp className="h-3.5 w-3.5 text-neo-secondary" />
                                        <span className="text-[10px] font-black uppercase opacity-60">Status: {domainMastery > 70 ? 'OPTIMAL' : 'RECALIBRATING'}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black uppercase opacity-40 leading-none">MASTERY_INDEX</p>
                                    <p className="text-2xl font-black italic">{(domainMastery).toFixed(0)}%</p>
                                </div>
                            </div>

                            {/* Heat Cells */}
                            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                                {domainData.map((sub, sIdx) => (
                                    <div
                                        key={sIdx}
                                        className={`aspect-square border border-white/10 relative group/cell cursor-help transition-all hover:scale-110 z-10 ${getHeatColor(sub.mastery_score)} shadow-neo`}
                                    >
                                        {/* Hover Info Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-slate-900 text-white p-2 border border-neo-accent hidden group-hover/cell:block z-50 shadow-neo">
                                            <p className="text-[9px] font-black uppercase text-neo-accent mb-0.5">{sub.subdomain || 'General'}</p>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[7px] font-black">ACCURACY:</span>
                                                <span className="text-[10px] font-black">{(sub.mastery_score).toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full h-0.5 bg-slate-800/20">
                                                <div className="h-full bg-neo-accent" style={{ width: `${sub.mastery_score}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button className="w-full flex items-center justify-between p-2.5 bg-slate-800 border border-white/10 font-black uppercase text-[10px] hover:bg-neo-accent hover:text-white transition-all">
                                FOCUS_RESEARCH <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* 3. LEGEND PANEL */}
            <div className="bg-slate-900/10 border border-white/10 p-4 flex flex-wrap items-center justify-center gap-8 font-black uppercase tracking-widest text-[9px]">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#FFEDED] border border-white/10" /> 0-20% CRITICAL</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#FECACA] border border-white/10" /> 21-60% VULNERABLE</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#93C5FD] border border-white/10" /> 61-80% STABLE</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#2D9E64]/30 border border-white/10" /> 80%+ APEX</div>
            </div>
        </div>
    );
}
