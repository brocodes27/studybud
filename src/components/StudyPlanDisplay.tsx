import { Calendar, Clock, BookOpen, CheckCircle, Target, HelpCircle, Sparkles, Play, Video, List } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from './Button';
import { BlackboardPlayer } from './BlackboardPlayer';

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
    plan_name: string;
    class: string;
    subject: string;
    chapters: string;
    exam_date: string;
    user_id?: string;
    email?: string;
  };
  onReset?: () => void;
}

export function StudyPlanDisplay({ plan, formData, onReset }: StudyPlanDisplayProps) {
  const [playingTopic, setPlayingTopic] = useState<{ topic: string, subject: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'videos'>('schedule');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getQuestionTypeColor = (type: string) => {
    const colors = {
      'MCQ': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'Short Answer': 'bg-green-500/20 text-green-300 border-green-500/30',
      'Numerical': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'Long Answer': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'Case Study': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      'Practice Test': 'bg-red-500/20 text-red-300 border-red-500/30',
      'Revision': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    };

    for (const [key, value] of Object.entries(colors)) {
      if (type.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  return (
    <>
      {playingTopic && (
        <BlackboardPlayer
          topic={playingTopic.topic}
          subject={playingTopic.subject}
          onClose={() => setPlayingTopic(null)}
        />
      )}

      <div className="space-y-6 relative animate-fade-in">
        {/* Header Summary */}
        <div className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-neon-blue/10 rounded-full blur-3xl"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-neon-blue to-blue-600 p-4 rounded-2xl shadow-lg shadow-neon-blue/20">
                <Target className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-white mb-1">{formData.plan_name || 'Your Study Plan'}</h3>
                <p className="text-gray-400 text-lg">Personalized schedule for <span className="text-neon-blue font-medium">{formData.subject}</span></p>
              </div>
            </div>
            {onReset && (
              <Button
                variant="outline"
                onClick={onReset}
                icon={<Sparkles className="w-4 h-4" />}
              >
                Create New Plan
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-5 rounded-xl border border-white/5 bg-black/20">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-5 w-5 text-neon-blue" />
                <span className="font-medium text-gray-400">Days Left</span>
              </div>
              <p className="text-3xl font-bold text-white">{plan.days_until_exam}</p>
            </div>

            <div className="glass-card p-5 rounded-xl border border-white/5 bg-black/20">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="h-5 w-5 text-neon-green" />
                <span className="font-medium text-gray-400">Subject</span>
              </div>
              <p className="text-xl font-bold text-white truncate">{formData.subject}</p>
            </div>

            <div className="glass-card p-5 rounded-xl border border-white/5 bg-black/20">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="h-5 w-5 text-neon-purple" />
                <span className="font-medium text-gray-400">Exam Date</span>
              </div>
              <p className="text-xl font-bold text-white">
                {formatDate(formData.exam_date)}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 border-b border-white/10 pb-1">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-medium transition-all ${activeTab === 'schedule'
                ? 'bg-neon-blue/10 text-neon-blue border-b-2 border-neon-blue'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <List className="w-4 h-4" />
            Daily Schedule
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-medium transition-all ${activeTab === 'videos'
                ? 'bg-neon-green/10 text-neon-green border-b-2 border-neon-green'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <Video className="w-4 h-4" />
            Blackboard Lessons
          </button>
        </div>

        {activeTab === 'schedule' ? (
          /* Daily Schedule */
          <div className="glass-panel p-8 rounded-3xl border border-white/10">
            <h4 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
              <CheckCircle className="h-7 w-7 text-neon-green" />
              Daily Study Schedule
            </h4>

            <div className="space-y-6">
              {plan.daily_schedule.map((day, index) => (
                <div
                  key={index}
                  className="group hover:bg-white/5 transition-all duration-300 p-6 rounded-2xl border border-white/5 hover:border-neon-blue/30 relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-neon-blue to-neon-purple opacity-0 group-hover:opacity-100 transition-opacity"></div>

                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="bg-gradient-to-br from-neon-blue/20 to-blue-600/20 border border-neon-blue/30 text-neon-blue rounded-xl px-5 py-4 text-center min-w-[100px]">
                        <div className="font-bold text-xl">Day {day.day}</div>
                        <div className="text-sm opacity-80 mt-1">{formatDate(day.date)}</div>
                      </div>
                    </div>

                    <div className="flex-grow space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h5 className="font-bold text-xl text-white">{day.topic}</h5>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getQuestionTypeColor(day.question_type)}`}>
                              {day.question_type}
                            </span>
                          </div>
                        </div>

                        <div className="bg-black/30 rounded-xl p-5 border border-white/5">
                          <h6 className="font-semibold text-gray-300 mb-2 flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-neon-purple" />
                            Study Focus
                          </h6>
                          <p className="text-gray-400 leading-relaxed">{day.description}</p>
                        </div>

                        {day.practice_questions && day.practice_questions.length > 0 && (
                          <div className="bg-neon-blue/5 rounded-xl p-5 border border-neon-blue/10">
                            <h6 className="font-semibold text-neon-blue mb-4 flex items-center gap-2">
                              <HelpCircle className="h-4 w-4" />
                              Practice Questions
                            </h6>
                            <div className="space-y-3">
                              {day.practice_questions.map((question, qIndex) => (
                                <div key={qIndex} className="bg-black/40 rounded-lg p-4 border border-white/5 hover:border-neon-blue/20 transition-colors">
                                  <p className="text-gray-300 text-sm leading-relaxed">{question}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Video/Blackboard Lessons Tab */
          <div className="glass-panel p-8 rounded-3xl border border-white/10">
            <h4 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
              <Video className="h-7 w-7 text-neon-green" />
              Blackboard Lessons
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plan.daily_schedule.map((day, index) => (
                <div key={index} className="glass-card p-6 rounded-2xl border border-white/10 hover:border-neon-green/40 transition-all flex flex-col justify-between h-full bg-black/20">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-sm text-gray-400 font-mono">Day {day.day}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getQuestionTypeColor(day.question_type)}`}>{day.question_type}</span>
                    </div>
                    <h5 className="text-lg font-bold text-white mb-2 line-clamp-2 min-h-[3.5rem]">{day.topic}</h5>
                    <p className="text-sm text-gray-400 line-clamp-3 mb-6 min-h-[4rem]">{day.description}</p>
                  </div>
                  <button
                    onClick={() => setPlayingTopic({ topic: day.topic, subject: formData.subject })}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-neon-green/20 to-emerald-500/20 text-neon-green font-bold border border-neon-green/30 hover:bg-neon-green/30 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Watch Lesson
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chapters Covered */}
        <div className="glass-panel p-8 rounded-3xl border border-white/10">
          <h4 className="text-xl font-bold text-white mb-6">Chapters Covered</h4>
          <div className="flex flex-wrap gap-3">
            {formData.chapters.split(',').map((chapter, index) => (
              <span
                key={index}
                className="bg-white/5 text-gray-300 border border-white/10 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/10 hover:text-white hover:border-neon-blue/30 transition-all cursor-default"
              >
                {chapter.trim()}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}