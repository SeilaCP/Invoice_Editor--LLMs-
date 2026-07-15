import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

const MAX_PLACEHOLDER_LENGTH = 1000;

function isPlausiblePlaceholderCandidate(value: string): boolean {
  const cleaned = value.trim().replace(/\s+/g, " ");

  if (!cleaned) return false;
  if (cleaned.length > MAX_PLACEHOLDER_LENGTH) return false;

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length > 100) return false;

  return /[a-zA-Z0-9]/.test(cleaned);
}

function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mergeRunsInParagraph(paragraphXml: string): string {
  if (/<w:fldSimple\b|<w:hyperlink\b|<w:sdt\b/.test(paragraphXml)) {
    return paragraphXml;
  }

  const runRegex = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
  const runs: { rPr: string; text: string }[] = [];
  const runMatches: { index: number; length: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = runRegex.exec(paragraphXml)) !== null) {
    const runXml = m[0];
    const rPrMatch = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    const tMatch = runXml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/);
    runs.push({
      rPr: rPrMatch ? rPrMatch[0] : "",
      text: tMatch ? decodeXmlText(tMatch[1]) : "",
    });
    runMatches.push({ index: m.index, length: runXml.length });
  }

  if (runs.length < 2) return paragraphXml;

  const concatText = runs.map((r) => r.text).join("");
  if (!/[{[]/.test(concatText)) return paragraphXml;

  type Span = { start: number; end: number; raw: string };
  const spans: Span[] = [];
  for (const pattern of [/\{\{[\s\S]*?\}\}/g, /\[[\s\S]*?\]/g]) {
    let sm: RegExpExecArray | null;
    while ((sm = pattern.exec(concatText)) !== null) {
      spans.push({ start: sm.index, end: sm.index + sm[0].length, raw: sm[0] });
    }
  }
  if (spans.length === 0) return paragraphXml;
  const filteredSpans = spans.filter((s) => {
    const inner = s.raw.startsWith("{{")
      ? s.raw.slice(2, -2)
      : s.raw.slice(1, -1);
    return isPlausiblePlaceholderCandidate(inner);
  });
  if (filteredSpans.length === 0) return paragraphXml;
  filteredSpans.sort((a, b) => a.start - b.start);

  const runBounds: { start: number; end: number }[] = [];
  let pos = 0;
  for (const r of runs) {
    runBounds.push({ start: pos, end: pos + r.text.length });
    pos += r.text.length;
  }

  const runIndexForOffset = (offset: number): number => {
    for (let i = 0; i < runBounds.length; i++) {
      if (offset >= runBounds[i].start && offset < runBounds[i].end) return i;
    }
    return runBounds.length - 1;
  };

  const mergeRanges: { firstRun: number; lastRun: number }[] = [];
  for (const span of filteredSpans) {
    const startRun = runIndexForOffset(span.start);
    const endRun = runIndexForOffset(Math.max(span.start, span.end - 1));
    if (startRun === endRun) continue;
    const last = mergeRanges[mergeRanges.length - 1];
    if (last && startRun <= last.lastRun) {
      last.lastRun = Math.max(last.lastRun, endRun);
    } else {
      mergeRanges.push({ firstRun: startRun, lastRun: endRun });
    }
  }
  if (mergeRanges.length === 0) return paragraphXml;

  const rangeForRun = new Map<number, { firstRun: number; lastRun: number }>();
  for (const range of mergeRanges) rangeForRun.set(range.firstRun, range);

  const outputParts: string[] = [];
  let cursor = 0;
  let i = 0;
  while (i < runs.length) {
    const range = rangeForRun.get(i);
    if (range) {
      outputParts.push(paragraphXml.slice(cursor, runMatches[i].index));
      const mergedText = runs
        .slice(range.firstRun, range.lastRun + 1)
        .map((r) => r.text)
        .join("");
      const rPr = runs[range.firstRun].rPr;
      const encoded = encodeXmlText(mergedText);
      outputParts.push(
        `<w:r>${rPr}<w:t xml:space="preserve">${encoded}</w:t></w:r>`,
      );
      const lastRunMatch = runMatches[range.lastRun];
      cursor = lastRunMatch.index + lastRunMatch.length;
      i = range.lastRun + 1;
      continue;
    }
    i++;
  }
  outputParts.push(paragraphXml.slice(cursor));
  return outputParts.join("");
}

function mergeTextRuns(xml: string): string {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, mergeRunsInParagraph);
}

