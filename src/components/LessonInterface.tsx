import React, { useState, useEffect } from 'react';

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

const LessonInterface: React.FC<LessonInterfaceProps> = ({
  lessonId,
  lessonTitle,
  lessonType,
  lessonDescription,
  dayNumber,
  date,
  onComplete,
  onClose,
  onStartVoiceLecture
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  // Generate lesson content based on actual lesson data
  const getLessonContent = () => {
    const lessonDate = date ? new Date(date).toLocaleDateString() : '';
    const dayInfo = dayNumber ? `Day ${dayNumber}` : '';
    
    switch (lessonType) {
      case 'theory':
        return {
          steps: [
            {
              type: 'video',
              title: `Introduction to ${lessonTitle}`,
              content: `Learn about ${lessonTitle.toLowerCase()}. ${lessonDescription || 'This lesson covers the fundamental concepts and principles.'}`,
              duration: 120
            },
            {
              type: 'text',
              title: 'Key Concepts',
              content: lessonDescription || `Understanding ${lessonTitle.toLowerCase()} is essential for mastering this subject. Focus on the core principles and their applications.`,
              duration: 60
            },
            {
              type: 'interactive',
              title: 'Practice Question',
              content: `Based on what you've learned about ${lessonTitle.toLowerCase()}, what would be the most important concept to remember?`,
              options: [
                'The basic definition',
                'Real-world applications',
                'Mathematical formulas',
                'Historical context'
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
              title: `${lessonTitle} Practice`,
              content: `Apply your knowledge of ${lessonTitle.toLowerCase()} to solve this problem. ${lessonDescription || 'Think through the concepts step by step.'}`,
              solution: 'Work through the problem using the principles you\'ve learned.',
              duration: 180
            },
            {
              type: 'interactive',
              title: 'Concept Check',
              content: `Match the ${lessonTitle.toLowerCase()} concepts with their descriptions:`,
              pairs: [
                { term: 'Core Concept', definition: 'The fundamental principle of this topic' },
                { term: 'Application', definition: 'How this concept is used in practice' },
                { term: 'Key Formula', definition: 'The mathematical relationship involved' }
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
              title: 'Question 1 of 3',
              content: `What is the primary focus of ${lessonTitle.toLowerCase()}?`,
              options: ['Theory', 'Practice', 'History', 'Applications'],
              correctAnswer: 0
            },
            {
              type: 'question',
              title: 'Question 2 of 3',
              content: `Which aspect of ${lessonTitle.toLowerCase()} is most important for exam preparation?`,
              options: ['Memorization', 'Understanding', 'Speed', 'Creativity'],
              correctAnswer: 1
            },
            {
              type: 'question',
              title: 'Question 3 of 3',
              content: `How would you apply ${lessonTitle.toLowerCase()} in a real-world scenario?`,
              options: ['Direct application', 'Adaptation required', 'Not applicable', 'Depends on context'],
              correctAnswer: 3
            }
          ]
        };
      default:
        return { 
          steps: [
            {
              type: 'text',
              title: lessonTitle,
              content: lessonDescription || `Study session for ${lessonTitle.toLowerCase()}. ${dayInfo} ${lessonDate ? `(${lessonDate})` : ''}`,
              duration: 30
            },
            {
              type: 'text',
              title: 'Study Focus',
              content: `Focus on understanding the key concepts of ${lessonTitle.toLowerCase()}. Take notes and think about how this topic connects to what you've learned before.`,
              duration: 45
            },
            {
              type: 'interactive',
              title: 'Reflection',
              content: `What did you learn about ${lessonTitle.toLowerCase()} today?`,
              options: ['Key concepts', 'Practical applications', 'Areas for improvement', 'All of the above'],
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
      setProgress(prev => {
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
      // Trigger voice lecture interface
      onClose();
      if (onStartVoiceLecture) {
        onStartVoiceLecture();
      }
      console.log('Starting voice lecture...');
    } else {
      setAnswers([...answers, answer.toString()]);
      handleNext();
    }
  };

  const completeLesson = () => {
    const accuracy = Math.random() * 40 + 60; // 60-100% accuracy
    const xpEarned = Math.floor(accuracy / 10) + 10; // 10-20 XP
    setIsCompleted(true);
    onComplete(accuracy, xpEarned);
  };

  const renderStep = (step: any, index: number) => {
    switch (step.type) {
      case 'video':
        return (
          <div className="text-center">
            <div className="w-full h-48 bg-gray-700 rounded-lg flex items-center justify-center mb-4">
              <div className="text-6xl">🗣️</div>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Interactive Voice Lecture</h3>
            <p className="text-gray-300 mb-4">Have a conversation with your AI tutor about this topic</p>
            <div className="text-sm text-gray-400">Duration: {step.duration}s</div>
            <button
              onClick={() => {
                console.log('Voice lecture button clicked');
                handleAnswer('voice_lecture');
              }}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Voice Lecture
            </button>
          </div>
        );

      case 'text':
        return (
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white mb-4">{step.title}</h3>
            <div className="bg-gray-700 p-6 rounded-lg mb-4">
              <p className="text-gray-200 leading-relaxed">{step.content}</p>
            </div>
            <div className="text-sm text-gray-400">Reading time: {step.duration}s</div>
          </div>
        );

      case 'interactive':
        return (
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white mb-4">{step.title}</h3>
            <p className="text-gray-300 mb-6">{step.content}</p>
            {step.options ? (
              <div className="grid grid-cols-1 gap-3">
                {step.options.map((option: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className="p-4 border border-gray-600 rounded-lg hover:border-blue-400 hover:bg-gray-700 transition-colors text-white"
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {step.pairs?.map((pair: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-gray-700 rounded-lg">
                    <span className="font-medium text-white">{pair.term}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-300">{pair.definition}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'question':
        return (
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white mb-4">{step.title}</h3>
            <p className="text-gray-300 mb-6">{step.content}</p>
            <div className="grid grid-cols-1 gap-3">
              {step.options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  className="p-4 border border-gray-600 rounded-lg hover:border-blue-400 hover:bg-gray-700 transition-colors text-white"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );

      case 'problem':
        return (
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white mb-4">{step.title}</h3>
            <div className="bg-yellow-900/20 p-6 rounded-lg mb-4 border border-yellow-500/30">
              <p className="text-gray-200 font-medium">{step.content}</p>
            </div>
            <div className="bg-green-900/20 p-4 rounded-lg mb-4 border border-green-500/30">
              <p className="text-sm text-gray-300">Solution:</p>
              <p className="text-gray-200">{step.solution}</p>
            </div>
          </div>
        );

      default:
        return <div>Unknown step type</div>;
    }
  };

  if (isCompleted) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 text-center border border-gray-700">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-4">Lesson Complete!</h2>
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-center gap-2">
              <span className="text-yellow-400 text-2xl">⭐</span>
              <span className="text-xl font-semibold text-white">+{Math.floor(Math.random() * 20) + 10} XP</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-green-400 text-2xl">📈</span>
              <span className="text-lg text-gray-300">Accuracy: {Math.floor(Math.random() * 40) + 60}%</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue Learning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{lessonTitle}</h2>
              {(dayNumber || date) && (
                <div className="flex items-center gap-2 mt-1">
                  {dayNumber && (
                    <span className="text-sm text-blue-400 bg-blue-900/20 px-2 py-1 rounded">
                      Day {dayNumber}
                    </span>
                  )}
                  {date && (
                    <span className="text-sm text-gray-400">
                      {new Date(date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-300">
            <span>Step {currentStep + 1} of {totalSteps}</span>
            <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {lessonContent.steps[currentStep] && renderStep(lessonContent.steps[currentStep], currentStep)}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
            >
              Exit Lesson
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentStep === totalSteps - 1 ? 'Complete' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonInterface; 