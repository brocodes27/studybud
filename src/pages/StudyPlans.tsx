import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Clock, Plus, Trash2, Eye, Pencil, Check, X, Target, TrendingUp, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
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
  const { user } = useAuth() as any;
  const { showToast } = useToast();
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState('');

  useEffect(() => {
    fetchStudyPlans();
  }, [user]);

  // Realtime: refresh when any of the user's exam_plans change (e.g., reschedule)
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('exam_plans_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_plans', filter: `user_id=eq.${user.id}` },
        () => {
          fetchStudyPlans();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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
      } catch (dependentErr) {
        console.error('Failed to remove dependent records:', dependentErr);
      }

      // Finally delete the plan
      const { error } = await supabase
        .from('exam_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', user?.id);

      if (error) throw error;

      showToast('Study plan deleted successfully', 'success');
      fetchStudyPlans();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete study plan', 'error');
    }
  };

  const updatePlanName = async (planId: string) => {
    if (!newPlanName.trim()) {
      showToast('Plan name cannot be empty', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('exam_plans')
        .update({ plan_name: newPlanName.trim() })
        .eq('id', planId)
        .eq('user_id', user?.id);

      if (error) throw error;

      showToast('Plan name updated successfully', 'success');
      setEditingPlanId(null);
      setNewPlanName('');
      fetchStudyPlans();
    } catch (error: any) {
      showToast(error.message || 'Failed to update plan name', 'error');
    }
  };

  const startEditing = (plan: StudyPlan) => {
    setEditingPlanId(plan.id);
    setNewPlanName(plan.plan_name || '');
  };

  const cancelEditing = () => {
    setEditingPlanId(null);
    setNewPlanName('');
  };

  const getPlanProgress = (plan: StudyPlan) => {
    const today = new Date();
    const examDate = new Date(plan.exam_date);
    const totalDays = plan.plan.days_until_exam;
    const daysElapsed = Math.max(0, totalDays - differenceInDays(examDate, today));
    return Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
  };

  const getPlanStatus = (plan: StudyPlan) => {
    const today = new Date();
    const examDate = new Date(plan.exam_date);
    const daysUntil = differenceInDays(examDate, today);

    if (daysUntil < 0) return { status: 'completed', color: 'success', text: 'Completed' };
    if (daysUntil <= 7) return { status: 'urgent', color: 'warning', text: 'This Week' };
    if (daysUntil <= 30) return { status: 'upcoming', color: 'primary', text: 'Upcoming' };
    return { status: 'future', color: 'secondary', text: 'Future' };
  };

  const getUpcoming = (plan: StudyPlan) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const sched = Array.isArray(plan?.plan?.daily_schedule) ? plan.plan.daily_schedule : [];
    return sched
      .filter((d: any) => d?.date && d.date >= todayStr)
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 3);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner w-12 h-12"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          My <span className="gradient-text-primary">Study Plans</span>
        </h1>
        <p className="text-gray-400 text-lg">Manage and track your personalized study schedules</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="glass-card p-6 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">Total Plans</p>
              <p className="text-2xl font-bold text-white">{studyPlans.length}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">Active Plans</p>
              <p className="text-2xl font-bold text-white">
                {studyPlans.filter(plan => new Date(plan.exam_date) > new Date()).length}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">This Week</p>
              <p className="text-2xl font-bold text-white">
                {studyPlans.filter(plan => {
                  const daysUntil = differenceInDays(new Date(plan.exam_date), new Date());
                  return daysUntil <= 7 && daysUntil >= 0;
                }).length}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">Completed</p>
              <p className="text-2xl font-bold text-white">
                {studyPlans.filter(plan => new Date(plan.exam_date) < new Date()).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create New Plan Button */}
      <div className="flex justify-center mb-8">
        <Link to="/create">
          <Button variant="primary" size="lg" icon={<Plus className="w-5 h-5" />}>
            Create New Study Plan
          </Button>
        </Link>
      </div>

      {/* Study Plans Grid */}
      {studyPlans.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-white/10">
          <div className="w-24 h-24 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-12 h-12 text-gray-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-4">No Study Plans Yet</h3>
          <p className="text-gray-400 mb-8 text-lg">Create your first study plan to get started with personalized learning</p>
          <Link to="/create">
            <Button variant="primary" size="lg" icon={<Sparkles className="w-5 h-5" />}>
              Create Your First Plan
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studyPlans.map((plan) => {
            const progress = getPlanProgress(plan);
            const status = getPlanStatus(plan);
            const daysUntil = differenceInDays(new Date(plan.exam_date), new Date());

            return (
              <div key={plan.id} className="glass-card p-6 border border-white/10 hover:border-neon-blue/30 transition-all duration-300 group relative overflow-hidden">
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-neon-blue/0 via-neon-blue/10 to-neon-purple/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      {editingPlanId === plan.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            className="flex-1 bg-black/40 border-white/20 text-white"
                            placeholder="Enter plan name"
                          />
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => updatePlanName(plan.id)}
                            icon={<Check className="w-4 h-4" />}
                          >
                            Save
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={cancelEditing}
                            icon={<X className="w-4 h-4" />}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <h3 className="text-lg font-bold text-white truncate group-hover:text-neon-blue transition-colors">
                          {plan.plan_name || `${plan.subject} Study Plan`}
                        </h3>
                      )}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditing(plan)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePlan(plan.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Plan Details */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <BookOpen className="w-4 h-4 text-neon-purple" />
                      <span>{plan.subject}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="w-4 h-4 text-neon-blue" />
                      <span>Exam: {format(new Date(plan.exam_date), 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Clock className="w-4 h-4 text-neon-green" />
                      <span>{plan.plan.daily_schedule.length} study sessions</span>
                    </div>

                    {/* Upcoming preview */}
                    {(() => {
                      const upcoming = getUpcoming(plan);
                      return (
                        <div className="mt-4 p-3 rounded-xl bg-black/20 border border-white/5">
                          <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">Upcoming Sessions</div>
                          {upcoming.length > 0 ? (
                            <ul className="text-sm text-gray-400 space-y-2">
                              {upcoming.map((d) => (
                                <li key={`${plan.id}-${d.date}-${d.topic}`} className="flex items-start gap-2">
                                  <span className="text-neon-blue font-mono text-xs mt-0.5">
                                    {format(new Date(`${d.date}T00:00:00`), 'dd MMM')}
                                  </span>
                                  <span className="truncate text-gray-300">{d.topic}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-sm text-gray-500 italic">No upcoming sessions</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                      <span>Progress</span>
                      <span className="text-white font-medium">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 shadow-[0_0_10px_currentColor] ${status.status === 'completed'
                            ? 'bg-green-500 text-green-500'
                            : status.status === 'urgent'
                              ? 'bg-yellow-500 text-yellow-500'
                              : 'bg-neon-blue text-neon-blue'
                          }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${status.color === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        status.color === 'warning' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                          status.color === 'primary' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                      {status.text}
                    </span>
                    {daysUntil >= 0 && (
                      <span className="text-sm text-gray-400 font-medium">
                        {daysUntil === 0 ? 'Today' : `${daysUntil} days left`}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Link to={`/study/${plan.id}`} className="flex-1">
                      <Button variant="primary" size="sm" className="w-full shadow-lg shadow-primary-500/20" icon={<Eye className="w-4 h-4" />}>
                        View Plan
                      </Button>
                    </Link>
                    <Link to={`/study/${plan.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full hover:bg-white/5 border-white/20 text-white">
                        Start Study
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}