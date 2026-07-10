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

/**
 * A .docx file is a zip archive; the document body lives at
 * word/document.xml. Word frequently splits a single visible word (and even
 * a single placeholder like {{client name}}) across multiple <w:t> runs for
 * formatting reasons, so we reconstruct plain text by concatenating every
 * <w:t> run in document order, inserting a newline at each paragraph/break
 * boundary. This is not a full DOCX parser, but it is enough to recover
 * readable text and placeholder patterns for extraction/search purposes.
 */
function extractTextFromDocxBuffer(buffer: Buffer): string {
  const zip = new PizZip(buffer);
  const documentXmlFile = zip.file("word/document.xml");

  if (!documentXmlFile) {
    throw new Error("word/document.xml not found in DOCX archive");
  }

  const xml = documentXmlFile.asText();

  let result = "";
  // Walk the XML sequentially so ordering (and thus placeholder patterns
  // split across runs) is preserved.
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
      // paragraph end or explicit line break
      result += "\n";
    }
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
      const candidate = match[1].trim();
      // Guard the permissive [ ] pattern against matching unrelated bracketed
      // prose (footnotes, citations, etc.) by requiring a plausible
      // placeholder-like length.
      if (candidate && candidate.length <= MAX_BRACKET_PLACEHOLDER_LENGTH) {
        placeholders.add(candidate);
      }
    }
  }

  return Array.from(placeholders);
}
