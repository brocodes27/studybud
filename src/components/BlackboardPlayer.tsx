import { useState, useRef, useEffect } from 'react';
import { X, Play, RotateCcw } from 'lucide-react';
import { OpenAIService } from '../lib/openaiService';

interface BlackboardPlayerProps {
    topic: string;
    subject: string;
    onClose: () => void;
}

interface ScriptSegment {
    id: number;
    textToSpeak: string;
    visualContent: string;
}

export const BlackboardPlayer: React.FC<BlackboardPlayerProps> = ({ topic, subject, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [script, setScript] = useState<ScriptSegment[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [displayedText, setDisplayedText] = useState('');

    const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

    useEffect(() => {
        generateScript();

        return () => {
            window.speechSynthesis.cancel();
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
            const isStem = ['science', 'physics', 'chemistry', 'biology', 'math', 'mathematics'].some(s => subject.toLowerCase().includes(s));
            const visualPrompt = isStem
                ? "For visualContent, generate HIGH FIDELITY, TEXTBOOK QUALITY SVG diagrams. Use minimalist, clean lines with NO clutter or overlapping text. Prioritize clarity and geometric precision. Use <svg viewBox='0 0 500 350'> with stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'. Use a vibrant chalk palette: stroke='#ffeb3b' (yellow), '#4fc3f7' (blue), '#ff8a80' (red), '#b9f6ca' (green), '#ffffff' (white)."
                : "For visualContent, use EITHER plain text summary OR valid SVG code (starting with <svg) for a clean, simple chalk illustration. For SVG: use viewBox='0 0 400 250', fill='none', stroke-width='2', stroke-linecap='round'. Use various chalk colors (stroke='#ffeb3b', '#4fc3f7', '#ff8a80', '#ffffff').";

            const prompt = `Create a short blackboard-style educational lesson script for the topic: "${topic}" in subject: "${subject}".
      Break it down into 3-6 segments.
      Return strictly a JSON object with this structure:
      {
        "segments": [
          {
            "id": 1,
            "textToSpeak": "Spoken audio text",
            "visualContent": "${visualPrompt} No markdown around the SVG."
          }
        ]
      }`;

            const response = await OpenAIService.getInstance().generateChatCompletion(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                setScript(parsed.segments);
                // Auto-play after loading
                setTimeout(() => {
                    setLoading(false);
                    setCurrentIndex(0);
                    setIsPlaying(true);
                }, 500);
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentIndex >= 0 && currentIndex < script.length && isPlaying) {
            playSegment(script[currentIndex]);
        }
    }, [currentIndex, isPlaying]);

    const playSegment = (segment: ScriptSegment) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(segment.textToSpeak);
        utterance.rate = 1.0;
        utterance.onend = () => {
            if (currentIndex < script.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setIsPlaying(false);
            }
        };
        speechRef.current = utterance;

        // Visual Content Logic
        const isSvg = segment.visualContent.trim().startsWith('<svg');

        if (isSvg) {
            setDisplayedText(segment.visualContent); // Show SVG immediately
        } else {
            // Typing animation for text
            let i = 0;
            setDisplayedText('');

            // Clear any existing intervals if we store them in a ref (omitted for brevity, but ideal)
            // For now simple interval
            const interval = setInterval(() => {
                setDisplayedText(segment.visualContent.slice(0, i + 1));
                i++;
                if (i > segment.visualContent.length) clearInterval(interval);
            }, 30); // Faster typing
        }

        window.speechSynthesis.speak(utterance);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl bg-gray-900 border-4 border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col relative h-[80vh]">
                {/* Frame / Header */}
                <div className="h-12 bg-gray-800 flex items-center justify-between px-4 border-b border-gray-700">
                    <h3 className="text-gray-300 font-serif tracking-widest uppercase">Classroom Session</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Blackboard Area */}
                <div className="flex-1 bg-[#1a2c22] relative p-8 font-handwriting text-3xl text-gray-200 overflow-y-auto"
                    id="blackboard-scroll-container"
                    style={{
                        fontFamily: '"Kalam", "Comic Sans MS", cursive',
                        backgroundImage: 'url("https://www.transparenttextures.com/patterns/black-chalkboard.png")',
                    }}>

                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <span className="animate-pulse text-gray-400">Preparing Lesson...</span>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap leading-relaxed w-full">
                            {/* Previous segments matched for context */}
                            {script.slice(0, currentIndex).map(s => (
                                <div key={s.id} className="opacity-30 mb-8 max-w-[80%] transition-opacity duration-500">
                                    {s.visualContent.trim().startsWith('<svg') ? (
                                        <div dangerouslySetInnerHTML={{ __html: s.visualContent }} className="w-full max-w-3xl [&>svg]:w-full [&>svg]:h-auto [&>svg]:drop-shadow-lg" />
                                    ) : (
                                        s.visualContent
                                    )}
                                </div>
                            ))}

                            {/* Current Segment */}
                            {currentIndex >= 0 && currentIndex < script.length && (
                                <div className="mb-4 text-white scroll-mt-4" id={`segment-${currentIndex}`}>
                                    {script[currentIndex].visualContent.trim().startsWith('<svg') ? (
                                        <div
                                            dangerouslySetInnerHTML={{ __html: displayedText }}
                                            className="w-full max-w-3xl animate-fade-in [&>svg]:w-full [&>svg]:h-auto [&>svg]:fill-none [&>svg]:stroke-2 [&>svg]:drop-shadow-md"
                                        />
                                    ) : (
                                        <span>{displayedText}<span className="animate-blink text-neon-blue">|</span></span>
                                    )}
                                </div>
                            )}
                            <div id="scroll-anchor" className="h-4"></div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="h-16 bg-gray-800 border-t border-gray-700 flex items-center justify-center gap-6">
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

                    <div className="h-2 w-full max-w-md bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-neon-green transition-all duration-300"
                            style={{ width: `${((currentIndex) / Math.max(1, script.length)) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
