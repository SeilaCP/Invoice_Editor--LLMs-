import { db } from './db';
import { templates, skills, settings } from './schema';
import { z } from 'zod';

// Define template schemas
const invoiceSchema = z.object({
  clientName: z.string(),
  clientEmail: z.string().email().optional(),
  clientAddress: z.string().optional(),
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      amount: z.number(),
    })
  ),
  subtotal: z.number(),
  tax: z.number().optional(),
  total: z.number(),
  notes: z.string().optional(),
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
});

const quotationSchema = z.object({
  clientName: z.string(),
  clientEmail: z.string().email().optional(),
  clientAddress: z.string().optional(),
  quotationNumber: z.string(),
  quotationDate: z.string(),
  validUntil: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      amount: z.number(),
    })
  ),
  subtotal: z.number(),
  tax: z.number().optional(),
  total: z.number(),
  notes: z.string().optional(),
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
});

const proposalSchema = z.object({
  clientName: z.string(),
  clientEmail: z.string().email().optional(),
  clientAddress: z.string().optional(),
  proposalNumber: z.string(),
  proposalDate: z.string(),
  proposalTitle: z.string(),
  introduction: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  scope: z.string().optional(),
  deliverables: z.array(z.string()).optional(),
  timeline: z.string().optional(),
  cost: z.number(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
});

// Default HTML templates
const invoiceHtml = `
<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
  <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
    <div>
      <h1 style="margin: 0;">INVOICE</h1>
      <p style="color: #666; margin: 5px 0;">Invoice #: {{invoiceNumber}}</p>
      <p style="color: #666; margin: 5px 0;">Date: {{invoiceDate}}</p>
      <p style="color: #666; margin: 5px 0;">Due: {{dueDate}}</p>
    </div>
    <div style="text-align: right;">
      <h3>{{companyName}}</h3>
      <p style="color: #666; margin: 5px 0;">{{companyAddress}}</p>
    </div>
  </div>

  <div style="margin-bottom: 30px;">
    <h3>Bill To:</h3>
    <p style="margin: 5px 0;"><strong>{{clientName}}</strong></p>
    <p style="color: #666; margin: 5px 0;">{{clientEmail}}</p>
    <p style="color: #666; margin: 5px 0;">{{clientAddress}}</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr style="background-color: #f5f5f5;">
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #333;">Description</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #333;">Quantity</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #333;">Unit Price</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #333;">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 10px; text-align: left;">{{description}}</td>
        <td style="padding: 10px; text-align: center;">{{quantity}}</td>
        <td style="padding: 10px; text-align: right;">${{unitPrice}}</td>
        <td style="padding: 10px; text-align: right;">${{amount}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <div style="margin-left: auto; width: 300px; margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ddd;">
      <span>Subtotal:</span>
      <strong>${{subtotal}}</strong>
    </div>
    {{#tax}}
    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ddd;">
      <span>Tax:</span>
      <strong>${{tax}}</strong>
    </div>
    {{/tax}}
    <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: bold;">
      <span>Total:</span>
      <strong>${{total}}</strong>
    </div>
  </div>

  {{#notes}}
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
    <h4>Notes:</h4>
    <p style="color: #666;">{{notes}}</p>
  </div>
  {{/notes}}

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 12px;">
    <p>Thank you for your business!</p>
  </div>
</div>
`;

// Default skill prompts
const invoiceSkill = `You are an expert data extraction specialist. Extract invoice information from the user's input and return a valid JSON object matching this structure:

{
  "clientName": "Client name",
  "clientEmail": "client@example.com",
  "clientAddress": "Client address",
  "invoiceNumber": "Invoice number",
  "invoiceDate": "Date in YYYY-MM-DD format",
  "dueDate": "Date in YYYY-MM-DD format",
  "items": [{"description": "item description", "quantity": number, "unitPrice": number, "amount": number}],
  "subtotal": number,
  "tax": number or null,
  "total": number,
  "notes": "Optional notes",
  "companyName": "Your company name",
  "companyAddress": "Your company address"
}

Extract values intelligently from the user input. If values are missing, infer reasonable defaults or use placeholder values. Ensure all numbers are valid and the total equals subtotal + tax.`;

const quotationSkill = `You are an expert data extraction specialist. Extract quotation information from the user's input and return a valid JSON object matching this structure:

{
  "clientName": "Client name",
  "clientEmail": "client@example.com",
  "clientAddress": "Client address",
  "quotationNumber": "Quotation number",
  "quotationDate": "Date in YYYY-MM-DD format",
  "validUntil": "Date in YYYY-MM-DD format",
  "items": [{"description": "service/product description", "quantity": number, "unitPrice": number, "amount": number}],
  "subtotal": number,
  "tax": number or null,
  "total": number,
  "notes": "Optional terms or notes",
  "companyName": "Your company name",
  "companyAddress": "Your company address"
}

Extract values intelligently from the user input. Generate a quotation number if not provided. Set validUntil to 30 days from today if not specified.`;

const proposalSkill = `You are an expert data extraction specialist. Extract proposal information from the user's input and return a valid JSON object matching this structure:

{
  "clientName": "Client name",
  "clientEmail": "client@example.com",
  "clientAddress": "Client address",
  "proposalNumber": "Proposal number",
  "proposalDate": "Date in YYYY-MM-DD format",
  "proposalTitle": "Project/proposal title",
  "introduction": "Introduction paragraph",
  "objectives": ["objective 1", "objective 2"],
  "scope": "Scope description",
  "deliverables": ["deliverable 1", "deliverable 2"],
  "timeline": "Timeline description",
  "cost": number,
  "terms": "Payment terms",
  "notes": "Additional notes",
  "companyName": "Your company name",
  "companyAddress": "Your company address"
}

Extract values intelligently from the user input. For missing fields, create reasonable descriptions based on the context provided.`;

export async function initializeDatabase() {
  try {
    // Check if templates already exist
    const existingTemplates = db.query.templates.findMany().execute();
    if (Array.isArray(existingTemplates) && existingTemplates.length > 0) {
      console.log('Database already initialized with templates');
      return;
    }

    console.log('Initializing database with default templates...');

    // Insert default templates
    const invoiceTemplate = db
      .insert(templates)
      .values({
        name: 'invoice',
        title: 'Invoice Template',
        description: 'Standard invoice template',
        jsonSchema: JSON.stringify(invoiceSchema),
        htmlTemplate: invoiceHtml,
        isDefault: 1,
      })
      .returning()
      .get();

    const quotationTemplate = db
      .insert(templates)
      .values({
        name: 'quotation',
        title: 'Quotation Template',
        description: 'Standard quotation template',
        jsonSchema: JSON.stringify(quotationSchema),
        htmlTemplate: invoiceHtml, // Reuse similar structure
        isDefault: 1,
      })
      .returning()
      .get();

    const proposalTemplate = db
      .insert(templates)
      .values({
        name: 'proposal',
        title: 'Proposal Template',
        description: 'Standard proposal template',
        jsonSchema: JSON.stringify(proposalSchema),
        htmlTemplate: invoiceHtml, // Reuse similar structure
        isDefault: 1,
      })
      .returning()
      .get();

    // Insert default skills
    db.insert(skills)
      .values({
        templateId: invoiceTemplate.id,
        name: 'invoice_extraction',
        content: invoiceSkill,
        description: 'Extract invoice data from user input',
        isDefault: 1,
      })
      .execute();

    db.insert(skills)
      .values({
        templateId: quotationTemplate.id,
        name: 'quotation_extraction',
        content: quotationSkill,
        description: 'Extract quotation data from user input',
        isDefault: 1,
      })
      .execute();

    db.insert(skills)
      .values({
        templateId: proposalTemplate.id,
        name: 'proposal_extraction',
        content: proposalSkill,
        description: 'Extract proposal data from user input',
        isDefault: 1,
      })
      .execute();

    // Insert default settings
    db.insert(settings)
      .values({
        key: 'active_llm_provider',
        value: 'gemini',
        description: 'Active LLM provider: gemini, openai, or claude',
      })
      .execute();

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}
