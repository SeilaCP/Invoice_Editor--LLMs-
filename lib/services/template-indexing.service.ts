import { TemplateType } from "@/lib/mongodb";
import type { TemplateChunkInput } from "@/lib/types/template";

const MAX_TEMPLATE_CHUNKS = 8;
const MAX_CHUNK_LENGTH = 700;

export function inferTemplateTypeFromFilename(filename: string): TemplateType {
  const lowerName = filename.toLowerCase();

  if (lowerName.includes("proposal")) return "proposal";
  if (lowerName.includes("quotation") || lowerName.includes("quote")) {
    return "quotation";
  }
  if (lowerName.includes("invoice")) return "invoice";
  return "generic";
}

export function buildTemplateSearchText(input: {
  filename: string;
  templateType: TemplateType;
  placeholders: string[];
  analysisSummary?: string;
  extractedText?: string;
}): string {
  return [
    input.filename,
    input.templateType,
    input.placeholders.join(" "),
    input.analysisSummary || "",
    (input.extractedText || "").slice(0, 4000),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function buildChunkSearchText(input: {
  filename: string;
  templateType: TemplateType;
  placeholders: string[];
  content: string;
}): string {
  return [
    input.filename,
    input.templateType,
    input.placeholders.join(" "),
    input.content,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function splitIntoChunks(text: string): string[] {
  const normalized = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!normalized.length) return [];

  const chunks: string[] = [];
  let current = "";

  for (const line of normalized) {
    const nextValue = current ? `${current}\n${line}` : line;
    if (nextValue.length > MAX_CHUNK_LENGTH && current) {
      chunks.push(current);
      current = line;
    } else {
      current = nextValue;
    }

    if (chunks.length >= MAX_TEMPLATE_CHUNKS) break;
  }

  if (current && chunks.length < MAX_TEMPLATE_CHUNKS) {
    chunks.push(current);
  }

  return chunks;
}

export function buildTemplateChunks(input: {
  filename: string;
  templateType: TemplateType;
  extractedText: string;
  placeholders: string[];
  analysisSummary: string;
}): TemplateChunkInput[] {
  const rawChunks = splitIntoChunks(input.extractedText);
  const chunks = rawChunks.length
    ? rawChunks
    : [
        [
          input.analysisSummary,
          input.placeholders.length
            ? `Placeholders: ${input.placeholders.join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ];

  return chunks.slice(0, MAX_TEMPLATE_CHUNKS).map((content, chunkIndex) => ({
    chunkIndex,
    content,
    placeholders: input.placeholders,
    embeddingText: [
      input.filename,
      `Template type: ${input.templateType}`,
      input.placeholders.length
        ? `Placeholders: ${input.placeholders.join(" | ")}`
        : "",
      input.analysisSummary,
      content,
    ]
      .filter(Boolean)
      .join("\n"),
  }));
}
