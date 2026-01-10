import { useState, useEffect } from 'react';
import { X, Trophy, Brain, Target, ArrowRight } from 'lucide-react';

interface LessonInterfaceProps {
  lessonId: string;
  lessonTitle: string;
  lessonType: 'theory' | 'exercise' | 'quiz' | 'review' | 'challenge';
  lessonDescription?: string;
  dayNumber?: number;
  date?: string;
  onComplete: (accuracy: number, xpEarned: number) => void;
  onClose: () => void;
  onStartVoiceLecture?: () => void;
}

export function LessonInterface({
  lessonTitle,
  lessonType,
  lessonDescription,
  dayNumber,
  date,
  onComplete,
  onClose,
  onStartVoiceLecture
}: LessonInterfaceProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [_progress, _setProgress] = useState(0); // Progress animation state
  const [answers, setAnswers] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  const getLessonContent = () => {
    const lessonDate = date ? new Date(date).toLocaleDateString() : '';
    const dayInfo = dayNumber ? `INDEX_DAY_${dayNumber}` : '';

    switch (lessonType) {
      case 'theory':
        return {
          steps: [
            {
              type: 'video',
              title: `MOD_INTRO: ${lessonTitle.toUpperCase()}`,
              content: `DATA_PACKET: ${lessonTitle.toLowerCase()}. ${lessonDescription || 'PRIMARY_THEORY_CORE_V1'}`,
              duration: 120
            },
            {
              type: 'text',
              title: 'CORE_PRIMITIVES',
              content: lessonDescription || `SYSTEM_ARCHITECTURE: ${lessonTitle.toLowerCase()}. EXECUTE_ANALYSIS_ON_PRIMITIVES.`,
              duration: 60
            },
            {
              type: 'interactive',
              title: 'VALIDATION_CHECK',
              content: `QUERY: BASED_ON_ARCHIVE_${lessonTitle.toUpperCase()} [NODE_01], IDENTIFY_CRITICAL_VECTOR:`,
              options: [
                'DEFINITION_PRIME',
                'FIELD_IMPLEMENTATION',
                'SYNTACTIC_FORMULA',
                'LEGACY_CONTEXT'
              ],
              correctAnswer: 1
            }
          ]
        };
      case 'exercise':
        return {
          steps: [
            {
              type: 'problem',
              title: `STRESS_TEST: ${lessonTitle.toUpperCase()}`,
              content: `IMPLEMENT: ${lessonTitle.toLowerCase()}. RESOLVE_FOR_UNKNOWN_VARIABLES.`,
              solution: 'ALGORITHM_SEQUENCE: APPLY_CORE_PRINCIPLES_01 -> COMPILE_RESULTS.',
              duration: 180
            },
            {
              type: 'interactive',
              title: 'STRUCTURAL_MAPPING',
              content: `MAP: ${lessonTitle.toLowerCase()} ATTRIBUTES_TO_DEFINITIONS:`,
              pairs: [
                { term: 'KERNEL_CORE', definition: 'FUNDAMENTAL_PRINCIPLE_01' },
                { term: 'IMPLEMENT_LAYER', definition: 'PRACTICAL_EXECUTION_FLOW' },
                { term: 'MACRO_FORMULA', definition: 'MATHEMATICAL_RELATION_X' }
              ],
              duration: 120
            }
          ]
        };
      case 'quiz':
        return {
          steps: [
            {
              type: 'question',
              title: 'QUERY_STREAM_01/03',
              content: `VECTOR_PRIMARY: ${lessonTitle.toLowerCase()}?`,
              options: ['THEORETIC_CORE', 'PRACTICAL_IO', 'CHRONO_HISTORY', 'APP_LAYER'],
              correctAnswer: 0
            },
            {
              type: 'question',
              title: 'QUERY_STREAM_02/03',
              content: `EXAM_WEIGHT_CRITICALITY: ${lessonTitle.toLowerCase()}?`,
              options: ['BUFFER_MEMORIZATION', 'DEEP_LOGIC_SYNC', 'IO_VELOCITY', 'CREATIVE_SYNTHESIS'],
              correctAnswer: 1
            },
            {
              type: 'question',
              title: 'QUERY_STREAM_03/03',
              content: `REALTIME_DEPLOYMENT: ${lessonTitle.toLowerCase()}?`,
              options: ['LINEAR_DEPLOY', 'ADAPTIVE_LAYER_REQ', 'NULL_VALUE', 'CONTEXT_DEPENDENT'],
              correctAnswer: 3
            }
          ]
        };
      default:
        return {
          steps: [
            {
              type: 'text',
              title: lessonTitle.toUpperCase(),
              content: lessonDescription || `CHAMBER_SESSION: ${lessonTitle.toLowerCase()}. ${dayInfo} ${lessonDate ? `[${lessonDate}]` : ''}`,
              duration: 30
            },
            {
              type: 'text',
              title: 'ATTENTION_FOCUS',
              content: `LOG: UNDERSTAND_CORE_MODS [${lessonTitle.toLowerCase()}]. SYNC_WITH_PREVIOUS_DATA_STREAMS.`,
              duration: 45
            },
            {
              type: 'interactive',
              title: 'RETROSPECTIVE',
              content: `LOG_ENTRY: ${lessonTitle.toLowerCase()} ACQUISITION_DATA:`,
              options: ['CORE_MODS', 'PRACTICAL_IO', 'OPTIMIZATION_REQUIRED', 'SYNC_COMPLETE'],
              correctAnswer: 3
            }
          ]
        };
    }
  };

  const lessonContent = getLessonContent();
  const totalSteps = lessonContent.steps.length;

  useEffect(() => {
    const timer = setInterval(() => {
      _setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 1;
      });
    }, 100);

    return () => clearInterval(timer);
  }, []);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeLesson();
    }
  };

  const handleAnswer = (answer: string | number) => {
    if (answer === 'voice_lecture') {
      onClose();
      if (onStartVoiceLecture) {
        onStartVoiceLecture();
      }
    } else {
      setAnswers([...answers, answer.toString()]);
      handleNext();
    }
  };

  const completeLesson = () => {
    const accuracy = Math.random() * 40 + 60;
    const xpEarned = Math.floor(accuracy / 10) + 10;
    setIsCompleted(true);
    onComplete(accuracy, xpEarned);
  };

  const renderStep = (step: any) => {
    switch (step.type) {
      case 'video':
        return (
          <div className="text-center space-y-8">
            <div className="w-full h-64 bg-black border-4 border-black flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-4 left-4 bg-neo-accent text-white px-3 py-1 font-black text-[10px] uppercase italic rotate-2 border-2 border-black">
                STREAM_LIVE
              </div>
              <div className="bg-neo-secondary border-4 border-black p-6 rotate-12 -translate-y-2">
                <Brain className="h-16 w-16 text-black stroke-[4px]" />
              </div>
              <div className="text-white font-black uppercase tracking-widest text-xs mt-4">NEURAL_DECODER_ACTIVE</div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-black mb-4 uppercase italic tracking-tighter">VOICE_SESSION_PROTOCOL</h3>
              <p className="text-black font-bold uppercase tracking-widest text-sm mb-10 italic">INTERACT_WITH_AI_TUTOR_FOR_DEEP_SYNC</p>
              <div className="bg-neo-bg border-4 border-black p-4 inline-block font-black text-xs uppercase tracking-widest mb-10">EXPECTED_DURATION: {step.duration}S</div>
              <button
                onClick={() => handleAnswer('voice_lecture')}
                className="w-full bg-black text-white py-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-accent hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000]"
              >
                INITIALIZE_VOICE_LECTURE
              </button>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-8">
            <h3 className="text-4xl font-black text-black uppercase tracking-tighter italic border-b-4 border-black pb-4">{step.title}</h3>
            <div className="bg-white border-4 border-black p-8 shadow-[10px_10px_0px_0px_#000] rotate-1">
              <p className="text-2xl font-black text-black leading-relaxed italic uppercase tracking-tight">{step.content}</p>
            </div>
            <div className="bg-neo-secondary px-4 py-1 inline-block border-2 border-black font-black uppercase text-[10px] tracking-widest -rotate-2">READ_INDEX_EST: {step.duration}S</div>
          </div>
        );

      case 'interactive':
      case 'question':
        return (
          <div className="space-y-8">
            <h3 className="text-3xl font-black text-black uppercase tracking-tighter italic border-b-4 border-black pb-4">{step.title}</h3>
            <p className="text-xl font-black text-black italic uppercase leading-tight">{step.content}</p>
            {step.options ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {step.options.map((option: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className="group text-left p-8 border-4 border-black bg-white font-black uppercase tracking-tighter italic text-xl transition-all shadow-[6px_6px_0px_0px_#000] hover:bg-neo-secondary hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_#000]"
                  >
                    <span className="inline-block bg-black text-white px-3 py-1 mr-4 -rotate-12 border-2 border-black transition-transform group-hover:scale-110">{String.fromCharCode(65 + idx)}</span>
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {step.pairs?.map((pair: any, idx: number) => (
                  <div key={idx} className="flex flex-col md:flex-row md:items-center gap-6 p-6 border-4 border-black bg-white shadow-[6px_6px_0px_0px_#000] font-black uppercase italic tracking-tighter">
                    <span className="bg-black text-white px-4 py-1 -rotate-2">{pair.term}</span>
                    <ArrowRight className="h-6 w-6 stroke-[4px]" />
                    <span className="text-xl">{pair.definition}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'problem':
        return (
          <div className="space-y-8">
            <h3 className="text-3xl font-black text-black uppercase tracking-tighter italic border-b-4 border-black pb-4">{step.title}</h3>
            <div className="bg-neo-accent text-white p-8 border-4 border-black shadow-[10px_10px_0px_0px_#000] -rotate-1">
              <p className="text-2xl font-black uppercase italic tracking-tighter">{step.content}</p>
            </div>
            <div className="bg-neo-secondary p-6 border-4 border-black shadow-[6px_6px_0px_0px_#000] rotate-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-3 italic">COMPILE_OUTPUT:</p>
              <p className="text-xl font-black text-black uppercase italic tracking-tight">{step.solution}</p>
            </div>
          </div>
        );

      default:
        return <div className="font-black uppercase text-4xl italic">UNKNOWN_NODE_TYPE</div>;
    }
  };

  if (isCompleted) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[2px]">
        <div className="bg-white border-8 border-black p-12 max-w-xl w-full mx-4 text-center shadow-[24px_24px_0px_0px_#000] rotate-1">
          <div className="bg-neo-secondary border-4 border-black p-8 rounded-none mb-10 inline-block shadow-[10px_10px_0px_0px_#000] -rotate-12">
            <Trophy className="h-20 w-20 text-black stroke-[3px]" />
          </div>
          <h2 className="text-5xl font-black text-black mb-10 uppercase tracking-tighter italic leading-none">SEQUENCE_COMPLETE</h2>

          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000] rotate-2">
              <p className="text-4xl font-black text-neo-accent italic">+{Math.floor(Math.random() * 20) + 10}XP</p>
              <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">NODAL_XP_GAIN</p>
            </div>
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000] -rotate-2">
              <p className="text-4xl font-black text-neo-secondary italic">{Math.floor(Math.random() * 40) + 60}%</p>
              <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">ACCURACY_INDEX</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-black text-white py-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-secondary hover:text-black hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#4D96FF] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000]"
          >
            CONTINUE_LEARNING
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-[4px] p-4">
      <div className="bg-white border-8 border-black max-w-4xl w-full max-h-[90vh] flex flex-col shadow-[32px_32px_0px_0px_#000]">
        {/* Header */}
        <div className="p-10 border-b-8 border-black bg-white">
          <div className="flex items-start justify-between mb-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-black text-black uppercase tracking-tighter italic leading-none">{lessonTitle}</h2>
              <div className="flex items-center gap-4">
                {dayNumber && (
                  <span className="bg-black text-white px-4 py-1 font-black uppercase text-xs tracking-widest -rotate-2 shadow-[4px_4px_0px_0px_#FF6B6B]">
                    DAY_{dayNumber}
                  </span>
                )}
                {date && (
                  <span className="text-sm font-black text-black/40 uppercase tracking-widest italic">
                    [{new Date(date).toLocaleDateString()}]
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-white border-4 border-black p-2 hover:bg-neo-accent hover:text-white transition-all shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <X className="h-8 w-8 stroke-[4px]" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-black/5 border-4 border-black h-10 relative overflow-hidden">
            <div
              className="bg-neo-accent h-full transition-all duration-300 border-r-4 border-black shadow-[4px_0_10px_rgba(0,0,0,0.1)]"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-between px-6 font-black uppercase text-xs tracking-[0.3em] overflow-hidden pointer-events-none">
              <span className="text-black">STEP_{currentStep + 1}_OF_{totalSteps}</span>
              <span className="text-black">{Math.round(((currentStep + 1) / totalSteps) * 100)}%_SYNC</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-10 flex-grow overflow-y-auto custom-scrollbar bg-neo-bg/5">
          {lessonContent.steps[currentStep] && renderStep(lessonContent.steps[currentStep])}
        </div>

        {/* Footer */}
        <div className="p-10 border-t-8 border-black bg-white flex flex-col md:flex-row justify-between items-center gap-8">
          <button
            onClick={onClose}
            className="w-full md:w-auto px-10 py-4 font-black uppercase italic tracking-tighter text-2xl hover:bg-neo-muted transition-all flex items-center gap-4"
          >
            [ EXIT_SESSION ]
          </button>
          <button
            onClick={handleNext}
            className="w-full md:w-auto px-16 py-6 bg-black text-white border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-accent hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000] flex items-center justify-center gap-6"
          >
            {currentStep === totalSteps - 1 ? (
              <>COM_PLETE <Target className="h-8 w-8" /></>
            ) : (
              <>SYNC_NEXT <ArrowRight className="h-8 w-8 stroke-[4px]" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LessonInterface;