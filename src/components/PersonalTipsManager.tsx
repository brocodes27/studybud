import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// A lightweight, center-bubble personal tips overlay, styled like CurriculumTour
// - One-time per-feature tips using localStorage keys: tips:<pathKey>:v1:completed
// - Avoids overlap with the Global tour (checks tour:global:v1:active)
// - Uses the same CSS classes defined for CurriculumTour (tour-overlay, tour-bubble, etc.)

type TipStep = {
  id?: string; // optional data-tour id for anchored coachmark
  title: string;
  content: string;
};

type TipConfig = {
  key: string; // path key used for localStorage
  steps: TipStep[];
};

const PERSONAL_ACTIVE_KEY = 'tips:personal:v1:active';
const GLOBAL_ACTIVE_KEY = 'tour:global:v1:active';

// Reusable: track an element's rect by CSS selector with visibility guards
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

    if (elRef.current && (window as any).ResizeObserver) {
      try {
        resizeObserverRef.current = new ResizeObserver(() => onLayoutChange());
        resizeObserverRef.current.observe(elRef.current);
      } catch { }
    }
    if ((window as any).MutationObserver) {
      try {
        mutationObserverRef.current = new MutationObserver(() => onLayoutChange());
        mutationObserverRef.current.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
        mutationObserverRef.current.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
      } catch { }
    }
    return () => {
      window.removeEventListener('scroll', onLayoutChange, true);
      window.removeEventListener('resize', onLayoutChange);
      window.removeEventListener('orientationchange', onLayoutChange);
      document.removeEventListener('transitionend', onLayoutChange, true);
      if (resizeObserverRef.current) {
        try { resizeObserverRef.current.disconnect(); } catch { }
        resizeObserverRef.current = null;
      }
      if (mutationObserverRef.current) {
        try { mutationObserverRef.current.disconnect(); } catch { }
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

  // Small screens: keep tips at the bottom for readability.
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

  if (rect.bottom + margin + bubbleH <= viewport.h) {
    return { x: clamp(rect.left + rect.width / 2 - bubbleW / 2, margin, viewport.w - bubbleW - margin), y: rect.bottom + margin, placement: 'bottom' as const, w: bubbleW, h: bubbleH };
  }
  if (rect.top - margin - bubbleH >= 0) {
    return { x: clamp(rect.left + rect.width / 2 - bubbleW / 2, margin, viewport.w - bubbleW - margin), y: rect.top - margin - bubbleH, placement: 'top' as const, w: bubbleW, h: bubbleH };
  }
  if (rect.right + margin + bubbleW <= viewport.w) {
    return { x: rect.right + margin, y: clamp(rect.top + rect.height / 2 - bubbleH / 2, margin, viewport.h - bubbleH - margin), placement: 'right' as const, w: bubbleW, h: bubbleH };
  }
  if (rect.left - margin - bubbleW >= 0) {
    return { x: rect.left - margin - bubbleW, y: clamp(rect.top + rect.height / 2 - bubbleH / 2, margin, viewport.h - bubbleH - margin), placement: 'left' as const, w: bubbleW, h: bubbleH };
  }
  return { x: viewport.w / 2 - bubbleW / 2, y: Math.max(40, viewport.h / 2 - bubbleH / 2), placement: 'center' as const, w: bubbleW, h: bubbleH };
}

function usePathKey(pathname: string) {
  // Normalize to feature keys; keep curriculum out to avoid duplicate overlays with CurriculumTour
  if (pathname.startsWith('/teacher')) return 'teacher';
  if (pathname.startsWith('/class/')) return 'teacher-class';
  if (pathname.startsWith('/my-notes')) return 'my-notes';
  switch (pathname) {
    case '/':
      return 'atlas';
    case '/dashboard':
      return 'dashboard';
    case '/create':
      return 'create';
    case '/plans':
      return 'plans';
    case '/curriculum':
      return 'curriculum-skip'; // skip: Curriculum has its own dedicated tour
    case '/tools':
      return 'tools';
    case '/progress':
      return 'progress';
    case '/analytics':
      return 'analytics';
    case '/calendar':
      return 'calendar';
    case '/social':
      return 'social';
    case '/notifications':
      return 'notifications';
    case '/live-notes':
      return 'live-notes';
    case '/admin':
      return 'admin';
    case '/my-classes':
      return 'my-classes';
    case '/profile':
      return 'profile';
    case '/pricing':
      return 'pricing';
    default:
      return 'other';
  }
}

const PersonalTipsManager: React.FC = () => {
  const location = useLocation();
  const pathKey = usePathKey(location.pathname);

  // Define per-feature tips
  const config = useMemo<TipConfig | null>(() => {
    if (pathKey === 'curriculum-skip') return null; // Let CurriculumTour handle it

    const make = (key: string, steps: TipStep[]): TipConfig => ({ key, steps });

    switch (pathKey) {
      case 'atlas':
        return make('atlas', [
          {
            id: 'atlas-today-panel',
            title: "Today's Plan",
            content: 'See your subject, topic, and focus for today. Use the quick actions to get an explanation, practices, a short quiz, or a 5-bullet summary.'
          },
          {
            id: 'atlas-explain',
            title: 'Explain Topic',
            content: 'Get a simple step-by-step explanation with a tiny example for fast understanding.'
          },
          {
            id: 'atlas-practice',
            title: '5 Practices',
            content: 'Ask for 5 practice questions with brief hints. Solutions can be revealed on demand.'
          },
          {
            id: 'atlas-quiz',
            title: '3-Question Quiz',
            content: 'Test yourself with a quick 3Q quiz and get step-by-step checking.'
          },
          {
            id: 'atlas-summary',
            title: '5-Bullet Summary',
            content: 'Request a concise 5-bullet summary perfect for quick revision.'
          },
          {
            id: 'atlas-reshuffle-7',
            title: 'Reshuffle 7 Days (AI)',
            content: 'Let the mentor suggest a simple day-wise reshuffle for the next week based on your context.'
          },
          {
            id: 'atlas-start-study',
            title: "Start Today's Study",
            content: 'Begin a guided session for today’s topic. I will keep you focused and track your progress.'
          },
          {
            id: 'atlas-rescheduler',
            title: 'Reschedule Missed Days',
            content: 'If you missed sessions, use this to rebalance the next days (powered by the rescheduler skill).'
          },
          {
            id: 'atlas-mark-done',
            title: 'Mark Done',
            content: 'When you finish today’s study, mark it completed to maintain streaks and momentum.'
          },
          {
            id: 'atlas-plan-select',
            title: 'Select Study Plan',
            content: 'Switch between your study plans. The selected plan drives today’s topic and actions.'
          },
          {
            id: 'atlas-quick-reschedule',
            title: 'Quick Reschedule',
            content: 'A handy reschedule shortcut near the plan selector.'
          },
          {
            id: 'atlas-input',
            title: 'Ask ATLAS',
            content: 'Type your questions here. I respond with clear, concise answers following your formatting preferences.'
          },
          {
            id: 'atlas-mic',
            title: 'Voice Input',
            content: 'Use the mic to speak your question. I’ll transcribe it and reply. Supported where web speech is available.'
          },
          {
            id: 'atlas-send',
            title: 'Send Message',
            content: 'Click Send to submit your question. You can also press Enter.'
          },
        ]);
      case 'dashboard':
        return make('dashboard', [
          {
            title: 'Dashboard Overview',
            content: 'Use quick actions and recent items to jump back into your work faster.'
          },
        ]);
      case 'create':
        return make('create', [
          {
            title: 'Create a Plan',
            content: 'Choose exam or goal, pick subjects, and set your timeline. You can always regenerate later.'
          },
        ]);
      case 'plans':
        return make('plans', [
          {
            title: 'Your Study Plans',
            content: 'Open an existing plan to continue or start a new one from the Create page.'
          },
        ]);
      case 'tools':
        return make('tools', [
          {
            title: 'Study Tools',
            content: 'Explore calculators, generators, and utilities to speed up your work.'
          },
        ]);
      case 'progress':
        return make('progress', [
          {
            title: 'Track Progress',
            content: 'Review your streaks and task completion to stay on track.'
          },
        ]);
      case 'analytics':
        return make('analytics', [
          {
            title: 'Insights',
            content: 'Find patterns in your study habits and focus on high-impact areas.'
          },
        ]);
      case 'calendar':
        return make('calendar', [
          {
            title: 'Calendar Sync',
            content: 'Sync tasks to your calendar to never miss important sessions.'
          },
        ]);
      case 'social':
        return make('social', [
          {
            title: 'Social',
            content: 'Connect with peers, share progress, and learn together.'
          },
        ]);
      case 'notifications':
        return make('notifications', [
          {
            title: 'Notifications',
            content: 'Manage alerts and reminders to fit your routine.'
          },
        ]);
      case 'live-notes':
        return make('live-notes', [
          {
            title: 'Live Meeting Notes',
            content: 'Capture notes during classes or calls and revisit them later.'
          },
        ]);
      case 'my-notes':
        return make('my-notes', [
          {
            title: 'My Notes',
            content: 'Browse and manage your saved notes. Tap any note to view details.'
          },
        ]);
      case 'my-classes':
        return make('my-classes', [
          {
            title: 'My Classes',
            content: 'Access classes assigned to you and view class resources.'
          },
        ]);
      case 'profile':
        return make('profile', [
          {
            title: 'Profile',
            content: 'Manage your details and preferences here.'
          },
        ]);
      case 'pricing':
        return make('pricing', [
          {
            title: 'Pricing',
            content: 'Compare plans and pick what fits your needs. You can upgrade anytime.'
          },
        ]);
      case 'teacher':
        return make('teacher', [
          {
            title: 'Teacher Panel',
            content: 'Manage classes and resources from here. Use the sidebar to navigate sections.'
          },
        ]);
      case 'teacher-class':
        return make('teacher-class', [
          {
            title: 'Class Dashboard',
            content: 'Review student progress, assignments, and announcements for this class.'
          },
        ]);
      case 'admin':
        return make('admin', [
          {
            title: 'Admin Panel',
            content: 'Admin-only controls live here. Proceed with caution.'
          },
        ]);
      default:
        return make('other', [
          {
            title: 'Quick Tip',
            content: 'Explore this page using the sidebar. Most actions are one or two clicks away.'
          },
        ]);
    }
  }, [pathKey]);

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const openedForKeyRef = useRef<string | null>(null);
  const seekRef = useRef<{ cancelled: boolean; tries: number } | null>(null);

  // Auto-open when entering a route with tips and not completed, and avoid overlap with global tour
  useEffect(() => {
    if (!config) {
      setOpen(false);
      openedForKeyRef.current = null;
      return;
    }
    const completedKey = `tips:${config.key}:v1:completed`;
    const done = typeof window !== 'undefined' ? localStorage.getItem(completedKey) : '1';
    const globalActive = typeof window !== 'undefined' ? localStorage.getItem(GLOBAL_ACTIVE_KEY) : null;
    const personalActive = typeof window !== 'undefined' ? localStorage.getItem(PERSONAL_ACTIVE_KEY) : null;

    if (!done && !globalActive && !personalActive) {
      openedForKeyRef.current = completedKey;
      setIndex(0);
      setOpen(true);
      // Mark as completed on first run so it won't re-open next time
      try { localStorage.setItem(completedKey, '1'); } catch { }
      try { localStorage.setItem(PERSONAL_ACTIVE_KEY, '1'); } catch { }
    } else {
      setOpen(false);
    }
  }, [config?.key]);

  // Expose debug helpers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__resetPersonalTips = () => {
      try {
        const keys = [
          'ranjan-sir', 'dashboard', 'create', 'plans', 'tools', 'progress', 'analytics', 'calendar', 'social', 'notifications', 'live-notes', 'my-notes', 'profile', 'pricing', 'my-classes', 'teacher', 'teacher-class', 'admin', 'other'
        ];
        for (const k of keys) localStorage.removeItem(`tips:${k}:v1:completed`);
      } catch { }
    };
    (window as any).__startPersonalTips = (k?: string) => {
      try {
        if (k) localStorage.removeItem(`tips:${k}:v1:completed`);
        else if (config) localStorage.removeItem(`tips:${config.key}:v1:completed`);
        setIndex(0);
        setOpen(true);
        localStorage.setItem(PERSONAL_ACTIVE_KEY, '1');
      } catch { }
    };
    return () => {
      delete (window as any).__resetPersonalTips;
      delete (window as any).__startPersonalTips;
    };
  }, [config?.key]);

  // Lock body scroll while open (consistent with CurriculumTour)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      document.body.classList.add('tour-no-scroll');
    } else {
      document.body.classList.remove('tour-no-scroll');
      try { localStorage.removeItem(PERSONAL_ACTIVE_KEY); } catch { }
    }
    return () => {
      document.body.classList.remove('tour-no-scroll');
    };
  }, [open]);

  function finishForCurrent() {
    try {
      if (openedForKeyRef.current) localStorage.setItem(openedForKeyRef.current, '1');
    } catch { }
    setOpen(false);
    try { localStorage.removeItem(PERSONAL_ACTIVE_KEY); } catch { }
  }

  function next() {
    if (!config) return finishForCurrent();
    if (index < config.steps.length - 1) setIndex((i) => i + 1);
    else finishForCurrent();
  }

  function prev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  const step = config?.steps?.[index];

  const selector = step?.id ? `[data-tour="${step.id}"]` : null;
  const rect = useElementRect(selector);
  const viewport = { w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 };
  const bubble = step?.id
    ? computeBubblePlacement(rect, viewport)
    : ({
      x: Math.max(12, Math.round(viewport.w / 2 - 160)),
      y: Math.max(40, Math.round(viewport.h / 2 - 80)),
      placement: 'center' as const,
      w: Math.min(320, Math.max(240, viewport.w - 24)),
      h: Math.min(220, Math.max(160, Math.floor(viewport.h * 0.28))),
    } satisfies BubblePlacement);
  const radius = rect ? Math.ceil(Math.max(rect.width, rect.height) / 2) + 16 : 0;
  const cx = rect ? Math.round(rect.left + rect.width / 2) : viewport.w / 2;
  const cy = rect ? Math.round(rect.top + rect.height / 2) : viewport.h / 2;

  // Scroll into view when step changes for anchored steps
  useEffect(() => {
    if (!open || !step?.id) return;
    const sel = `[data-tour="${step.id}"]`;
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return;
    const hadLock = document.body.classList.contains('tour-no-scroll');
    if (hadLock) document.body.classList.remove('tour-no-scroll');
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); } catch { }
    requestAnimationFrame(() => { if (hadLock) document.body.classList.add('tour-no-scroll'); });
  }, [open, step?.id, index]);

  // Retry-before-skip logic for anchored steps
  useEffect(() => {
    if (!open || !step?.id) return;
    if (seekRef.current) seekRef.current.cancelled = true;
    const ctx = { cancelled: false, tries: 0 };
    seekRef.current = ctx;
    const sel = `[data-tour="${step.id}"]`;
    function attempt() {
      if (ctx.cancelled) return;
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) return; // found
      ctx.tries++;
      if (ctx.tries < 20) {
        setTimeout(attempt, 100);
      } else {
        // Skip ahead to the next step with a found element, or finish
        if (!config) { finishForCurrent(); return; }
        for (let i = index + 1; i < config.steps.length; i++) {
          const nextId = config.steps[i].id;
          if (!nextId) { setIndex(i); return; }
          const nextSel = `[data-tour="${nextId}"]`;
          const nextEl = document.querySelector(nextSel) as HTMLElement | null;
          if (nextEl) { setIndex(i); return; }
        }
        finishForCurrent();
      }
    }
    attempt();
    return () => { ctx.cancelled = true; };
  }, [open, step?.id, index, config?.key]);

  if (!open || !config || config.steps.length === 0) return null;

  return (
    <div
      className="tour-overlay"
      aria-hidden
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      style={{
        background: step?.id && rect
          ? `radial-gradient(circle at ${cx}px ${cy}px, rgba(0,0,0,0) ${radius}px, rgba(0,0,0,0.6) ${radius + 1}px)`
          : 'rgba(0,0,0,0.6)'
      }}
    >
      {/* Highlight ring and pulse when anchored */}
      {step?.id && rect && (
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
        <div className="tour-bubble-title">{step?.title || ''}</div>
        <div className="tour-bubble-content">{step?.content || ''}</div>
        <div className="tour-bubble-footer">
          <div className="tour-step-indicator">{index + 1} / {config.steps.length}</div>
          <div className="tour-actions">
            <button className="tour-btn ghost" onClick={finishForCurrent}>Skip</button>
            <div className="tour-spacer" />
            <button className="tour-btn" onClick={prev} disabled={index === 0}>Back</button>
            <button className="tour-btn primary" onClick={next}>{index === config.steps.length - 1 ? 'Finish' : 'Next'}</button>
          </div>
        </div>
        {/* Arrow */}
        {step?.id && bubble.placement !== 'center' && (
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
    </div>
  );
};

export default PersonalTipsManager;
