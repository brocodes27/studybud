// ============================================================================
// Agent Tools — Client-side tool execution for the Ranjan Sir agent loop
// ----------------------------------------------------------------------------
// Each tool receives arguments from the agent-turn edge function and performs
// real side effects (navigation, DB writes, plan regeneration, web search).
// All tools return a result object that gets sent back to the agent for the
// next turn.
// ============================================================================

import { supabase } from './supabase';
import { markTaskCompleted, generateDailyPrescription } from './dailyBriefing';

export interface ToolCall {
  tool: string;
  args: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function executeTool(
  call: ToolCall,
  context: AgentContext
): Promise<ToolResult> {
  switch (call.tool) {
    case 'present_task':
      return presentTask(call.args, context);
    case 'mark_task_complete':
      return markTaskComplete(call.args, context);
    case 'navigate_to':
      return navigateTo(call.args);
    case 'search_web':
      return searchWeb(call.args);
    case 'regenerate_plan':
      return regeneratePlan(call.args, context);
    case 'open_mentor_chat':
      return openMentorChat(call.args);
    case 'ask_reflection':
      return askReflection(call.args, context);
    case 'show_suggested_replies':
      return showSuggestedReplies(call.args);
    default:
      return { success: false, error: `Unknown tool: ${call.tool}` };
  }
}

export interface AgentContext {
  userId: string;
  roadmapId: string | null;
  todayTasks: any[];
  data: any;
  onRefresh: () => void;
  onNavigate: (route: string) => void;
  onPresentTask: (taskIndex: number, preface: string) => void;
  onAskReflection: (question: string, storeAs: string) => void;
  onShowReplies: (replies: string[]) => void;
}

// ----------------------------------------------------------------------------
// Individual tool implementations
// ----------------------------------------------------------------------------

async function presentTask(
  args: Record<string, any>,
  context: AgentContext
): Promise<ToolResult> {
  const idx = args.task_index ?? 0;
  const preface = args.preface || '';
  context.onPresentTask(idx, preface);
  return { success: true, data: { task_index: idx, presented: true } };
}

async function markTaskComplete(
  args: Record<string, any>,
  context: AgentContext
): Promise<ToolResult> {
  const idx = args.task_index ?? 0;
  const task = context.todayTasks[idx];
  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  const sourceType =
    task.type === 'prescription' ? 'prescription' as const :
    task.type === 'correction_sprint' ? 'sprint' as const :
    task.type === 'assignment' ? 'assignment' as const :
    'weak_area' as const;

  const sourceId = task.prescriptionId || task.sprintId || task.id;
  const result = await markTaskCompleted(
    context.userId,
    sourceType,
    sourceId,
    task.taskOrder || 0,
    task.durationMin,
    undefined,
    { taskTitle: task.title, subject: task.subject, interventionId: task.interventionId }
  );

  if (!result.success) {
    return { success: false, error: result.error || 'Completion failed' };
  }

  // Refresh data so the agent sees updated state
  context.onRefresh();

  return {
    success: true,
    data: {
      xp_earned: result.xpEarned,
      level_up: result.levelUp,
      new_level: result.newLevel,
    },
  };
}

function navigateTo(args: Record<string, any>): ToolResult {
  const route = args.route || '/';
  const reason = args.reason || '';

  if (typeof window !== 'undefined') {
    // Use a custom event so the React router can handle navigation
    window.dispatchEvent(
      new CustomEvent('agent-navigate', {
        detail: { route, reason },
      })
    );
  }

  return { success: true, data: { route, reason } };
}

async function searchWeb(args: Record<string, any>): Promise<ToolResult> {
  const query = args.query || '';
  const searchContext = args.context || '';

  try {
    // Use the existing web search edge function if available
    const { data, error } = await supabase.functions.invoke('cuet-web-search', {
      body: { query, max_results: 3 },
    });

    if (error) throw error;

    return {
      success: true,
      data: {
        query,
        results: data?.results || [],
        context: searchContext,
      },
    };
  } catch (e: any) {
    // Fallback: return a structured error so the agent can explain
    return {
      success: false,
      error: `Web search unavailable: ${e.message}`,
    };
  }
}

async function regeneratePlan(
  args: Record<string, any>,
  context: AgentContext
): Promise<ToolResult> {
  const constraint = args.constraint || '';
  const _duration = args.duration_minutes || null; // passed to prescription generator in future

  if (!context.roadmapId) {
    return { success: false, error: 'No active roadmap' };
  }

  try {
    // For now, we call the existing prescription generator
    // In the future, this could pass constraints to a specialized endpoint
    const generated = await generateDailyPrescription(
      context.userId,
      context.roadmapId
    );

    if (!generated) {
      return { success: false, error: 'Plan regeneration failed' };
    }

    context.onRefresh();

    return {
      success: true,
      data: {
        regenerated: true,
        constraint,
        note: 'Plan regenerated with constraint: ' + constraint,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

function openMentorChat(args: Record<string, any>): ToolResult {
  const mentorContext = args.context || '';
  const topic = args.topic || 'General';

  window.dispatchEvent(
    new CustomEvent('trigger-atlas-chat', {
      detail: {
        message: mentorContext,
        voice: false,
        topic,
      },
    })
  );

  return {
    success: true,
    data: { opened: true, context: mentorContext, topic },
  };
}

function askReflection(
  args: Record<string, any>,
  context: AgentContext
): ToolResult {
  const question = args.question || '';
  const storeAs = args.store_as || 'general';

  context.onAskReflection(question, storeAs);

  return {
    success: true,
    data: { question, store_as: storeAs },
  };
}

function showSuggestedReplies(args: Record<string, any>): ToolResult {
  let replies: string[] = [];
  try {
    if (typeof args.replies === 'string') {
      replies = JSON.parse(args.replies);
    } else if (Array.isArray(args.replies)) {
      replies = args.replies;
    }
  } catch {
    replies = [];
  }

  return {
    success: true,
    data: { replies },
  };
}
