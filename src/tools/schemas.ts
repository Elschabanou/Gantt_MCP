import { z } from 'zod';

/**
 * JSON Schema definitions using Zod
 */

// Clients that are told to always emit every optional key (e.g. the Copilot
// Studio system prompt) fill unused fields with placeholders instead of leaving
// them out. Treat those as "not set" so an empty `risk` doesn't blow up the
// enum and an empty `resource`/`group` doesn't render as a stray label.
const BLANK_PLACEHOLDERS = new Set([
  '',
  '-',
  '--',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'keine',
  'kein',
]);

const OPTIONAL_STRING_FIELDS = [
  'dependencies',
  'priority',
  'resource',
  'group',
  'risk',
  'risk_note',
] as const;

const ENUM_FIELDS = ['priority', 'risk'] as const;

function normalizeTaskInput(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;

  const task: Record<string, unknown> = { ...(raw as Record<string, unknown>) };

  for (const field of OPTIONAL_STRING_FIELDS) {
    const value = task[field];
    if (typeof value === 'string' && BLANK_PLACEHOLDERS.has(value.trim().toLowerCase())) {
      delete task[field];
    }
  }

  // Enum values arrive capitalised often enough ("High", "MEDIUM") to be worth
  // folding here rather than failing validation over casing.
  for (const field of ENUM_FIELDS) {
    const value = task[field];
    if (typeof value === 'string') task[field] = value.trim().toLowerCase();
  }

  return task;
}

export const GanttTaskSchema = z.preprocess(normalizeTaskInput, z.object({
  id: z.string().min(1, 'Task ID is required'),
  name: z.string().min(1, 'Task name is required'),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  progress: z.number().min(0).max(100).optional(),
  dependencies: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  resource: z.string().optional(),
  group: z.string().optional(),
  milestone: z.boolean().optional(),
  risk: z.enum(['low', 'medium', 'high']).optional(),
  risk_note: z.string().optional(),
}));

export const GanttOptionsSchema = z.object({
  view_mode: z.enum(['Day', 'Week', 'Month', 'Year']).optional(),
  view_mode_select: z.boolean().optional(),
  column_width: z.number().positive().optional(),
  bar_height: z.number().positive().optional(),
  bar_corner_radius: z.number().nonnegative().optional(),
  arrow_curve: z.number().nonnegative().optional(),
  readonly: z.boolean().optional(),
  readonly_dates: z.boolean().optional(),
  readonly_progress: z.boolean().optional(),
  popup_on: z.enum(['click', 'hover']).optional(),
  today_button: z.boolean().optional(),
  date_format: z.string().optional(),
  title: z.string().optional(),
});

// Some MCP clients (observed with Microsoft Copilot Studio's generative
// orchestration) reliably fill flat object parameters but fail to fill
// array-of-objects parameters — the model ends up emitting a clarifying
// question string instead of structured task data. As a workaround, accept
// `tasks` as a JSON-encoded string in addition to a native array: a plain
// string is a parameter shape those clients can fill correctly. Native array
// input (used by the direct MCP client and README examples) keeps working
// unchanged.
const TasksInputSchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      // Leave the raw string in place; the array schema below will reject it
      // with a clear "expected array, received string" style error.
      return val;
    }
  }
  return val;
}, z.array(GanttTaskSchema).nonempty('At least one task is required'));

export const CreateGanttToolSchema = z.object({
  tasks: TasksInputSchema,
  options: GanttOptionsSchema.optional(),
});
