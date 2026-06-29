import { extractDocumentData } from "../ai";
import { dbHelpers } from "../db/mock-db";
import Handlebars from "handlebars";

interface GenerateDocumentInput {
  templateType: "invoice" | "quotation" | "proposal";
  userInput: string;
  memoryContext?: Record<string, any>;
  llmProvider?: "gemini" | "openai" | "claude";
}

interface GenerateDocumentOutput {
  success: boolean;
  html: string;
  json: Record<string, any>;
  fileName: string;
  message?: string;
  error?: string;
}

Handlebars.registerHelper("inc", function (value: number) {
  return value + 1;
});

// ─── ADD THIS: Proposal-specific HTML template ────────────────────────────────
// Place this alongside DEFAULT_HTML_TEMPLATE in generateDocument.ts

export const PROPOSAL_HTML_TEMPLATE = `
<div style="font-family:'Arial',sans-serif;background:#FAF8F5;color:#2d2d2d;max-width:800px;margin:auto;">

  <!-- Document body -->
  <div style="padding:50px 50px 0 50px;">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div>
        <div style="font-size:11px;color:#999;margin-bottom:2px;">Prepared for</div>
        <div style="font-size:13px;font-weight:600;color:#2d2d2d;">{{clientName}}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:#999;margin-bottom:2px;">Prepared by</div>
        <div style="font-size:13px;font-weight:600;color:#2d2d2d;">{{companyName}}</div>
      </div>
    </div>

    <div style="text-align:center;padding:20px 0 8px;">
      <span style="font-size:28px;letter-spacing:0.12em;text-transform:uppercase;color:#999;font-weight:300;">Project </span>
      <span style="font-size:28px;letter-spacing:0.12em;text-transform:uppercase;color:#2d2d2d;font-weight:600;">Proposal</span>
    </div>
    <hr style="border:none;border-top:1px solid #d4c9b8;margin-bottom:28px;">

    <!-- Project name -->
    <div style="margin-bottom:24px;">
      <h3 style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2d2d2d;margin:0 0 6px;">Project name</h3>
      <p style="font-size:13px;color:#666;margin:0;line-height:1.6;">{{proposalTitle}}</p>
    </div>

    <!-- Description -->
    <div style="margin-bottom:24px;">
      <h3 style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2d2d2d;margin:0 0 6px;">Description</h3>
      <p style="font-size:13px;color:#666;margin:0;line-height:1.6;">{{introduction}}</p>
    </div>

    <!-- Image slot: after description -->
    <div id="slot-description" style="display:none;">
      <div onclick="document.getElementById('img-upload').click()"
           ondrop="handleDrop(event)" ondragover="event.preventDefault()"
           id="drop-description"
           style="border:2px dashed #d4c9b8;border-radius:8px;padding:32px;text-align:center;cursor:pointer;margin-bottom:24px;background:#fdf9f5;"
           onmouseover="this.style.background='#f5ede2'" onmouseout="this.style.background='#fdf9f5'">
        <div style="font-size:28px;color:#ccc;margin-bottom:6px;">📷</div>
        <div style="font-size:12px;color:#aaa;">Click or drag & drop to add a project image</div>
      </div>
      <div id="preview-description" style="display:none;position:relative;margin-bottom:24px;">
        <img id="img-description" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;display:block;" />
        <button onclick="clearImage()" style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.9);border:1px solid #ccc;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;color:#555;">✕ Remove</button>
      </div>
    </div>

    <!-- Scope of work -->
    <div style="margin-bottom:24px;">
      <h3 style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2d2d2d;margin:0 0 6px;">Scope of work</h3>
      {{#if scope}}
        <p style="font-size:13px;color:#666;margin:0;line-height:1.6;">{{scope}}</p>
      {{else}}
        <ul style="margin:0;padding:0;list-style:none;">
          {{#each objectives}}
          <li style="font-size:13px;color:#666;padding:2px 0;line-height:1.6;">
            <span style="color:#ccc;margin-right:8px;">—</span>{{this}}
          </li>
          {{/each}}
        </ul>
      {{/if}}
    </div>

    <!-- Image slot: after scope -->
    <div id="slot-scope" style="display:none;">
      <div onclick="document.getElementById('img-upload').click()"
           ondrop="handleDrop(event)" ondragover="event.preventDefault()"
           id="drop-scope"
           style="border:2px dashed #d4c9b8;border-radius:8px;padding:32px;text-align:center;cursor:pointer;margin-bottom:24px;background:#fdf9f5;"
           onmouseover="this.style.background='#f5ede2'" onmouseout="this.style.background='#fdf9f5'">
        <div style="font-size:28px;color:#ccc;margin-bottom:6px;">📷</div>
        <div style="font-size:12px;color:#aaa;">Click or drag & drop to add a project image</div>
      </div>
      <div id="preview-scope" style="display:none;position:relative;margin-bottom:24px;">
        <img id="img-scope" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;display:block;" />
        <button onclick="clearImage()" style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.9);border:1px solid #ccc;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;color:#555;">✕ Remove</button>
      </div>
    </div>

    <!-- Deliverables -->
    <div style="margin-bottom:24px;">
      <h3 style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2d2d2d;margin:0 0 6px;">Deliverables</h3>
      <ul style="margin:0;padding:0;list-style:none;">
        {{#each deliverables}}
        <li style="font-size:13px;color:#666;padding:2px 0;line-height:1.6;">
          <span style="color:#ccc;margin-right:8px;">—</span>{{this}}
        </li>
        {{/each}}
      </ul>
    </div>

    <!-- Timeline -->
    <div style="margin-bottom:24px;">
      <h3 style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2d2d2d;margin:0 0 6px;">Timeline</h3>
      <ul style="margin:0;padding:0;list-style:none;">
        <li style="font-size:13px;color:#666;padding:2px 0;line-height:1.6;">
          <span style="color:#ccc;margin-right:8px;">—</span>{{timeline}}
        </li>
      </ul>
    </div>

    <!-- Investment -->
    <div style="margin-bottom:40px;">
      <h3 style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2d2d2d;margin:0 0 6px;">Investment</h3>
      <ul style="margin:0 0 8px;padding:0;list-style:none;">
        <li style="font-size:13px;color:#666;padding:2px 0;line-height:1.6;">
          <span style="color:#ccc;margin-right:8px;">—</span>$\{{cost}}
        </li>
      </ul>
      {{#if terms}}
      <p style="font-size:13px;color:#666;margin:0;line-height:1.6;">{{terms}}</p>
      {{/if}}
    </div>

  </div>

  <!-- Footer -->
  <div style="background:#5a3a3a;padding:28px 50px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:13px;font-weight:600;color:#f0d4b8;margin-bottom:6px;">{{companyName}}</div>
      <div style="font-size:11px;color:#b09090;line-height:1.8;">
        {{companyAddress}}<br>
        {{#if companyEmail}}{{companyEmail}}<br>{{/if}}
        {{#if companyPhone}}{{companyPhone}}{{/if}}
      </div>
    </div>
    <svg width="44" height="44" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:0.6">
      <path d="M30 8 C30 8 18 18 18 30 C18 42 30 52 30 52 C30 52 42 42 42 30 C42 18 30 8 30 8Z" stroke="#d4a882" stroke-width="1.5"/>
      <path d="M20 20 C25 25 35 25 40 20" stroke="#d4a882" stroke-width="1.5"/>
      <path d="M20 40 C25 35 35 35 40 40" stroke="#d4a882" stroke-width="1.5"/>
      <circle cx="30" cy="30" r="4" stroke="#d4a882" stroke-width="1.5"/>
    </svg>
  </div>

  <!-- Hidden file input shared across all slots -->
  <input type="file" id="img-upload" accept="image/*" style="display:none" onchange="handleFile(this)">

</div>

<script>
  var activePlacement = 'top';
  var imageData = null;

  function setPlacement(pos) {
    ['top','description','scope'].forEach(function(p) {
      document.getElementById('slot-' + p).style.display = (p === pos) ? 'block' : 'none';
      var btn = document.getElementById('btn-' + p);
      if (p === pos) {
        btn.style.background = '#5a3a3a'; btn.style.color = '#fff'; btn.style.borderColor = '#5a3a3a';
      } else {
        btn.style.background = '#fff'; btn.style.color = '#555'; btn.style.borderColor = '#ccc';
      }
    });
    activePlacement = pos;
    if (imageData) showPreview(pos);
  }

  function handleFile(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) { imageData = e.target.result; showPreview(activePlacement); };
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    var file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    var reader = new FileReader();
    reader.onload = function(e) { imageData = e.target.result; showPreview(activePlacement); };
    reader.readAsDataURL(file);
  }

  function showPreview(pos) {
    var drop = document.getElementById('drop-' + pos);
    var preview = document.getElementById('preview-' + pos);
    var img = document.getElementById('img-' + pos);
    if (drop) drop.style.display = 'none';
    if (preview) preview.style.display = 'block';
    if (img) img.src = imageData;
    document.getElementById('img-upload').value = '';
  }

  function clearImage() {
    imageData = null;
    ['top','description','scope'].forEach(function(p) {
      var drop = document.getElementById('drop-' + p);
      var preview = document.getElementById('preview-' + p);
      if (drop) drop.style.display = 'block';
      if (preview) preview.style.display = 'none';
    });
    document.getElementById('img-upload').value = '';
  }
</script>
`;

