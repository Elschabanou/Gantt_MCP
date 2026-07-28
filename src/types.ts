/**
 * Type definitions for Gantt diagram tasks and validation
 */

export interface GanttTask {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD format
  end: string; // YYYY-MM-DD format (for milestones use the same value as start)
  progress?: number; // 0-100
  dependencies?: string; // comma-separated task IDs
  priority?: 'high' | 'medium' | 'low';
  resource?: string; // optional resource/person assignment
  group?: string; // project/swimlane label; tasks sharing a group share a color. Use "Name / Subtitle" for a two-line label.
  milestone?: boolean; // render as a triangle marker instead of a bar (uses `start` as the date)
  risk?: 'low' | 'medium' | 'high'; // flags the task as at risk: outlines the bar and lists it in the risk section
  risk_note?: string; // short reason shown next to the task in the risk section
}

export interface GanttOptions {
  view_mode?: 'Day' | 'Week' | 'Month' | 'Year';
  view_mode_select?: boolean;
  column_width?: number;
  bar_height?: number;
  bar_corner_radius?: number;
  arrow_curve?: number;
  readonly?: boolean;
  readonly_dates?: boolean;
  readonly_progress?: boolean;
  popup_on?: 'click' | 'hover';
  today_button?: boolean;
  date_format?: string;
  title?: string; // chart title shown top-left (default: "Project Timeline")
}

export interface ValidationError {
  taskId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
