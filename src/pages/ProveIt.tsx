import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AIService from '../lib/aiService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useAnalytics } from '../hooks/useAnalytics';
import { BrainCircuit, Send, Trophy, RotateCcw, ChevronLeft, Loader2, Sparkles, QrCode, Share2, UserPlus, BadgeCheck } from 'lucide-react';

interface Turn { role: 'q' | 'a' | 'v'; content: string; score?: number; }

export function ProveIt() {
  const { user } = useAuth() as any;
  const { showToast } = useToast();
  const { track } = useAnalytics();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'setup'|'grill'|'done'>('setup');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [weak, setWeak] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [challengeId, setChallengeId] = useState('');
  const [squadId, setSquadId] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('student_behavioral_profiles').select('weak_subjects').eq('user_id', user.id).single()
      .then(({ data }) => { if (data?.weak_subjects?.length) setWeak(data.weak_subjects); });
  }, [user?.id]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns]);

  useEffect(() => {
    const challengeSubject = searchParams.get('subject');
    const challengeTopic = searchParams.get('topic');
    const inboundChallenge = searchParams.get('challenge');
    const inboundSquad = searchParams.get('squad');
    if (challengeSubject) setSubject(challengeSubject);
    if (challengeTopic) setTopic(challengeTopic);
    if (inboundChallenge) setChallengeId(inboundChallenge);
    if (inboundSquad) setSquadId(inboundSquad);
  }, [searchParams]);

  const start = async (subj: string, t: string) => {
    track('prove_it_start', { subject: subj, topic: t, squad_id: squadId });
    setSubject(subj); setTopic(t); setPhase('grill'); setLoading(true);
    const system = `You are ATLAS in Prove-It mode — a strict Socratic examiner. Subject: ${subj}, Topic: ${t}. Ask ONE concise question. Do NOT explain. Do NOT encourage.`;
    const { response } = await AIService.getInstance().generateEmpatheticChat(system, user?.id || 'guest', [], '', false);
    setTurns([{ role: 'q', content: response?.trim() || `Explain ${t} in your own words.` }]);
    setLoading(false);
  };

  const submit = async () => {
    if (!input.trim() || loading) return;
    const ans = input.trim(); setInput('');
    setTurns(p => [...p, { role: 'a', content: ans }]);
    setLoading(true);
    const prompt = `Grill this student on ${subject}/${topic}. History:\n${turns.map(t => `${t.role==='q'?'Q':'A'}: ${t.content}`).join('\n')}\nA: ${ans}\nIf this is exchange 3+ and understanding is solid, output exactly "[VERDICT:passed] Rigor:X/10 <summary>". Otherwise ask ONE harder follow-up. No fluff.`;
    const { response } = await AIService.getInstance().generateEmpatheticChat(prompt, user?.id || 'guest', [], '', false);
    const text = response?.trim() || '';
    const v = text.match(/\[VERDICT:(passed|failed)\]\s*Rigor:([\d.]+)\/10\s*(.*)/i);
    if (v) {
      const rigor = parseFloat(v[2]);
      setTurns(p => [...p, { role: 'v', content: v[3], score: rigor }]);
      setPhase('done');
      if (user?.id) {
        const slug = crypto.randomUUID().slice(0, 8);
        const qa = turns.map((t,i) => t.role==='q'?{q:t.content,a:turns[i+1]?.content||''}:null).filter(Boolean);
        const metadata = { challenge_id: challengeId || null, squad_id: squadId || null };
        const { data } = await supabase.from('mastery_receipts').insert({ user_id: user.id, slug, subject, topic, rigor_score: rigor, verdict: v[1].toLowerCase(), qa_log: qa, public_visible: true, metadata }).select('slug').single();
        const finalSlug = data?.slug || slug;
        if (squadId) {
          await supabase.from('prove_it_squad_attempts').upsert({
            squad_id: squadId,
            user_id: user.id,
            receipt_slug: finalSlug,
            subject,
            topic,
            rigor_score: rigor,
          }, { onConflict: 'squad_id,user_id,topic' });
        }
        setReceipt({ slug: finalSlug, rigor, verdict: v[1].toLowerCase(), subject, topic, challengeId, squadId });
      }
    } else {
      setTurns(p => [...p, { role: 'q', content: text }]);
    }
    setLoading(false);
  };

  const shareUrl = receipt ? `${window.location.origin}/m/${receipt.slug}` : '';
  const nextChallengeId = receipt ? `chal_${receipt.slug}_${crypto.randomUUID().slice(0, 6)}` : '';
  const challengeUrl = receipt ? `${window.location.origin}/prove-it?subject=${encodeURIComponent(receipt.subject)}&topic=${encodeURIComponent(receipt.topic)}&challenge=${nextChallengeId}${receipt.squadId ? `&squad=${encodeURIComponent(receipt.squadId)}` : ''}` : '';
  const linkedInUrl = receipt ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}` : '';
  const credentialId = receipt ? `EF-JEE-${receipt.slug.toUpperCase()}` : '';

  return (
    <div className="min-h-screen bg-[#F8FAF9] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0A192F] transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {phase === 'setup' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[16px] flex items-center justify-center">
                <BrainCircuit className="w-6 h-6 text-[#00D1FF]" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-[#0A192F]">JEE Prove-It Mode</h1>
                <p className="text-sm text-[#64748B]">ATLAS grills you until you prove real JEE mastery. No hints.</p>
              </div>
            </div>

            <div className="neo-card space-y-4">
              <label className="text-sm font-bold text-[#0A192F]">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. JEE Physics"
                className="w-full px-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 font-medium text-[#0A192F] placeholder-[#64748B]/40 focus:outline-none focus:border-[#00D1FF]/40 bg-white" />

              <label className="text-sm font-bold text-[#0A192F]">Topic</label>
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Rotational Dynamics"
                className="w-full px-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 font-medium text-[#0A192F] placeholder-[#64748B]/40 focus:outline-none focus:border-[#00D1FF]/40 bg-white" />

              {weak.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-bold text-[#64748B] w-full">Suggested weak topics:</span>
                  {weak.slice(0, 5).map(w => (
                    <button key={w} onClick={() => setTopic(w)}
                      className="px-3 py-1.5 text-xs font-bold rounded-full bg-[#F472B6]/10 text-[#F472B6] border border-[#F472B6]/20 hover:bg-[#F472B6]/20 transition-colors">
                      {w}
                    </button>
                  ))}
                </div>
              )}

              <button onClick={() => start(subject, topic)} disabled={!subject || !topic}
                className="w-full py-3 rounded-[12px] bg-[#0A192F] text-white font-bold text-sm hover:bg-[#0A192F]/90 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" /> Start Grilling
              </button>
            </div>
          </div>
        )}

        {phase !== 'setup' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-[#0A192F]">{subject} — {topic}</h2>
                <p className="text-xs text-[#64748B]">{turns.length} exchanges{squadId ? ` · Squad ${squadId}` : challengeId ? ` · Challenge ${challengeId}` : ''}</p>
              </div>
              {phase === 'done' && (
                <button onClick={() => { setPhase('setup'); setTurns([]); setReceipt(null); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-[#0A192F] transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> Retry
                </button>
              )}
            </div>

            <div className="space-y-3">
              {turns.map((t, i) => (
                <div key={i} className={`p-4 rounded-[16px] border-2 ${
                  t.role === 'q' ? 'bg-white border-[#0A192F]/10' :
                  t.role === 'a' ? 'bg-[#00D1FF]/5 border-[#00D1FF]/20' :
                  'bg-[#34D399]/10 border-[#34D399]/20'
                }`}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1 text-[#64748B]">
                    {t.role === 'q' ? 'ATLAS asks' : t.role === 'a' ? 'Your answer' : 'Verdict'}
                  </div>
                  <p className="text-sm font-medium text-[#0A192F] whitespace-pre-wrap">{t.content}</p>
                  {t.score !== undefined && (
                    <div className="mt-2 text-xs font-bold text-[#34D399]">Rigor: {t.score}/10</div>
                  )}
                </div>
              ))}
              {loading && <div className="flex items-center gap-2 text-sm text-[#64748B]"><Loader2 className="w-4 h-4 animate-spin" /> ATLAS is thinking...</div>}
              <div ref={scrollRef} />
            </div>

            {phase === 'grill' && (
              <div className="flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="Type your answer..."
                  className="flex-1 px-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 font-medium text-[#0A192F] placeholder-[#64748B]/40 focus:outline-none focus:border-[#00D1FF]/40 bg-white" />
                <button onClick={submit} disabled={loading || !input.trim()}
                  className="px-4 py-3 rounded-[12px] bg-[#0A192F] text-white hover:bg-[#0A192F]/90 disabled:opacity-40 transition-all">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}

            {phase === 'done' && receipt && (
              <div className="neo-card space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#34D399]/10 border border-[#34D399]/20 rounded-full flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-[#34D399]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#0A192F]">JEE Mastery Credential</h3>
                    <p className="text-xs text-[#64748B]">{receipt.subject} / {receipt.topic} — {receipt.rigor}/10</p>
                  </div>
                </div>
                <div className="rounded-[18px] border-2 border-[#0A192F]/10 bg-white p-4 flex items-center gap-4">
                  <div className="w-24 h-24 rounded-[14px] bg-[#0A192F] p-2 grid grid-cols-5 gap-1 shrink-0" aria-label="Credential verification QR code">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={i} className={`rounded-[2px] ${[0, 1, 3, 5, 6, 8, 10, 12, 13, 16, 18, 20, 21, 23, 24].includes((i + receipt.slug.length) % 25) ? 'bg-white' : 'bg-[#0A192F]'}`} />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#34D399] mb-1">
                      <BadgeCheck className="w-4 h-4" /> Verifiable credential
                    </div>
                    <p className="text-sm font-extrabold text-[#0A192F]">{credentialId}</p>
                    <p className="text-xs text-[#64748B] mt-1">Anyone can scan or open the link to verify the rigor score and topic.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(shareUrl); showToast('Link copied', 'success'); }}
                    className="py-2.5 rounded-[10px] bg-[#0A192F] text-white text-xs font-bold hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5" /> Copy
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(challengeUrl); showToast('Challenge link copied', 'success'); }}
                    className="py-2.5 rounded-[10px] bg-[#F472B6] text-white text-xs font-bold hover:bg-[#F472B6]/90 transition-all flex items-center justify-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" /> Challenge
                  </button>
                  <button onClick={() => window.open(linkedInUrl, '_blank', 'noopener,noreferrer')}
                    className="py-2.5 rounded-[10px] bg-[#00D1FF] text-[#0A192F] text-xs font-bold hover:bg-[#00D1FF]/90 transition-all flex items-center justify-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" /> LinkedIn
                  </button>
                </div>
                <p className="text-[10px] text-[#64748B] break-all">{shareUrl}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
