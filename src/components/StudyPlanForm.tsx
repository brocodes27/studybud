import React, { useState, useEffect } from 'react';
import { Calendar, BookOpen, GraduationCap, FileText, Loader2, Pencil } from 'lucide-react';
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
  const { user } = useAuth();
  console.log('StudyPlanForm user:', user); // Debug log
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
  const [isSubscribed, setIsSubscribed] = useState(true); // Subscription always true for now
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    setShowPaywall(false); // Never show paywall
  }, []);

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
        <div className="text-2xl font-bold mb-2">Please log in to create a study plan.</div>
        <div className="text-gray-600 mb-4">You must be signed in to access this feature.</div>
        {/* Optionally, add a login button or link here */}
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create Study Plan</h2>
            <p className="text-gray-600">Get AI-powered personalized study schedule</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Pencil className="h-4 w-4" />
              Plan Name
            </label>
            <input
              type="text"
              value={formData.plan_name}
              onChange={(e) => handleInputChange('plan_name', e.target.value)}
              placeholder="e.g., JEE Final Sprint, Term-1 Physics"
              className={`w-full text-gray-900 placeholder-gray-500 px-4 py-3 rounded-xl border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                errors.plan_name
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
              }`}
            />
            {errors.plan_name && (
              <p className="text-red-600 text-sm mt-2">{errors.plan_name}</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <BookOpen className="h-4 w-4" />
                Class/Grade
              </label>
              <input
                type="text"
                value={formData.class}
                onChange={(e) => handleInputChange('class', e.target.value)}
                placeholder="e.g., 11, 12, BSc"
                className={`w-full text-gray-900 placeholder-gray-500 px-4 py-3 rounded-xl border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.class 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                }`}
              />
              {errors.class && (
                <p className="text-red-600 text-sm mt-2">{errors.class}</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <FileText className="h-4 w-4" />
                Subject
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="e.g., Physics, Mathematics"
                className={`w-full text-gray-900 placeholder-gray-500 px-4 py-3 rounded-xl border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.subject 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                }`}
              />
              {errors.subject && (
                <p className="text-red-600 text-sm mt-2">{errors.subject}</p>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <BookOpen className="h-4 w-4" />
              Chapters (comma-separated)
            </label>
            <textarea
              value={formData.chapters}
              onChange={(e) => handleInputChange('chapters', e.target.value)}
              placeholder="e.g., Gravitation, Motion, Thermodynamics"
              rows={3}
              className={`w-full text-gray-900 placeholder-gray-500 px-4 py-3 rounded-xl border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none ${
                errors.chapters 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
              }`}
            />
            {errors.chapters && (
              <p className="text-red-600 text-sm mt-2">{errors.chapters}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Calendar className="h-4 w-4" />
              Exam Date
            </label>
            <input
              type="date"
              value={formData.exam_date}
              onChange={(e) => handleInputChange('exam_date', e.target.value)}
              min={minDateString}
              className={`w-full text-gray-900 placeholder-gray-500 px-4 py-3 rounded-xl border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                errors.exam_date 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
              }`}
            />
            {errors.exam_date && (
              <p className="text-red-600 text-sm mt-2">{errors.exam_date}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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
    </div>
  );
}