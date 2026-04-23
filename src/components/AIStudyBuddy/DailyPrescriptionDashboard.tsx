import React, { useState } from 'react';
import { CheckCircle2, Circle, Clock, Flame, BookOpen, Brain, Zap, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';

interface Task {
  type: string;
  subject: string;
  topic?: string;
  title?: string;
  duration_min?: number;
  estimated_minutes?: number;
  details?: string;
  description?: string;
  difficulty?: string;
  completed?: boolean;
}

interface Intention {
  trigger: string;
  action: string;
  duration_min: number;
  completed?: boolean;
}

interface DailyPrescriptionDashboardProps {
  prescriptionId: string;
  tasks: Task[];
  intentions: Intention[];
  totalMinutes: number;
  onSendMessage: (msg: string) => void;
  onTasksUpdated?: (newTasks: Task[], newIntentions: Intention[]) => void;
}

export function DailyPrescriptionDashboard({
  prescriptionId,
  tasks: initialTasks,
  intentions: initialIntentions,
  totalMinutes,
  onSendMessage,
  onTasksUpdated
}: DailyPrescriptionDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks || []);
  const [intentions, setIntentions] = useState<Intention[]>(initialIntentions || []);
  const { showToast } = useToast();

  const handleToggleTask = async (index: number) => {
    const newTasks = [...tasks];
    newTasks[index].completed = !newTasks[index].completed;
    setTasks(newTasks);

    // Optimistic UI, update backend
    onTasksUpdated?.(newTasks, intentions);
    try {
      await supabase.from('daily_prescriptions').update({ tasks: newTasks }).eq('id', prescriptionId);
    } catch {
      showToast('Failed to save progress', 'error');
    }
  };

  const handleToggleIntention = async (index: number) => {
    const newIntentions = [...intentions];
    newIntentions[index].completed = !newIntentions[index].completed;
    setIntentions(newIntentions);

    onTasksUpdated?.(tasks, newIntentions);
    try {
      await supabase.from('daily_prescriptions').update({ implementation_intentions: newIntentions }).eq('id', prescriptionId);
    } catch {
      showToast('Failed to save progress', 'error');
    }
  };

  const getTaskIcon = (type: string) => {
    if (type.includes('review') || type.includes('notes')) return <BookOpen className="w-4 h-4 text-emerald-500" />;
    if (type.includes('guided') || type.includes('problem')) return <Flame className="w-4 h-4 text-orange-500" />;
    if (type.includes('retrieval') || type.includes('quiz')) return <Brain className="w-4 h-4 text-brand-500" />;
    return <Zap className="w-4 h-4 text-amber-500" />;
  };

  const calculateProgress = () => {
    const completedTasks = tasks.filter(t => t.completed).length;
    const completedIntentions = intentions.filter(i => i.completed).length;
    const total = tasks.length + intentions.length;
    if (total === 0) return 0;
    return Math.round(((completedTasks + completedIntentions) / total) * 100);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in px-4">

      {/* Header Stat Area */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-slate-800">Tonight's Plan</h2>
          </div>
          <div className="flex items-center gap-1 text-sm font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            <span>{totalMinutes} min estimated</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-slate-500">
            <span>Overall Progress</span>
            <span>{calculateProgress()}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${calculateProgress()}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Checklist */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">Study Sequence</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {tasks.map((task, idx) => (
            <div key={idx} className={`p-4 transition-colors ${task.completed ? 'bg-slate-50/50' : 'hover:bg-slate-50/50'}`}>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handleToggleTask(idx)}
                  className="mt-0.5 flex-shrink-0 text-slate-400 hover:text-brand-500 transition-colors focus:outline-none"
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {getTaskIcon(task.type)}
                    <h4 className={`text-sm font-semibold ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {task.title || task.topic || task.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mb-2">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{task.subject}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {task.duration_min || task.estimated_minutes || 0}m</span>
                  {task.difficulty && <span className="capitalize">{task.difficulty} mode</span>}
                </div>
                {(task.details || task.description) && (
                  <p className={`text-xs leading-relaxed whitespace-pre-line ${task.completed ? 'text-slate-400' : 'text-slate-600'}`}>
                {task.details || task.description}
              </p>
                  )}
            </div>
        {!task.completed && (
            <button
              onClick={() => onSendMessage(`Help me start with: ${task.title || task.topic} (${task.type})`)}
          className="flex-shrink-0 text-[11px] font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded-md transition-colors"
                  >
          Start Mode
        </button>
                )}
      </div>
    </div >
  ))
}
{
  tasks.length === 0 && (
    <div className="p-6 text-center text-sm text-slate-500">No tasks prescribed for today.</div>
  )
}
        </div >
      </div >

  {/* Implementation Intentions Area */ }
{
  intentions && intentions.length > 0 && (
    <div className="bg-gradient-to-br from-indigo-50/50 to-brand-50/50 rounded-2xl border border-brand-100/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-100/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Implementation Intents</h3>
        <span className="text-[10px] font-bold tracking-wider text-brand-600 uppercase">Habit Loop</span>
      </div>
      <div className="divide-y divide-brand-100/50">
        {intentions.map((intent, idx) => (
          <div key={idx} className="p-4 flex items-start gap-3">
            <button
              onClick={() => handleToggleIntention(idx)}
              className="mt-0.5 flex-shrink-0 text-brand-300 hover:text-brand-500 transition-colors focus:outline-none"
            >
              {intent.completed ? (
                <CheckCircle2 className="w-5 h-5 text-brand-600" />
              ) : (
                <Circle className="w-5 h-5" />
              )}
            </button>
            <div>
              <p className={`text-sm ${intent.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
              <span className="font-semibold text-brand-700">When</span> {intent.trigger}, <span className="font-semibold text-brand-700">I will</span> {intent.action}.
            </p>
            <span className="text-xs font-medium text-slate-400 mt-1 inline-block">Estimated taking {intent.duration_min}m</span>
          </div>
              </div>
            ))}
    </div>
        </div >
      )
}
    </div >
  );
}
