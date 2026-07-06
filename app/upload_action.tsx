"use server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import {
  extractDocxText,
  extractPlaceholders,
} from "@/lib/processer/docx-processor";
import { extractPdfText } from "@/lib/processer/pdf-processor";
import {
  convertDocToDocx,
  LibreOfficeUnavailableError,
} from "@/lib/processer/doc-converter";
import {
  connectDB,
  PdfDocument,
  IPdfDocument,
  TemplateType,
  DocxTemplate,
} from "@/lib/mongodb";
import { buildEmbedding, dbHelpers } from "@/lib/db/mock-db";
import { MAX_UPLOAD_SIZE_BYTES, formatBytes } from "@/lib/upload/constraints";
import { generateDocxFromTemplate } from "@/lib/documents/docx-generator";
import { extractPlaceholderValues } from "@/lib/ai";

type LLMProvider = "gemini" | "openai" | "claude" | "qwen";

function getModel(provider: LLMProvider) {
  return google("gemini-2.5-flash-lite");
}
export async function analyzeTemplateWithGemini(
  text: string,
  placeholders: string[],
): Promise<{
  summary: string;
  complexity: "simple" | "medium" | "complex";
  suggestions: string[];
}> {
  const hasApiKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY,
  );

  if (!hasApiKey) {
    return {
      summary: "Template analysis unavailable - API key not configured",
      complexity: "simple",
      suggestions: [],
    };
  }

  try {
    const prompt = `Analyze this document template and provide insights:

Template text: ${text.substring(0, 2000)}


Format your response as JSON with keys: summary, complexity, suggestions (array).
Hard limits (do not exceed): "summary" must be a single sentence under 200 characters. "suggestions" must have at most 2 items, each under 80 characters. Do not include any text beyond these limits.`;

    const result = await generateObject({
      model: getModel("gemini"),
      prompt,
      // Cap output so a model repetition loop fails fast (in seconds, not
      // minutes) instead of generating tens of thousands of tokens before
      // hitting NoObjectGeneratedError. We only need a couple sentences here.
      maxOutputTokens: 500,
      // Also guard against the model hanging/being slow under load so an
      // upload never blocks indefinitely on this best-effort analysis step.
      abortSignal: AbortSignal.timeout(45_000),
      schema: z.object({
        summary: z.string().default("Template loaded successfully"),
        complexity: z.enum(["simple", "medium", "complex"]).default("simple"),
        suggestions: z.array(z.string()).default([]),
      }),
    });

    return {
      summary: result.object.summary,
      complexity: result.object.complexity,
      suggestions: result.object.suggestions,
    };
  } catch (error) {
    console.error("[v0] Gemini analysis error:", error);
    return {
      summary: "Template loaded successfully",
      complexity:
        placeholders.length > 10
          ? "complex"
          : placeholders.length > 5
            ? "medium"
            : "simple",
      suggestions: [],
    };
  }
}

