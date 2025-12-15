import { useState, useRef, useEffect } from 'react';
import { X, Play, RotateCcw, Maximize, Minimize } from 'lucide-react';
import rough from 'roughjs/bundled/rough.esm.js';
import SmilesDrawer from 'smiles-drawer';
import { supabase } from '../lib/supabase';
import { OpenAIService } from '../lib/openaiService';

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
    visualPlan?: VisualPlan;
}

type VisualPlan =
    | {
        kind: 'chemistry';
        molecules?: { smiles: string; label?: string }[];
        reactions?: { reactants: string[]; products: string[]; arrowLabel?: string }[];
        notes?: string;
    }
    | {
        kind: 'physics';
        axes?: boolean;
        objects?: { shape: 'block' | 'circle' | 'pulley' | 'incline'; x: number; y: number; w?: number; h?: number; r?: number; label?: string }[];
        forces?: { from: [number, number]; to: [number, number]; label?: string }[];
        paths?: { points: [number, number][]; label?: string }[];
        notes?: string;
    }
    | {
        kind: 'math';
        axes?: boolean;
        functions?: { samples: { x: number; y: number }[]; color?: string; label?: string }[];
        points?: { x: number; y: number; label?: string }[];
        notes?: string;
    }
    | {
        kind: 'general';
        notes?: string;
    };

const CANVAS_W = 1200;
const CANVAS_H = 800;

