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
        if (score < 20) return 'bg-red-100 border-red-200';
        if (score < 40) return 'bg-orange-100 border-orange-200';
        if (score < 60) return 'bg-yellow-100 border-yellow-200';
        if (score < 80) return 'bg-[#93C5FD]/40 border-blue-200';
        return 'bg-[#34D399]/20 border-[#34D399]/30';
    };

    const domains = [...new Set(masteryData.map(d => d.domain))];

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="w-10 h-10 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
            <p className="text-sm font-bold text-[#64748B]">Loading knowledge map...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="neo-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[16px] flex items-center justify-center shadow-float-cyan">
                        <BarChart3 className="h-6 w-6 text-[#00D1FF]" />
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold text-[#0A192F] tracking-tight">Knowledge Map</h2>
                        <p className="text-xs font-medium text-[#64748B]">Your mastery across all topics</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {['SAT', 'ACT'].map(t => (
                        <button
                            key={t}
                            onClick={() => setExamType(t.toLowerCase())}
                            className={`px-5 py-2 rounded-[10px] border-2 font-bold text-sm transition-all ${examType === t.toLowerCase() ? 'bg-[#00D1FF] border-[#00D1FF] text-white shadow-float-cyan' : 'bg-white border-[#0A192F]/10 text-[#64748B] hover:border-[#00D1FF]/30'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Heatmap Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {domains.length === 0 ? (
                    <div className="md:col-span-2 neo-card text-center py-16">
                        <Sparkles className="h-14 w-14 text-[#0A192F]/10 mx-auto mb-4" />
                        <h3 className="text-lg font-extrabold text-[#0A192F] mb-2">No data yet</h3>
                        <p className="text-sm font-medium text-[#64748B] max-w-xs mx-auto">
                            Complete study units or practice tests to build your knowledge map.
                        </p>
                    </div>
                ) : domains.map((domain, idx) => {
                    const domainData = masteryData.filter(d => d.domain === domain);
                    const domainMastery = domainData.reduce((acc, d) => acc + Number(d.mastery_score), 0) / domainData.length;

                    return (
                        <div key={idx} className="neo-card hover:-translate-y-1 transition-all space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-extrabold text-[#0A192F] tracking-tight">{domain}</h3>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <TrendingUp className="h-3.5 w-3.5 text-[#34D399]" />
                                        <span className="text-xs font-medium text-[#64748B]">
                                            {domainMastery > 70 ? 'Strong mastery' : 'Needs practice'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Mastery</p>
                                    <p className={`text-2xl font-extrabold tracking-tight ${domainMastery >= 80 ? 'text-[#34D399]' : domainMastery >= 60 ? 'text-[#00D1FF]' : 'text-[#F472B6]'}`}>
                                        {domainMastery.toFixed(0)}%
                                    </p>
                                </div>
                            </div>

                            {/* Mastery bar */}
                            <div className="h-1.5 w-full bg-[#0A192F]/5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${domainMastery >= 80 ? 'bg-[#34D399]' : domainMastery >= 60 ? 'bg-[#00D1FF]' : 'bg-[#F472B6]'}`}
                                    style={{ width: `${domainMastery}%` }}
                                />
                            </div>

                            {/* Heat Cells */}
                            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                                {domainData.map((sub, sIdx) => (
                                    <div
                                        key={sIdx}
                                        className={`aspect-square rounded-[6px] border relative group/cell cursor-help transition-all hover:scale-110 ${getHeatColor(sub.mastery_score)}`}
                                    >
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-[#0A192F] text-white p-2.5 rounded-[10px] hidden group-hover/cell:block z-50 shadow-lg">
                                            <p className="text-[9px] font-bold text-[#00D1FF] mb-1">{sub.subdomain || 'General'}</p>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] text-white/60">Accuracy:</span>
                                                <span className="text-xs font-bold">{sub.mastery_score.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button className="w-full flex items-center justify-between px-4 py-2.5 rounded-[10px] bg-[#F8FAFF] border-2 border-[#0A192F]/5 text-xs font-bold text-[#64748B] hover:border-[#00D1FF]/30 hover:text-[#00D1FF] transition-colors">
                                Practice this domain <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="neo-card flex flex-wrap items-center justify-center gap-6">
                {[
                    { color: 'bg-red-100 border border-red-200', label: '0–20% Critical' },
                    { color: 'bg-orange-100 border border-orange-200', label: '21–40% Weak' },
                    { color: 'bg-yellow-100 border border-yellow-200', label: '41–60% Developing' },
                    { color: 'bg-[#93C5FD]/40 border border-blue-200', label: '61–80% Stable' },
                    { color: 'bg-[#34D399]/20 border border-[#34D399]/30', label: '80%+ Strong' },
                ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-[4px] ${item.color}`} />
                        <span className="text-xs font-medium text-[#64748B]">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
