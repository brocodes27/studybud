import { useRef } from 'react';
import type { Skill, SkillContext, SkillRuntimeState } from './types';
import { dailyStudy } from './dailyStudy';
import { remediate } from './remediate';
import { rescheduler } from './rescheduler';
import { curriculumPlanner } from './curriculumPlanner';
import { examApplier } from './examApplier';

const registry: Skill[] = [
  curriculumPlanner,
  examApplier,
  dailyStudy,
  remediate,
  rescheduler,
];

export function useChatSkills(ctx: SkillContext) {
  const currentSkillIdRef = useRef<string | null>(null);
  const stateRef = useRef<SkillRuntimeState>({ step: 0, data: {}, options: undefined });

  const end = () => {
    currentSkillIdRef.current = null;
    stateRef.current = { step: 0, data: {}, options: undefined };
  };

  const startSkill = async (id: string, options?: any) => {
    const skill = registry.find(s => s.id === id);
    if (!skill) return;
    currentSkillIdRef.current = id;
    stateRef.current = { step: 0, data: {}, options };
    try {
      await skill.onStart(ctx, options);
    } catch (e) {
      ctx.addAssistant('Sorry, I could not start that skill right now.');
      end();
    }
  };

  const handleOngoing = async (message: string): Promise<boolean> => {
    const id = currentSkillIdRef.current;
    if (!id) return false;
    const skill = registry.find(s => s.id === id);
    if (!skill) { end(); return false; }
    try {
      await skill.onMessage(message, ctx, stateRef.current, (s) => {
        stateRef.current = typeof s === 'function' ? (s as any)(stateRef.current) : s;
      }, end);
    } catch (e) {
      ctx.addAssistant('That flow hit an error. Let\'s stop here.');
      end();
    }
    // If still the same skill, it's ongoing
    return !!currentSkillIdRef.current;
  };

  const maybeStartByIntent = async (message: string): Promise<boolean> => {
    for (const skill of registry) {
      try {
        const can = await skill.canStart(message, ctx);
        if (can) {
          await startSkill(skill.id);
          return true;
        }
      } catch {}
    }
    return false;
  };

  return {
    startSkill,
    handleOngoing,
    maybeStartByIntent,
    activeSkillId: currentSkillIdRef.current,
  };
}
