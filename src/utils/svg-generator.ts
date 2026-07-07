import { readFileSync } from 'node:fs';
import { GanttTask, GanttOptions } from '../types.js';

type SvgTask = GanttTask;

// Background photo, embedded as a base64 data URI so the SVG is self-contained
// for sharp/librsvg rasterization (external file hrefs are blocked). Loaded once
// and cached; `null` means the file was unavailable and we fall back to the
// plain dark gradient background.
let bgImageDataUri: string | null | undefined;
function getBackgroundDataUri(): string | null {
  if (bgImageDataUri !== undefined) return bgImageDataUri;
  try {
    const url = new URL('../../public/S24_2837.jpg', import.meta.url);
    bgImageDataUri = `data:image/jpeg;base64,${readFileSync(url).toString('base64')}`;
  } catch {
    bgImageDataUri = null;
  }
  return bgImageDataUri;
}

interface Row {
  task: SvgTask;
  colorIndex: number;
  y: number;
  height: number;
  isMilestone: boolean;
}

interface GroupBlock {
  label: string;
  colorIndex: number;
  startY: number;
  endY: number;
}

interface Segment {
  x0: number;
  x1: number;
  label: string;
}

// Layout constants
const WIDTH = 1200;
const TEXT_LEFT = 36;
const CHART_LEFT_LABELED = 188; // left gutter reserved for group labels
const GROUP_LABEL_GAP = 22; // gap between right-aligned group label and the chart start
const CHART_LEFT_BARE = 44; // no group labels -> bars start further left
const CHART_RIGHT = WIDTH - 32;
const TITLE_Y = 46;
const HEADER_TOP = 72;
const HEADER_H = 30;
const CONTENT_TOP = 128;
const ROW_H = 34;
const MS_ROW_H = 54;
const GROUP_GAP = 22;
const BOTTOM_PAD = 40;

// Five-color palette: pink -> teal -> green -> amber -> violet (rotates per group)
const PALETTE = [
  { solid: '#e5217d', bright: '#ec2d86' }, // rosa
  { solid: '#25565A', bright: '#25565A' }, // türkis
  { solid: '#98c72f', bright: '#a9d13c' }, // grün
  { solid: '#d9761f', bright: '#f0913a' }, // orange
  { solid: '#6d4bd8', bright: '#8a6bf0' }, // violett
];

export class GanttSVGGenerator {
  static generate(tasks: GanttTask[], options?: GanttOptions): string {
    const title = options?.title?.trim() || 'Project Timeline';
    const barHeight = this.clamp(options?.bar_height ?? 22, 10, ROW_H - 8);

    const bounds = this.getBounds(tasks);
    const span = Math.max(1, this.diffDays(bounds.minDate, bounds.maxDate) + 1);

    // Group tasks by `group`, preserving first-appearance order.
    const order: string[] = [];
    const groupMap = new Map<string, SvgTask[]>();
    for (const task of tasks) {
      const key = task.group ?? '';
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        order.push(key);
      }
      groupMap.get(key)!.push(task);
    }

    // Collapse the left gutter when no group has an actual label.
    const hasGroupLabels = order.some((key) => this.splitLabel(key)[0] !== '');
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
    const totalHeight = contentBottom + BOTTOM_PAD;

    const segments = this.buildSegments(bounds.minDate, bounds.maxDate, span, chartLeft, usable);

    const gridlines = this.buildGridlines(bounds.minDate, bounds.maxDate, span, chartLeft, usable)
      .map(
        (x) =>
          `<line x1="${this.fmt(x)}" y1="${HEADER_TOP}" x2="${this.fmt(x)}" y2="${contentBottom}" class="gridline" />`
      )
      .join('\n  ');

    const headerSvg = this.renderHeader(segments, chartLeft, usable);
    const groupsSvg = blocks.map((block) => this.renderGroup(block, chartLeft)).join('\n  ');
    const rowsSvg = rows
      .map((row) =>
        row.isMilestone
          ? this.renderMilestone(row, bounds.minDate, span, chartLeft, usable)
          : this.renderBar(row, bounds.minDate, span, barHeight, chartLeft, usable)
      )
      .join('\n  ');

