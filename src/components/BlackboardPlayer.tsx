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

type BoardEventType = 'title' | 'text' | 'bullet' | 'label' | 'arrow' | 'structure';

interface BoardEvent {
  id: string;
  type: BoardEventType;
  content?: string;
  smiles?: string;
  delay: number; // seconds from segment start
  duration: number; // seconds to draw
  x: number;
  y: number;
}

interface ActiveEvent extends BoardEvent {
  status: 'pending' | 'drawing' | 'done';
  startTime?: number;
  segments?: LineSegment[]; // for structures
  progress?: number;
  sessionId: number;
}

interface LineSegment {
  x1: number; y1: number; x2: number; y2: number;
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

const normalizeText = (value: string) => (value || '').replace(/\s+/g, ' ').trim();

const extractSmilesCandidate = (raw: string) => {
  const text = normalizeText(raw);
  if (!text) return 'C';
  const hinted = text.match(/smiles[:\s]+([A-Za-z0-9@+\-\[\]\(\)=#\\/]+)/i);
  if (hinted?.[1]) return hinted[1];
  const cleaned = text.replace(/[^A-Za-z0-9@+\-\[\]\(\)=#\\/]/g, '');
  return cleaned || 'C';
};

const splitCues = (value: string) => normalizeText(value).split(/\n|;|\||,/).map(v => v.trim()).filter(Boolean);

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

const drawChalkText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, progress: number, alpha: number) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(220, 255, 214, 0.95)';
  ctx.shadowColor = 'rgba(57, 255, 20, 0.18)';
  ctx.shadowBlur = 6;
  ctx.font = '34px "Kalam", "Comic Sans MS", cursive';
  const len = Math.max(1, Math.floor(text.length * progress));
  const partial = text.slice(0, len);
  partial.split('').forEach((ch, idx) => {
    const dx = x + jitter(idx * 18, 1.5);
    const dy = jitter(y, 1.5);
    ctx.fillText(ch, dx, dy);
  });
  ctx.restore();
};

const drawChalkLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, alpha: number, progress = 1) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(140, 255, 186, 0.9)';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  const dx = x2 - x1;
  const dy = y2 - y1;
  const px = x1 + dx * progress;
  const py = y1 + dy * progress;
  ctx.beginPath();
  ctx.moveTo(jitter(x1, 1.2), jitter(y1, 1.2));
  ctx.lineTo(jitter(px, 1.2), jitter(py, 1.2));
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

const buildTimelineFromVisual = (visualContent: string, subtitles: string[], segmentIndex: number, baseX: number, baseY: number): BoardEvent[] => {
  const events: BoardEvent[] = [];
  let cursorY = baseY;

  // Try parsing explicit JSON timeline
  try {
    const parsed = JSON.parse(visualContent);
    const arr = Array.isArray(parsed) ? parsed : parsed?.events;
    if (Array.isArray(arr)) {
      return arr.map((ev, i) => ({
        id: `json-${segmentIndex}-${i}-${ev.type}`,
        type: (ev.type as BoardEventType) || 'text',
        content: ev.content || ev.text || '',
        smiles: ev.smiles,
        x: ev.x ?? baseX,
        y: ev.y ?? (baseY + i * 90),
        delay: typeof ev.delay === 'number' ? ev.delay : i * 0.6,
        duration: 0.9,
      }));
    }
  } catch {}

  const cues = splitCues(visualContent);
  const smiles = extractSmilesCandidate(visualContent);

  if (segmentIndex === 0) {
    events.push({
      id: `title-${segmentIndex}`,
      type: 'title',
      content: subtitles[0] || visualContent || 'Lesson',
      x: baseX,
      y: cursorY,
      delay: 0,
      duration: 1.2,
    });
    cursorY += 90;
  }

  // If there is an arrow description
  const arrowCue = cues.find(c => c.includes('->') || c.includes('=>'));
  cues.forEach((cue, idx) => {
    const isArrow = cue.includes('->') || cue.includes('=>') || cue.toLowerCase().startsWith('arrow');
    const isLabel = cue.toLowerCase().startsWith('label');
    const type: BoardEventType = isArrow ? 'arrow' : isLabel ? 'label' : 'bullet';
    events.push({
      id: `cue-${segmentIndex}-${idx}`,
      type,
      content: cue.replace(/label[:\s]*/i, ''),
      x: baseX,
      y: cursorY,
      delay: 0.4 + idx * 0.6,
      duration: 0.8,
    });
    cursorY += 70;
  });

  // Structure event lives below cues
  events.push({
    id: `structure-${segmentIndex}`,
    type: 'structure',
    smiles,
    content: smiles,
    x: baseX + 260,
    y: cursorY + 40,
    delay: arrowCue ? 0.5 : 1.0,
    duration: 1.6,
  });
  cursorY += 160;

  // Label subtitles as final chalk notes
  subtitles.slice(0, 2).forEach((line, idx) => {
    events.push({
      id: `sub-${segmentIndex}-${idx}`,
      type: 'label',
      content: line,
      x: baseX,
      y: cursorY,
      delay: 0.6 + idx * 0.8,
      duration: 0.9,
    });
    cursorY += 60;
  });

  return events;
};

const sanitizeText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const sanitizeSegment = (segment: any): ScriptSegment => {
  const rawSubtitles = Array.isArray(segment.subtitles) ? segment.subtitles : [];
  const cleanSubtitles = rawSubtitles.map((s: string) => sanitizeText(s)).filter(Boolean);
  const cleanText = sanitizeText(segment.textToSpeak || cleanSubtitles.join(' '));

  return {
    ...segment,
    textToSpeak: cleanText,
    subtitles: cleanSubtitles.length ? cleanSubtitles : [cleanText || ''],
    visualContent: sanitizeText(segment.visualContent || cleanText)
  };
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
  const yCursorRef = useRef<number>(140);
  const cameraRef = useRef<{ y: number; targetY: number; } >({ y: 0, targetY: 0 });

  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const playbackSessionRef = useRef(0);

  const readyToPlay = !loading && script.length > 0;

  useEffect(() => {
    generateScript();
    return () => {
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        const progress = ev.status === 'done' ? 1 : ev.progress || 0;
        const alpha = ev.status === 'done' ? 0.38 : 0.9;
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
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.arc(ev.x - 22, y - 12, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            drawChalkText(ctx, ev.content || '', ev.x, y, progress, alpha);
            break;
          case 'arrow':
            drawArrow(ctx, ev.x, y, ev.x + 140, y - 20, alpha, progress);
            drawChalkText(ctx, ev.content || '', ev.x + 150, y - 10, Math.min(1, progress * 1.4), alpha);
            break;
          case 'structure':
            if (!ev.segments || ev.segments.length === 0) break;
            const per = progress * (ev.segments.length);
            ev.segments.forEach((seg, idx) => {
              const local = Math.min(1, Math.max(0, per - idx));
              if (local > 0) drawChalkLine(ctx, seg.x1, seg.y1 - cameraY, seg.x2, seg.y2 - cameraY, alpha, local);
            });
            break;
        }
      });
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

  const resetBoard = () => {
    boardEventsRef.current = [];
    yCursorRef.current = 140;
    cameraRef.current = { y: 0, targetY: 0 };
  };

  const enqueueBoardEvents = async (segment: ScriptSegment, segmentIndex: number, sessionId: number) => {
    const baseX = 80;
    const baseY = yCursorRef.current;
    const timeline = buildTimelineFromVisual(segment.visualContent, segment.subtitles, segmentIndex, baseX, baseY);

    for (const ev of timeline) {
      const active: ActiveEvent = {
        ...ev,
        status: 'pending',
        startTime: performance.now() + ev.delay * 1000,
        progress: 0,
        sessionId,
      };

      if (ev.type === 'structure') {
        active.segments = await generateChemSegments(ev.smiles || extractSmilesCandidate(segment.visualContent), ev.x, ev.y, 240);
      }

      boardEventsRef.current.push(active);
      yCursorRef.current = Math.max(yCursorRef.current, ev.y + 120);
      if (yCursorRef.current - cameraRef.current.targetY > (canvasRef.current?.clientHeight || 800) - 260) {
        cameraRef.current.targetY = yCursorRef.current - ((canvasRef.current?.clientHeight || 800) * 0.6);
      }
    }
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

      const prompt = `You are a chalkboard lecturer. Build 6-10 segments for topic "${topic}" (subject: "${subject}").
Each segment needs:
- subtitles: array of 2-4 short sentences (voice-first).
- textToSpeak: combined narration (concise).
- visualContent: a short, plaintext set of cues for a chalkboard, optionally JSON timeline array of events with x,y,delay fields. Allowed types: text, bullet, label, arrow, structure with SMILES.
Rules: NO HTML, NO SVG, plaintext or JSON only.`;

      const response = await OpenAIService.getInstance().generateChatCompletion(prompt, 'Return JSON only for the lesson plan.');
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.segments) {
        const computed = parsed.segments.map((s: any) => sanitizeSegment({
          ...s,
          textToSpeak: s.textToSpeak || (Array.isArray(s.subtitles) ? s.subtitles.join(' ') : s.textToSpeak),
          subtitles: Array.isArray(s.subtitles) ? s.subtitles : [s.textToSpeak || '']
        }));
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
        utterance.rate = 1.0;
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
