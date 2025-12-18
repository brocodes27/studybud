import React, { useEffect, useRef, useState } from 'react';
import { Play, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OpenAIService } from '../lib/openaiService';

declare global {
  interface Window { ChemDoodle?: any; }
}

interface BlackboardPlayerProps {
  topic: string;
  subject: string;
  onClose: () => void;
}

interface ScriptSegment {
  id: number;
  textToSpeak: string;
  subtitles: string[];
  visualContent: string;
}

type BoardEventType = 'title' | 'text' | 'bullet' | 'label' | 'arrow' | 'structure' | 'svg';

type BoardEvent = {
  id: string;
  type: BoardEventType;
  content?: string;
  smiles?: string;
  svgPath?: string; // New field for AI-generated SVGs
  delay: number; // seconds from segment start
  duration: number; // seconds to draw
  x: number;
  y: number;
  width?: number; // Visual box width
  height?: number; // Visual box height
};



interface ActiveEvent extends BoardEvent {
  status: 'pending' | 'drawing' | 'done';
  startTime?: number;
  segments?: LineSegment[]; // for structures
  progress?: number;
  sessionId: number;
  notifiedComplete?: boolean;
}

interface LineSegment {
  x1: number; y1: number; x2: number; y2: number;
}

interface ChalkParticle {
  x: number; y: number; vx: number; vy: number; life: number; size: number; alpha: number;
}

const primaryChemSrc = 'https://web.chemdoodle.com/assets/standalone/ChemDoodleWeb.js';
const primaryChemCss = 'https://web.chemdoodle.com/assets/standalone/ChemDoodleWeb.css';
const fallbackChemSrc = 'https://cdn.jsdelivr.net/npm/chemdoodle@9.5.0/ChemDoodleWeb.js';
const fallbackChemCss = 'https://cdn.jsdelivr.net/npm/chemdoodle@9.5.0/ChemDoodleWeb.css';

type ChemLoadState = 'idle' | 'loading' | 'ready' | 'failed';
let chemLoadState: ChemLoadState = 'idle';
let chemLoadPromise: Promise<boolean> | null = null;

const attachCssOnce = (href: string) => {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
};

const loadScript = (src: string) => new Promise<boolean>((resolve) => {
  const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
  if (existing) {
    if (existing.dataset.loaded === 'true') { resolve(true); return; }
    existing.addEventListener('load', () => resolve(true), { once: true });
    existing.addEventListener('error', () => resolve(false), { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.dataset.origin = 'blackboard-chemdoodle';
  script.onload = () => { script.dataset.loaded = 'true'; resolve(true); };
  script.onerror = () => resolve(false);
  document.head.appendChild(script);
});

const ensureChemDoodle = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (window.ChemDoodle) { chemLoadState = 'ready'; return true; }
  if (chemLoadState === 'ready') return true;
  if (chemLoadState === 'failed') return false;
  if (chemLoadPromise) return chemLoadPromise;

  chemLoadState = 'loading';
  chemLoadPromise = (async () => {
    attachCssOnce(primaryChemCss);
    const primaryOk = await loadScript(primaryChemSrc);
    if (primaryOk && window.ChemDoodle) { chemLoadState = 'ready'; return true; }

    attachCssOnce(fallbackChemCss);
    const fallbackOk = await loadScript(fallbackChemSrc);
    if (fallbackOk && window.ChemDoodle) { chemLoadState = 'ready'; return true; }

    chemLoadState = 'failed';
    return false;
  })();

  return chemLoadPromise;
};

// Removed safeString, normalizeText, extractSmilesCandidate, splitCues, hasStructureIntent as they are no longer needed with strict JSON visuals


const buildNoisePattern = (ctx: CanvasRenderingContext2D) => {
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = 120;
  patternCanvas.height = 120;
  const pctx = patternCanvas.getContext('2d');
  if (!pctx) return null;
  pctx.fillStyle = '#0d1a13';
  pctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * patternCanvas.width;
    const y = Math.random() * patternCanvas.height;
    const a = 0.04 + Math.random() * 0.08;
    pctx.fillStyle = `rgba(255,255,255,${a})`;
    pctx.fillRect(x, y, 1, 1);
  }
  return ctx.createPattern(patternCanvas, 'repeat');
};

const jitter = (value: number, amt = 1.4) => value + (Math.random() * amt - amt / 2);
const stableRand = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (Math.sin(h) + 1) / 2;
};
const stableJitter = (seed: string, amt = 1.4) => {
  const r = stableRand(seed);
  return (r * amt) - amt / 2;
};
// clamp removed if unused - actually let's keep it if we might need it later for other things, but lint says it's unused.
// I'll remove it to satisfy lint.

