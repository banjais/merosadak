declare module 'pdfkit' {
  class PDFDocument {
    y: number;
    constructor(options?: any);
    on(event: string, callback: (...args: any[]) => void): this;
    fontSize(size: number): this;
    fillColor(color: string): this;
    text(text: string, options?: any): this;
    moveDown(lines?: number): this;
    rect(x: number, y: number, width: number, height: number): this;
    fill(color?: string): this;
    end(): void;
  }

  export default PDFDocument;
}
