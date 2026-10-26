declare module 'pdfkit' {
  import { Readable } from 'node:stream';
  interface TextOptions {
    width: number;
    align?: 'center' | 'left';
    lineGap?: number;
    features: { ccmp: false };
  }
  export default class PDFDocument extends Readable {
    constructor(options: {
      size: 'A4';
      layout: 'landscape';
      margin: number;
      compress?: boolean;
      info?: { Title: string; Author: string };
    });
    registerFont(name: string, bytes: Buffer): this;
    font(name: string): this;
    fontSize(size: number): this;
    fillColor(color: string): this;
    strokeColor(color: string): this;
    lineWidth(width: number): this;
    rect(x: number, y: number, width: number, height: number): this;
    stroke(): this;
    text(value: string, x: number, y: number, options: TextOptions): this;
    heightOfString(value: string, options: TextOptions): number;
    image(
      bytes: Buffer,
      x: number,
      y: number,
      options: { fit: [number, number]; align: 'center'; valign: 'center' },
    ): this;
    end(): void;
    _font: { font: { hasGlyphForCodePoint(codePoint: number): boolean } };
  }
}
