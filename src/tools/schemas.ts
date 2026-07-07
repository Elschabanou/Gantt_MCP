import { z } from 'zod';

/**
 * JSON Schema definitions using Zod
 */

export const GanttTaskSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
  name: z.string().min(1, 'Task name is required'),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  progress: z.number().min(0).max(100).optional(),
  dependencies: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  custom_class: z.string().optional(),
  resource: z.string().optional(),
  group: z.string().optional(),
  milestone: z.boolean().optional(),
});

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

export const CreateGanttToolSchema = z.object({
  tasks: z.array(GanttTaskSchema).nonempty('At least one task is required'),
  options: GanttOptionsSchema.optional(),
});

export type GanttTask = z.infer<typeof GanttTaskSchema>;
export type GanttOptions = z.infer<typeof GanttOptionsSchema>;
export type CreateGanttTool = z.infer<typeof CreateGanttToolSchema>;
