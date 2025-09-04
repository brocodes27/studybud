import type { Skill } from './types';
import { rescheduleWeek } from '../lib/curriculumApi';
import { supabase } from '../lib/supabase';

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function getActiveCurriculumId(userId?: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('curriculum_plans')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

export const rescheduler: Skill = {
  id: 'rescheduler',
  canStart: (message) => {
    const t = message.toLowerCase();
    return t.includes('reschedule') || t.includes('missed days') || t.includes('reshuffle') || t.includes('shift this week');
  },
  onStart: async (ctx) => {
    ctx.addAssistant('Which week should I adjust? Say "this week" or give Monday as YYYY-MM-DD. You can also add constraints after that (e.g., keep Sunday off, don\'t skip Math).');
  },
  onMessage: async (message, ctx, state, setState, end) => {
    if (!state.step) {
      const lower = message.toLowerCase().trim();
      let week_start: string | null = null;
      if (lower.includes('this week') || lower === 'this') {
        week_start = mondayOf(new Date());
      } else {
        const m = message.match(/\d{4}-\d{2}-\d{2}/)?.[0] || null;
        if (m) week_start = m;
      }
      if (!week_start) {
        ctx.addAssistant('Please provide a Monday date as YYYY-MM-DD, or say "this week".');
        return;
      }
      setState({ step: 1, data: { week_start } });
      ctx.addAssistant('Any constraints? You can say things like: "keep Sunday off", "avoid Physics on Monday". Or say "no constraints".');
      return;
    }
    if (state.step === 1) {
      const constraints = message.trim().toLowerCase() === 'no constraints' ? '' : message.trim();
      const week_start = (state.data as any).week_start as string;
      ctx.addAssistant('Rescheduling this week now. This may take ~10–20s...');
      try {
        let curriculum_id: string | undefined = undefined;
        const uid = ctx.session?.user?.id as string | undefined;
        const cid = await getActiveCurriculumId(uid);
        if (cid) curriculum_id = cid;
        const result = await rescheduleWeek({ curriculum_id, week_start, include_sources: ['monthly'], constraints });
        const moved = (result as any)?.moved_count ?? undefined;
        if (typeof moved === 'number') {
          ctx.addAssistant(`Done. I adjusted ${moved} task(s) across Mon–Sat. You can ask "show my week" or "reschedule again" anytime.`);
        } else {
          ctx.addAssistant('Reschedule complete for this week.');
        }
      } catch {
        ctx.addAssistant('I could not reschedule this week right now. Please try again.');
      }
      end();
      return;
    }
  }
};