const DEFAULT_HTML_TEMPLATE = `
<div style="
  font-family: 'Arial', sans-serif;
  background:#F8F3E8;
  color:#233BCB;
  max-width:900px;
  margin:auto;
  padding:50px;
">

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;">

<div style="width:55%;">

<h1 style="
font-size:64px;
margin:0;
font-weight:900;
letter-spacing:2px;
">
{{#if invoiceNumber}}INVOICE{{else}}{{#if quotationNumber}}QUOTATION{{else}}PROPOSAL{{/if}}{{/if}}
</h1>

<div style="margin-top:25px;font-size:14px;">

<div style="display:flex;border-bottom:1px solid #233BCB;padding:8px 0;">
<div style="width:180px;font-weight:bold;">NUMBER</div>
<div>
{{invoiceNumber}}{{quotationNumber}}{{proposalNumber}}
</div>
</div>

<div style="display:flex;border-bottom:1px solid #233BCB;padding:8px 0;">
<div style="width:180px;font-weight:bold;">DATE</div>
<div>
{{invoiceDate}}{{quotationDate}}{{proposalDate}}
</div>
</div>

{{#if dueDate}}
<div style="display:flex;border-bottom:1px solid #233BCB;padding:8px 0;">
<div style="width:180px;font-weight:bold;">DUE DATE</div>
<div>{{dueDate}}</div>
</div>
{{/if}}

</div>

</div>

<div style="text-align:right;width:35%;">
<h2 style="margin:0;">{{companyName}}</h2>

<p style="margin:5px 0;">
{{companyAddress}}
</p>

{{#if companyPhone}}
<p>{{companyPhone}}</p>
{{/if}}

{{#if companyEmail}}
<p>{{companyEmail}}</p>
{{/if}}

</div>

</div>

<!-- Customer -->
<div style="
display:flex;
justify-content:space-between;
margin-top:50px;
">

<div style="
width:48%;
border:1px solid #233BCB;
padding:20px;
">

<h3 style="margin-top:0;">BILL TO</h3>

<p><strong>{{clientName}}</strong></p>

{{#if clientCompany}}
<p>{{clientCompany}}</p>
{{/if}}

<p>{{clientAddress}}</p>

<p>{{clientEmail}}</p>

</div>

<div style="width:40%;">

<h3>PAYABLE TO</h3>

<p><strong>{{companyName}}</strong></p>

<p>{{companyAddress}}</p>

{{#if companyPhone}}
<p>{{companyPhone}}</p>
{{/if}}

{{#if companyEmail}}
<p>{{companyEmail}}</p>
{{/if}}

</div>

</div>

<!-- Table -->

<table style="
width:100%;
margin-top:40px;
border-collapse:collapse;
font-size:14px;
">

<thead>

<tr>

<th style="border-bottom:2px solid #233BCB;padding:12px;text-align:center;">NO.</th>

<th style="border-bottom:2px solid #233BCB;padding:12px;text-align:left;">ITEM DESCRIPTION</th>

<th style="border-bottom:2px solid #233BCB;padding:12px;">QTY</th>

<th style="border-bottom:2px solid #233BCB;padding:12px;">PRICE</th>

<th style="border-bottom:2px solid #233BCB;padding:12px;">TOTAL</th>

</tr>

</thead>

<tbody>

{{#each items}}

<tr>

<td style="border-bottom:1px solid #233BCB;padding:12px;text-align:center;">
{{inc @index}}
</td>

<td style="border-bottom:1px solid #233BCB;padding:12px;">
{{description}}
</td>

<td style="border-bottom:1px solid #233BCB;padding:12px;text-align:center;">
{{quantity}}
</td>

<td style="border-bottom:1px solid #233BCB;padding:12px;text-align:right;">
$ {{unitPrice}}
</td>

<td style="border-bottom:1px solid #233BCB;padding:12px;text-align:right;">
$ {{amount}}
</td>

</tr>

{{/each}}

</tbody>

</table>

<!-- Totals -->

<div style="
display:flex;
justify-content:flex-end;
margin-top:40px;
">

<table style="width:320px;">

{{#if subtotal}}
<tr>
<td>Subtotal</td>
<td style="text-align:right;">
$ {{subtotal}}
</td>
</tr>
{{/if}}

{{#if discount}}
<tr>
<td>Discount</td>
<td style="text-align:right;">
$ {{discount}}
</td>
</tr>
{{/if}}

{{#if tax}}
<tr>
<td>Sales Tax</td>
<td style="text-align:right;">
$ {{tax}}
</td>
</tr>
{{/if}}

<tr style="
font-size:22px;
font-weight:bold;
border-top:2px solid #233BCB;
">

<td style="padding-top:15px;">
TOTAL
</td>

<td style="
padding-top:15px;
text-align:right;
">
$ {{total}}
</td>

</tr>

</table>

</div>

<!-- Notes -->

{{#if notes}}

<div style="margin-top:40px;">

<h3>NOTES</h3>

<p>{{notes}}</p>

</div>

{{/if}}

<!-- Proposal Scope -->

{{#if scope}}

<div style="margin-top:40px;">

<h3>SCOPE OF WORK</h3>

<p>{{scope}}</p>

</div>

{{/if}}

<!-- Signature -->

<div style="
margin-top:70px;
display:flex;
justify-content:flex-end;
">

<div style="width:250px;text-align:center;">

<div style="
border-bottom:1px solid #233BCB;
height:40px;
margin-bottom:10px;
">
</div>

<div>Authorized Signature</div>

</div>

</div>

<!-- Footer -->

<div style="
text-align:center;
margin-top:60px;
font-size:32px;
font-weight:bold;
letter-spacing:1px;
">

THANK YOU FOR YOUR BUSINESS!

</div>

</div>
`;
const templateCache = new Map<string, HandlebarsTemplateDelegate<any>>();

