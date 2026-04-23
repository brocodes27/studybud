import { KnowledgeTracingService } from "../lib/knowledgeTracing";

import { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle, X, Trophy, Target, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
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
          if (prev <= 1) { submitTest(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const fetchAvailablePlans = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_plans').select('id, subject, class, chapters, exam_date')
        .eq('user_id', user?.id).order('created_at', { ascending: false });
      if (error) throw error;
      setAvailablePlans(data || []);
      if (!planId && data && data.length > 0) setSelectedPlan(data[0].id);
      else if (planId) setSelectedPlan(planId);
    } catch (error) { console.error('Error fetching plans:', error); }
  };

  const fetchTests = async () => {
    try {
      let query = supabase.from('practice_tests').select('*').eq('user_id', user?.id).order('created_at', { ascending: false });
      if (planId) query = query.eq('plan_id', planId);
      const { data, error } = await query;
      if (error) throw error;
      setTests(data || []);
    } catch (error) {
      console.error('Error fetching tests:', error);
      showToast('Failed to load practice tests', 'error');
    } finally { setLoading(false); }
  };

  const fetchAttempts = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_test_attempts').select('*').eq('user_id', user?.id)
        .order('completed_at', { ascending: false }).limit(10);
      if (error) throw error;
      setAttempts(data || []);
    } catch (error) { console.error('Error fetching attempts:', error); }
  };

  const generateTest = async () => {
    const activePlanId = selectedPlan || planId;
    if (!activePlanId) { showToast('Please select a study plan', 'error'); return; }
    const selectedPlanData = availablePlans.find(plan => plan.id === activePlanId);
    if (!selectedPlanData) { showToast('Study plan not found', 'error'); return; }

    setIsGenerating(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-practice-test`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          subject: selectedPlanData.subject, class: selectedPlanData.class, chapters: selectedPlanData.chapters,
          plan_id: activePlanId, question_count: 20, duration_minutes: 30
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate practice test';
        try { const errorData = await response.json(); errorMessage = errorData.error || errorData.message || errorMessage; }
        catch { try { const errorText = await response.text(); if (errorText) errorMessage = errorText; } catch { errorMessage = `HTTP ${response.status}: ${response.statusText}`; } }
        throw new Error(errorMessage);
      }

      const newTest = await response.json();
      setTests(prev => [newTest, ...prev]);
      showToast('Practice test generated!', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate practice test';
      showToast(errorMessage, 'error');
    } finally { setIsGenerating(false); }
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

  const nextQuestion = () => { if (currentQuestion < (currentTest?.total_questions || 0) - 1) setCurrentQuestion(prev => prev + 1); };
  const previousQuestion = () => { if (currentQuestion > 0) setCurrentQuestion(prev => prev - 1); };

  const submitTest = async () => {
    if (!currentTest) return;
    setIsActive(false);
    let correct = 0;
    
    // Log interactions to BKT engine (fire and forget to not block UI)
    currentTest.questions.forEach((question, index) => { 
      const isCorrect = answers[index] === question.correct_answer;
      if (isCorrect) correct++; 
      
      // Attempt BKT logging if we have a KC assigned to this question (some might be legacy)
      // Usually the DB returns kc_id if it's there. For now, we simulate using subject/topic mapping later
      // if kc_id is not directly on the question object. We'll pass question id for the edge function to map.
      KnowledgeTracingService.logInteraction(
        question.id, // edge function can resolve to kc_id if it's a UUID
        isCorrect,
        Math.floor(((currentTest.duration_minutes * 60) - timeLeft) * 1000 / currentTest.total_questions), // very rough average time
        'practice_test',
        { test_id: currentTest.id, question_index: index }
      ).catch(console.error);
    });

    const score = correct;
    const timeTaken = Math.ceil((currentTest.duration_minutes * 60 - timeLeft) / 60);

    try {
      const { error } = await supabase.from('practice_test_attempts').insert({
        user_id: user?.id, test_id: currentTest.id, answers, score,
        total_questions: currentTest.total_questions, time_taken_minutes: timeTaken
      });
      if (error) throw error;
      setTestResults({ score, total: currentTest.total_questions, percentage: Math.round((score / currentTest.total_questions) * 100), timeTaken, questions: currentTest.questions, userAnswers: answers });
      setShowResults(true);
      fetchAttempts();
      showToast(`Test completed! Score: ${score}/${currentTest.total_questions}`, 'success');
    } catch (error) { showToast('Failed to save test results', 'error'); }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-[#34D399]';
    if (percentage >= 60) return 'text-[#00D1FF]';
    return 'text-[#F472B6]';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <div className="w-10 h-10 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
        <p className="text-sm font-bold text-[#64748B]">Loading tests...</p>
      </div>
    );
  }

  if (showResults && testResults) {
    return (
      <div className="p-6 space-y-6">
        {/* Results Header */}
        <div className="neo-card text-center py-10">
          <div className="w-20 h-20 bg-[#34D399]/10 border border-[#34D399]/20 rounded-[20px] flex items-center justify-center mx-auto mb-6">
            <Trophy className="h-10 w-10 text-[#34D399]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#0A192F] mb-8 tracking-tight">Test Complete!</h3>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Score', value: `${testResults.score}/${testResults.total}`, color: getScoreColor(testResults.percentage) },
              { label: 'Accuracy', value: `${testResults.percentage}%`, color: getScoreColor(testResults.percentage) },
              { label: 'Time', value: `${testResults.timeTaken}m`, color: 'text-[#64748B]' },
            ].map((stat, i) => (
              <div key={i} className="bg-[#F8FAFF] rounded-[16px] border-2 border-[#0A192F]/5 p-4">
                <p className={`text-3xl font-extrabold ${stat.color} tracking-tight`}>{stat.value}</p>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Question Review */}
        <div className="neo-card">
          <h4 className="text-lg font-extrabold text-[#0A192F] mb-6 tracking-tight">Review Answers</h4>
          <div className="space-y-5 max-h-[500px] overflow-y-auto pr-2">
            {testResults.questions.map((question: Question, index: number) => {
              const userAnswer = testResults.userAnswers[index];
              const isCorrect = userAnswer === question.correct_answer;
              return (
                <div key={index} className={`rounded-[16px] border-2 p-5 ${isCorrect ? 'bg-[#34D399]/5 border-[#34D399]/20' : 'bg-[#F472B6]/5 border-[#F472B6]/20'}`}>
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isCorrect ? 'bg-[#34D399]/10' : 'bg-[#F472B6]/10'}`}>
                      {isCorrect ? <CheckCircle className={`h-5 w-5 text-[#34D399]`} /> : <X className={`h-5 w-5 text-[#F472B6]`} />}
                    </div>
                    <p className="font-semibold text-[#0A192F] text-sm leading-relaxed">{question.question}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-11">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className={`px-3 py-2 rounded-[10px] text-sm font-medium ${optionIndex === question.correct_answer ? 'bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30' : optionIndex === userAnswer && !isCorrect ? 'bg-[#F472B6]/15 text-[#F472B6] border border-[#F472B6]/30' : 'text-[#64748B]'}`}>
                        <span className="font-bold mr-2">{String.fromCharCode(65 + optionIndex)}.</span>{option}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 ml-11">
                    <FeatureGate fallback="blur" featureName="AI Logic Breakdown">
                      <div className="bg-[#F8FAFF] rounded-[12px] p-4 border-2 border-[#0A192F]/5">
                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Explanation</p>
                        <p className="text-sm font-medium text-[#0A192F] leading-relaxed">
                          {question.explanation || "Detailed analysis reveals the logical pathway to the correct answer involves identifying key constraints in the problem statement."}
                        </p>
                      </div>
                    </FeatureGate>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={() => { setShowResults(false); setCurrentTest(null); }} className="flex-1 py-3 rounded-[12px] border-2 border-[#0A192F]/10 text-[#64748B] font-bold hover:border-[#0A192F]/20 transition-colors">
            Back to Tests
          </button>
          <button onClick={() => startTest(currentTest!)} className="flex-1 neo-button py-3">
            Retake Test
          </button>
        </div>
      </div>
    );
  }

  if (currentTest && isActive) {
    const question = currentTest.questions[currentQuestion];
    return (
      <div className="p-6 space-y-6">
        {/* Test Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight">{currentTest.title}</h3>
            <p className="text-xs font-medium text-[#64748B]">Question {currentQuestion + 1} of {currentTest.total_questions}</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-[12px] border-2 font-bold text-sm ${timeLeft < 300 ? 'bg-[#F472B6]/10 border-[#F472B6]/20 text-[#F472B6]' : 'bg-[#00D1FF]/10 border-[#00D1FF]/20 text-[#00D1FF]'}`}>
            <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-[#0A192F]/5 rounded-full overflow-hidden">
          <div className="bg-[#00D1FF] h-full rounded-full transition-all" style={{ width: `${((currentQuestion + 1) / currentTest.total_questions) * 100}%` }} />
        </div>

        {/* Question */}
        <div className="neo-card">
          <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-4">Question {currentQuestion + 1}</p>
          <h4 className="text-lg font-semibold text-[#0A192F] mb-6 leading-relaxed">{question.question}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => selectAnswer(index)}
                className={`w-full text-left p-4 rounded-[14px] border-2 font-medium text-sm transition-all ${answers[currentQuestion] === index ? 'bg-[#00D1FF]/10 border-[#00D1FF] text-[#0A192F]' : 'bg-[#F8FAFF] border-[#0A192F]/5 text-[#64748B] hover:border-[#00D1FF]/30 hover:text-[#0A192F]'}`}
              >
                <span className="font-bold text-[#00D1FF] mr-3">{String.fromCharCode(65 + index)}.</span>{option}
              </button>
            ))}
          </div>
        </div>

        {/* Question Nav Dots */}
        <div className="flex flex-wrap gap-2 justify-center">
          {Array.from({ length: currentTest.total_questions }, (_, i) => (
            <button key={i} onClick={() => setCurrentQuestion(i)} className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${i === currentQuestion ? 'bg-[#00D1FF] text-white' : answers[i] !== -1 ? 'bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/30' : 'bg-[#F8FAFF] border-2 border-[#0A192F]/10 text-[#64748B]'}`}>
              {i + 1}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-4">
          <button onClick={previousQuestion} disabled={currentQuestion === 0} className="flex-1 py-3 rounded-[12px] border-2 border-[#0A192F]/10 text-[#64748B] font-bold flex items-center justify-center gap-2 hover:border-[#0A192F]/20 disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          {currentQuestion === currentTest.total_questions - 1 ? (
            <button onClick={submitTest} className="flex-1 neo-button py-3 flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" /> Submit Test
            </button>
          ) : (
            <button onClick={nextQuestion} className="flex-1 neo-button py-3 flex items-center justify-center gap-2">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedPlanData = availablePlans.find(plan => plan.id === (selectedPlan || planId));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-[#34D399]/10 border border-[#34D399]/20 rounded-[16px] flex items-center justify-center">
          <FileText className="h-6 w-6 text-[#34D399]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-[#0A192F] tracking-tight">Practice Tests</h2>
          <p className="text-xs font-medium text-[#64748B]">Test your knowledge with timed exams</p>
        </div>
      </div>

      {/* Generate Section */}
      <div className="neo-card space-y-5">
        <h4 className="text-base font-extrabold text-[#0A192F] tracking-tight">Generate New Test</h4>

        {!planId && availablePlans.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Study Plan</label>
            <select
              value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}
              className="w-full px-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 font-medium text-[#0A192F] bg-white focus:outline-none focus:border-[#34D399]/40"
            >
              <option value="">Select a plan...</option>
              {availablePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.subject} - Class {plan.class}</option>)}
            </select>
          </div>
        )}

        {selectedPlanData && (
          <div className="bg-[#34D399]/5 rounded-[14px] border-2 border-[#34D399]/15 p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Subject</p><p className="font-bold text-[#0A192F]">{selectedPlanData.subject}</p></div>
              <div><p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Class</p><p className="font-bold text-[#0A192F]">{selectedPlanData.class}</p></div>
              <div><p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Chapters</p><p className="font-bold text-[#0A192F] truncate">{selectedPlanData.chapters}</p></div>
            </div>
          </div>
        )}

        <button onClick={generateTest} disabled={isGenerating || (!selectedPlan && !planId)} className="neo-button w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
          {isGenerating ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
          ) : (
            <><Target className="h-4 w-4" /> Generate Test (20 Questions · 30 min)</>
          )}
        </button>
      </div>

      {/* Available Tests */}
      {tests.length === 0 ? (
        <div className="neo-card text-center py-12">
          <FileText className="h-14 w-14 text-[#0A192F]/10 mx-auto mb-4" />
          <h4 className="text-base font-extrabold text-[#0A192F] mb-2">No tests yet</h4>
          <p className="text-sm font-medium text-[#64748B]">Generate your first practice test above</p>
        </div>
      ) : (
        <div>
          <h4 className="text-base font-extrabold text-[#0A192F] mb-4 tracking-tight">Available Tests</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tests.map((test) => (
              <div key={test.id} className="neo-card hover:-translate-y-1 transition-all">
                <h4 className="text-base font-extrabold text-[#0A192F] mb-1 tracking-tight">{test.title}</h4>
                <p className="text-xs font-medium text-[#64748B] mb-4">{test.subject}</p>
                <div className="flex gap-3 mb-5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#64748B] bg-[#F8FAFF] rounded-[8px] px-3 py-1.5 border border-[#0A192F]/5">
                    <Target className="h-3.5 w-3.5" /> {test.total_questions} questions
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#64748B] bg-[#F8FAFF] rounded-[8px] px-3 py-1.5 border border-[#0A192F]/5">
                    <Clock className="h-3.5 w-3.5" /> {test.duration_minutes} min
                  </div>
                </div>
                <button onClick={() => startTest(test)} className="w-full neo-button py-2.5 text-sm">Start Test</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Attempts */}
      {attempts.length > 0 && (
        <div className="neo-card">
          <h4 className="text-base font-extrabold text-[#0A192F] mb-5 tracking-tight">Recent Attempts</h4>
          <div className="space-y-3">
            {attempts.slice(0, 5).map((attempt) => (
              <div key={attempt.id} className="flex items-center justify-between p-4 bg-[#F8FAFF] rounded-[14px] border-2 border-[#0A192F]/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white rounded-[10px] border border-[#0A192F]/5 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-[#64748B]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0A192F]">{attempt.score}/{attempt.total_questions} correct</p>
                    <p className="text-xs font-medium text-[#64748B]">{new Date(attempt.completed_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-extrabold ${getScoreColor(Math.round((attempt.score / attempt.total_questions) * 100))}`}>
                    {Math.round((attempt.score / attempt.total_questions) * 100)}%
                  </p>
                  <p className="text-xs font-medium text-[#64748B]">{attempt.time_taken_minutes}m</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
