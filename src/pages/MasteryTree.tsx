import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, BadgeCheck, ChevronLeft, Lock, Share2, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

const JEE_TREE = [
  {
    subject: 'Physics',
    branches: [
      { name: 'Mechanics', topics: ['Kinematics', 'Laws of Motion', 'Work Energy Power', 'Rotational Dynamics', 'Gravitation'] },
      { name: 'Electrodynamics', topics: ['Electrostatics', 'Current Electricity', 'Magnetism', 'EMI', 'AC Circuits'] },
      { name: 'Modern Physics', topics: ['Photoelectric Effect', 'Atoms', 'Nuclei', 'Semiconductors'] },
    ],
  },
  {
    subject: 'Chemistry',
    branches: [
      { name: 'Physical Chemistry', topics: ['Mole Concept', 'Thermodynamics', 'Equilibrium', 'Electrochemistry', 'Chemical Kinetics'] },
      { name: 'Organic Chemistry', topics: ['GOC', 'Hydrocarbons', 'Haloalkanes', 'Alcohols Phenols Ethers', 'Amines'] },
      { name: 'Inorganic Chemistry', topics: ['Periodic Table', 'Chemical Bonding', 'Coordination Compounds', 'p-Block'] },
    ],
  },
  {
    subject: 'Mathematics',
    branches: [
      { name: 'Calculus', topics: ['Limits', 'Continuity Differentiability', 'Applications of Derivatives', 'Integrals', 'Differential Equations'] },
      { name: 'Algebra', topics: ['Quadratic Equations', 'Sequences Series', 'Complex Numbers', 'Matrices Determinants', 'Probability'] },
      { name: 'Coordinate Geometry', topics: ['Straight Lines', 'Circles', 'Parabola', 'Ellipse', 'Hyperbola'] },
    ],
  },
];

interface Receipt {
  slug: string;
  subject: string;
  topic: string;
  rigor_score: number;
  verdict: string;
  created_at: string;
}

export function MasteryTree() {
  const { user } = useAuth() as any;
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('mastery_receipts')
        .select('slug, subject, topic, rigor_score, verdict, created_at')
        .eq('user_id', user.id)
        .eq('public_visible', true)
        .order('created_at', { ascending: false });
      setReceipts((data || []) as Receipt[]);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const provenByTopic = useMemo(() => {
    const map = new Map<string, Receipt>();
    receipts.forEach((receipt) => {
      const key = receipt.topic.toLowerCase();
      const existing = map.get(key);
      if (!existing || receipt.rigor_score > existing.rigor_score) map.set(key, receipt);
    });
    return map;
  }, [receipts]);

  const totalTopics = JEE_TREE.flatMap(subject => subject.branches.flatMap(branch => branch.topics)).length;
  const provenCount = JEE_TREE.flatMap(subject => subject.branches.flatMap(branch => branch.topics)).filter(topic => provenByTopic.has(topic.toLowerCase())).length;
  const weeklyReceipts = receipts.filter(receipt => Date.now() - new Date(receipt.created_at).getTime() < 7 * 24 * 60 * 60 * 1000);
  const averageRigor = receipts.length ? receipts.reduce((sum, receipt) => sum + Number(receipt.rigor_score || 0), 0) / receipts.length : 0;
  const reportText = `JEE Mastery Report: ${provenCount}/${totalTopics} topics proven, ${weeklyReceipts.length} credentials this week, average rigor ${averageRigor.toFixed(1)}/10.`;

  const copyReport = async () => {
    await navigator.clipboard.writeText(reportText);
    showToast('Weekly mastery report copied', 'success');
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center text-sm font-bold text-[#64748B]">Loading mastery tree...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0A192F] transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="neo-card bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D1FF]/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[18px] bg-[#0A192F] text-white flex items-center justify-center">
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[#0A192F]">JEE Mastery Tree</h1>
                <p className="text-sm text-[#64748B]">Complete branches by proving each topic Socratically.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 min-w-full lg:min-w-[420px]">
              <div className="rounded-[16px] bg-[#F8FAF9] border border-[#0A192F]/10 p-4 text-center">
                <div className="text-2xl font-extrabold text-[#0A192F]">{provenCount}/{totalTopics}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Proven</div>
              </div>
              <div className="rounded-[16px] bg-[#F8FAF9] border border-[#0A192F]/10 p-4 text-center">
                <div className="text-2xl font-extrabold text-[#0A192F]">{weeklyReceipts.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">This Week</div>
              </div>
              <div className="rounded-[16px] bg-[#F8FAF9] border border-[#0A192F]/10 p-4 text-center">
                <div className="text-2xl font-extrabold text-[#0A192F]">{averageRigor.toFixed(1)}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Avg Rigor</div>
              </div>
            </div>
          </div>
        </div>

        <div className="neo-card bg-gradient-to-br from-[#00D1FF]/10 to-[#F472B6]/10 border-[#00D1FF]/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A192F] mb-1">
                <Sparkles className="w-4 h-4 text-[#00D1FF]" /> Weekly Mastery Report
              </div>
              <p className="text-sm text-[#64748B]">{reportText}</p>
            </div>
            <button onClick={copyReport} className="px-4 py-2.5 rounded-[12px] bg-[#0A192F] text-white text-xs font-bold hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" /> Copy Report Card
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {JEE_TREE.map((subject) => (
            <div key={subject.subject} className="space-y-4">
              <h2 className="text-lg font-extrabold text-[#0A192F]">{subject.subject}</h2>
              {subject.branches.map((branch) => {
                const branchProven = branch.topics.filter(topic => provenByTopic.has(topic.toLowerCase())).length;
                const branchComplete = branchProven === branch.topics.length;
                return (
                  <div key={branch.name} className={`rounded-[22px] border-2 bg-white p-4 ${branchComplete ? 'border-[#34D399]/40' : 'border-[#0A192F]/10'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-extrabold text-[#0A192F]">{branch.name}</h3>
                        <p className="text-xs text-[#64748B]">{branchProven}/{branch.topics.length} proven</p>
                      </div>
                      {branchComplete ? <Award className="w-6 h-6 text-[#34D399]" /> : <ShieldCheck className="w-6 h-6 text-[#64748B]" />}
                    </div>
                    <div className="space-y-2">
                      {branch.topics.map((topic) => {
                        const receipt = provenByTopic.get(topic.toLowerCase());
                        return (
                          <button
                            key={topic}
                            onClick={() => receipt ? navigate(`/m/${receipt.slug}`) : navigate(`/prove-it?subject=JEE%20${encodeURIComponent(subject.subject)}&topic=${encodeURIComponent(topic)}`)}
                            data-app-action={!receipt ? 'mastery-topic' : undefined}
                            className={`w-full flex items-center justify-between gap-3 p-3 rounded-[14px] border text-left transition-all ${receipt ? 'bg-[#34D399]/10 border-[#34D399]/20 hover:bg-[#34D399]/15' : 'bg-[#F8FAF9] border-[#0A192F]/5 hover:border-[#00D1FF]/30'}`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#0A192F] truncate">{topic}</p>
                              <p className="text-[10px] font-medium text-[#64748B]">{receipt ? `Rigor ${receipt.rigor_score}/10` : 'Not proven yet'}</p>
                            </div>
                            {receipt ? <BadgeCheck className="w-5 h-5 text-[#34D399] shrink-0" /> : <Lock className="w-4 h-4 text-[#94A3B8] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
