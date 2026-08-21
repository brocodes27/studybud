export type DemoRole = 'teacher' | 'student' | 'principal';

export type DemoEventKind =
  | 'signal_detected'
  | 'repair_assigned'
  | 'session_started'
  | 'evidence_submitted'
  | 'evidence_reviewed';

export interface DemoTimelineEvent {
  id: DemoEventKind;
  label: string;
  detail: string;
  time: string;
}

export interface DemoPortalState {
  activeRole: DemoRole;
  repairAssigned: boolean;
  sessionStarted: boolean;
  evidenceSubmitted: boolean;
  evidenceReviewed: boolean;
  selectedAnswer: string | null;
  hintVisible: boolean;
  masteryBefore: number;
  masteryAfter: number | null;
  timeline: DemoTimelineEvent[];
}

export type DemoPortalAction =
  | { type: 'switch_role'; role: DemoRole }
  | { type: 'assign_repair' }
  | { type: 'start_session' }
  | { type: 'select_answer'; answer: string }
  | { type: 'show_hint' }
  | { type: 'submit_evidence' }
  | { type: 'review_evidence' }
  | { type: 'reset' };

const detectedEvent: DemoTimelineEvent = {
  id: 'signal_detected',
  label: 'Gap detected',
  detail: 'Repeated sign errors across two assignments',
  time: '09:12',
};

export function createDemoPortalState(): DemoPortalState {
  return {
    activeRole: 'teacher',
    repairAssigned: false,
    sessionStarted: false,
    evidenceSubmitted: false,
    evidenceReviewed: false,
    selectedAnswer: null,
    hintVisible: false,
    masteryBefore: 48,
    masteryAfter: null,
    timeline: [detectedEvent],
  };
}

function appendOnce(
  timeline: DemoTimelineEvent[],
  event: DemoTimelineEvent,
): DemoTimelineEvent[] {
  return timeline.some((item) => item.id === event.id)
    ? timeline
    : [...timeline, event];
}

export function demoPortalReducer(
  state: DemoPortalState,
  action: DemoPortalAction,
): DemoPortalState {
  switch (action.type) {
    case 'switch_role':
      return { ...state, activeRole: action.role };
    case 'assign_repair':
      return {
        ...state,
        repairAssigned: true,
        timeline: appendOnce(state.timeline, {
          id: 'repair_assigned',
          label: 'Repair assigned',
          detail: 'Teacher approved a 12-minute targeted practice',
          time: '09:16',
        }),
      };
    case 'start_session':
      if (!state.repairAssigned) return state;
      return {
        ...state,
        activeRole: 'student',
        sessionStarted: true,
        timeline: appendOnce(state.timeline, {
          id: 'session_started',
          label: 'Student started',
          detail: 'Riya opened guided repair from Today',
          time: '10:04',
        }),
      };
    case 'select_answer':
      if (!state.sessionStarted || state.evidenceSubmitted) return state;
      return { ...state, selectedAnswer: action.answer };
    case 'show_hint':
      if (!state.sessionStarted || state.evidenceSubmitted) return state;
      return { ...state, hintVisible: true };
    case 'submit_evidence':
      if (!state.sessionStarted || state.selectedAnswer !== 'x = 7') return state;
      return {
        ...state,
        evidenceSubmitted: true,
        masteryAfter: 74,
        timeline: appendOnce(state.timeline, {
          id: 'evidence_submitted',
          label: 'Movement verified',
          detail: 'Fresh check improved from 48% to 74%',
          time: '10:15',
        }),
      };
    case 'review_evidence':
      if (!state.evidenceSubmitted) return state;
      return {
        ...state,
        evidenceReviewed: true,
        timeline: appendOnce(state.timeline, {
          id: 'evidence_reviewed',
          label: 'Loop closed',
          detail: 'Teacher accepted the evidence and resolved support',
          time: '10:22',
        }),
      };
    case 'reset':
      return createDemoPortalState();
    default:
      return state;
  }
}

export function completedDemoSteps(state: DemoPortalState): number {
  return [
    true,
    state.repairAssigned,
    state.sessionStarted,
    state.evidenceSubmitted,
    state.evidenceReviewed,
  ].filter(Boolean).length;
}
