import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3, Target, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function OutcomeDashboard() {
  const { user } = useAuth() as any;
  const [prediction, setPrediction] = useState<any>(null);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [goals, setGoals] = useState<any>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.functions.invoke('score-prediction', { body: { exam: 'college_gpa' } }).then(({ data }) => setPrediction(data));
    supabase.from('mastery_receipts').select('topic, rigor_score, created_at').eq('user_id', user.id).order('created_at', { ascending: true }).then(({ data }) => setReceipts(data || []));
    supabase.from('user_study_goals').select('target_score, target_exam').eq('user_id', user.id).maybeSingle().then(({ data }) => setGoals(data));
  }, [user?.id]);

  const firstWeek = useMemo(() => receipts.filter(r => Date.now() - new Date(r.created_at).getTime() > 21 * 24 * 60 * 60 * 1000).length, [receipts]);
  const currentMastery = receipts.length;
  const estimatedStart = Math.max(70, Number(prediction?.estimated_score || 82) - Math.max(5, (currentMastery - firstWeek) * 2));
  const estimatedNow = Number(prediction?.estimated_score || estimatedStart);
  const target = Number(goals?.target_score || prediction?.target_score || 92);

  return (
    <div className="min-h-screen bg-[#F8FAF9] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="neo-card bg-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[18px] bg-[#0A192F] text-white flex items-center justify-center"><BarChart3 className="w-7 h-7" /></div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#0A192F]">Course Grade Forecast Tracking</h1>
              <p className="text-sm text-[#64748B]">Your daily predicted grade movement based on proven concept mastery.</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Metric icon={Target} label="Target Grade" value={`${target}%`} />
          <Metric icon={BarChart3} label="Projected Now" value={`${estimatedNow}%`} />
          <Metric icon={ArrowUpRight} label="Projected Gain" value={`+${(Math.max(0, estimatedNow - estimatedStart)).toFixed(1)}%`} />
          <Metric icon={Trophy} label="Mastery Proofs" value={`${receipts.length}`} />
        </div>

        <div className="neo-card bg-white">
          <h2 className="text-lg font-extrabold text-[#0A192F] mb-4">Grade Trajectory</h2>
          <div className="space-y-4">
            <Bar label="Starting estimate" value={estimatedStart} max={100} color="bg-[#F472B6]" />
            <Bar label="Current forecast" value={estimatedNow} max={100} color="bg-[#8B5CF6]" />
            <Bar label="Target grade" value={target} max={100} color="bg-[#34D399]" />
          </div>
          <p className="mt-5 text-sm text-[#64748B]">Next high-leverage topics to master: {(prediction?.next_topics_to_prove || ['Stereochemistry', 'Partial Integration', 'Kinematic Vectors']).join(', ')}</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="neo-card bg-white"><Icon className="w-5 h-5 text-[#00D1FF] mb-3" /><div className="text-2xl font-extrabold text-[#0A192F]">{value}</div><div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{label}</div></div>;
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return <div><div className="flex justify-between text-xs font-bold text-[#64748B] mb-2"><span>{label}</span><span>{value}/300</span></div><div className="h-3 rounded-full bg-[#0A192F]/5 overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div></div>;
}
