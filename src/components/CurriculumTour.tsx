import React, { useEffect, useMemo, useRef, useState } from 'react';

type Step = {
  id: string; // matches data-tour value
  title: string;
  content: string;
};

interface CurriculumTourProps {
  hasMonthlyPlan: boolean;
  hasTasks: boolean;
  ready?: boolean; // when false, tour will not auto-start
}

const STORAGE_KEY = 'tour:curriculum:v1:completed';
const GLOBAL_ACTIVE_KEY = 'tour:global:v1:active';

function useElementRect(selector: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    function getVisibleEl(sel: string): HTMLElement | null {
      const candidates = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) continue;
        // If not fixed and no offset parent, likely not visible/layouted
        if (el.offsetParent === null && style.position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        return el;
      }
      return null;
    }

    function update() {
      if (!selector) {
        setRect(null);
        return;
      }
      const el = getVisibleEl(selector);
      elRef.current = el;
      if (!el) {
        setRect(null);
        return;
      }
      setRect(el.getBoundingClientRect());
    }

    update();

    function onLayoutChange() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onLayoutChange, true);
    window.addEventListener('resize', onLayoutChange);
    window.addEventListener('orientationchange', onLayoutChange);
    document.addEventListener('transitionend', onLayoutChange, true);

    // Observe size changes of the target element (e.g., layout shifts)
    if (elRef.current && (window as any).ResizeObserver) {
      try {
        resizeObserverRef.current = new ResizeObserver(() => onLayoutChange());
        resizeObserverRef.current.observe(elRef.current);
      } catch {}
    }

    // Observe class/style mutations that may impact layout (e.g., sidebar collapse affecting page)
    if ((window as any).MutationObserver) {
      try {
        mutationObserverRef.current = new MutationObserver(() => onLayoutChange());
        mutationObserverRef.current.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
        mutationObserverRef.current.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
      } catch {}
    }
    return () => {
      window.removeEventListener('scroll', onLayoutChange, true);
      window.removeEventListener('resize', onLayoutChange);
      window.removeEventListener('orientationchange', onLayoutChange);
      document.removeEventListener('transitionend', onLayoutChange, true);
      if (resizeObserverRef.current) {
        try { resizeObserverRef.current.disconnect(); } catch {}
        resizeObserverRef.current = null;
      }
      if (mutationObserverRef.current) {
        try { mutationObserverRef.current.disconnect(); } catch {}
        mutationObserverRef.current = null;
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [selector]);

  return rect;
}

type BubblePlacement = {
  x: number;
  y: number;
  placement: 'right' | 'left' | 'top' | 'bottom' | 'center';
  w: number;
  h: number;
};

function computeBubblePlacement(rect: DOMRect | null, viewport: { w: number; h: number }): BubblePlacement {
  const margin = 12;
  const bubbleW = Math.min(320, Math.max(240, viewport.w - margin * 2));
  const bubbleH = Math.min(220, Math.max(160, Math.floor(viewport.h * 0.28)));
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  // Small screens: avoid edge overflow and keep controls reachable.
  if (viewport.w < 520) {
    return {
      x: clamp(Math.round((viewport.w - bubbleW) / 2), margin, Math.max(margin, viewport.w - bubbleW - margin)),
      y: clamp(Math.round(viewport.h - bubbleH - margin), margin, Math.max(margin, viewport.h - bubbleH - margin)),
      placement: 'center' as const,
      w: bubbleW,
      h: bubbleH,
    };
  }

  if (!rect) {
    return { x: viewport.w / 2 - bubbleW / 2, y: Math.max(40, viewport.h / 2 - bubbleH / 2), placement: 'center' as const, w: bubbleW, h: bubbleH };
  }

  // Prefer below
  if (rect.bottom + margin + bubbleH <= viewport.h) {
    return { x: clamp(rect.left + rect.width / 2 - bubbleW / 2, margin, viewport.w - bubbleW - margin), y: rect.bottom + margin, placement: 'bottom' as const, w: bubbleW, h: bubbleH };
  }
  // Then above
  if (rect.top - margin - bubbleH >= 0) {
    return { x: clamp(rect.left + rect.width / 2 - bubbleW / 2, margin, viewport.w - bubbleW - margin), y: rect.top - margin - bubbleH, placement: 'top' as const, w: bubbleW, h: bubbleH };
  }
  // Then right
  if (rect.right + margin + bubbleW <= viewport.w) {
    return { x: rect.right + margin, y: clamp(rect.top + rect.height / 2 - bubbleH / 2, margin, viewport.h - bubbleH - margin), placement: 'right' as const, w: bubbleW, h: bubbleH };
  }
  // Then left
  if (rect.left - margin - bubbleW >= 0) {
    return { x: rect.left - margin - bubbleW, y: clamp(rect.top + rect.height / 2 - bubbleH / 2, margin, viewport.h - bubbleH - margin), placement: 'left' as const, w: bubbleW, h: bubbleH };
  }

  // Fallback center
  return { x: viewport.w / 2 - bubbleW / 2, y: Math.max(40, viewport.h / 2 - bubbleH / 2), placement: 'center' as const, w: bubbleW, h: bubbleH };
}

