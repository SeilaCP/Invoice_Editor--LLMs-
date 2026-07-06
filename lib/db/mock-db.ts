import { embed } from "ai";
import { google } from "@ai-sdk/google";
import {
  connectDB,
  DocxTemplate,
  GeneratedDocument,
  IDocxTemplate,
  IGeneratedDocumentRecord,
  IMemoryRecord,
  ISettingRecord,
  MemoryRecord,
  SettingRecord,
  TemplateType,
} from "@/lib/mongodb";
import ollama from "ollama";

function getEmbeddingModel() {
  return google.embeddingModel("gemini-embedding-001");
}

function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || !right.length || left.length !== right.length) return 0;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function normalizeMongoRecord<T>(record: T): T {
  return JSON.parse(JSON.stringify(record));
}

function buildFallbackEmbedding(text: string, dimensions = 256) {
  const embedding = new Array<number>(dimensions).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];

  for (const token of tokens) {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) {
      hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
    }
    embedding[hash % dimensions] += 1;
  }

  const magnitude = Math.sqrt(
    embedding.reduce((sum, value) => sum + value * value, 0),
  );
  return magnitude > 0
    ? embedding.map((value) => value / magnitude)
    : embedding;
}

export async function buildEmbedding(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT",
) {
  const normalizedText = text.trim();
  if (!normalizedText) return [] as number[];

  try {
    const result = await embed({
      model: getEmbeddingModel(),
      value: normalizedText.slice(0, 8000),
      providerOptions: {
        google: {
          taskType,
        },
      },
    });

    return result.embedding;
  } catch (error) {
    console.error(
      "[v0] Embedding generation failed, using fallback vector:",
      error,
    );
    return buildFallbackEmbedding(normalizedText);
  }
}

async function toPlainTemplate(template: any): Promise<IDocxTemplate> {
  return normalizeMongoRecord(
    template.toObject ? template.toObject() : template,
  );
}

export const dbHelpers = {
  async getMemories() {
    await connectDB();
    return MemoryRecord.find({}).sort({ updatedAt: -1 }).lean();
  },

  async getMemory(key: string) {
    await connectDB();
    return MemoryRecord.findOne({ key }).lean();
  },

  async saveMemory(key: string, content: any, description?: string) {
    await connectDB();
    const serializedContent = JSON.stringify(content);
    const record = await MemoryRecord.findOneAndUpdate(
      { key },
      { key, content: serializedContent, description },
      { upsert: true, new: true },
    );
    return normalizeMongoRecord(record?.toObject?.() ?? record);
  },

  async deleteMemory(key: string) {
    await connectDB();
    return MemoryRecord.deleteOne({ key });
  },

  async getSetting(key: string) {
    await connectDB();
    return SettingRecord.findOne({ key }).lean();
  },

  async getAllSettings() {
    await connectDB();
    return SettingRecord.find({}).sort({ updatedAt: -1 }).lean();
  },

  async setSetting(key: string, value: string, description?: string) {
    await connectDB();
    const record = await SettingRecord.findOneAndUpdate(
      { key },
      { key, value, description },
      { upsert: true, new: true },
    );
    return normalizeMongoRecord(record?.toObject?.() ?? record);
  },

  async deleteSetting(key: string) {
    await connectDB();
    return SettingRecord.deleteOne({ key });
  },

  async saveDocument(
    doc: Omit<IGeneratedDocumentRecord, "createdAt" | "updatedAt">,
  ) {
    await connectDB();
    const record = await GeneratedDocument.create(doc);
    return normalizeMongoRecord(record.toObject());
  },

  async getDocuments() {
    await connectDB();
    return GeneratedDocument.find({}).sort({ updatedAt: -1 }).lean();
  },

  async saveTemplate(input: {
    filename: string;
    fileContent: string;
    templateType: TemplateType;
    extractedText: string;
    placeholders: string[];
    placeholderSchema: Array<{ name: string; required?: boolean }>;
    analysis?: string;
    embeddingText: string;
    embedding: number[];
    status?: "pending" | "ready" | "failed";
    source?: "upload" | "seed";
  }) {
    await connectDB();
    const record = await DocxTemplate.create({
      ...input,
      status: input.status ?? "ready",
      source: input.source ?? "upload",
    });
    return toPlainTemplate(record);
  },

  async getStoredTemplates(templateType?: TemplateType) {
    await connectDB();
    const query =
      templateType && templateType !== "generic" ? { templateType } : {};
    return DocxTemplate.find(query).sort({ updatedAt: -1 }).lean();
  },

  async findBestTemplate(queryText: string, templateType?: TemplateType) {
    const [best] = await dbHelpers.findTopTemplates(queryText, {
      templateType,
      limit: 1,
    });
    return best?.template ?? null;
  },

  async findTopTemplates(
    queryText: string,
    options: { templateType?: TemplateType; limit?: number } = {},
  ): Promise<Array<{ template: IDocxTemplate; score: number }>> {
    await connectDB();
    const limit = options.limit && options.limit > 0 ? options.limit : 5;

    // Only templates with a successfully generated embedding are eligible for
    // vector similarity ranking — "pending"/"failed" templates would always
    // score 0 and could otherwise crowd out real matches.
    const readyQuery: Record<string, any> = { status: "ready" };
    if (options.templateType && options.templateType !== "generic") {
      readyQuery.templateType = options.templateType;
    }

    const candidates = await DocxTemplate.find(readyQuery)
      .sort({ updatedAt: -1 })
      .lean();

    if (!candidates.length) return [];

    const trimmedQuery = queryText.trim();
    const queryEmbedding = trimmedQuery
      ? await buildEmbedding(trimmedQuery, "RETRIEVAL_QUERY")
      : [];

    const scored = candidates.map((candidate) => {
      const similarity = queryEmbedding.length
        ? cosineSimilarity(candidate.embedding || [], queryEmbedding)
        : 0;
      const keywordBonus = candidate.placeholders?.some((placeholder: string) =>
        trimmedQuery.toLowerCase().includes(placeholder.toLowerCase()),
      )
        ? 0.15
        : 0;
      return {
        template: normalizeMongoRecord(candidate) as IDocxTemplate,
        score: similarity + keywordBonus,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  },

  async findTemplatesByText(query: string) {
    await connectDB();
    return DocxTemplate.find({
      $or: [
        { filename: { $regex: query, $options: "i" } },
        { extractedText: { $regex: query, $options: "i" } },
        { placeholders: { $regex: query, $options: "i" } },
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();
  },

  async saveTemplateEmbedding(templateId: string, embedding: number[]) {
    await connectDB();
    return DocxTemplate.updateOne({ _id: templateId }, { $set: { embedding } });
  },
};
