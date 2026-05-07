import { GanttTask, GanttOptions } from '../types.js';

type SvgTask = GanttTask & { progressValue: number };

export class GanttSVGGenerator {
  static generate(tasks: GanttTask[], options?: GanttOptions): string {
    const normalizedTasks: SvgTask[] = tasks.map((task) => ({
      ...task,
      progressValue: typeof task.progress === 'number' ? task.progress : 0,
    }));

    const bounds = this.getBounds(normalizedTasks);
    const chartWidth = 1200;
    const leftPadding = 240;
    const rightPadding = 40;
    const topPadding = 100;
    const rowHeight = 52;
    const barHeight = options?.bar_height ?? 20;
    const totalHeight = topPadding + normalizedTasks.length * rowHeight + 60;
    const chartSpanDays = Math.max(1, this.diffDays(bounds.minDate, bounds.maxDate) + 1);
    const usableWidth = chartWidth - leftPadding - rightPadding;

    const monthLabels = this.buildTimelineLabels(bounds.minDate, bounds.maxDate);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${totalHeight}" viewBox="0 0 ${chartWidth} ${totalHeight}">
  <defs>
    <linearGradient id="bar-default" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>
    <linearGradient id="bar-high" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#ea580c" />
    </linearGradient>
    <linearGradient id="bar-medium" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#ca8a04" />
    </linearGradient>
    <linearGradient id="bar-low" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.1" flood-color="#000000" />
    </filter>
    <style>
      .background { fill: #ffffff; }
      .title { font: 700 26px 'Segoe UI', -apple-system, sans-serif; fill: #1e293b; letter-spacing: -0.5px; }
      .subtitle { font: 400 13px 'Segoe UI', -apple-system, sans-serif; fill: #64748b; }
      .label { font: 500 13px 'Segoe UI', -apple-system, sans-serif; fill: #0f172a; }
      .meta-text { font: 400 11px 'Segoe UI', -apple-system, sans-serif; fill: #94a3b8; }
      .axis { font: 500 11px 'Segoe UI', -apple-system, sans-serif; fill: #64748b; }
      .progress-text { font: 600 10px 'Segoe UI', -apple-system, sans-serif; fill: #ffffff; }
      .divider { stroke: #e2e8f0; stroke-width: 0.5; }
      .bar { filter: url(#shadow); }
    </style>
  </defs>

  <rect x="0" y="0" width="${chartWidth}" height="${totalHeight}" class="background" />

  <text x="32" y="52" class="title">Project Timeline</text>
  <text x="32" y="70" class="subtitle">Task schedule and progress overview</text>

  <line x1="${leftPadding}" y1="${topPadding - 20}" x2="${chartWidth - rightPadding}" y2="${topPadding - 20}" class="divider" />

  ${monthLabels.map((label) => this.renderAxisLabel(label, leftPadding, usableWidth, bounds.minDate, chartSpanDays)).join('\n  ')}

  <line x1="${leftPadding}" y1="${topPadding}" x2="${chartWidth - rightPadding}" y2="${topPadding}" class="divider" />

  ${normalizedTasks.map((task, index) => this.renderTaskRow(task, index, bounds.minDate, chartSpanDays, leftPadding, usableWidth, topPadding, rowHeight, barHeight)).join('\n  ')}

  <text x="32" y="${totalHeight - 16}" class="meta-text">Generated on ${new Date().toLocaleDateString()}</text>
</svg>`;
  }

  private static renderAxisLabel(
    label: Date,
    leftPadding: number,
    usableWidth: number,
    minDate: Date,
    chartSpanDays: number
  ): string {
    const offset = this.diffDays(minDate, label);
    const x = leftPadding + (offset / chartSpanDays) * usableWidth;
    const monthName = label.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    return `<text x="${x}" y="${74}" class="axis">${this.escapeXml(monthName)}</text>`;
  }

  private static renderTaskRow(
    task: SvgTask,
    index: number,
    minDate: Date,
    chartSpanDays: number,
    leftPadding: number,
    usableWidth: number,
    topPadding: number,
    rowHeight: number,
    barHeight: number
  ): string {
    const startDate = new Date(task.start);
    const endDate = new Date(task.end);
    const startOffset = this.diffDays(minDate, startDate);
    const duration = Math.max(1, this.diffDays(startDate, endDate) + 1);
    const x = leftPadding + (startOffset / chartSpanDays) * usableWidth;
    const width = Math.max(4, (duration / chartSpanDays) * usableWidth);
    const y = topPadding + index * rowHeight + (rowHeight - barHeight) / 2;
    const labelY = topPadding + index * rowHeight + 18;
    const progressWidth = Math.max(0, Math.min(width, (task.progressValue / 100) * width));
    const barGradient = this.getGradient(task.priority);

    return `
    <text x="32" y="${labelY}" class="label">${this.escapeXml(task.name)}</text>
    <text x="32" y="${labelY + 14}" class="meta-text">${this.escapeXml(task.id)} • ${this.escapeXml(task.start)} to ${this.escapeXml(task.end)}</text>
    <line x1="${leftPadding}" y1="${topPadding + (index + 1) * rowHeight - 2}" x2="${leftPadding + usableWidth}" y2="${topPadding + (index + 1) * rowHeight - 2}" class="divider" />
    <rect x="${x}" y="${y}" width="${width}" height="${barHeight}" rx="6" fill="url(#${barGradient})" class="bar" />
    ${progressWidth > 0 ? `<rect x="${x}" y="${y}" width="${progressWidth}" height="${barHeight}" rx="6" fill="rgba(255,255,255,0.3)" class="bar" />` : ''}
    ${width > 45 ? `<text x="${x + 8}" y="${y + barHeight / 2 + 3}" class="progress-text">${Math.round(task.progressValue)}%</text>` : ''}`;
  }

  private static buildTimelineLabels(minDate: Date, maxDate: Date): Date[] {
    const labels: Date[] = [];
    const cursor = new Date(minDate);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= maxDate) {
      labels.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    if (labels.length === 0) labels.push(new Date(minDate));
    return labels;
  }

  private static getBounds(tasks: SvgTask[]): { minDate: Date; maxDate: Date } {
    const dates = tasks.flatMap((task) => [new Date(task.start), new Date(task.end)]);
    const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
    const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);
    return { minDate, maxDate };
  }

  private static diffDays(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((endUtc - startUtc) / msPerDay);
  }

  private static getGradient(priority?: string): string {
    switch (priority) {
      case 'high':
        return 'bar-high';
      case 'medium':
        return 'bar-medium';
      case 'low':
        return 'bar-low';
      default:
        return 'bar-default';
    }
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