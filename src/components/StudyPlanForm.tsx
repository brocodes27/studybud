import React, { useState, useEffect } from 'react';
import { Calendar, BookOpen, GraduationCap, FileText, Loader2, Pencil, AlertCircle, X, Target, Zap, Sparkles, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface StudyPlanFormProps {
  onSubmit: (data: FormData) => void;
  loading: boolean;
  initialData?: Partial<FormData>;
}

export interface FormData {
  plan_name: string;
  class: string;
  subject: string;
  chapters: string;
  exam_date: string;
  user_id?: string;
  email?: string;
}

export function StudyPlanForm({ onSubmit, loading, initialData = {} }: StudyPlanFormProps) {
  const { user, isPremium } = useAuth() as any;

  const [formData, setFormData] = useState<FormData>({
    plan_name: initialData.plan_name ?? '',
    class: initialData.class ?? '',
    subject: initialData.subject ?? '',
    chapters: initialData.chapters ?? '',
    exam_date: initialData.exam_date ?? '',
    user_id: initialData.user_id ?? user?.id,
    email: initialData.email ?? user?.email,
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [showFreeLimitPopup, setShowFreeLimitPopup] = useState(false);
  const [freeLimitMessage, setFreeLimitMessage] = useState<string>('');
  const [checkingLimits, setCheckingLimits] = useState(false);

  useEffect(() => {
    setFormData(prev => ({ ...prev, user_id: user?.id, email: user?.email }));
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};
    if (!formData.plan_name.trim()) newErrors.plan_name = 'Plan name is required';
    if (!formData.class.trim()) newErrors.class = 'Grade is required';
    if (!formData.subject.trim()) newErrors.subject = 'Subject is required';
    if (!formData.chapters.trim()) newErrors.chapters = 'Topics are required';

    if (!formData.exam_date) {
      newErrors.exam_date = 'Exam date is required';
    } else {
      const examDate = new Date(formData.exam_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (examDate <= today) {
        newErrors.exam_date = 'Exam date must be in the future';
      } else {
        const timeDiff = examDate.getTime() - today.getTime();
        const daysUntilExam = Math.ceil(timeDiff / (1000 * 3600 * 24));
        if (daysUntilExam > 30) {
          setShowLimitPopup(true);
          return false;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!isPremium && user?.id) {
      setCheckingLimits(true);
      try {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();

        const { data: plans } = await supabase
          .from('exam_plans')
          .select('id, subject, created_at')
          .eq('user_id', user.id)
          .gte('created_at', firstDayOfMonth)
          .lte('created_at', lastDayOfMonth);

        if ((plans?.length || 0) >= 1) {
          setFreeLimitMessage('Free tier limit: 1 study plan per month. Upgrade to Pro for unlimited.');
          setShowFreeLimitPopup(true);
          return;
        }

        const uniqueSubjects = new Set((plans || []).map(p => p.subject));
        uniqueSubjects.add(formData.subject);
        if (uniqueSubjects.size > 1) {
          setFreeLimitMessage('Free tier limit: Only 1 subject allowed. Upgrade to Pro for multiple subjects.');
          setShowFreeLimitPopup(true);
          return;
        }
      } finally {
        setCheckingLimits(false);
      }
    }

    onSubmit(formData);
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const minDateString = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const maxDateString = new Date(Date.now() + 31 * 86400000).toISOString().split('T')[0];

  if (user === undefined) return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="animate-spin h-8 w-8 text-neo-accent" />
    </div>
  );

  return (
    <div className="space-y-8">
      {!isPremium && (
        <div className="bg-slate-900 border border-white/10 p-4 shadow-neo text-[10px] font-black uppercase tracking-widest">
          FREE_LIMITS: 1_STUDY_PLAN/MO · 1_SUBJECT_ONLY · PLAN_LENGTH_MAX_30_DAYS
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Plan Name */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-black uppercase tracking-widest mb-3">
              <Pencil className="h-4 w-4 text-neo-accent" />
              PLAN_IDENTITY
            </label>
            <input
              type="text"
              value={formData.plan_name}
              onChange={(e) => handleInputChange('plan_name', e.target.value)}
              placeholder="e.g., SAT_FINAL_TRACK"
              className={`w-full bg-slate-900 text-slate-100 p-4 border border-white/10 font-black placeholder:text-slate-100/20 focus:outline-none focus:shadow-neo transition-all ${errors.plan_name ? 'bg-red-50' : ''}`}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-black uppercase tracking-widest mb-3">
              <GraduationCap className="h-4 w-4 text-neo-secondary" />
              CURRENT_GRADE
            </label>
            <input
              type="text"
              value={formData.class}
              onChange={(e) => handleInputChange('class', e.target.value)}
              placeholder="e.g., Grade 12"
              className="w-full bg-slate-900 text-slate-100 p-4 border border-white/10 font-black placeholder:text-slate-100/20 focus:outline-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-black uppercase tracking-widest mb-3">
              <Target className="h-4 w-4 text-neo-accent" />
              SUBJECT
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
              placeholder="e.g., Math / Reading"
              className="w-full bg-slate-900 text-slate-100 p-4 border border-white/10 font-black placeholder:text-slate-100/20 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-black uppercase tracking-widest mb-3">
            <BookOpen className="h-4 w-4 text-neo-secondary" />
            TOPICS_TO_COVER
          </label>
          <textarea
            value={formData.chapters}
            onChange={(e) => handleInputChange('chapters', e.target.value)}
            placeholder="e.g., Algebra, Linear Equations, Rhetorical Synthesis"
            rows={3}
            className="w-full bg-slate-900 text-slate-100 p-4 border border-white/10 font-black placeholder:text-slate-100/20 focus:outline-none"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-black uppercase tracking-widest mb-3">
            <Calendar className="h-4 w-4 text-neo-accent" />
            DEADLINE
          </label>
          <input
            type="date"
            value={formData.exam_date}
            onChange={(e) => handleInputChange('exam_date', e.target.value)}
            min={minDateString}
            max={maxDateString}
            className="w-full bg-slate-900 text-slate-100 p-4 border border-white/10 font-black focus:outline-none"
          />
          <p className="text-[10px] font-black text-slate-100/40 mt-3 flex items-center gap-2">
            <HelpCircle className="h-3 w-3" /> MAX_PLAN_DURATION: 30_DAYS
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || checkingLimits}
          className="w-full neo-button bg-neo-accent py-6 text-2xl group relative overflow-hidden"
        >
          {loading || checkingLimits ? (
            <div className="flex items-center justify-center gap-3 italic">
              <Loader2 className="h-6 w-6 animate-spin" /> VALIDATING_LIMITS...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              INITIALIZE_PLAN <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform" />
            </div>
          )}
        </button>
      </form>

      {/* Limit Popup */}
      {showLimitPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
          <div className="neo-card bg-slate-800 p-8 max-w-md w-full border border-white/10 shadow-neo space-y-6">
            <div className="flex items-center gap-4 border-b-4 border-white/10 pb-4">
              <div className="bg-neo-secondary p-2 border border-white/10 rotate-3">
                <AlertCircle className="h-6 w-6 text-slate-100" />
              </div>
              <h3 className="text-2xl font-black italic uppercase">Time_Constraint</h3>
            </div>
            <p className="font-bold text-lg leading-snug">
              To maintain high-density AI accuracy, Atlas restricts plan generation to a maximum of 30 days.
            </p>
            <div className="flex gap-4 pt-4">
              <button onClick={() => setShowLimitPopup(false)} className="neo-button-white flex-1 py-3 text-sm">BACK</button>
              <button
                onClick={() => {
                  setShowLimitPopup(false);
                  const d = new Date(); d.setMonth(d.getMonth() + 1);
                  handleInputChange('exam_date', d.toISOString().split('T')[0]);
                }}
                className="neo-button bg-neo-accent flex-1 py-3 text-sm"
              >
                FIX_TO_MAX
              </button>
            </div>
          </div>
        </div>
      )}

      {showFreeLimitPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
          <div className="neo-card bg-slate-800 p-8 max-w-md w-full border border-white/10 shadow-neo space-y-6">
            <div className="flex items-center gap-4 border-b-4 border-white/10 pb-4">
              <div className="bg-neo-accent p-2 border border-white/10 rotate-3">
                <AlertCircle className="h-6 w-6 text-slate-100" />
              </div>
              <h3 className="text-2xl font-black italic uppercase">Free_Tier_Limit</h3>
            </div>
            <p className="font-bold text-lg leading-snug">
              {freeLimitMessage}
            </p>
            <div className="flex gap-4 pt-4">
              <button onClick={() => setShowFreeLimitPopup(false)} className="neo-button-white flex-1 py-3 text-sm">OK</button>
              <button onClick={() => window.location.href = '/subscription'} className="neo-button bg-neo-accent flex-1 py-3 text-sm">UPGRADE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