    // Darkened photo background: full-bleed image + dark gradient overlay so the
    // white labels/bars stay readable. Falls back to the plain gradient if the
    // image can't be loaded.
    const bgUri = getBackgroundDataUri();
    const backgroundSvg = bgUri
      ? `<image href="${bgUri}" xlink:href="${bgUri}" x="0" y="0" width="${WIDTH}" height="${totalHeight}" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="${WIDTH}" height="${totalHeight}" fill="url(#overlay)" />
  <rect x="0" y="0" width="${CHART_LEFT_LABELED}" height="${totalHeight}" fill="url(#left-scrim)" />`
      : `<rect x="0" y="0" width="${WIDTH}" height="${totalHeight}" fill="url(#bg)" />`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${totalHeight}" viewBox="0 0 ${WIDTH} ${totalHeight}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#202128" />
      <stop offset="100%" stop-color="#141519" />
    </linearGradient>
    <linearGradient id="timeline" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#39566f" />
      <stop offset="45%" stop-color="#557c99" />
      <stop offset="100%" stop-color="#333d49" />
    </linearGradient>
    <linearGradient id="bar-0" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3e0f28" />
      <stop offset="58%" stop-color="#b01a63" />
      <stop offset="100%" stop-color="#ec2d86" />
    </linearGradient>
    <linearGradient id="bar-1" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0c3238" />
      <stop offset="58%" stop-color="#12889b" />
      <stop offset="100%" stop-color="#22c3d6" />
    </linearGradient>
    <linearGradient id="bar-2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2f3d10" />
      <stop offset="58%" stop-color="#6f9422" />
      <stop offset="100%" stop-color="#a9d13c" />
    </linearGradient>
    <linearGradient id="bar-3" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3a1e05" />
      <stop offset="58%" stop-color="#c06a12" />
      <stop offset="100%" stop-color="#f0913a" />
    </linearGradient>
    <linearGradient id="bar-4" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1f1440" />
      <stop offset="58%" stop-color="#5a3fb0" />
      <stop offset="100%" stop-color="#8a6bf0" />
    </linearGradient>
    <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#15161b" stop-opacity="0.84" />
      <stop offset="55%" stop-color="#101116" stop-opacity="0.86" />
      <stop offset="100%" stop-color="#0b0c10" stop-opacity="0.9" />
    </linearGradient>
    <linearGradient id="left-scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0b0c10" stop-opacity="0.72" />
      <stop offset="100%" stop-color="#0b0c10" stop-opacity="0" />
    </linearGradient>
    <style>
      .title { font: 700 27px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; letter-spacing: -0.3px; }
      .timeline-label { font: 700 15px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #f2f6fa; }
      .group-name { font: 700 17px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; }
      .group-sub { font: italic 400 13px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #aeb6bf; }
      .bar-name { font: 700 12px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; }
      .bar-date { font: 400 11px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: rgba(255,255,255,0.92); }
      .ms-label { font: 700 12px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; }
      .ms-date { font: 400 11px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #aeb6bf; }
      .gridline { stroke: rgba(255,255,255,0.30); stroke-width: 1.4; stroke-dasharray: 5 5; }
      .header-divider { stroke: rgba(255,255,255,0.22); stroke-width: 1; }
    </style>
  </defs>

  ${backgroundSvg}

  <text x="${TEXT_LEFT}" y="${TITLE_Y}" class="title">${this.escapeXml(title)}</text>

  ${gridlines}

  ${headerSvg}

  ${groupsSvg}

  ${rowsSvg}
</svg>`;
  }

  private static renderHeader(segments: Segment[], chartLeft: number, usable: number): string {
    const bar = `<rect x="${chartLeft}" y="${HEADER_TOP}" width="${usable}" height="${HEADER_H}" rx="5" fill="url(#timeline)" />`;
    const dividers = segments
      .slice(1)
      .map(
        (seg) =>
          `<line x1="${this.fmt(seg.x0)}" y1="${HEADER_TOP}" x2="${this.fmt(seg.x0)}" y2="${HEADER_TOP + HEADER_H}" class="header-divider" />`
      )
      .join('\n  ');
    const labels = segments
      .map((seg) => {
        const cx = (seg.x0 + seg.x1) / 2;
        return `<text x="${this.fmt(cx)}" y="${HEADER_TOP + HEADER_H / 2 + 5}" text-anchor="middle" class="timeline-label">${this.escapeXml(seg.label)}</text>`;
      })
      .join('\n  ');
    return `${bar}\n  ${dividers}\n  ${labels}`;
  }

  private static renderGroup(block: GroupBlock, chartLeft: number): string {
    const color = PALETTE[block.colorIndex];
    const centerY = (block.startY + block.endY) / 2;
    const swimlane = `<rect x="${chartLeft - 16}" y="${this.fmt(block.startY + 4)}" width="6" height="${this.fmt(block.endY - block.startY - 8)}" rx="3" fill="${color.solid}" />`;

    // Right-align labels so they hug the chart start (accent bar) regardless of
    // length; the gap keeps them clear of the swimlane, so bars never overlap.
    const labelX = chartLeft - GROUP_LABEL_GAP;
    const [name, subtitle] = this.splitLabel(block.label);
    let text = '';
    if (name && subtitle) {
      text = `<text x="${labelX}" y="${this.fmt(centerY - 2)}" text-anchor="end" class="group-name">${this.escapeXml(name)}</text>
  <text x="${labelX}" y="${this.fmt(centerY + 16)}" text-anchor="end" class="group-sub">${this.escapeXml(subtitle)}</text>`;
    } else if (name) {
      text = `<text x="${labelX}" y="${this.fmt(centerY + 5)}" text-anchor="end" class="group-name">${this.escapeXml(name)}</text>`;
    }
    return `${swimlane}\n  ${text}`;
  }

  private static renderBar(
    row: Row,
    minDate: Date,
    span: number,
    barHeight: number,
    chartLeft: number,
    usable: number
  ): string {
    const start = this.parseDate(row.task.start);
    const end = this.parseDate(row.task.end);
    const startX = this.xForDate(minDate, span, start, chartLeft, usable);
    const endX = this.xForDate(minDate, span, this.addDays(end, 1), chartLeft, usable);
    const width = Math.max(8, endX - startX);
    const barY = row.y + (row.height - barHeight) / 2;
    const centerY = barY + barHeight / 2;
    const textY = centerY + 4;

    const rect = `<rect x="${this.fmt(startX)}" y="${this.fmt(barY)}" width="${this.fmt(width)}" height="${barHeight}" rx="4" fill="url(#bar-${row.colorIndex})" />`;
    const startLabel = this.fmtMonthYear(row.task.start);
    const endLabel = this.fmtMonthYear(row.task.end);
    const nameW = row.task.name.length * 6.8;
    const nameText = (x: number, anchor: string) =>
      `<text x="${this.fmt(x)}" y="${this.fmt(textY)}" text-anchor="${anchor}" class="bar-name">${this.escapeXml(row.task.name)}</text>`;

    let texts: string;
    if (nameW <= width - 14) {
      // Name fits inside the bar.
      const center = nameText((startX + endX) / 2, 'middle');
      if (width >= 150 && nameW <= width - 84) {
        // Wide enough: dates inside the ends, name centered.
        texts = `<text x="${this.fmt(startX + 10)}" y="${this.fmt(textY)}" text-anchor="start" class="bar-date">${startLabel}</text>
  ${center}
  <text x="${this.fmt(endX - 10)}" y="${this.fmt(textY)}" text-anchor="end" class="bar-date">${endLabel}</text>`;
      } else {
        // Dates just outside the ends (clamped to the chart), name centered inside.
        const startInside = startX < chartLeft + 40;
        const endInside = endX > CHART_RIGHT - 40;
        const sX = startInside ? startX + 8 : startX - 8;
        const eX = endInside ? endX - 8 : endX + 8;
        texts = `<text x="${this.fmt(sX)}" y="${this.fmt(textY)}" text-anchor="${startInside ? 'start' : 'end'}" class="bar-date">${startLabel}</text>
  ${center}
  <text x="${this.fmt(eX)}" y="${this.fmt(textY)}" text-anchor="${endInside ? 'end' : 'start'}" class="bar-date">${endLabel}</text>`;
      }
    } else {
      // Name too long for the bar: place it beside the bar, no dates (avoids overlap).
      if (endX + 8 + nameW <= CHART_RIGHT) {
        texts = nameText(endX + 8, 'start');
      } else {
        texts = nameText(startX - 8, 'end');
      }
    }
    return `${rect}\n  ${texts}`;
  }

  private static renderMilestone(
    row: Row,
    minDate: Date,
    span: number,
    chartLeft: number,
    usable: number
  ): string {
    const color = PALETTE[row.colorIndex];
    const date = this.parseDate(row.task.start);
    const mx = this.clamp(
      chartLeft + ((this.diffDays(minDate, date) + 0.5) / span) * usable,
      chartLeft,
      CHART_RIGHT
    );
    const ty = row.y + 8;
    // Keep labels inside the canvas near the edges.
    const anchor = mx > CHART_RIGHT - 60 ? 'end' : mx < chartLeft + 60 ? 'start' : 'middle';
    const tx = anchor === 'end' ? mx + 6 : anchor === 'start' ? mx - 6 : mx;
    const triangle = `<polygon points="${this.fmt(mx)},${ty} ${this.fmt(mx - 7)},${ty + 13} ${this.fmt(mx + 7)},${ty + 13}" fill="${color.bright}" />`;
    const label = `<text x="${this.fmt(tx)}" y="${ty + 29}" text-anchor="${anchor}" class="ms-label">${this.escapeXml(row.task.name)}</text>`;
    const dateText = `<text x="${this.fmt(tx)}" y="${ty + 44}" text-anchor="${anchor}" class="ms-date">${this.fmtMonthYear(row.task.start)}</text>`;
    return `${triangle}\n  ${label}\n  ${dateText}`;
  }

  private static buildSegments(
    minDate: Date,
    maxDate: Date,
    span: number,
    chartLeft: number,
    usable: number
  ): Segment[] {
    const segments: Segment[] = [];
    const xFor = (d: Date) => this.xForDate(minDate, span, d, chartLeft, usable);
    const yearMode = span > 366;

    if (yearMode) {
      for (let year = minDate.getFullYear(); year <= maxDate.getFullYear(); year++) {
        const segStart = year === minDate.getFullYear() ? minDate : new Date(year, 0, 1);
        const segEndExcl =
          year === maxDate.getFullYear() ? this.addDays(maxDate, 1) : new Date(year + 1, 0, 1);
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
        const segEndExcl = isLast ? this.addDays(maxDate, 1) : nextMonth;
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
  private static buildGridlines(
    minDate: Date,
    maxDate: Date,
    span: number,
    chartLeft: number,
    usable: number
  ): number[] {
    const xs: number[] = [];
    const maxExcl = this.addDays(maxDate, 1);
    const yearMode = span > 366;

    if (yearMode) {
      for (let year = minDate.getFullYear(); year <= maxDate.getFullYear(); year++) {
        for (const month of [0, 3, 6, 9]) {
          const d = new Date(year, month, 1);
          if (d > minDate && d < maxExcl) {
            xs.push(this.xForDate(minDate, span, d, chartLeft, usable));
          }
        }
      }
    } else {
      let cursor = new Date(minDate.getFullYear(), minDate.getMonth() + 1, 1);
      while (cursor < maxExcl) {
        xs.push(this.xForDate(minDate, span, cursor, chartLeft, usable));
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }
    return xs;
  }

  private static splitLabel(label: string): [string, string] {
    if (!label) return ['', ''];
    const separator = label.includes('/') ? '/' : label.includes('\n') ? '\n' : '';
    if (!separator) return [label.trim(), ''];
    const idx = label.indexOf(separator);
    return [label.slice(0, idx).trim(), label.slice(idx + 1).trim()];
  }

  private static xForDate(
    minDate: Date,
    span: number,
    date: Date,
    chartLeft: number,
    usable: number
  ): number {
    const x = chartLeft + (this.diffDays(minDate, date) / span) * usable;
    return this.clamp(x, chartLeft, CHART_RIGHT);
  }

  private static getBounds(tasks: SvgTask[]): { minDate: Date; maxDate: Date } {
    const dates = tasks.flatMap((task) => [this.parseDate(task.start), this.parseDate(task.end)]);
    const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
    const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));
    return { minDate, maxDate };
  }

  private static parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }

  private static addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private static diffDays(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((endUtc - startUtc) / msPerDay);
  }

  private static fmtMonthYear(value: string): string {
    const [year, month] = value.split('-');
    return `${month}/${year.slice(2)}`;
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private static fmt(value: number): string {
    return (Math.round(value * 100) / 100).toString();
  }

  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
