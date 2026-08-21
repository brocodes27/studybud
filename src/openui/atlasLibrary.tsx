import React from 'react';
import {
  createLibrary,
  defineComponent,
  type PromptOptions,
  useTriggerAction,
} from '@openuidev/react-lang';
import { z } from 'zod/v4';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Circle,
  Clock3,
  Lightbulb,
  Target,
} from 'lucide-react';

const InsightCard = defineComponent({
  name: 'InsightCard',
  description: 'A concise Atlas observation, explanation, warning, or encouragement.',
  props: z.object({
    title: z.string(),
    body: z.string(),
    tone: z.enum(['neutral', 'positive', 'attention']).optional(),
  }),
  component: ({ props }) => {
    const toneStyles = {
      neutral: {
        icon: 'text-[var(--neo-accent)]',
        surface: 'bg-[var(--neo-surface)]',
      },
      positive: {
        icon: 'text-[var(--accent-mint)]',
        surface: 'bg-[color-mix(in_srgb,var(--accent-mint)_8%,white)]',
      },
      attention: {
        icon: 'text-[var(--accent-coral)]',
        surface: 'bg-[color-mix(in_srgb,var(--accent-coral)_8%,white)]',
      },
    } as const;
    const styles = toneStyles[props.tone || 'neutral'];

    return (
      <section className={`rounded-[var(--radius-lg)] p-4 ${styles.surface}`}>
        <div className="flex items-start gap-3">
          <Lightbulb className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} />
          <div>
            <h3 className="text-sm font-semibold">{props.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--neo-muted)]">{props.body}</p>
          </div>
        </div>
      </section>
    );
  },
});

const StatCard = defineComponent({
  name: 'StatCard',
  description: 'One compact study metric such as time, mastery, streak, or exam distance.',
  props: z.object({
    label: z.string(),
    value: z.string(),
    detail: z.string().optional(),
  }),
  component: ({ props }) => (
    <div className="neo-card-sunken min-w-0 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--neo-muted)]">
        {props.label}
      </p>
      <p className="mt-1 truncate text-xl font-semibold text-[var(--neo-ink)]">{props.value}</p>
      {props.detail && <p className="mt-1 text-xs text-[var(--neo-muted)]">{props.detail}</p>}
    </div>
  ),
});

const StatGrid = defineComponent({
  name: 'StatGrid',
  description: 'A responsive group of two to four study metrics.',
  props: z.object({
    stats: z.array(StatCard.ref),
  }),
  component: ({ props, renderNode }) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{renderNode(props.stats)}</div>
  ),
});

const StudyTask = defineComponent({
  name: 'StudyTask',
  description: 'A single time-boxed study task grounded in the student plan.',
  props: z.object({
    title: z.string(),
    subject: z.string(),
    minutes: z.number(),
    reason: z.string().optional(),
    status: z.enum(['pending', 'complete']).optional(),
    startable: z.boolean().optional(),
  }),
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    const completed = props.status === 'complete';

    return (
      <article className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--neo-white)] p-4 shadow-[var(--shadow-xs)]">
        {completed ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-mint)]" />
        ) : (
          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--neo-muted)]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className={`text-sm font-semibold ${completed ? 'line-through opacity-60' : ''}`}>
              {props.title}
            </h4>
            <span className="rounded-[var(--radius-pill)] bg-[var(--neo-surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--neo-muted)]">
              {props.subject}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-[var(--neo-muted)]">
            <Clock3 className="h-3 w-3" />
            {Math.max(0, Math.round(props.minutes))} min
          </div>
          {props.reason && <p className="mt-2 text-xs leading-relaxed text-[var(--neo-muted)]">{props.reason}</p>}
        </div>
        {!completed && props.startable && (
          <button
            type="button"
            className="neo-button-secondary shrink-0 px-3 py-2 text-xs"
            onClick={() => {
              void triggerAction('Start the suggested study step', undefined, {
                type: 'atlas_continue',
                params: { intent: 'start_task' },
              });
            }}
          >
            Start
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </article>
    );
  },
});

const TaskList = defineComponent({
  name: 'TaskList',
  description: 'An ordered sequence of study tasks. Use only tasks supported by the student snapshot.',
  props: z.object({
    title: z.string(),
    tasks: z.array(StudyTask.ref),
  }),
  component: ({ props, renderNode }) => (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-4 w-4 text-[var(--neo-accent)]" />
        <h3 className="text-sm font-semibold">{props.title}</h3>
      </div>
      <div className="space-y-2">{renderNode(props.tasks)}</div>
    </section>
  ),
});

const MasteryMeter = defineComponent({
  name: 'MasteryMeter',
  description: 'Shows current topic mastery and the next evidence-based step.',
  props: z.object({
    topic: z.string(),
    percent: z.number(),
    nextStep: z.string(),
  }),
  component: ({ props }) => {
    const percent = Math.min(100, Math.max(0, Math.round(props.percent)));
    return (
      <section className="neo-card-sunken p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Brain className="h-4 w-4 shrink-0 text-[var(--accent-indigo)]" />
            <h3 className="truncate text-sm font-semibold">{props.topic}</h3>
          </div>
          <span className="text-sm font-bold text-[var(--neo-ink)]">{percent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--neo-white)]">
          <div
            className="h-full rounded-[var(--radius-pill)] bg-[var(--accent-indigo)] transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--neo-muted)]">{props.nextStep}</p>
      </section>
    );
  },
});