const BOARD_LAYOUT = {
  marginX: 100,
  titleY: 120,
  lineStep: 72,
  bulletGap: 68,
  sectionGap: 40,
  diagramOffsetX: 420, // Move diagrams further to the right
  gridAlpha: 0.03,
  columnSpan: 280,
  safeTop: 100,
  structureOpacity: 0.45,
};


const drawChalkText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, progress: number, alpha: number) => {
  ctx.save();
  const len = Math.max(1, Math.floor(text.length * progress));
  const partial = text.slice(0, len);

  let currentX = x;

  partial.split('').forEach((ch, idx) => {
    const seed = `${text}-${idx}`;
    // Character specific randomization
    const fontJitter = stableRand(`${seed}-f`) * 4; // Slight size variation
    const fontSize = 32 + fontJitter;
    ctx.font = `${fontSize}px "Kalam", "Comic Sans MS", cursive`;

    // Measure actual width for proper spacing
    const metrics = ctx.measureText(ch);
    const charWidth = metrics.width;

    // Jitter the position slightly
    const offsetX = stableJitter(`${seed}-x`, 2);
    const offsetY = stableJitter(`${seed}-y`, 3);
    const rotation = stableJitter(`${seed}-rot`, 0.05); // Slight rotation for realism

    const dx = currentX + offsetX;
    const dy = y + offsetY;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rotation);

    const charAlpha = alpha * (0.85 + stableRand(`${seed}-a`) * 0.15);
    ctx.globalAlpha = charAlpha;
    ctx.fillStyle = 'rgba(242, 255, 235, 0.95)';
    ctx.shadowColor = 'rgba(57, 255, 20, 0.22)';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';

    ctx.strokeText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);

    ctx.restore();

    // Advance cursor - ensure spaces are wide enough
    // Manual adjustment for spaces as measureText might be small for space? 
    // MDN says measureText works for space usually.
    // We add a little tracking jitter
    const tracking = stableJitter(`${seed}-track`, 2);
    currentX += charWidth + tracking + 1; // +1 base padding
  });
  ctx.restore();
};

const drawChalkLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, alpha: number, progress = 1) => {
  ctx.save();
  const seed = `${x1},${y1},${x2},${y2}`;
  const brightness = 0.9 + stableRand(`${seed}-b`) * 0.1;
  ctx.globalAlpha = alpha * (0.82 + stableRand(`${seed}-ga`) * 0.18);
  ctx.strokeStyle = `rgba(190, 255, 210, ${brightness})`;
  ctx.lineWidth = 3.6 + stableRand(`${seed}-lw`) * 0.7;
  ctx.lineCap = 'round';
  const dx = x2 - x1;
  const dy = y2 - y1;
  const imperfect = stableRand(`${seed}-imp`) < 0.18 ? 0.9 : 1;
  const px = x1 + dx * progress * imperfect;
  const py = y1 + dy * progress * imperfect;
  ctx.beginPath();
  ctx.moveTo(x1 + stableJitter(`${seed}-x1`, 1.4), y1 + stableJitter(`${seed}-y1`, 1.4));
  ctx.lineTo(px + stableJitter(`${seed}-px`, 1.4), py + stableJitter(`${seed}-py`, 1.4));
  ctx.stroke();
  ctx.restore();
};

const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, alpha: number, progress: number) => {
  drawChalkLine(ctx, x1, y1, x2, y2, alpha, progress);
  if (progress < 1) return;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 12;
  const hx1 = x2 - head * Math.cos(angle - Math.PI / 7);
  const hy1 = y2 - head * Math.sin(angle - Math.PI / 7);
  const hx2 = x2 - head * Math.cos(angle + Math.PI / 7);
  const hy2 = y2 - head * Math.sin(angle + Math.PI / 7);
  drawChalkLine(ctx, x2, y2, hx1, hy1, alpha, 1);
  drawChalkLine(ctx, x2, y2, hx2, hy2, alpha, 1);
};

