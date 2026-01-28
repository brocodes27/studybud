import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// A simple cross-page guided tour that highlights the sidebar nav items and
// navigates users through the key pages automatically. It reuses the same
// overlay styles defined in src/index.css (tour-overlay, tour-bubble, etc.).

const STORAGE_KEY_COMPLETED = 'tour:global:v1:completed';
const STORAGE_KEY_ACTIVE = 'tour:global:v1:active';

function useElementRect(selector: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrollParentsRef = useRef<Element[]>([]);
  const elRef = useRef<HTMLElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    function getVisibleEl(sel: string): HTMLElement | null {
      const candidates = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) continue;
        if (el.offsetParent === null && style.position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        return el;
      }
      return null;
    }

    function getScrollParents(el: HTMLElement | null): Element[] {
      if (!el) return [];
      const parents: Element[] = [];
      let node: Element | null = el;
      while (node && node !== document.body && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        const overflow = style.overflow;
        if (/(auto|scroll|overlay)/.test(overflowY) || /(auto|scroll|overlay)/.test(overflow)) {
          parents.push(node);
        }
        node = node.parentElement;
      }
      // Also listen on document scrolling element and window
      if (document.scrollingElement) parents.push(document.scrollingElement);
      return parents;
    }

    function scheduleUpdate() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
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
      const r = el.getBoundingClientRect();
      setRect(r);
      try { if ((window as any).__tourDebug) console.debug('[GlobalTour] rect', selector, r); } catch {}
    }

    update();

    // Attach listeners to relevant targets
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);
    document.addEventListener('transitionend', scheduleUpdate, true);
    window.addEventListener('scroll', scheduleUpdate, true);

    // Attach to scrollable ancestors
    scrollParentsRef.current = getScrollParents(elRef.current);
    for (const p of scrollParentsRef.current) {
      p.addEventListener('scroll', scheduleUpdate, { passive: true } as any);
    }

    // Observe size changes of the target element
    if (elRef.current && (window as any).ResizeObserver) {
      try {
        resizeObserverRef.current = new ResizeObserver(() => scheduleUpdate());
        resizeObserverRef.current.observe(elRef.current);
      } catch {}
    }

    // Observe class/style mutations that may impact layout (e.g., sidebar collapse)
    if ((window as any).MutationObserver) {
      try {
        mutationObserverRef.current = new MutationObserver(() => scheduleUpdate());
        mutationObserverRef.current.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
        mutationObserverRef.current.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
      } catch {}
    }

    return () => {
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
      document.removeEventListener('transitionend', scheduleUpdate, true);
      window.removeEventListener('scroll', scheduleUpdate, true);
      for (const p of scrollParentsRef.current) {
        p.removeEventListener('scroll', scheduleUpdate as any);
      }
      if (resizeObserverRef.current) {
        try { resizeObserverRef.current.disconnect(); } catch {}
        resizeObserverRef.current = null;
      }
      if (mutationObserverRef.current) {
        try { mutationObserverRef.current.disconnect(); } catch {}
        mutationObserverRef.current = null;
      }
      scrollParentsRef.current = [];
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

  // Small screens: keep the bubble in a consistent, readable place.
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

  // Prefer right of the nav item, then left, then below, then above
  if (rect.right + margin + bubbleW <= viewport.w) {
    return { x: rect.right + margin, y: clamp(rect.top + rect.height / 2 - bubbleH / 2, margin, viewport.h - bubbleH - margin), placement: 'right' as const, w: bubbleW, h: bubbleH };
  }
  if (rect.left - margin - bubbleW >= 0) {
    return { x: rect.left - margin - bubbleW, y: clamp(rect.top + rect.height / 2 - bubbleH / 2, margin, viewport.h - bubbleH - margin), placement: 'left' as const, w: bubbleW, h: bubbleH };
  }
  if (rect.bottom + margin + bubbleH <= viewport.h) {
    return { x: clamp(rect.left + rect.width / 2 - bubbleW / 2, margin, viewport.w - bubbleW - margin), y: rect.bottom + margin, placement: 'bottom' as const, w: bubbleW, h: bubbleH };
  }
  if (rect.top - margin - bubbleH >= 0) {
    return { x: clamp(rect.left + rect.width / 2 - bubbleW / 2, margin, viewport.w - bubbleW - margin), y: rect.top - margin - bubbleH, placement: 'top' as const, w: bubbleW, h: bubbleH };
  }

  // Fallback center
  return { x: viewport.w / 2 - bubbleW / 2, y: Math.max(40, viewport.h / 2 - bubbleH / 2), placement: 'center' as const, w: bubbleW, h: bubbleH };
}

