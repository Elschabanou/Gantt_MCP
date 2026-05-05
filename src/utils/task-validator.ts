import { GanttTask, ValidationResult, ValidationError, ResourceCapacity } from '../types.js';
import { DependencyChecker } from './dependency-checker.js';

/**
 * Comprehensive validator for Gantt tasks
 */
export class GanttValidator {
  private resourceCapacities: Map<string, ResourceCapacity>;

  constructor(resourceCapacities?: ResourceCapacity[]) {
    this.resourceCapacities = new Map();
    if (resourceCapacities) {
      for (const cap of resourceCapacities) {
        this.resourceCapacities.set(cap.resourceId, cap);
      }
    }
  }

  /**
   * Validate all tasks
   */
  validate(tasks: GanttTask[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!tasks || tasks.length === 0) {
      errors.push({
        taskId: '',
        field: 'tasks',
        message: 'Tasks array is empty',
        severity: 'error',
      });
      return { valid: false, errors, warnings };
    }

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const task of tasks) {
      if (ids.has(task.id)) {
        errors.push({
          taskId: task.id,
          field: 'id',
          message: `Duplicate task ID: "${task.id}"`,
          severity: 'error',
        });
      }
      ids.add(task.id);
    }

    // Validate each task
    for (const task of tasks) {
      errors.push(...this.validateTask(task));
    }

    // Check for dependency issues
    errors.push(...DependencyChecker.validateDependencyReferences(tasks));
    errors.push(...DependencyChecker.checkCircularDependencies(tasks));

    // Check resource capacity if configured
    if (this.resourceCapacities.size > 0) {
      warnings.push(...this.validateResourceCapacity(tasks));
    }

    // Check for scheduling conflicts
    warnings.push(...this.checkSchedulingConflicts(tasks));

    const valid = errors.length === 0;
    return { valid, errors, warnings };
  }

  /**
   * Validate individual task
   */
  private validateTask(task: GanttTask): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required fields
    if (!task.id || task.id.trim() === '') {
      errors.push({
        taskId: task.id || 'unknown',
        field: 'id',
        message: 'Task ID is required',
        severity: 'error',
      });
    }

    if (!task.name || task.name.trim() === '') {
      errors.push({
        taskId: task.id,
        field: 'name',
        message: 'Task name is required',
        severity: 'error',
      });
    }

    if (!task.start) {
      errors.push({
        taskId: task.id,
        field: 'start',
        message: 'Start date is required (format: YYYY-MM-DD)',
        severity: 'error',
      });
    } else if (!this.isValidDate(task.start)) {
      errors.push({
        taskId: task.id,
        field: 'start',
        message: `Invalid start date format: "${task.start}" (use YYYY-MM-DD)`,
        severity: 'error',
      });
    }

    if (!task.end) {
      errors.push({
        taskId: task.id,
        field: 'end',
        message: 'End date is required (format: YYYY-MM-DD)',
        severity: 'error',
      });
    } else if (!this.isValidDate(task.end)) {
      errors.push({
        taskId: task.id,
        field: 'end',
        message: `Invalid end date format: "${task.end}" (use YYYY-MM-DD)`,
        severity: 'error',
      });
    }

    // Date logic (start <= end)
    if (task.start && task.end && this.isValidDate(task.start) && this.isValidDate(task.end)) {
      const startDate = new Date(task.start);
      const endDate = new Date(task.end);
      if (startDate > endDate) {
        errors.push({
          taskId: task.id,
          field: 'dates',
          message: `Start date (${task.start}) must be before or equal to end date (${task.end})`,
          severity: 'error',
        });
      }
    }

    // Progress validation
    if (task.progress !== undefined) {
      if (typeof task.progress !== 'number') {
        errors.push({
          taskId: task.id,
          field: 'progress',
          message: 'Progress must be a number',
          severity: 'error',
        });
      } else if (task.progress < 0 || task.progress > 100) {
        errors.push({
          taskId: task.id,
          field: 'progress',
          message: `Progress must be between 0 and 100, got: ${task.progress}`,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Check if date string is valid YYYY-MM-DD format
   */
  private isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;

    // Ensure date matches the string (e.g., 2024-02-30 should fail)
    const [year, month, day] = dateString.split('-').map(Number);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  /**
   * Validate resource capacity constraints
   */
  private validateResourceCapacity(tasks: GanttTask[]): ValidationError[] {
    const warnings: ValidationError[] = [];

    // Group tasks by resource
    const resourceTasks = new Map<string, GanttTask[]>();
    for (const task of tasks) {
      if (task.resource) {
        if (!resourceTasks.has(task.resource)) {
          resourceTasks.set(task.resource, []);
        }
        resourceTasks.get(task.resource)!.push(task);
      }
    }

    // Check capacity constraints
    for (const [resourceId, tasksForResource] of resourceTasks) {
      const capacity = this.resourceCapacities.get(resourceId);
      if (!capacity) continue;

      if (capacity.maxConcurrent) {
        const overlapping = this.findOverlappingTasks(tasksForResource);
        if (overlapping.length > capacity.maxConcurrent) {
          warnings.push({
            taskId: '',
            field: 'resource',
            message: `Resource "${resourceId}" has ${overlapping.length} concurrent tasks, max allowed: ${capacity.maxConcurrent}`,
            severity: 'error',
          });
        }
      }
    }

    return warnings;
  }

  /**
   * Find overlapping tasks
   */
  private findOverlappingTasks(tasks: GanttTask[]): GanttTask[] {
    const overlapping: GanttTask[] = [];

    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const task1 = tasks[i];
        const task2 = tasks[j];

        const start1 = new Date(task1.start);
        const end1 = new Date(task1.end);
        const start2 = new Date(task2.start);
        const end2 = new Date(task2.end);

        // Check for overlap
        if (start1 <= end2 && start2 <= end1) {
          overlapping.push(task1, task2);
        }
      }
    }

    return [...new Set(overlapping)]; // Remove duplicates
  }

  /**
   * Check for scheduling conflicts
   */
  private checkSchedulingConflicts(tasks: GanttTask[]): ValidationError[] {
    const warnings: ValidationError[] = [];

    // Check if any task has an end date in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const task of tasks) {
      const endDate = new Date(task.end);
      if (endDate < today && (task.progress ?? 0) < 100) {
        warnings.push({
          taskId: task.id,
          field: 'end',
          message: `Task end date (${task.end}) is in the past but progress is not 100%`,
          severity: 'error',
        });
      }
    }

    return warnings;
  }
}