const CurriculumTour: React.FC<CurriculumTourProps> = ({ hasMonthlyPlan, hasTasks, ready = false }) => {
  const steps: Step[] = useMemo(() => {
    const s: Step[] = [
      {
        id: 'month-label',
        title: 'Current Month',
        content: 'This shows which month you are viewing. Use it to make sure you are in the right timeframe.'
      },
      {
        id: 'month-prev',
        title: 'Go Back a Month',
        content: 'Use Prev to review earlier months.'
      },
      {
        id: 'month-next',
        title: 'Go Forward a Month',
        content: 'Use Next to see upcoming months.'
      },
      {
        id: 'generate-btn',
        title: hasMonthlyPlan ? 'Regenerate Plan' : 'Generate Monthly Plan',
        content: hasMonthlyPlan
          ? 'You already have a plan. Regenerate if you want a fresh schedule for this month.'
          : 'Tap Generate to create your monthly curriculum for this month.'
      },
      {
        id: 'filters',
        title: 'Filter Tasks',
        content: 'Toggle by source and status to focus on what you need today.'
      },
    ];
    if (hasTasks) {
      s.push({ id: 'task-toggle', title: 'Finish Tasks', content: 'Tap the circle to mark a task as completed or pending.' });
    }
    return s;
  }, [hasMonthlyPlan, hasTasks]);

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const seekRef = useRef<{ cancelled: boolean; tries: number } | null>(null);

  const activeStep = steps[index];
  const selector = activeStep ? `[data-tour="${activeStep.id}"]` : null;
  const rect = useElementRect(selector);

  // Ensure the target is scrolled into view when the step changes
  useEffect(() => {
    if (!open || !ready || !selector) return;
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return;
    const hadLock = document.body.classList.contains('tour-no-scroll');
    if (hadLock) document.body.classList.remove('tour-no-scroll');
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } catch {}
    // Re-lock on next frame
    requestAnimationFrame(() => {
      if (hadLock) document.body.classList.add('tour-no-scroll');
    });
  }, [open, ready, selector, index]);

  // Auto-start if not completed and page is ready, but skip if a global tour is active
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ready) return;
    const done = localStorage.getItem(STORAGE_KEY);
    const globalActive = localStorage.getItem(GLOBAL_ACTIVE_KEY);
    if (!done && !globalActive) setOpen(true);
  }, [ready]);

  // If a global tour becomes active while this is open, close this tour to prevent overlap
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      try {
        const globalActive = localStorage.getItem(GLOBAL_ACTIVE_KEY);
        if (globalActive) {
          setOpen(false);
        }
      } catch {}
    }, 300);
    return () => window.clearInterval(id);
  }, [open]);

  // Expose debug helpers for manual control from console
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__startCurriculumTour = () => {
      localStorage.removeItem(STORAGE_KEY);
      setIndex(0);
      setOpen(true);
    };
    (window as any).__resetCurriculumTour = () => {
      localStorage.removeItem(STORAGE_KEY);
      setIndex(0);
      setOpen(false);
    };
    return () => {
      delete (window as any).__startCurriculumTour;
      delete (window as any).__resetCurriculumTour;
    };
  }, []);

  // Keep debug inspector updated with current state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__getCurriculumTourDebugPositions = () => ({
      selector,
      rect,
      index,
      step: activeStep,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    });
    return () => {
      delete (window as any).__getCurriculumTourDebugPositions;
    };
  }, [selector, rect, index, activeStep]);

  // Prevent body scroll when tour is open
  useEffect(() => {
    if (!open) {
      document.body.classList.remove('tour-no-scroll');
      return;
    }
    document.body.classList.add('tour-no-scroll');
    return () => {
      document.body.classList.remove('tour-no-scroll');
    };
  }, [open]);

  // If the current target is not found, retry briefly to allow UI to render; then skip ahead or finish.
  useEffect(() => {
    if (!open || !ready || !activeStep) return;
    if (seekRef.current) seekRef.current.cancelled = true;
    const ctx = { cancelled: false, tries: 0 };
    seekRef.current = ctx;

    function attempt() {
      if (ctx.cancelled) return;
      const el = selector ? (document.querySelector(selector) as HTMLElement | null) : null;
      if (el) return; // found
      ctx.tries++;
      if (ctx.tries < 20) {
        setTimeout(attempt, 100); // ~2s total
      } else {
        // After retries, try to skip ahead to a step that exists
        for (let i = index + 1; i < steps.length; i++) {
          const nextSel = `[data-tour="${steps[i].id}"]`;
          const nextEl = document.querySelector(nextSel) as HTMLElement | null;
          if (nextEl) {
            setIndex(i);
            return;
          }
        }
        // nothing found — finish
        finish();
      }
    }

    attempt();
    return () => {
      ctx.cancelled = true;
    };
  }, [open, ready, index, activeStep?.id, selector, steps]);

  const viewport = { w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 };
  const bubble = computeBubblePlacement(rect, viewport);

  const radius = rect ? Math.ceil(Math.max(rect.width, rect.height) / 2) + 16 : 0;
  const cx = rect ? Math.round(rect.left + rect.width / 2) : viewport.w / 2;
  const cy = rect ? Math.round(rect.top + rect.height / 2) : viewport.h / 2;

  function skip() {
    // Treat Skip as completion so the tour doesn't show again automatically
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  function finish() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  function next() {
    if (index < steps.length - 1) {
      setIndex((i) => i + 1);
    } else {
      finish();
    }
  }

  function prev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  if (!open || steps.length === 0) return null;

  return (
    <div
      className="tour-overlay"
      aria-hidden
      onClick={(e) => {
        // Gate progression: block clicks outside bubble
        e.stopPropagation();
        e.preventDefault();
      }}
      style={{
        background: rect
          ? `radial-gradient(circle at ${cx}px ${cy}px, rgba(0,0,0,0) ${radius}px, rgba(0,0,0,0.6) ${radius + 1}px)`
          : 'rgba(0,0,0,0.6)'
      }}
    >
      {/* Highlight ring and pulse over the target */}
      {rect && (
        <div
          className="tour-highlight"
          style={{
            position: 'fixed',
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            borderRadius: 12,
          }}
        >
          <div className="tour-pulse" />
        </div>
      )}

      {/* Coachmark bubble */}
      <div
        className="tour-bubble"
        style={{ left: bubble.x, top: bubble.y, position: 'fixed', width: bubble.w, zIndex: 1000001 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-live="polite"
      >
        <div className="tour-bubble-title">{activeStep.title}</div>
        <div className="tour-bubble-content">{activeStep.content}</div>
        <div className="tour-bubble-footer">
          <div className="tour-step-indicator">{index + 1} / {steps.length}</div>
          <div className="tour-actions">
            <button className="tour-btn ghost" onClick={skip}>Skip</button>
            <div className="tour-spacer" />
            <button className="tour-btn" onClick={prev} disabled={index === 0}>Back</button>
            <button className="tour-btn primary" onClick={next}>{index === steps.length - 1 ? 'Finish' : 'Next'}</button>
          </div>
        </div>
        {/* Arrow */}
        {bubble.placement !== 'center' && (
          <div
            className={`tour-arrow tour-arrow-${bubble.placement}`}
            style={{
              position: 'absolute',
              // Center the arrow relative to the bubble for better alignment
              ...(bubble.placement === 'bottom' ? { top: -8, left: Math.round(bubble.w / 2 - 7) } : {}),
              ...(bubble.placement === 'top' ? { bottom: -8, left: Math.round(bubble.w / 2 - 7) } : {}),
              ...(bubble.placement === 'left' ? { right: -8, top: Math.round(bubble.h / 2 - 7) } : {}),
              ...(bubble.placement === 'right' ? { left: -8, top: Math.round(bubble.h / 2 - 7) } : {}),
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CurriculumTour;
