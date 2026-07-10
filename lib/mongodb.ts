import mongoose, { Schema } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export type TemplateType = "invoice" | "quotation" | "proposal" | "generic";
export type TemplateStatus = "pending" | "ready" | "failed";

export interface IDocxTemplate {
  _id?: any;
  filename: string;
  fileContent: string;
  templateType: TemplateType;
  extractedText: string;
  placeholders: string[];
  placeholderSchema: Array<{ name: string; required?: boolean }>;
  analysis?: string;
  embeddingText?: string;
  embedding?: number[];
  status: TemplateStatus;
  source?: "upload" | "seed";
  createdAt: Date;
  updatedAt: Date;
}

// A fill session: created the first time a user starts filling a
// DocxTemplate, and updated on every follow-up prompt (continuation=true).
// It tracks which placeholders have been filled so far and which are still
// missing, so later prompts only need to supply the missing information.
export type FillSessionStatus = "in_progress" | "completed";

export interface IDocxTemplateMemory {
  _id?: any;
  sourceTemplateId: string;
  filename: string;
  fileContent: string;
  templateType: TemplateType;
  placeholders: string[];
  fields: Record<string, string | null>;
  unfilledPlaceholders: string[];
  status: FillSessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const placeholderItemSchema = new Schema(
  {
    name: { type: String, required: true },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

export interface IPdfDocument {
  _id?: any;
  filename: string;
  fileContent: string;
  extractedText: string;
  searchText: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMemoryRecord {
  _id?: any;
  key: string;
  content: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISettingRecord {
  _id?: any;
  key: string;
  value: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGeneratedDocumentRecord {
  _id?: any;
  templateType: TemplateType;
  templateId?: string;
  userInput: string;
  extractedJson: string;
  generatedHtml: string;
  generatedDocxBase64?: string;
  generatedPdfBase64?: string;
  fileName: string;
  createdAt: Date;
  updatedAt: Date;
}

const docxTemplateSchema = new Schema<IDocxTemplate>(
  {
    filename: { type: String, required: true },
    fileContent: { type: String, required: true },
    templateType: { type: String, required: true, default: "generic" },
    extractedText: { type: String, default: "" },
    placeholders: { type: [String], default: [] },
    placeholderSchema: { type: [placeholderItemSchema], default: [] },
    analysis: String,
    embeddingText: String,
    embedding: { type: [Number], default: [] },
    status: {
      type: String,
      enum: ["pending", "ready", "failed"],
      default: "pending",
    },
    source: { type: String, default: "upload" },
  },
  { timestamps: true },
);

const docxTemplateSchemaMemory = new Schema<IDocxTemplateMemory>(
  {
    sourceTemplateId: { type: String, required: true, index: true },
    filename: { type: String, required: true },
    fileContent: { type: String, required: true },
    templateType: { type: String, required: true, default: "generic" },
    placeholders: { type: [String], default: [] },
    fields: { type: Schema.Types.Mixed, default: {} },
    unfilledPlaceholders: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
  },
  { timestamps: true },
);

const pdfDocumentSchema = new Schema<IPdfDocument>(
  {
    filename: { type: String, required: true },
    fileContent: { type: String, required: true },
    extractedText: { type: String, default: "" },
    searchText: { type: String, index: true },
  },
  { timestamps: true },
);

const memorySchema = new Schema<IMemoryRecord>(
  {
    key: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    description: String,
  },
  { timestamps: true },
);

const settingSchema = new Schema<ISettingRecord>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    description: String,
  },
  { timestamps: true },
);

const generatedDocumentSchema = new Schema<IGeneratedDocumentRecord>(
  {
    templateType: { type: String, required: true },
    templateId: { type: String },
    userInput: { type: String, required: true },
    extractedJson: { type: String, required: true },
    generatedHtml: { type: String, required: true },
    generatedDocxBase64: String,
    generatedPdfBase64: String,
    fileName: { type: String, required: true },
  },
  { timestamps: true },
);

pdfDocumentSchema.index({ searchText: "text", filename: "text" });
docxTemplateSchema.index({ templateType: 1, updatedAt: -1 });

export const DocxTemplate =
  mongoose.models.DocxTemplate ||
  mongoose.model<IDocxTemplate>("DocxTemplate", docxTemplateSchema);

export const PdfDocument =
  mongoose.models.PdfDocument ||
  mongoose.model<IPdfDocument>("PdfDocument", pdfDocumentSchema);

export const DocxTemplateMemory =
  mongoose.models.DocxTemplateMemory ||
  mongoose.model<IDocxTemplateMemory>(
    "DocxTemplateMemory",
    docxTemplateSchemaMemory,
  );

export const MemoryRecord =
  mongoose.models.MemoryRecord ||
  mongoose.model<IMemoryRecord>("MemoryRecord", memorySchema);

export const SettingRecord =
  mongoose.models.SettingRecord ||
  mongoose.model<ISettingRecord>("SettingRecord", settingSchema);

export const GeneratedDocument =
  mongoose.models.GeneratedDocument ||
  mongoose.model<IGeneratedDocumentRecord>(
    "GeneratedDocument",
    generatedDocumentSchema,
  );

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI!, opts)
      .then((mongoose) => {
        console.log("[v0] Connected to MongoDB");
        return mongoose;
      })
      .catch((err) => {
        console.error("[v0] MongoDB connection error:", err);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
