import { GanttTask, GanttOptions } from '../types.js';

// Render-agnostic Gantt layout: pure geometry/data, shared by the SVG (PNG)
// renderer and the PPTX renderer so the two outputs can never drift apart.

export interface Row {
  task: GanttTask;
  colorIndex: number;
  y: number;
  height: number;
  isMilestone: boolean;
}

export interface GroupBlock {
  label: string;
  colorIndex: number;
  startY: number;
  endY: number;
}

export interface Segment {
  x0: number;
  x1: number;
  label: string;
}

export interface Geometry {
  x0: number;
  x1: number;
  // Unclamped-by-minimum-width end x (bars narrower than 8px have x1 floored
  // to x0+8, but label placement must use the true end position to match the
  // original renderBar math exactly). Equal to x0/x1 for milestones (unused).
  rawEndX: number;
  centerY: number;
  topY: number; // top edge of the bar / milestone marker
  isMilestone: boolean;
}

export type Anchor = 'start' | 'middle' | 'end';

export interface LabelPoint {
  x: number;
  anchor: Anchor;
}

export interface BarLabelPlan {
  kind: 'bar';
  nameInsideBar: boolean;
  name: LabelPoint;
  startDate?: LabelPoint;
  endDate?: LabelPoint;
  startLabel: string;
  endLabel: string;
}

export interface MilestoneLabelPlan {
  kind: 'milestone';
  anchor: Anchor;
  tx: number;
  label: string;
  dateLabel: string;
}

export type LabelPlan = BarLabelPlan | MilestoneLabelPlan;

// Layout constants
export const WIDTH = 1200;
export const TEXT_LEFT = 36;
export const CHART_LEFT_LABELED = 188; // left gutter reserved for group labels
export const GROUP_LABEL_GAP = 22; // gap between right-aligned group label and the chart start
export const CHART_LEFT_BARE = 44; // no group labels -> bars start further left
export const CHART_RIGHT = WIDTH - 32;
export const TITLE_Y = 46;
export const HEADER_TOP = 72;
export const HEADER_H = 30;
export const CONTENT_TOP = 128;
export const ROW_H = 34;
export const MS_ROW_H = 54;
export const GROUP_GAP = 22;
export const BOTTOM_PAD = 40;

// Risk section below the chart
export const RISK_TOP_GAP = 26; // space between last row and the section divider
export const RISK_TITLE_H = 30; // divider -> baseline of the first risk entry
export const RISK_ROW_H = 21;

export const RISK_COLORS: Record<string, string> = {
  high: '#ff5a5f',
  medium: '#ffa62b',
  low: '#ffd94a',
};

// Five-color palette: pink -> teal -> green -> amber -> violet (rotates per group)
export const PALETTE = [
  { solid: '#e5217d', bright: '#ec2d86' }, // rosa
  { solid: '#25565A', bright: '#25565A' }, // türkis
  { solid: '#98c72f', bright: '#a9d13c' }, // grün
  { solid: '#d9761f', bright: '#f0913a' }, // orange
  { solid: '#6d4bd8', bright: '#8a6bf0' }, // violett
];

export function riskColor(risk?: string): string | undefined {
  return risk ? RISK_COLORS[risk] : undefined;
}

export function riskRank(risk?: string): number {
  return risk === 'high' ? 3 : risk === 'medium' ? 2 : risk === 'low' ? 1 : 0;
}

export function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

export function splitLabel(label: string): [string, string] {
  if (!label) return ['', ''];
  const separator = label.includes('/') ? '/' : label.includes('\n') ? '\n' : '';
  if (!separator) return [label.trim(), ''];
  const idx = label.indexOf(separator);
  return [label.slice(0, idx).trim(), label.slice(idx + 1).trim()];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function diffDays(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / msPerDay);
}

export function fmtMonthYear(value: string): string {
  const [year, month] = value.split('-');
  return `${month}/${year.slice(2)}`;
}

export function getBounds(tasks: GanttTask[]): { minDate: Date; maxDate: Date } {
  const dates = tasks.flatMap((task) => [parseDate(task.start), parseDate(task.end)]);
  const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
  const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));
  return { minDate, maxDate };
}

export function xForDate(minDate: Date, span: number, date: Date, chartLeft: number, usable: number): number {
  const x = chartLeft + (diffDays(minDate, date) / span) * usable;
  return clamp(x, chartLeft, CHART_RIGHT);
}