function compileTemplate(templateStr: string) {
  if (templateCache.has(templateStr)) {
    return templateCache.get(templateStr)!;
  }
  const compiled = Handlebars.compile(templateStr);
  templateCache.set(templateStr, compiled);
  return compiled;
}

// Default skill prompts
const skillPrompts = {
  invoice: `You are an expert data extraction specialist. Extract invoice information from the user's input and return ONLY a valid JSON object matching this structure (no markdown, no code blocks, just JSON):
{
  "clientName": "Client name",
  "clientEmail": "client@example.com",
  "clientAddress": "123 Main St",
  "invoiceNumber": "INV-001",
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "items": [{"description": "Service description", "quantity": 1, "unitPrice": 100, "amount": 100}],
  "subtotal": 100,
  "tax": 10,
  "total": 110,
  "notes": "Thank you",
  "companyName": "Your Company",
  "companyAddress": "456 Business Ave"
}`,
  quotation: `You are an expert data extraction specialist. Extract quotation information from the user's input and return ONLY a valid JSON object matching this structure (no markdown, no code blocks, just JSON):
{
  "clientName": "Client name",
  "clientEmail": "client@example.com",
  "clientAddress": "123 Main St",
  "quotationNumber": "QT-001",
  "quotationDate": "2024-01-15",
  "validUntil": "2024-02-15",
  "items": [{"description": "Service description", "quantity": 1, "unitPrice": 100, "amount": 100}],
  "subtotal": 100,
  "tax": 10,
  "total": 110,
  "notes": "Terms and conditions",
  "companyName": "Your Company",
  "companyAddress": "456 Business Ave"
}`,
  proposal: `You are an expert data extraction specialist. Extract proposal information from the user's input and return ONLY a valid JSON object matching this structure (no markdown, no code blocks, just JSON):
{
  "clientName": "Client name",
  "clientEmail": "client@example.com",
  "clientAddress": "123 Main St",
  "proposalNumber": "PROP-001",
  "proposalDate": "2024-01-15",
  "proposalTitle": "Project Title",
  "introduction": "Project introduction",
  "objectives": ["Objective 1", "Objective 2"],
  "scope": "Scope of work",
  "deliverables": ["Deliverable 1", "Deliverable 2"],
  "timeline": "3 months",
  "cost": 5000,
  "terms": "Payment terms",
  "notes": "Additional notes",
  "companyName": "Your Company",
  "companyAddress": "456 Business Ave"
}`,
};

