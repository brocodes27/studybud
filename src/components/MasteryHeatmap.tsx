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
        if (score < 0.2) return 'bg-[#FFEDED]';
        if (score < 0.4) return 'bg-[#FFD9D9]';
        if (score < 0.6) return 'bg-[#FECACA]';
        if (score < 0.8) return 'bg-[#93C5FD]';
        return 'bg-[#2D9E64]/30';
    };

    const domains = [...new Set(masteryData.map(d => d.domain))];

    if (loading) return (
        <div className="p-20 text-center bg-white border-8 border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center gap-6">
            <div className="w-16 h-16 border-8 border-black border-t-neo-accent animate-spin" />
            <span className="text-xl font-black italic tracking-widest uppercase">SCANNING_NEURAL_WEAKNESSES...</span>
        </div>
    );

    return (
        <div className="space-y-8">
            {/* 1. OVERVIEW HUD */}
            <div className="bg-black text-white p-6 border-4 border-black shadow-[10px_10px_0px_0px_rgba(45,158,100,0.5)] rotate-1 flex flex-wrap items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-neo-accent p-2 border-2 border-white shadow-[2px_2px_0px_0px_#FFF]">
                            <BarChart3 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black italic tracking-tight uppercase leading-none">Mastery_Grid</h2>
                            <p className="text-neo-accent font-black uppercase tracking-[0.3em] text-[10px]">Knowledge_Topology_v2.1</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    {['SAT', 'ACT'].map(t => (
                        <button
                            key={t}
                            onClick={() => setExamType(t.toLowerCase())}
                            className={`px-4 py-2 border-2 border-black font-black uppercase tracking-widest text-[11px] transition-all shadow-[3px_3px_0px_0px_#FFF] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none ${examType === t.toLowerCase() ? 'bg-neo-accent text-white' : 'bg-white text-black'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. THE HEATMAP GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {domains.length === 0 ? (
                    <div className="md:col-span-2 py-20 bg-white border-4 border-dashed border-black flex flex-col items-center justify-center text-center space-y-4">
                        <Sparkles className="h-12 w-12 text-black/10" />
                        <h3 className="text-3xl font-black uppercase italic text-black/20">Zero_Data_Detected</h3>
                        <p className="font-bold text-xs max-w-xs opacity-60">START A PRACTICE SESSION OR SAT SIMULATOR TO MAP YOUR LEARNING TOPOLOGY.</p>
                        <button className="bg-black text-white px-6 py-2 font-black uppercase italic shadow-[4px_4px_0px_0px_#2D9E64] hover:bg-neo-secondary hover:text-black transition-all text-xs">INITIATE_PROBE</button>
                    </div>
                ) : domains.map((domain, idx) => {
                    const domainData = masteryData.filter(d => d.domain === domain);
                    const domainMastery = domainData.reduce((acc, d) => acc + Number(d.mastery_score), 0) / domainData.length;

                    return (
                        <div key={idx} className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-5 space-y-6 hover:-translate-y-1 transition-transform relative group">
                            <div className="absolute top-0 right-0 bg-black text-white px-3 py-0.5 text-[8px] font-black uppercase italic">CORE_DOMAIN</div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-black uppercase italic tracking-tight">{domain}</h3>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <TrendingUp className="h-3.5 w-3.5 text-neo-secondary" />
                                        <span className="text-[10px] font-black uppercase opacity-60">Status: {domainMastery > 0.7 ? 'OPTIMAL' : 'RECALIBRATING'}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black uppercase opacity-40">MASTERY_INDEX</p>
                                    <p className="text-2xl font-black italic">{(domainMastery * 100).toFixed(0)}%</p>
                                </div>
                            </div>

                            {/* Heat Cells */}
                            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                                {domainData.map((sub, sIdx) => (
                                    <div
                                        key={sIdx}
                                        className={`aspect-square border-2 border-black relative group/cell cursor-help transition-all hover:scale-110 z-10 ${getHeatColor(sub.mastery_score)} shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]`}
                                    >
                                        {/* Hover Info Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-black text-white p-2 border border-neo-accent hidden group-hover/cell:block z-50 shadow-[4px_4px_0px_0px_#000]">
                                            <p className="text-[9px] font-black uppercase text-neo-accent mb-0.5">{sub.subdomain || 'General'}</p>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[7px] font-black">ACCURACY:</span>
                                                <span className="text-[10px] font-black">{(sub.mastery_score * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full h-0.5 bg-white/20">
                                                <div className="h-full bg-neo-accent" style={{ width: `${sub.mastery_score * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button className="w-full flex items-center justify-between p-2.5 bg-neo-bg/20 border border-black font-black uppercase text-[10px] hover:bg-neo-accent hover:text-white transition-all">
                                FOCUS_RESEARCH <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* 3. LEGEND PANEL */}
            <div className="bg-neo-bg/10 border-2 border-black p-4 flex flex-wrap items-center justify-center gap-8 font-black uppercase tracking-widest text-[9px]">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#FFEDED] border border-black" /> 0-20% CRITICAL</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#FECACA] border border-black" /> 21-60% VULNERABLE</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#93C5FD] border border-black" /> 61-80% STABLE</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#2D9E64]/30 border border-black" /> 80%+ APEX</div>
            </div>
        </div>
    );
}
