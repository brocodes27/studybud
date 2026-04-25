import { useState, useRef, useEffect } from 'react';
import { Send, ShieldCheck, RotateCcw, ChevronRight, Sparkles, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import AIService from '../../lib/aiService';
import { useAnalytics } from '../../hooks/useAnalytics';

interface Turn {
  role: 'q' | 'a' | 'v';
  content: string;
  score?: number;
}

const JEE_TOPICS = [
  'Rotational Dynamics',
  'Electrostatics',
  'GOC (Organic Chemistry)',
  'Limits & Continuity',
  'Chemical Bonding',
  'Thermodynamics',
  'Current Electricity',
];

export function LandingProveItDemo() {
  const { track } = useAnalytics();
  const [topic, setTopic] = useState(JEE_TOPICS[0]);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<'setup'|'grill'|'done'>('setup');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<{score:number; verdict:string}|null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns]);

  useEffect(() => {
    track('landing_demo_view');
  }, [track]);

  const start = async () => {
    track('demo_start', { topic });
    setStarted(true);
    setPhase('grill');
    setLoading(true);
    const system = `You are ATLAS in Prove-It mode — a strict Socratic examiner. Subject: JEE Physics/Chemistry/Maths, Topic: ${topic}. Ask ONE concise question. Do NOT explain. Do NOT encourage.`;
    const { response } = await AIService.getInstance().generateEmpatheticChat(system, 'guest', [], '', false);
    setTurns([{ role: 'q', content: response?.trim() || `Explain ${topic} in your own words.` }]);
    setLoading(false);
  };

  const submit = async () => {
    if (!input.trim() || loading) return;
    const ans = input.trim();
    setInput('');
    setTurns(p => [...p, { role: 'a', content: ans }]);
    setLoading(true);
    const prompt = `Grill this student on JEE ${topic}. History:\n${turns.map(t => `${t.role==='q'?'Q':'A'}: ${t.content}`).join('\n')}\nA: ${ans}\nIf this is exchange 3+ and understanding is solid, output exactly "[VERDICT:passed] Rigor:X/10 <summary>". Otherwise ask ONE harder follow-up. No fluff.`;
    const { response } = await AIService.getInstance().generateEmpatheticChat(prompt, 'guest', [], '', false);
    const text = response?.trim() || '';
    const v = text.match(/\[VERDICT:(passed|failed)\]\s*Rigor:([\d.]+)\/10\s*(.*)/i);
    if (v) {
      const rigor = parseFloat(v[2]);
      const verdict = v[1].toLowerCase();
      track('demo_complete', { topic, verdict, rigor_score: rigor });
      setTurns(p => [...p, { role: 'v', content: v[3], score: rigor }]);
      setPhase('done');
      setReceipt({ score: rigor, verdict });
    } else {
      setTurns(p => [...p, { role: 'q', content: text }]);
    }
    setLoading(false);
  };

  const reset = () => {
    setStarted(false);
    setPhase('setup');
    setTurns([]);
    setInput('');
    setReceipt(null);
  };

  return (
    <section id="demo" className="py-20 md:py-28 px-6 bg-[#0A192F]">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00D1FF]/10 border border-[#00D1FF]/20 text-[#00D1FF] text-xs font-bold uppercase tracking-widest mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            Try it — no signup needed
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
            Can you prove you know <span className="text-[#00D1FF]">{topic}</span>?
          </h2>
          <p className="text-[#94A3B8] text-base max-w-lg mx-auto">
            ATLAS will grill you with follow-up questions until you actually prove mastery. No hints. No shortcuts.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[24px] overflow-hidden"
        >
          {!started ? (
            <div className="p-8 md:p-10 text-center space-y-6">
              <div className="flex flex-wrap gap-2 justify-center">
                {JEE_TOPICS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${topic === t ? 'bg-[#00D1FF] text-[#0A192F]' : 'bg-white/5 text-[#94A3B8] border border-white/10 hover:bg-white/10'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={start}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#00D1FF] text-[#0A192F] font-extrabold rounded-[14px] hover:bg-[#00D1FF]/90 transition-colors"
              >
                <ShieldCheck className="w-5 h-5" />
                Start the Grill
              </button>
              <p className="text-[10px] text-[#64748B]">Free. Anonymous. No account required.</p>
            </div>
          ) : (
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold text-white">{topic}</div>
                {phase === 'done' && (
                  <button onClick={reset} className="flex items-center gap-1 text-xs font-bold text-[#94A3B8] hover:text-white transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" /> Retry
                  </button>
                )}
              </div>

              <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-2">
                {turns.map((t, i) => (
                  <div key={i} className={`p-4 rounded-[14px] border ${
                    t.role === 'q' ? 'bg-white/5 border-white/10' :
                    t.role === 'a' ? 'bg-[#00D1FF]/5 border-[#00D1FF]/20' :
                    'bg-[#34D399]/5 border-[#34D399]/20'
                  }`}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1 text-[#64748B]">
                      {t.role === 'q' ? 'ATLAS asks' : t.role === 'a' ? 'Your answer' : 'Verdict'}
                    </div>
                    <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{t.content}</p>
                    {t.score !== undefined && (
                      <div className="mt-2 text-xs font-bold text-[#34D399]">Rigor: {t.score}/10</div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <div className="w-4 h-4 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
                    ATLAS is thinking...
                  </div>
                )}
                <div ref={scrollRef} />
              </div>

              {phase === 'grill' && (
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    placeholder="Type your answer..."
                    className="flex-1 px-4 py-3 rounded-[12px] bg-white/5 border border-white/10 text-white placeholder-[#64748B] focus:outline-none focus:border-[#00D1FF]/40 text-sm"
                  />
                  <button
                    onClick={submit}
                    disabled={loading || !input.trim()}
                    className="px-4 py-3 rounded-[12px] bg-[#00D1FF] text-[#0A192F] hover:bg-[#00D1FF]/90 disabled:opacity-40 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}

              {phase === 'done' && receipt && (
                <div className="mt-4 p-4 rounded-[14px] bg-[#34D399]/5 border border-[#34D399]/20 text-center">
                  <Trophy className="w-8 h-8 text-[#34D399] mx-auto mb-2" />
                  <div className="text-lg font-extrabold text-white mb-1">
                    {receipt.verdict === 'passed' ? 'You proved it!' : 'Keep grinding.'}
                  </div>
                  <div className="text-sm text-[#94A3B8]">
                    Rigor score: <span className="text-[#34D399] font-bold">{receipt.score}/10</span>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                    <a
                      href="/signup"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00D1FF] text-[#0A192F] font-bold rounded-[10px] text-sm hover:bg-[#00D1FF]/90 transition-colors"
                    >
                      Sign up to save credentials <ChevronRight className="w-4 h-4" />
                    </a>
                    <button
                      onClick={reset}
                      className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/10 text-white font-bold rounded-[10px] text-sm hover:bg-white/5 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" /> Try another topic
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