function normalizePlaceholderDelimiters(xml: string): string {
  xml = mergeTextRuns(xml);
  return xml
    .replace(/\{\{\s*([^{}\n]+?)\s*\}\}/g, (match, name) => {
      if (!isPlausiblePlaceholderCandidate(name)) {
        return match;
      }

      return `{{${normalizePlaceholderKey(name)}}}`;
    })
    .replace(/\[\s*([^\[\]\n]+?)\s*\]/g, (match, name) => {
      if (!isPlausiblePlaceholderCandidate(name)) {
        return match;
      }

      return `{{${normalizePlaceholderKey(name)}}}`;
    });
}

function normalizePlaceholderKey(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizePlaceholderTagNames(xml: string): string {
  return xml.replace(/\{\{\s*([^{}\n]+?)\s*\}\}/g, (match, name) => {
    if (!isPlausiblePlaceholderCandidate(name)) {
      return match;
    }

    return `{{${normalizePlaceholderKey(name)}}}`;
  });
}

function stripPlaceholderRunEmphasis(xml: string): string {
  return xml.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (runXml) => {
    if (!/\{\{[^{}\n]+\}\}/.test(runXml)) {
      return runXml;
    }

    return runXml
      .replace(/<w:b\b[^/]*\/>/g, "")
      .replace(/<w:bCs\b[^/]*\/>/g, "")
      .replace(/<w:i\b[^/]*\/>/g, "")
      .replace(/<w:iCs\b[^/]*\/>/g, "")
      .replace(/<w:rPr>\s*<\/w:rPr>/g, "");
  });
}

function normalizeRenderData(data: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    normalized[normalizePlaceholderKey(key)] = value;
  }
  return normalized;
}

export async function generateDocxFromTemplate(
  templateBase64: string,
  data: Record<string, any>,
): Promise<Buffer> {
  const templateBuffer = Buffer.from(templateBase64, "base64");
  const zip = new PizZip(templateBuffer);

  const wordXmlFiles = zip.file(/^word\/.*\.xml$/);
  for (const file of wordXmlFiles) {
    const xml = file.asText();
    const normalizedXml = stripPlaceholderRunEmphasis(
      normalizePlaceholderTagNames(normalizePlaceholderDelimiters(xml)),
    );
    zip.file(file.name, normalizedXml);
  }

  const normalizedData = normalizeRenderData(data);
  const allTagNames = new Set<string>();
  for (const file of wordXmlFiles) {
    const normalizedXml = zip.file(file.name)?.asText() || "";
    const tagPattern = /\{\{\s*([^{}\n]+?)\s*\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(normalizedXml)) !== null) {
      allTagNames.add(match[1].trim());
    }
  }

  const renderKeys = Object.keys(normalizedData);
  const matchedKeys = renderKeys.filter((key) => allTagNames.has(key));
  console.log("[docx] placeholder render stats:", {
    templateTagCount: allTagNames.size,
    renderKeyCount: renderKeys.length,
    matchedKeyCount: matchedKeys.length,
    sampleTemplateTags: Array.from(allTagNames).slice(0, 20),
    sampleRenderKeys: renderKeys.slice(0, 20),
    sampleMatchedKeys: matchedKeys.slice(0, 20),
  });

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: "{{",
      end: "}}",
    },
    nullGetter: () => "",
  });

  doc.render(normalizedData);
  return doc.getZip().generate({ type: "nodebuffer" });
}
