// src/lib/pdfToImages.ts
import * as pdfjsLib from 'pdfjs-dist';

// Ensure the PDF.js worker is set. We ship worker in /public already.
// For Vite, this path resolves to public/pdf.worker.mjs
// If you move the worker, update this path accordingly.
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

export async function pdfFileToImageDataUrls(file: File, maxWidth = 1200, mime: 'image/jpeg' | 'image/png' = 'image/jpeg', quality = 0.85): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / viewport.width);
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context not available');

    canvas.width = Math.floor(scaledViewport.width);
    canvas.height = Math.floor(scaledViewport.height);

    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
    } as any;

    await page.render(renderContext).promise;

    const dataUrl = canvas.toDataURL(mime, mime === 'image/jpeg' ? quality : undefined as any);
    images.push(dataUrl);

    // Cleanup
    canvas.width = 0;
    canvas.height = 0;
  }

  return images;
}

export default pdfFileToImageDataUrls;