export async function uploadDocxTemplate(formData: FormData): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    await connectDB();

    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const lowerName = file.name.toLowerCase();
    const isDocx = lowerName.endsWith(".docx");
    const isDoc = lowerName.endsWith(".doc") && !isDocx;

    if (!isDocx && !isDoc) {
      return {
        success: false,
        error: "Only .doc and .docx files are supported for templates",
      };
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return {
        success: false,
        error: `File is too large (${formatBytes(file.size)}). Maximum allowed size is ${formatBytes(MAX_UPLOAD_SIZE_BYTES)}.`,
      };
    }

    // Convert file to a working Buffer, converting legacy .doc -> .docx first if needed
    const arrayBuffer = await file.arrayBuffer();
    let docxBuffer: Buffer = Buffer.from(arrayBuffer);

    if (isDoc) {
      try {
        docxBuffer = await convertDocToDocx(docxBuffer);
      } catch (error) {
        if (error instanceof LibreOfficeUnavailableError) {
          return { success: false, error: error.message };
        }
        throw error;
      }
    }

    const base64Content = docxBuffer.toString("base64");

    // Extract text and placeholders
    const text = await extractDocxText(docxBuffer);
    const placeholders = await extractPlaceholders(text);

    // Analyze with Gemini
    const analysis = await analyzeTemplateWithGemini(text, placeholders);

    // Order matters: buildEmbedding truncates the combined string to 8000
    // chars. Put the filename and full placeholder list first so they are
    // never truncated away, then a bounded excerpt of the raw text, then the
    // analysis summary/suggestions.
    const rawTextExcerpt = text.trim().slice(0, 500);
    const embeddingText = [
      file.name,
      placeholders.length ? `Placeholders: ${placeholders.join(" | ")}` : "",
      analysis.summary,
      analysis.suggestions.join(" | "),
      rawTextExcerpt,
    ]
      .filter(Boolean)
      .join("\n");

    const embedding = await buildEmbedding(embeddingText);

    // Save to MongoDB
    const template = await dbHelpers.saveTemplate({
      filename: file.name,
      fileContent: base64Content,
      templateType: file.name.toLowerCase().includes("proposal")
        ? "proposal"
        : file.name.toLowerCase().includes("quotation") ||
            file.name.toLowerCase().includes("quote")
          ? "quotation"
          : file.name.toLowerCase().includes("invoice")
            ? "invoice"
            : "generic",
      extractedText: text,
      placeholders,
      placeholderSchema: placeholders.map((name) => ({ name, required: true })),
      analysis: analysis?.summary || "Analysis completed",
      embeddingText,
      embedding,
      status: embedding.length > 0 ? "ready" : "failed",
      source: "upload",
    });

    return { success: true, data: template };
  } catch (error) {
    console.error("[v0] Upload DOCX error:", error);
    return { success: false, error: String(error) };
  }
}

