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
    const leftPadding = 260;
    const rightPadding = 40;
    const topPadding = 80;
    const rowHeight = 48;
    const barHeight = options?.bar_height ?? 24;
    const totalHeight = topPadding + normalizedTasks.length * rowHeight + 90;
    const chartSpanDays = Math.max(1, this.diffDays(bounds.minDate, bounds.maxDate) + 1);
    const usableWidth = chartWidth - leftPadding - rightPadding;

    const monthLabels = this.buildTimelineLabels(bounds.minDate, bounds.maxDate);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${totalHeight}" viewBox="0 0 ${chartWidth} ${totalHeight}">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#eef2ff" />
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#7c3aed" />
    </linearGradient>
    <style>
      .title { font: 700 28px Inter, Arial, sans-serif; fill: #0f172a; }
      .subtitle { font: 400 14px Inter, Arial, sans-serif; fill: #475569; }
      .label { font: 600 13px Inter, Arial, sans-serif; fill: #0f172a; }
      .meta { font: 400 12px Inter, Arial, sans-serif; fill: #64748b; }
      .axis { font: 600 11px Inter, Arial, sans-serif; fill: #475569; }
      .grid { stroke: #cbd5e1; stroke-width: 1; }
      .row { stroke: #e2e8f0; stroke-width: 1; }
      .bar { fill: url(#bar); }
      .progress { fill: rgba(255,255,255,0.35); }
      .card { fill: white; stroke: #e2e8f0; stroke-width: 1; }
    </style>
  </defs>

  <rect x="0" y="0" width="${chartWidth}" height="${totalHeight}" fill="url(#background)" />
  <rect x="20" y="20" width="${chartWidth - 40}" height="${totalHeight - 40}" rx="20" class="card" />

  <text x="40" y="60" class="title">Gantt Diagram</text>
  <text x="40" y="82" class="subtitle">Static image export for MCP / Perplexity</text>

  <line x1="${leftPadding}" y1="${topPadding - 12}" x2="${chartWidth - rightPadding}" y2="${topPadding - 12}" class="grid" />

  ${monthLabels.map((label) => this.renderAxisLabel(label, leftPadding, usableWidth, bounds.minDate, chartSpanDays)).join('\n  ')}

  ${normalizedTasks.map((task, index) => this.renderTaskRow(task, index, bounds.minDate, chartSpanDays, leftPadding, usableWidth, topPadding, rowHeight, barHeight)).join('\n  ')}

  <text x="40" y="${totalHeight - 24}" class="meta">Generated ${new Date().toLocaleString()}</text>
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
    const labelY = y + barHeight / 2 + 5;
    const progressWidth = Math.max(0, Math.min(width, (task.progressValue / 100) * width));
    const priorityColor = this.getPriorityColor(task.priority);

    return `
    <line x1="${leftPadding}" y1="${topPadding + index * rowHeight + rowHeight - 6}" x2="${leftPadding + usableWidth}" y2="${topPadding + index * rowHeight + rowHeight - 6}" class="row" />
    <text x="40" y="${labelY}" class="label">${this.escapeXml(task.name)}</text>
    <text x="40" y="${labelY + 16}" class="meta">${this.escapeXml(task.id)} • ${this.escapeXml(task.start)} → ${this.escapeXml(task.end)}${task.priority ? ` • ${this.escapeXml(task.priority)}` : ''}</text>
    <rect x="${x}" y="${y}" width="${width}" height="${barHeight}" rx="8" fill="${priorityColor}" />
    <rect x="${x}" y="${y}" width="${progressWidth}" height="${barHeight}" rx="8" class="progress" />
    <text x="${x + 10}" y="${labelY}" class="axis" fill="#ffffff">${Math.round(task.progressValue)}%</text>`;
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

  private static getPriorityColor(priority?: string): string {
    switch (priority) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#4f46e5';
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