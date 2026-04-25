import { useEffect, useMemo, useState } from 'react';
import { Copy, Newspaper, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

export function MasteryReports() {
  const { user } = useAuth() as any;
  const { showToast } = useToast();
  const [receipts, setReceipts] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('mastery_receipts').select('subject, topic, rigor_score, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setReceipts(data || []));
  }, [user?.id]);

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
