import { connectDB, TemplateType } from "@/lib/mongodb";
import { dbHelpers } from "@/lib/db/mock-db";
import type { TemplateMatch } from "@/lib/types/template";

export async function findMatchingTemplatesService(
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

    const data: TemplateMatch[] = matches.map(
      ({ template, score, matchedChunkText }) => ({
        fileBase64: template.fileContent,
        templateId: String(template._id),
        filename: template.filename,
        templateType: template.templateType,
        placeholders: template.placeholders,
        score,
        matchedChunkText,
      }),
    );

    return { success: true, data };
  } catch (error) {
    console.error("[retrieval] findMatchingTemplates error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