export async function uploadPdf(formData: FormData): Promise<{
  success: boolean;
  data?: IPdfDocument;
  error?: string;
}> {
  try {
    await connectDB();

    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    if (!file.name.endsWith(".pdf")) {
      return { success: false, error: "Only .pdf files are supported" };
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return {
        success: false,
        error: `File is too large (${formatBytes(file.size)}). Maximum allowed size is ${formatBytes(MAX_UPLOAD_SIZE_BYTES)}.`,
      };
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString("base64");

    // Extract text from PDF
    const extractedText = await extractPdfText(file);

    // Save to MongoDB
    const document = await PdfDocument.create({
      filename: file.name,
      fileContent: base64Content,
      extractedText: extractedText || file.name,
      searchText: `${file.name} ${extractedText || ""}`.toLowerCase(),
    });

    const plainDocument = JSON.parse(JSON.stringify(document.toObject()));

    return {
      success: true,
      data: {
        ...plainDocument,
        _id: plainDocument._id?.toString?.() ?? plainDocument._id,
      },
    };
  } catch (error) {
    console.error("[v0] Upload PDF error:", error);
    return { success: false, error: String(error) };
  }
}

export async function searchDocuments(query: string): Promise<{
  templates: Array<any>;
  pdfs: Array<any>;
}> {
  try {
    await connectDB();

    const templates = await dbHelpers.findTemplatesByText(query);

    const pdfs = await PdfDocument.find({
      searchText: { $regex: query, $options: "i" },
    }).lean();

    return { templates, pdfs };
  } catch (error) {
    console.error("[v0] Search error:", error);
    return { templates: [], pdfs: [] };
  }
}

export async function getStoredDocuments(): Promise<{
  templates: Array<any>;
  pdfs: IPdfDocument[];
}> {
  try {
    await connectDB();

    const templates = await dbHelpers.getStoredTemplates();
    const pdfs = await PdfDocument.find({}).sort({ createdAt: -1 }).lean();

    return {
      templates: templates as Array<any>,
      pdfs: pdfs as IPdfDocument[],
    };
  } catch (error) {
    console.error("[v0] Get documents error:", error);
    return { templates: [], pdfs: [] };
  }
}

// ─── Natural-language Template Retrieval (Phase 4) ─────────────────────────────
export interface TemplateMatch {
  templateId: string;
  filename: string;
  templateType: string;
  placeholders: string[];
  score: number;
}

export async function findMatchingTemplates(
  query: string,
  options?: { templateType?: TemplateType; limit?: number },
): Promise<{
  success: boolean;
  data?: TemplateMatch[];
  error?: string;
}> {
  try {
    const trimmedQuery = typeof query === "string" ? query.trim() : "";
    if (!trimmedQuery) {
      return { success: false, error: "Query text is required" };
    }
    if (trimmedQuery.length > 2000) {
      return {
        success: false,
        error: "Query text is too long (max 2000 characters)",
      };
    }

    const limit = options?.limit;
    if (
      limit !== undefined &&
      (!Number.isInteger(limit) || limit < 1 || limit > 20)
    ) {
      return {
        success: false,
        error: "limit must be an integer between 1 and 20",
      };
    }

    await connectDB();

    const matches = await dbHelpers.findTopTemplates(trimmedQuery, {
      templateType: options?.templateType,
      limit,
    });

    if (!matches.length) {
      return { success: true, data: [] };
    }

    const data: TemplateMatch[] = matches.map(({ template, score }) => ({
      templateId: String(template._id),
      filename: template.filename,
      templateType: template.templateType,
      placeholders: template.placeholders,
      score,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("[v0] findMatchingTemplates error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─── Fill Template From Free Text (Phase 5) ────────────────────────────────────
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export interface FillTemplateResult {
  fileName: string;
  fileBase64: string;
  fields: Record<string, string | null>;
  unfilledPlaceholders: string[];
}

export async function fillTemplateFromText(
  templateId: string,
  userInput: string,
  provider?: "gemini" | "openai" | "claude" | "qwen",
): Promise<{
  success: boolean;
  data?: FillTemplateResult;
  error?: string;
}> {
  try {
    if (typeof templateId !== "string" || !OBJECT_ID_PATTERN.test(templateId)) {
      return { success: false, error: "A valid templateId is required" };
    }

    const trimmedInput = typeof userInput === "string" ? userInput.trim() : "";
    if (!trimmedInput) {
      return { success: false, error: "userInput text is required" };
    }
    if (trimmedInput.length > 5000) {
      return {
        success: false,
        error: "userInput is too long (max 5000 characters)",
      };
    }

    await connectDB();

    const template = await DocxTemplate.findById(templateId).lean();
    if (!template) {
      return { success: false, error: "Template not found" };
    }
    if (template.status !== "ready" || !template.fileContent) {
      return {
        success: false,
        error:
          "Template is not ready to be filled (missing content or embedding)",
      };
    }
    if (!template.placeholders?.length) {
      return {
        success: false,
        error: "This template has no detected placeholders to fill",
      };
    }

    // LLM maps free text -> field values, validated against the template's
    // actual placeholder list (schema-enforced in extractPlaceholderValues,
    // so we never trust arbitrary keys the model might otherwise invent).
    const fields = await extractPlaceholderValues(
      template.placeholders,
      trimmedInput,
      provider,
    );

    const unfilledPlaceholders = template.placeholders.filter(
      (placeholder: string) => fields[placeholder] === null,
    );

    // docxtemplater's nullGetter renders missing tags as "", but we pass
    // explicit empty strings here too so the field map returned to the
    // caller and the actual rendered document stay in sync.
    const renderData: Record<string, string> = {};
    for (const placeholder of template.placeholders) {
      renderData[placeholder] = fields[placeholder] ?? "";
    }

    const filledBuffer = await generateDocxFromTemplate(
      template.fileContent,
      renderData,
    );

    const baseName = template.filename.replace(/\.(docx?|DOCX?)$/, "");
    const fileName = `${baseName}-filled-${Date.now()}.docx`;

    return {
      success: true,
      data: {
        fileName,
        fileBase64: filledBuffer.toString("base64"),
        fields,
        unfilledPlaceholders,
      },
    };
  } catch (error) {
    console.error("[v0] fillTemplateFromText error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
