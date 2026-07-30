import { readFileSync } from 'node:fs';
import { GanttTask, GanttOptions } from '../types.js';
import {
  Row,
  GroupBlock,
  Geometry,
  BarLabelPlan,
  MilestoneLabelPlan,
  GanttLayout,
  computeGanttLayout,
  riskColor,
  truncate,
  splitLabel,
  PALETTE,
  RISK_COLORS,
  TEXT_LEFT,
  CHART_LEFT_LABELED,
  CHART_RIGHT,
  GROUP_LABEL_GAP,
  TITLE_Y,
  HEADER_TOP,
  HEADER_H,
  RISK_TOP_GAP,
  RISK_TITLE_H,
  RISK_ROW_H,
} from './gantt-layout.js';

// Background photo. Loaded once and cached as raw bytes; `null` means the
// file was unavailable and callers fall back to a plain dark background.
let bgImageBuffer: Buffer | null | undefined;
export function getBackgroundImageBuffer(): Buffer | null {
  if (bgImageBuffer !== undefined) return bgImageBuffer;
  try {
    const url = new URL('../../public/S24_2837.jpg', import.meta.url);
    bgImageBuffer = readFileSync(url);
  } catch {
    bgImageBuffer = null;
  }
  return bgImageBuffer;
}

// Base64 data URI variant, so the SVG stays self-contained for sharp/librsvg
// rasterization (external file hrefs are blocked there).
let bgImageDataUri: string | null | undefined;
function getBackgroundDataUri(): string | null {
  if (bgImageDataUri !== undefined) return bgImageDataUri;
  const buf = getBackgroundImageBuffer();
  bgImageDataUri = buf ? `data:image/jpeg;base64,${buf.toString('base64')}` : null;
  return bgImageDataUri;
}

export class GanttSVGGenerator {
  static generate(tasks: GanttTask[], options?: GanttOptions): string {
    return this.renderFromLayout(computeGanttLayout(tasks, options));
  }

