import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import {
  extractDocxPlaceholders,
  extractDocxText,
  extractPlaceholders,
} from "@/lib/processer/docx-processor";
import { extractPdfText } from "@/lib/processer/pdf-processor";
import {
  convertDocToDocx,
  LibreOfficeUnavailableError,
} from "@/lib/processer/doc-converter";
import { connectDB, IPdfDocument, PdfDocument } from "@/lib/mongodb";
import { buildEmbedding, dbHelpers } from "@/lib/db/mock-db";
import { MAX_UPLOAD_SIZE_BYTES, formatBytes } from "@/lib/upload/constraints";
import {
  buildTemplateChunks,
  buildTemplateSearchText,
  inferTemplateTypeFromFilename,
} from "@/lib/services/template-indexing.service";

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
      model: google("gemini-2.5-flash-lite"),
      prompt,
      maxOutputTokens: 500,
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
    console.error("[ingest] Gemini analysis error:", error);
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

export async function uploadDocxTemplateService(formData: FormData): Promise<{
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
    const text = await extractDocxText(docxBuffer);
    const xmlPlaceholders = await extractDocxPlaceholders(docxBuffer);
    const textPlaceholders = await extractPlaceholders(text);
    const placeholders = Array.from(
      new Set([...xmlPlaceholders, ...textPlaceholders]),
    );

    const analysis = await analyzeTemplateWithGemini(text, placeholders);
    const templateType = inferTemplateTypeFromFilename(file.name);
    const rawTextExcerpt = text.trim().slice(0, 500);
    const embeddingText = [
      file.name,
      `Template type: ${templateType}`,
      placeholders.length ? `Placeholders: ${placeholders.join(" | ")}` : "",
      analysis.summary,
      analysis.suggestions.join(" | "),
      rawTextExcerpt,
    ]
      .filter(Boolean)
      .join("\n");

    const embedding = await buildEmbedding(embeddingText);

    const template = await dbHelpers.saveTemplate({
      filename: file.name,
      fileContent: base64Content,
      templateType,
      extractedText: text,
      placeholders,
      placeholderSchema: placeholders.map((name) => ({ name, required: true })),
      analysis: analysis.summary || "Analysis completed",
      embeddingText,
      searchText: buildTemplateSearchText({
        filename: file.name,
        templateType,
        placeholders,
        analysisSummary: analysis.summary || "Analysis completed",
        extractedText: text,
      }),
      embedding,
      status: embedding.length > 0 ? "ready" : "failed",
      source: "upload",
    });

    const templateId = String(template._id);
    const chunks = buildTemplateChunks({
      filename: file.name,
      templateType,
      extractedText: text,
      placeholders,
      analysisSummary: analysis.summary || "Template loaded successfully",
    });

    if (chunks.length > 0) {
      await dbHelpers.replaceTemplateChunks(
        templateId,
        templateType,
        file.name,
        chunks,
      );
    }

    return { success: true, data: template };
  } catch (error) {
    console.error("[ingest] Upload DOCX error:", error);
    return { success: false, error: String(error) };
  }
}

export async function uploadPdfDocumentService(formData: FormData): Promise<{
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString("base64");
    const extractedText = await extractPdfText(file);

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
    console.error("[ingest] Upload PDF error:", error);
    return { success: false, error: String(error) };
  }
}
