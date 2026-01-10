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
    <div className="space-y-12 animate-fade-in pb-20 min-h-screen bg-neo-bg">
      {/* Guided Tour Overlay */}
      <CurriculumTour hasMonthlyPlan={hasMonthlyPlan} hasTasks={groupedTasks.length > 0} ready={!loading} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 border-b-8 border-black pb-8">
        <div>
          <div className="flex items-center gap-6 mb-4">
            <div className="bg-neo-accent p-4 border-4 border-black shadow-[6px_6px_0px_0px_#000] -rotate-3 hover:rotate-0 transition-transform">
              <ListChecks className="h-8 w-8 text-white stroke-[3px]" />
            </div>
            <div>
              <h1 className="text-5xl font-black text-black uppercase tracking-tighter italic leading-none">CURRICULUM</h1>
              <div className="bg-black text-white px-3 py-1 text-xs font-black uppercase tracking-widest inline-block -rotate-1 mt-2">
                ACADEMIC_PROTOCOL_V1
              </div>
            </div>
          </div>

          {plan ? (
            <div className="flex flex-wrap gap-3 ml-2 font-bold text-black/60 uppercase text-sm tracking-wide">
              <span className="bg-neo-secondary text-black px-2 py-0.5 border-2 border-black">AIM: {plan.aim}</span>
              {plan.class_level && <span className="bg-white px-2 py-0.5 border-2 border-black">CLASS {plan.class_level}</span>}
              {plan.subjects && plan.subjects.length > 0 && (
                <span className="bg-neo-muted px-2 py-0.5 border-2 border-black">SUBJ: {plan.subjects.length}</span>
              )}
            </div>
          ) : (
            <div className="text-black font-bold uppercase tracking-widest bg-neo-secondary border-2 border-black px-4 py-2 inline-block">
              NO ACTIVE PLAN DETECTED
            </div>
          )}
        </div>

        {/* Month Navigator */}
        <div className="bg-white p-2 border-4 border-black shadow-[8px_8px_0px_0px_#000] flex items-center gap-2 rotate-1">
          <button
            onClick={() => setMonthCursor(prev => subMonths(prev, 1))}
            className="px-4 py-3 bg-neo-bg border-2 border-black hover:bg-black hover:text-white transition-all font-black uppercase text-sm"
            data-tour="month-prev"
          >
            PREV
          </button>
          <div className="px-6 py-3 bg-neo-accent text-white border-2 border-black font-black flex items-center gap-3 uppercase tracking-wider relative -top-2 shadow-[2px_2px_0px_0px_#000]" data-tour="month-label">
            <Calendar className="h-5 w-5 stroke-[3px]" /> {format(monthStart, 'MMMM yyyy')}
          </div>
          <button
            onClick={() => setMonthCursor(prev => addMonths(prev, 1))}
            className="px-4 py-3 bg-neo-bg border-2 border-black hover:bg-black hover:text-white transition-all font-black uppercase text-sm"
            data-tour="month-next"
          >
            NEXT
          </button>
        </div>
      </div>

      {/* Actions / Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Task Count Card */}
        <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_#000] transition-all group">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-neo-secondary border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000] group-hover:rotate-12 transition-transform">
              <Clock className="h-8 w-8 text-black stroke-[3px]" />
            </div>
            <div>
              <div className="text-[10px] font-black text-black/40 uppercase tracking-widest">TASKS_THIS_MONTH</div>
              <div className="text-4xl font-black text-black italic leading-none mt-1">
                {counts.total}
                <span className="text-sm font-bold text-black/40 not-italic ml-2">({counts.completed} DONE)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Source Breakdown Card */}
        <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_#000] transition-all group">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-neo-muted border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000] group-hover:-rotate-12 transition-transform">
              <Filter className="h-8 w-8 text-black stroke-[3px]" />
            </div>
            <div>
              <div className="text-[10px] font-black text-black/40 uppercase tracking-widest">SOURCE_VECTOR</div>
              <div className="flex flex-col gap-1 mt-2 text-xs font-bold uppercase tracking-wide">
                <span className="text-blue-600">MONTHLY: {counts.monthly}</span>
                <span className="text-purple-600">EXAM: {counts.exam}</span>
                <span className="text-amber-600">MANUAL: {counts.manual}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Card */}
        <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000] flex flex-col justify-center gap-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">
              {hasMonthlyPlan ? (
                <span className="inline-flex items-center gap-2 bg-neo-accent text-white px-3 py-1 border-2 border-black -rotate-2"><Sparkles className="h-4 w-4 fill-current" /> PLAN_ACTIVE</span>
              ) : (
                <span className="inline-flex items-center gap-2 bg-neo-secondary text-black px-3 py-1 border-2 border-black rotate-1"><AlertTriangle className="h-4 w-4" /> NO_PLAN</span>
              )}
            </div>

            {plan && (
              <button
                onClick={handleGenerateMonth}
                disabled={generating}
                className="bg-black text-white px-4 py-2 text-sm font-black uppercase tracking-wider border-4 border-black shadow-[4px_4px_0px_0px_#FF6B6B] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tour="generate-btn"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 stroke-[3px]" />}
                {hasMonthlyPlan ? 'REGENERATE' : 'GENERATE'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-neo-bg border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000]" data-tour="filters">
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-2 text-lg font-black text-black uppercase italic">
            <Filter className="h-6 w-6 stroke-[3px]" />
            FILTER_MATRIX
          </div>

          <div className="h-8 w-1 bg-black hidden md:block" />

          <div className="flex items-center gap-4">
            {(['monthly', 'exam', 'manual'] as const).map(key => (
              <label key={key} className="inline-flex items-center gap-2 cursor-pointer group">
                <div className={`w-5 h-5 border-2 border-black flex items-center justify-center transition-all ${filterSource[key] ? 'bg-neo-accent' : 'bg-white'}`}>
                  {filterSource[key] && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={filterSource[key]}
                  onChange={(e) => setFilterSource(s => ({ ...s, [key]: e.target.checked }))}
                  className="hidden"
                />
                <span className="text-xs font-black uppercase tracking-widest group-hover:underline">{key}</span>
              </label>
            ))}
          </div>

          <div className="h-8 w-1 bg-black hidden md:block" />

          <div className="flex items-center gap-4">
            {(['pending', 'completed', 'skipped', 'rescheduled'] as const).map(key => (
              <label key={key} className="inline-flex items-center gap-2 cursor-pointer group">
                <div className={`w-5 h-5 border-2 border-black flex items-center justify-center transition-all ${filterStatus[key] ? 'bg-neo-secondary' : 'bg-white'}`}>
                  {filterStatus[key] && <CheckCircle className="w-3 h-3 text-black" />}
                </div>
                <input
                  type="checkbox"
                  checked={filterStatus[key]}
                  onChange={(e) => setFilterStatus(s => ({ ...s, [key]: e.target.checked }))}
                  className="hidden"
                />
                <span className="text-xs font-black uppercase tracking-widest group-hover:underline">{key}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
          <div className="w-20 h-20 border-8 border-black border-t-neo-accent animate-spin" />
          <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">RETRIEVING_DATA...</h2>
        </div>
      ) : !plan ? (
        <div className="text-center py-20 bg-white border-4 border-black border-dashed">
          <div className="w-24 h-24 bg-neo-muted border-4 border-black mx-auto mb-8 flex items-center justify-center rotate-3 shadow-[8px_8px_0px_0px_#000]">
            <ListChecks className="h-10 w-10 text-black stroke-[3px]" />
          </div>
          <h3 className="text-4xl font-black text-black uppercase tracking-tighter italic mb-4">NO ACADEMIC PLAN</h3>
          <p className="text-black font-bold max-w-xl mx-auto uppercase tracking-wide">
            Initialize your curriculum or activate the AI Study Buddy to generate a monthly protocol.
          </p>
        </div>
      ) : groupedTasks.length === 0 ? (
        <div className="text-center py-20 bg-white border-4 border-black border-dashed">
          <div className="w-24 h-24 bg-neo-bg border-4 border-black mx-auto mb-8 flex items-center justify-center -rotate-3 shadow-[8px_8px_0px_0px_#000]">
            <Calendar className="h-10 w-10 text-black stroke-[3px]" />
          </div>
          <h3 className="text-4xl font-black text-black uppercase tracking-tighter italic mb-4">NO TASKS DETECTED</h3>
          <p className="text-black font-bold max-w-xl mx-auto uppercase tracking-wide">
            {hasMonthlyPlan ? 'ADJUST FILTERS OR REGENERATE THE PROTOCOL.' : 'GENERATE THE MONTHLY CURRICULUM TO VISUALIZE TASKS.'}
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {groupedTasks.map(([date, dayTasks]) => (
            <div key={date} className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_#000]">
              <div className="flex items-center justify-between p-6 border-b-4 border-black bg-neo-secondary">
                <div className="text-2xl font-black text-black uppercase tracking-tight italic">{format(new Date(`${date}T00:00:00`), 'EEEE, MMM dd')}</div>
                <div className="bg-black text-white px-3 py-1 text-xs font-black uppercase tracking-widest">
                  {dayTasks.length} UNIT{dayTasks.length > 1 ? 'S' : ''}
                </div>
              </div>
              <div className="divide-y-4 divide-black">
                {dayTasks.map(t => (
                  <div key={t.id} className="p-6 flex items-start gap-6 hover:bg-neo-bg transition-colors group">
                    <button
                      onClick={() => toggleTaskCompleted(t)}
                      className={`mt-1 w-8 h-8 flex-shrink-0 border-4 border-black flex items-center justify-center transition-all bg-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-[4px_4px_0px_0px_#000] ${t.status === 'completed' ? 'bg-neo-accent' : ''}`}
                      title={t.status === 'completed' ? 'Mark as pending' : 'Mark as completed'}
                      data-tour="task-toggle"
                    >
                      {t.status === 'completed' && <CheckCircle className="w-5 h-5 text-white stroke-[4px]" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        {t.subject && (
                          <span className="bg-black text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 -rotate-1">
                            {t.subject}
                          </span>
                        )}
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border-2 border-black ${t.source === 'exam' ? 'bg-purple-200' : t.source === 'manual' ? 'bg-amber-100' : 'bg-white'}`}>
                          SOURCE: {t.source}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border-2 border-black ${t.status === 'completed' ? 'bg-green-300' : t.status === 'pending' ? 'bg-gray-200' : t.status === 'skipped' ? 'bg-red-200' : 'bg-yellow-200'}`}>
                          STATUS: {t.status}
                        </span>
                      </div>

                      <div className={`text-xl font-bold uppercase tracking-tight ${t.status === 'completed' ? 'text-black/30 line-through decoration-4 decoration-black/30' : 'text-black'}`}>
                        {t.title || 'UNTITLED_UNIT'}
                      </div>

                      {t.description && (
                        <div className="mt-3 text-sm font-mono text-black bg-black/5 p-3 border-l-4 border-black whitespace-pre-wrap">
                          {t.description}
                        </div>
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
