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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner w-12 h-12"></div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      {/* Header */}
      <div className="text-center mb-16 relative">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-10 pointer-events-none whitespace-nowrap overflow-hidden w-full">
          <span className="text-[120px] font-black uppercase tracking-[0.2em] text-black italic leading-none select-none">SCHEDULES</span>
        </div>
        <h1 className="text-6xl md:text-8xl font-black text-black mb-6 tracking-tighter uppercase italic relative z-10">
          MY <span className="text-neo-accent stroke-text">STUDY PLANS</span>
        </h1>
        <p className="text-black font-bold text-xl uppercase tracking-widest bg-neo-secondary border-4 border-black px-6 py-2 inline-block -rotate-1 shadow-[4px_4px_0px_0px_#000]">
          MANAGE YOUR MENTAL BLUEPRINTS
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        {[
          { label: 'TOTAL PLANS', value: studyPlans.length, icon: BookOpen, color: 'bg-neo-muted' },
          { label: 'ACTIVE PLANS', value: studyPlans.filter(p => new Date(p.exam_date) > new Date()).length, icon: Target, color: 'bg-neo-secondary' },
          { label: 'THIS WEEK', value: studyPlans.filter(p => { const d = differenceInDays(new Date(p.exam_date), new Date()); return d <= 7 && d >= 0; }).length, icon: AlertCircle, color: 'bg-neo-accent', text: 'text-white' },
          { label: 'COMPLETED', value: studyPlans.filter(p => new Date(p.exam_date) < new Date()).length, icon: TrendingUp, color: 'bg-white' }
        ].map((stat, index) => (
          <div key={index} className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000] rotate-1 hover:rotate-0 transition-transform">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 border-4 border-black ${stat.color} ${stat.text || 'text-black'} flex items-center justify-center shadow-[4px_4px_0px_0px_#000]`}>
                <stat.icon className="w-8 h-8 stroke-[3px]" />
              </div>
              <div>
                <p className="text-[10px] font-black text-black/40 uppercase tracking-widest">{stat.label}</p>
                <p className="text-3xl font-black text-black tracking-tighter italic leading-none mt-1">{stat.value.toString().padStart(2, '0')}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create New Plan Button */}
      <div className="flex justify-center mb-16">
        <Link to="/create">
          <button className="bg-black text-white px-12 py-6 text-xl font-black uppercase tracking-widest border-4 border-black shadow-[8px_8px_0px_0px_#FF6B6B] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] active:scale-95 transition-all flex items-center gap-4">
            <Plus className="w-8 h-8 stroke-[4px]" />
            NEW BLUEPRINT
          </button>
        </Link>
      </div>

      {/* Study Plans Grid */}
      {studyPlans.length === 0 ? (
        <div className="text-center py-24 bg-white border-8 border-black shadow-[16px_16px_0px_0px_#000] -rotate-1">
          <div className="w-32 h-32 bg-neo-muted border-4 border-black flex items-center justify-center mx-auto mb-10 shadow-[6px_6px_0px_0px_#000] rotate-12">
            <BookOpen className="w-16 h-16 text-black stroke-[3px]" />
          </div>
          <h3 className="text-4xl font-black text-black uppercase tracking-tighter mb-6">EMPTY ARCHIVE</h3>
          <p className="text-black/60 font-bold mb-12 text-xl max-w-md mx-auto leading-snug">NO STUDY PLANS DETECTED. INITIALIZE YOUR FIRST LEARNING SEQUENCE.</p>
          <Link to="/create">
            <button className="bg-neo-accent text-white px-10 py-5 font-black uppercase tracking-widest border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all">
              INITIALIZE PLAN
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {studyPlans.map((plan, idx) => {
            const progress = getPlanProgress(plan);
            const status = getPlanStatus(plan);
            const daysUntil = differenceInDays(new Date(plan.exam_date), new Date());
            const rotation = idx % 2 === 0 ? 'rotate-1' : '-rotate-1';

            return (
              <div key={plan.id} className={`bg-white border-4 border-black p-8 shadow-[10px_10px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_#000] transition-all group ${rotation}`}>
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex-1 min-w-0 pr-4">
                      {editingPlanId === plan.id ? (
                        <div className="flex flex-col gap-4">
                          <input
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            className="w-full bg-neo-bg border-4 border-black p-3 font-black uppercase text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_#000]"
                            placeholder="PLAN NAME..."
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => updatePlanName(plan.id)}
                              className="flex-1 bg-neo-accent text-white border-2 border-black p-2 font-black uppercase text-[10px] shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                            >
                              SAVE
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="flex-1 bg-white border-2 border-black p-2 font-black uppercase text-[10px] shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                            >
                              CANCEL
                            </button>
                          </div>
                        </div>
                      ) : (
                        <h3 className="text-2xl font-black text-black uppercase tracking-tight italic leading-tight group-hover:text-neo-accent transition-colors truncate">
                          {plan.plan_name || `${plan.subject} MISSION`}
                        </h3>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => startEditing(plan)}
                        className="p-2 border-2 border-black bg-neo-bg shadow-[2px_2px_0px_0px_#000] hover:bg-neo-secondary active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all"
                      >
                        <Pencil className="w-4 h-4 text-black stroke-[3px]" />
                      </button>
                      <button
                        onClick={() => deletePlan(plan.id)}
                        className="p-2 border-2 border-black bg-neo-bg shadow-[2px_2px_0px_0px_#000] hover:bg-red-500 hover:text-white active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all"
                      >
                        <Trash2 className="w-4 h-4 stroke-[3px]" />
                      </button>
                    </div>
                  </div>

                  {/* Plan Details */}
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-black/60">
                      <div className="bg-neo-muted p-1 border-2 border-black"><BookOpen className="w-3 h-3 text-black stroke-[3px]" /></div>
                      {plan.subject}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-black/60">
                      <div className="bg-neo-accent p-1 border-2 border-black"><Calendar className="w-3 h-3 text-white stroke-[3px]" /></div>
                      EXAM: {format(new Date(plan.exam_date), 'MMM dd, yyyy')}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-black/60">
                      <div className="bg-neo-secondary p-1 border-2 border-black"><Clock className="w-3 h-3 text-black stroke-[3px]" /></div>
                      {plan.plan.daily_schedule.length} STUDY SESSIONS
                    </div>

                    {/* Upcoming preview */}
                    {(() => {
                      const upcoming = getUpcoming(plan);
                      return (
                        <div className="mt-8 p-5 bg-neo-bg border-4 border-black shadow-[4px_4px_0px_0px_#000] rotate-1">
                          <div className="text-[10px] font-black text-black/40 mb-4 uppercase tracking-[0.2em] border-b-2 border-black pb-2">NEXT STEPS</div>
                          {upcoming.length > 0 ? (
                            <ul className="space-y-3">
                              {upcoming.map((d) => (
                                <li key={`${plan.id}-${d.date}-${d.topic}`} className="flex flex-col gap-1">
                                  <span className="font-black text-neo-accent text-[9px] uppercase tracking-tighter italic">
                                    {format(new Date(`${d.date}T00:00:00`), 'dd MMMM')}
                                  </span>
                                  <span className="text-xs font-black text-black uppercase tracking-tight leading-tight truncate">{d.topic}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-xs font-black text-black/20 italic uppercase tracking-widest py-2">NO DATA DETECTED</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-3">
                      <span>MISSION PROGRESS</span>
                      <span className="bg-neo-accent text-white px-2 py-0.5 border-2 border-black">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-black/10 border-4 border-black h-8 relative overflow-hidden">
                      <div
                        className="h-full bg-neo-secondary border-r-4 border-black transition-all duration-700 ease-out"
                        style={{ width: `${progress}%` }}
                      >
                        {progress > 10 && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                            <span className="text-[8px] font-black uppercase tracking-[0.5em] whitespace-nowrap">EXTRACTING DATA...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-8 pt-4 border-t-2 border-black/10">
                    <div className={`px-4 py-2 border-4 border-black font-black uppercase tracking-widest text-[9px] shadow-[3px_3px_0px_0px_#000] ${status.color === 'success' ? 'bg-neo-secondary' :
                      status.color === 'warning' ? 'bg-neo-accent text-white' :
                        status.color === 'primary' ? 'bg-neo-muted' :
                          'bg-white'
                      }`}>
                      {status.text}
                    </div>
                    {daysUntil >= 0 && (
                      <div className="text-[10px] font-black uppercase tracking-widest text-black/40 italic">
                        {daysUntil === 0 ? 'D-DAY' : `T-MINUS ${daysUntil} DAYS`}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    <Link to={`/study/${plan.id}`} className="flex-1">
                      <button className="w-full py-4 bg-black text-white font-black uppercase tracking-widest text-[10px] border-4 border-black shadow-[4px_4px_0px_0px_#FF6B6B] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-3">
                        <Eye className="w-4 h-4 stroke-[3px]" /> VIEW
                      </button>
                    </Link>
                    <Link to={`/study/${plan.id}`} className="flex-1">
                      <button className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-[10px] border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all">
                        DEPLOY STUDY
                      </button>
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