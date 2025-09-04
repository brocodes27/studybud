import { useEffect, useMemo, useState } from 'react';
import { subMonths, addMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { generateMonthlyCurriculum } from '../lib/curriculumApi';
import { Calendar, CheckCircle, Clock, Loader2, RefreshCw, Sparkles, ListChecks, AlertTriangle } from 'lucide-react';

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ListChecks className="h-7 w-7 text-blue-600" /> Curriculum
          </h1>
          {plan ? (
            <p className="text-gray-600 mt-1">
              Aim: <span className="font-semibold uppercase">{plan.aim}</span>
              {plan.class_level ? <> • Class {plan.class_level}</> : null}
              {plan.subjects && plan.subjects.length ? (
                <>
                  {' '}• Subjects: {plan.subjects.join(', ')}
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-gray-600 mt-1">No active curriculum plan found.</p>
          )}
        </div>

        {/* Month Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthCursor(prev => subMonths(prev, 1))}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
          >
            ‹ Prev
          </button>
          <div className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" /> {format(monthStart, 'MMMM yyyy')}
          </div>
          <button
            onClick={() => setMonthCursor(prev => addMonths(prev, 1))}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
          >
            Next ›
          </button>
        </div>
      </div>

      {/* Actions / Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-elevated">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Tasks this month</div>
              <div className="text-xl font-bold text-gray-900">{counts.total}
                <span className="text-sm font-medium text-gray-500 ml-2">({counts.completed} completed)</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card-elevated">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-gray-500">By Source</div>
              <div className="text-sm text-gray-700">Monthly: {counts.monthly} • Exam: {counts.exam} • Manual: {counts.manual}</div>
            </div>
          </div>
        </div>
        <div className="card-elevated">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {hasMonthlyPlan ? (
                <span className="inline-flex items-center gap-2 text-green-700"><Sparkles className="h-4 w-4" /> Monthly plan exists</span>
              ) : (
                <span className="inline-flex items-center gap-2 text-amber-700"><AlertTriangle className="h-4 w-4" /> No monthly plan yet</span>
              )}
            </div>
            {plan && (
              <button
                onClick={handleGenerateMonth}
                disabled={generating}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {hasMonthlyPlan ? 'Regenerate' : 'Generate'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm font-semibold text-gray-700">Filter</div>
          <div className="flex items-center gap-3">
            {(['monthly','exam','manual'] as const).map(key => (
              <label key={key} className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filterSource[key]}
                  onChange={(e) => setFilterSource(s => ({ ...s, [key]: e.target.checked }))}
                /> {key}
              </label>
            ))}
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-3">
            {(['pending','completed','skipped','rescheduled'] as const).map(key => (
              <label key={key} className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filterStatus[key]}
                  onChange={(e) => setFilterStatus(s => ({ ...s, [key]: e.target.checked }))}
                /> {key}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="min-h-[200px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : !plan ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 mx-auto mb-4 flex items-center justify-center">
            <ListChecks className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No active curriculum plan</h3>
          <p className="text-gray-600 max-w-xl mx-auto">Go to the home page to set your aim and create a curriculum, or use the AI Study Buddy to generate a monthly plan.</p>
        </div>
      ) : groupedTasks.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 mx-auto mb-4 flex items-center justify-center">
            <Calendar className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No tasks this month</h3>
          <p className="text-gray-600 max-w-xl mx-auto">{hasMonthlyPlan ? 'Try adjusting filters or regenerate the month.' : 'Generate the monthly curriculum to see tasks here.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTasks.map(([date, dayTasks]) => (
            <div key={date} className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="font-semibold text-gray-900">{format(new Date(`${date}T00:00:00`), 'EEEE, MMM dd')}</div>
                <div className="text-sm text-gray-600">{dayTasks.length} task{dayTasks.length > 1 ? 's' : ''}</div>
              </div>
              <div className="divide-y divide-gray-100">
                {dayTasks.map(t => (
                  <div key={t.id} className="p-4 flex items-start gap-4">
                    <button
                      onClick={() => toggleTaskCompleted(t)}
                      className={`mt-1 w-5 h-5 rounded border flex items-center justify-center ${t.status === 'completed' ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-transparent hover:text-gray-300'}`}
                      title={t.status === 'completed' ? 'Mark as pending' : 'Mark as completed'}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {t.subject && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                            {t.subject}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${t.source === 'exam' ? 'bg-purple-50 text-purple-700 border-purple-200' : t.source === 'manual' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-700 border-gray-200' }`}>
                          {t.source}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${t.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : t.status === 'pending' ? 'bg-gray-50 text-gray-700 border-gray-200' : t.status === 'skipped' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200' }`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="mt-1 font-medium text-gray-900 truncate">{t.title || 'Untitled task'}</div>
                      {t.description && (
                        <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{t.description}</div>
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
