import sharp from 'sharp';
import { GanttTask, GanttOptions } from '../types.js';
import { GanttSVGGenerator } from './svg-generator.js';

export class GanttPNGGenerator {
  static async generate(tasks: GanttTask[], options?: GanttOptions): Promise<Buffer> {
    const svg = GanttSVGGenerator.generate(tasks, options);
    return sharp(Buffer.from(svg, 'utf8')).png().toBuffer();
  }
}