import { useRef } from 'react';
import { ArrowRight, ArrowUpRight, Check, FileText, Search } from 'lucide-react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ResearchArtifact, ResearchStatus } from '../../../supabase/functions/_shared/learning-workflows';
import { CurveMark } from '../Preview';
import './research-arrival.css';

gsap.registerPlugin(useGSAP);

export function ResearchArrival({ briefs, firstName, research, busy, onOpen }: {
  briefs: ResearchArtifact[];
  firstName: string;
  research?: ResearchStatus;
  busy: boolean;
  onOpen: (id: string) => void;
}) {
  const root = useRef<HTMLElement>(null);
  const animation = useRef<gsap.core.Timeline>();
  const batch = briefs.map(brief => brief.id).join('|');
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      animation.current = gsap.timeline({ defaults: { duration: .65, ease: 'power3.out' } })
        .from('.research-agent-intro', { autoAlpha: 0, y: 16 }, 0)
        .from('.research-delivery', { autoAlpha: 0, y: 24, rotation: 1.5, stagger: .28 }, .9);
    });
    return () => { media.revert(); animation.current = undefined; };
  }, { scope: root, dependencies: [batch], revertOnUpdate: true });

  const working = research?.enabled && research.status === 'running';
  const status = briefs.length ? `${briefs.length} unread brief${briefs.length === 1 ? '' : 's'} ready`
    : working ? 'Research in progress' : research?.enabled === false ? 'Daily research paused'
    : research?.status === 'failed' ? 'Research needs another try' : 'Your research desk';
  const headline = briefs.length ? 'I’ve been researching for you.'
    : working ? 'I’m looking into your topics.' : 'Let’s get a little ahead.';
  const sourceCount = new Set(briefs.flatMap(brief => brief.sources.map(source => source.url))).size;

  return <section className="research-arrival" ref={root} aria-label="Curve research briefing">
    <div className="research-agent-intro">
      <div className="research-agent-identity"><span className="research-agent-avatar"><CurveMark /></span><div><strong>Curve</strong><span>Your learning agent</span></div><span className={`research-agent-status ${working ? 'is-working' : ''}`}><i />{status}</span></div>
      <p className="research-hello">Welcome back, {firstName}.</p>
      <h1>{headline}</h1>
      <p className="research-agent-message">{briefs.length
        ? `I researched ${briefs.map(brief => brief.topic || brief.title).slice(0, 3).join(', ')}${briefs.length > 3 ? ` and ${briefs.length - 3} more topics` : ''} and prepared ${briefs.length === 1 ? 'a brief' : `${briefs.length} briefs`} for you. Pick one and I’ll walk you through it.`
        : working ? 'I’m preparing briefs from your syllabus and recent knowledge checks. They’ll appear here when they’re ready.'
        : research?.enabled === false ? 'Daily research is paused. You can turn it back on in Options whenever you’re ready.'
        : research?.status === 'failed' ? 'The latest research didn’t finish. Your saved work is safe, and research will retry automatically.'
        : 'When new research is ready, I’ll bring the topics, reports, and sources right here. For now, your study plan is below.'}</p>
      {briefs.length > 0 && <div className="research-agent-actions"><button type="button" className="learn-button dark" disabled={busy} onClick={() => onOpen(briefs[0].id)}>Walk me through it <ArrowRight size={16} /></button><span><Check size={14} /> Saved to your workspace</span></div>}
      {working && briefs.length > 0 && <p className="research-background-note" role="status">More research is in progress. These briefs are ready to read.</p>}
    </div>
    {briefs.length > 0 && <div className="research-deliveries">
      <header><span><FileText size={14} /> Prepared for you</span><span>{sourceCount} source{sourceCount === 1 ? '' : 's'} attached</span></header>
      <div className="research-delivery-list">{briefs.map((brief, index) => <button type="button" className="research-delivery" key={brief.id} disabled={busy} onClick={() => onOpen(brief.id)}>
        <span className="research-delivery-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="research-delivery-body"><span className="research-delivery-kind"><Search size={11} /> Research brief <span>Ready</span></span><strong>{brief.topic || brief.title}</strong><span>{brief.sources.length} source{brief.sources.length === 1 ? '' : 's'} · {new Date(brief.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></span>
        <ArrowUpRight size={18} />
      </button>)}</div>
      <p className="research-delivery-footnote">Open a brief to explore the ideas and read the sources.</p>
    </div>}
    {briefs.length > 0 && <button type="button" className="research-skip-motion" onClick={() => { animation.current?.progress(1); root.current?.dispatchEvent(new CustomEvent('curve:finish-research-reveal', { bubbles: true })); }}>Skip animation</button>}
  </section>;
}
