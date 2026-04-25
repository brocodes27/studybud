import { motion } from 'framer-motion';
import { CheckCircle2, Brain, ArrowRight, FileText, Sparkles } from 'lucide-react';
import type { DailyBriefingData } from '../../lib/dailyBriefing';

interface WhatChangedCardProps {
  data: DailyBriefingData;
}

export function WhatChangedCard({ data }: WhatChangedCardProps) {
  const items: Array<{ title: string; body: string; icon: any; tone: string }> = [];

  if (data.recentSubmissions[0]?.analysis?.feedback) {
    items.push({
      title: 'Latest work was analyzed',
      body: data.recentSubmissions[0].analysis?.feedback || 'Your latest task output has been reviewed.',
      icon: FileText,
      tone: 'bg-sky-50 border-sky-100 text-sky-800',
    });
  } else if (data.recentSubmissions.length > 0) {
    items.push({
      title: 'A new work sample landed',
      body: 'Your submission is now part of the learner record, even if the detailed feedback is still catching up.',
      icon: FileText,
      tone: 'bg-sky-50 border-sky-100 text-sky-800',
    });
  }

  if (data.recentKnowledge[0]) {
    items.push({
      title: `Ranjan Sir now knows: ${data.recentKnowledge[0].topic || 'a fresh study signal'}`,
      body: data.recentKnowledge[0].content,
      icon: Brain,
      tone: 'bg-fuchsia-50 border-fuchsia-100 text-fuchsia-800',
    });
  }

  if (data.todayTasks.length > 0) {
    const pending = data.todayTasks.filter((task) => !task.completed).length;
    items.push({
      title: 'Tomorrow is already being shaped',
      body: pending === 0
        ? 'Today is fully closed out, so tomorrow can be more ambitious or more targeted based on your latest work.'
        : `There are ${pending} unfinished tasks left today, so tomorrow should stay grounded and protect momentum instead of overload.`,
      icon: ArrowRight,
      tone: 'bg-amber-50 border-amber-100 text-amber-900',
    });
  }

  if (items.length === 0) {
    items.push({
      title: 'Your learning loop is ready',
      body: 'As soon as you complete or submit work, this space will show what the system learned and how your plan changed.',
      icon: Sparkles,
      tone: 'bg-[#F5F0E8] border-[#E8E2D9] text-[#6B5A43]',
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.42, duration: 0.45 }}
      className="w-full max-w-xl"
    >
      <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 ml-1">
        What Changed Today
      </div>

      <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-neo-sm p-5 space-y-3">
        {items.slice(0, 3).map((item) => (
          <div key={item.title} className={`rounded-xl border p-3 ${item.tone}`}>
            <div className="flex items-start gap-2">
              <item.icon className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">{item.title}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 opacity-70" />
                </div>
                <p className="text-xs leading-relaxed opacity-90">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
