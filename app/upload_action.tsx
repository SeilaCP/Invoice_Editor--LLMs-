"use server";
import { dbHelpers } from "@/lib/db/mock-db";
import {
  connectDB,
  DocxTemplateChunk,
  DocxTemplate,
  IPdfDocument,
  PdfDocument,
  TemplateType,
} from "@/lib/mongodb";
import { fillTemplateFromTextService } from "@/lib/services/template-fill.service";
import {
  uploadDocxTemplateService,
  uploadPdfDocumentService,
} from "@/lib/services/template-ingest.service";
import { findMatchingTemplatesService } from "@/lib/services/template-retrieval.service";
import type {
  FillTemplateResult,
  LLMProvider,
  TemplateMatch,
} from "@/lib/types/template";

let initialized = false;
export async function ensureDatabaseInitialized() {
  if (!initialized) {
    try {
      initialized = true;
      return { success: true };
    } catch (error) {
      console.error("Failed to initialize database:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
  return { success: true };
}

export async function uploadDocxTemplate(formData: FormData): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  return uploadDocxTemplateService(formData);
}

export async function uploadPdf(formData: FormData): Promise<{
  success: boolean;
  data?: IPdfDocument;
  error?: string;
}> {
  return uploadPdfDocumentService(formData);
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

export async function findMatchingTemplates(
  query: string,
  options?: { templateType?: TemplateType; limit?: number },
): Promise<{
  success: boolean;
  data?: TemplateMatch[];
  error?: string;
}> {
  return findMatchingTemplatesService(query, options);
}

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export async function showallTemplatesAction(): Promise<{
  success: boolean;
  data?: Array<any>;
  error?: string;
}> {
  try {
    await connectDB();
    const templates = await DocxTemplate.find().lean();
    const safeTemplates = JSON.parse(JSON.stringify(templates));
    return { success: true, data: safeTemplates };
  } catch (error) {
    console.error("[v0] showallTemplatesAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deleteTemplateAction(templateId: string) {
  if (typeof templateId !== "string" || !OBJECT_ID_PATTERN.test(templateId)) {
    throw new Error("A valid templateId is required");
  }
  try {
    await connectDB();
    await DocxTemplate.deleteOne({ _id: templateId });
    await DocxTemplateChunk.deleteMany({ templateId });
  } catch (error) {
    console.error("[v0] deleteTemplateAction error:", error);
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
}

export async function reindexTemplateSearchAction(): Promise<{
  success: boolean;
  data?: { templateCount: number; chunkCount: number };
  error?: string;
}> {
  try {
    const result = await dbHelpers.reindexTemplateSearchData();
    return { success: true, data: result };
  } catch (error) {
    console.error("[v0] reindexTemplateSearchAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function fillTemplateFromText(
  templateId: string,
  userInput: string,
  provider?: "gemini" | "openai" | "claude" | "qwen",
  continuation: boolean = false,
): Promise<{
  success: boolean;
  data?: FillTemplateResult;
  error?: string;
}> {
  return fillTemplateFromTextService(
    templateId,
    userInput,
    provider,
    continuation,
  );
}
