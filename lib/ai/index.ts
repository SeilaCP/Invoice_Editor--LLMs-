import { generateObject, generateText } from "ai";
import { z } from "zod";
import { dbHelpers } from "../db/mock-db";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  generateMockInvoiceData,
  generateMockQuotationData,
  generateMockProposalData,
} from "./demo";

type LLMProvider = "gemini" | "openai" | "claude";

export type MessageIntent = "chat" | "document";

export interface IntentDetectionResult {
  intent: MessageIntent;
  templateType?: "invoice" | "quotation" | "proposal";
  confidence: number;
}

interface DocumentExtractionInput {
  userPrompt: string;
  templateType: "invoice" | "quotation" | "proposal";
  skillContent: string;
  memoryContext?: Record<string, any>;
  provider?: LLMProvider;
}

async function getActiveLLMProvider(): Promise<LLMProvider> {
  try {
    const setting = await dbHelpers.getSetting("active_llm_provider");
    return (setting?.value as LLMProvider) || "gemini";
  } catch (error) {
    console.error("Error getting LLM provider:", error);
    return "gemini";
  }
}

export function getModel(provider: LLMProvider) {
  switch (provider) {
    case "gemini":
      return google("gemini-2.5-flash-lite");
    case "openai":
      return openai("gpt-4o-mini");
    case "claude":
      return anthropic("claude-sonnet-4-5");
    default:
      return google("gemini-2.5-flash-lite");
  }
}

// ─── Intent Detection ──────────────────────────────────────────────────────────
// ─── Intent Detection ──────────────────────────────────────────────────────────
// Fast heuristic-first: only call LLM if heuristic is uncertain
export async function detectIntent(
  userInput: string,
  provider: LLMProvider = "gemini",
): Promise<IntentDetectionResult> {
  const input = userInput.trim().toLowerCase();
  const lowerInput = input.toLowerCase();
  const words = lowerInput.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ── 1. Edge Case: Empty or exceptionally short input ──
  if (wordCount === 0) {
    return { intent: "chat", confidence: 1.0 };
  }

  // // ── 2. Definite CHAT signals (no LLM needed) ──
  if (wordCount <= 4) {
    return { intent: "chat", confidence: 0.98 };
  }

  // // Quick catch for continuous gibberish / keysmashes (e.g., "asdfasdfasdfasdf")
  // const longestWord = Math.max(...words.map((w) => w.length));
  // if (longestWord > 25 && !userInput.includes("http")) {
  //   return { intent: "chat", confidence: 0.99 };
  // }

  if (
    /^(hi|hello|hey|thanks|thank you|ok|okay|sure|yes|no|help|what|how|why|who|when|where|can you|do you|is it|are you|test|testing)/.test(
      lowerInput,
    )
  ) {
    return { intent: "chat", confidence: 0.97 };
  }
  if (/\?$/.test(lowerInput)) {
    return { intent: "chat", confidence: 0.95 };
  }

  // // ── 3. Definite DOCUMENT signals (no LLM needed) ──
  const hasAmount =
    /\$\s?\d+([\.,]\d+)?|\d+\s?(usd|dollars?|€|£)|\b\d+\s?per\b|\d+\/hr/i.test(
      input,
    );

  // const hasClient =
  //   /\b(for|to|client|customer|company|corp|inc|ltd|buy|bought|purchase|ordered|bill\s?to)\b/.test(
  //     input,
  //   );

  // // 3. Upgraded Action Keywords
  const hasAction =
    /\b(create|generate|make|build|write|draft|invoice|bill|quote|quotation|proposal)\b/.test(
      input,
    );

  // const isModifying = /\b(add|change|update|remove|delete|insert|put|with|instead of)\b/.test(input);
  // const hasProductHints = /\b(product|item|each|qty|quantity|\$|\d+)\b/.test(input);

  // if (isModifying && hasProductHints) {
  //   const templateType = detectTemplateTypeHeuristic(input);
  //   return { intent: "document", confidence: 0.98, templateType };
  // }

  // ── 4. Uncertain — Ask the LLM with strict instructions ──
  try {
    const result = await generateObject({
      model: getModel(provider),
      system: `You are an intent classification security guard for a document generation assistant.
Your sole job is to distinguish between a legitimate request to CREATE a professional document and random chat/noise.

Classify as "document" ONLY if the user explicitly wants to generate an invoice, quotation, or proposal

Classify as "chat" if the input is:
- Casual conversation, questions, or greetings.
- Random text, gibberish, test messages (e.g., "hello world", "abcde").
- Vague statements completely missing critical details like pricing, client names, or deliverables.
- Unstructured text that doesn't make logical sense as a business document request.

If "chat", set templateType to undefined.`,
      prompt: `Analyze this user input:\n\n"${userInput}"`,
      schema: z.object({
        intent: z.enum(["chat", "document"]),
        templateType: z.enum(["invoice", "quotation", "proposal"]).optional(),
        confidence: z.number().min(0).max(1),
      }),
    });

    // Safeguard: If the model flagged it as chat but mistakenly threw in a templateType
    if (result.object.intent === "chat") {
      return { intent: "chat", confidence: result.object.confidence };
    }

    console.log(
      "Objected: ",
      result.object.intent,
      result.object.templateType,
      result.object.confidence,
    );

    return {
      intent: result.object.intent,
      templateType: result.object.templateType,
      confidence: result.object.confidence,
    };
  } catch (error) {
    console.error("Intent detection LLM failed, defaulting to chat:", error);
    return { intent: "chat", confidence: 0.7 };
  }
}

