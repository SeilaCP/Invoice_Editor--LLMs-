import { PDFParse } from "pdf-parse";

export async function extractPdfText(file: File): Promise<string> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result.text?.trim();
      return text && text.length > 0 ? text : file.name.toLowerCase();
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    console.error("[v0] Error processing PDF:", error);
    // Fall back to filename so the document remains at least minimally searchable.
    return file.name.toLowerCase();
  }
}

export function searchPdfText(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export function getExcerpts(
  text: string,
  query: string,
  contextLength: number = 100,
): string[] {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const excerpts: string[] = [];

  let startIdx = 0;
  while ((startIdx = lowerText.indexOf(lowerQuery, startIdx)) !== -1) {
    const start = Math.max(0, startIdx - contextLength);
    const end = Math.min(
      text.length,
      startIdx + lowerQuery.length + contextLength,
    );
    excerpts.push(text.substring(start, end).trim());
    startIdx += lowerQuery.length;

    if (excerpts.length >= 3) break;
  }

  return excerpts;
}
