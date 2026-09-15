import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Import the compiled worker module directly for fallback
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';
// Import bundled worker URL via Vite
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 1. Register worker on globalThis for robust fallback (no external requests)
if (typeof globalThis !== 'undefined') {
  try {
    (globalThis as any).pdfjsWorker = pdfjsWorker;
  } catch (e) {
    console.warn('Could not register global pdfjsWorker:', e);
  }
}

// 2. Point workerSrc to local bundled asset URL (same-origin, works on Firebase, GitHub, offline)
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (e) {
    console.warn('Could not set workerSrc:', e);
  }
}

export { pdfjsLib };
export default pdfjsLib;