// ─── Chat Response ─────────────────────────────────────────────────────────────
export async function generateChatResponse(
  userMessage: string,
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [],
  provider?: LLMProvider,
): Promise<string> {
  const activeProvider = provider || (await getActiveLLMProvider());

  try {
    const { text } = await generateText({
      model: getModel(activeProvider),
      system: `You are a friendly assistant for a document generation platform that creates invoices, quotations, and proposals.

Your job:
- Answer questions about the platform, documents, pricing, and business practices
- Help users understand what information they need to create a document
- Have natural conversations

When users seem ready to create a document, tell them exactly what format to use. For example:
"Just say something like: 'Create an invoice for John Doe, web design services, $1500, due Feb 15'"

Keep replies concise and helpful. Do not generate document data yourself — just guide the user.
Stop completely there and wait for the user.`,
      messages: [
        ...conversationHistory,
        { role: "user", content: userMessage },
      ],
    });

    return text;
  } catch (error) {
    console.error("Error generating chat response:", error);
    return "I'm sorry, I encountered an error. Please try again.";
  }
}

// ─── Document Data Extraction ──────────────────────────────────────────────────
export async function extractDocumentData(
  input: DocumentExtractionInput,
): Promise<Record<string, any>> {
  const provider = input.provider || (await getActiveLLMProvider());
  let fullPrompt = input.userPrompt;
  if (input.memoryContext) {
    fullPrompt = `Context:\n${JSON.stringify(input.memoryContext, null, 2)}\n\nUser input:\n${input.userPrompt}`;
  }

  const genericSchema = z.object({
    clientName: z.string().optional(),
    clientEmail: z.string().optional(),
    clientAddress: z.string().optional(),
    invoiceNumber: z.string().optional(),
    quotationNumber: z.string().optional(),
    proposalNumber: z.string().optional(),
    invoiceDate: z.string().optional(),
    quotationDate: z.string().optional(),
    proposalDate: z.string().optional(),
    dueDate: z.string().optional(),
    validUntil: z.string().optional(),
    items: z
      .array(
        z.object({
          description: z.string().optional(),
          quantity: z.number().optional(),
          unitPrice: z.number().optional(),
          amount: z.number().optional(),
        }),
      )
      .optional(),
    subtotal: z.number().optional(),
    tax: z.number().optional(),
    total: z.number().optional(),
    notes: z.string().optional(),
    companyName: z.string().optional(),
    companyAddress: z.string().optional(),
    proposalTitle: z.string().optional(),
    introduction: z.string().optional(),
    objectives: z.array(z.string()).optional(),
    scope: z.string().optional(),
    deliverables: z.array(z.string()).optional(),
    timeline: z.string().optional(),
    cost: z.number().optional(),
    terms: z.string().optional(),
  });

  const proposalSchema = z.object({
    clientName: z.string(),
    clientEmail: z.string(),
    clientAddress: z.string(),

    proposalNumber: z.string(),
    proposalDate: z.string(),
    validUntil: z.string(),

    proposalTitle: z.string(),
    introduction: z.string(),

    objectives: z.array(z.string()),

    scope: z.string(),

    deliverables: z.array(z.string()),

    timeline: z.string(),

    cost: z.number(),

    terms: z.string(),

    notes: z.string(),

    companyName: z.string(),
    companyAddress: z.string(),
  });

  const quotationSchema = z.object({
    clientName: z.string(),
    clientEmail: z.string(),
    clientAddress: z.string(),

    quotationNumber: z.string(),
    quotationDate: z.string(),
    validUntil: z.string(),

    items: z.array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        amount: z.number(),
      }),
    ),

    subtotal: z.number(),

    tax: z.number(),

    total: z.number(),

    notes: z.string(),

    companyName: z.string(),
    companyAddress: z.string(),
  });

  const schemas = {
    invoice: genericSchema,
    quotation: quotationSchema,
    proposal: proposalSchema,
  } as const;

  const genSchema = schemas[input.templateType];

  try {
    console.log("Start Detected", input);
    const result = await generateObject({
      model: getModel(provider),
      system: `${input.skillContent}
IMPORTANT: Always fill in reasonable defaults for missing fields:
- invoiceNumber/quotationNumber/proposalNumber: generate as "INV-001", "QUO-001", "PRO-001"
- dates: use today's date if not specified (${new Date().toISOString().split("T")[0]})
- dueDate: default to 30 days from today if not specified
- tax: default to 0 if not mentioned
- Calculate subtotal, tax, and total correctly from items
- If quantity is not specified, default to 1
- companyName: use "Your Company" if not specified

CRITICAL LENGTH RULE:
If your response requires explaining a long concept or a massive amount of text, write ONLY the first 2-3 paragraphs or steps. 
At the end of your chunk, output exactly: "[PAUSED: Reply 'continue' to read more]".`,
      prompt: fullPrompt,
      schema: genSchema,
    });

    let clearedPrompt = input.userPrompt;
    if (clearedPrompt.includes("[due date]")) {
      // Replace string placeholder with a real calculated default date string
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 3); // default 30 days out
      const dateStr = defaultDate.toISOString().split("T")[0];

      clearedPrompt = clearedPrompt.replace(/\[due\s?date\]/gi, dateStr);
    }

    console.log("Document Detected: ", result.object);

    return result.object;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Fall back to demo data on auth errors
    const isAuthError =
      errorMessage.includes("credit card") ||
      errorMessage.includes("authentication") ||
      errorMessage.includes("API key") ||
      errorMessage.includes("401") ||
      errorMessage.includes("403");

    if (isAuthError) {
      console.log("[ai] Auth error — using demo data");
      if (input.templateType === "invoice")
        return generateMockInvoiceData(input.userPrompt);
      if (input.templateType === "quotation")
        return generateMockQuotationData(input.userPrompt);
      if (input.templateType === "proposal")
        return generateMockProposalData(input.userPrompt);
    }

    throw new Error(`Failed to extract document data: ${errorMessage}`);
  }
}

