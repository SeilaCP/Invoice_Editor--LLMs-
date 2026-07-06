/**
 * Utility functions for downloading files in the browser
 */

export function downloadFile(
  content: string,
  filename: string,
  type: "text/html" | "application/json",
) {
  if (typeof window === "undefined") {
    console.error("[v0] Download is not available in server environment");
    return;
  }

  try {
    const element = globalThis.document.createElement("a");
    element.setAttribute(
      "href",
      `data:${type};charset=utf-8,${encodeURIComponent(content)}`,
    );
    element.setAttribute("download", filename);
    element.style.display = "none";
    globalThis.document.body.appendChild(element);
    element.click();
    globalThis.document.body.removeChild(element);
  } catch (error) {
    console.error("[v0] Error downloading file:", error);
  }
}

export function downloadHTML(html: string, filename: string) {
  downloadFile(html, filename, "text/html");
}

export function downloadJSON(data: Record<string, any>, filename: string) {
  downloadFile(JSON.stringify(data, null, 2), filename, "application/json");
}

/**
 * Downloads a base64-encoded binary payload (e.g. a generated .docx) as a
 * file. Uses a Blob + object URL rather than a data: URI since base64 docx
 * files can be large and data: URIs have practical length limits in some
 * browsers.
 */
export function downloadBase64File(
  base64: string,
  filename: string,
  mimeType: string = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
) {
  if (typeof window === "undefined") {
    console.error("[v0] Download is not available in server environment");
    return;
  }

  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const element = globalThis.document.createElement("a");
    element.href = url;
    element.download = filename;
    element.style.display = "none";
    globalThis.document.body.appendChild(element);
    element.click();
    globalThis.document.body.removeChild(element);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("[v0] Error downloading base64 file:", error);
  }
}