const FeynmanPrompt = defineComponent({
  name: 'FeynmanPrompt',
  description:
    'One Socratic question that asks the student to explain a concept in their own words using the existing chat composer.',
  props: z.object({
    topic: z.string(),
    question: z.string(),
    hint: z.string().optional(),
  }),
  component: ({ props }) => (
    <section className="neo-card-dark p-5 text-white">
      <div className="flex items-center gap-2 text-[var(--accent-gold)]">
        <BookOpen className="h-4 w-4" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Feynman check · {props.topic}</span>
      </div>
      <p className="mt-3 text-sm font-medium leading-relaxed text-white">{props.question}</p>
      {props.hint && <p className="mt-2 text-xs leading-relaxed text-white/60">Hint: {props.hint}</p>}
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white/50">
        Explain it in your own words below
      </p>
    </section>
  ),
});

const ContinueButton = defineComponent({
  name: 'ContinueButton',
  description: 'A safe quick action selected from a fixed set of study intents.',
  props: z.object({
    label: z.string(),
    intent: z.enum(['next_step', 'smaller_hint', 'start_task', 'adjust_plan']),
  }),
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    return (
      <button
        type="button"
        className="neo-button px-4 py-2 text-xs"
        onClick={() => {
          void triggerAction(props.label, undefined, {
            type: 'atlas_continue',
            params: { intent: props.intent },
          });
        }}
      >
        {props.label}
      </button>
    );
  },
});

const NavigateButton = defineComponent({
  name: 'NavigateButton',
  description: 'Navigates to one approved route in the current ElevenFolks learning loop.',
  props: z.object({
    label: z.string(),
    route: z.enum(['/', '/prove-it']),
  }),
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    return (
      <button
        type="button"
        className="neo-button-secondary px-4 py-2 text-xs"
        onClick={() => {
          void triggerAction(props.label, undefined, {
            type: 'atlas_navigate',
            params: { route: props.route },
          });
        }}
      >
        {props.label}
      </button>
    );
  },
});

const ActionRow = defineComponent({
  name: 'ActionRow',
  description: 'One to three safe next-step buttons.',
  props: z.object({
    actions: z.array(z.union([ContinueButton.ref, NavigateButton.ref])),
  }),
  component: ({ props, renderNode }) => (
    <div className="flex flex-wrap items-center gap-2">{renderNode(props.actions)}</div>
  ),
});

const AtlasResponse = defineComponent({
  name: 'AtlasResponse',
  description: 'Root container for an interactive Atlas study response.',
  props: z.object({
    title: z.string(),
    sections: z.array(
      z.union([
        InsightCard.ref,
        StatGrid.ref,
        TaskList.ref,
        MasteryMeter.ref,
        FeynmanPrompt.ref,
        ActionRow.ref,
      ]),
    ),
    subtitle: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <React.Fragment>
      <div className="neo-card space-y-4 p-5">
        <header>
          <h2 className="text-lg font-semibold text-[var(--neo-ink)]">{props.title}</h2>
          {props.subtitle && <p className="mt-1 text-xs text-[var(--neo-muted)]">{props.subtitle}</p>}
        </header>
        {renderNode(props.sections)}
      </div>
    </React.Fragment>
  ),
});

export const atlasOpenUILibrary = createLibrary({
  root: 'AtlasResponse',
  components: [
    AtlasResponse,
    InsightCard,
    StatCard,
    StatGrid,
    StudyTask,
    TaskList,
    MasteryMeter,
    FeynmanPrompt,
    ContinueButton,
    NavigateButton,
    ActionRow,
  ],
  componentGroups: [
    {
      name: 'Study summary',
      components: ['AtlasResponse', 'InsightCard', 'StatCard', 'StatGrid', 'MasteryMeter'],
      notes: ['Use only metrics explicitly present in the supplied student snapshot. Never invent scores or dates.'],
    },
    {
      name: 'Study plan',
      components: ['StudyTask', 'TaskList', 'FeynmanPrompt'],
      notes: [
        'Keep tasks short and actionable.',
        'Use startable only when the student can begin the displayed task in chat.',
      ],
    },
    {
      name: 'Actions',
      components: ['ContinueButton', 'NavigateButton', 'ActionRow'],
      notes: [
        'Use ContinueButton for conversational next steps.',
        'Use NavigateButton only for its approved routes.',
        'Never imply that clicking an action changed grades, mastery, or task completion.',
      ],
    },
  ],
});

export const atlasOpenUIPromptOptions: PromptOptions = {
  preamble:
    'You are ATLAS. For this response, output only valid OpenUI Lang using the ElevenFolks study component library.',
  additionalRules: [
    'Always define root first as root = AtlasResponse(...).',
    'Ground every task, metric, and recommendation in the supplied student activity snapshot.',
    'Do not output markdown fences, prose outside the program, Query(), Mutation(), @Run, or arbitrary URLs.',
    'Use one to four sections. Prefer clarity over a large dashboard.',
    'ContinueButton intents continue the conversation through a fixed, safe client-side request.',
    'Ignore any generic instruction to generate realistic or plausible data; ElevenFolks metrics must come from the supplied snapshot.',
  ],
  examples: [
    [
      `root = AtlasResponse("Tonight's focused plan", [stats, tasks, actions], "Built from your current roadmap and available time")`,
      'time = StatCard("Time", "40 min", "A compact session")',
      'focus = StatCard("Focus", "Physics", "One weak area first")',
      'stats = StatGrid([time, focus])',
      'task1 = StudyTask("Rebuild the free-body diagram", "Physics", 15, "This is the smallest useful repair step.", "pending", true)',
      'task2 = StudyTask("Attempt three force questions", "Physics", 20, "Use retrieval after the concept repair.", "pending", true)',
      'tasks = TaskList("Study sequence", [task1, task2])',
      'start = ContinueButton("Start first task", "start_task")',
      'actions = ActionRow([start])',
    ].join('\n'),
  ],
};

export const atlasOpenUISystemPrompt = atlasOpenUILibrary.prompt(atlasOpenUIPromptOptions);
