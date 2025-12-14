import { useState, useRef, useEffect } from 'react';
import { X, Play, RotateCcw, Maximize, Minimize } from 'lucide-react';
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
}

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
                const base = "Generate CLEAN, MINIMALIST, HIGH-CONTRAST SVGs. Style: Professional Chalkboard Art. Stroke width: 2px minimum. Avoid clutter. Use 'filter: drop-shadow(0 0 5px currentColor)' for neon glow. Neons: #00f3ff, #ff00ff, #39ff14. Use <animate> for smooth motion. SCENE: Center the main subject. Leave ample negative space.";

                if (s.includes('physics')) return `${base} FORCE CRITICAL: Draw simple, clear Free-Body Diagrams. disjointed components. CLEAR SEPARATION between pulleys/blocks. scalable vectors.`;

                if (s.includes('chemistry')) return `${base} MOLECULE CRITICAL: Draw CLEAN skeletal structures. Large spacing between atoms. Distinct bonds. legible element symbols.`;

                if (s.includes('biology')) return `${base} ORGANIC CRITICAL: Draw simplified, iconic smooth shapes. Avoid noisy textures. distinct membranes.`;

                if (s.includes('math') || s.includes('calculus') || s.includes('algebra')) return `${base} GRAPH CRITICAL: Use a clean, simple coordinate system. scalable axis lines. smooth, continuous gesture-like curves.`;

                if (s.includes('history') || s.includes('literature')) return "Generate elegant, simple symbolic lines. Iconic representations. Minimal strokes.";

                return `${base} Create clear, educational diagrams. Simple shapes only.`;
            };

            const visualPrompt = getSubjectVisualPrompt(subject);

            const prompt = `Create a visually rich, educational lesson script for: "${topic}" (Subject: "${subject}").
      Break it down into 6-10 segments.
      RETURN JSON OBJECT ONLY.
      CRITICAL RULE: EVERY segment must have a unique, CLEAR SVG. Avoid text inside SVG unless necessary (labels).
      Structure:
      {
        "segments": [
          {
            "id": 1,
            "subtitles": ["Sentence 1.", "Sentence 2."],
            "visualContent": "${visualPrompt} STRICTLY SVG CODE ONLY."
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
                                <div className="mb-4 text-white scroll-mt-4" id={`segment-${currentIndex}`}>
                                    {/<svg/i.test(displayedText) ? (
                                        <div
                                            dangerouslySetInnerHTML={{ __html: displayedText }}
                                            className="w-full h-auto min-h-[60vh] flex justify-center animate-fade-in [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[75vh] [&>svg]:fill-none [&>svg]:stroke-2 [&>svg]:drop-shadow-2xl"
                                        />
                                    ) : (
                                        <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] text-5xl leading-relaxed tracking-wide">
                                            {displayedText}
                                            <span className="inline-block w-3 h-8 ml-2 bg-neon-green/80 animate-pulse shadow-[0_0_15px_#39ff14] align-middle"></span>
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