export function buildSegments(
  minDate: Date,
  maxDate: Date,
  span: number,
  chartLeft: number,
  usable: number
): Segment[] {
  const segments: Segment[] = [];
  const xFor = (d: Date) => xForDate(minDate, span, d, chartLeft, usable);
  const yearMode = span > 366;

  if (yearMode) {
    for (let year = minDate.getFullYear(); year <= maxDate.getFullYear(); year++) {
      const segStart = year === minDate.getFullYear() ? minDate : new Date(year, 0, 1);
      const segEndExcl =
        year === maxDate.getFullYear() ? addDays(maxDate, 1) : new Date(year + 1, 0, 1);
      segments.push({ x0: xFor(segStart), x1: xFor(segEndExcl), label: String(year) });
    }
  } else {
    const multiYear = minDate.getFullYear() !== maxDate.getFullYear();
    const last = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    let cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cursor <= last) {
      const isFirst =
        cursor.getFullYear() === minDate.getFullYear() && cursor.getMonth() === minDate.getMonth();
      const isLast =
        cursor.getFullYear() === last.getFullYear() && cursor.getMonth() === last.getMonth();
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const segStart = isFirst ? minDate : new Date(cursor);
      const segEndExcl = isLast ? addDays(maxDate, 1) : nextMonth;
      const monthName = cursor.toLocaleString('en-US', { month: 'short' });
      const label = multiYear
        ? `${monthName} '${String(cursor.getFullYear()).slice(2)}`
        : monthName;
      segments.push({ x0: xFor(segStart), x1: xFor(segEndExcl), label });
      cursor = nextMonth;
    }
  }
  return segments;
}

/**
 * X positions for the dashed vertical gridlines: at the start of every month
 * in month view, or at the start of every quarter (Jan/Apr/Jul/Oct) in year
 * view. Boundaries at the very left/right chart edges are skipped.
 */
