import React, { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle, X, RotateCcw, Trophy, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

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

export function PracticeTestEngine({ planId, subject }: PracticeTestEngineProps) {
  const { user, session } = useAuth();
  const { showToast } = useToast();
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
  const [isSubscribed, setIsSubscribed] = useState(false); // TODO: Replace with real backend check
  const [showPaywall, setShowPaywall] = useState(false);

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

  useEffect(() => {
    // TODO: Replace with real backend check for subscription
    setShowPaywall(!isSubscribed);
  }, [isSubscribed]);

  const fetchAvailablePlans = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_plans')
        .select('id, subject, class, chapters, exam_date')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailablePlans(data || []);
      
      // Auto-select the first plan if no planId is provided
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

    // Get the selected plan details
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
        // Parse the error response to get detailed error message
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
    
    // Calculate score
    let correct = 0;
    currentTest.questions.forEach((question, index) => {
      if (answers[index] === question.correct_answer) {
        correct++;
      }
    });

    const score = correct;
    const timeTaken = Math.ceil((currentTest.duration_minutes * 60 - timeLeft) / 60);

    try {
      // Save attempt to database
      const { data, error } = await supabase
        .from('practice_test_attempts')
        .insert({
          user_id: user?.id,
          test_id: currentTest.id,
          answers: answers,
          score: score,
          total_questions: currentTest.total_questions,
          time_taken_minutes: timeTaken
        })
        .select()
        .single();

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
    if (percentage >= 80) return 'text-green-400';
    if (percentage >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleSubscribe = async () => {
    console.log('user:', user);
    if (!user?.id || !user?.email) {
      alert('User not found! Are you logged in?');
      return;
    }
    const response = await fetch('https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/create-razorpay-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0Mzg1NzcsImV4cCI6MjA2NjAxNDU3N30.Pu_uzP2h19NsJTR5q36EQ8hYTT7QzTvb2O0aa4gv7ao'
      },
      body: JSON.stringify({ user_id: user.id, email: user.email }),
    });
    const data = await response.json();
    if (data.short_url) {
      window.open(data.short_url, '_blank');
    } else {
      // Optionally show error
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (showResults && testResults) {
    return (
      <div className="space-y-6">
        {/* Results Header */}
        <div className="glass rounded-2xl p-6 border border-gray-700/50 text-center">
          <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-4 rounded-2xl mb-4 inline-block">
            <Trophy className="h-12 w-12 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Test Completed!</h3>
          <div className="flex items-center justify-center gap-8 text-center">
            <div>
              <p className={`text-4xl font-bold ${getScoreColor(testResults.percentage)}`}>
                {testResults.score}/{testResults.total}
              </p>
              <p className="text-gray-400">Score</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-blue-400">{testResults.percentage}%</p>
              <p className="text-gray-400">Accuracy</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-purple-400">{testResults.timeTaken}m</p>
              <p className="text-gray-400">Time Taken</p>
            </div>
          </div>
        </div>

        {/* Question Review */}
        <div className="glass rounded-2xl p-6 border border-gray-700/50">
          <h4 className="text-lg font-semibold text-white mb-4">Question Review</h4>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {testResults.questions.map((question: Question, index: number) => {
              const userAnswer = testResults.userAnswers[index];
              const isCorrect = userAnswer === question.correct_answer;
              
              return (
                <div key={index} className={`p-4 rounded-lg border ${
                  isCorrect ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-1 rounded-full ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                      {isCorrect ? <CheckCircle className="h-4 w-4 text-white" /> : <X className="h-4 w-4 text-white" />}
                    </div>
                    <div className="flex-grow">
                      <p className="text-white font-medium mb-2">{question.question}</p>
                      <div className="space-y-1">
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className={`p-2 rounded text-sm ${
                            optionIndex === question.correct_answer 
                              ? 'bg-green-500/20 text-green-400' 
                              : optionIndex === userAnswer && !isCorrect
                              ? 'bg-red-500/20 text-red-400'
                              : 'text-gray-400'
                          }`}>
                            {option}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => {
              setShowResults(false);
              setCurrentTest(null);
            }}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            Back to Tests
          </button>
          <button
            onClick={() => startTest(currentTest!)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-6 rounded-xl transition-colors duration-200"
          >
            Retake Test
          </button>
        </div>
      </div>
    );
  }

  if (currentTest && isActive) {
    const question = currentTest.questions[currentQuestion];
    
    return (
      <div className="space-y-6">
        {/* Test Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">{currentTest.title}</h3>
            <p className="text-gray-400">Question {currentQuestion + 1} of {currentTest.total_questions}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-lg ${
              timeLeft < 300 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              <Clock className="h-4 w-4 inline mr-2" />
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / currentTest.total_questions) * 100}%` }}
          ></div>
        </div>

        {/* Question */}
        <div className="glass rounded-2xl p-8 border border-gray-700/50">
          <h4 className="text-xl font-semibold text-white mb-6">{question.question}</h4>
          
          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => selectAnswer(index)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                  answers[currentQuestion] === index
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-gray-600 hover:border-gray-500 text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                <span className="font-medium mr-3">{String.fromCharCode(65 + index)}.</span>
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={previousQuestion}
            disabled={currentQuestion === 0}
            className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white px-6 py-3 rounded-xl transition-colors duration-200"
          >
            Previous
          </button>

          <div className="flex gap-2">
            {Array.from({ length: currentTest.total_questions }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQuestion(i)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  i === currentQuestion
                    ? 'bg-blue-500 text-white'
                    : answers[i] !== -1
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {currentQuestion === currentTest.total_questions - 1 ? (
            <button
              onClick={submitTest}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl transition-all duration-200"
            >
              Submit Test
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-colors duration-200"
            >
              Next
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedPlanData = availablePlans.find(plan => plan.id === (selectedPlan || planId));

  return (
    <div className="space-y-6 relative">
      {/* Razorpay Paywall Overlay */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center max-w-sm w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Unlock All Features</h2>
            <p className="mb-6 text-gray-700">Subscribe for <span className="font-bold">₹199</span> to access all features.</p>
            <button
              onClick={handleSubscribe}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
            >
              Go to Subscription
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-2 rounded-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Practice Tests</h3>
            <p className="text-gray-400">AI-generated practice exams from your study plans</p>
          </div>
        </div>
      </div>

      {/* Plan Selection and Generation */}
      <div className="glass rounded-2xl p-6 border border-gray-700/50">
        <h4 className="text-lg font-semibold text-white mb-4">Generate New Practice Test</h4>
        
        <div className="space-y-4">
          {/* Study Plan Selection */}
          {!planId && availablePlans.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Study Plan
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Choose a study plan...</option>
                {availablePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.subject} - Class {plan.class} (Exam: {new Date(plan.exam_date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Plan Details Display */}
          {selectedPlanData && (
            <div className="glass rounded-xl p-4 border border-gray-700/50 bg-green-500/10">
              <h5 className="font-semibold text-green-400 mb-2">Selected Plan Details</h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Subject:</span>
                  <span className="text-white ml-2">{selectedPlanData.subject}</span>
                </div>
                <div>
                  <span className="text-gray-400">Class:</span>
                  <span className="text-white ml-2">{selectedPlanData.class}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400">Chapters:</span>
                  <span className="text-white ml-2">{selectedPlanData.chapters}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={generateTest}
            disabled={isGenerating || (!selectedPlan && !planId)}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Generating Practice Test...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Target className="h-5 w-5" />
                Generate Practice Test (20 Questions, 30 mins)
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Available Tests */}
      {tests.length === 0 ? (
        <div className="glass rounded-2xl p-8 border border-gray-700/50 text-center">
          <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-6 rounded-2xl mb-6 inline-block">
            <FileText className="h-16 w-16 text-gray-400 mx-auto" />
          </div>
          <h4 className="text-xl font-semibold text-white mb-2">No Practice Tests</h4>
          <p className="text-gray-400 mb-6">Generate AI-powered practice tests from your study plans</p>
        </div>
      ) : (
        <div>
          <h4 className="text-lg font-semibold text-white mb-4">Available Practice Tests</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tests.map((test) => (
              <div key={test.id} className="glass rounded-2xl p-6 border border-gray-700/50 card-hover">
                <h4 className="text-lg font-semibold text-white mb-2">{test.title}</h4>
                <p className="text-gray-400 mb-4">{test.subject}</p>
                
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                  <span>{test.total_questions} questions</span>
                  <span>{test.duration_minutes} minutes</span>
                </div>

                <button
                  onClick={() => startTest(test)}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 px-6 rounded-xl transition-all duration-200"
                >
                  Start Test
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Attempts */}
      {attempts.length > 0 && (
        <div className="glass rounded-2xl p-6 border border-gray-700/50">
          <h4 className="text-lg font-semibold text-white mb-4">Recent Attempts</h4>
          <div className="space-y-3">
            {attempts.slice(0, 5).map((attempt) => (
              <div key={attempt.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">
                    Score: {attempt.score}/{attempt.total_questions}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {new Date(attempt.completed_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${getScoreColor(Math.round((attempt.score / attempt.total_questions) * 100))}`}>
                    {Math.round((attempt.score / attempt.total_questions) * 100)}%
                  </p>
                  <p className="text-gray-400 text-sm">{attempt.time_taken_minutes}m</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}