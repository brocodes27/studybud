import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Mic, MicOff, Loader2, Star, Target, TrendingUp, TrendingDown,
  RotateCcw, CheckCircle2, AlertCircle, Sparkles, Brain, MessageSquare
} from 'lucide-react';
import AIService from '../../lib/aiService';
import { remember } from '../../lib/memory';

interface SessionDebriefProps {
  taskTitle: string;
  subject?: string;
  examType: 'cbse' | 'jee' | 'general';
  sessionData?: {
    elapsedSec: number;
    pauseEvents: { reason: string; timestampSec: number }[];
    stuckEvents: { timestampSec: number; interventionType: string; resolved: boolean }[];
    finalStepIndex: number;
  };
  onSubmit: (data: DebriefData) => void;
  onGenerateCorrectionSprint: () => void;
}

export interface DebriefData {
  confidence: number;
  reflection: string;
  didWell: boolean;
  voiceTranscript: string;
  analysis: string;
}

type DebriefPhase = 'record' | 'review' | 'analyzing' | 'result';

interface AnalysisResult {
  struggles: string[];
  blockers: string[];
  nextSteps: string[];
  summary: string;
  confidenceEstimate: number;
}

export function SessionDebrief({
  taskTitle,
  subject,
  examType,
  sessionData,
  onSubmit,
  onGenerateCorrectionSprint,
}: SessionDebriefProps) {
  const [phase, setPhase] = useState<DebriefPhase>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const interimRef = useRef('');

  const hasSpeechRecognition =
    typeof window !== 'undefined' &&
    (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);

  const startRecording = useCallback(() => {
    if (!hasSpeechRecognition) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      interimRef.current = '';
    };

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) {
        setTranscript((prev) => prev + final + ' ');
      }
      interimRef.current = interim;
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setAnalysisError('Microphone access denied. Please type your reflection below.');
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [hasSpeechRecognition]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    // Append any remaining interim text as best-effort
    if (interimRef.current.trim()) {
      setTranscript((prev) => prev + interimRef.current.trim() + ' ');
      interimRef.current = '';
    }
  }, []);

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setAnalysisError('Please share a reflection before analyzing.');
      return;
    }
    setPhase('analyzing');
    setAnalysisError(null);

    const pauseSummary = sessionData?.pauseEvents
      .map((p) => `${p.reason} at ${Math.round(p.timestampSec / 60)}m`)
      .join(', ') || 'none';

    const stuckSummary = sessionData?.stuckEvents
      .map((s) => `${s.interventionType} (${s.resolved ? 'resolved' : 'unresolved'})`)
      .join(', ') || 'none';

    const prompt = `
You are Ranjan Sir, the student's study mentor. Analyze their focus-session reflection and telemetry.

Task: "${taskTitle}"${subject ? ` (${subject})` : ''}
Exam type: ${examType}
Session elapsed: ${Math.round((sessionData?.elapsedSec ?? 0) / 60)} minutes
Pauses: ${pauseSummary}
Stuck events: ${stuckSummary}

Student voice reflection:
"""
${transcript.trim()}
"""

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "struggles": ["specific concept or topic they found hard"],
  "blockers": ["emotional, motivational, or situational blocker"],
  "nextSteps": ["one concrete actionable next step"],
  "summary": "One sentence capturing the key insight for the knowledge base",
  "confidenceEstimate": 3
}
confidenceEstimate should be 1-5 based on their tone and content.`;

    try {
      const response = await AIService.getInstance().generateChatCompletion(
        prompt,
        'You are a precise JSON-only analyzer. Return ONLY valid JSON.',
        false
      );
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in analysis response');
      const parsed: AnalysisResult = JSON.parse(jsonMatch[0]);
      setAnalysis(parsed);
      setConfidence(parsed.confidenceEstimate);
      setPhase('result');

      // Feed into knowledge base
      remember(
        [
          {
            role: 'user',
            content: `Focus session on ${taskTitle}: ${transcript.trim()}`,
          },
          {
            role: 'assistant',
            content: `Analysis: ${parsed.summary}. Struggles: ${parsed.struggles.join(', ')}. Blockers: ${parsed.blockers.join(', ')}. Next steps: ${parsed.nextSteps.join(', ')}`,
          },
        ],
        {
          source: 'focus_debrief',
          sourceId: taskTitle,
          bookmarkHint: `Struggles in ${taskTitle}: ${parsed.summary}`,
        }
      );
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setAnalysisError('Could not analyze reflection. You can still save and continue.');
      // Still move to result so they can manually rate confidence
      setPhase('result');
    }
  };

  const handleSubmit = () => {
    const didWell = confidence >= 4;
    onSubmit({
      confidence,
      reflection: transcript.trim(),
      didWell,
      voiceTranscript: transcript.trim(),
      analysis: analysis
        ? `Struggles: ${analysis.struggles.join(', ')}. Blockers: ${analysis.blockers.join(', ')}. Next: ${analysis.nextSteps.join(', ')}. ${analysis.summary}`
        : 'No AI analysis available.',
    });
  };

  const didWell = confidence >= 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#8B7355]/10 mb-2">
          <Target className="w-5 h-5 text-[#8B7355]" />
        </div>
        <h3 className="text-lg font-bold text-[#2D2A26]">{taskTitle} — Session End</h3>
        <p className="text-xs text-[#8A8279]">
          {subject ? `${subject} • ` : ''}Tell Ranjan Sir what you faced
        </p>
      </div>

      {/* Phase: Record */}
      {phase === 'record' && (
        <div className="space-y-4">
          <div className="bg-white rounded-[20px] border border-[#2D2A26]/[0.06] p-5 shadow-[0_2px_8px_rgba(45,42,38,0.04)] space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#8B7355]" />
              <span className="text-[10px] font-bold text-[#8B7355] uppercase tracking-wider">
                Voice Reflection
              </span>
            </div>

            <p className="text-sm text-[#3D3833] leading-relaxed">
              Take 30 seconds to tell Ranjan Sir what confused you, where you got stuck, or what felt easy. This feeds directly into your personal knowledge base so future tasks adapt.
            </p>

            {analysisError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{analysisError}</p>
              </div>
            )}

            {/* Voice record button */}
            {hasSpeechRecognition ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    isRecording
                      ? 'bg-red-50 text-red-500 animate-pulse border-2 border-red-200'
                      : 'bg-[#2D2A26] text-white hover:bg-[#3D3833] shadow-[0_4px_16px_rgba(45,42,38,0.12)]'
                  }`}
                >
                  {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  {isRecording && (
                    <span className="absolute -bottom-5 text-[10px] font-bold text-red-500 uppercase tracking-wider">
                      Recording...
                    </span>
                  )}
                </button>
                <p className="text-[11px] text-[#8A8279]">
                  {isRecording ? 'Tap to stop' : 'Tap to record'}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Voice recording is not supported in this browser. Please type your reflection below.
                </p>
              </div>
            )}

            {/* Transcript textarea */}
            <div>
              <label className="text-xs font-bold text-[#2D2A26] mb-1 block">
                {hasSpeechRecognition ? 'Transcript (edit if needed)' : 'Your reflection'}
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="I got stuck when... / The formula for... / I felt confident about..."
                rows={4}
                className="w-full px-3 py-2.5 bg-[#F5F0E8] rounded-xl border border-[#2D2A26]/[0.08] text-sm text-[#2D2A26] placeholder:text-[#8A8279]/60 focus:outline-none focus:border-[#8B7355]/40 resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!transcript.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#2D2A26] hover:bg-[#3D3833] disabled:opacity-40 disabled:hover:bg-[#2D2A26] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(45,42,38,0.12)]"
          >
            <Sparkles className="w-4 h-4" /> Analyze & Continue
          </button>
        </div>
      )}

      {/* Phase: Analyzing */}
      {phase === 'analyzing' && (
        <div className="bg-white rounded-[20px] border border-[#2D2A26]/[0.06] p-8 shadow-[0_2px_8px_rgba(45,42,38,0.04)] text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#8B7355]/10 flex items-center justify-center mx-auto animate-pulse">
            <Loader2 className="w-6 h-6 text-[#8B7355] animate-spin" />
          </div>
          <h4 className="text-base font-bold text-[#2D2A26]">Ranjan Sir is thinking...</h4>
          <p className="text-xs text-[#8A8279] leading-relaxed max-w-xs mx-auto">
            Extracting struggles, blockers, and next steps from your reflection to update your knowledge base.
          </p>
        </div>
      )}

      {/* Phase: Result */}
      {phase === 'result' && (
        <div className="space-y-4">
          <div className="bg-white rounded-[20px] border border-[#2D2A26]/[0.06] p-5 shadow-[0_2px_8px_rgba(45,42,38,0.04)] space-y-4">
            {analysis ? (
              <>
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#8B7355]" />
                  <span className="text-[10px] font-bold text-[#8B7355] uppercase tracking-wider">
                    AI Insight
                  </span>
                </div>

                <div className="space-y-3">
                  {analysis.struggles.length > 0 && (
                    <div className="flex items-start gap-2 p-2.5 bg-red-50/60 rounded-xl border border-red-100">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-red-800 mb-0.5">Struggles detected</p>
                        <p className="text-[11px] text-red-700 leading-relaxed">{analysis.struggles.join(', ')}</p>
                      </div>
                    </div>
                  )}

                  {analysis.blockers.length > 0 && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-amber-800 mb-0.5">Blockers</p>
                        <p className="text-[11px] text-amber-700 leading-relaxed">{analysis.blockers.join(', ')}</p>
                      </div>
                    </div>
                  )}

                  {analysis.nextSteps.length > 0 && (
                    <div className="flex items-start gap-2 p-2.5 bg-[#6B8E6B]/5 rounded-xl border border-[#6B8E6B]/10">
                      <Sparkles className="w-3.5 h-3.5 text-[#6B8E6B] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-[#2D2A26] mb-0.5">Next step</p>
                        <p className="text-[11px] text-[#5D5A56] leading-relaxed">{analysis.nextSteps.join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Could not auto-analyze. Please rate your confidence manually below.
                </p>
              </div>
            )}

            {/* Confidence */}
            <div className="pt-2 border-t border-[#2D2A26]/[0.04]">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-[#B8956A]" />
                <span className="text-[10px] font-bold text-[#B8956A] uppercase tracking-wider">
                  How confident are you?
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setConfidence(n)}
                    className={`flex-1 h-10 rounded-xl text-sm font-bold transition-all border ${
                      confidence === n
                        ? 'bg-[#8B7355] text-white border-[#8B7355] shadow-[0_2px_8px_rgba(139,115,85,0.2)]'
                        : 'bg-[#F5F0E8] text-[#8A8279] border-transparent hover:border-[#8B7355]/20'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-[#8A8279] font-medium px-1 mt-1">
                <span>Lost</span>
                <span>Confident</span>
              </div>
            </div>
          </div>

          {/* Adaptive result card */}
          <div className="bg-white rounded-[20px] border border-[#2D2A26]/[0.06] p-5 shadow-[0_2px_8px_rgba(45,42,38,0.04)] text-center space-y-3">
            {didWell ? (
              <>
                <div className="w-12 h-12 rounded-full bg-[#6B8E6B]/10 flex items-center justify-center mx-auto">
                  <TrendingUp className="w-6 h-6 text-[#6B8E6B]" />
                </div>
                <h4 className="text-base font-bold text-[#2D2A26]">Great work!</h4>
                <p className="text-xs text-[#8A8279] leading-relaxed">
                  Next task will be <span className="font-bold text-[#2D2A26]">harder / shorter / more mixed</span> to keep you in the growth zone.
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-[#B87B6B]/10 flex items-center justify-center mx-auto">
                  <TrendingDown className="w-6 h-6 text-[#B87B6B]" />
                </div>
                <h4 className="text-base font-bold text-[#2D2A26]">Let&apos;s lock this in</h4>
                <p className="text-xs text-[#8A8279] leading-relaxed">
                  We&apos;ll generate a <span className="font-bold text-[#2D2A26]">correction sprint</span> — 2–3 micro tasks targeting the exact spots you struggled with.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSubmit}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#2D2A26] hover:bg-[#3D3833] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(45,42,38,0.12)]"
            >
              <CheckCircle2 className="w-4 h-4" /> Save & Continue
            </button>
            {!didWell && (
              <button
                onClick={() => {
                  handleSubmit();
                  onGenerateCorrectionSprint();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#B87B6B]/10 hover:bg-[#B87B6B]/20 text-[#B87B6B] text-sm font-bold rounded-xl transition-all border border-[#B87B6B]/20"
              >
                <RotateCcw className="w-4 h-4" /> Start Correction Sprint
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