export function buildGridlines(
  minDate: Date,
  maxDate: Date,
  span: number,
  chartLeft: number,
  usable: number
): number[] {
  const xs: number[] = [];
  const maxExcl = addDays(maxDate, 1);
  const yearMode = span > 366;

  if (yearMode) {
    for (let year = minDate.getFullYear(); year <= maxDate.getFullYear(); year++) {
      for (const month of [0, 3, 6, 9]) {
        const d = new Date(year, month, 1);
        if (d > minDate && d < maxExcl) {
          xs.push(xForDate(minDate, span, d, chartLeft, usable));
        }
      }
    }
  } else {
    let cursor = new Date(minDate.getFullYear(), minDate.getMonth() + 1, 1);
    while (cursor < maxExcl) {
      xs.push(xForDate(minDate, span, cursor, chartLeft, usable));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  return xs;
}

/**
 * Point path for one dependency arrow: leaves the predecessor's right edge,
 * steps down/up in the gap between rows, then enters the successor from the
 * left (or from above, for a milestone marker). When the successor starts
 * left of the predecessor's end there is no room for a single elbow, so the
 * line detours through the midpoint between both rows. Shared by the SVG
 * renderer (which rounds the corners) and the PPTX renderer (which draws the
 * elbow as-is via a custom-geometry line shape).
 */
export function computeDependencyArrowPoints(source: Geometry, target: Geometry): Array<[number, number]> {
  const STUB = 11; // horizontal breathing room before/after a corner
  const x1 = source.x1;
  const y1 = source.centerY;

  if (target.isMilestone) {
    // Enter the triangle from above so the arrowhead sits on its apex.
    const mx = target.x0;
    const my = target.topY - 5;
    return mx >= x1 + STUB
      ? [
          [x1, y1],
          [mx, y1],
          [mx, my],
        ]
      : [
          [x1, y1],
          [x1 + STUB, y1],
          [x1 + STUB, (y1 + my) / 2],
          [mx, (y1 + my) / 2],
          [mx, my],
        ];
  }

  const x2 = target.x0 - 5;
  const y2 = target.centerY;
  if (Math.abs(y2 - y1) < 0.5) {
    return [
      [x1, y1],
      [x2, y2],
    ];
  }
  if (x2 - STUB > x1 + 2) {
    return [
      [x1, y1],
      [x2 - STUB, y1],
      [x2 - STUB, y2],
      [x2, y2],
    ];
  }
  const midY = (y1 + y2) / 2;
  return [
    [x1, y1],
    [x1 + STUB, y1],
    [x1 + STUB, midY],
    [x2 - STUB, midY],
    [x2 - STUB, y2],
    [x2, y2],
  ];
}

/**
 * Point paths for every dependency arrow (task.dependencies is a
 * comma-separated list of predecessor task ids).
 */
export function buildDependencyArrows(rows: Row[], geometry: Map<string, Geometry>): Array<Array<[number, number]>> {
  const arrows: Array<Array<[number, number]>> = [];
  for (const row of rows) {
    const raw = row.task.dependencies;
    if (!raw) continue;
    const target = geometry.get(row.task.id);
    if (!target) continue;
    for (const depId of raw.split(',').map((id) => id.trim()).filter(Boolean)) {
      if (depId === row.task.id) continue;
      const source = geometry.get(depId);
      if (!source) continue;
      arrows.push(computeDependencyArrowPoints(source, target));
    }
  }
  return arrows;
}

/**
 * Bar/milestone geometry per task id, used both to draw the SVG bars and to
 * anchor dependency arrows / PPTX shapes.
 */
export function buildGeometry(
  rows: Row[],
  minDate: Date,
  span: number,
  barHeight: number,
  chartLeft: number,
  usable: number
): Map<string, Geometry> {
  const geometry = new Map<string, Geometry>();
  for (const row of rows) {
    if (row.isMilestone) {
      const date = parseDate(row.task.start);
      const mx = clamp(
        chartLeft + ((diffDays(minDate, date) + 0.5) / span) * usable,
        chartLeft,
        CHART_RIGHT
      );
      const topY = row.y + 8;
      geometry.set(row.task.id, {
        x0: mx,
        x1: mx,
        rawEndX: mx,
        centerY: topY + 6.5,
        topY,
        isMilestone: true,
      });
    } else {
      const start = parseDate(row.task.start);
      const end = parseDate(row.task.end);
      const startX = xForDate(minDate, span, start, chartLeft, usable);
      const endX = xForDate(minDate, span, addDays(end, 1), chartLeft, usable);
      const width = Math.max(8, endX - startX);
      const barY = row.y + (row.height - barHeight) / 2;
      geometry.set(row.task.id, {
        x0: startX,
        x1: startX + width,
        rawEndX: endX,
        centerY: barY + barHeight / 2,
        topY: barY,
        isMilestone: false,
      });
    }
  }
  return geometry;
}

/**
 * Decides where the name / start date / end date labels go for every row —
 * inside the bar, outside it, or omitted entirely when there's no room.
 * Mirrors the exact fallback branches the SVG renderer used to compute
 * inline; lifted out so the PPTX renderer makes identical placement choices.
 */
export function buildLabelPlans(
  rows: Row[],
  geometry: Map<string, Geometry>,
  chartLeft: number
): Map<string, LabelPlan> {
  const plans = new Map<string, LabelPlan>();

  for (const row of rows) {
    const geom = geometry.get(row.task.id);
    if (!geom) continue;

    if (row.isMilestone) {
      const mx = geom.x0;
      const anchor: Anchor = mx > CHART_RIGHT - 60 ? 'end' : mx < chartLeft + 60 ? 'start' : 'middle';
      const tx = anchor === 'end' ? mx + 6 : anchor === 'start' ? mx - 6 : mx;
      plans.set(row.task.id, {
        kind: 'milestone',
        anchor,
        tx,
        label: row.task.name,
        dateLabel: fmtMonthYear(row.task.start),
      });
      continue;
    }

    const startX = geom.x0;
    const endX = geom.rawEndX;
    const width = geom.x1 - geom.x0;
    const nameW = row.task.name.length * 6.8;
    const startLabel = fmtMonthYear(row.task.start);
    const endLabel = fmtMonthYear(row.task.end);

    let plan: BarLabelPlan;
    if (nameW <= width - 14) {
      // Name fits inside the bar.
      const name: LabelPoint = { x: (startX + endX) / 2, anchor: 'middle' };
      if (width >= 150 && nameW <= width - 84) {
        // Wide enough: dates inside the ends, name centered.
        plan = {
          kind: 'bar',
          nameInsideBar: true,
          name,
          startDate: { x: startX + 10, anchor: 'start' },
          endDate: { x: endX - 10, anchor: 'end' },
          startLabel,
          endLabel,
        };
      } else {
        // Dates just outside the ends, name centered inside; a date that
        // would collide with the centered name near the chart edge is
        // dropped instead of moved inside.
        const startFits = startX - 8 > chartLeft + 32;
        const endFits = endX + 8 < CHART_RIGHT - 32;
        plan = {
          kind: 'bar',
          nameInsideBar: true,
          name,
          startDate: startFits ? { x: startX - 8, anchor: 'end' } : undefined,
          endDate: endFits ? { x: endX + 8, anchor: 'start' } : undefined,
          startLabel,
          endLabel,
        };
      }
    } else {
      // Name too long for the bar: place it beside the bar, no dates.
      const name: LabelPoint =
        endX + 8 + nameW <= CHART_RIGHT ? { x: endX + 8, anchor: 'start' } : { x: startX - 8, anchor: 'end' };
      plan = { kind: 'bar', nameInsideBar: false, name, startLabel, endLabel };
    }

    plans.set(row.task.id, plan);
  }

  return plans;
}

export interface GanttLayout {
  width: number;
  height: number;
  title: string;
  barHeight: number;
  chartLeft: number;
  chartRight: number;
  usable: number;
  hasGroupLabels: boolean;
  minDate: Date;
  maxDate: Date;
  span: number;
  rows: Row[];
  blocks: GroupBlock[];
  contentBottom: number;
  riskTasks: GanttTask[];
  riskSectionHeight: number;
  segments: Segment[];
  gridlineXs: number[];
  geometry: Map<string, Geometry>;
  labels: Map<string, LabelPlan>;
  arrows: Array<Array<[number, number]>>;
}

export function computeGanttLayout(tasks: GanttTask[], options?: GanttOptions): GanttLayout {
  const title = options?.title?.trim() || 'Project Timeline';
  const barHeight = clamp(options?.bar_height ?? 22, 10, ROW_H - 8);

  const bounds = getBounds(tasks);
  const span = Math.max(1, diffDays(bounds.minDate, bounds.maxDate) + 1);

  // Group tasks by `group`, preserving first-appearance order.
  const order: string[] = [];
  const groupMap = new Map<string, GanttTask[]>();
  for (const task of tasks) {
    const key = task.group ?? '';
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
      order.push(key);
    }
    groupMap.get(key)!.push(task);
  }

  // Collapse the left gutter when no group has an actual label.
  const hasGroupLabels = order.some((key) => splitLabel(key)[0] !== '');
  const chartLeft = hasGroupLabels ? CHART_LEFT_LABELED : CHART_LEFT_BARE;
  const usable = CHART_RIGHT - chartLeft;

  // Build sequential layout.
  const rows: Row[] = [];
  const blocks: GroupBlock[] = [];
  let y = CONTENT_TOP;
  order.forEach((key, groupIndex) => {
    const colorIndex = groupIndex % PALETTE.length;
    const startY = y;
    for (const task of groupMap.get(key)!) {
      const isMilestone = task.milestone === true;
      const height = isMilestone ? MS_ROW_H : ROW_H;
      rows.push({ task, colorIndex, y, height, isMilestone });
      y += height;
    }
    blocks.push({ label: key, colorIndex, startY, endY: y });
    y += GROUP_GAP;
  });
  const contentBottom = rows.length > 0 ? y - GROUP_GAP : CONTENT_TOP;

  // Tasks the caller flagged as at risk, most severe first, get their own
  // section below the chart (and an outline on their bar).
  const riskTasks = tasks
    .filter((task) => task.risk !== undefined)
    .sort((a, b) => riskRank(b.risk) - riskRank(a.risk));
  const riskSectionHeight =
    riskTasks.length > 0 ? RISK_TOP_GAP + RISK_TITLE_H + riskTasks.length * RISK_ROW_H : 0;
  const totalHeight = contentBottom + riskSectionHeight + BOTTOM_PAD;

  const segments = buildSegments(bounds.minDate, bounds.maxDate, span, chartLeft, usable);
  const gridlineXs = buildGridlines(bounds.minDate, bounds.maxDate, span, chartLeft, usable);
  const geometry = buildGeometry(rows, bounds.minDate, span, barHeight, chartLeft, usable);
  const labels = buildLabelPlans(rows, geometry, chartLeft);
  const arrows = buildDependencyArrows(rows, geometry);

  return {
    width: WIDTH,
    height: totalHeight,
    title,
    barHeight,
    chartLeft,
    chartRight: CHART_RIGHT,
    usable,
    hasGroupLabels,
    minDate: bounds.minDate,
    maxDate: bounds.maxDate,
    span,
    rows,
    blocks,
    contentBottom,
    riskTasks,
    riskSectionHeight,
    segments,
    gridlineXs,
    geometry,
    labels,
    arrows,
  };
}
