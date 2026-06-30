"use server";

import { generateDocument, generatePDF } from "@/lib/documents/generator";
import { dbHelpers } from "@/lib/db/mock-db";
import {
  getProvidersConfig,
  setActiveProvider,
  detectTemplateType,
  detectIntent,
  generateChatResponse,
} from "@/lib/ai";

// ─── Init ──────────────────────────────────────────────────────────────────────
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

// ─── Document Generation ───────────────────────────────────────────────────────
export async function generateDocumentAction(input: {
  templateType: "invoice" | "quotation" | "proposal";
  userInput: string;
  llmProvider?: "gemini" | "openai" | "claude";
}) {
  try {
    const result = await generateDocument({
      templateType: input.templateType,
      userInput: input.userInput,
      llmProvider: input.llmProvider,
    });
    return result;
  } catch (error) {
    console.error("Error in generateDocumentAction:", error);
    return {
      success: false,
      html: "",
      json: {},
      fileName: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─── Chat + Document Router ────────────────────────────────────────────────────
export async function handleUserMessage(
  userMessage: string,
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [],
  llmProvider?: "gemini" | "openai" | "claude",
) {
  try {
    const trimmed = userMessage.trim();
    const lowerTrimmed = trimmed.toLowerCase();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

    // 1. Upgraded robust regex patterns
    // Catches prefix ($100) and suffix (100$) styles across multiple currency types
    const hasAmount =
      /[\$\u20AC\u00A3]\s?\d+|\d+\s*([\$\u20AC\u00A3]|usd|dollars?|euro|pounds?|qty|pcs|items?)/i.test(
        lowerTrimmed,
      );

    const hasDocumentKeyword =
      /\b(invoice|quotation|quote|proposal|bill)\b/i.test(lowerTrimmed);

    // Explicit indicators that the user is attempting to modify/update an item list
    const isModifyingExistingDoc =
      /\b(add|change|update|remove|delete|insert|instead of|put|with)\b/i.test(
        lowerTrimmed,
      ) &&
      /\b(product|item|ram|gpu|model|each|x\s?\d+|\d+\s*x)\b/i.test(
        lowerTrimmed,
      );

    // 2. Sophisticated Hard Guard Bypass
    // A message is ONLY obviously a casual chat if it completely lacks numeric data, context clues, and document markers.
    const isObviouslyChat =
      wordCount <= 3 || // Exceptionally short text
      (!hasAmount && !hasDocumentKeyword && !isModifyingExistingDoc);

    if (isObviouslyChat) {
      const reply = await generateChatResponse(
        trimmed,
        conversationHistory,
        llmProvider,
      );
      return { success: true, type: "chat" as const, message: reply };
    }

    // ── Intent detection (runs safely for context/data-rich requests) ──
    const { intent, templateType, confidence } = await detectIntent(
      trimmed,
      llmProvider,
    );

    // If intent analyzer is highly confident it's chat, follow its routing
    if (intent === "chat" && confidence > 0.85) {
      const reply = await generateChatResponse(
        trimmed,
        conversationHistory,
        llmProvider,
      );
      return { success: true, type: "chat" as const, message: reply };
    }

    // ── Document generation or modification step ──
    try {
      const docType =
        templateType || (await detectTemplateType(trimmed, llmProvider));

      const result = await generateDocumentAction({
        templateType: docType,
        userInput: trimmed,
        llmProvider,
      });

      if (!result.success) {
        // Fallback context: Pass a cleaner directive to the chat prompt generation
        const reply = await generateChatResponse(
          `The user is trying to create/edit a ${docType} but needs assistance. Promptly ask them for what is missing (e.g., specific quantities, clean prices, or a due date) to complete this action.`,
          conversationHistory,
          llmProvider,
        );
        return { success: true, type: "chat" as const, message: reply };
      }

      return {
        success: true,
        type: "document" as const,
        templateType: docType,
        message: `Your ${docType} is ready!`,
        html: result.html,
        json: result.json,
        fileName: result.fileName,
      };
    } catch (docError) {
      console.error(
        "Document generation processing error, scaling back to chat response:",
        docError,
      );

      const reply = await generateChatResponse(
        `The user submitted: "${trimmed}". The generator encountered an extraction issue. Guide them gently on formatting their text cleanly so it can be generated.`,
        conversationHistory,
        llmProvider,
      );
      return { success: true, type: "chat" as const, message: reply };
    }
  } catch (error) {
    console.error("Error in handleUserMessage handler:", error);
    return {
      success: false,
      type: "chat" as const,
      message: "Something went wrong. Please try again.",
    };
  }
}

// ─── Memory ────────────────────────────────────────────────────────────────────
export async function getMemories() {
  try {
    const allMemories = await dbHelpers.getMemories();
    return { success: true, memories: allMemories };
  } catch (error) {
    console.error("Error getting memories:", error);
    return {
      success: false,
      memories: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function saveMemory(
  key: string,
  content: Record<string, any>,
  description?: string,
) {
  try {
    await dbHelpers.saveMemory(key, content, description);
    return { success: true };
  } catch (error) {
    console.error("Error saving memory:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deleteMemory(key: string) {
  try {
    await dbHelpers.deleteMemory(key);
    return { success: true };
  } catch (error) {
    console.error("Error deleting memory:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─── Provider Settings ─────────────────────────────────────────────────────────
export async function getProviderSettings() {
  try {
    const config = await getProvidersConfig();
    return { success: true, ...config };
  } catch (error) {
    console.error("Error getting provider settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function setActiveProviderAction(
  provider: "gemini" | "openai" | "claude",
) {
  try {
    const result = await setActiveProvider(provider);
    return { success: true, ...result };
  } catch (error) {
    console.error("Error setting active provider:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function saveAPIKey(
  provider: "gemini" | "openai" | "claude",
  apiKey: string,
) {
  try {
    await dbHelpers.setSetting(
      `${provider}_api_key`,
      apiKey,
      `API key for ${provider}`,
    );
    return { success: true };
  } catch (error) {
    console.error("Error saving API key:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function detectTemplateTypeAction(
  userInput: string,
  provider?: "gemini" | "openai" | "claude",
) {
  try {
    const detectedType = await detectTemplateType(userInput, provider);
    return { success: true, detectedType };
  } catch (error) {
    console.error("Error detecting template type:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      detectedType: "quotation" as const,
    };
  }
}

export async function generatePdfAction(
  json: Record<string, any>,
  templateType: string
): Promise<string> {
  const pdfBuffer = await generatePDF(json, templateType);
  // Ensure it's base64-encoded for safe transport to the client
  return Buffer.isBuffer(pdfBuffer)
    ? pdfBuffer.toString("base64")
    : Buffer.from(pdfBuffer).toString("base64");
}
