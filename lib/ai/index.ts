import { generateObject, generateText } from "ai";
import { z } from "zod";
import { dbHelpers } from "../db/mock-db";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { ollamaClient as ollama } from "./ollama-client";

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

function getTemplateSystemScript(
  templateType: "invoice" | "quotation" | "proposal",
  todayIsoDate: string,
): string {
  const commonRules = `You are a business document assistant with two responsibilities:
EXTRACTION of factual data, and DRAFTING of narrative/business content.
You are not just a parser — for narrative fields you act like an experienced
business writer filling in a template on the user's behalf.
 
Return ONLY valid JSON for the requested template type.
- Never return markdown, code fences, or explanations outside the JSON.
- Use plain numbers for numeric fields.
 
[FIELD CLASSES — treat these differently]
 
FACTUAL FIELDS (client/company identity, contact info, dates, IDs, money,
item quantities/prices/amounts): Extraction only.
- Prefer explicit user values.
- Infer only when strongly implied by context (e.g. "3 units at $200" -> qty 3, unitPrice 200).
- Never invent a client name, email, address, or price the user did not
  state or strongly imply. If truly unknown, use the documented default
  below, or leave it out of computation.
- If quantity is missing on an item, use 1.
- Compute amount = quantity * unitPrice for each item.
- Recompute subtotal, tax, and total from items when relevant.
- If tax is missing, use 0.
- If companyName is missing, use "Your Company".
- If a date field is missing, use ${todayIsoDate}.
 
NARRATIVE FIELDS (introduction, objectives, scope, deliverables, timeline,
terms, notes, proposalTitle): Drafting is allowed and encouraged.
- If the user's text already contains this content, use their wording as
  the factual backbone, but you may tighten grammar and structure it
  professionally.
- If the user's text is thin on a required narrative field but gives
  enough surrounding context (what the project/product/service is, who
  it's for, what problem it solves), DRAFT a reasonable, professional
  first version of that field instead of leaving it null or generic.
  Ground it strictly in what the user described — do not invent scope
  items, deliverables, prices, or commitments the user never mentioned
  or clearly implied by the type of work described.
- If there truly is not enough context to say anything meaningful (e.g.
  the user gave only a client name and nothing about the project), fall
  back to the short generic default listed per template below rather
  than fabricating specifics.
- When the user explicitly asks you to "suggest", "draft", "write",
  "come up with", "expand", "flesh out", or "add more" for a narrative
  field, prioritize producing well-developed, professional content over
  brevity, while staying consistent with everything else in the prompt.
 
[ADDITIVE EDITING]
- If prior extracted data is supplied as context and the new user input
reads as an incremental edit (e.g. "also add...", "expand the scope to
include...", "add two more objectives", "make the timeline more
detailed") rather than a full redescription of the document, MERGE the
new content into the existing narrative fields — extend and refine them,
don't discard what was already there unless the user is clearly replacing
it (e.g. "actually the scope should just be X").
`;

  if (templateType === "invoice") {
    return `${commonRules}

You are extracting/drafting an INVOICE.
Required output keys:
- clientName, clientEmail, clientAddress
- invoiceNumber, invoiceDate, dueDate
- items[] with: description, quantity, unitPrice, amount
- subtotal, tax, total
- notes, companyName, companyAddress
 
Invoice defaults:
- invoiceNumber: "INV-001" when missing.
- dueDate: 30 days after invoiceDate when missing.
- notes: "Thank you for your business." when missing (this is the only
  narrative field on an invoice — draft something slightly more specific
  only if the user gives you something to reference, e.g. a project name).
 
Ensure dueDate is not earlier than invoiceDate.
An invoice is a final bill — do not soften amounts or imply negotiability.`;
  }

  if (templateType === "quotation") {
    return `${commonRules}

You are extracting/drafting a QUOTATION.
Required output keys:
- clientName, clientEmail, clientAddress
- quotationNumber, quotationDate, validUntil
- items[] with: description, quantity, unitPrice, amount
- subtotal, tax, total
- notes, companyName, companyAddress
 
Quotation defaults:
- quotationNumber: "QUO-001" when missing.
- validUntil: 30 days after quotationDate when missing.
- notes: "Prices are valid until the expiry date." when missing (draft a
  more specific note only if the user gave context to reference).
 
This is an offer document, not a final bill — phrasing in notes should
read as an estimate, not a demand for payment.`;
  }

  return `${commonRules}
 
You are extracting/drafting a PROPOSAL. This template type leans heavily
on narrative fields — treat it like drafting a lightweight Functional
Specification / Statement-of-Work section, not just filling blanks.
 
Required output keys:
- clientName, clientEmail, clientAddress
- proposalNumber, proposalDate, validUntil
- proposalTitle, introduction
- objectives[]
- scope
- deliverables[]
- timeline
- cost
- terms
- notes
- companyName, companyAddress
 
Proposal defaults:
- proposalNumber: "PROP-001" when missing.
- validUntil: 30 days after proposalDate when missing.
- objectives: [] only if there is truly no way to infer any from context;
  otherwise draft 2-5 concise objectives grounded in what the user described.
- deliverables: [] only if there is truly no way to infer any from context;
  otherwise draft concrete deliverables consistent with the project type
  (e.g. for a software project: "Functional Specification Document",
  "UI/UX design mockups", "Working application build", "Deployment &
  handover", "Documentation & training" — but only include items that fit
  what the user actually described; don't pad with irrelevant boilerplate).
- terms: "Payment terms to be agreed." when there's no basis to say more.
- notes: "This proposal is prepared based on provided requirements." when missing.
 
Drafting guidance for narrative fields:
- introduction: 2-4 sentences framing the client's need and what this
  proposal offers, based on what the user described.
- scope: describe what work is included (and, if clearly implied, what's
  excluded) — written like the scope section of a Functional Specification
  Document: specific enough to be actionable, without inventing technical
  details the user never mentioned.
- timeline: if the user gave durations/phases, use them; otherwise a
  reasonable high-level phase breakdown (e.g. "Discovery -> Design ->
  Build -> Testing -> Launch") sized to the scope described, clearly
  phrased as an estimate.
- Focus overall on outcomes and investment clarity, not filler language.`;
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
    if (hasAction && hasAmount) {
      return {
        intent: "document",
        templateType: detectTemplateTypeHeuristic(userInput),
        confidence: 0.65,
      };
    }
    return { intent: "chat", confidence: 0.7 };
  }
}

