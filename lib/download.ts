/**
 * Utility functions for downloading files in the browser
 */

export function downloadFile(content: string, filename: string, type: 'text/html' | 'application/json') {
  if (typeof window === 'undefined') {
    console.error('[v0] Download is not available in server environment');
    return;
  }

  try {
    const element = globalThis.document.createElement('a');
    element.setAttribute('href', `data:${type};charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    globalThis.document.body.appendChild(element);
    element.click();
    globalThis.document.body.removeChild(element);
  } catch (error) {
    console.error('[v0] Error downloading file:', error);
  }
}

export function downloadHTML(html: string, filename: string) {
  downloadFile(html, filename, 'text/html');
}

export function downloadJSON(data: Record<string, any>, filename: string) {
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}
