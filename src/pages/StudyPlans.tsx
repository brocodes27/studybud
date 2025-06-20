import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Clock, Plus, Trash2, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { format, differenceInDays } from 'date-fns';

interface StudyPlan {
  id: string;
  class: string;
  subject: string;
  chapters: string;
  exam_date: string;
  plan: {
    days_until_exam: number;
    daily_schedule: Array<{
      day: number;
      date: string;
      topic: string;
    }>;
  };
  created_at: string;
}

export function StudyPlans() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudyPlans();
  }, [user]);

  const fetchStudyPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_plans')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudyPlans(data || []);
    } catch (error) {
      console.error('Error fetching study plans:', error);
      showToast('Failed to load study plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this study plan?')) return;

    try {
      const { error } = await supabase
        .from('exam_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setStudyPlans(prev => prev.filter(plan => plan.id !== planId));
      showToast('Study plan deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting study plan:', error);
      showToast('Failed to delete study plan', 'error');
    }
  };

  const getExamStatus = (examDate: string) => {
    const today = new Date();
    const exam = new Date(examDate);
    const daysUntil = differenceInDays(exam, today);

    if (daysUntil < 0) {
      return { status: 'completed', text: 'Completed', color: 'bg-gray-100 text-gray-800' };
    } else if (daysUntil === 0) {
      return { status: 'today', text: 'Today!', color: 'bg-red-100 text-red-800' };
    } else if (daysUntil <= 7) {
      return { status: 'urgent', text: `${daysUntil} days left`, color: 'bg-orange-100 text-orange-800' };
    } else {
      return { status: 'active', text: `${daysUntil} days left`, color: 'bg-blue-100 text-blue-800' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Study Plans</h1>
          <p className="text-gray-600 mt-2">Manage and track your personalized study schedules</p>
        </div>
        <Link
          to="/create"
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5" />
          Create New Plan
        </Link>
      </div>

      {/* Study Plans Grid */}
      {studyPlans.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No study plans yet</h3>
          <p className="text-gray-600 mb-6">Create your first AI-powered study plan to get started</p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="h-5 w-5" />
            Create Study Plan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studyPlans.map((plan) => {
            const examStatus = getExamStatus(plan.exam_date);
            
            return (
              <div key={plan.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-grow">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.subject}</h3>
                    <p className="text-gray-600">Class {plan.class}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${examStatus.color}`}>
                    {examStatus.text}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    Exam: {format(new Date(plan.exam_date), 'MMM d, yyyy')}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    {plan.plan.daily_schedule.length} days schedule
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <BookOpen className="h-4 w-4" />
                    {plan.chapters.split(',').length} chapters
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/study/${plan.id}`}
                    className="flex-1 bg-blue-600 text-white text-center py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                  >
                    <Eye className="h-4 w-4 inline mr-1" />
                    View Plan
                  </Link>
                  <button
                    onClick={() => deletePlan(plan.id)}
                    className="bg-red-100 text-red-600 hover:bg-red-200 p-2 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}