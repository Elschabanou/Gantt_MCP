/**
 * Type definitions for Gantt diagram tasks and validation
 */

export interface GanttTask {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD format
  end: string; // YYYY-MM-DD format
  progress?: number; // 0-100
  dependencies?: string; // comma-separated task IDs
  priority?: 'high' | 'medium' | 'low';
  custom_class?: string;
  resource?: string; // optional resource/person assignment
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

export interface GanttGenerationResult {
  valid: boolean;
  html?: string;
  errors?: ValidationError[];
  warnings?: ValidationError[];
  message?: string;
}

export interface ResourceCapacity {
  resourceId: string;
  maxConcurrent?: number;
  totalCapacity?: number;
}