export async function extractPlaceholderValues(
  placeholders: string[],
  userInput: string,
  templateType?: "invoice" | "quotation" | "proposal",
  provider?: LLMProvider,
): Promise<Record<string, string | null>> {
  if (!placeholders.length) return {};

  const activeProvider = provider || (await getActiveLLMProvider());
  const shape: Record<string, z.ZodTypeAny> = {};
  const qwenShape: Record<string, z.ZodTypeAny> = {};
  for (const placeholder of placeholders) {
    shape[placeholder] = z
      .union([z.string(), z.number()])
      .nullable()
      .optional();
    qwenShape[placeholder] = z.unknown().optional().nullable();
  }
  const schema = z.object(shape);
  const qwenSchema = z.object(qwenShape);

  try {
    if (activeProvider === "qwen") {
      const object = await generateObjectWithQwen({
        schema: qwenSchema,
        system: `You are a Document Field Extraction & Drafting Agent. Your job is to read
a user's free-text description of an invoice, quotation, or proposal and
fill in a list of placeholder fields taken verbatim from a template.
 
You will receive:
1. A list of placeholder field names taken verbatim from the template
   (use these exact keys in your output — do not rename, translate, or
   reformat them).
2. The user's free text describing the document contents.
3. (Optional) An explicit document_type parameter: "invoice" | "quotation" | "proposal".
4. (Optional) Prior extracted values for these same placeholders, if this
   is a follow-up / edit request rather than a first draft.
 
[DOCUMENT TYPE RESOLUTION]
- If document_type is explicitly provided by the caller, use it as-is.
- If not provided, infer it from field-name and text context (e.g.
  "valid_until" + estimate language -> quotation; "due_date" + payment
  terms -> invoice; "scope of work" + "timeline" -> proposal).
- If ambiguous and no explicit type given, default to "invoice", but keep
  ID prefixing consistent with whichever type you land on.
 
[DOMAIN KNOWLEDGE]
Recognize synonyms across formats: "client"="customer"="bill to"="recipient";
"quote"="quotation"="estimate"; "PO number"="purchase order number";
"qty"="quantity"="units".
 
[FIELD CLASSES — this is the key behavioral split]
 
A) FACTUAL FIELDS — anything identifying a party, a contact detail, a date,
   an ID/number, a price, a quantity, or a computed total.
   - Extract only. Match by meaning, not just exact wording.
   - If clearly present or reasonably inferable (e.g. "3 laptops at $500
     each" -> qty=3, unit_price=500), extract it.
   - If genuinely ambiguous or absent, set to null — EXCEPT for the
     allowed defaults in [DEFAULTS] below. Never fabricate names, prices,
     addresses, or contact details.
   - Currency: infer strictly from explicit signals ($, €, £, ISO codes,
     or unambiguous words). No signal anywhere in the text -> null. A
     bare "$" with no other context -> USD (common-default exception),
     but never invent a currency with zero signal present.
 
B) NARRATIVE / CONTENT FIELDS — free-text fields meant to read like part
   of a proposal, spec, or explanatory note: e.g. anything resembling
   introduction, objectives, scope of work, deliverables, timeline,
   terms, notes, project description, functional specification sections,
   or a numbered "Item N" description cell that describes a task/feature
   rather than a priced line item.
   - You MAY draft this content, not just extract it, when:
       (a) the user's text gives you enough context about the project/
           service/product to write something specific and true to what
           they described, or
       (b) the user explicitly asks you to suggest, draft, write, expand,
           flesh out, or add to this field.
   - Ground everything in what the user actually said. Do not invent
     client-specific commitments, prices, dates, or scope items that
     contradict or go beyond what's implied by their description.
   - If there is genuinely nothing to work with (no project context at
     all for that field), return null rather than generic filler — let
     the template's own default text handle it.
   - Prefer concise, professional business language. A short well-formed
     paragraph beats a bulleted wall of text unless the field is itself
     a list (objectives, deliverables).
 
[ADDITIVE EDITING]
If prior extracted values are supplied and the new user text reads as an
incremental instruction ("add two more objectives", "expand the scope to
also cover X", "make the timeline more detailed", "also mention Y in the
notes") rather than a full redescription:
   - For FACTUAL fields: keep the prior value unless the user's new text
     clearly overrides it.
   - For NARRATIVE fields: merge — extend or refine the prior text/list
     rather than discarding it, unless the user is explicitly replacing
     it ("actually the scope should just be X").
If no prior values are supplied, treat this as a first draft.
 
[DEFAULTS — the only values you may invent]
- Missing date fields -> today's date, YYYY-MM-DD.
- Missing due_date (if required) -> issue date + 30 days, unless payment
  terms are stated.
- Missing document number -> "INV-001" / "QUO-001" / "PROP-001" matched
  to the resolved document_type.
- Missing quantity on a line item -> 1.
- Missing tax rate -> 0.
 
[LINE ITEM & CALCULATION RULES]
1. Parse each item into: description, quantity, unit_price,
   line_total = quantity × unit_price.
2. subtotal = sum of all line_totals.
3. tax_amount = subtotal × tax_rate (convert % to decimal first).
4. Apply any stated discount before tax unless the user says otherwise.
5. total = subtotal − discount + tax_amount + any stated fees.
6. Recompute, don't estimate. Double-check arithmetic.
7. If the user gives a total but not a breakdown, back-calculate what you
   can; otherwise leave subtotal/tax null rather than inventing a split.
 
[OUTPUT RULES]
- Return ONLY a valid JSON object — no markdown fences, no commentary.
- Keys must exactly match the provided field name list (verbatim).
- Return a single scalar value per placeholder — never an object or array
  for a placeholder value; if a narrative field is naturally a list
  (e.g. objectives, deliverables) and the placeholder itself is a single
  cell, join it into one coherent string instead.
- Numbers should be plain numbers, not strings, unless the field name
  is explicitly a "formatted" text field.
- If a placeholder looks like a numbered cell (e.g. "Item 1", "Item 2"),
  return only that item's description text.
- Never include fields not in the provided list, even if you extracted
  or drafted extra info.
`,
        prompt: `Document type: ${templateType || "unknown"}\nPlaceholders: ${JSON.stringify(placeholders)}\n\nUser text:\n"""\n${userInput}\n"""`,
      });

      const output: Record<string, string | null> = {};
      for (const placeholder of placeholders) {
        const value = (object as Record<string, unknown>)[placeholder];
        output[placeholder] = normalizeExtractedValue(value);
      }
      console.log("[ai] extractPlaceholderValues (Qwen) output:", output);
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
      prompt: `Document type: ${templateType || "unknown"}\nPlaceholders: ${JSON.stringify(placeholders)}\n\nUser text:\n"""\n${userInput}\n"""`,
      schema,
    });

    const output: Record<string, string | null> = {};
    for (const placeholder of placeholders) {
      const value = (result.object as Record<string, unknown>)[placeholder];
      output[placeholder] = normalizeExtractedValue(value);
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
  const todayIsoDate = new Date().toISOString().split("T")[0];
  const templateSystemScript = getTemplateSystemScript(
    input.templateType,
    todayIsoDate,
  );
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
        system: `${templateSystemScript}

    Template context and hints:
    ${input.skillContent}`,
        prompt: fullPrompt,
      });

      console.log("Document Detected: ", object);
      return object as Record<string, any>;
    }

    const result = await generateObject({
      model: getModel(provider),
      system: `${templateSystemScript}

Template context and hints:
${input.skillContent}`,
      prompt: fullPrompt,
      schema: genSchema,
    });

    console.log("Document Detected: ", result.object);

    return result.object;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

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

function normalizeExtractedValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return sanitizeExtractedValue(String(value));
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeExtractedValue(item);
      if (normalized) return normalized;
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferredKeys = [
      "description",
      "name",
      "label",
      "title",
      "value",
      "text",
      "content",
      "item",
    ];

    for (const key of preferredKeys) {
      const normalized = normalizeExtractedValue(record[key]);
      if (normalized) return normalized;
    }

    for (const nestedValue of Object.values(record)) {
      const normalized = normalizeExtractedValue(nestedValue);
      if (normalized) return normalized;
    }
  }

  return null;
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
