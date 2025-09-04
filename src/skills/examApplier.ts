import type { Skill } from './types';
import { applyExamToCurriculum } from '../lib/curriculumApi';
import { supabase } from '../lib/supabase';

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

export const examApplier: Skill = {
  id: 'examApplier',
  canStart: (message) => {
    const t = message.toLowerCase();
    return t.includes('apply exam') || t.includes('add exam') || t.includes('exam to plan') || t.includes('exam to curriculum');
  },
  onStart: async (ctx) => {
    ctx.addAssistant('Let’s add your exam to the curriculum. Which subject?');
  },
  onMessage: async (message, ctx, state, setState, end) => {
    const step = state.step || 0;

    if (step === 0) {
      const subject = message.trim();
      if (!subject) { ctx.addAssistant('Please provide a subject.'); return; }
      setState({ step: 1, data: { subject } });
      ctx.addAssistant('Which class? (e.g., 10, 11, 12)');
      return;
    }

    if (step === 1) {
      const m = message.match(/\d{1,2}/);
      const klass = m ? m[0] : message.trim();
      setState((prev) => ({ step: 2, data: { ...(prev as any).data, class: klass } } as any));
      ctx.addAssistant('What is your exam date? (YYYY-MM-DD)');
      return;
    }

    if (step === 2) {
      const dateStr = message.trim();
      const valid = !isNaN(Date.parse(dateStr));
      if (!valid) { ctx.addAssistant('Please provide a valid date (YYYY-MM-DD).'); return; }
      setState((prev) => ({ step: 3, data: { ...(prev as any).data, exam_date: dateStr } } as any));
      ctx.addAssistant('List the chapters/topics for this exam (comma-separated).');
      return;
    }

    if (step === 3) {
      const chapters = message.trim();
      if (!chapters) { ctx.addAssistant('Please list a few chapters, comma-separated.'); return; }
      setState((prev) => ({ step: 4, data: { ...(prev as any).data, chapters } } as any));
      ctx.addAssistant('How should I apply this? Reply: "mark" (just mark dates) or "reschedule" (shift tasks to prepare).');
      return;
    }

    if (step === 4) {
      const mode = message.toLowerCase().includes('reschedule') ? 'reschedule' : message.toLowerCase().includes('mark') ? 'mark' : '';
      if (!mode) { ctx.addAssistant('Please reply with "mark" or "reschedule".'); return; }
      setState((prev) => ({ step: 5, data: { ...(prev as any).data, update_mode: mode } } as any));
      ctx.addAssistant('Are you preparing for CBSE or JEE? (optional, type CBSE/JEE or say "skip")');
      return;
    }

    if (step === 5) {
      const aim = message.toLowerCase().includes('jee') ? 'jee' : message.toLowerCase().includes('cbse') ? 'cbse' : undefined;
      const data = { ...(state.data || {}), aim } as { subject: string; class: string; exam_date: string; chapters: string; update_mode: 'mark' | 'reschedule'; aim?: 'cbse' | 'jee' };
      ctx.addAssistant('Applying exam to your curriculum...');
      try {
        let curriculum_id: string | undefined = undefined;
        const uid = ctx.session?.user?.id as string | undefined;
        const cid = await getActiveCurriculumId(uid);
        if (cid) curriculum_id = cid;
        await applyExamToCurriculum({
          class: data.class,
          subject: data.subject,
          chapters: data.chapters,
          exam_date: data.exam_date,
          curriculum_id,
          aim: data.aim,
          update_mode: data.update_mode,
        });
        ctx.addAssistant('Exam applied successfully. I adjusted your plan accordingly.');
      } catch (e) {
        ctx.addAssistant('Sorry, I could not apply the exam right now. Please try again.');
      }
      end();
      return;
    }
  }
};
