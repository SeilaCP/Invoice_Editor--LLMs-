import { generateObject, generateText } from "ai";
import { z } from "zod";
import { dbHelpers } from "../db/mock-db";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import ollama from "ollama";

type LLMProvider = "gemini" | "openai" | "claude" | "qwen";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:14b";

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
      {
        id: "qwen",
        name: "Qwen (Ollama)",
        model: OLLAMA_MODEL,
        requiresKey: false,
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

export async function detectTemplateType(
  userInput: string,
  provider: LLMProvider = "gemini",
): Promise<"invoice" | "quotation" | "proposal"> {
  try {
    if (provider === "qwen") {
      const object = await generateObjectWithQwen({
        schema: z.object({
          detectedType: z.enum(["invoice", "quotation", "proposal"]),
        }),
        system: `Classify: invoice, quotation, proposal. Return JSON only.`,
        prompt: `"${userInput}"`,
      });
      return object.detectedType;
    }

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
    if (activeProvider === "qwen") {
      console.log("[ai] Generating chat response with Qwen...");
      const text = await generateTextWithQwen({
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

      return text || "I'm sorry, I encountered an error. Please try again.";
    }

    console.log("[ai] Generating chat response with gemini...");

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

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

async function generateObjectWithQwen<T>(input: {
  schema: z.ZodSchema<T>;
  system: string;
  prompt: string;
}): Promise<T> {
  const response = await ollama.chat({
    model: OLLAMA_MODEL,
    format: "json",
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.prompt },
    ],
  });

  const payload = extractJsonObject(response.message.content || "{}");
  return input.schema.parse(JSON.parse(payload));
}

async function generateTextWithQwen(input: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const response = await ollama.chat({
    model: OLLAMA_MODEL,
    messages: [
      { role: "system", content: input.system },
      ...input.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
  });

  return response.message.content?.trim() || "";
}

async function getActiveLLMProvider(): Promise<LLMProvider> {
  try {
    const setting = await dbHelpers.getSetting("active_llm_provider");
    return (setting?.value as LLMProvider) || "qwen";
  } catch (error) {
    console.error("Error getting LLM provider:", error);
    return "qwen";
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

export async function detectIntent(
  userInput: string,
  provider: LLMProvider = "gemini",
): Promise<IntentDetectionResult> {
  const input = userInput.trim().toLowerCase();
  const lowerInput = input.toLowerCase();
  const words = lowerInput.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount === 0) {
    return { intent: "chat", confidence: 1.0 };
  }

  if (wordCount <= 4) {
    return { intent: "chat", confidence: 0.98 };
  }

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

  const hasAmount =
    /\$\s?\d+([\.,]\d+)?|\d+\s?(usd|dollars?|€|£)|\b\d+\s?per\b|\d+\/hr/i.test(
      input,
    );

  const hasAction =
    /\b(create|generate|make|build|write|draft|invoice|bill|quote|quotation|proposal)\b/.test(
      input,
    );

  try {
    if (provider == "qwen") {
      const schema = z.object({
        intent: z.enum(["chat", "document"]),
        templateType: z.enum(["invoice", "quotation", "proposal"]).optional(),
        confidence: z.number().min(0).max(1),
      });

      const parsed = await generateObjectWithQwen({
        schema,
        system: `You are an intent classification security guard for a document generation assistant.

Your sole job is to distinguish between a legitimate request to CREATE a professional document and random chat/noise.

Return ONLY valid JSON.

The JSON must follow this schema:
{
  "intent": "chat" | "document",
  "templateType": "invoice" | "quotation" | "proposal" | null,
  "confidence": 0-1
}`,
        prompt: userInput,
      });

      return {
        intent: parsed.intent,
        templateType: parsed.templateType,
        confidence: parsed.confidence,
      };
    } else {
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
    }
  } catch (error) {
    console.error("Intent detection LLM failed, defaulting to chat:", error);
    return { intent: "chat", confidence: 0.7 };
  }
}

export async function extractPlaceholderValues(
  placeholders: string[],
  userInput: string,
  provider?: LLMProvider,
): Promise<Record<string, string | null>> {
  if (!placeholders.length) return {};

  const activeProvider = provider || (await getActiveLLMProvider());
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const placeholder of placeholders) {
    shape[placeholder] = z.union([z.string(), z.number()]).nullable();
  }
  const schema = z.object(shape);

  try {
    if (activeProvider === "qwen") {
      const object = await generateObjectWithQwen({
        schema,
        system: `You extract structured field values from a user's free-text description to fill in a document template.
You will be given a list of placeholder field names taken verbatim from the template, and the user's text.
Return a JSON object with exactly those field names as keys.
- If a value for a field is clearly present or can be reasonably inferred from the user's text, use it.
- If you cannot confidently determine a field's value, set it to null. Do NOT guess or invent data for fields you are unsure about.
- Keep values short and plain (no extra commentary).
- If user not includes dates or id number, set them to reasonable defaults: use today's date for any missing date, and generate a default ID like "INV-001" or "QUO-001" for any missing invoice/quotation/proposal number.
- Calculate subtotal, tax, and total correctly from items if they are present in the template, and default tax to 0 if not mentioned.`,
        prompt: `Placeholders: ${JSON.stringify(placeholders)}\n\nUser text:\n"""\n${userInput}\n"""`,
      });

      const output: Record<string, string | null> = {};
      for (const placeholder of placeholders) {
        const value = (object as Record<string, unknown>)[placeholder];
        output[placeholder] =
          value === undefined || value === null
            ? null
            : sanitizeExtractedValue(String(value));
      }
      return output;
    }

    const result = await generateObject({
      model: getModel(activeProvider),
      maxOutputTokens: 1000,
      abortSignal: AbortSignal.timeout(45_000),
      system: `You extract structured field values from a user's free-text description to fill in a document template.
You will be given a list of placeholder field names taken verbatim from the template, and the user's text.
Return a JSON object with exactly those field names as keys.
- If a value for a field is clearly present or can be reasonably inferred from the user's text, use it.
- If you cannot confidently determine a field's value, set it to null. Do NOT guess or invent data for fields you are unsure about.
- Keep values short and plain (no extra commentary).
- If user not includes dates or id number, set them to reasonable defaults: use today's date for any missing date, and generate a default ID like "INV-001" or "QUO-001" for any missing invoice/quotation/proposal number.
- Calculate subtotal, tax, and total correctly from items if they are present in the template, and default tax to 0 if not mentioned.`,
      prompt: `Placeholders: ${JSON.stringify(placeholders)}\n\nUser text:\n"""\n${userInput}\n"""`,
      schema,
    });

    const output: Record<string, string | null> = {};
    for (const placeholder of placeholders) {
      const value = (result.object as Record<string, unknown>)[placeholder];
      output[placeholder] =
        value === undefined || value === null
          ? null
          : sanitizeExtractedValue(String(value));
    }
    return output;
  } catch (error) {
    console.error("[ai] extractPlaceholderValues failed:", error);
    const fallback: Record<string, string | null> = {};
    for (const placeholder of placeholders) fallback[placeholder] = null;
    return fallback;
  }
}

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

    if (provider === "qwen") {
      const object = await generateObjectWithQwen({
        schema: genSchema,
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
      });

      console.log("Document Detected: ", object);
      return object as Record<string, any>;
    }

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
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 3);
      const dateStr = defaultDate.toISOString().split("T")[0];

      clearedPrompt = clearedPrompt.replace(/\[due\s?date\]/gi, dateStr);
    }

    console.log("Document Detected: ", result.object);

    return result.object;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
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

function sanitizeExtractedValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('"') || /[{}]/.test(trimmed)) {
    console.warn(
      "[ai] Discarding suspicious extracted value (looks like malformed JSON leakage):",
      trimmed,
    );
    return null;
  }
  return trimmed.replace(/[,;]\s*$/, "").trim() || null;
}

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
