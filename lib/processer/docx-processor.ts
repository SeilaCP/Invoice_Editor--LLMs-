import PizZip from "pizzip";

// TODO(Phase 2): file-level TextDecoder fallback kept only for non-docx inputs
// that fail zip parsing (e.g. corrupted files) so callers still get *something*
// back instead of an exception.
export async function extractDocxText(
  input: File | Buffer | ArrayBuffer,
): Promise<string> {
  let buffer: Buffer;
  try {
    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (input instanceof ArrayBuffer) {
      buffer = Buffer.from(input);
    } else {
      buffer = Buffer.from(await (input as File).arrayBuffer());
    }
  } catch (error) {
    console.error("[v0] Error reading DOCX input buffer:", error);
    return "";
  }

  try {
    return extractTextFromDocxBuffer(buffer);
  } catch (error) {
    console.error(
      "[v0] Error parsing DOCX as a zip archive, falling back to raw decode:",
      error,
    );
    try {
      return new TextDecoder().decode(buffer);
    } catch (fallbackError) {
      console.error("[v0] Fallback DOCX decode also failed:", fallbackError);
      return "";
    }
  }
}

function readWordXmlFiles(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const xmlFiles = zip.file(
    /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/,
  );
  return xmlFiles.map((file) => file.asText());
}

function extractTextFromDocxBuffer(buffer: Buffer): string {
  const xmlContents = readWordXmlFiles(buffer);
  if (!xmlContents.length) {
    throw new Error("No readable XML files found in DOCX archive");
  }

  let result = "";
  for (const xml of xmlContents) {
    const tokenPattern =
      /<w:t[^>]*>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<\/w:p>|<w:br\s*\/>/g;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(xml)) !== null) {
      const [fullMatch, textContent] = match;
      if (textContent !== undefined) {
        result += decodeXmlEntities(textContent);
      } else if (fullMatch.startsWith("<w:tab")) {
        result += "\t";
      } else {
        result += "\n";
      }
    }
    result += "\n";
  }

  return result;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const MAX_BRACKET_PLACEHOLDER_LENGTH = 60;
const MAX_BRACKET_PLACEHOLDER_WORDS = 6;

function normalizePlaceholderCandidate(value: string): string | null {
  const cleaned = value
    .trim()
    .replace(/^[:\-–\s]+|[:\-–\s]+$/g, "")
    .replace(/\s+/g, " ");

  if (!cleaned) return null;
  if (cleaned.length > MAX_BRACKET_PLACEHOLDER_LENGTH) return null;

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length > MAX_BRACKET_PLACEHOLDER_WORDS) return null;

  if (/[<>]/.test(cleaned)) return null;
  if (/[.!?,;:]/.test(cleaned)) return null;

  // Avoid capturing regular prose from [ ... ] while keeping typical
  // placeholder names such as [Client Name], [invoice_no], [due-date].
  if (!/[a-zA-Z0-9]/.test(cleaned)) return null;

  return cleaned;
}

export async function extractPlaceholders(text: string): Promise<string[]> {
  // Find placeholders in format {{placeholder}}, ${placeholder}, or
  // [placeholder]. Content inside the delimiters may include spaces and
  // punctuation (e.g. {{client name}}, [Client Name], ${due date}).
  const patterns: RegExp[] = [
    /\{\{\s*([^{}\n]+?)\s*\}\}/g,
    /\$\{\s*([^{}\n]+?)\s*\}/g,
    /\[\s*([^\[\]\n]+?)\s*\]/g,
  ];

  const placeholders = new Set<string>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = normalizePlaceholderCandidate(match[1]);
      // Guard the permissive [ ] pattern against matching unrelated bracketed
      // prose (footnotes, citations, etc.) by requiring a plausible
      // placeholder-like length.
      if (candidate) {
        placeholders.add(candidate);
      }
    }
  }

  return Array.from(placeholders);
}

export async function extractDocxPlaceholders(
  input: File | Buffer | ArrayBuffer,
): Promise<string[]> {
  let buffer: Buffer;
  try {
    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (input instanceof ArrayBuffer) {
      buffer = Buffer.from(input);
    } else {
      buffer = Buffer.from(await (input as File).arrayBuffer());
    }
  } catch (error) {
    console.error("[v0] Error reading DOCX input for placeholders:", error);
    return [];
  }

  try {
    const xmlContents = readWordXmlFiles(buffer);
    if (!xmlContents.length) return [];

    const raw = decodeXmlEntities(xmlContents.join("\n"));
    return extractPlaceholders(raw);
  } catch (error) {
    console.error("[v0] Error extracting placeholders from DOCX XML:", error);
    return [];
  }
}