// ─── Provider Config ───────────────────────────────────────────────────────────
export async function getProvidersConfig() {
  return {
    providers: [
      {
        id: "gemini",
        name: "Google Gemini",
        model: "gemini-2.5-flash-lite",
        requiresKey: true,
      },
      {
        id: "openai",
        name: "OpenAI GPT-4",
        model: "gpt-4o-mini",
        requiresKey: true,
      },
      {
        id: "claude",
        name: "Anthropic Claude",
        model: "claude-sonnet-4-5",
        requiresKey: true,
      },
    ],
    activeProvider: await getActiveLLMProvider(),
  };
}

export async function setActiveProvider(provider: LLMProvider) {
  try {
    await dbHelpers.setSetting(
      "active_llm_provider",
      provider,
      "Active LLM provider",
    );
    return { success: true, provider };
  } catch (error) {
    console.error("Error setting active provider:", error);
    throw error;
  }
}

// ─── Template Type Detection ───────────────────────────────────────────────────
export async function detectTemplateType(
  userInput: string,
  provider: LLMProvider = "gemini",
): Promise<"invoice" | "quotation" | "proposal"> {
  try {
    const result = await generateObject({
      model: getModel(provider),
      system: `Classify: invoice, quotation , proposal.`,
      prompt: `"${userInput}"`,
      schema: z.object({
        detectedType: z.enum(["invoice", "quotation", "proposal"]),
      }),
    });
    return result.object.detectedType;
  } catch {
    return detectTemplateTypeHeuristic(userInput);
  }
}

// [!] Problem
function detectTemplateTypeHeuristic(
  userInput: string,
): "invoice" | "quotation" | "proposal" {
  const input = userInput.trim().toLowerCase();
  if (
    ["invoice", "bill", "payment due", "billing", "amount due"].some((kw) =>
      input.includes(kw),
    )
  )
    return "invoice";
  if (
    ["proposal", "project", "bid", "scope", "timeline", "deliverables"].some(
      (kw) => input.includes(kw),
    )
  )
    return "proposal";
  return "quotation";
}
