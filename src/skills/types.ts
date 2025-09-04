export interface SkillContext {
  addAssistant: (content: string) => void;
  session: any;
  selectedPlan: string;
  getPlanById: (id: string) => any | undefined;
  refreshStudyPlans?: () => Promise<void> | void;
}

export interface SkillRuntimeState {
  step: number;
  data: Record<string, any>;
  options?: any;
}

export interface Skill {
  id: string;
  canStart: (message: string, ctx: SkillContext) => boolean | Promise<boolean>;
  onStart: (ctx: SkillContext, options?: any) => Promise<void>;
  onMessage: (message: string, ctx: SkillContext, state: SkillRuntimeState, setState: (s: SkillRuntimeState | ((p: SkillRuntimeState) => SkillRuntimeState)) => void, end: () => void) => Promise<void>;
  onCancel?: (ctx: SkillContext) => Promise<void>;
}
