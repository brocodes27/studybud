import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Trophy, ShieldCheck, Loader2, UserPlus, BadgeCheck } from 'lucide-react';

export function PublicReceipt() {
  const { slug } = useParams<{ slug: string }>();
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from('mastery_receipts')
        .select('*')
        .eq('slug', slug)
        .single();
      if (!error && data) setReceipt(data);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#64748B]" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-[#64748B]">
        <ShieldCheck className="w-8 h-8 mb-2" />
        <p className="text-sm font-bold">Receipt not found or private.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="neo-card text-center space-y-3">
          <div className="w-16 h-16 bg-[#34D399]/10 border border-[#34D399]/20 rounded-full flex items-center justify-center mx-auto">
            <Trophy className="w-8 h-8 text-[#34D399]" />
          </div>
          <h1 className="text-lg font-extrabold text-[#0A192F]">JEE Mastery Credential</h1>
          <p className="text-sm text-[#64748B]">
            {receipt.subject} — {receipt.topic}
          </p>
          <div className="text-sm font-bold text-[#34D399]">
            Verdict: {receipt.verdict.toUpperCase()} · Rigor: {receipt.rigor_score}/10
          </div>
          <div className="rounded-[18px] border-2 border-[#0A192F]/10 bg-white p-4 flex items-center gap-4 text-left">
            <div className="w-20 h-20 rounded-[14px] bg-[#0A192F] p-2 grid grid-cols-5 gap-1 shrink-0">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className={`rounded-[2px] ${[0, 1, 3, 5, 6, 8, 10, 12, 13, 16, 18, 20, 21, 23, 24].includes((i + receipt.slug.length) % 25) ? 'bg-white' : 'bg-[#0A192F]'}`} />
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#34D399] mb-1">
                <BadgeCheck className="w-4 h-4" /> Verified by ElevenFolks
              </div>
              <p className="text-sm font-extrabold text-[#0A192F]">EF-JEE-{receipt.slug.toUpperCase()}</p>
              <p className="text-xs text-[#64748B] mt-1">Socratic proof of topic-level mastery.</p>
            </div>
          </div>
          <p className="text-[10px] text-[#64748B]">Issued {new Date(receipt.created_at).toLocaleDateString()}</p>
          <button
            onClick={() => window.location.href = `/prove-it?subject=${encodeURIComponent(receipt.subject)}&topic=${encodeURIComponent(receipt.topic)}&challenge=${receipt.slug}`}
            className="w-full py-3 rounded-[12px] bg-[#0A192F] text-white text-sm font-bold hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Challenge yourself on this topic
          </button>
        </div>
      </div>
    </div>
  );
}
