import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export const PDF_WORKER_SRC = '/assets/pdfjs/pdf.worker.min.mjs';
GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

export type PdfDocumentLoader = (source: { data: ArrayBuffer }) => Pick<PDFDocumentLoadingTask, 'promise'>;

export function loadPdfDocument(data: ArrayBuffer, loader: PdfDocumentLoader = getDocument): Promise<PDFDocumentProxy> {
  // PDF.js 6 removed isEvalSupported together with its final eval-based compiler.
  // Use only the rendering API; no PDF scripting manager or JavaScript actions.
  return loader({ data }).promise;
}

export async function renderPdfPage(page: PDFPageProxy, canvas: HTMLCanvasElement): Promise<void> {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PDF canvas context unavailable');
  const viewport = page.getViewport({ scale: 1.5 });
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  await page.render({ canvas, canvasContext: context, viewport }).promise;
}
