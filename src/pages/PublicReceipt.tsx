import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Trophy, ShieldCheck, Loader2, UserPlus, BadgeCheck } from 'lucide-react';
import { ForecastCard } from '../curve/ForecastCard';

export function PublicReceipt() {
  const { slug } = useParams<{ slug: string }>();
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      // Curve forecast cards live in curve_forecast_receipts; legacy mastery
      // receipts remain readable on the same route for old links.
      const { data, error } = await supabase
        .from('curve_forecast_receipts')
        .select('*')
        .eq('slug', slug)
        .single();
      if (!error && data) {
        setReceipt(data);
        setLoading(false);
        return;
      }
      const { data: legacy, error: legacyError } = await supabase
        .from('mastery_receipts')
        .select('*')
        .eq('slug', slug)
        .single();
      if (!legacyError && legacy) setReceipt(legacy);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0814]">
        <Loader2 className="w-6 h-6 animate-spin text-[#8b5cf6]" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-[#64748B] bg-[#0a0814]">
        <ShieldCheck className="w-8 h-8 mb-2 text-[#8b5cf6]" />
        <p className="text-sm font-bold text-white">Receipt or forecast card not found.</p>
      </div>
    );
  }

  // Curve Forecast receipt rendering
  if (receipt.course_code || receipt.projected_letter) {
    return (
      <div className="min-h-screen bg-[#0a0814] flex flex-col items-center justify-center p-4">
        <ForecastCard
          courseCode={receipt.course_code || 'CHEM 2210'}
          courseTitle={receipt.course_title || 'Organic Chemistry I'}
          projectedLetter={receipt.projected_letter || 'B+'}
          lowPercent={Number(receipt.low_percent || 86.5)}
          highPercent={Number(receipt.high_percent || 91.2)}
          nextExamName={receipt.next_exam_name || 'Midterm 1'}
          daysToExam={Number(receipt.days_to_exam || 11)}
        />
        <div className="mt-6 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#8b5cf6] text-white font-bold text-sm hover:bg-[#7c3aed] transition-all shadow-lg"
          >
            Track your own college grades on Curve
          </a>
        </div>
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
          <h1 className="text-lg font-extrabold text-[#0A192F]">Mastery Credential</h1>
          <p className="text-sm text-[#64748B]">
            {receipt.subject} — {receipt.topic}
          </p>
          <div className="text-sm font-bold text-[#34D399]">
            Verdict: {receipt.verdict?.toUpperCase()} · Rigor: {receipt.rigor_score}/10
          </div>
          <div className="rounded-[18px] border-2 border-[#0A192F]/10 bg-white p-4 flex items-center gap-4 text-left">
            <div className="w-20 h-20 rounded-[14px] bg-[#0A192F] p-2 grid grid-cols-5 gap-1 shrink-0">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className={`rounded-[2px] ${[0, 1, 3, 5, 6, 8, 10, 12, 13, 16, 18, 20, 21, 23, 24].includes((i + (receipt.slug || '').length) % 25) ? 'bg-white' : 'bg-[#0A192F]'}`} />
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#34D399] mb-1">
                <BadgeCheck className="w-4 h-4" /> Verified by Curve
              </div>
              <p className="text-sm font-extrabold text-[#0A192F]">CURVE-{(receipt.slug || '').toUpperCase()}</p>
              <p className="text-xs text-[#64748B] mt-1">Socratic proof of topic-level mastery.</p>
            </div>
          </div>
          <p className="text-[10px] text-[#64748B]">Issued {new Date(receipt.created_at || Date.now()).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

