import * as pdfjsLib from 'pdfjs-dist';
// Import bundled worker URL via Vite as a static asset URL
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Safely configure GlobalWorkerOptions without polluting window/global scope
if (typeof window !== 'undefined') {
  try {
    // Prefer Vite-bundled worker URL
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (e) {
    console.warn('Could not set workerSrc to local workerUrl:', e);
    // Reliable CDN fallback
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '5.7.284'}/build/pdf.worker.min.mjs`;
  }
}

export { pdfjsLib, workerUrl };
export default pdfjsLib;