  private static renderFromLayout(layout: GanttLayout): string {
    const { width, height: totalHeight, chartLeft, usable } = layout;

    const gridlines = layout.gridlineXs
      .map(
        (x) =>
          `<line x1="${this.fmt(x)}" y1="${HEADER_TOP}" x2="${this.fmt(x)}" y2="${layout.contentBottom}" class="gridline" />`
      )
      .join('\n  ');

    const headerSvg = this.renderHeader(layout.segments, chartLeft, usable);
    const groupsSvg = layout.blocks.map((block) => this.renderGroup(block, chartLeft)).join('\n  ');

    const rowsSvg = layout.rows
      .map((row) => {
        const geom = layout.geometry.get(row.task.id);
        const plan = layout.labels.get(row.task.id);
        if (!geom || !plan) return '';
        return row.isMilestone
          ? this.renderMilestone(row, geom, plan as MilestoneLabelPlan)
          : this.renderBar(row, geom, plan as BarLabelPlan, layout.barHeight);
      })
      .join('\n  ');

    const depsSvg = this.renderDependencies(layout.arrows);
    const risksSvg = this.renderRiskSection(layout.riskTasks, layout.contentBottom, chartLeft);

    // Darkened photo background: full-bleed image + dark gradient overlay so the
    // white labels/bars stay readable. Falls back to the plain gradient if the
    // image can't be loaded.
    const bgUri = getBackgroundDataUri();
    const backgroundSvg = bgUri
      ? `<image href="${bgUri}" xlink:href="${bgUri}" x="0" y="0" width="${width}" height="${totalHeight}" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="${width}" height="${totalHeight}" fill="url(#overlay)" />
  <rect x="0" y="0" width="${CHART_LEFT_LABELED}" height="${totalHeight}" fill="url(#left-scrim)" />`
      : `<rect x="0" y="0" width="${width}" height="${totalHeight}" fill="url(#bg)" />`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
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
    <marker id="dep-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M0,0.5 L8,4 L0,7.5 Z" fill="rgba(226,233,240,0.7)" />
    </marker>
    <style>
      .title { font: 700 27px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; letter-spacing: -0.3px; }
      .timeline-label { font: 700 15px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #f2f6fa; }
      .group-name { font: 700 17px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; }
      .group-sub { font: italic 400 13px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #aeb6bf; }
      .bar-name { font: 700 12px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; }
      .bar-date { font: 400 11px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: rgba(255,255,255,0.92); }
      .ms-label { font: 700 12px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; }
      .ms-date { font: 400 11px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #aeb6bf; }
      .dep-line { fill: none; stroke: rgba(226,233,240,0.5); stroke-width: 1.2; stroke-linecap: butt; stroke-linejoin: round; }
      .risk-title { font: 700 14px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; letter-spacing: 0.6px; }
      .risk-level { font: 700 11px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.4px; }
      .risk-task { font: 700 12px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; }
      .risk-note { font: 400 12px 'Porsche Next TT', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; fill: #aeb6bf; }
      .risk-divider { stroke: rgba(255,255,255,0.18); stroke-width: 1; }
      .gridline { stroke: rgba(255,255,255,0.30); stroke-width: 1.4; stroke-dasharray: 5 5; }
      .header-divider { stroke: rgba(255,255,255,0.22); stroke-width: 1; }
    </style>
  </defs>

  ${backgroundSvg}

  <text x="${TEXT_LEFT}" y="${TITLE_Y}" class="title">${this.escapeXml(layout.title)}</text>

  ${gridlines}

  ${headerSvg}

  ${groupsSvg}

  ${rowsSvg}

  ${depsSvg}

  ${risksSvg}
</svg>`;
  }

  private static renderHeader(
    segments: GanttLayout['segments'],
    chartLeft: number,
    usable: number
  ): string {
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
    const [name, subtitle] = splitLabel(block.label);
    let text = '';
    if (name && subtitle) {
      text = `<text x="${labelX}" y="${this.fmt(centerY - 2)}" text-anchor="end" class="group-name">${this.escapeXml(name)}</text>
  <text x="${labelX}" y="${this.fmt(centerY + 16)}" text-anchor="end" class="group-sub">${this.escapeXml(subtitle)}</text>`;
    } else if (name) {
      text = `<text x="${labelX}" y="${this.fmt(centerY + 5)}" text-anchor="end" class="group-name">${this.escapeXml(name)}</text>`;
    }
    return `${swimlane}\n  ${text}`;
  }

  private static renderBar(row: Row, geom: Geometry, plan: BarLabelPlan, barHeight: number): string {
    const startX = geom.x0;
    const width = geom.x1 - geom.x0;
    const barY = geom.topY;
    const textY = geom.centerY + 4;

    const rect = `<rect x="${this.fmt(startX)}" y="${this.fmt(barY)}" width="${this.fmt(width)}" height="${barHeight}" rx="4" fill="url(#bar-${row.colorIndex})" />`;
    // At-risk bars get an outline in the risk colour, drawn just outside the
    // fill so it stays readable on every palette colour.
    const riskColorVal = riskColor(row.task.risk);
    const riskRing = riskColorVal
      ? `\n  <rect x="${this.fmt(startX - 2)}" y="${this.fmt(barY - 2)}" width="${this.fmt(width + 4)}" height="${barHeight + 4}" rx="6" fill="none" stroke="${riskColorVal}" stroke-width="1.6" />`
      : '';

    const nameText = `<text x="${this.fmt(plan.name.x)}" y="${this.fmt(textY)}" text-anchor="${plan.name.anchor}" class="bar-name">${this.escapeXml(row.task.name)}</text>`;
    const startDateText = plan.startDate
      ? `<text x="${this.fmt(plan.startDate.x)}" y="${this.fmt(textY)}" text-anchor="${plan.startDate.anchor}" class="bar-date">${this.escapeXml(plan.startLabel)}</text>`
      : '';
    const endDateText = plan.endDate
      ? `<text x="${this.fmt(plan.endDate.x)}" y="${this.fmt(textY)}" text-anchor="${plan.endDate.anchor}" class="bar-date">${this.escapeXml(plan.endLabel)}</text>`
      : '';

    const texts = plan.nameInsideBar
      ? [startDateText, nameText, endDateText].filter(Boolean).join('\n  ')
      : nameText;

    return `${rect}${riskRing}\n  ${texts}`;
  }

  private static renderMilestone(row: Row, geom: Geometry, plan: MilestoneLabelPlan): string {
    const color = PALETTE[row.colorIndex];
    const mx = geom.x0;
    const ty = geom.topY;
    const riskColorVal = riskColor(row.task.risk);
    const riskStroke = riskColorVal
      ? ` stroke="${riskColorVal}" stroke-width="1.6" stroke-linejoin="round"`
      : '';
    const triangle = `<polygon points="${this.fmt(mx)},${ty} ${this.fmt(mx - 7)},${ty + 13} ${this.fmt(mx + 7)},${ty + 13}" fill="${color.bright}"${riskStroke} />`;
    const label = `<text x="${this.fmt(plan.tx)}" y="${ty + 29}" text-anchor="${plan.anchor}" class="ms-label">${this.escapeXml(plan.label)}</text>`;
    const dateText = `<text x="${this.fmt(plan.tx)}" y="${ty + 44}" text-anchor="${plan.anchor}" class="ms-date">${this.escapeXml(plan.dateLabel)}</text>`;
    return `${triangle}\n  ${label}\n  ${dateText}`;
  }

  /**
   * "Risks" list below the chart: one line per flagged task with a warning
   * triangle in the risk colour, the level, the task name and its note.
   * Returns an empty string when nothing is flagged, so the chart keeps its
   * original footprint.
   */
  private static renderRiskSection(
    riskTasks: GanttTask[],
    contentBottom: number,
    chartLeft: number
  ): string {
    if (riskTasks.length === 0) return '';

    const dividerY = contentBottom + RISK_TOP_GAP;
    const x = Math.min(TEXT_LEFT, chartLeft);
    // Fixed columns keep the list readable as a table regardless of name length.
    const nameX = x + 74;
    const noteX = nameX + 226;
    const parts = [
      `<line x1="${x}" y1="${this.fmt(dividerY)}" x2="${CHART_RIGHT}" y2="${this.fmt(dividerY)}" class="risk-divider" />`,
      `<text x="${x}" y="${this.fmt(dividerY + 21)}" class="risk-title">RISKS</text>`,
    ];

    riskTasks.forEach((task, index) => {
      const color = riskColor(task.risk) ?? RISK_COLORS.medium;
      const baseline = dividerY + RISK_TITLE_H + index * RISK_ROW_H + 12;
      const iconY = baseline - 9;
      // Warning triangle, matching the milestone marker's visual language.
      parts.push(
        `<polygon points="${x + 5},${this.fmt(iconY)} ${x},${this.fmt(iconY + 9)} ${x + 10},${this.fmt(iconY + 9)}" fill="${color}" />`
      );
      parts.push(
        `<text x="${x + 18}" y="${this.fmt(baseline)}" class="risk-level" fill="${color}">${(task.risk ?? '').toUpperCase()}</text>`
      );
      parts.push(
        `<text x="${nameX}" y="${this.fmt(baseline)}" class="risk-task">${this.escapeXml(truncate(task.name, 30))}</text>`
      );
      const note = task.risk_note?.trim();
      if (note) {
        parts.push(
          `<text x="${noteX}" y="${this.fmt(baseline)}" class="risk-note">${this.escapeXml(truncate(note, Math.floor((CHART_RIGHT - noteX) / 6.4)))}</text>`
        );
      }
    });

    return parts.join('\n  ');
  }

  /**
   * Thin orthogonal arrows from each dependency's bar to its dependent task's
   * bar. Point paths come from the shared layout (`layout.arrows`); this just
   * rounds the corners and serializes each one as an SVG path.
   */
  private static renderDependencies(arrows: Array<Array<[number, number]>>): string {
    return arrows
      .map((points) => `<path d="${this.orthPath(points)}" class="dep-line" marker-end="url(#dep-arrow)" />`)
      .join('\n  ');
  }

  /**
   * Turns a polyline into a path whose corners are slightly rounded, keeping
   * the segments crisp while avoiding hard pixel-stepped joins.
   */
  private static orthPath(points: Array<[number, number]>, radius = 4): string {
    const pts = points.filter(
      (point, i) =>
        i === 0 || Math.abs(point[0] - points[i - 1][0]) > 0.01 || Math.abs(point[1] - points[i - 1][1]) > 0.01
    );
    if (pts.length < 2) return '';

    let d = `M ${this.fmt(pts[0][0])},${this.fmt(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i - 1];
      const [cx, cy] = pts[i];
      const [nx, ny] = pts[i + 1];
      const inLen = Math.hypot(cx - px, cy - py);
      const outLen = Math.hypot(nx - cx, ny - cy);
      const r = Math.min(radius, inLen / 2, outLen / 2);
      const ax = cx + ((px - cx) / inLen) * r;
      const ay = cy + ((py - cy) / inLen) * r;
      const bx = cx + ((nx - cx) / outLen) * r;
      const by = cy + ((ny - cy) / outLen) * r;
      d += ` L ${this.fmt(ax)},${this.fmt(ay)} Q ${this.fmt(cx)},${this.fmt(cy)} ${this.fmt(bx)},${this.fmt(by)}`;
    }
    const last = pts[pts.length - 1];
    return `${d} L ${this.fmt(last[0])},${this.fmt(last[1])}`;
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
