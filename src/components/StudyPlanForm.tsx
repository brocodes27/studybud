import React, { useState, useEffect } from 'react';
import { Calendar, BookOpen, GraduationCap, FileText, Loader2, Pencil, AlertCircle, X, Target, Zap, Sparkles, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
  const { user } = useAuth() as any;

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
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
              className={`w-full bg-neo-bg text-black p-4 border-4 border-black font-black placeholder:text-black/20 focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all ${errors.plan_name ? 'bg-red-50' : ''}`}
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
              className="w-full bg-neo-bg text-black p-4 border-4 border-black font-black placeholder:text-black/20 focus:outline-none"
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
              className="w-full bg-neo-bg text-black p-4 border-4 border-black font-black placeholder:text-black/20 focus:outline-none"
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
            className="w-full bg-neo-bg text-black p-4 border-4 border-black font-black placeholder:text-black/20 focus:outline-none"
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
            className="w-full bg-neo-bg text-black p-4 border-4 border-black font-black focus:outline-none"
          />
          <p className="text-[10px] font-black text-black/40 mt-3 flex items-center gap-2">
            <HelpCircle className="h-3 w-3" /> MAX_PLAN_DURATION: 30_DAYS
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full neo-button bg-neo-accent py-6 text-2xl group relative overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-3 italic">
              <Loader2 className="h-6 w-6 animate-spin" /> GENERATING_LOGIC...
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
          <div className="neo-card bg-white p-8 max-w-md w-full border-8 border-black shadow-[20px_20px_0px_0px_#000] space-y-6">
            <div className="flex items-center gap-4 border-b-4 border-black pb-4">
              <div className="bg-neo-secondary p-2 border-2 border-black rotate-3">
                <AlertCircle className="h-6 w-6 text-black" />
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
    </div>
  );
}