type GlobalStep = {
  path: string;        // route path, e.g. '/curriculum'
  title: string;       // bubble title
  content: string;     // bubble content
};

const studentSteps: GlobalStep[] = [
  { path: '/', title: 'Dashboard', content: 'Your personal AI mentor and home dashboard.' },
  { path: '/create', title: 'Create Plan', content: 'Set up a new study plan tailored to your goals.' },
  { path: '/plans', title: 'Study Plans', content: 'Browse and manage all your study plans.' },
  { path: '/curriculum', title: 'Curriculum', content: 'View and manage your monthly curriculum and tasks.' },
  { path: '/tools', title: 'Study Tools', content: 'Access calculators, generators, and utilities.' },
  { path: '/progress', title: 'Progress', content: 'Track your learning progress and achievements.' },
  { path: '/analytics', title: 'Analytics', content: 'Insights into study habits and performance.' },
  { path: '/calendar', title: 'Calendar Sync', content: 'Sync and view tasks on your calendar.' },
  { path: '/live-notes', title: 'Live Meeting Notes', content: 'Capture notes in real-time during lectures or calls.' },
  { path: '/social', title: 'Social', content: 'Connect with peers and share learning.' },
  { path: '/notifications', title: 'Notifications', content: 'Stay informed with updates and reminders.' },
  { path: '/my-classes', title: 'My Classes', content: 'Manage classes assigned to you and view details.' },
];

const teacherSteps: GlobalStep[] = [
  { path: '/teacher', title: 'Teacher Panel', content: 'Manage classes and teaching resources.' },
  { path: '/cbse-simulator', title: 'CBSE Simulator', content: 'Run CBSE exam simulations.' },
  { path: '/cuet-simulator', title: 'CUET Simulator', content: 'Run CUET exam simulations.' },
];