export async function generateDocument(
  input: GenerateDocumentInput,
): Promise<GenerateDocumentOutput> {
  try {
    // Get skill prompt for this template type
    const skillContent = skillPrompts[input.templateType];

    if (!skillContent) {
      return {
        success: false,
        html: "",
        json: {},
        fileName: "",
        error: `No skill found for template type: ${input.templateType}`,
      };
    }

    // Extract data using LLM
    const extractedJson = await extractDocumentData({
      userPrompt: input.userInput,
      templateType: input.templateType,
      skillContent,
      memoryContext: input.memoryContext,
      provider: input.llmProvider,
    });

    if (Array.isArray(extractedJson.items)) {
      extractedJson.items = extractedJson.items.map(
        (item: any, index: number) => ({
          ...item,
          no: index + 1,
        }),
      );
    }

    // Compile and render template
    const compiled = compileTemplate(
      input.templateType === "proposal"
        ? PROPOSAL_HTML_TEMPLATE
        : DEFAULT_HTML_TEMPLATE,
    );
    const html = compiled(extractedJson);

    // Generate file name
    const timestamp = new Date().toISOString().split("T")[0];
    const documentNumber =
      extractedJson.invoiceNumber ||
      extractedJson.quotationNumber ||
      extractedJson.proposalNumber ||
      "DOC";
    const fileName = `${input.templateType}_${documentNumber}_${timestamp}.html`;

    // Save to mock database
    try {
      await dbHelpers.saveDocument({
        templateId: 1,
        userInput: input.userInput,
        extractedJson: JSON.stringify(extractedJson),
        generatedHtml: html,
        fileName,
      });
    } catch (dbError) {
      console.error("Error saving document to database:", dbError);
      // Continue even if database save fails
    }

    return {
      success: true,
      html,
      json: extractedJson,
      fileName,
      message: "Document generated successfully",
    };
  } catch (error) {
    console.error("Error generating document:", error);
    return {
      success: false,
      html: "",
      json: {},
      fileName: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Generate PDF from HTML (you'll need to add a PDF library)
export async function generatePDF(html: string): Promise<Buffer> {
  // This is a placeholder - you would use a library like puppeteer or pdfkit
  // For now, we'll return the HTML as-is
  // TODO: Implement PDF generation using pdfkit or similar
  throw new Error("PDF generation not yet implemented. Use the HTML directly.");
}
