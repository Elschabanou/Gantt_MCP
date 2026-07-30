import { createRequire } from 'node:module';
import sharp from 'sharp';
import { GanttTask, GanttOptions } from '../types.js';
import {
  computeGanttLayout,
  PALETTE,
  RISK_COLORS,
  riskColor,
  truncate,
  splitLabel,
  Anchor,
  BarLabelPlan,
  MilestoneLabelPlan,
  TEXT_LEFT,
  TITLE_Y,
  HEADER_TOP,
  HEADER_H,
  GROUP_LABEL_GAP,
  RISK_TOP_GAP,
  RISK_TITLE_H,
  RISK_ROW_H,
} from './gantt-layout.js';
import { getBackgroundImageBuffer } from './svg-generator.js';
import { PORSCHE_FONT_FAMILY } from './fonts.js';

// pptxgenjs@4.0.1 ships a UMD-style .d.ts (`export default class` + `export as
// namespace`) that does not resolve correctly under this project's NodeNext +
// ESM module settings: both the default export's construct signature and its
// namespace member types (ShapeProps, TextPropsOptions, ...) collapse to the
// raw module-namespace type, which has neither. Rather than fight that, load
// the (plain CommonJS) package via `require` and describe only the slice of
// its API this file actually uses.
interface PptxFill {
  type?: 'none' | 'solid';
  color?: string;
  transparency?: number;
}
interface PptxLine {
  color?: string;
  width?: number;
  dashType?: 'solid' | 'dash' | 'dashDot' | 'lgDash' | 'lgDashDot' | 'lgDashDotDot' | 'sysDash' | 'sysDot';
  endArrowType?: 'none' | 'arrow' | 'diamond' | 'oval' | 'stealth' | 'triangle';
  transparency?: number;
}
interface PptxImageOpts {
  data: string;
  x: number;
  y: number;
  w: number;
  h: number;
  altText?: string;
}
interface PptxPoint {
  x: number;
  y: number;
  moveTo?: boolean;
}
interface PptxObjectOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: PptxFill;
  line?: PptxLine;
  rectRadius?: number;
  shape?: string;
  points?: PptxPoint[];
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  margin?: number;
  wrap?: boolean;
  fit?: 'none' | 'shrink' | 'resize';
  fontFace?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  isTextBox?: boolean;
  objectName?: string;
}
interface PptxSlide {
  background: PptxFill;
  addImage(opts: PptxImageOpts): PptxSlide;
  addShape(shapeName: string, opts: PptxObjectOpts): PptxSlide;
  addText(text: string, opts: PptxObjectOpts): PptxSlide;
}
interface PptxShapeTypes {
  rect: string;
  roundRect: string;
  triangle: string;
}
interface PptxPresentation {
  layout: string;
  title: string;
  author: string;
  subject: string;
  readonly presLayout: { width: number; height: number };
  readonly ShapeType: PptxShapeTypes;
  addSlide(): PptxSlide;
  stream(opts?: { compression?: boolean }): Promise<Buffer>;
}

const require = createRequire(import.meta.url);
const PptxGenJSCtor = require('pptxgenjs') as new () => PptxPresentation;

const EMU_PER_IN = 914400;
const BOX_W_IN = 1.25; // generous text-box width for bar date/name labels; wrap:false keeps it single-line
const BG_CROP_PX_PER_IN = 150; // resolution for the pre-cropped background photo
// Fixed hairline width (points) for gridlines, dividers, dependency arrows and
// risk-colour outlines. Deliberately NOT derived from `toPt`, whose internal
// 6pt floor exists to keep *font sizes* legible on tall charts — reusing it
// here made every one of these lines render at 6pt regardless of intent.
const LINE_PT = 1;

const hex = (color: string) => color.replace('#', '');

