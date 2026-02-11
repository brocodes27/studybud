import { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle, X, Trophy, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { usePayment } from '../hooks/usePayment';
import { FeatureGate } from './FeatureGate';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

interface PracticeTest {
  id: string;
  title: string;
  subject: string;
  questions: Question[];
  total_questions: number;
  duration_minutes: number;
}

interface TestAttempt {
  id: string;
  score: number;
  total_questions: number;
  time_taken_minutes: number;
  completed_at: string;
}

interface StudyPlan {
  id: string;
  subject: string;
  class: string;
  chapters: string;
  exam_date: string;
}

interface PracticeTestEngineProps {
  planId?: string;
  subject?: string;
}

export function PracticeTestEngine({ planId }: PracticeTestEngineProps) {
  const { user, session } = useAuth() as any;
  const { showToast } = useToast();
  const { initiatePayment } = usePayment();
  const [tests, setTests] = useState<PracticeTest[]>([]);
  const [currentTest, setCurrentTest] = useState<PracticeTest | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [availablePlans, setAvailablePlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTests();
      fetchAttempts();
      fetchAvailablePlans();
    }
  }, [user, planId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            submitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);


  const fetchAvailablePlans = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_plans')
        .select('id, subject, class, chapters, exam_date')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailablePlans(data || []);

      if (!planId && data && data.length > 0) {
        setSelectedPlan(data[0].id);
      } else if (planId) {
        setSelectedPlan(planId);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchTests = async () => {
    try {
      let query = supabase
        .from('practice_tests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (planId) {
        query = query.eq('plan_id', planId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setTests(data || []);
    } catch (error) {
      console.error('Error fetching tests:', error);
      showToast('Failed to load practice tests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempts = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_test_attempts')
        .select('*')
        .eq('user_id', user?.id)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAttempts(data || []);
    } catch (error) {
      console.error('Error fetching attempts:', error);
    }
  };

  const generateTest = async () => {
    const activePlanId = selectedPlan || planId;
    if (!activePlanId) {
      showToast('Please select a study plan to generate practice test', 'error');
      return;
    }

    const selectedPlanData = availablePlans.find(plan => plan.id === activePlanId);
    if (!selectedPlanData) {
      showToast('Selected study plan not found', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-practice-test`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          subject: selectedPlanData.subject,
          class: selectedPlanData.class,
          chapters: selectedPlanData.chapters,
          plan_id: activePlanId,
          question_count: 20,
          duration_minutes: 30
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate practice test';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText;
            }
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const newTest = await response.json();
      setTests(prev => [newTest, ...prev]);
      showToast('Practice test generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating test:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate practice test';
      showToast(errorMessage, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const startTest = (test: PracticeTest) => {
    setCurrentTest(test);
    setCurrentQuestion(0);
    setAnswers(new Array(test.total_questions).fill(-1));
    setTimeLeft(test.duration_minutes * 60);
    setIsActive(true);
    setShowResults(false);
  };

  const selectAnswer = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
  };

  const nextQuestion = () => {
    if (currentQuestion < (currentTest?.total_questions || 0) - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitTest = async () => {
    if (!currentTest) return;

    setIsActive(false);

    let correct = 0;
    currentTest.questions.forEach((question, index) => {
      if (answers[index] === question.correct_answer) {
        correct++;
      }
    });

    const score = correct;
    const timeTaken = Math.ceil((currentTest.duration_minutes * 60 - timeLeft) / 60);

    try {
      const { error } = await supabase
        .from('practice_test_attempts')
        .insert({
          user_id: user?.id,
          test_id: currentTest.id,
          answers: answers,
          score: score,
          total_questions: currentTest.total_questions,
          time_taken_minutes: timeTaken
        });

      if (error) throw error;

      setTestResults({
        score,
        total: currentTest.total_questions,
        percentage: Math.round((score / currentTest.total_questions) * 100),
        timeTaken,
        questions: currentTest.questions,
        userAnswers: answers
      });

      setShowResults(true);
      fetchAttempts();
      showToast(`Test completed! Score: ${score}/${currentTest.total_questions}`, 'success');
    } catch (error) {
      console.error('Error saving test attempt:', error);
      showToast('Failed to save test results', 'error');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-neo-secondary';
    if (percentage >= 60) return 'text-neo-bg';
    return 'text-neo-accent';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-8 text-black">
        <div className="w-20 h-20 border-8 border-black border-t-neo-accent animate-spin" />
        <h3 className="text-2xl font-black uppercase tracking-tighter italic">LOADING_CHAMBERS...</h3>
      </div>
    );
  }

  if (showResults && testResults) {
    return (
      <div className="p-10 space-y-10 bg-neo-bg/10 min-h-full">
        {/* Results Header */}
        <div className="bg-white border-8 border-black p-12 text-center shadow-[20px_20px_0px_0px_#000] rotate-1">
          <div className="bg-neo-secondary border-4 border-black p-6 rounded-none mb-8 inline-block shadow-[8px_8px_0px_0px_#000] -rotate-12">
            <Trophy className="h-20 w-20 text-black stroke-[3px]" />
          </div>
          <h3 className="text-5xl font-black text-black mb-10 uppercase tracking-tighter italic leading-none">EXAM_SEQUENCE_COMPLETE</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000]">
              <p className={`text-6xl font-black ${getScoreColor(testResults.percentage)} italic`}>
                {testResults.score}/{testResults.total}
              </p>
              <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">TOTAL_SCORE</p>
            </div>
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000] rotate-2">
              <p className="text-6xl font-black text-neo-accent italic">{testResults.percentage}%</p>
              <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">ACCURACY_INDEX</p>
            </div>
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000] -rotate-2">
              <p className="text-6xl font-black text-neo-muted italic">{testResults.timeTaken}M</p>
              <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">TIME_EXPENDED</p>
            </div>
          </div>
        </div>

        {/* Question Review */}
        <div className="bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_#000]">
          <h4 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-8 border-b-4 border-black pb-4">RETROSPECTIVE_ANALYSIS</h4>
          <div className="space-y-8 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
            {testResults.questions.map((question: Question, index: number) => {
              const userAnswer = testResults.userAnswers[index];
              const isCorrect = userAnswer === question.correct_answer;

              return (
                <div key={index} className={`p-8 border-4 border-black shadow-[6px_6px_0px_0px_#000] ${isCorrect ? 'bg-neo-secondary/30' : 'bg-neo-accent/10'}`}>
                  <div className="flex items-start gap-6">
                    <div className={`p-2 border-2 border-black ${isCorrect ? 'bg-neo-secondary' : 'bg-neo-accent'} -rotate-12`}>
                      {isCorrect ? <CheckCircle className="h-6 w-6 text-black stroke-[4px]" /> : <X className="h-6 w-6 text-white stroke-[4px]" />}
                    </div>
                    <div className="flex-grow">
                      <p className="text-xl font-black text-black uppercase tracking-tight italic mb-6 leading-tight">{question.question}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className={`p-4 border-2 border-black font-black uppercase text-xs tracking-widest ${optionIndex === question.correct_answer
                            ? 'bg-neo-secondary'
                            : optionIndex === userAnswer && !isCorrect
                              ? 'bg-neo-accent text-white'
                              : 'bg-white text-black/40'
                            }`}>
                            {String.fromCharCode(65 + optionIndex)}. {option}
                          </div>
                        ))}
                      </div>

                      {/* AI Explanation Gate */}
                      <div className="mt-8 pt-8 border-t-4 border-black/10">
                        <FeatureGate fallback="blur" featureName="AI Logic Breakdown">
                          <div className="bg-white border-4 border-black p-6 relative">
                            <div className="absolute -top-3 left-4 bg-black text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">AI_LOGIC_CORE</div>
                            <p className="font-bold text-sm leading-relaxed text-black/80">
                              {question.explanation || "Detailed neural analysis reveals the logical pathway to the correct answer involves identifying key constraints in the problem statement..."}
                            </p>
                          </div>
                        </FeatureGate>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <button
            onClick={() => {
              setShowResults(false);
              setCurrentTest(null);
            }}
            className="flex-1 bg-black text-white py-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-accent hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000]"
          >
            TERMINATE_SESSION
          </button>
          <button
            onClick={() => startTest(currentTest!)}
            className="flex-1 bg-white text-black py-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-secondary hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#4D96FF] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000]"
          >
            REBOOT_SEQUENCE
          </button>
        </div>
      </div>
    );
  }

  if (currentTest && isActive) {
    const question = currentTest.questions[currentQuestion];

    return (
      <div className="p-10 space-y-12 bg-white border-l-8 border-black min-h-full">
        {/* Test Header */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
          <div>
            <h3 className="text-4xl font-black text-black uppercase tracking-tighter italic leading-none">{currentTest.title.toUpperCase()}</h3>
            <p className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] mt-3">DEPLOYED_INDEX: {currentQuestion + 1} / {currentTest.total_questions}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className={`
                px-8 py-4 border-4 border-black font-black text-4xl italic tabular-nums shadow-[6px_6px_0px_0px_#000] rotate-2
                ${timeLeft < 300 ? 'bg-neo-accent text-white' : 'bg-neo-secondary'}
            `}>
              <Clock className="h-8 w-8 inline mr-3 stroke-[4px]" />
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-black/5 border-4 border-black h-8 relative overflow-hidden">
          <div
            className="bg-neo-accent h-full transition-all duration-300 border-r-4 border-black shadow-[4px_0_10px_rgba(0,0,0,0.1)]"
            style={{ width: `${((currentQuestion + 1) / currentTest.total_questions) * 100}%` }}
          ></div>
        </div>

        {/* Question */}
        <div className="bg-white border-8 border-black p-12 shadow-[20px_20px_0px_0px_#000] -rotate-1 relative">
          <div className="absolute -top-6 left-10 bg-black text-white px-6 py-2 font-black uppercase text-xs tracking-[0.3em] rotate-1">
            QUERY_PACKET_{currentQuestion + 1}
          </div>
          <h4 className="text-3xl font-black text-black mb-12 uppercase tracking-tight italic leading-snug">{question.question}</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => selectAnswer(index)}
                className={`
                    w-full text-left p-8 border-4 border-black font-black uppercase tracking-tighter italic text-xl transition-all duration-200 
                    ${answers[currentQuestion] === index
                    ? 'bg-neo-secondary shadow-none translate-x-1 translate-y-1'
                    : 'bg-white shadow-[6px_6px_0px_0px_#000] hover:bg-neo-bg hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_#000]'
                  }
                `}
              >
                <span className="inline-block bg-black text-white px-3 py-1 mr-4 -rotate-12 border-2 border-black">{String.fromCharCode(65 + index)}</span>
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-10 border-t-4 border-black pt-10">
          <button
            onClick={previousQuestion}
            disabled={currentQuestion === 0}
            className="w-full md:w-auto bg-white border-4 border-black px-10 py-4 font-black uppercase italic tracking-tighter text-xl hover:bg-neo-muted disabled:opacity-20 transition-all shadow-[6px_6px_0px_0px_#000]"
          >
            REVERT_INPUT
          </button>

          <div className="flex gap-3 flex-wrap justify-center max-w-[50%]">
            {Array.from({ length: currentTest.total_questions }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQuestion(i)}
                className={`
                    w-10 h-10 border-4 border-black font-black text-sm flex items-center justify-center transition-all
                    ${i === currentQuestion
                    ? 'bg-black text-white shadow-[4px_4px_0px_0px_#FF6B6B] -translate-y-1'
                    : answers[i] !== -1
                      ? 'bg-neo-secondary shadow-none'
                      : 'bg-white hover:bg-neo-bg shadow-[2px_2px_0px_0px_#000]'
                  }
                `}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {currentQuestion === currentTest.total_questions - 1 ? (
            <button
              onClick={submitTest}
              className="w-full md:w-auto bg-black text-white px-10 py-4 border-4 border-black font-black uppercase italic tracking-tighter text-xl hover:bg-neo-accent hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000]"
            >
              FINAL_UPLOAD
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="w-full md:w-auto bg-black text-white px-10 py-4 border-4 border-black font-black uppercase italic tracking-tighter text-xl hover:bg-neo-accent hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000]"
            >
              COMMIT_NEXT
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedPlanData = availablePlans.find(plan => plan.id === (selectedPlan || planId));

  return (
    <div className="p-10 space-y-12 relative bg-neo-bg/10 min-h-full">
      {/* Header */}
      <div className="flex items-center gap-6">
        <div className="bg-neo-secondary border-4 border-black p-4 shadow-[6px_6px_0px_0px_#000] rotate-3">
          <FileText className="h-10 w-10 text-black stroke-[3px]" />
        </div>
        <div>
          <h3 className="text-4xl font-black text-black uppercase tracking-tighter italic leading-none">TEST_CHAMBER</h3>
          <p className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] mt-2 italic">PROTOCOL: VALIDATION_INTERFACE</p>
        </div>
      </div>

      {/* Plan Selection and Generation */}
      <div className="bg-white border-8 border-black p-10 shadow-[16px_16px_0px_0px_#000] rotate-1">
        <h4 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-8 border-b-4 border-black pb-4">GENERATE_EXAM_PACKET</h4>

        <div className="space-y-10">
          {!planId && availablePlans.length > 0 && (
            <div className="space-y-4">
              <label className="text-[10px] font-black text-black uppercase tracking-[0.2em] italic">SOURCE_PLAN</label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full bg-white border-4 border-black px-6 py-4 font-black text-xl italic focus:bg-neo-secondary outline-none transition-all shadow-[6px_6px_0px_0px_#000]"
              >
                <option value="">SELECT SOURCE...</option>
                {availablePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.subject.toUpperCase()} - CLASS_{plan.class}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedPlanData && (
            <div className="bg-neo-secondary/10 border-4 border-black p-6 -rotate-1">
              <h5 className="font-black text-black uppercase tracking-widest text-xs mb-4">PACKET_PARAMETERS</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-[10px] font-black uppercase tracking-widest">
                <div className="flex flex-col gap-1">
                  <span className="text-black/40 italic">SUBJECT:</span>
                  <span className="text-black text-lg font-black italic">{selectedPlanData.subject}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-black/40 italic">CLASS:</span>
                  <span className="text-black text-lg font-black italic">{selectedPlanData.class}</span>
                </div>
                <div className="col-span-2 md:col-span-1 flex flex-col gap-1">
                  <span className="text-black/40 italic">CONSTRAINTS:</span>
                  <span className="text-black text-lg font-black italic truncate">{selectedPlanData.chapters}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={generateTest}
            disabled={isGenerating || (!selectedPlan && !planId)}
            className="w-full bg-black text-white py-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-accent hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000] disabled:opacity-50 flex items-center justify-center gap-6"
          >
            {isGenerating ? (
              <>
                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                PROCESSING_PACKET...
              </>
            ) : (
              <>
                <Target className="h-10 w-10 stroke-[4px]" />
                COMPILED_TEST (20Q / 30M)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Available Tests */}
      {tests.length === 0 ? (
        <div className="bg-white border-8 border-black p-20 text-center shadow-[16px_16px_0px_0px_#000] rotate-1">
          <FileText className="h-20 w-20 text-black/10 mx-auto mb-8" />
          <h4 className="text-4xl font-black text-black uppercase tracking-tighter italic mb-4">CHAMBER_EMPTY</h4>
          <p className="text-black font-bold uppercase tracking-widest text-sm mb-10 leading-relaxed">NO ACTIVE TEST PACKETS FOUND. INITIALIZE GENERATION PROTOCOL.</p>
        </div>
      ) : (
        <div>
          <h4 className="text-3xl font-black text-black uppercase tracking-tighter italic mb-10 border-b-4 border-black pb-4">ACTIVE_CHAMBERS</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {tests.map((test, idx) => (
              <div key={test.id} className={`
                bg-white border-4 border-black p-8 shadow-[10px_10px_0px_0px_#000] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[14px_14px_0px_0px_#000]
                ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}
              `}>
                <h4 className="text-3xl font-black text-black mb-2 uppercase tracking-tight italic leading-none">{test.title}</h4>
                <p className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] mb-8 italic">{test.subject}</p>

                <div className="grid grid-cols-2 gap-4 mb-10">
                  <div className="bg-neo-bg p-3 border-2 border-black flex items-center gap-3 font-black uppercase text-[10px] tracking-widest">
                    <Target className="h-5 w-5 stroke-[3px]" /> {test.total_questions} NODES
                  </div>
                  <div className="bg-neo-bg p-3 border-2 border-black flex items-center gap-3 font-black uppercase text-[10px] tracking-widest">
                    <Clock className="h-5 w-5 stroke-[3px]" /> {test.duration_minutes} MINS
                  </div>
                </div>

                <button
                  onClick={() => startTest(test)}
                  className="w-full bg-black text-white py-4 border-4 border-black font-black uppercase italic tracking-tighter text-2xl hover:bg-neo-accent transition-all shadow-[6px_6px_0px_0px_#FF6B6B]"
                >
                  INITIALIZE_CHAMBER
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Attempts */}
      {attempts.length > 0 && (
        <div className="bg-white border-4 border-black p-10 shadow-[12px_12px_0px_0px_#000]">
          <h4 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-8 border-b-4 border-black pb-4">MISSION_LOG</h4>
          <div className="space-y-6">
            {attempts.slice(0, 5).map((attempt, idx) => (
              <div key={attempt.id} className={`
                flex flex-col md:flex-row items-center justify-between p-6 border-4 border-black transition-all hover:bg-neo-bg/50
                ${idx % 2 === 0 ? '-rotate-[0.5deg]' : 'rotate-[0.5deg]'}
              `}>
                <div className="flex items-center gap-8 mb-4 md:mb-0">
                  <div className="bg-black text-white p-3 border-2 border-black">
                    <FileText className="h-6 w-6 stroke-[3px]" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-black uppercase italic leading-none">
                      SCORE: <span className={getScoreColor(Math.round((attempt.score / attempt.total_questions) * 100))}>{attempt.score}/{attempt.total_questions}</span>
                    </p>
                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">{new Date(attempt.completed_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-10">
                  <div className="flex flex-col items-end">
                    <p className={`text-4xl font-black italic leading-none ${getScoreColor(Math.round((attempt.score / attempt.total_questions) * 100))}`}>
                      {Math.round((attempt.score / attempt.total_questions) * 100)}%
                    </p>
                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">{attempt.time_taken_minutes}M EXPENDED</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}