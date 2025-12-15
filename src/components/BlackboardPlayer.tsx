import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Play, RotateCcw, Maximize, Minimize } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OpenAIService } from '../lib/openaiService';
import { HeygenService } from '../lib/heygenService';

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
    heygen_video_id?: string | null;
    heygen_video_url?: string | null;
    heygen_status?: string | null;
    heygen_error?: string | null;
    heygen_last_checked_at?: string | null;
    heygen_notified?: boolean | null;
    heygen_notified_at?: string | null;
    heygen_requested_at?: string | null;
}

export const BlackboardPlayer: React.FC<BlackboardPlayerProps> = ({ topic, subject, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [script, setScript] = useState<ScriptSegment[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [displayedText, setDisplayedText] = useState('');

    const [currentSubtitleText, setCurrentSubtitleText] = useState('');

    const [userId, setUserId] = useState<string | null>(null);
    const [savedVideoId, setSavedVideoId] = useState<string | null>(null);

    const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const isPlayingRef = useRef(false);
    const playbackSessionRef = useRef(0); // Unique ID for current playback session
    const [heygenStatus, setHeygenStatus] = useState<'idle' | 'generating' | 'polling' | 'ready' | 'error'>('idle');
    const [heygenUrl, setHeygenUrl] = useState<string | null>(null);
    const [heygenError, setHeygenError] = useState('');
    const heygenRequestIdRef = useRef(0);
    const heygenAbortRef = useRef<AbortController | null>(null);

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

    const videoReady = heygenStatus === 'ready' && !!heygenUrl;
    const videoWorking = heygenStatus === 'generating' || heygenStatus === 'polling';
    const lessonLocked = !videoReady;

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
            setUserId(user?.id || null);

            if (user) {
                const { data: saved } = await supabase
                    .from('saved_videos')
                    .select('script, heygen_video_id, heygen_video_url, heygen_status')
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
                    setSavedVideoId(casted.heygen_video_id || null);

                    if (casted.heygen_video_url) {
                        setHeygenUrl(casted.heygen_video_url);
                        setHeygenStatus('ready');
                    } else if (casted.heygen_video_id) {
                        setHeygenStatus('polling');
                    }

                    setLoading(false);
                    setCurrentIndex(-1);
                    setIsPlaying(false);
                    return;
                }
            }

            const getSubjectVisualPrompt = (subject: string): string => {
                const s = subject.toLowerCase();

                const base = [
                    "Generate vivid, concise chalkboard cues in neon style (plain text only, no SVG/HTML).",
                    "Overall look: cinematic blackboard shot with colored chalk lines.",
                    "Use short, descriptive phrases and arrows described in words (no markup).",
                    "Colors: mainly neon chalk tones (#00f3ff, #ff00ff, #39ff14, #facc15, #f97316) on a dark background.",
                    "Keep notes compact (one line per cue) so they fit on a blackboard.",
                    "No markup, no SVG, no HTML. Plain text only."
                ].join(" ");

                if (s.includes('physics')) {
                    return `${base} THEME: physics chalkboard. Describe objects, forces and motion with short text cues (e.g., "block on incline", "arrow: gravity down").`;
                }

                if (s.includes('chemistry')) {
                    return `${base} THEME: chemistry lab chalkboard. Use textual cues like molecules or reaction steps (e.g., "H2 + O2 -> H2O", "label: combustion").`;
                }

                if (s.includes('biology')) {
                    return `${base} THEME: biology lecture. Describe flows and parts in words (e.g., "cell membrane", "arrow: nutrients in", "arrow: waste out").`;
                }

                if (s.includes('math') || s.includes('calculus') || s.includes('algebra')) {
                    return `${base} THEME: math blackboard. Describe the main objects in text (e.g., "graph of y = sin(x)", "arrow: shift right", "area under curve").`;
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
                        script: computedSegments,
                        heygen_status: 'pending',
                        heygen_video_id: null,
                        heygen_video_url: null,
                        heygen_error: null,
                        heygen_requested_at: new Date().toISOString(),
                        heygen_notified: false,
                        heygen_notified_at: null,
                        heygen_last_checked_at: new Date().toISOString()
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

    const upsertSavedVideo = useCallback(async (patch: Partial<SavedVideoRecord>) => {
        if (!userId || !script.length) return;
        await supabase.from('saved_videos').upsert({
            user_id: userId,
            topic,
            subject,
            script,
            heygen_last_checked_at: new Date().toISOString(),
            ...patch
        }, { onConflict: 'user_id,topic,subject' });
    }, [userId, script, topic, subject]);

    const pollExistingHeygenVideo = useCallback(async (videoId: string) => {
        setHeygenStatus('polling');
        setHeygenError('');
        heygenAbortRef.current?.abort();
        const controller = new AbortController();
        heygenAbortRef.current = controller;
        const requestId = ++heygenRequestIdRef.current;

        try {
            const heygen = HeygenService.getInstance();
            const url = await heygen.waitForVideoUrl(videoId, { signal: controller.signal });
            if (heygenRequestIdRef.current !== requestId || controller.signal.aborted) return;

            if (url) {
                setHeygenUrl(url);
                setHeygenStatus('ready');
                setSavedVideoId(videoId);
                await upsertSavedVideo({ heygen_video_id: videoId, heygen_video_url: url, heygen_status: 'ready', heygen_error: null });
            } else {
                setHeygenStatus('error');
                setHeygenError('HeyGen did not return a video URL. Tap retry.');
                await upsertSavedVideo({ heygen_video_id: videoId, heygen_status: 'error', heygen_error: 'No video URL from HeyGen' });
            }
        } catch (e: any) {
            if (controller.signal.aborted) return;
            setHeygenStatus('error');
            setHeygenError(e?.message || 'HeyGen video generation failed');
            await upsertSavedVideo({ heygen_video_id: videoId, heygen_status: 'error', heygen_error: e?.message || 'HeyGen video generation failed' });
        }
    }, [upsertSavedVideo]);

    const requestHeygenVideo = useCallback(async (force = false) => {
        if (heygenStatus === 'generating' || heygenStatus === 'polling') return;
        if (!force && heygenStatus === 'ready') return;

        const allText = script
            .map(s => s.textToSpeak || (Array.isArray(s.subtitles) ? s.subtitles.join(' ') : ''))
            .join(' ')
            .trim();

        if (!allText || allText.length < 16) return;

        setHeygenStatus('generating');
        setHeygenError('');
        heygenAbortRef.current?.abort();
        const controller = new AbortController();
        heygenAbortRef.current = controller;
        const requestId = ++heygenRequestIdRef.current;

        try {
            const heygen = HeygenService.getInstance();
            const videoId = await heygen.generateVideoFromText(allText, { caption: true });
            if (heygenRequestIdRef.current !== requestId || controller.signal.aborted) return;

            setSavedVideoId(videoId);
            await upsertSavedVideo({
                heygen_video_id: videoId,
                heygen_status: 'processing',
                heygen_video_url: null,
                heygen_error: null,
                heygen_requested_at: new Date().toISOString()
            });
            await pollExistingHeygenVideo(videoId);
        } catch (e: any) {
            if (controller.signal.aborted) return;
            setHeygenStatus('error');
            setHeygenError(e?.message || 'HeyGen video generation failed');
            if (savedVideoId) await upsertSavedVideo({ heygen_video_id: savedVideoId, heygen_status: 'error', heygen_error: e?.message || 'HeyGen video generation failed' });
        }
    }, [heygenStatus, script, upsertSavedVideo, pollExistingHeygenVideo, savedVideoId]);

    useEffect(() => {
        if (!loading && script.length > 0 && heygenStatus === 'idle') {
            requestHeygenVideo();
        }

        return () => {
            heygenAbortRef.current?.abort();
        };
    }, [loading, script, heygenStatus, requestHeygenVideo]);

    useEffect(() => {
        if (savedVideoId && heygenStatus === 'polling') {
            pollExistingHeygenVideo(savedVideoId);
        }
    }, [savedVideoId, heygenStatus, pollExistingHeygenVideo]);

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
                    ) : lessonLocked ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-green"></div>
                            <span className="text-xl font-semibold text-white">Lesson locked while HeyGen blackboard video renders</span>
                            <p className="text-sm text-gray-400">
                                {videoWorking ? 'Generating HeyGen video now...' : 'Waiting for video generation to finish.'}
                            </p>
                            <p className="text-xs text-gray-500 max-w-xl">
                                You can close this window and keep studying; we will notify you once the HeyGen video is ready.
                            </p>
                            <button
                                onClick={handleClose}
                                className="mt-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10"
                            >
                                Close and continue elsewhere
                            </button>
                        </div>
                    ) : !isPlaying && currentIndex === -1 ? (
                        <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                            <button
                                onClick={() => {
                                    if (!videoReady) return;
                                    setCurrentIndex(0);
                                    setIsPlaying(true);
                                }}
                                disabled={!videoReady}
                                className="group flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <div className="w-20 h-20 rounded-full bg-neon-green/20 flex items-center justify-center border border-neon-green/50 shadow-[0_0_30px_rgba(34,197,94,0.3)] group-hover:shadow-[0_0_50px_rgba(34,197,94,0.5)] transition-all">
                                    <Play className="w-10 h-10 fill-neon-green text-neon-green ml-1" />
                                </div>
                                <span className="text-2xl font-bold text-white tracking-wide">
                                    {videoReady ? 'Start Lesson' : 'Lesson locked until HeyGen video is ready'}
                                </span>
                            </button>
                            <p className="mt-3 text-sm text-gray-400">
                                {videoWorking && 'Generating HeyGen video...'}
                                {!videoWorking && !videoReady && 'Video must finish generating before you can start.'}
                                {videoReady && 'Video ready. Press start to begin.'}
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

                {/* HeyGen Video Section */}
                <div className="bg-gray-950 border-t border-gray-800 px-6 py-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm text-gray-400">HeyGen audio (avatar hidden)</p>
                            <p className="text-lg font-semibold text-white">HeyGen</p>
                        </div>
                        <button
                            onClick={() => requestHeygenVideo(true)}
                            disabled={heygenStatus === 'generating' || heygenStatus === 'polling'}
                            className="px-4 py-2 rounded-lg bg-neon-green/20 text-neon-green border border-neon-green/50 hover:bg-neon-green/30 disabled:opacity-60"
                        >
                            {heygenStatus === 'generating' || heygenStatus === 'polling' ? 'Working...' : 'Retry' }
                        </button>
                    </div>
                    {heygenStatus === 'ready' && heygenUrl ? (
                        <div className="space-y-2">
                            <audio
                                key={heygenUrl}
                                controls
                                className="w-full"
                                src={heygenUrl}
                            />
                            <p className="text-xs text-gray-500">Avatar visuals are suppressed; audio only.</p>
                        </div>
                    ) : (
                        <div className="text-gray-400 text-sm bg-black/30 border border-gray-800 rounded-lg px-4 py-3">
                            {heygenStatus === 'generating' && 'Sending script to HeyGen (audio-only)...'}
                            {heygenStatus === 'polling' && 'Rendering audio...'}
                            {heygenStatus === 'error' && heygenError}
                            {heygenStatus === 'idle' && 'Preparing audio...'}
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
                            if (!videoReady) return;
                            setCurrentIndex(0);
                            setIsPlaying(true);
                        }}
                        disabled={!videoReady}
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