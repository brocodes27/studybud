import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Play, RotateCcw, Maximize, Minimize } from 'lucide-react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '../lib/supabase';
import { OpenAIService } from '../lib/openaiService';

declare global {
    interface Window {
        ChemDoodle?: any;
    }
}

interface BlackboardPlayerProps {
    topic: string;
    subject: string;
    onClose: () => void;
}

interface ScriptSegment {
    id: number;
    textToSpeak: string;
    subtitles: string[]; // Added for sentence-level sync
    visualContent: string;
}

interface SavedVideoRecord {
    script: ScriptSegment[];
}

interface VisualRendererProps {
    subject: string;
    visualContent: string;
    segmentId: number;
}

type RenderingOverlay = 'grid' | 'chem' | 'bio' | 'none';

type RenderingProfile = {
    method: string;
    guidance: string;
    overlay: RenderingOverlay;
};

const chemDoodleScriptSrc = 'https://web.chemdoodle.com/assets/standalone/ChemDoodleWeb.js';
const chemDoodleCssHref = 'https://web.chemdoodle.com/assets/standalone/ChemDoodleWeb.css';

const ensureChemDoodle = (): Promise<void> => {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.ChemDoodle) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${chemDoodleScriptSrc}"]`);
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('ChemDoodle failed to load')), { once: true });
        } else {
            if (!document.querySelector(`link[href="${chemDoodleCssHref}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = chemDoodleCssHref;
                document.head.appendChild(link);
            }

            const script = document.createElement('script');
            script.src = chemDoodleScriptSrc;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('ChemDoodle failed to load'));
            document.head.appendChild(script);
        }
    });
};

const normalizeVisualText = (value: string) => (value || '').replace(/\s+/g, ' ').trim();

const extractSmilesCandidate = (raw: string) => {
    const text = normalizeVisualText(raw);
    if (!text) return 'C';
    const hinted = text.match(/smiles[:\s]+([A-Za-z0-9@+\-\[\]\(\)=#\\/]+)/i);
    if (hinted?.[1]) return hinted[1];
    const cleaned = text.replace(/[^A-Za-z0-9@+\-\[\]\(\)=#\\/]/g, '');
    return cleaned || 'C';
};

const buildMathData = (text: string) => {
    const phrase = text.toLowerCase();
    const fn = (x: number) => {
        if (phrase.includes('sin')) return Math.sin(x);
        if (phrase.includes('cos')) return Math.cos(x);
        if (phrase.includes('exp')) return Math.exp(Math.min(2, x * 0.4)) * 0.1;
        if (phrase.includes('log')) return Math.log(Math.abs(x) + 1);
        if (phrase.includes('parabola') || phrase.includes('x^2') || phrase.includes('square')) return 0.15 * (x * x);
        return 0.6 * x;
    };
    return Array.from({ length: 64 }).map((_, i) => {
        const x = (i - 32) / 4;
        return { x, y: parseFloat(fn(x).toFixed(2)) };
    });
};

const splitCues = (value: string) => normalizeVisualText(value).split(/\n|;|\||,/).map(v => v.trim()).filter(Boolean);

const VisualRenderer: React.FC<VisualRendererProps> = ({ subject, visualContent, segmentId }) => {
    const lowered = (subject || '').toLowerCase();
    const isChem = lowered.includes('chem');
    const isPhysics = lowered.includes('phys');
    const isMath = lowered.includes('math') || lowered.includes('calc') || lowered.includes('algebra');
    const isBio = lowered.includes('bio');
    const isAnim = lowered.includes('anim');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [chemStatus, setChemStatus] = useState<'idle' | 'ready' | 'error'>('idle');

    useEffect(() => {
        if (!isChem) return;
        let cancelled = false;
        const run = async () => {
            try {
                await ensureChemDoodle();
                if (cancelled) return;
                if (!window.ChemDoodle || !canvasRef.current) { setChemStatus('error'); return; }

                const canvasId = `chem-canvas-${segmentId}`;
                canvasRef.current.id = canvasId;
                canvasRef.current.width = 720;
                canvasRef.current.height = 320;

                try {
                    const cd = window.ChemDoodle;
                    const viewer = new cd.ViewerCanvas(canvasId, canvasRef.current.width, canvasRef.current.height);
                    viewer.styles.backgroundColor = '#0f1b14';
                    viewer.styles.atoms_useJMOLColors = true;
                    viewer.styles.atoms_font_size_2D = 14;
                    viewer.styles.bonds_width_2D = 2.2;
                    viewer.styles.scale = 1.1;

                    const smiles = extractSmilesCandidate(visualContent);
                    const molecule = cd.readSMILES(smiles);
                    viewer.loadMolecule(molecule);
                    viewer.repaint();
                    setChemStatus('ready');
                } catch (err) {
                    console.warn('ChemDoodle render failed, falling back to text', err);
                    setChemStatus('error');
                    const ctx = canvasRef.current.getContext('2d');
                    if (ctx) {
                        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                        ctx.fillStyle = '#c7f9cc';
                        ctx.font = '18px "Kalam", "Comic Sans MS", sans-serif';
                        ctx.fillText(normalizeVisualText(visualContent) || 'Chemistry sketch', 12, 36);
                    }
                }
            } catch (error) {
                console.error('ChemDoodle load error', error);
                if (!cancelled) setChemStatus('error');
            }
        };
        run();
        return () => { cancelled = true; };
    }, [isChem, visualContent, segmentId]);

    useEffect(() => {
        if (!isPhysics || !canvasRef.current) return;
        let disposed = false;
        const canvas = canvasRef.current;
        const width = 720;
        const height = 320;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);

        import('roughjs/bundled/rough.esm.js').then(mod => {
            if (disposed || !canvasRef.current) return;
            const rough = (mod as any).default || (mod as any);
            const rc = rough.canvas(canvasRef.current);
            rc.linearPath([[60, 40], [60, height - 40]], { stroke: '#39ff14', strokeWidth: 2, bowing: 0.6 });
            rc.linearPath([[60, height - 40], [width - 40, height - 40]], { stroke: '#39ff14', strokeWidth: 2, bowing: 0.6 });

            const cues = splitCues(visualContent);
            cues.slice(0, 4).forEach((cue, idx) => {
                const y = 80 + idx * 60;
                const endX = 220 + idx * 80;
                const endY = y - 20;
                rc.line(120, y, endX, endY, { stroke: '#00f3ff', strokeWidth: 2, roughness: 1.5 });
                rc.circle(120, y, 14, { stroke: '#f97316', strokeWidth: 2 });
                ctx.fillStyle = '#00f3ff';
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - 12, endY - 6);
                ctx.lineTo(endX - 12, endY + 6);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.font = '16px "Kalam", "Comic Sans MS", sans-serif';
                ctx.fillText(cue, endX + 20, endY - 2);
            });
        });
        return () => { disposed = true; };
    }, [isPhysics, visualContent, segmentId]);

    const mathData = useMemo(() => buildMathData(visualContent), [visualContent]);
    const cueLines = splitCues(visualContent);

    if (isChem || isPhysics) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-inner">
                <div className="text-xs uppercase tracking-[0.2em] text-neon-green mb-2 font-mono">{isChem ? 'ChemDoodle Sketch' : 'Physics Sketch'}</div>
                <canvas ref={canvasRef} className="w-full h-[220px] bg-black/40 rounded-xl border border-white/5" />
                {chemStatus === 'error' && isChem && (
                    <p className="text-xs text-amber-300 mt-2">ChemDoodle fallback showing raw cue: {normalizeVisualText(visualContent)}</p>
                )}
                {isPhysics && cueLines.length > 0 && (
                    <p className="text-xs text-gray-300 mt-2">{cueLines.join(' · ')}</p>
                )}
            </div>
        );
    }

    if (isMath) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-inner">
                <div className="text-xs uppercase tracking-[0.2em] text-neon-blue mb-2 font-mono">Math Plot</div>
                <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={mathData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff22" />
                            <XAxis dataKey="x" stroke="#a5f3fc" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#a5f3fc" tick={{ fontSize: 10 }} />
                            <Tooltip wrapperStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                            <Line type="monotone" dataKey="y" stroke="#22d3ee" dot={false} strokeWidth={3} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                {cueLines.length > 0 && (
                    <p className="text-xs text-gray-300 mt-2">{cueLines.join(' · ')}</p>
                )}
            </div>
        );
    }

    if (isBio) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-inner">
                <div className="text-xs uppercase tracking-[0.2em] text-neon-green mb-2 font-mono">Biology Layers</div>
                <div className="relative w-full h-[220px] bg-emerald-950/50 rounded-xl border border-emerald-500/20 overflow-hidden">
                    <svg className="absolute inset-0" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet">
                        <rect x="30" y="30" width="340" height="60" rx="20" className="fill-emerald-600/40 stroke-emerald-300/60" />
                        <rect x="50" y="110" width="300" height="50" rx="18" className="fill-emerald-400/30 stroke-emerald-200/60" />
                        <rect x="70" y="170" width="260" height="30" rx="14" className="fill-emerald-200/20 stroke-emerald-100/50" />
                        {cueLines.slice(0, 3).map((cue, idx) => (
                            <text key={cue} x={60 + idx * 20} y={70 + idx * 60} className="fill-white/80 text-[12px] font-semibold">{cue}</text>
                        ))}
                    </svg>
                    {cueLines.length > 3 && (
                        <div className="absolute bottom-3 right-3 text-xs text-emerald-100/80">{cueLines.slice(3).join(' · ')}</div>
                    )}
                </div>
            </div>
        );
    }

    if (isAnim) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-inner">
                <div className="text-xs uppercase tracking-[0.2em] text-neon-blue mb-2 font-mono">Stroke Steps</div>
                <div className="space-y-2">
                    {cueLines.map((cue, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            <div className="w-8 h-1 bg-neon-green animate-pulse" style={{ animationDelay: `${idx * 120}ms` }} />
                            <p className="text-sm text-gray-200">{cue}</p>
                        </div>
                    ))}
                    {cueLines.length === 0 && (
                        <p className="text-sm text-gray-300">{normalizeVisualText(visualContent) || 'Progressive reveal'}</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-inner">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-300 mb-2 font-mono">Chalk Notes</div>
            <p className="text-sm text-gray-200">{normalizeVisualText(visualContent) || 'Visual cue unavailable'}</p>
        </div>
    );
};

export const BlackboardPlayer: React.FC<BlackboardPlayerProps> = ({ topic, subject, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [script, setScript] = useState<ScriptSegment[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [displayedText, setDisplayedText] = useState('');

    const [currentSubtitleText, setCurrentSubtitleText] = useState('');

    const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const isPlayingRef = useRef(false);
    const playbackSessionRef = useRef(0); // Unique ID for current playback session

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

    const getRenderingProfile = (subj: string): RenderingProfile => {
        const s = subj?.toLowerCase() || '';
        if (s.includes('chem')) return { method: 'ChemDoodle / RDKit', guidance: 'Treat bonds, atoms, and arrows as text cues (e.g., "C6H6", "arrow: ->", "label: catalyst") with clear stoichiometry.', overlay: 'chem' };
        if (s.includes('phys')) return { method: 'Coordinate-based Canvas', guidance: 'Reference x/y axes, vectors, angles, units, and positions in words (e.g., "arrow: F→", "x=0 origin", "θ = 30°").', overlay: 'grid' };
        if (s.includes('math') || s.includes('calc') || s.includes('algebra')) return { method: 'Function plotting', guidance: 'Describe axes, curves, critical points, roots, slopes, and areas in text (e.g., "y = sin x", "mark: x=π/2 peak", "shade: area under curve").', overlay: 'grid' };
        if (s.includes('bio')) return { method: 'SVG layers', guidance: 'Layer anatomy in text (e.g., "outer layer: epidermis", "middle: xylem", "arrow: nutrient flow"), each layer on a separate line.', overlay: 'bio' };
        if (s.includes('anim')) return { method: 'Stroke reveal', guidance: 'List drawing steps as text (e.g., "step1: outline", "step2: fill", "step3: highlights") to cue stroke-by-stroke reveals.', overlay: 'none' };
        return { method: 'Chalk cues', guidance: 'Keep concise chalk text and directional arrows described in words only.', overlay: 'none' };
    };

    const getBoardOverlayStyle = (overlay: RenderingOverlay) => {
        if (overlay === 'grid') {
            return {
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: '80px 80px',
                opacity: 0.18,
                mixBlendMode: 'screen'
            };
        }
        if (overlay === 'chem') {
            return {
                backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(34,197,94,0.08), transparent 35%), radial-gradient(circle at 70% 70%, rgba(249,115,22,0.08), transparent 35%)',
                opacity: 0.25,
                mixBlendMode: 'screen'
            };
        }
        if (overlay === 'bio') {
            return {
                backgroundImage: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(34,197,94,0.05) 25%, transparent 25%, transparent 50%, rgba(16,185,129,0.12) 50%, rgba(34,197,94,0.05) 75%, transparent 75%, transparent)',
                backgroundSize: '90px 90px',
                opacity: 0.18,
                mixBlendMode: 'screen'
            };
        }
        return {};
    };

    const renderingProfile = getRenderingProfile(subject);
    const boardOverlayStyle = getBoardOverlayStyle(renderingProfile.overlay);

    const readyToPlay = !loading && script.length > 0;

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = async () => {
        if (!document.fullscreenElement) {
            await containerRef.current?.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    };

    const handleClose = () => {
        // 1. Stop Async Loops
        playbackSessionRef.current += 1;
        isPlayingRef.current = false;
        setIsPlaying(false);

        // 2. Stop Browser TTS
        window.speechSynthesis.cancel();

        // 3. Stop OpenAI Audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
        }

        // 4. Notify Parent
        onClose();
    };

    useEffect(() => {
        generateScript();

        return () => {
            window.speechSynthesis.cancel();
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // Auto-scroll logic
    useEffect(() => {
        if (currentIndex >= 0) {
            const currentSegment = document.getElementById(`segment-${currentIndex}`);
            if (currentSegment) {
                currentSegment.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentIndex]);

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
                    const casted = saved as SavedVideoRecord;
                    // Backfill subtitles for legacy cached videos
                    const backfilledScript = casted.script.map((s: any) => sanitizeSegment({
                        ...s,
                        subtitles: Array.isArray(s.subtitles) && s.subtitles.length > 0
                            ? s.subtitles
                            : [s.textToSpeak || '']
                    }));
                    setScript(backfilledScript);
                    setLoading(false);
                    setCurrentIndex(-1);
                    setIsPlaying(false);
                    return;
                }
            }

            const getSubjectVisualPrompt = (subject: string): string => {
                const s = subject?.toLowerCase() || '';

                const base = [
                    "Generate vivid, concise chalkboard cues in neon style (plain text only, no SVG/HTML).",
                    "Overall look: cinematic blackboard shot with colored chalk lines.",
                    "Use short, descriptive phrases and arrows described in words (no markup).",
                    "Colors: mainly neon chalk tones (#00f3ff, #ff00ff, #39ff14, #facc15, #f97316) on a dark background.",
                    "Keep notes compact (one line per cue) so they fit on a blackboard.",
                    "No markup, no SVG, no HTML. Plain text only.",
                    `Rendering method: ${renderingProfile.method}. ${renderingProfile.guidance}`
                ].join(" ");

                if (s.includes('phys')) {
                    return `${base} THEME: physics chalkboard. Describe objects, forces and motion with short text cues (e.g., "block on incline", "arrow: gravity down").`;
                }

                if (s.includes('chem')) {
                    return `${base} THEME: chemistry lab chalkboard. Use textual cues like molecules or reaction steps (e.g., "H2 + O2 -> H2O", "label: combustion").`;
                }

                if (s.includes('bio')) {
                    return `${base} THEME: biology lecture. Describe flows and parts in words (e.g., "cell membrane", "arrow: nutrients in", "arrow: waste out").`;
                }

                if (s.includes('math') || s.includes('calc') || s.includes('algebra')) {
                    return `${base} THEME: math blackboard. Describe the main objects in text (e.g., "graph of y = sin(x)", "arrow: shift right", "area under curve").`;
                }

                if (s.includes('anim')) {
                    return `${base} THEME: animation / stroke reveal. Write sequential stroke cues (e.g., "step1: outline", "step2: fill", "step3: highlights") to drive stroke-by-stroke reveals.`;
                }

                if (s.includes('history') || s.includes('literature')) {
                    return [
                        "Generate an expressive symbolic chalkboard cue for history / literature (text only).",
                        "Use short labels or timeline steps (e.g., 'Renaissance -> Industrial Age').",
                        "No markup, icons described in words only."
                    ].join(" ");
                }

                return `${base} THEME: general education. Give concise concept + 2–3 supporting text cues; arrows described in words.`;
            };

            const visualPrompt = getSubjectVisualPrompt(subject);

            const prompt = `You are an expert blackboard teacher creating a narrated lesson for: "${topic}" (Subject: "${subject}").

REQUIREMENTS:
- Break the lesson into 6–10 coherent segments.
- Each segment must provide rich narration in textToSpeak and matching subtitles (array of sentences).
- visualContent must be a short chalkboard-friendly text cue ONLY (plain text, no SVG/HTML/markup). Use this subject tone: "${visualPrompt}".
- Do NOT return any <svg> tags or markup. JSON only.

JSON STRUCTURE TO RETURN (NO MARKDOWN, NO BACKTICKS):
{
  "segments": [
    {
      "id": 1,
      "subtitles": ["Sentence 1.", "Sentence 2."],
      "textToSpeak": "Full narration for this segment",
      "visualContent": "Short chalkboard note (plain text only)"
    }
  ]
}`;

            const response = await OpenAIService.getInstance().generateChatCompletion(prompt, "You are an expert visual teacher. Output valid JSON only.");

            // Extract JSON from potential markdown
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error("Invalid AI Response:", response);
                throw new Error("No JSON found in response");
            }

            const parsed = JSON.parse(jsonMatch[0]);

            if (parsed.segments) {
                // Ensure textToSpeak exists for backward compat and subtitles is array
                const computedSegments = parsed.segments.map((s: any) => sanitizeSegment({
                    ...s,
                    textToSpeak: s.textToSpeak || (Array.isArray(s.subtitles) ? s.subtitles.join(' ') : s.textToSpeak),
                    subtitles: Array.isArray(s.subtitles) ? s.subtitles : [s.textToSpeak || '']
                }));
                setScript(computedSegments);

                // Save to DB
                if (user) {
                    await supabase.from('saved_videos').upsert({
                        user_id: user.id,
                        topic,
                        subject,
                        script: computedSegments
                    }, { onConflict: 'user_id,topic,subject' });
                }

                setLoading(false);
                // Wait for user interaction to start to avoid autoplay blocks
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentIndex >= 0 && currentIndex < script.length && isPlaying) {
            isPlayingRef.current = true;
            playbackSessionRef.current += 1; // Start new session
            playSegment(script[currentIndex], playbackSessionRef.current);
        } else {
            isPlayingRef.current = false;
            playbackSessionRef.current += 1; // Invalidate any running session
        }
    }, [currentIndex, isPlaying]);

    const playSegment = async (segment: ScriptSegment, sessionId: number) => {
        // cleanup previous
        window.speechSynthesis.cancel();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        const startVisuals = () => {
            const fallbackContent =
                segment.textToSpeak
                || (Array.isArray(segment.subtitles) ? segment.subtitles.join(' ') : '')
                || segment.visualContent
                || '';
            const safeText = sanitizeText(fallbackContent);
            if (!safeText) { setDisplayedText(''); return; }

            // Typing animation for text
            let i = 0;
            setDisplayedText('');

            const interval = setInterval(() => {
                // Stop if session changed
                if (playbackSessionRef.current !== sessionId) { clearInterval(interval); return; }

                setDisplayedText(safeText.slice(0, i + 1));
                i++;
                if (i > safeText.length) clearInterval(interval);
            }, 30); // Faster typing
        };

        startVisuals();

        // Ensure we have something to play
        const subtitlesToPlay = Array.isArray(segment.subtitles) && segment.subtitles.length > 0
            ? segment.subtitles
            : [segment.textToSpeak || ""];

        const speakFallback = async (text: string) => {
            await new Promise<void>((resolve) => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                const voices = window.speechSynthesis.getVoices();
                const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
                if (preferredVoice) utterance.voice = preferredVoice;

                utterance.onend = () => resolve();
                speechRef.current = utterance;
                window.speechSynthesis.speak(utterance);
            });
        };

        for (let i = 0; i < subtitlesToPlay.length; i++) {
            // CRITICAL: Check session ID
            if (playbackSessionRef.current !== sessionId || !isPlayingRef.current) return;

            const line = subtitlesToPlay[i];
            setCurrentSubtitleText(line);

            try {
                const audioBuffer = await OpenAIService.getInstance().generateSpeech(line);
                if (!(audioBuffer instanceof ArrayBuffer) || audioBuffer.byteLength === 0) {
                    throw new Error('Empty audio buffer');
                }

                if (playbackSessionRef.current !== sessionId || !isPlayingRef.current) return;

                const url = URL.createObjectURL(new Blob([audioBuffer], { type: 'audio/mpeg' }));

                await new Promise<void>((resolve, reject) => {
                    const audio = new Audio(url);
                    audioRef.current = audio;
                    const cleanup = () => {
                        URL.revokeObjectURL(url);
                        audioRef.current = null;
                    };
                    audio.onended = () => { cleanup(); resolve(); };
                    audio.onerror = (e) => { cleanup(); reject(e); };
                    audio.play().catch(err => { cleanup(); reject(err); });
                });

            } catch (e) {
                console.warn('Audio playback failed, falling back to browser voice:', e);
                if (playbackSessionRef.current !== sessionId || !isPlayingRef.current) return;
                await speakFallback(line);
            }
        }

        // Only move next if we are still the active session
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

    const prevSegment = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div ref={containerRef} className="w-full max-w-[98vw] bg-gray-900 border-4 border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col relative h-[95vh]">
                {/* Frame / Header */}
                <div className="h-12 bg-gray-800 flex items-center justify-between px-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <h3 className="text-gray-300 font-serif tracking-widest uppercase">Classroom Session</h3>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-neon-green bg-neon-green/10 border border-neon-green/30 rounded-full px-3 py-1">
                            {renderingProfile.method}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={toggleFullscreen} className="text-gray-400 hover:text-white" title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
                            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </button>
                        <button onClick={handleClose} className="text-gray-400 hover:text-white" title="Close">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Blackboard Area */}
                <div className="flex-1 bg-[#1a2c22] relative p-8 pb-36 font-handwriting text-lg text-gray-200 overflow-y-auto"
                    id="blackboard-scroll-container"
                    style={{
                        fontFamily: '"Kalam", "Comic Sans MS", cursive',
                        backgroundImage: 'radial-gradient(circle at center, #000000ff 0%, #000000ff 100%)', // Richer gradient
                        boxShadow: 'inset 0 0 100px rgba(0,0,0,0.9)'
                    }}>

                    {/* Atmospheric Dust Particles */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30 select-none">
                        <div className="absolute top-[10%] left-[20%] w-1 h-1 bg-white rounded-full animate-float-slow blur-[1px]"></div>
                        <div className="absolute top-[40%] left-[60%] w-1.5 h-1.5 bg-white/40 rounded-full animate-float-medium blur-[0.5px]"></div>
                        <div className="absolute top-[70%] left-[30%] w-1 h-1 bg-white/60 rounded-full animate-float-fast"></div>
                        <div className="absolute top-[20%] left-[80%] w-2 h-2 bg-white/20 rounded-full animate-pulse blur-[1px]"></div>
                        <div className="absolute bottom-[20%] right-[20%] w-1 h-1 bg-white/50 rounded-full animate-float-slow"></div>
                    </div>

                    {/* Subject overlay grid / glow */}
                    <div className="absolute inset-0 pointer-events-none" style={boardOverlayStyle}></div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-green"></div>
                            <span className="animate-pulse text-gray-400 font-mono">Generative AI is crafting your lesson... (~15-30s)</span>
                        </div>
                    ) : !isPlaying && currentIndex === -1 ? (
                        <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                            <button
                                onClick={() => {
                                    if (!readyToPlay) return;
                                    setCurrentIndex(0);
                                    setIsPlaying(true);
                                }}
                                disabled={!readyToPlay}
                                className="group flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <div className="w-20 h-20 rounded-full bg-neon-green/20 flex items-center justify-center border border-neon-green/50 shadow-[0_0_30px_rgba(34,197,94,0.3)] group-hover:shadow-[0_0_50px_rgba(34,197,94,0.5)] transition-all">
                                    <Play className="w-10 h-10 fill-neon-green text-neon-green ml-1" />
                                </div>
                                <span className="text-2xl font-bold text-white tracking-wide">
                                    {readyToPlay ? 'Start Lesson' : 'Preparing lesson plan...'}
                                </span>
                            </button>
                            <p className="mt-3 text-sm text-gray-400 text-center max-w-xl">
                                {readyToPlay ? 'Press start to hear the AI voice while the board animates.' : 'Generating the chalkboard plan and voice...' }
                            </p>
                            <p className="mt-1 text-xs text-neon-green text-center max-w-2xl">
                                Rendering: {renderingProfile.method} — {renderingProfile.guidance}
                            </p>

                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap leading-relaxed w-full">
                            {/* Previous segments matched for context */}
                            {script.slice(0, currentIndex).map(s => {
                                const textContent = (s.textToSpeak || (Array.isArray(s.subtitles) ? s.subtitles.join(' ') : '') || '').trim() || "Lesson segment completed.";
                                return (
                                    <div key={s.id} className="opacity-40 mb-4 max-w-[90%] transition-opacity duration-500 border-l-2 border-gray-700 pl-4">
                                        <p className="text-2xl font-handwriting text-gray-400">{textContent}</p>
                                    </div>
                                );
                            })}

                            {currentIndex >= 0 && currentIndex < script.length && (
                                <div className="mb-8">
                                    <VisualRenderer
                                        subject={subject}
                                        visualContent={script[currentIndex]?.visualContent || currentSubtitleText || ''}
                                        segmentId={script[currentIndex]?.id ?? currentIndex}
                                    />
                                </div>
                            )}

                            {/* Current Segment */}
                            {currentIndex >= 0 && currentIndex < script.length && (
                                <div className="mb-4 text-white scroll-mt-4 flex items-center justify-center" id={`segment-${currentIndex}`}>
                                    <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] text-6xl leading-relaxed tracking-wide text-center">
                                        {displayedText || currentSubtitleText || '...'}
                                        <span className="inline-block w-3 h-10 ml-2 bg-neon-green/80 animate-pulse shadow-[0_0_15px_#39ff14] align-middle"></span>
                                    </span>
                                </div>
                            )}
                            <div id="scroll-anchor" className="h-4"></div>
                        </div>
                    )}
                </div>

                {/* Subtitles Area (Dedicated Section) */}
                <div className="bg-gray-900 border-t border-gray-800 p-6 min-h-[8rem] flex items-center justify-center z-20">
                    <div className="bg-black/40 backdrop-blur-sm text-white text-3xl font-sans px-8 py-4 rounded-2xl max-w-6xl text-center border border-white/5 w-full animate-fade-in shadow-xl">
                        {currentIndex >= 0 && currentIndex < script.length ? (
                            currentSubtitleText || "..."
                        ) : (
                            <span className="text-gray-600 italic">...</span>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="h-16 bg-gray-800 border-t border-gray-700 flex items-center justify-between px-8 gap-6 z-20 relative">
                    <button
                        onClick={() => {
                            if (!readyToPlay) return;
                            setCurrentIndex(0);
                            setIsPlaying(true);
                        }}
                        disabled={!readyToPlay}
                        className="text-white hover:text-neon-blue transition-colors disabled:opacity-30"
                        title="Restart"
                    >
                        <RotateCcw className="w-6 h-6" />
                    </button>

                    {/* Progress Bar */}
                    <div className="h-2 flex-1 max-w-2xl bg-gray-700 rounded-full overflow-hidden mx-auto">
                        <div
                            className="h-full bg-neon-green transition-all duration-300"
                            style={{ width: `${((currentIndex + 1) / Math.max(1, script.length)) * 100}%` }}
                        />
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={prevSegment}
                            disabled={!isPlaying || currentIndex <= 0}
                            className="text-white hover:text-neon-blue disabled:opacity-30 disabled:hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
                        >
                            Previous
                        </button>
                        <button
                            onClick={nextSegment}
                            disabled={!isPlaying}
                            className="text-white hover:text-neon-green transition-colors px-4 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2 disabled:opacity-30 disabled:hover:text-white"
                        >
                            Next <Play className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
