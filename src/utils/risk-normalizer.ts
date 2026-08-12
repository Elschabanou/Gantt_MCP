import { GanttTask } from '../types.js';

export interface RiskNormalizationResult {
  tasks: GanttTask[];
  /** Names of tasks whose risk flag was dropped because it carried no reason. */
  droppedRisks: string[];
}

/**
 * Drops risk flags that come without a `risk_note`.
 *
 * Clients instructed to always emit every optional key tend to stamp a default
 * `risk: "low"` with an empty note onto every single task, which fills the
 * "Risks" section below the chart with the whole plan and makes the real risks
 * invisible. A risk the caller cannot name is treated as no risk; the dropped
 * ones are reported back so the client can re-send with proper notes.
 */
export function normalizeRisks(tasks: GanttTask[]): RiskNormalizationResult {
  const droppedRisks: string[] = [];

  const normalized = tasks.map((task) => {
    if (task.risk === undefined) return task;
    if (task.risk_note !== undefined && task.risk_note.trim() !== '') return task;

    droppedRisks.push(task.name);
    const { risk, risk_note, ...rest } = task;
    return rest as GanttTask;
  });

  return { tasks: normalized, droppedRisks };
}
