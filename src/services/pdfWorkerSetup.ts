// Polyfills for browser compatibility (especially Safari, iOS, and older WebKit engines)
// Fixes "TypeError: undefined is not a function (near '...i of r...')" caused by
// pdfjs-dist's internal `for await (const chunk of streamTextContent())`
if (typeof Promise !== 'undefined' && typeof (Promise as any).withResolvers === 'undefined') {
  (Promise as any).withResolvers = function <T = any>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof Symbol !== 'undefined' && typeof Symbol.asyncIterator === 'undefined') {
  (Symbol as any).asyncIterator = Symbol.for('Symbol.asyncIterator');
}

if (typeof ReadableStream !== 'undefined' && !(ReadableStream.prototype as any)[Symbol.asyncIterator]) {
  (ReadableStream.prototype as any)[Symbol.asyncIterator] = async function* () {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (_) {}
    }
  };
}

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

/**
 * Safely extracts text content from a PDFPageProxy.
 * Bypasses pdfjs-dist's internal `for await (const t of streamTextContent())`
 * by consuming the stream directly with getReader(), completely avoiding the
 * Safari / WebKit error: "undefined is not a function (near '...i of r...')"
 */
export async function safeGetPageTextContent(page: any): Promise<{ items: any[]; styles: Record<string, any>; lang?: string | null }> {
  if (!page) {
    return { items: [], styles: {} };
  }

  // Method 1: Direct stream reader consumption
  if (typeof page.streamTextContent === 'function') {
    try {
      const stream = page.streamTextContent();
      if (stream && typeof stream.getReader === 'function') {
        const reader = stream.getReader();
        const items: any[] = [];
        const styles: Record<string, any> = Object.create(null);
        let lang: string | null = null;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              if (value.lang && !lang) lang = value.lang;
              if (value.styles) Object.assign(styles, value.styles);
              if (Array.isArray(value.items)) items.push(...value.items);
            }
          }
          return { items, styles, lang };
        } finally {
          try {
            reader.releaseLock();
          } catch (_) {}
        }
      }
    } catch (streamErr) {
      console.warn('streamTextContent direct reader failed, falling back to page.getTextContent():', streamErr);
    }
  }

  // Method 2: Standard page.getTextContent() (protected by ReadableStream asyncIterator polyfill)
  try {
    const content = await page.getTextContent();
    return {
      items: Array.isArray(content?.items) ? content.items : [],
      styles: content?.styles || {},
      lang: content?.lang || null,
    };
  } catch (err) {
    console.error('safeGetPageTextContent error:', err);
    throw err;
  }
}

export { pdfjsLib, workerUrl };
export default pdfjsLib;

