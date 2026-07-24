import { embed } from "ai";
import { google } from "@ai-sdk/google";
import {
  connectDB,
  DocxTemplateChunk,
  DocxTemplate,
  GeneratedDocument,
  IDocxTemplateChunk,
  IDocxTemplate,
  IGeneratedDocumentRecord,
  IMemoryRecord,
  ISettingRecord,
  MemoryRecord,
  SettingRecord,
  TemplateType,
  DocxTemplateMemory,
} from "@/lib/mongodb";
import { ollamaClient as ollama } from "@/lib/ai/ollama-client";
import type { TemplateChunkInput } from "@/lib/types/template";
import {
  buildChunkSearchText,
  buildTemplateChunks,
  buildTemplateSearchText,
} from "@/lib/services/template-indexing.service";

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

function truncateChunkSnippet(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
}

function normalizeEmbeddingVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) return [];

  if (typeof value[0] === "number") {
    return (value as number[]).filter((item) => Number.isFinite(item));
  }

  if (Array.isArray(value[0])) {
    const nested = value[0] as unknown[];
    return nested
      .filter((item): item is number => typeof item === "number")
      .filter((item) => Number.isFinite(item));
  }

  return [];
}

function tokenizeSearchText(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (token) => token.length >= 3,
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegexSearch(tokens: string[]): RegExp | null {
  const normalized = tokens.slice(0, 8).map((token) => escapeRegex(token));
  if (!normalized.length) return null;
  return new RegExp(normalized.join("|"), "i");
}

function lexicalSimilarityScore(
  queryText: string,
  candidateText: string,
): number {
  const queryTokens = new Set(tokenizeSearchText(queryText));
  const candidateTokens = new Set(tokenizeSearchText(candidateText));

  if (!queryTokens.size || !candidateTokens.size) return 0;

  let overlapCount = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) overlapCount += 1;
  }

  return overlapCount / Math.sqrt(queryTokens.size * candidateTokens.size);
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
): Promise<number[]> {
  const normalizedText = text.trim();
  if (!normalizedText) return [] as number[];

  try {
    const result = await ollama.embed({
      model: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
      input: normalizedText.slice(0, 8000),
    });
    // const result = await embed({
    //   model: getEmbeddingModel(),
    //   value: normalizedText.slice(0, 8000),
    //   providerOptions: {
    //     google: {
    //       taskType,
    //     },
    //   },
    // });

    const embedding = normalizeEmbeddingVector(result.embeddings);

    if (!embedding.length) {
      throw new Error("Ollama embedding response did not include a vector");
    }

    console.log(`[v0] Embedding generated with ${embedding.length} dimensions`);
    return embedding;
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
    searchText?: string;
    embedding: number[];
    status?: "pending" | "ready" | "failed";
    source?: "upload" | "seed";
  }) {
    await connectDB();
    const record = await DocxTemplate.create({
      ...input,
      searchText:
        input.searchText ||
        buildTemplateSearchText({
          filename: input.filename,
          templateType: input.templateType,
          placeholders: input.placeholders,
          analysisSummary: input.analysis,
          extractedText: input.extractedText,
        }),
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
  ): Promise<
    Array<{ template: IDocxTemplate; score: number; matchedChunkText?: string }>
  > {
    await connectDB();
    const limit = options.limit && options.limit > 0 ? options.limit : 5;
    const prefilterLimit = Math.max(limit * 10, 40);

    const readyQuery: Record<string, any> = { status: "ready" };
    if (options.templateType && options.templateType !== "generic") {
      readyQuery.templateType = options.templateType;
    }
    console.log(
      `[v0] Searching for templates matching "${queryText}" with type ...`,
    );

    const trimmedQuery = queryText.trim();
    const queryTokens = tokenizeSearchText(trimmedQuery);
    const regexSearch = buildRegexSearch(queryTokens);

    let candidateIds = new Set<string>();

    if (trimmedQuery) {
      try {
        const templateHits = await DocxTemplate.find(
          {
            ...readyQuery,
            $text: { $search: trimmedQuery },
          },
          { score: { $meta: "textScore" } },
        )
          .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
          .limit(prefilterLimit)
          .lean();

        const chunkHits = await DocxTemplateChunk.find(
          {
            ...(options.templateType && options.templateType !== "generic"
              ? { templateType: options.templateType }
              : {}),
            $text: { $search: trimmedQuery },
          },
          { score: { $meta: "textScore" } },
        )
          .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
          .limit(prefilterLimit)
          .lean();

        candidateIds = new Set([
          ...templateHits.map((candidate) => String(candidate._id)),
          ...chunkHits.map((chunk) => chunk.templateId),
        ]);
      } catch (error) {
        console.warn(
          "[v0] Text index prefilter unavailable, falling back to regex:",
          error,
        );
      }
    }

    if (candidateIds.size === 0 && regexSearch) {
      const templateHits = await DocxTemplate.find({
        ...readyQuery,
        searchText: { $regex: regexSearch },
      })
        .sort({ updatedAt: -1 })
        .limit(prefilterLimit)
        .lean();

      const chunkHits = await DocxTemplateChunk.find({
        ...(options.templateType && options.templateType !== "generic"
          ? { templateType: options.templateType }
          : {}),
        searchText: { $regex: regexSearch },
      })
        .sort({ updatedAt: -1 })
        .limit(prefilterLimit)
        .lean();

      candidateIds = new Set([
        ...templateHits.map((candidate) => String(candidate._id)),
        ...chunkHits.map((chunk) => chunk.templateId),
      ]);
    }

    const candidateQuery =
      candidateIds.size > 0
        ? { ...readyQuery, _id: { $in: Array.from(candidateIds) } }
        : readyQuery;

    const candidates = await DocxTemplate.find(candidateQuery)
      .sort({ updatedAt: -1 })
      .limit(
        candidateIds.size > 0 ? prefilterLimit : Math.max(prefilterLimit, 60),
      )
      .lean();

    if (!candidates.length) return [];

    const candidateMap = new Map(
      candidates.map((candidate) => [String(candidate._id), candidate]),
    );
    const queryEmbedding = trimmedQuery
      ? await buildEmbedding(trimmedQuery, "RETRIEVAL_QUERY")
      : [];

    const chunks = await DocxTemplateChunk.find({
      templateId: { $in: Array.from(candidateMap.keys()) },
      ...(options.templateType && options.templateType !== "generic"
        ? { templateType: options.templateType }
        : {}),
    }).lean();

    const bestChunkByTemplate = new Map<
      string,
      { score: number; matchedChunkText?: string }
    >();

    for (const chunk of chunks) {
      const chunkEmbedding = normalizeEmbeddingVector(chunk.embedding);
      const canUseVectorSimilarity =
        queryEmbedding.length > 0 &&
        chunkEmbedding.length > 0 &&
        chunkEmbedding.length === queryEmbedding.length;

      const vectorSimilarity = canUseVectorSimilarity
        ? cosineSimilarity(chunkEmbedding, queryEmbedding)
        : 0;

      const lexicalSimilarity = trimmedQuery
        ? lexicalSimilarityScore(
            trimmedQuery,
            [
              chunk.filename,
              chunk.templateType,
              chunk.embeddingText,
              chunk.content,
              chunk.placeholders?.join(" "),
            ]
              .filter(Boolean)
              .join("\n"),
          )
        : 0;

      const keywordBonus = chunk.placeholders?.some((placeholder: string) =>
        trimmedQuery.toLowerCase().includes(placeholder.toLowerCase()),
      )
        ? 0.15
        : 0;

      const score =
        (canUseVectorSimilarity
          ? vectorSimilarity + lexicalSimilarity * 0.2
          : lexicalSimilarity) + keywordBonus;

      const existing = bestChunkByTemplate.get(chunk.templateId);
      if (!existing || score > existing.score) {
        bestChunkByTemplate.set(chunk.templateId, {
          score,
          matchedChunkText: truncateChunkSnippet(chunk.content),
        });
      }
    }

    const scored = candidates.map((candidate) => {
      const candidateEmbedding = normalizeEmbeddingVector(candidate.embedding);
      const canUseVectorSimilarity =
        queryEmbedding.length > 0 &&
        candidateEmbedding.length > 0 &&
        candidateEmbedding.length === queryEmbedding.length;

      const vectorSimilarity = canUseVectorSimilarity
        ? cosineSimilarity(candidateEmbedding, queryEmbedding)
        : 0;

      const lexicalSimilarity = trimmedQuery
        ? lexicalSimilarityScore(
            trimmedQuery,
            [
              candidate.filename,
              candidate.templateType,
              candidate.embeddingText,
              candidate.analysis,
              candidate.extractedText?.slice(0, 1000),
              candidate.placeholders?.join(" "),
            ]
              .filter(Boolean)
              .join("\n"),
          )
        : 0;

      const keywordBonus = candidate.placeholders?.some((placeholder: string) =>
        trimmedQuery.toLowerCase().includes(placeholder.toLowerCase()),
      )
        ? 0.15
        : 0;

      const similarity = canUseVectorSimilarity
        ? vectorSimilarity + lexicalSimilarity * 0.2
        : lexicalSimilarity;

      const chunkMatch = bestChunkByTemplate.get(String(candidate._id));
      const finalScore = chunkMatch
        ? Math.max(chunkMatch.score, similarity + keywordBonus * 0.5)
        : similarity + keywordBonus;

      return {
        template: normalizeMongoRecord(candidate) as IDocxTemplate,
        score: finalScore,
        matchedChunkText: chunkMatch?.matchedChunkText,
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

  async replaceTemplateChunks(
    templateId: string,
    templateType: TemplateType,
    filename: string,
    chunks: TemplateChunkInput[],
  ) {
    await connectDB();
    await DocxTemplateChunk.deleteMany({ templateId });

    if (!chunks.length) return [] as IDocxTemplateChunk[];

    const chunkRecords = await Promise.all(
      chunks.map(async (chunk) => ({
        templateId,
        filename,
        templateType,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embeddingText: chunk.embeddingText,
        searchText: buildChunkSearchText({
          filename,
          templateType,
          placeholders: chunk.placeholders,
          content: chunk.content,
        }),
        embedding: await buildEmbedding(chunk.embeddingText),
        placeholders: chunk.placeholders,
      })),
    );

    const inserted = await DocxTemplateChunk.insertMany(chunkRecords, {
      ordered: true,
    });
    return inserted.map((record) => normalizeMongoRecord(record.toObject()));
  },

  async reindexTemplateSearchData() {
    await connectDB();

    const templates = await DocxTemplate.find({}).lean();
    let updatedTemplates = 0;
    let updatedChunks = 0;

    for (const template of templates) {
      const templateId = String(template._id);
      const analysisSummary =
        template.analysis || "Template loaded successfully";
      const searchText = buildTemplateSearchText({
        filename: template.filename,
        templateType: template.templateType,
        placeholders: template.placeholders || [],
        analysisSummary,
        extractedText: template.extractedText || "",
      });

      await DocxTemplate.updateOne(
        { _id: template._id },
        { $set: { searchText } },
      );
      updatedTemplates += 1;

      const chunks = buildTemplateChunks({
        filename: template.filename,
        templateType: template.templateType,
        extractedText: template.extractedText || "",
        placeholders: template.placeholders || [],
        analysisSummary,
      });

      await dbHelpers.replaceTemplateChunks(
        templateId,
        template.templateType,
        template.filename,
        chunks,
      );
      updatedChunks += chunks.length;
    }

    return {
      templateCount: updatedTemplates,
      chunkCount: updatedChunks,
    };
  },
};
