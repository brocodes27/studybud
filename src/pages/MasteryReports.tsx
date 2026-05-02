import { useEffect, useMemo, useState } from 'react';
import { Copy, Newspaper, Sparkles, Cpu, Zap, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useMLIntelligence } from '../hooks/useMLIntelligence';

interface ScorePrediction {
  estimated_score: number;
  score_mechanism: string;
  model_version: number;
  target_score: number;
  gap_to_target: number;
  percentile_band: string;
  subject_scores: { subject: string; estimated_score: number }[];
}

export function MasteryReports() {
  const { user } = useAuth() as any;
  const { showToast } = useToast();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [scorePrediction, setScorePrediction] = useState<ScorePrediction | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const ml = useMLIntelligence();

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('mastery_receipts').select('subject, topic, rigor_score, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setReceipts(data || []));
    fetchScorePrediction();
  }, [user?.id]);

  const fetchScorePrediction = async () => {
    setLoadingPrediction(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/score-prediction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionData?.session?.access_token}` },
        body: JSON.stringify({ exam: 'jee_main', target_score: 180 }),
      });
      const data = await res.json();
      setScorePrediction(data);
    } catch {
      // silently fail
    } finally {
      setLoadingPrediction(false);
    }
  };

  const report = useMemo(() => {
    const top = receipts.slice(0, 5);
    const average = receipts.length ? receipts.reduce((sum, r) => sum + Number(r.rigor_score || 0), 0) / receipts.length : 0;
    return `This week in JEE mastery: ${top.map(r => r.topic).join(', ') || 'no topics yet'}. Average rigor: ${average.toFixed(1)}/10. Most misunderstood next target: ${(top.find(r => Number(r.rigor_score) < 7)?.topic || 'Rotational Dynamics')}.`;
  }, [receipts]);

  return (
    <div className="min-h-screen bg-[#F8FAF9] p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="neo-card bg-white">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-[18px] bg-[#0A192F] text-white flex items-center justify-center"><Newspaper className="w-7 h-7" /></div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#0A192F]">Mastery Report Engine</h1>
              <p className="text-sm text-[#64748B]">Turn verified learning data into shareable growth/content proof.</p>
            </div>
          </div>

          {/* ML-Powered Score Prediction */}
          {loadingPrediction ? (
            <div className="rounded-[18px] bg-[#F8FAF9] border-2 border-[#0A192F]/10 p-5 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
              <span className="text-sm text-[#64748B]">Computing score prediction...</span>
            </div>
          ) : scorePrediction && (
            <div className="rounded-[18px] bg-gradient-to-r from-[#00D1FF]/10 to-[#34D399]/10 border-2 border-[#00D1FF]/20 p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#34D399]" />
                <span className="text-sm font-extrabold text-[#0A192F]">ML Score Prediction</span>
                {scorePrediction.score_mechanism === 'trained_model' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-[#34D399]/10 border border-[#34D399]/20 rounded-full text-[10px] font-bold text-[#34D399]">
                    <Zap className="w-3 h-3" /> v{scorePrediction.model_version}
                  </span>
                )}
                {scorePrediction.score_mechanism === 'rule_formula' && (
                  <span className="text-[10px] text-[#64748B]">Adaptive model warming up</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-[#0A192F]">{scorePrediction.estimated_score}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Est. Score /300</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-[#F472B6]">{scorePrediction.gap_to_target}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Gap to Target</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-[#00D1FF]">{scorePrediction.percentile_band}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Percentile Band</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#64748B]">
                <Cpu className="w-3 h-3" />
                <span>BKT mastery tracking · IRT adaptive selection · {scorePrediction.score_mechanism === 'trained_model' ? `Regression model v${scorePrediction.model_version}` : 'Formula-based estimation'}</span>
              </div>
            </div>
          )}

          <div className="rounded-[18px] bg-[#F8FAF9] border-2 border-[#0A192F]/10 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A192F] mb-3"><Sparkles className="w-4 h-4 text-[#00D1FF]" /> Auto-generated report draft</div>
            <p className="text-sm text-[#64748B] leading-relaxed">{report}</p>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(report); showToast('Report copied', 'success'); }} className="mt-5 w-full py-3 rounded-[12px] bg-[#0A192F] text-white font-bold flex items-center justify-center gap-2">
            <Copy className="w-4 h-4" /> Copy report
          </button>
        </div>
      </div>
    </div>
  );
}
