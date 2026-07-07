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
