import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Clock, Plus, Trash2, Eye, Pencil, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { format, differenceInDays } from 'date-fns';

interface StudyPlan {
  id: string;
  plan_name?: string;
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
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState('');

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
    if (!confirm('Deleting this study plan will UNLINK associated flashcards and practice tests but permanently remove study sessions and progress data. This action cannot be undone. Continue?')) return;

    try {
      // Unlink flashcards and practice tests from this plan instead of deleting them
      const unlinkResources = async () => {
        const { error: fcErr } = await supabase
          .from('flashcards')
          .update({ plan_id: null })
          .eq('plan_id', planId)
          .eq('user_id', user?.id);

        if (fcErr) throw new Error(`Unable to unlink flashcards: ${fcErr.message}`);

        const { error: ptErr } = await supabase
          .from('practice_tests')
          .update({ plan_id: null })
          .eq('plan_id', planId)
          .eq('user_id', user?.id);

        if (ptErr) throw new Error(`Unable to unlink practice tests: ${ptErr.message}`);
      };

      try {
        await unlinkResources();
      } catch (linkErr) {
        console.warn((linkErr as Error).message);
        showToast('Failed to unlink flashcards or practice tests; deletion cancelled', 'error');
        return;
      }

      // Remove other dependent records that should not live without the plan
      try {
        const { data: testIds, error: testsErr } = await supabase
          .from('practice_tests')
          .select('id')
          .eq('plan_id', planId);
        if (testsErr) throw testsErr;
        const ids = (testIds || []).map(t => t.id);
        if (ids.length) {
          const { error: attemptsErr } = await supabase
            .from('practice_test_attempts')
            .delete()
            .in('practice_test_id', ids);
          if (attemptsErr) throw attemptsErr;
        }
      } catch (nestedErr) {
        console.warn('Unable to delete practice_test_attempts:', (nestedErr as Error).message);
      }

      // Step 2: remove other dependent records directly referencing the plan
      const tablesToDelete = ['study_sessions', 'task_completions'];
      for (const table of tablesToDelete) {
        const { error: childErr } = await supabase
          .from(table)
          .delete()
          .eq('plan_id', planId);
        if (childErr) {
          console.warn(`Unable to delete from ${table}:`, childErr.message);
        }
      }

      // Now delete the actual plan. Use `select()` so Supabase returns the deleted row(s).
      const { data, error } = await supabase
        .from('exam_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', user?.id)
        .select();

      if (error) throw error;
      // If no rows returned, maybe policy requires only id filter. Retry once without user_id
      let rows = data;
      if (!rows || rows.length === 0) {
        const { data: retryData, error: retryError } = await supabase
          .from('exam_plans')
          .delete()
          .eq('id', planId)
          .select();

        if (retryError) throw retryError;
        rows = retryData;
      }

      if (!rows || rows.length === 0) {
        throw new Error('Deletion was not permitted by server policies.');
      }

      // Refresh list from server to be 100% sure the record is gone
      fetchStudyPlans();
      showToast('Study plan deleted and resources unlinked successfully', 'success');
    } catch (error) {
      console.error('Error deleting study plan:', error);
      showToast('Failed to delete study plan', 'error');
    }
    };

  const startEditingPlan = (plan: StudyPlan) => {
    setEditingPlanId(plan.id);
    setNewPlanName(plan.plan_name || plan.subject);
  };

  const savePlanName = async (planId: string) => {
    const trimmed = newPlanName.trim();
    if (!trimmed) {
      showToast('Plan name cannot be empty', 'error');
      return;
    }
    try {
      const { error } = await supabase
        .from('exam_plans')
        .update({ plan_name: trimmed })
        .eq('id', planId);
      if (error) throw error;
      setEditingPlanId(null);
      fetchStudyPlans();
      showToast('Plan name updated', 'success');
    } catch (e) {
      console.error('savePlanName error', e);
      showToast('Failed to update plan name', 'error');
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
                    {editingPlanId === plan.id ? (
                        <>
                          <input
                            type="text"
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            className="text-xl font-bold text-gray-900 mb-1 w-full border-b border-gray-300 focus:outline-none"
                          />
                          <div className="flex gap-1 mt-1">
                            <button
                              onClick={() => savePlanName(plan.id)}
                              className="text-green-600 p-1"
                              title="Save name"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingPlanId(null);
                                setNewPlanName('');
                              }}
                              className="text-gray-500 p-1"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.plan_name || plan.subject}</h3>
                          <button
                            onClick={() => startEditingPlan(plan)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Rename plan"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      )}
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