const parseSVGPath = (d: string, offsetX: number, offsetY: number, scale: number): LineSegment[] => {
  const segments: LineSegment[] = [];
  const commands = d.match(/[a-df-z][^a-df-z]*/ig) || [];
  let curX = 0, curY = 0;
  let startX = 0, startY = 0;

  commands.forEach(cmd => {
    const type = cmd[0];
    const args = (cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n)));

    const toRelX = (v: number) => (type === type.toLowerCase() ? curX + v : v);
    const toRelY = (v: number) => (type === type.toLowerCase() ? curY + v : v);


    switch (type.toUpperCase()) {
      case 'M':
        curX = toRelX(args[0]);
        curY = toRelY(args[1]);
        startX = curX;
        startY = curY;
        break;
      case 'L':
        for (let i = 0; i < args.length; i += 2) {
          const nx = toRelX(args[i]);
          const ny = toRelY(args[i + 1]);
          segments.push({
            x1: curX * scale + offsetX, y1: curY * scale + offsetY,
            x2: nx * scale + offsetX, y2: ny * scale + offsetY
          });
          curX = nx; curY = ny;
        }
        break;
      case 'H':
        args.forEach(x => {
          const nx = toRelX(x);
          segments.push({
            x1: curX * scale + offsetX, y1: curY * scale + offsetY,
            x2: nx * scale + offsetX, y2: curY * scale + offsetY
          });
          curX = nx;
        });
        break;
      case 'V':
        args.forEach(y => {
          const ny = toRelY(y);
          segments.push({
            x1: curX * scale + offsetX, y1: curY * scale + offsetY,
            x2: curX * scale + offsetX, y2: ny * scale + offsetY
          });
          curY = ny;
        });
        break;
      case 'Z':
        segments.push({
          x1: curX * scale + offsetX, y1: curY * scale + offsetY,
          x2: startX * scale + offsetX, y2: startY * scale + offsetY
        });
        curX = startX; curY = startY;
        break;
    }
  });
  return segments;
};



const playChalkTap = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 380 + Math.random() * 40;
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // ignore audio errors
  }
};

const spawnChalkDust = (particles: ChalkParticle[], x: number, y: number, count = 14) => {

  for (let i = 0; i < count; i++) {
    particles.push({
      x: jitter(x, 6),
      y: jitter(y, 6),
      vx: (Math.random() - 0.5) * 0.6,
      vy: -0.3 + Math.random() * 0.6,
      life: 24 + Math.random() * 14,
      size: 1 + Math.random() * 1.5,
      alpha: 0.28 + Math.random() * 0.25,
    });
  }
};

