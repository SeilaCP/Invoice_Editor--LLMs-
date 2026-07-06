/**
 * Shared upload constraints for template/document uploads.
 */
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ACCEPTED_TEMPLATE_EXTENSIONS = [".doc", ".docx"] as const;
export const ACCEPTED_PDF_EXTENSIONS = [".pdf"] as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
