import { generateDocxFromTemplate } from "@/lib/documents/docx-generator";
import { DocxTemplate, DocxTemplateMemory, connectDB } from "@/lib/mongodb";
import { extractPlaceholderValues } from "@/lib/ai";
import type { FillTemplateResult, LLMProvider } from "@/lib/types/template";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export async function fillTemplateFromTextService(
  templateId: string,
  userInput: string,
  provider?: LLMProvider,
  continuation: boolean = false,
): Promise<{
  success: boolean;
  data?: FillTemplateResult;
  error?: string;
}> {
  try {
    await connectDB();

    if (typeof templateId !== "string" || !OBJECT_ID_PATTERN.test(templateId)) {
      return {
        success: false,
        error: continuation
          ? "A valid fillSessionId is required"
          : "A valid templateId is required",
      };
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

    let memory;
    let placeholders: string[];
    let previousFields: Record<string, string | null>;

    if (continuation) {
      memory = await DocxTemplateMemory.findById(templateId);
      if (!memory) {
        return {
          success: false,
          error:
            "Continuation requested but no previous fill session was found for this id",
        };
      }
      placeholders = memory.placeholders;
      previousFields = (memory.fields as Record<string, string | null>) ?? {};
    } else {
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

      placeholders = template.placeholders;
      previousFields = {};
      memory = await DocxTemplateMemory.create({
        sourceTemplateId: templateId,
        filename: template.filename,
        fileContent: template.fileContent,
        templateType: template.templateType,
        placeholders,
        fields: {},
        unfilledPlaceholders: placeholders,
        status: "in_progress",
      });
    }

    const extracted = await extractPlaceholderValues(
      placeholders,
      trimmedInput,
      memory.templateType === "generic" ? undefined : memory.templateType,
      provider,
    );

    const mergedFields: Record<string, string | null> = {};
    for (const placeholder of placeholders) {
      const newValue = extracted[placeholder];
      mergedFields[placeholder] =
        newValue !== null && newValue !== undefined
          ? newValue
          : (previousFields[placeholder] ?? null);
    }

    const unfilledPlaceholders = placeholders.filter(
      (placeholder) => mergedFields[placeholder] === null,
    );
    const isComplete = unfilledPlaceholders.length === 0;

    memory.fields = mergedFields;
    memory.unfilledPlaceholders = unfilledPlaceholders;
    memory.status = isComplete ? "completed" : "in_progress";
    await memory.save();

    const renderData: Record<string, string> = {};
    for (const placeholder of placeholders) {
      renderData[placeholder] = mergedFields[placeholder] ?? "";
    }

    const filledBuffer = await generateDocxFromTemplate(
      memory.fileContent,
      renderData,
    );

    const baseName = memory.filename.replace(/\.(docx?|DOCX?)$/, "");
    const fileName = `${baseName}-filled-${Date.now()}.docx`;

    return {
      success: true,
      data: {
        fileName,
        fileBase64: filledBuffer.toString("base64"),
        fields: mergedFields,
        unfilledPlaceholders,
        fillSessionId: String(memory._id),
        isComplete,
      },
    };
  } catch (error) {
    console.error("[fill] fillTemplateFromText error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
