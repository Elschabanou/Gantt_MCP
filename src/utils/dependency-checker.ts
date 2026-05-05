import { GanttTask, ValidationError } from '../types.js';

/**
 * Detects circular dependencies in task graph using DFS algorithm
 */
export class DependencyChecker {
  /**
   * Check for circular dependencies in tasks
   */
  static checkCircularDependencies(tasks: GanttTask[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        this.dfs(task.id, taskMap, visited, recursionStack, errors);
      }
    }

    return errors;
  }

  /**
   * DFS helper to detect cycles
   */
  private static dfs(
    taskId: string,
    taskMap: Map<string, GanttTask>,
    visited: Set<string>,
    recursionStack: Set<string>,
    errors: ValidationError[]
  ): void {
    visited.add(taskId);
    recursionStack.add(taskId);

    const task = taskMap.get(taskId);
    if (!task || !task.dependencies) {
      recursionStack.delete(taskId);
      return;
    }

    const deps = task.dependencies.split(',').map(d => d.trim());

    for (const depId of deps) {
      if (!visited.has(depId)) {
        this.dfs(depId, taskMap, visited, recursionStack, errors);
      } else if (recursionStack.has(depId)) {
        errors.push({
          taskId,
          field: 'dependencies',
          message: `Circular dependency detected: ${taskId} -> ${depId}`,
          severity: 'error',
        });
      }
    }

    recursionStack.delete(taskId);
  }

  /**
   * Validates that all dependency references exist
   */
  static validateDependencyReferences(tasks: GanttTask[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const validIds = new Set(tasks.map(t => t.id));

    for (const task of tasks) {
      if (!task.dependencies) continue;

      const deps = task.dependencies.split(',').map(d => d.trim());
      for (const dep of deps) {
        if (!validIds.has(dep)) {
          errors.push({
            taskId: task.id,
            field: 'dependencies',
            message: `Referenced task "${dep}" does not exist`,
            severity: 'error',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Get topological order of tasks (for scheduling)
   */
  static getTopologicalOrder(tasks: GanttTask[]): string[] | null {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    // Initialize
    for (const task of tasks) {
      inDegree.set(task.id, 0);
      adjacencyList.set(task.id, []);
    }

    // Build graph
    for (const task of tasks) {
      if (task.dependencies) {
        const deps = task.dependencies.split(',').map(d => d.trim());
        for (const dep of deps) {
          if (adjacencyList.has(dep)) {
            adjacencyList.get(dep)!.push(task.id);
            inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
          }
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [taskId, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(taskId);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of adjacencyList.get(current) || []) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If not all tasks are in result, there's a cycle
    return result.length === tasks.length ? result : null;
  }
}
