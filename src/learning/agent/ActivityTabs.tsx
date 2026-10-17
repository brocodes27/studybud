import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { BookOpen, ClipboardCheck, FileText, Home, Search, TrendingUp, X } from 'lucide-react';
import { assessmentLabel } from '../../../supabase/functions/_shared/learning-workflows';
import type { WorkspaceArtifact } from './contracts';
import './activity-tabs.css';

gsap.registerPlugin(useGSAP);

export function ActivityTabs({ artifacts, activeId, busy, onSelect, onClose, revealIds = [], reviewedIds = [] }: {
  artifacts: WorkspaceArtifact[]; activeId?: string | null; busy: boolean;
  onSelect: (id: string | null) => void; onClose: (id: string) => void;
  revealIds?: string[]; reviewedIds?: string[];
}) {
  const strip = useRef<HTMLDivElement>(null);
  const revealed = useRef(new Set<string>());
  const batch = revealIds.join('|');
  useGSAP(() => {
    const ids = batch ? batch.split('|') : [];
    const fresh = ids.filter(id => !revealed.current.has(id));
    const targets = fresh.map(id => Array.from(strip.current?.children || []).find(node => (node as HTMLElement).dataset.artifactId === id)).filter(Boolean);
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const animation = gsap.from(targets, { autoAlpha: 0, y: 18, scale: .96, duration: .55, delay: .9, stagger: .28, ease: 'power3.out', onComplete: () => { fresh.forEach(id => revealed.current.add(id)); } });
      const finish = () => { animation.progress(1); };
      document.addEventListener('curve:finish-research-reveal', finish);
      strip.current?.addEventListener('pointerdown', finish);
      strip.current?.addEventListener('focusin', finish);
      const element = strip.current;
      return () => { document.removeEventListener('curve:finish-research-reveal', finish); element?.removeEventListener('pointerdown', finish); element?.removeEventListener('focusin', finish); };
    });
    return () => media.revert();
  }, { scope: strip, dependencies: [batch], revertOnUpdate: true });
  useEffect(() => {
    strip.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId]);
  const tabs = [{ id: '', title: 'Today', kind: 'home' as const }, ...artifacts];
  return <div className="activity-tabs" ref={strip} role="tablist" aria-label="Study activities" onKeyDown={event => {
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    const next = event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowLeft' ? (index - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
  }}>
    {tabs.map(tab => {
      const selected = tab.id === (activeId || '');
      const title = tab.kind === 'assessment' ? assessmentLabel(tab) : tab.title;
      const Icon = tab.kind === 'home' ? Home : tab.kind === 'research' ? Search : tab.kind === 'assessment' ? ClipboardCheck : tab.kind === 'session' ? BookOpen : tab.kind === 'progress' ? TrendingUp : FileText;
      const canClose = tab.kind !== 'home' && tab.kind !== 'session' && !(tab.kind === 'assessment' && tab.status === 'assessing');
      return <div key={tab.id} data-artifact-id={tab.id} className={`activity-tab ${selected ? 'selected' : ''}`} role="presentation">
        <button type="button" role="tab" id={`activity-tab-${tab.id || 'today'}`} aria-selected={selected} aria-controls="study-canvas" tabIndex={selected ? 0 : -1} disabled={busy} title={tab.kind === 'assessment' ? `${title} · ${tab.goal}` : title} onClick={() => onSelect(tab.id || null)}>
          <Icon size={15} aria-hidden="true"/><span>{title}</span>{tab.kind === 'research' && <small>{reviewedIds.includes(tab.id) ? 'Reviewed' : 'Unread'}</small>}
        </button>
        {canClose && <button type="button" className="activity-tab-close" aria-label={`Close ${title}`} disabled={busy} onClick={() => onClose(tab.id)}><X size={13}/></button>}
      </div>;
    })}
  </div>;
}
