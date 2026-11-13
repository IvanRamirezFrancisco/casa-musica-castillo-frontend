import { ElementRef } from '@angular/core';
import { GlobalWorkerOptions, version } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { OrderDetailComponent } from '../../components/order-detail/order-detail.component';
import { OrderDetailModalComponent } from '../../components/admin/order-detail-modal/order-detail-modal.component';
import { loadPdfDocument, PDF_WORKER_SRC, PdfDocumentLoader, renderPdfPage } from './pdf-preview';

// Four-object, vector-only PDF. No customer data, fonts, scripts or network resources.
function syntheticPdf(): ArrayBuffer {
  const stream = '0 0 1 rg 10 10 80 80 re f\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xref = pdf.length;
  pdf += 'xref\n0 5\n0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => { pdf += String(offset).padStart(10, '0') + ' 00000 n \n'; });
  pdf += 'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return new TextEncoder().encode(pdf).buffer;
}

function expectBluePage(canvas: HTMLCanvasElement): void {
  expect(canvas.width).toBe(150);
  expect(canvas.height).toBe(150);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Missing test canvas');
  expect(Array.from(context.getImageData(50, 50, 1, 1).data)).toEqual([0, 0, 255, 255]);
}

describe('PDF.js 6 secure browser previews', () => {
  it('configures the local ESM worker', () => {
    expect(GlobalWorkerOptions.workerSrc).toBe(PDF_WORKER_SRC);
    expect(PDF_WORKER_SRC).toBe('/assets/pdfjs/pdf.worker.min.mjs');
  });

  it('serves a worker matching the library without the removed eval compiler', async () => {
    const response = await fetch(PDF_WORKER_SRC);
    expect(response.ok).toBeTrue();
    const worker = await response.text();
    expect(worker).toContain(version);
    expect(worker).not.toMatch(/\beval\s*\(/);
    expect(worker).not.toMatch(/new\s+Function\s*\(/);
  });

  it('loads binary data using supported v6 options without a PDF scripting API', async () => {
    const document = jasmine.createSpyObj<PDFDocumentProxy>('document', ['getPage']);
    const loader = jasmine.createSpy<PdfDocumentLoader>('loader').and.returnValue({ promise: Promise.resolve(document) });
    const data = syntheticPdf();
    expect(await loadPdfDocument(data, loader)).toBe(document);
    expect(loader).toHaveBeenCalledOnceWith({ data });
    // isEvalSupported:false protected v3 during migration; v6 removed that option and all eval code.
    expect(Object.keys(loader.calls.mostRecent().args[0])).toEqual(['data']);
  });

  it('propagates a worker loading failure to the consumer error handler', async () => {
    const loader: PdfDocumentLoader = () => ({ promise: Promise.reject(new Error('Synthetic worker unavailable')) });
    await expectAsync(loadPdfDocument(syntheticPdf(), loader)).toBeRejectedWithError('Synthetic worker unavailable');
  });

  it('loads a synthetic PDF with the real worker and renders page one at scale 1.5', async () => {
    const document = await loadPdfDocument(syntheticPdf());
    try {
      expect(document.numPages).toBe(1);
      const canvas = window.document.createElement('canvas');
      await renderPdfPage(await document.getPage(1), canvas);
      expectBluePage(canvas);
    } finally {
      await document.loadingTask.destroy();
    }
  });

  it('rejects a corrupt PDF', async () => {
    await expectAsync(loadPdfDocument(new TextEncoder().encode('Synthetic corrupt PDF').buffer)).toBeRejected();
  });

  it('rejects an unavailable canvas context', async () => {
    const document = await loadPdfDocument(syntheticPdf());
    try {
      const canvas = window.document.createElement('canvas');
      spyOn(canvas, 'getContext').and.returnValue(null);
      await expectAsync(renderPdfPage(await document.getPage(1), canvas)).toBeRejectedWithError('PDF canvas context unavailable');
    } finally {
      await document.loadingTask.destroy();
    }
  });

  for (const [name, render] of [
    ['customer order', OrderDetailComponent.prototype.renderPdf],
    ['admin order modal', OrderDetailModalComponent.prototype.renderPdf]
  ] as const) {
    it('keeps the ' + name + ' preview rendering with the real worker', async () => {
      const canvas = document.createElement('canvas');
      const context = {
        pdfCanvas: new ElementRef(canvas),
        pdfDocument: null as PDFDocumentProxy | null,
        proofPreviewError: null as string | null,
        cdr: { detectChanges: jasmine.createSpy('detectChanges') }
      };
      try {
        await render.call(context, new Blob([syntheticPdf()], { type: 'application/pdf' }));
        for (let i = 0; i < 100; i++) {
          const pixel = canvas.getContext('2d')?.getImageData(50, 50, 1, 1).data;
          if (pixel?.[2] === 255 || context.proofPreviewError) break;
          await new Promise<void>(resolve => setTimeout(resolve, 25));
        }
        expect(context.proofPreviewError).toBeNull();
        expect(context.cdr.detectChanges).toHaveBeenCalled();
        expectBluePage(canvas);
      } finally {
        await context.pdfDocument?.loadingTask.destroy();
      }
    });
  }
});
