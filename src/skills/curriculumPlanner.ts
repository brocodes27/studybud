import type { Skill } from './types';
import { supabase } from '../lib/supabase';
import { generateMonthlyCurriculum } from '../lib/curriculumApi';

function yyyymm(d = new Date()) {
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

async function getActiveCurriculumId(userId: string): Promise<string | null> {
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

function saveActiveCurriculumId(id: string) {
  try { localStorage.setItem('active_curriculum_id', id); } catch { }
}

export const curriculumPlanner: Skill = {
  id: 'curriculumPlanner',
  canStart: (message) => {
    const t = message.toLowerCase();
    return (
      t.includes('sat') ||
      t.includes('ap') ||
      t.includes('act') ||
      t.includes('curriculum') ||
      t.includes('monthly plan') ||
      t.includes('generate monthly') ||
      t.includes('set aim') ||
      t.includes('academic aim')
    );
  },
  onStart: async (ctx) => {
    ctx.addAssistant('Let’s set up your curriculum. Are you preparing for SAT, AP, or ACT?');
  },
  onMessage: async (message, ctx, state, setState, end) => {
    const step = state.step || 0;

    if (step === 0) {
      const t = message.toLowerCase();
      const aim = t.includes('sat') ? 'sat' : t.includes('ap') ? 'ap' : t.includes('act') ? 'act' : undefined;
      if (!aim) {
        ctx.addAssistant('Please reply with "SAT", "AP", or "ACT".');
        return;
      }
      setState({ step: 1, data: { aim } });
      ctx.addAssistant('Which grade/level? (e.g. 11, 12, High School)');
      return;
    }

    if (step === 1) {
      const m = message.match(/\d{1,2}/);
      const class_level = m ? m[0] : message.trim();
      setState((prev) => ({ step: 2, data: { ...(prev as any).data, class_level } } as any));
      ctx.addAssistant('List your subjects (comma-separated). Example: Math, Physics, Chemistry');
      return;
    }

    if (step === 2) {
      const subjects = message.split(',').map((s) => s.trim()).filter(Boolean);
      if (subjects.length === 0) {
        ctx.addAssistant('Please provide at least one subject.');
        return;
      }
      setState((prev) => ({ step: 3, data: { ...(prev as any).data, subjects } } as any));
      const thisMonth = yyyymm();
      ctx.addAssistant(`Which month should I generate? Reply as YYYY-MM or say "this month". Default: ${thisMonth}`);
      return;
    }

    if (step === 3) {
      const trimmed = message.toLowerCase().trim();
      let month = '';
      if (trimmed === 'this month' || trimmed === 'this') {
        month = yyyymm();
      } else {
        const m = message.match(/\d{4}-\d{2}/)?.[0];
        if (!m) {
          ctx.addAssistant('Please provide month as YYYY-MM or say "this month".');
          return;
        }
        month = m;
      }

      const data = { ...(state.data || {}), month } as {
        aim: 'sat' | 'ap' | 'act';
        class_level: string;
        subjects: string[];
        month: string;
      };

      ctx.addAssistant('Generating your monthly curriculum...');
      try {
        await generateMonthlyCurriculum({
          aim: data.aim,
          class_level: data.class_level,
          subjects: data.subjects,
          month: data.month,
        });
        // Fetch and remember active curriculum id
        const uid = ctx.session?.user?.id as string | undefined;
        if (uid) {
          const cid = await getActiveCurriculumId(uid);
          if (cid) saveActiveCurriculumId(cid);
        }
        ctx.addAssistant('Your monthly curriculum is ready. Daily tasks for the month are set. You can say "Reschedule this week" or "Apply an exam" anytime.');
      } catch (e: any) {
        let reason = 'unknown error';
        let stageInfo = '';
        let previewInfo = '';
        try {
          const msg = e?.message ?? String(e);
          const parsed = JSON.parse(msg);
          reason = (parsed?.error as string) || (parsed as string) || msg;
          if ((parsed as any)?.stage) stageInfo = ` (stage: ${(parsed as any).stage})`;
          if ((parsed as any)?.preview) previewInfo = `\nPreview: ${(parsed as any).preview}`;
        } catch {
          reason = e?.message ?? String(e);
        }
        ctx.addAssistant(`Sorry, I could not generate the monthly curriculum right now. Reason: ${reason}${stageInfo}${previewInfo}`);
      }
      end();
      return;
    }
  },
};
