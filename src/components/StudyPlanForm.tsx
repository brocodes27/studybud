import React, { useState, useEffect } from 'react';
import { Calendar, BookOpen, GraduationCap, FileText, Loader2, Pencil, AlertCircle, X } from 'lucide-react';
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
    // Keep user_id and email in sync with logged-in user
    setFormData(prev => ({ ...prev, user_id: user?.id, email: user?.email }));
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.plan_name.trim()) {
      newErrors.plan_name = 'Plan name is required';
    }

    if (!formData.class.trim()) {
      newErrors.class = 'Class is required';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.chapters.trim()) {
      newErrors.chapters = 'Chapters are required';
    }

    if (!formData.exam_date) {
      newErrors.exam_date = 'Exam date is required';
    } else {
      const examDate = new Date(formData.exam_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (examDate <= today) {
        newErrors.exam_date = 'Exam date must be in the future';
      } else {
        // Check for 30-day limit
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

  // Get minimum date (tomorrow)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateString = minDate.toISOString().split('T')[0];

  // Get maximum date (30 days from tomorrow)
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateString = maxDate.toISOString().split('T')[0];

  // Show loading spinner until user is loaded
  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show login prompt if user is not logged in
  if (user === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
        <div className="text-2xl font-bold mb-2 text-white">Please log in to create a study plan.</div>
        <div className="text-gray-400 mb-4">You must be signed in to access this feature.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="glass-card p-8 border border-white/10">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg shadow-blue-500/20">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Create Study Plan</h2>
            <p className="text-gray-400">Get AI-powered personalized study schedule</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
              <Pencil className="h-4 w-4 text-neon-blue" />
              Plan Name
            </label>
            <input
              type="text"
              value={formData.plan_name}
              onChange={(e) => handleInputChange('plan_name', e.target.value)}
              placeholder="e.g., JEE Final Sprint, Term-1 Physics"
              className={`w-full bg-black/20 text-white placeholder-gray-500 px-4 py-3 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neon-blue/50 backdrop-blur-sm ${errors.plan_name
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-white/10 hover:border-white/20 focus:border-neon-blue/50'
                }`}
            />
            {errors.plan_name && (
              <p className="text-red-400 text-sm mt-2">{errors.plan_name}</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
                <BookOpen className="h-4 w-4 text-neon-purple" />
                Class/Grade
              </label>
              <input
                type="text"
                value={formData.class}
                onChange={(e) => handleInputChange('class', e.target.value)}
                placeholder="e.g., 11, 12, BSc"
                className={`w-full bg-black/20 text-white placeholder-gray-500 px-4 py-3 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neon-purple/50 backdrop-blur-sm ${errors.class
                  ? 'border-red-500/50 bg-red-500/10'
                  : 'border-white/10 hover:border-white/20 focus:border-neon-purple/50'
                  }`}
              />
              {errors.class && (
                <p className="text-red-400 text-sm mt-2">{errors.class}</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
                <FileText className="h-4 w-4 text-neon-green" />
                Subject
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="e.g., Physics, Mathematics"
                className={`w-full bg-black/20 text-white placeholder-gray-500 px-4 py-3 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neon-green/50 backdrop-blur-sm ${errors.subject
                  ? 'border-red-500/50 bg-red-500/10'
                  : 'border-white/10 hover:border-white/20 focus:border-neon-green/50'
                  }`}
              />
              {errors.subject && (
                <p className="text-red-400 text-sm mt-2">{errors.subject}</p>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
              <BookOpen className="h-4 w-4 text-neon-yellow" />
              Chapters (comma-separated)
            </label>
            <textarea
              value={formData.chapters}
              onChange={(e) => handleInputChange('chapters', e.target.value)}
              placeholder="e.g., Gravitation, Motion, Thermodynamics"
              rows={3}
              className={`w-full bg-black/20 text-white placeholder-gray-500 px-4 py-3 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neon-yellow/50 resize-none backdrop-blur-sm ${errors.chapters
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-white/10 hover:border-white/20 focus:border-neon-yellow/50'
                }`}
            />
            {errors.chapters && (
              <p className="text-red-400 text-sm mt-2">{errors.chapters}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
              <Calendar className="h-4 w-4 text-neon-blue" />
              Exam Date
            </label>
            <input
              type="date"
              value={formData.exam_date}
              onChange={(e) => handleInputChange('exam_date', e.target.value)}
              min={minDateString}
              max={maxDateString}
              className={`w-full bg-black/20 text-white placeholder-gray-500 px-4 py-3 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neon-blue/50 backdrop-blur-sm ${errors.exam_date
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-white/10 hover:border-white/20 focus:border-neon-blue/50'
                }`}
            />
            {errors.exam_date && (
              <p className="text-red-400 text-sm mt-2">{errors.exam_date}</p>
            )}
            <p className="text-gray-500 text-sm mt-2">
              💡 Maximum study period is 30 days to ensure reliable AI-generated plans
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/25 border border-white/10"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Study Plan...
              </div>
            ) : (
              'Generate Study Plan'
            )}
          </button>
        </form>
      </div>

      {/* 30-Day Limit Popup */}
      {showLimitPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel max-w-md w-full p-6 relative rounded-2xl border border-white/10">
            <button
              onClick={() => setShowLimitPopup(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500/20 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Study Period Limit</h3>
                <p className="text-sm text-gray-400">Maximum 30 days allowed</p>
              </div>
            </div>

            <p className="text-gray-300 mb-6">
              To ensure reliable AI-generated study plans, we limit the study period to a maximum of 30 days.
              This helps prevent response truncation and ensures you get a complete, high-quality study schedule.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLimitPopup(false)}
                className="flex-1 bg-white/5 text-white py-2 px-4 rounded-xl font-medium hover:bg-white/10 transition-colors border border-white/10"
              >
                Got it
              </button>
              <button
                onClick={() => {
                  setShowLimitPopup(false);
                  // Set the exam date to one month from yesterday
                  const newDate = new Date();
                  newDate.setDate(newDate.getDate() - 1); // Yesterday
                  newDate.setMonth(newDate.getMonth() + 1); // One month later
                  handleInputChange('exam_date', newDate.toISOString().split('T')[0]);
                }}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
              >
                Set to 1 month
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}