export const BlackboardPlayer: React.FC<BlackboardPlayerProps> = ({ topic, subject, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [script, setScript] = useState<ScriptSegment[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [displayedText, setDisplayedText] = useState('');
    const [renderedPlan, setRenderedPlan] = useState<VisualPlan | null>(null);

    const [currentSubtitleText, setCurrentSubtitleText] = useState('');

    const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const isPlayingRef = useRef(false);
    const playbackSessionRef = useRef(0); // Unique ID for current playback session

    const renderChemistryPlan = (container: HTMLDivElement, plan: Extract<VisualPlan, { kind: 'chemistry' }>) => {
        if (!container) return;
        container.innerHTML = '';
        container.style.background = '#0b1a13';
        container.style.border = '1px solid rgba(255,255,255,0.08)';
        container.style.borderRadius = '14px';
        container.style.padding = '12px';
        container.style.minHeight = '70vh';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';

        const targetCanvas = document.createElement('canvas');
        const canvasId = `chem-canvas-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        targetCanvas.id = canvasId;
        targetCanvas.width = CANVAS_W;
        targetCanvas.height = CANVAS_H;
        targetCanvas.style.width = '100%';
        targetCanvas.style.maxHeight = '85vh';
        targetCanvas.style.minHeight = '65vh';
        targetCanvas.style.background = '#0b1a13';
        targetCanvas.style.borderRadius = '12px';
        container.appendChild(targetCanvas);

        const pickSmiles = (s?: string) => {
            if (!s) return '';
            // Split on whitespace/commas/semicolons to avoid leading labels
            const tokens = s.split(/[\s,;]+/).filter(Boolean);
            return tokens.find(t =>
                t.length >= 2 &&
                !t.startsWith('(') &&
                !t.startsWith(')') &&
                /^[A-Za-z0-9@\+\-\[\]\(\)=#$\\\/%.]+$/.test(t) &&
                /[BCNOSPFIclbr]/i.test(t)
            ) || '';
        };

        const smilesSource =
            pickSmiles(plan.molecules?.find(m => !!m.smiles)?.smiles) ||
            pickSmiles(plan.reactions?.find(r => r.reactants?.[0])?.reactants?.[0]) ||
            pickSmiles(plan.reactions?.find(r => r.products?.[0])?.products?.[0]) ||
            '';

        if (!smilesSource) {
            container.innerHTML = `<div style="color:#39ff14;font:32px 'Kalam','Comic Sans MS',cursive;">No molecule/reaction data provided by AI</div>`;
            return;
        }

        // SmilesDrawer export handling (UMD/ESM)
        const SmilesLib: any = (SmilesDrawer as any)?.Drawer ? SmilesDrawer : (SmilesDrawer as any)?.default || SmilesDrawer;
        const DrawerClass = SmilesLib.Drawer;
        const parseFn = SmilesLib.parse;

        if (!DrawerClass || !parseFn) {
            container.innerHTML = `<div style="color:#f97316;font:28px 'Kalam','Comic Sans MS',cursive;">SmilesDrawer unavailable</div>`;
            return;
        }

        const isLikelySmiles = (s: string) =>
            !!s &&
            s.length >= 2 &&
            /^[A-Za-z0-9@\+\-\[\]\(\)=#$\\\/%.]+$/.test(s) &&
            /[BCNOSPFIclbr]/i.test(s) &&
            !s.startsWith('(') &&
            !s.startsWith(')');

        if (!isLikelySmiles(smilesSource)) {
            container.innerHTML = `<div style="color:#f97316;font:28px 'Kalam','Comic Sans MS',cursive;">Invalid SMILES provided by AI</div>`;
            return;
        }

        const drawer = new DrawerClass({
            width: CANVAS_W,
            height: CANVAS_H,
            padding: 10,
            compactDrawing: false
        });

        try {
            parseFn(
                smilesSource,
                (tree: any) => {
                    if (!tree) {
                        container.innerHTML = `<div style="color:#f97316;font:28px 'Kalam','Comic Sans MS',cursive;">Empty molecule</div>`;
                        return;
                    }
                    if (!targetCanvas.isConnected || !container.isConnected) return;
                    drawer
                        .draw(tree, canvasId, 'light', false)
                        .then(() => {
                            if (!plan.reactions?.length || !container.isConnected) return;
                            const r = plan.reactions[0];
                            const label = document.createElement('div');
                            label.style.color = '#facc15';
                            label.style.font = '28px "Kalam","Comic Sans MS",cursive';
                            label.style.marginTop = '12px';
                            label.textContent = r.arrowLabel || 'reaction';
                            container.appendChild(label);
                        })
                        .catch((err: any) => {
                            console.warn('SmilesDrawer draw error', err);
                            if (container.isConnected) {
                                container.innerHTML = `<div style="color:#f97316;font:28px 'Kalam','Comic Sans MS',cursive;">Could not render molecule</div>`;
                            }
                        });
                },
                (err: any) => {
                    console.warn('SmilesDrawer parse error', err);
                    if (container.isConnected) {
                        container.innerHTML = `<div style="color:#f97316;font:28px 'Kalam','Comic Sans MS',cursive;">Could not parse SMILES</div>`;
                    }
                }
            );
        } catch (e) {
            console.warn('SmilesDrawer render failed', e);
            if (container.isConnected) {
                container.innerHTML = `<div style="color:#f97316;font:28px 'Kalam','Comic Sans MS',cursive;">Render failed</div>`;
            }
        }
    };

    const renderPhysicsMathPlan = (canvas: HTMLCanvasElement, plan: Extract<VisualPlan, { kind: 'physics' | 'math' | 'general' }>) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = '#0b1a13';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const rc = rough.canvas(canvas);
        const sx = (x: number) => x * CANVAS_W;
        const sy = (y: number) => y * CANVAS_H;

        // Background grid
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= CANVAS_W; x += 80) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CANVAS_H);
            ctx.stroke();
        }
        for (let y = 0; y <= CANVAS_H; y += 80) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CANVAS_W, y);
            ctx.stroke();
        }

        const drawLabel = (text: string, x: number, y: number, color = '#facc15') => {
            ctx.fillStyle = color;
            ctx.font = '28px "Kalam", "Comic Sans MS", cursive';
            ctx.fillText(text, x, y);
        };

        if (plan.axes) {
            rc.line(sx(0.1), sy(0.9), sx(0.9), sy(0.9), { stroke: '#39ff14', roughness: 1.2 });
            rc.line(sx(0.1), sy(0.9), sx(0.1), sy(0.1), { stroke: '#00f3ff', roughness: 1.2 });
            drawLabel('x', sx(0.9) + 10, sy(0.9) + 5, '#39ff14');
            drawLabel('y', sx(0.08), sy(0.12), '#00f3ff');
        }

        if (plan.kind === 'physics' && plan.objects) {
            plan.objects.forEach(obj => {
                const color = '#e5e7eb';
                if (obj.shape === 'block') {
                    rc.rectangle(sx(obj.x), sy(obj.y), (obj.w || 0.18) * CANVAS_W, (obj.h || 0.12) * CANVAS_H, { stroke: color, fill: 'transparent', strokeWidth: 3 });
                }
                if (obj.shape === 'circle') {
                    rc.circle(sx(obj.x), sy(obj.y), (obj.r || 0.1) * CANVAS_W, { stroke: color, fill: 'transparent', strokeWidth: 3 });
                }
                if (obj.shape === 'pulley') {
                    rc.circle(sx(obj.x), sy(obj.y), (obj.r || 0.1) * CANVAS_W, { stroke: '#facc15', fill: 'transparent', strokeWidth: 3 });
                    rc.line(sx(obj.x), sy(obj.y - (obj.r || 0.1)), sx(obj.x), sy(obj.y + (obj.r || 0.1)), { stroke: '#facc15' });
                }
                if (obj.shape === 'incline') {
                    rc.line(sx(obj.x - 0.2), sy(obj.y + 0.2), sx(obj.x + 0.2), sy(obj.y - 0.2), { stroke: '#f97316', strokeWidth: 3 });
                }
                if (obj.label) drawLabel(obj.label, sx(obj.x) + 10, sy(obj.y) - 10, '#facc15');
            });
        }

        if (plan.kind === 'physics' && plan.forces) {
            plan.forces.forEach(f => {
                rc.line(sx(f.from[0]), sy(f.from[1]), sx(f.to[0]), sy(f.to[1]), { stroke: '#ff00ff', strokeWidth: 3, roughness: 1 });
                const midX = (sx(f.from[0]) + sx(f.to[0])) / 2;
                const midY = (sy(f.from[1]) + sy(f.to[1])) / 2;
                if (f.label) drawLabel(f.label, midX + 6, midY - 6, '#ff00ff');
            });
        }

        if (plan.kind === 'physics' && plan.paths) {
            plan.paths.forEach(p => {
                if (!p.points?.length) return;
                for (let i = 0; i < p.points.length - 1; i++) {
                    const a = p.points[i];
                    const b = p.points[i + 1];
                    rc.line(sx(a[0]), sy(a[1]), sx(b[0]), sy(b[1]), { stroke: '#00f3ff', strokeWidth: 2 });
                }
                if (p.label) {
                    const last = p.points[p.points.length - 1];
                    drawLabel(p.label, sx(last[0]) + 6, sy(last[1]) - 6, '#00f3ff');
                }
            });
        }

        if (plan.kind === 'math' && plan.functions) {
            plan.functions.forEach(fn => {
                const pts = fn.samples || [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const a = pts[i];
                    const b = pts[i + 1];
                    rc.line(sx(a.x), sy(1 - a.y), sx(b.x), sy(1 - b.y), { stroke: fn.color || '#39ff14', strokeWidth: 3, roughness: 1 });
                }
                if (fn.label && pts.length) {
                    const last = pts[pts.length - 1];
                    drawLabel(fn.label, sx(last.x) + 8, sy(1 - last.y) - 8, fn.color || '#39ff14');
                }
            });
        }

        if (plan.kind === 'math' && plan.points) {
            plan.points.forEach(p => {
                rc.circle(sx(p.x), sy(1 - p.y), 12, { stroke: '#facc15', fill: '#facc15', fillStyle: 'solid' });
                if (p.label) drawLabel(p.label, sx(p.x) + 8, sy(1 - p.y) - 8, '#facc15');
            });
        }
    };

    const LibraryVisual: React.FC<{ plan: VisualPlan }> = ({ plan }) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const chemRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (plan.kind === 'chemistry') {
                if (chemRef.current) renderChemistryPlan(chemRef.current, plan);
                return;
            }
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = CANVAS_W;
            canvas.height = CANVAS_H;
            renderPhysicsMathPlan(canvas, plan as Extract<VisualPlan, { kind: 'physics' | 'math' | 'general' }>);
        }, [plan]);

        if (plan.kind === 'chemistry') {
            return (
                <div className="w-full h-auto min-h-[70vh] flex items-center justify-center animate-fade-in">
                    <div
                        ref={chemRef}
                        className="w-[90%] max-h-[85vh] bg-[#0b1a13] rounded-xl shadow-2xl border border-white/10 overflow-hidden"
                    />
                </div>
            );
        }

        return (
            <div className="w-full h-auto min-h-[70vh] flex items-center justify-center animate-fade-in">
                <canvas
                    ref={canvasRef}
                    className="w-[90%] max-h-[85vh] bg-[#0b1a13] rounded-xl shadow-2xl border border-white/10"
                />
            </div>
        );
    };

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
        setRenderedPlan(null);

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
                    // Backfill subtitles for legacy cached videos
                    const backfilledScript = saved.script.map((s: any) => ({
                        ...s,
                        subtitles: Array.isArray(s.subtitles) && s.subtitles.length > 0
                            ? s.subtitles
                            : [s.textToSpeak || '']
                    }));
                    setScript(backfilledScript);
                    setTimeout(() => {
                        setLoading(false);
                        setCurrentIndex(0);
                        setIsPlaying(true);
                    }, 500);
                    return;
                }
            }

            const getSubjectVisualPrompt = (subject: string): string => {
                const s = subject.toLowerCase();

                // Strong base style: much more dynamic + layered visuals
                const base = [
                    "Generate a HIGHLY VISUAL, DYNAMIC SVG scene in neon chalkboard style.",
                    "Overall look: cinematic blackboard shot with colored chalk lines.",
                    "Use multiple layers of elements, arrows and highlights so the scene feels ALIVE.",
                    "Use smooth <animate>, <animateTransform> or small motion on key elements (but avoid chaos).",
                    "Colors: mainly neon chalk tones (#00f3ff, #ff00ff, #39ff14, #facc15, #f97316) on a dark background.",
                    "Stroke width: 2.5–3px, rounded line caps, no fills except for small emphasis areas.",
                    "Composition: clear foreground focus + subtle background guidelines / grids.",
                    "SIZE RULES: include viewBox='0 0 1200 800' and preserveAspectRatio='xMidYMid meet'. Center the MAIN SUBJECT; it should occupy ~60–75% of the frame. Avoid tiny elements; avoid huge empty margins.",
                    "Avoid walls of text. Prefer symbols, icons, shapes, arrows, curves, labels near objects.",
                    "No external assets. STRICTLY inline SVG code only."
                ].join(" ");

                if (s.includes('physics')) {
                    return `${base} THEME: physics chalkboard. Show objects, forces and motion with arrows. Include at least ONE animated arrow or vector that gently pulses or moves. Add subtle grid or reference lines. Use classic physics diagrams (free-body with normal/weight/force vectors, pulley/tension, motion graphs). Keep the main diagram large and centered.`;
                }

                if (s.includes('chemistry')) {
                    return `${base} THEME: chemistry lab chalkboard. Draw LARGE, CLEAR skeletal structures (explicit atoms + bonds) and/or beakers/flasks with glowing liquids. Show reaction arrows with animated flow/bubbles. Separate reactants, arrow, and products clearly with labels near objects. Keep structures centered and filling the majority of the frame. In visualPlan include at least one VALID SMILES (no placeholders, no "X", only real atoms) for the main molecule.`;
                }

                if (s.includes('biology')) {
                    return `${base} THEME: biology lecture. Use smooth organic shapes (cells, organs, processes) with clear boundaries. Add animated arrows to show flows (like blood, air, signals). Use labels around the edges, not inside shapes.`;
                }

                if (s.includes('math') || s.includes('calculus') || s.includes('algebra')) {
                    return `${base} THEME: math blackboard. Draw a big coordinate grid or number line as background. Emphasize 1–3 key curves or shapes using thick neon strokes. Animate a point moving along a curve OR an area being filled to show change over time.`;
                }

                if (s.includes('history') || s.includes('literature')) {
                    return [
                        "Generate an expressive symbolic SVG scene for history / literature.",
                        "Use iconic silhouettes (e.g., books, quills, monuments, timelines, character symbols).",
                        "Add a clear visual timeline or central symbol with supporting icons around it.",
                        "Use subtle neon chalk highlights and 1–2 animated glows or pulses for emphasis.",
                        "Avoid realistic faces. Prefer symbols and simplified shapes. STRICTLY SVG code only."
                    ].join(" ");
                }

                return `${base} THEME: general education. Create a central concept icon with surrounding related mini‑icons connected by arrows. Use at least one animated element for emphasis.`;
            };

            const visualPrompt = getSubjectVisualPrompt(subject);

            const prompt = `You are an expert blackboard teacher and motion graphics designer.
Create a VISUALLY RICH, engaging lesson script for: "${topic}" (Subject: "${subject}").

REQUIREMENTS:
- Break the lesson into 6–10 segments that tell a clear visual story.
- EACH segment must have a UNIQUE, INTERESTING SVG scene (not just small variations).
- Use the visual style and constraints described in this subject‑specific visual prompt: "${visualPrompt}".
- The SVG should feel like a cinematic chalkboard shot with multiple elements, arrows, and subtle motion. Ensure viewBox='0 0 1200 800', preserveAspectRatio='xMidYMid meet', main subject centered and filling ~60–75% of the area.
- Avoid big text paragraphs in the SVG; use short labels near objects only when needed.
- Do NOT add explanations or commentary outside JSON. RETURN VALID JSON ONLY.
- For each segment also include a machine-usable visualPlan to drive libraries:
  - Chemistry example: {"kind":"chemistry","molecules":[{"smiles":"C1=CC=CC=C1"}],"reactions":[{"reactants":["CCO"],"products":["CC=O"],"arrowLabel":"oxidation"}]}
  - Physics example: {"kind":"physics","axes":true,"objects":[{"shape":"block","x":0.48,"y":0.62,"w":0.22,"h":0.14,"label":"m"}],"forces":[{"from":[0.48,0.62],"to":[0.48,0.32],"label":"N"}]}
  - Math example: {"kind":"math","axes":true,"functions":[{"label":"f(x)","samples":[{"x":0,"y":0.2},{"x":0.5,"y":0.6},{"x":1,"y":0.8}]}]}
  - Use normalized coordinates (0..1) for positions. Keep visualContent as SVG fallback.
- Chemistry rule: visualPlan.molecules[0].smiles must be VALID SMILES (no placeholders, no "X", only real atoms); prefer common educational molecules or those relevant to the topic.

JSON STRUCTURE TO RETURN (NO MARKDOWN, NO BACKTICKS):
{
  "segments": [
    {
      "id": 1,
      "subtitles": ["Sentence 1.", "Sentence 2."],
      "visualContent": "<svg>...complex, animated chalkboard diagram for this part...</svg>",
      "visualPlan": { /* per examples above */ }
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
                const computedSegments = parsed.segments.map((s: any) => ({
                    ...s,
                    textToSpeak: s.textToSpeak || (Array.isArray(s.subtitles) ? s.subtitles.join(' ') : s.textToSpeak),
                    subtitles: Array.isArray(s.subtitles) ? s.subtitles : [s.textToSpeak || '']
                }));
                setScript(computedSegments);

                // Save to DB
                if (user) {
                    await supabase.from('saved_videos').insert({
                        user_id: user.id,
                        topic,
                        subject,
                        script: computedSegments
                    });
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
            // Visual Content Logic
            // If AI provided a structured visual plan, render via libraries
            if (segment.visualPlan) {
                setRenderedPlan(segment.visualPlan);
                setDisplayedText('');
                return;
            }

            setRenderedPlan(null);
            // Safety check
            if (!segment.visualContent) return;

            const svgMatch = segment.visualContent.match(/<svg[\s\S]*?<\/svg>/i);

            if (svgMatch) {
                setDisplayedText(svgMatch[0]); // Show ONLY the SVG code
            } else {
                // Typing animation for text
                let i = 0;
                setDisplayedText('');

                const interval = setInterval(() => {
                    // Stop if session changed
                    if (playbackSessionRef.current !== sessionId) { clearInterval(interval); return; }

                    setDisplayedText(segment.visualContent.slice(0, i + 1));
                    i++;
                    if (i > segment.visualContent.length) clearInterval(interval);
                }, 30); // Faster typing
            }
        };

        startVisuals();

        // Ensure we have something to play
        const subtitlesToPlay = Array.isArray(segment.subtitles) && segment.subtitles.length > 0
            ? segment.subtitles
            : [segment.textToSpeak || ""];

        // Loop through subtitles and play sequentially
        for (let i = 0; i < subtitlesToPlay.length; i++) {
            // CRITICAL: Check session ID
            if (playbackSessionRef.current !== sessionId || !isPlayingRef.current) return;

            const line = subtitlesToPlay[i];
            setCurrentSubtitleText(line);

            try {
                // Try OpenAI TTS
                const audioBuffer = await OpenAIService.getInstance().generateSpeech(line);

                // Double check after async
                if (playbackSessionRef.current !== sessionId || !isPlayingRef.current) return;

                const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);

                await new Promise<void>((resolve) => {
                    const audio = new Audio(url);
                    audioRef.current = audio;
                    audio.onended = () => {
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    audio.onerror = (e) => {
                        URL.revokeObjectURL(url); // clean up
                        console.warn("Audio error", e);
                        resolve(); // Resolve anyway to continue
                    };
                    audio.play().catch(e => {
                        console.warn("Audio play failed", e);
                        resolve();
                    });
                });

            } catch (e) {
                console.warn('TTS Error, falling back to browser voice:', e);
                // Double check after async
                if (playbackSessionRef.current !== sessionId || !isPlayingRef.current) return;

                // Fallback
                await new Promise<void>((resolve) => {
                    const utterance = new SpeechSynthesisUtterance(line);
                    utterance.rate = 1.0;
                    const voices = window.speechSynthesis.getVoices();
                    const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
                    if (preferredVoice) utterance.voice = preferredVoice;

                    utterance.onend = () => resolve();
                    speechRef.current = utterance;
                    window.speechSynthesis.speak(utterance);
                });
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
                    <h3 className="text-gray-300 font-serif tracking-widest uppercase">Classroom Session</h3>
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
                <div className="flex-1 bg-[#1a2c22] relative p-8 pb-48 font-handwriting text-lg text-gray-200 overflow-y-auto"
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

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-green"></div>
                            <span className="animate-pulse text-gray-400 font-mono">Generative AI is crafting your lesson... (~15-30s)</span>
                        </div>
                    ) : !isPlaying && currentIndex === -1 ? (
                        <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                            <button
                                onClick={() => { setCurrentIndex(0); setIsPlaying(true); }}
                                className="group flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-105"
                            >
                                <div className="w-20 h-20 rounded-full bg-neon-green/20 flex items-center justify-center border border-neon-green/50 shadow-[0_0_30px_rgba(34,197,94,0.3)] group-hover:shadow-[0_0_50px_rgba(34,197,94,0.5)] transition-all">
                                    <Play className="w-10 h-10 fill-neon-green text-neon-green ml-1" />
                                </div>
                                <span className="text-2xl font-bold text-white tracking-wide">Start Lesson</span>
                            </button>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap leading-relaxed w-full">
                            {/* Previous segments matched for context */}
                            {script.slice(0, currentIndex).map(s => {
                                // Strip SVG tags to show only text summary for history
                                const textContent = s.visualContent.replace(/<svg[\s\S]*?<\/svg>/i, '').trim() || "Diagram completed.";
                                return (
                                    <div key={s.id} className="opacity-40 mb-4 max-w-[90%] transition-opacity duration-500 border-l-2 border-gray-700 pl-4">
                                        <p className="text-2xl font-handwriting text-gray-400">{textContent}</p>
                                    </div>
                                );
                            })}

                            {/* Current Segment */}
                            {currentIndex >= 0 && currentIndex < script.length && (
                                <div className="mb-4 text-white scroll-mt-4 flex items-center justify-center" id={`segment-${currentIndex}`}>
                                    {renderedPlan ? (
                                        <LibraryVisual plan={renderedPlan} />
                                    ) : /<svg/i.test(displayedText) ? (
                                        <div
                                            dangerouslySetInnerHTML={{ __html: displayedText }}
                                            className="w-full h-auto min-h-[70vh] flex items-center justify-center animate-fade-in [&>svg]:w-[90%] [&>svg]:h-auto [&>svg]:max-h-[85vh] [&>svg]:fill-none [&>svg]:stroke-2 [&>svg]:drop-shadow-2xl [&>svg]:mx-auto"
                                        />
                                    ) : (
                                        <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] text-6xl leading-relaxed tracking-wide text-center">
                                            {displayedText}
                                            <span className="inline-block w-3 h-10 ml-2 bg-neon-green/80 animate-pulse shadow-[0_0_15px_#39ff14] align-middle"></span>
                                        </span>
                                    )}
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
                            setCurrentIndex(0);
                            setIsPlaying(true);
                        }}
                        className="text-white hover:text-neon-blue transition-colors"
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
                            disabled={currentIndex <= 0}
                            className="text-white hover:text-neon-blue disabled:opacity-30 disabled:hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
                        >
                            Previous
                        </button>
                        <button
                            onClick={nextSegment}
                            className="text-white hover:text-neon-green transition-colors px-4 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2"
                        >
                            Next <Play className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};