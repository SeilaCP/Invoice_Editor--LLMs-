import { sql } from 'drizzle-orm';
import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core';

// Templates table - stores document templates (invoice, quotation, proposal)
export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // 'invoice', 'quotation', 'proposal'
  title: text('title').notNull(),
  description: text('description'),
  jsonSchema: text('json_schema').notNull(), // Zod schema as JSON string
  htmlTemplate: text('html_template').notNull(), // HTML template with placeholders
  isDefault: integer('is_default').default(0), // 1 for default, 0 for custom
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Skills table - stores skill prompts for LLM extraction
export const skills = sqliteTable('skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: integer('template_id')
    .notNull()
    .references(() => templates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // e.g., 'invoice_extraction', 'quotation_extraction'
  content: text('content').notNull(), // The skill prompt/instructions
  description: text('description'),
  isDefault: integer('is_default').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Memory table - stores user/company context for reuse
export const memories = sqliteTable('memories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull(), // e.g., 'company_info', 'user_defaults'
  content: text('content').notNull(), // JSON content
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Settings table - stores configuration like API keys and provider settings
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(), // e.g., 'active_llm_provider', 'gemini_api_key'
  value: text('value').notNull(),
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Generated Documents table - stores history of generated documents
export const generatedDocuments = sqliteTable('generated_documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: integer('template_id')
    .notNull()
    .references(() => templates.id),
  userInput: text('user_input').notNull(), // User's input text
  extractedJson: text('extracted_json').notNull(), // JSON extracted by LLM
  generatedHtml: text('generated_html').notNull(), // Final HTML output
  fileName: text('file_name').notNull(), // e.g., 'invoice_2024_001.pdf'
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
