import { useEffect, useMemo, useState } from 'react';
import { subMonths, addMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { generateMonthlyCurriculum } from '../lib/curriculumApi';
import { Calendar, CheckCircle, Clock, Loader2, RefreshCw, Sparkles, ListChecks, AlertTriangle, Filter } from 'lucide-react';
import CurriculumTour from '../components/CurriculumTour.tsx';

interface CurriculumPlan {
  id: string;
  aim: 'cbse' | 'jee';
  class_level: string | null;
  subjects: string[] | null;
  is_active: boolean;
}

interface CurriculumTask {
  id: string;
  task_date: string; // YYYY-MM-DD
  subject: string | null;
  title: string | null;
  description: string | null;
  status: 'pending' | 'completed' | 'skipped' | 'rescheduled';
  source: 'monthly' | 'exam' | 'manual';
  plan_id?: string | null;
}

export function Curriculum() {
  const { user } = useAuth() as any;
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<CurriculumPlan | null>(null);
  const [tasks, setTasks] = useState<CurriculumTask[]>([]);
  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(new Date()));
  const [hasMonthlyPlan, setHasMonthlyPlan] = useState<boolean>(false);
  const [filterSource, setFilterSource] = useState<Record<string, boolean>>({ monthly: true, exam: true, manual: true });
  const [filterStatus, setFilterStatus] = useState<Record<string, boolean>>({ pending: true, completed: true, skipped: true, rescheduled: true });

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor]);
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor]);
  const monthKey = useMemo(() => format(monthStart, 'yyyy-MM'), [monthStart]);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    loadActivePlan().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !plan?.id) return;
    refreshMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, plan?.id, monthKey]);

  const loadActivePlan = async () => {
    try {
      const { data, error } = await supabase
        .from('curriculum_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        setPlan(data[0] as unknown as CurriculumPlan);
      } else {
        setPlan(null);
      }
    } catch (err: any) {
      console.error('Failed to load active curriculum plan', err);
      showToast(err.message || 'Failed to load active curriculum plan', 'error');
    }
  };

  const refreshMonth = async () => {
    if (!plan) return;
    try {
      // 1) Check if there is a monthly_curricula entry for this month
      const { data: monthly, error: monthlyErr } = await supabase
        .from('monthly_curricula')
        .select('id')
        .eq('user_id', user.id)
        .eq('curriculum_id', plan.id)
        .eq('month_start', format(monthStart, 'yyyy-MM-01'))
        .maybeSingle();

      if (monthlyErr && monthlyErr.code !== 'PGRST116') throw monthlyErr; // ignore not found
      setHasMonthlyPlan(!!monthly);

      // 2) Load tasks for the month
      const { data: taskRows, error: taskErr } = await supabase
        .from('curriculum_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('curriculum_id', plan.id)
        .gte('task_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('task_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('task_date', { ascending: true });
      if (taskErr) throw taskErr;
      setTasks((taskRows || []) as CurriculumTask[]);
    } catch (err: any) {
      console.error('Failed to refresh month', err);
      showToast(err.message || 'Failed to load curriculum tasks', 'error');
    }
  };

  const handleGenerateMonth = async () => {
    if (!plan) return;
    setGenerating(true);
    try {
      await generateMonthlyCurriculum({ curriculum_id: plan.id, month: format(monthStart, 'yyyy-MM') });
      showToast('Monthly curriculum generated', 'success');
      await refreshMonth();
    } catch (err: any) {
      // Try to parse server error JSON (may include stage)
      try {
        const parsed = JSON.parse(err.message);
        const extra = parsed?.stage ? ` (stage: ${parsed.stage})` : '';
        showToast(parsed?.error ? `${parsed.error}${extra}` : 'Failed to generate monthly curriculum', 'error');
      } catch {
        showToast(err.message || 'Failed to generate monthly curriculum', 'error');
      }
      console.error('Generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const toggleTaskCompleted = async (task: CurriculumTask) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const { error } = await supabase
        .from('curriculum_tasks')
        .update({ status: nextStatus })
        .eq('id', task.id)
        .eq('user_id', user.id);
      if (error) throw error;
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    } catch (err: any) {
      showToast(err.message || 'Failed to update task', 'error');
    }
  };

  const groupedTasks = useMemo(() => {
    const filtered = tasks.filter(t => filterSource[t.source] && filterStatus[t.status]);
    const map = new Map<string, CurriculumTask[]>();
    for (const t of filtered) {
      if (!map.has(t.task_date)) map.set(t.task_date, []);
      map.get(t.task_date)!.push(t);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, filterSource, filterStatus]);

  const counts = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      exam: tasks.filter(t => t.source === 'exam').length,
      monthly: tasks.filter(t => t.source === 'monthly').length,
      manual: tasks.filter(t => t.source === 'manual').length,
    };
  }, [tasks]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Guided Tour Overlay */}
      <CurriculumTour hasMonthlyPlan={hasMonthlyPlan} hasTasks={groupedTasks.length > 0} ready={!loading} />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-neon-blue to-blue-600 p-3 rounded-xl shadow-lg shadow-neon-blue/20">
              <ListChecks className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Curriculum</h1>
          </div>
          {plan ? (
            <p className="text-gray-400 ml-1">
              Aim: <span className="font-semibold text-neon-blue uppercase">{plan.aim}</span>
              {plan.class_level ? <span className="text-gray-500"> • </span> : null}
              {plan.class_level ? <>Class {plan.class_level}</> : null}
              {plan.subjects && plan.subjects.length ? (
                <>
                  <span className="text-gray-500"> • </span> Subjects: {plan.subjects.join(', ')}
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-gray-400 mt-1">No active curriculum plan found.</p>
          )}
        </div>

        {/* Month Navigator */}
        <div className="glass-panel p-1 rounded-xl flex items-center gap-1 border border-white/10">
          <button
            onClick={() => setMonthCursor(prev => subMonths(prev, 1))}
            className="px-3 py-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            data-tour="month-prev"
          >
            ‹ Prev
          </button>
          <div className="px-4 py-2 rounded-lg bg-white/5 text-white font-semibold flex items-center gap-2 border border-white/5" data-tour="month-label">
            <Calendar className="h-4 w-4 text-neon-blue" /> {format(monthStart, 'MMMM yyyy')}
          </div>
          <button
            onClick={() => setMonthCursor(prev => addMonths(prev, 1))}
            className="px-3 py-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            data-tour="month-next"
          >
            Next ›
          </button>
        </div>
      </div>

      {/* Actions / Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 border border-white/10 hover:border-neon-blue/30 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <Clock className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <div className="text-sm text-gray-400">Tasks this month</div>
              <div className="text-2xl font-bold text-white">{counts.total}
                <span className="text-sm font-medium text-gray-500 ml-2">({counts.completed} done)</span>
              </div>
            </div>
          </div>
        </div>
        <div className="glass-card p-5 border border-white/10 hover:border-neon-green/30 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30">
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <div className="text-sm text-gray-400">By Source</div>
              <div className="text-xs text-gray-500 mt-1">
                <span className="text-blue-400">Monthly: {counts.monthly}</span> • <span className="text-purple-400">Exam: {counts.exam}</span> • <span className="text-amber-400">Manual: {counts.manual}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="glass-card p-5 border border-white/10 flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {hasMonthlyPlan ? (
                <span className="inline-flex items-center gap-2 text-neon-green"><Sparkles className="h-4 w-4" /> Monthly plan active</span>
              ) : (
                <span className="inline-flex items-center gap-2 text-amber-400"><AlertTriangle className="h-4 w-4" /> No monthly plan</span>
              )}
            </div>
            {plan && (
              <button
                onClick={handleGenerateMonth}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 transition-all"
                data-tour="generate-btn"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {hasMonthlyPlan ? 'Regenerate' : 'Generate'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10" data-tour="filters">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Filter className="h-4 w-4 text-neon-blue" />
            Filter
          </div>
          <div className="flex items-center gap-3">
            {(['monthly', 'exam', 'manual'] as const).map(key => (
              <label key={key} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={filterSource[key]}
                  onChange={(e) => setFilterSource(s => ({ ...s, [key]: e.target.checked }))}
                  className="rounded border-gray-600 bg-black/40 text-neon-blue focus:ring-neon-blue/50"
                />
                <span className="capitalize">{key}</span>
              </label>
            ))}
          </div>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-3">
            {(['pending', 'completed', 'skipped', 'rescheduled'] as const).map(key => (
              <label key={key} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={filterStatus[key]}
                  onChange={(e) => setFilterStatus(s => ({ ...s, [key]: e.target.checked }))}
                  className="rounded border-gray-600 bg-black/40 text-neon-blue focus:ring-neon-blue/50"
                />
                <span className="capitalize">{key}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="min-h-[200px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
        </div>
      ) : !plan ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-white/5">
          <div className="w-20 h-20 rounded-2xl bg-white/5 mx-auto mb-6 flex items-center justify-center border border-white/10">
            <ListChecks className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No active curriculum plan</h3>
          <p className="text-gray-400 max-w-xl mx-auto">Go to the home page to set your aim and create a curriculum, or use the AI Study Buddy to generate a monthly plan.</p>
        </div>
      ) : groupedTasks.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-white/5">
          <div className="w-20 h-20 rounded-2xl bg-white/5 mx-auto mb-6 flex items-center justify-center border border-white/10">
            <Calendar className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No tasks this month</h3>
          <p className="text-gray-400 max-w-xl mx-auto">{hasMonthlyPlan ? 'Try adjusting filters or regenerate the month.' : 'Generate the monthly curriculum to see tasks here.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTasks.map(([date, dayTasks]) => (
            <div key={date} className="glass-card rounded-2xl border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                <div className="font-bold text-white">{format(new Date(`${date}T00:00:00`), 'EEEE, MMM dd')}</div>
                <div className="text-sm text-gray-400">{dayTasks.length} task{dayTasks.length > 1 ? 's' : ''}</div>
              </div>
              <div className="divide-y divide-white/5">
                {dayTasks.map(t => (
                  <div key={t.id} className="p-4 flex items-start gap-4 hover:bg-white/5 transition-colors">
                    <button
                      onClick={() => toggleTaskCompleted(t)}
                      className={`mt-1 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${t.status === 'completed' ? 'bg-neon-green/20 border-neon-green text-neon-green' : 'border-gray-600 text-transparent hover:border-neon-blue hover:text-neon-blue/50'}`}
                      title={t.status === 'completed' ? 'Mark as pending' : 'Mark as completed'}
                      data-tour="task-toggle"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {t.subject && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-xs font-medium border border-blue-500/20">
                            {t.subject}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${t.source === 'exam' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' : t.source === 'manual' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-gray-500/10 text-gray-300 border-gray-500/20'}`}>
                          {t.source}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${t.status === 'completed' ? 'bg-green-500/10 text-green-300 border-green-500/20' : t.status === 'pending' ? 'bg-gray-500/10 text-gray-300 border-gray-500/20' : t.status === 'skipped' ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'}`}>
                          {t.status}
                        </span>
                      </div>
                      <div className={`font-medium text-lg ${t.status === 'completed' ? 'text-gray-500 line-through' : 'text-white'} truncate`}>{t.title || 'Untitled task'}</div>
                      {t.description && (
                        <div className="mt-1 text-sm text-gray-400 whitespace-pre-wrap">{t.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Curriculum;
