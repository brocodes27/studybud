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
      'MCQ': 'bg-neo-secondary text-slate-100',
      'Short Answer': 'bg-neo-accent text-slate-100',
      'Numerical': 'bg-slate-900 text-slate-100',
      'Long Answer': 'bg-slate-800 text-slate-100',
      'Case Study': 'bg-neo-secondary text-slate-100',
      'Practice Test': 'bg-neo-accent text-slate-100',
      'Revision': 'bg-slate-900 text-slate-100',
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
        <div className="bg-slate-800 border-6 border-white/10 p-8 shadow-neo">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-neo-accent p-4 border border-white/10 shadow-neo">
                <Target className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-3xl font-black text-slate-100 mb-1 uppercase italic">{formData.plan_name || 'Your Study Plan'}</h3>
                <p className="text-slate-100/60 text-lg">Personalized schedule for <span className="text-neo-accent font-black uppercase">{formData.subject}</span></p>
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
            <div className="bg-slate-900 border border-white/10 p-5 shadow-neo">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-5 w-5 text-neo-accent" />
                <span className="font-black uppercase text-slate-100/60 text-xs tracking-widest">Days Left</span>
              </div>
              <p className="text-3xl font-black text-slate-100">{plan.days_until_exam}</p>
            </div>

            <div className="bg-slate-900 border border-white/10 p-5 shadow-neo">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="h-5 w-5 text-neo-secondary" />
                <span className="font-black uppercase text-slate-100/60 text-xs tracking-widest">Subject</span>
              </div>
              <p className="text-xl font-black text-slate-100 truncate uppercase italic">{formData.subject}</p>
            </div>

            <div className="bg-slate-900 border border-white/10 p-5 shadow-neo">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="h-5 w-5 text-neo-bg" />
                <span className="font-black uppercase text-slate-100/60 text-xs tracking-widest">Exam Date</span>
              </div>
              <p className="text-xl font-black text-slate-100">
                {formatDate(formData.exam_date)}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 border-b-4 border-white/10 pb-1">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-6 py-3 font-black uppercase tracking-widest text-xs border border-white/10 ${activeTab === 'schedule'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-800 text-slate-100 hover:bg-neo-bg'
              }`}
          >
            <List className="w-4 h-4" />
            Daily Schedule
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex items-center gap-2 px-6 py-3 font-black uppercase tracking-widest text-xs border border-white/10 ${activeTab === 'videos'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-800 text-slate-100 hover:bg-neo-bg'
              }`}
          >
            <Video className="w-4 h-4" />
            Blackboard Lessons
          </button>
        </div>

        {activeTab === 'schedule' ? (
          /* Daily Schedule */
          <div className="bg-slate-800 border-6 border-white/10 p-8 shadow-neo">
            <h4 className="text-2xl font-black text-slate-100 mb-8 flex items-center gap-3 uppercase italic">
              <CheckCircle className="h-7 w-7 text-neo-secondary" />
              Daily Study Schedule
            </h4>

            <div className="space-y-6">
              {plan.daily_schedule.map((day, index) => (
                <div
                  key={index}
                  className="group transition-all duration-300 p-6 border border-white/10 bg-slate-900"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="bg-slate-800 border border-white/10 px-5 py-4 text-center min-w-[100px] shadow-neo">
                        <div className="font-black text-xl">Day {day.day}</div>
                        <div className="text-xs font-black uppercase text-slate-100/60 mt-1">{formatDate(day.date)}</div>
                      </div>
                    </div>

                    <div className="flex-grow space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h5 className="font-black text-xl text-slate-100 uppercase italic">{day.topic}</h5>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-white/10 ${getQuestionTypeColor(day.question_type)}`}>
                              {day.question_type}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-800 border border-white/10 p-5 shadow-neo">
                          <h6 className="font-black text-slate-100/70 mb-2 flex items-center gap-2 uppercase text-xs tracking-widest">
                            <BookOpen className="h-4 w-4 text-neo-accent" />
                            Study Focus
                          </h6>
                          <p className="text-slate-100/70 leading-relaxed font-bold">{day.description}</p>
                        </div>

                        {day.practice_questions && day.practice_questions.length > 0 && (
                          <div className="bg-slate-800 border border-white/10 p-5 shadow-neo">
                            <h6 className="font-black text-slate-100 mb-4 flex items-center gap-2 uppercase text-xs tracking-widest">
                              <HelpCircle className="h-4 w-4" />
                              Practice Questions
                            </h6>
                            <div className="space-y-3">
                              {day.practice_questions.map((question, qIndex) => (
                                <div key={qIndex} className="bg-slate-900 border border-white/10 p-4">
                                  <p className="text-slate-100/70 text-sm leading-relaxed font-bold">{question}</p>
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
          <div className="bg-slate-800 border-6 border-white/10 p-8 shadow-neo">
            <h4 className="text-2xl font-black text-slate-100 mb-8 flex items-center gap-3 uppercase italic">
              <Video className="h-7 w-7 text-neo-secondary" />
              Blackboard Lessons
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plan.daily_schedule.map((day, index) => (
                <div key={index} className="bg-slate-900 border border-white/10 p-6 shadow-neo flex flex-col justify-between h-full">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-100/60">Day {day.day}</span>
                      <span className={`text-[10px] px-2 py-0.5 border border-white/10 font-black uppercase ${getQuestionTypeColor(day.question_type)}`}>{day.question_type}</span>
                    </div>
                    <h5 className="text-lg font-black text-slate-100 mb-2 line-clamp-2 min-h-[3.5rem] uppercase italic">{day.topic}</h5>
                    <p className="text-sm text-slate-100/60 line-clamp-3 mb-6 min-h-[4rem] font-bold">{day.description}</p>
                  </div>
                  <button
                    onClick={() => setPlayingTopic({ topic: day.topic, subject: formData.subject })}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-white/10 bg-slate-900 text-white font-black uppercase text-xs tracking-widest"
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
        <div className="bg-slate-800 border-6 border-white/10 p-8 shadow-neo">
          <h4 className="text-xl font-black text-slate-100 mb-6 uppercase italic">Chapters Covered</h4>
          <div className="flex flex-wrap gap-3">
            {formData.chapters.split(',').map((chapter, index) => (
              <span
                key={index}
                className="bg-slate-800 text-slate-100 border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest"
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