export class GanttPPTXGenerator {
  static async generate(tasks: GanttTask[], options?: GanttOptions): Promise<Buffer> {
    const layout = computeGanttLayout(tasks, options);

    const pres = new PptxGenJSCtor();
    pres.layout = 'LAYOUT_WIDE'; // 13.3333 x 7.5 in (16:9)
    pres.title = layout.title;
    pres.author = 'MCP Gantt Server';
    pres.subject = layout.title;

    const slideW = pres.presLayout.width / EMU_PER_IN;
    const slideH = pres.presLayout.height / EMU_PER_IN;

    // Contain-fit the chart canvas onto the slide, centered.
    const scale = Math.min(slideW / layout.width, slideH / layout.height);
    const imgW = layout.width * scale;
    const imgH = layout.height * scale;
    const xOffset = (slideW - imgW) / 2;
    const yOffset = (slideH - imgH) / 2;

    const toIn = (px: number) => px * scale;
    const toX = (px: number) => xOffset + px * scale;
    const toY = (px: number) => yOffset + px * scale;
    const toPt = (px: number) => Math.max(6, px * scale * 72); // clamp: tall charts shrink scale a lot (fonts only)

    const slide = pres.addSlide();
    slide.background = { color: '0B0C10' }; // letterbox bands outside the chart canvas

    // ---- Background: the Porsche photo only, nothing else baked into it ----
    // pptxgenjs's image `sizing: {type:'cover'}` can't crop correctly (it
    // never reads the source image's real pixel dimensions in this version),
    // so the center-crop is done ourselves with sharp before embedding —
    // this reproduces the PNG chart's "cover" photo treatment exactly.
    const rawBg = getBackgroundImageBuffer();
    let bgCropped: Buffer | null = null;
    if (rawBg) {
      const targetW = Math.max(1, Math.round(imgW * BG_CROP_PX_PER_IN));
      const targetH = Math.max(1, Math.round(imgH * BG_CROP_PX_PER_IN));
      bgCropped = await sharp(rawBg)
        .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 88 })
        .toBuffer();
    }
    if (bgCropped) {
      slide.addImage({
        data: `data:image/jpeg;base64,${bgCropped.toString('base64')}`,
        x: xOffset,
        y: yOffset,
        w: imgW,
        h: imgH,
        altText: layout.title,
      });
    } else {
      slide.addShape('rect', { x: xOffset, y: yOffset, w: imgW, h: imgH, fill: { color: '202128' }, objectName: 'bg-fallback' });
    }

    // Darkening scrim so white text/shapes stay readable over the photo — a
    // separate, removable/editable rectangle rather than part of the image.
    slide.addShape('rect', {
      x: xOffset,
      y: yOffset,
      w: imgW,
      h: imgH,
      fill: { color: '0B0C10', transparency: 22 },
      objectName: 'overlay',
    });
    if (layout.hasGroupLabels) {
      slide.addShape('rect', {
        x: xOffset,
        y: yOffset,
        w: toIn(layout.chartLeft + 40),
        h: imgH,
        fill: { color: '0B0C10', transparency: 40 },
        objectName: 'left-scrim',
      });
    }

    // ---- Title ----
    slide.addText(layout.title, {
      x: toX(TEXT_LEFT),
      y: toY(0),
      w: toIn(layout.width - TEXT_LEFT * 2),
      h: toY(HEADER_TOP) - toY(0),
      isTextBox: true,
      margin: 0,
      wrap: false,
      align: 'left',
      valign: 'middle',
      fontFace: PORSCHE_FONT_FAMILY,
      fontSize: toPt(27),
      bold: true,
      color: 'FFFFFF',
      objectName: 'title',
    });

    // ---- Gridlines (dashed month/quarter boundaries) ----
    layout.gridlineXs.forEach((gx, i) => {
      slide.addShape('line', {
        x: toX(gx),
        y: toY(HEADER_TOP),
        w: 0,
        h: toIn(layout.contentBottom - HEADER_TOP),
        line: { color: 'FFFFFF', width: LINE_PT, dashType: 'sysDash', transparency: 70 },
        objectName: `gridline-${i}`,
      });
    });

    // ---- Timeline header (bar + dividers + month/year labels) ----
    slide.addShape('roundRect', {
      x: toX(layout.chartLeft),
      y: toY(HEADER_TOP),
      w: toIn(layout.usable),
      h: toIn(HEADER_H),
      rectRadius: toIn(5),
      fill: { color: '557C99' },
      objectName: 'timeline-bar',
    });
    layout.segments.slice(1).forEach((seg, i) => {
      slide.addShape('line', {
        x: toX(seg.x0),
        y: toY(HEADER_TOP),
        w: 0,
        h: toIn(HEADER_H),
        line: { color: 'FFFFFF', width: LINE_PT, transparency: 78 },
        objectName: `header-divider-${i}`,
      });
    });
    layout.segments.forEach((seg, i) => {
      slide.addText(seg.label, {
        x: toX(seg.x0),
        y: toY(HEADER_TOP),
        w: toIn(seg.x1 - seg.x0),
        h: toIn(HEADER_H),
        isTextBox: true,
        margin: 0,
        wrap: false,
        align: 'center',
        valign: 'middle',
        fontFace: PORSCHE_FONT_FAMILY,
        fontSize: toPt(15),
        bold: true,
        color: 'F2F6FA',
        objectName: `month-${i}`,
      });
    });

    // ---- Group swimlanes (accent bar + name / subtitle) ----
    layout.blocks.forEach((block, i) => {
      const color = PALETTE[block.colorIndex];
      slide.addShape('roundRect', {
        x: toX(layout.chartLeft - 16),
        y: toY(block.startY + 4),
        w: toIn(6),
        h: toIn(block.endY - block.startY - 8),
        rectRadius: toIn(3),
        fill: { color: hex(color.solid) },
        objectName: `group-bar-${i}`,
      });

      const [name, subtitle] = splitLabel(block.label);
      if (!name) return;
      const labelRight = toX(layout.chartLeft - GROUP_LABEL_GAP);
      const labelW = 2.4;
      if (subtitle) {
        const midY = block.startY + (block.endY - block.startY) / 2;
        slide.addText(name, {
          x: labelRight - labelW,
          y: toY(block.startY),
          w: labelW,
          h: toY(midY) - toY(block.startY),
          isTextBox: true,
          margin: 0,
          wrap: false,
          align: 'right',
          valign: 'bottom',
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(17),
          bold: true,
          color: 'FFFFFF',
          objectName: `group-name-${i}`,
        });
        slide.addText(subtitle, {
          x: labelRight - labelW,
          y: toY(midY),
          w: labelW,
          h: toY(block.endY) - toY(midY),
          isTextBox: true,
          margin: 0,
          wrap: false,
          align: 'right',
          valign: 'top',
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(13),
          italic: true,
          color: 'AEB6BF',
          objectName: `group-sub-${i}`,
        });
      } else {
        slide.addText(name, {
          x: labelRight - labelW,
          y: toY(block.startY),
          w: labelW,
          h: toY(block.endY) - toY(block.startY),
          isTextBox: true,
          margin: 0,
          wrap: false,
          align: 'right',
          valign: 'middle',
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(17),
          bold: true,
          color: 'FFFFFF',
          objectName: `group-name-${i}`,
        });
      }
    });

    // ---- Bars & milestones (already-editable task shapes) ----
    const textBox = (px: number, anchor: Anchor, centerYpx: number) => {
      const align = anchor === 'start' ? ('left' as const) : anchor === 'end' ? ('right' as const) : ('center' as const);
      const x = anchor === 'start' ? toX(px) : anchor === 'end' ? toX(px) - BOX_W_IN : toX(px) - BOX_W_IN / 2;
      const h = toIn(16);
      return { x, y: toY(centerYpx) - h / 2, w: BOX_W_IN, h, align, valign: 'middle' as const };
    };

    for (const row of layout.rows) {
      const geom = layout.geometry.get(row.task.id);
      const plan = layout.labels.get(row.task.id);
      if (!geom || !plan) continue;

      const ring = riskColor(row.task.risk);

      if (row.isMilestone) {
        const msPlan = plan as MilestoneLabelPlan;
        slide.addShape(pres.ShapeType.triangle, {
          x: toX(geom.x0 - 7),
          y: toY(geom.topY),
          w: toIn(14),
          h: toIn(13),
          fill: { color: hex(PALETTE[row.colorIndex].bright) },
          ...(ring ? { line: { color: hex(ring), width: LINE_PT } } : {}),
          objectName: `ms-${row.task.id}`,
        });
        slide.addText(msPlan.label, {
          ...textBox(msPlan.tx, msPlan.anchor, geom.topY + 29 - 4),
          isTextBox: true,
          margin: 0,
          wrap: false,
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(12),
          bold: true,
          color: 'FFFFFF',
          objectName: `ms-label-${row.task.id}`,
        });
        slide.addText(msPlan.dateLabel, {
          ...textBox(msPlan.tx, msPlan.anchor, geom.topY + 44 - 4),
          isTextBox: true,
          margin: 0,
          wrap: false,
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(11),
          color: 'AEB6BF',
          objectName: `ms-date-${row.task.id}`,
        });
        continue;
      }

      const barPlan = plan as BarLabelPlan;
      const barOpts: PptxObjectOpts = {
        x: toX(geom.x0),
        y: toY(geom.topY),
        w: toIn(geom.x1 - geom.x0),
        h: toIn(layout.barHeight),
        rectRadius: toIn(4),
        fill: { color: hex(PALETTE[row.colorIndex].solid) },
        ...(ring ? { line: { color: hex(ring), width: LINE_PT } } : {}),
        objectName: `bar-${row.task.id}`,
      };

      if (barPlan.nameInsideBar) {
        slide.addText(row.task.name, {
          ...barOpts,
          shape: pres.ShapeType.roundRect,
          align: 'center',
          valign: 'middle',
          margin: 0,
          wrap: false,
          fit: 'none',
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(12),
          bold: true,
          color: 'FFFFFF',
        });
      } else {
        slide.addShape(pres.ShapeType.roundRect, barOpts);
        slide.addText(row.task.name, {
          ...textBox(barPlan.name.x, barPlan.name.anchor, geom.centerY),
          isTextBox: true,
          margin: 0,
          wrap: false,
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(12),
          bold: true,
          color: 'FFFFFF',
          objectName: `bar-name-${row.task.id}`,
        });
      }

      if (barPlan.startDate) {
        slide.addText(barPlan.startLabel, {
          ...textBox(barPlan.startDate.x, barPlan.startDate.anchor, geom.centerY),
          isTextBox: true,
          margin: 0,
          wrap: false,
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(11),
          color: 'FFFFFF',
          objectName: `bar-start-${row.task.id}`,
        });
      }
      if (barPlan.endDate) {
        slide.addText(barPlan.endLabel, {
          ...textBox(barPlan.endDate.x, barPlan.endDate.anchor, geom.centerY),
          isTextBox: true,
          margin: 0,
          wrap: false,
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(11),
          color: 'FFFFFF',
          objectName: `bar-end-${row.task.id}`,
        });
      }
    }

    // ---- Dependency arrows (custom-geometry line shapes with arrowheads) ----
    layout.arrows.forEach((points, i) => {
      const xs = points.map(([px]) => toX(px));
      const ys = points.map(([, py]) => toY(py));
      const bx0 = Math.min(...xs);
      const bx1 = Math.max(...xs);
      const by0 = Math.min(...ys);
      const by1 = Math.max(...ys);
      const relPoints: PptxPoint[] = points.map(([px, py], idx) => ({
        x: toX(px) - bx0,
        y: toY(py) - by0,
        moveTo: idx === 0,
      }));
      slide.addShape('custGeom', {
        x: bx0,
        y: by0,
        w: bx1 - bx0,
        h: by1 - by0,
        points: relPoints,
        fill: { type: 'none' },
        line: { color: 'E2E9F0', width: LINE_PT, transparency: 30, endArrowType: 'triangle' },
        objectName: `dep-${i}`,
      });
    });

    // ---- Risk section (divider, title, per-task icon/level/name/note) ----
    if (layout.riskTasks.length > 0) {
      const dividerY = layout.contentBottom + RISK_TOP_GAP;
      const xPx = Math.min(TEXT_LEFT, layout.chartLeft);
      const nameXpx = xPx + 74;
      const noteXpx = nameXpx + 226;

      slide.addShape('line', {
        x: toX(xPx),
        y: toY(dividerY),
        w: toIn(layout.chartRight - xPx),
        h: 0,
        line: { color: 'FFFFFF', width: LINE_PT, transparency: 82 },
        objectName: 'risk-divider',
      });
      slide.addText('RISKS', {
        x: toX(xPx),
        y: toY(dividerY),
        w: 1.5,
        h: toIn(RISK_TITLE_H),
        isTextBox: true,
        margin: 0,
        wrap: false,
        align: 'left',
        valign: 'middle',
        fontFace: PORSCHE_FONT_FAMILY,
        fontSize: toPt(14),
        bold: true,
        color: 'FFFFFF',
        objectName: 'risk-title',
      });

      layout.riskTasks.forEach((task, i) => {
        const color = riskColor(task.risk) ?? RISK_COLORS.medium;
        const rowTop = dividerY + RISK_TITLE_H + i * RISK_ROW_H;
        const rowH = toIn(RISK_ROW_H);
        const rowCenterIn = toY(rowTop) + rowH / 2;

        slide.addShape('triangle', {
          x: toX(xPx),
          y: rowCenterIn - toIn(9) / 2,
          w: toIn(10),
          h: toIn(9),
          fill: { color: hex(color) },
          objectName: `risk-icon-${i}`,
        });
        slide.addText((task.risk ?? '').toUpperCase(), {
          x: toX(xPx + 18),
          y: toY(rowTop),
          w: 0.55,
          h: rowH,
          isTextBox: true,
          margin: 0,
          wrap: false,
          align: 'left',
          valign: 'middle',
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(11),
          bold: true,
          color: hex(color),
          objectName: `risk-level-${i}`,
        });
        slide.addText(truncate(task.name, 30), {
          x: toX(nameXpx),
          y: toY(rowTop),
          w: 2.1,
          h: rowH,
          isTextBox: true,
          margin: 0,
          wrap: false,
          align: 'left',
          valign: 'middle',
          fontFace: PORSCHE_FONT_FAMILY,
          fontSize: toPt(12),
          bold: true,
          color: 'FFFFFF',
          objectName: `risk-name-${i}`,
        });
        const note = task.risk_note?.trim();
        if (note) {
          slide.addText(truncate(note, 70), {
            x: toX(noteXpx),
            y: toY(rowTop),
            w: Math.max(0.5, toIn(layout.chartRight - noteXpx)),
            h: rowH,
            isTextBox: true,
            margin: 0,
            wrap: false,
            align: 'left',
            valign: 'middle',
            fontFace: PORSCHE_FONT_FAMILY,
            fontSize: toPt(12),
            color: 'AEB6BF',
            objectName: `risk-note-${i}`,
          });
        }
      });
    }

    return pres.stream({ compression: true });
  }
}
