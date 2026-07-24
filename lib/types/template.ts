export type LLMProvider = "gemini" | "openai" | "claude" | "qwen";

export interface TemplateMatch {
  fileBase64: string;
  templateId: string;
  filename: string;
  templateType: string;
  placeholders: string[];
  score: number;
  matchedChunkText?: string;
}

export interface FillTemplateResult {
  fileName: string;
  fileBase64: string;
  fields: Record<string, string | null>;
  unfilledPlaceholders: string[];
  fillSessionId: string;
  isComplete: boolean;
}

export interface TemplateChunkInput {
  chunkIndex: number;
  content: string;
  embeddingText: string;
  placeholders: string[];
}
