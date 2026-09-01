import { useEffect, useRef } from 'react';
// @ts-expect-error - vanilla engine, no types
import { mountScrollWorld } from '../lib/scrollWorldEngine.js';

/**
 * Scroll-scrubbed camera flight through the Curve world.
 *
 * The engine is framework-agnostic: it builds its own DOM and injects its own
 * CSS into the container, so React just gives it a div and stays out of the way.
 * Asset paths are absolute (`/world/...`) because the engine resolves them
 * against the page URL, and this component is mounted at `/`.
 */
export function WorldLanding() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || host.dataset.mounted) return;
    host.dataset.mounted = 'true';

    const A = '/world/assets';
    mountScrollWorld(host, {
      brand: { name: 'Curve', href: '#top' },
      cta: { label: 'Start free', href: '/auth' },
      hint: 'scroll to fly in',
      diveScroll: 1.3,
      connScroll: 0.9,
      sections: [
        {
          id: 'syllabus', label: 'Drop it in',
          still: `${A}/syllabus.png`, stillMobile: `${A}/syllabus-m.png`,
          clip: `${A}/vid/syllabus.mp4`, clipMobile: `${A}/vid/syllabus-m.mp4`,
          accent: '#7B5CF0',
          scroll: 1.5, linger: 0.35,
          eyebrow: 'The 10-second onboarding',
          title: 'Know your grade before your professor does.',
          body: 'Drop your syllabus PDFs. Curve pulls out every weighted category and weekly topic in ten seconds.',
          tags: ['Multi-syllabus', 'Auto-weighted', 'No setup'],
        },
        {
          id: 'forecast', label: 'Forecast',
          still: `${A}/forecast.png`, stillMobile: `${A}/forecast-m.png`,
          clip: `${A}/vid/forecast.mp4`, clipMobile: `${A}/vid/forecast-m.mp4`,
          accent: '#C9B8F7',
          eyebrow: 'Interactive grade engine',
          title: 'One number that never lies.',
          body: 'Every returned score re-cuts the projection — you see the letter band move the day the grade lands, not at finals.',
          tags: ['Live GPA', 'Per-course bands'],
        },
        {
          id: 'stages', label: 'Stages',
          still: `${A}/stages.png`, stillMobile: `${A}/stages-m.png`,
          clip: `${A}/vid/stages.mp4`, clipMobile: `${A}/vid/stages-m.mp4`,
          accent: '#A8E6D8',
          scroll: 1.5, linger: 0.4,
          eyebrow: 'Priming → encoding → retrieval',
          title: 'Studying, in the right order.',
          body: 'Each topic walks a staged loop instead of one long re-read, so it actually sticks past the exam.',
          tags: ['Staged sessions', 'Scored encoding'],
        },
        {
          id: 'briefing', label: 'Today',
          still: `${A}/briefing.png`, stillMobile: `${A}/briefing-m.png`,
          clip: `${A}/vid/briefing.mp4`, clipMobile: `${A}/vid/briefing-m.mp4`,
          accent: '#F5C451',
          eyebrow: 'Daily briefing',
          title: 'Exactly what to do today.',
          body: 'A short queue cut from your real deadlines and your weakest weights — no blank planner to fill in.',
          tags: ['Deadline-aware', 'Reordered nightly'],
        },
        {
          id: 'sprint', label: 'Sprint',
          still: `${A}/sprint.png`, stillMobile: `${A}/sprint-m.png`,
          clip: `${A}/vid/sprint.mp4`, clipMobile: `${A}/vid/sprint-m.mp4`,
          accent: '#F5B8D8',
          eyebrow: 'Exam emergency sprint',
          title: 'Forty-eight hours out.',
          body: 'Curve triages what is still worth points and drops everything that is not.',
          tags: ['Triaged', 'Highest-yield first'],
        },
        {
          id: 'gpa', label: 'The curve',
          still: `${A}/gpa.png`, stillMobile: `${A}/gpa-m.png`,
          clip: `${A}/vid/gpa.mp4`, clipMobile: `${A}/vid/gpa-m.mp4`,
          accent: '#7B5CF0',
          scroll: 1.7, linger: 0.5,
          eyebrow: 'And it all lands on',
          title: 'The grade you planned for.',
          body: 'No surprise at the end of term — just the number you have been watching climb all semester.',
          tags: [],
          cta: {
            primary: { label: 'Start free', href: '/auth' },
            secondary: { label: 'See how it works', href: '/classic' },
          },
        },
      ],
      connectors: [1, 2, 3, 4, 5].map((n) => `${A}/vid/conn${n}.mp4`),
      connectorsMobile: [1, 2, 3, 4, 5].map((n) => `${A}/vid/conn${n}-m.mp4`),
    });
  }, []);

  return (
    <>
      <style>{`
        :root, .sw-root {
          --sw-bg: #0E0A14;
          --sw-ink: #FFFFFF;
          --sw-ink-soft: #A79FB5;
          --sw-accent: #7B5CF0;
        }
        body { margin: 0; background: #0E0A14; }
        /* The app's global typography sets every heading to Playfair with
           !important and the old cream-theme ink, and Tailwind preflight drops
           heading sizes to 1rem. The engine's own styles live in @layer sw, so
           they lose to those unlayered rules — restate them here. */
        .sw-root h1, .sw-root h2, .sw-root h3, .sw-root h4 {
          font-family: var(--sw-font-display) !important;
          color: var(--sw-ink);
          font-weight: 700;
        }
        .sw-root .sw-copy__title {
          font-size: clamp(2rem, 4.4vw, 3.5rem);
          line-height: 1.03;
          letter-spacing: -0.01em;
          margin: 12px 0 0;
        }
        .sw-root .sw-brand__name { font-size: 1.1rem; }
        /* Brand mark: engine ships a plain gradient blob; swap in the Curve logo. */
        .sw-root .sw-brand__mark {
          width: 28px; height: 28px; border-radius: 9px;
          background: url('/world/curve-mark.svg') center / contain no-repeat;
          box-shadow: 0 6px 14px color-mix(in srgb, var(--sw-accent) 35%, transparent);
        }
        /* Engine buttons default to ink-on-white; ink IS white in this theme. */
        .sw-topcta, .sw-btn--primary { background: var(--sw-accent); color: #fff; }
        .sw-route__label { background: #251B33; color: #fff; }
        /* Covers the generator's corner watermark: above the clips (z 10),
           below the copy (z 20), fading to the page background. */
        .wm-cover {
          position: fixed; right: 0; bottom: 0; z-index: 15; pointer-events: none;
          width: clamp(190px, 25vw, 330px); height: clamp(170px, 27vh, 320px);
          background: radial-gradient(125% 125% at 100% 100%,
            var(--sw-bg) 0%, var(--sw-bg) 62%,
            color-mix(in srgb, var(--sw-bg) 68%, transparent) 76%,
            transparent 92%);
        }
      `}</style>
      <div id="top" />
      <div ref={hostRef} />
      <div className="wm-cover" aria-hidden="true" />
    </>
  );
}

export default WorldLanding;
