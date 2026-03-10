import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Clock, Plus, Trash2, Eye, Pencil, Target, TrendingUp, AlertCircle } from 'lucide-react';
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[20px] flex items-center justify-center shadow-float-cyan">
            <BookOpen className="h-7 w-7 text-[#00D1FF] stroke-[2.5px]" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">My Study Plans</h1>
            <p className="text-[#64748B] font-medium">Manage your learning roadmaps</p>
          </div>
        </div>
        <Link to="/create">
          <button className="neo-button flex items-center gap-2 px-6 py-3 text-sm">
            <Plus className="w-4 h-4 stroke-[3px]" /> New Plan
          </button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Total Plans', value: studyPlans.length, icon: BookOpen, color: 'text-[#00D1FF]', bg: 'bg-[#00D1FF]/10 border-[#00D1FF]/20' },
          { label: 'Active', value: studyPlans.filter(p => new Date(p.exam_date) > new Date()).length, icon: Target, color: 'text-[#34D399]', bg: 'bg-[#34D399]/10 border-[#34D399]/20' },
          { label: 'This Week', value: studyPlans.filter(p => { const d = differenceInDays(new Date(p.exam_date), new Date()); return d <= 7 && d >= 0; }).length, icon: AlertCircle, color: 'text-[#F472B6]', bg: 'bg-[#F472B6]/10 border-[#F472B6]/20' },
          { label: 'Completed', value: studyPlans.filter(p => new Date(p.exam_date) < new Date()).length, icon: TrendingUp, color: 'text-[#64748B]', bg: 'bg-slate-100 border-[#0A192F]/5' }
        ].map((stat, index) => (
          <div key={index} className="neo-card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-[14px] border flex items-center justify-center shrink-0 ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color} stroke-[2.5px]`} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-extrabold text-[#0A192F] tracking-tight leading-none mt-0.5">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Study Plans Grid */}
      {studyPlans.length === 0 ? (
        <div className="neo-card text-center py-20">
          <div className="w-20 h-20 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[20px] flex items-center justify-center mx-auto mb-6 shadow-float-cyan">
            <BookOpen className="w-10 h-10 text-[#00D1FF] stroke-[2px]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#0A192F] tracking-tight mb-3">No study plans yet</h3>
          <p className="text-[#64748B] font-medium mb-8 max-w-md mx-auto">Create your first AI-powered study plan to get started on your learning journey.</p>
          <Link to="/create">
            <button className="neo-button px-8 py-3">Create First Plan</button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studyPlans.map((plan) => {
            const progress = getPlanProgress(plan);
            const status = getPlanStatus(plan);
            const daysUntil = differenceInDays(new Date(plan.exam_date), new Date());

            return (
              <div key={plan.id} className="neo-card hover:-translate-y-1 transition-all group">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1 min-w-0 pr-3">
                    {editingPlanId === plan.id ? (
                      <div className="flex flex-col gap-3">
                        <input
                          value={newPlanName}
                          onChange={(e) => setNewPlanName(e.target.value)}
                          className="neo-input w-full p-2 text-sm"
                          placeholder="Plan name..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => updatePlanName(plan.id)}
                            className="flex-1 neo-button py-1.5 text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="flex-1 px-3 py-1.5 rounded-[10px] border-2 border-[#0A192F]/10 text-[#64748B] font-bold text-xs hover:border-[#0A192F]/20 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight leading-tight group-hover:text-[#00D1FF] transition-colors truncate">
                        {plan.plan_name || `${plan.subject} Plan`}
                      </h3>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditing(plan)}
                      className="p-2 rounded-[10px] border-2 border-[#0A192F]/5 text-[#64748B] hover:border-[#00D1FF]/20 hover:text-[#00D1FF] transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5 stroke-[2.5px]" />
                    </button>
                    <button
                      onClick={() => deletePlan(plan.id)}
                      className="p-2 rounded-[10px] border-2 border-[#0A192F]/5 text-[#64748B] hover:border-red-200 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 stroke-[2.5px]" />
                    </button>
                  </div>
                </div>

                {/* Plan Details */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-[#64748B] font-medium">
                    <BookOpen className="w-4 h-4 text-[#00D1FF] stroke-[2.5px]" />
                    {plan.subject}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#64748B] font-medium">
                    <Calendar className="w-4 h-4 text-[#F472B6] stroke-[2.5px]" />
                    Exam: {format(new Date(plan.exam_date), 'MMM dd, yyyy')}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#64748B] font-medium">
                    <Clock className="w-4 h-4 text-[#34D399] stroke-[2.5px]" />
                    {plan.plan.daily_schedule.length} study sessions
                  </div>
                </div>

                {/* Upcoming preview */}
                {(() => {
                  const upcoming = getUpcoming(plan);
                  return upcoming.length > 0 ? (
                    <div className="mb-6 p-4 bg-[#F8FAFF] rounded-[16px] border-2 border-[#0A192F]/5">
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-3">Upcoming</p>
                      <ul className="space-y-2">
                        {upcoming.map((d) => (
                          <li key={`${plan.id}-${d.date}-${d.topic}`} className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-[#00D1FF] uppercase tracking-widest">
                              {format(new Date(`${d.date}T00:00:00`), 'dd MMM')}
                            </span>
                            <span className="text-xs font-medium text-[#0A192F] truncate">{d.topic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null;
                })()}

                {/* Progress Bar */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#64748B] mb-2">
                    <span>Progress</span>
                    <span className="text-[#00D1FF] font-extrabold">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-[#F8FAFF] rounded-full h-2 overflow-hidden border border-[#0A192F]/5">
                    <div
                      className="h-full bg-[#00D1FF] rounded-full transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Status & Countdown */}
                <div className="flex items-center justify-between mb-5 pt-4 border-t border-[#0A192F]/5">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    status.color === 'success' ? 'bg-[#34D399]/10 text-[#34D399]' :
                    status.color === 'warning' ? 'bg-[#F472B6]/10 text-[#F472B6]' :
                    status.color === 'primary' ? 'bg-[#00D1FF]/10 text-[#00D1FF]' :
                    'bg-slate-100 text-[#64748B]'
                  }`}>
                    {status.text}
                  </span>
                  {daysUntil >= 0 && (
                    <span className="text-xs font-bold text-[#64748B]">
                      {daysUntil === 0 ? 'Today!' : `${daysUntil} days left`}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Link to={`/study/${plan.id}`} className="flex-1">
                    <button className="w-full py-3 rounded-[14px] bg-[#0A192F] text-white font-bold text-sm hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2">
                      <Eye className="w-4 h-4 stroke-[2.5px]" /> View Plan
                    </button>
                  </Link>
                  <Link to={`/study/${plan.id}`} className="flex-1">
                    <button className="w-full py-3 rounded-[14px] border-2 border-[#00D1FF]/20 text-[#00D1FF] font-bold text-sm hover:bg-[#00D1FF]/5 transition-all">
                      Study Now
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

}