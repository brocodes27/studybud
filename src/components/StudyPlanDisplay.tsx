import React from 'react';
import { Calendar, Clock, BookOpen, CheckCircle, Target, HelpCircle } from 'lucide-react';

interface StudyPlan {
  days_until_exam: number;
  daily_schedule: Array<{
    day: number;
    date: string;
    topic: string;
    question_type: string;
    description: string;
    practice_questions?: string[];
  }>;
}

interface StudyPlanDisplayProps {
  plan: StudyPlan;
  formData: {
    class: string;
    subject: string;
    chapters: string;
    exam_date: string;
  };
  onReset?: () => void;
}

export function StudyPlanDisplay({ plan, formData, onReset }: StudyPlanDisplayProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getQuestionTypeColor = (type: string) => {
    const colors = {
      'MCQ': 'bg-blue-100 text-blue-800',
      'Short Answer': 'bg-green-100 text-green-800',
      'Numerical': 'bg-purple-100 text-purple-800',
      'Long Answer': 'bg-orange-100 text-orange-800',
      'Case Study': 'bg-indigo-100 text-indigo-800',
      'Practice Test': 'bg-red-100 text-red-800',
      'Revision': 'bg-yellow-100 text-yellow-800',
    };
    
    for (const [key, value] of Object.entries(colors)) {
      if (type.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Your Study Plan</h3>
              <p className="text-gray-600">Personalized schedule for {formData.subject}</p>
            </div>
          </div>
          {onReset && (
            <button
              onClick={onReset}
              className="bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-lg border border-gray-200 transition-colors duration-200"
            >
              Create New Plan
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-gray-700">Days Left</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-1">{plan.days_until_exam}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-gray-700">Subject</span>
            </div>
            <p className="text-lg font-bold text-green-600 mt-1">{formData.subject}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <span className="font-semibold text-gray-700">Exam Date</span>
            </div>
            <p className="text-lg font-bold text-purple-600 mt-1">
              {formatDate(formData.exam_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Daily Schedule */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
        <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-600" />
          Daily Study Schedule
        </h4>

        <div className="space-y-6">
          {plan.daily_schedule.map((day, index) => (
            <div
              key={index}
              className="group hover:bg-gray-50 transition-colors duration-200 p-6 rounded-xl border border-gray-100"
            >
              <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg px-4 py-3 text-center min-w-[90px]">
                    <div className="font-bold text-lg">Day {day.day}</div>
                    <div className="text-sm opacity-90">{formatDate(day.date)}</div>
                  </div>
                </div>

                <div className="flex-grow space-y-4">
                  <div>
                    <h5 className="font-bold text-xl text-gray-900 mb-2">{day.topic}</h5>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getQuestionTypeColor(day.question_type)}`}>
                      {day.question_type}
                    </span>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h6 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Study Focus
                    </h6>
                    <p className="text-gray-700 leading-relaxed">{day.description}</p>
                  </div>

                  {day.practice_questions && day.practice_questions.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <h6 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Practice Questions
                      </h6>
                      <div className="space-y-2">
                        {day.practice_questions.map((question, qIndex) => (
                          <div key={qIndex} className="bg-white rounded-md p-3 border border-blue-200">
                            <p className="text-gray-800 text-sm leading-relaxed">{question}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chapters Covered */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
        <h4 className="text-xl font-bold text-gray-900 mb-4">Chapters Covered</h4>
        <div className="flex flex-wrap gap-2">
          {formData.chapters.split(',').map((chapter, index) => (
            <span
              key={index}
              className="bg-blue-100 text-blue-800 px-3 py-2 rounded-full text-sm font-medium"
            >
              {chapter.trim()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}