const generateChemSegments = async (smiles: string, centerX: number, centerY: number, boxSize = 220): Promise<LineSegment[]> => {
  try {
    const ok = await ensureChemDoodle();
    if (!ok || !window.ChemDoodle) return [];
    const cd = window.ChemDoodle;
    const mol = cd.readSMILES(smiles || 'C');
    if (!mol?.atoms?.length || !mol?.bonds?.length) return [];

    const xs = mol.atoms.map((a: any) => a.x);
    const ys = mol.atoms.map((a: any) => a.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const scale = 0.8 * Math.min(boxSize / spanX, boxSize / spanY);

    const offsetX = centerX - ((minX + maxX) / 2) * scale;
    const offsetY = centerY - ((minY + maxY) / 2) * scale;

    const segments: LineSegment[] = mol.bonds.map((b: any) => ({
      x1: b.a1.x * scale + offsetX,
      y1: b.a1.y * scale + offsetY,
      x2: b.a2.x * scale + offsetX,
      y2: b.a2.y * scale + offsetY,
    }));
    return segments;
  } catch (err) {
    console.warn('ChemDoodle backend failed, fallback to text', err);
    return [];
  }
};

// generateSymbolicSegments removed in favor of AI SVGs



const buildTimelineFromVisual = (visualInput: any, subtitles: string[], segmentIndex: number, baseX: number, baseY: number): BoardEvent[] => {
  let visualArray: any[] = [];
  if (Array.isArray(visualInput)) {
    visualArray = visualInput;
  } else if (typeof visualInput === 'string') {
    try { visualArray = JSON.parse(visualInput); } catch { visualArray = []; }
  }

  const events: BoardEvent[] = visualArray.map((ev, i) => {
    // Type normalization: if it has svgPath but wrong type, fix it
    let type = (ev.type as BoardEventType) || 'text';
    if (ev.svgPath && type === 'structure') type = 'svg';

    return {
      id: `ev-${segmentIndex}-${i}-${type}`,
      type,
      content: ev.content || '',
      smiles: ev.smiles || (ev.type === 'structure' ? ev.content : undefined),
      svgPath: ev.svgPath,
      x: ev.x,
      y: ev.y,
      width: ev.width,
      height: ev.height,
      delay: typeof ev.delay === 'number' ? ev.delay : i * 0.5,
      duration: typeof ev.duration === 'number' ? ev.duration : 1.2,
    };
  });




  // Auto-title if first segment and no title present
  if (segmentIndex === 0 && !events.some(e => e.type === 'title')) {
    events.unshift({
      id: `title-${segmentIndex}`,
      type: 'title',
      content: subtitles[0] || 'Lesson Start',
      x: baseX,
      y: baseY - 60,
      delay: 0.1,
      duration: 1.0,
    });
  }

  return events;
};

const sanitizeSegment = (segment: any): ScriptSegment => {
  const subtitles = Array.isArray(segment.subtitles) ? segment.subtitles : [segment.textToSpeak || ''];
  const textToSpeak = segment.textToSpeak || subtitles.join(' ');

  return {
    ...segment,
    textToSpeak,
    subtitles,
    visualContent: Array.isArray(segment.visualContent) ? segment.visualContent : []
  } as ScriptSegment;
};

export const BlackboardPlayer: React.FC<BlackboardPlayerProps> = ({ topic, subject, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [script, setScript] = useState<ScriptSegment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [boardReady, setBoardReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const noisePatternRef = useRef<CanvasPattern | null>(null);
  const boardEventsRef = useRef<ActiveEvent[]>([]);
  const yCursorRef = useRef<number>(BOARD_LAYOUT.titleY + 40);
  const cameraRef = useRef<{ y: number; targetY: number; }>({ y: 0, targetY: 0 });
  const chalkParticlesRef = useRef<ChalkParticle[]>([]);

  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const playbackSessionRef = useRef(0);

  const readyToPlay = !loading && script.length > 0;

  useEffect(() => {
    // Reset state whenever the lesson topic/subject changes
    playbackSessionRef.current += 1;
    setScript([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    boardEventsRef.current = [];
    chalkParticlesRef.current = [];
    resetBoard();

    generateScript();
    return () => {
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [topic, subject]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth, clientHeight } = canvas;
      canvas.width = clientWidth * dpr;
      canvas.height = clientHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      if (!noisePatternRef.current) noisePatternRef.current = buildNoisePattern(ctx);
      setBoardReady(true);
    };

    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvas);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!boardReady) return;
    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      ctx.save();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0b1510';
      ctx.fillRect(0, 0, w, h);
      if (noisePatternRef.current) {
        ctx.fillStyle = noisePatternRef.current;
        ctx.fillRect(0, 0, w, h);
      }

      // subtle padding grid to keep margins respected
      ctx.save();
      ctx.globalAlpha = BOARD_LAYOUT.gridAlpha;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.setLineDash([8, 14]);
      ctx.beginPath();
      ctx.moveTo(BOARD_LAYOUT.marginX - 20, 0);
      ctx.lineTo(BOARD_LAYOUT.marginX - 20, h);
      ctx.moveTo(w - BOARD_LAYOUT.marginX + 40, 0);
      ctx.lineTo(w - BOARD_LAYOUT.marginX + 40, h);
      ctx.moveTo(BOARD_LAYOUT.marginX - 20, BOARD_LAYOUT.titleY - 20);
      ctx.lineTo(w - BOARD_LAYOUT.marginX + 40, BOARD_LAYOUT.titleY - 20);
      ctx.stroke();
      ctx.restore();

      const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 3, w / 2, h / 2, Math.max(w, h));
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      cameraRef.current.y += (cameraRef.current.targetY - cameraRef.current.y) * 0.08;

      const cameraY = cameraRef.current.y;

      const now = performance.now();
      boardEventsRef.current.forEach(ev => {
        if (ev.sessionId !== playbackSessionRef.current) return;
        if (ev.status === 'pending' && ev.startTime && now >= ev.startTime) {
          ev.status = 'drawing';
        }
        if (ev.status === 'drawing' && ev.startTime) {
          const elapsed = (now - ev.startTime) / 1000;
          const p = Math.min(1, elapsed / ev.duration);
          ev.progress = p;
          if (p >= 1) ev.status = 'done';
        }

        if (ev.status === 'done' && !ev.notifiedComplete) {
          ev.notifiedComplete = true;
          spawnChalkDust(chalkParticlesRef.current, ev.x, ev.y - cameraY, ev.type === 'structure' ? 26 : 14);
          playChalkTap();
        }

        const progress = ev.status === 'done' ? 1 : ev.progress || 0;
        const alpha = ev.status === 'done' ? 0.38 : 0.9;
        const structureAlpha = ev.status === 'done' ? BOARD_LAYOUT.structureOpacity * 0.5 : BOARD_LAYOUT.structureOpacity;
        const y = ev.y - cameraY;

        switch (ev.type) {
          case 'title':
          case 'text':
          case 'label':
            drawChalkText(ctx, ev.content || '', ev.x, y, progress, alpha);

            break;
          case 'bullet':
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(255,255,255,0.86)';
            ctx.beginPath();
            ctx.arc(ev.x - 22, y - 12, 6.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            drawChalkText(ctx, ev.content || '', ev.x, y, progress, alpha);
            break;
          case 'arrow':
            drawArrow(ctx, ev.x, y, ev.x + 140, y - 20, alpha, progress);
            drawChalkText(ctx, ev.content || '', ev.x + 150, y - 10, Math.min(1, progress * 1.4), alpha);
            break;
          case 'structure':
            if (!ev.segments || ev.segments.length === 0) {
              ev.segments = []; // No generic symbols anymore
            }
            if (!ev.segments || ev.segments.length === 0) break;
            const per = progress * (ev.segments.length);
            ctx.save();
            ctx.globalAlpha = structureAlpha;
            ev.segments.forEach((seg, idx) => {
              const local = Math.min(1, Math.max(0, per - idx));
              if (local > 0) drawChalkLine(ctx, seg.x1, seg.y1 - cameraY, seg.x2, seg.y2 - cameraY, 1.0, local);
            });
            ctx.restore();
            break;
          case 'svg':
            if (!ev.segments && ev.svgPath) {
              ev.segments = parseSVGPath(ev.svgPath, ev.x, ev.y - (ev.height || 100) / 2, 1.2);
            }
            if (ev.segments) {
              const sPer = progress * ev.segments.length;
              ctx.save();
              ctx.globalAlpha = structureAlpha;
              ev.segments.forEach((seg, idx) => {
                const local = Math.min(1, Math.max(0, sPer - idx));
                if (local > 0) drawChalkLine(ctx, seg.x1, seg.y1 - cameraY, seg.x2, seg.y2 - cameraY, 1.0, local);
              });
              ctx.restore();
            }
            break;
        }



      });

      // chalk dust simulation
      const dust = chalkParticlesRef.current;
      for (let i = dust.length - 1; i >= 0; i--) {
        const p = dust[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.01;
        p.life -= 1;
        p.alpha *= 0.97;
        if (p.life <= 0 || p.alpha <= 0.02) {
          dust.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };


    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [boardReady]);

  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < script.length && isPlaying) {
      isPlayingRef.current = true;
      playbackSessionRef.current += 1;
      playSegment(script[currentIndex], playbackSessionRef.current, currentIndex);
    } else {
      isPlayingRef.current = false;
      playbackSessionRef.current += 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isPlaying]);

  const getCanvasSize = () => {
    const canvas = canvasRef.current;
    return {
      w: canvas?.clientWidth || 1280,
      h: canvas?.clientHeight || 720,
    };
  };



  const resetBoard = () => {
    boardEventsRef.current = [];
    const { h } = getCanvasSize();
    yCursorRef.current = Math.max(BOARD_LAYOUT.titleY + 60, h * 0.35, BOARD_LAYOUT.safeTop + 40);
    cameraRef.current = { y: 0, targetY: 0 };
  };


  const enqueueBoardEvents = async (segment: ScriptSegment, segmentIndex: number, sessionId: number) => {
    const { w } = getCanvasSize();
    const baseX = Math.max(BOARD_LAYOUT.marginX + 20, w * 0.26);
    const maxX = Math.max(BOARD_LAYOUT.marginX, w - BOARD_LAYOUT.marginX - 80);
    let currentY = yCursorRef.current + 40; // Base offset to clear title
    const timeline = buildTimelineFromVisual(segment.visualContent, segment.subtitles, segmentIndex, baseX, currentY);

    const laidOut = timeline.map((ev) => {
      const isVisual = ev.type === 'structure' || ev.type === 'svg';
      // Shift text to the left, visuals to the right
      const x = isVisual ? Math.max(w * 0.6, maxX - (ev.width || 200)) : baseX;

      // Auto-arrange Y to prevent overlap
      const y = Math.max(BOARD_LAYOUT.safeTop + 80, currentY, BOARD_LAYOUT.titleY + 60);

      const itemHeight = isVisual ? (ev.height || 220) : (ev.type === 'bullet' ? BOARD_LAYOUT.bulletGap : BOARD_LAYOUT.lineStep);
      currentY = y + itemHeight + 20;

      return { ...ev, x, y };
    });


    for (const ev of laidOut) {
      const active: ActiveEvent = {
        ...ev,
        status: 'pending',
        startTime: performance.now() + ev.delay * 1000,
        progress: 0,
        sessionId,
      };

      if (ev.type === 'structure') {
        const chemSegments = await generateChemSegments(ev.smiles || 'C', ev.x, ev.y, 240);
        active.segments = chemSegments.length ? chemSegments : [];
      }


      boardEventsRef.current.push(active);
      const padding = ev.type === 'structure' ? 240 : (ev.type === 'title' ? 100 : 80);

      yCursorRef.current = Math.max(yCursorRef.current, ev.y + padding);
      if (yCursorRef.current - cameraRef.current.targetY > (canvasRef.current?.clientHeight || 800) - 260) {
        cameraRef.current.targetY = yCursorRef.current - ((canvasRef.current?.clientHeight || 800) * 0.6);
      }
    }
  };


  const extractJsonCandidate = (response: string) => {
    const fenced = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) return fenced[1];

    const start = response.search(/[\[{]/);
    if (start === -1) return null;
    const stack: string[] = [];
    for (let i = start; i < response.length; i++) {
      const ch = response[i];
      if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') {
        const last = stack.pop();
        if (!last) return null;
        if ((last === '{' && ch !== '}') || (last === '[' && ch !== ']')) return null;
        if (stack.length === 0) return response.slice(start, i + 1);
      }
    }
    return null;
  };

  const generateScript = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: saved } = await supabase
          .from('saved_videos')
          .select('script')
          .eq('user_id', user.id)
          .eq('topic', topic)
          .eq('subject', subject)
          .maybeSingle();

        if (saved && saved.script) {
          const casted = saved as { script: ScriptSegment[] };
          const backfilled = casted.script.map((s: any) => sanitizeSegment({
            ...s,
            subtitles: Array.isArray(s.subtitles) && s.subtitles.length > 0 ? s.subtitles : [s.textToSpeak || '']
          }));
          setScript(backfilled);
          setLoading(false);
          setCurrentIndex(-1);
          setIsPlaying(false);
          return;
        }
      }

      const prompt = `You are a world-class educational content creator and chalkboard lecturer. 
Build 6-10 highly engaging and visually rich segments for the topic "${topic}" (subject: "${subject}").

Each segment MUST follow this strict JSON schema:
{
  "subtitles": ["Sentence 1...", "Sentence 2...", "Sentence 3..."],
  "textToSpeak": "Direct teacherly narration combining the subtitles...",
  "visualContent": [
    {
      "type": "title" | "text" | "bullet" | "label" | "arrow" | "structure",
      "content": "Text to display or SMILES string for structure",
      "delay": relative_seconds_from_segment_start,
      "duration": drawing_seconds,
      "x": optional_fixed_x,
      "y": optional_fixed_y
    }
  ]
}

Rules:
1. "visualContent" MUST be a JSON array of events.
2. MANDATORY: Every segment MUST include a "type": "svg" event with a detailed "svgPath".
3. "svgPath" should be a valid SVG path data string (M, L, H, V, Z commands).
4. DRAW MEANINGFULLY: If the topic is "The Heart", draw a heart primitive. If it's "Gravity", draw a falling object and an arrow.
5. NEVER use "type": "structure" unless you are providing a SMILES string for a chemical molecule.
6. For all other diagrams, ALWAYS use "type": "svg".
7. Layout: Visuals appear on the right, text on the left. Leave plenty of vertical space.`;






      const response = await OpenAIService.getInstance().generateChatCompletion(prompt, 'Return ONLY a JSON object with a "segments" array. No preamble.');
      const jsonCandidate = extractJsonCandidate(response);
      if (!jsonCandidate) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonCandidate);
      if (parsed.segments) {
        console.log('--- Whiteboard Generation Success ---');
        const computed = parsed.segments.map((s: any) => {
          const sanitized = sanitizeSegment(s);
          // Defensive parsing for visualContent
          let vArray: any[] = [];
          if (Array.isArray(s.visualContent)) vArray = s.visualContent;
          else if (typeof s.visualContent === 'string') {
            try { vArray = JSON.parse(s.visualContent); } catch { vArray = []; }
          }

          return {
            ...sanitized,
            visualContent: vArray
          };
        });
        console.log('Active Script Preview:', computed.map((c: any) => ({ id: c.id, visuals: c.visualContent.length })));
        setScript(computed);
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          await supabase.from('saved_videos').upsert({
            user_id: u.id,
            topic,
            subject,
            script: computed
          }, { onConflict: 'user_id,topic,subject' });
        }
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const playSegment = async (segment: ScriptSegment, sessionId: number, segmentIndex: number) => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // schedule board events
    await enqueueBoardEvents(segment, segmentIndex, sessionId);

    const subtitlesToPlay = Array.isArray(segment.subtitles) && segment.subtitles.length > 0 ? segment.subtitles : [segment.textToSpeak || ''];

    const speakFallback = async (text: string) => {
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92;
        utterance.pitch = 1.02;
        utterance.onend = () => resolve();
        speechRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      });
    };


    for (let i = 0; i < subtitlesToPlay.length; i++) {
      if (playbackSessionRef.current !== sessionId || !isPlayingRef.current) return;
      const line = subtitlesToPlay[i];

      try {
        const audioBuffer = await OpenAIService.getInstance().generateSpeech(line);
        if (!(audioBuffer instanceof ArrayBuffer) || audioBuffer.byteLength === 0) throw new Error('Empty audio');
        if (playbackSessionRef.current !== sessionId || !isPlayingRef.current) return;
        const url = URL.createObjectURL(new Blob([audioBuffer], { type: 'audio/mpeg' }));
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(url);
          audioRef.current = audio;
          const cleanup = () => { URL.revokeObjectURL(url); audioRef.current = null; };
          audio.onended = () => { cleanup(); resolve(); };
          audio.onerror = (e) => { cleanup(); reject(e); };
          audio.play().catch(err => { cleanup(); reject(err); });
        });
      } catch (e) {
        console.warn('Audio playback failed, fallback to browser voice:', e);
        if (playbackSessionRef.current !== sessionId || !isPlayingRef.current) return;
        await speakFallback(line);
      }
    }

    if (playbackSessionRef.current === sessionId && isPlayingRef.current) {
      nextSegment();
    }
  };

  const nextSegment = () => {
    if (currentIndex < script.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const handleClose = () => {
    playbackSessionRef.current += 1;
    isPlayingRef.current = false;
    setIsPlaying(false);
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    onClose();
  };

  const startLesson = () => {
    if (!readyToPlay) return;
    resetBoard();
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95">
      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />

        {/* Faint dust overlay for realism */}
        <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen" aria-hidden="true">
          <div className="absolute left-[20%] top-[10%] w-1 h-1 bg-white rounded-full animate-pulse"></div>
          <div className="absolute left-[70%] top-[30%] w-1 h-1 bg-white rounded-full animate-ping"></div>
          <div className="absolute left-[40%] top-[70%] w-1 h-1 bg-white rounded-full animate-pulse"></div>
        </div>

        {/* Minimal controls kept off the board edges before play */}
        {!isPlaying && (
          <div className="absolute top-4 right-4 flex items-center gap-3 text-white/70">
            <button onClick={handleClose} className="p-2 hover:text-white" title="Close">
              <X className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Start overlay */}
        {!isPlaying && currentIndex === -1 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white space-y-6">
            {loading ? (
              <>
                <div className="animate-spin h-12 w-12 border-2 border-white/30 border-t-white rounded-full" />
                <p className="text-lg text-white/70">Preparing the blackboard and narration...</p>
              </>
            ) : (
              <>
                <button
                  onClick={startLesson}
                  className="px-10 py-5 rounded-full bg-[#39ff14]/20 border border-[#39ff14]/60 text-2xl font-semibold hover:bg-[#39ff14]/30 transition shadow-[0_0_30px_rgba(57,255,20,0.25)]"
                >
                  <Play className="inline w-7 h-7 mr-3" /> Start Lesson
                </button>
                <p className="text-white/60 max-w-2xl">Voice leads. The chalk follows on a single canvas with ChemDoodle coordinates and chalk animations.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