const GlobalTourManager: React.FC = () => {
  const { user, role, loading } = useAuth() as any;
  const navigate = useNavigate();
  const location = useLocation();

  const steps = useMemo<GlobalStep[]>(() => {
    if (role === 'teacher') return teacherSteps;
    return studentSteps;
  }, [role]);

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const seekRef = useRef<{ cancelled: boolean; tries: number } | null>(null);

  const active = steps[index];
  const anchorSelector = active ? `[data-tour-nav="${active.path}"]` : null;
  const rect = useElementRect(anchorSelector);

  const viewport = { w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 };
  const bubble = computeBubblePlacement(rect, viewport);

  const radius = rect ? Math.ceil(Math.max(rect.width, rect.height) / 2) + 16 : 0;
  const cx = rect ? Math.round(rect.left + rect.width / 2) : viewport.w / 2;
  const cy = rect ? Math.round(rect.top + rect.height / 2) : viewport.h / 2;

  function skip() {
    localStorage.setItem(STORAGE_KEY_COMPLETED, '1');
    setOpen(false);
  }

  function finish() {
    localStorage.setItem(STORAGE_KEY_COMPLETED, '1');
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

  // Ensure the target is scrolled into view (e.g., inside sidebar scroller) when step changes
  useEffect(() => {
    if (!open || !anchorSelector) return;
    const el = document.querySelector(anchorSelector) as HTMLElement | null;
    if (!el) return;
    const hadLock = document.body.classList.contains('tour-no-scroll');
    if (hadLock) document.body.classList.remove('tour-no-scroll');
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } catch {}
    requestAnimationFrame(() => {
      if (hadLock) document.body.classList.add('tour-no-scroll');
    });
  }, [open, index, anchorSelector]);

  // Toggle global-active flag and body scroll lock
  useEffect(() => {
    if (open) {
      document.body.classList.add('tour-no-scroll');
      localStorage.setItem(STORAGE_KEY_ACTIVE, '1');
    } else {
      document.body.classList.remove('tour-no-scroll');
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    }
    return () => {
      document.body.classList.remove('tour-no-scroll');
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    };
  }, [open]);

  // Auto-start when user is authenticated and role resolved, unless completed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading) return;
    if (!user) return;

    const done = localStorage.getItem(STORAGE_KEY_COMPLETED);
    if (!done) {
      // Optional: do not start on special pages
      setOpen(true);
    }
  }, [loading, user]);

  // Navigate to the current step's route whenever the step changes while the tour is open
  useEffect(() => {
    if (!open || !active) return;
    if (location.pathname !== active.path) {
      navigate(active.path, { replace: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, active?.path]);

  // If the current target is not found, retry for a short period (to allow route/layout to render).
  // Only after retries should we consider skipping ahead; if none available, finish.
  useEffect(() => {
    if (!open || !active) return;
    // cancel previous seek
    if (seekRef.current) seekRef.current.cancelled = true;
    const ctx = { cancelled: false, tries: 0 };
    seekRef.current = ctx;

    function attempt() {
      if (ctx.cancelled) return;
      const el = anchorSelector ? (document.querySelector(anchorSelector) as HTMLElement | null) : null;
      if (el) return; // found; nothing to do
      ctx.tries++;
      if (ctx.tries < 20) {
        // ~2s total at 100ms intervals
        setTimeout(attempt, 100);
      } else {
        // After retries, try to skip ahead to the next available anchor
        for (let i = index + 1; i < steps.length; i++) {
          const nextSel = `[data-tour-nav="${steps[i].path}"]`;
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
  }, [open, index, active?.path, anchorSelector, steps]);

  // Debug hooks
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__startGlobalTour = () => {
      localStorage.removeItem(STORAGE_KEY_COMPLETED);
      setIndex(0);
      setOpen(true);
    };
    (window as any).__resetGlobalTour = () => {
      localStorage.removeItem(STORAGE_KEY_COMPLETED);
      setIndex(0);
      setOpen(false);
    };
    (window as any).__forceGlobalTourReposition = () => {
      try {
        window.dispatchEvent(new Event('resize'));
      } catch {}
    };
    return () => {
      delete (window as any).__startGlobalTour;
      delete (window as any).__resetGlobalTour;
      delete (window as any).__forceGlobalTourReposition;
    };
  }, []);

  // Update debug inspector to get current selector/rect/bubble on demand
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__getGlobalTourDebugPositions = () => ({
      anchorSelector,
      rect,
      bubble,
      index,
      active,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    });
    return () => {
      delete (window as any).__getGlobalTourDebugPositions;
    };
  }, [anchorSelector, rect, bubble, index, active]);

  if (!open || steps.length === 0) return null;

  return createPortal(
    <div
      className="tour-overlay"
      aria-hidden
      onClick={(e) => {
        // Block clicks outside bubble
        e.stopPropagation();
        e.preventDefault();
      }}
      style={{
        background: rect
          ? `radial-gradient(circle at ${cx}px ${cy}px, rgba(0,0,0,0) ${radius}px, rgba(0,0,0,0.6) ${radius + 1}px)`
          : 'rgba(0,0,0,0.6)'
      }}
    >
      {/* Highlight ring and pulse */}
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
        <div className="tour-bubble-title">{active.title}</div>
        <div className="tour-bubble-content">{active.content}</div>
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
              ...(bubble.placement === 'bottom' ? { top: -8, left: Math.round(bubble.w / 2 - 7) } : {}),
              ...(bubble.placement === 'top' ? { bottom: -8, left: Math.round(bubble.w / 2 - 7) } : {}),
              ...(bubble.placement === 'left' ? { right: -8, top: Math.round(bubble.h / 2 - 7) } : {}),
              ...(bubble.placement === 'right' ? { left: -8, top: Math.round(bubble.h / 2 - 7) } : {}),
            }}
          />
        )}
      </div>
    </div>,
    document.body
  );
};

export default GlobalTourManager;
