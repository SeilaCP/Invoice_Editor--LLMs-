import { extractDocumentData } from "../ai";
import { dbHelpers } from "../db/mock-db";
import Handlebars from "handlebars";
import PDFDocument from "pdfkit";

// npm install pdfkit
// npm install --save-dev @types/pdfkit

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

import Handlebars from "handlebars";

Handlebars.registerHelper("inc", (value: number) => value + 1);

Handlebars.registerHelper(
  "if_odd",
  function (this: unknown, value: number, options: Handlebars.HelperOptions) {
    return value % 2 !== 0 ? options.fn(this) : options.inverse(this);
  },
);

// ─── Proposal HTML Template ────────────────────────────────────────────────────
export const PROPOSAL_HTML_TEMPLATE = `
<div style="font-family:'Georgia','Times New Roman',serif;background:#F5F0E8;color:#3D2B1F;max-width:800px;margin:auto;box-shadow:0 4px 20px rgba(61,43,31,0.08);">
  <!-- Document body -->
  <div style="padding:50px 50px 0 50px;">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:2px solid #C4A882;padding-bottom:20px;">
      <div>
        <div style="font-size:10px;color:#A89080;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">Prepared for</div>
        <div style="font-size:15px;font-weight:600;color:#3D2B1F;font-family:'Georgia',serif;">{{clientName}}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:#A89080;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">Prepared by</div>
        <div style="font-size:15px;font-weight:600;color:#3D2B1F;font-family:'Georgia',serif;">{{companyName}}</div>
      </div>
    </div>

    <div style="text-align:center;padding:30px 0 12px;">
      <span style="font-size:32px;letter-spacing:0.15em;text-transform:uppercase;color:#A89080;font-weight:300;font-family:'Georgia',serif;">Project </span>
      <span style="font-size:32px;letter-spacing:0.15em;text-transform:uppercase;color:#3D2B1F;font-weight:600;font-family:'Georgia',serif;">Proposal</span>
    </div>
    <div style="width:60px;height:3px;background:#C4A882;margin:0 auto 32px;border-radius:2px;"></div>

    <!-- Project name -->
    <div style="margin-bottom:28px;background:#FAF6F0;padding:20px;border-radius:8px;border-left:4px solid #C4A882;">
      <h3 style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#8B7355;margin:0 0 8px;">Project name</h3>
      <p style="font-size:15px;color:#3D2B1F;margin:0;line-height:1.6;font-weight:500;">{{proposalTitle}}</p>
    </div>

    <!-- Description -->
    <div style="margin-bottom:28px;">
      <h3 style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#8B7355;margin:0 0 8px;">Description</h3>
      <p style="font-size:14px;color:#5C4A3A;margin:0;line-height:1.7;">{{introduction}}</p>
    </div>

    <!-- Image slot: after description -->
    <div id="slot-description" style="display:none;">
      <div onclick="document.getElementById('img-upload').click()"
           ondrop="handleDrop(event)" ondragover="event.preventDefault()"
           id="drop-description"
           style="border:2px dashed #C4A882;border-radius:12px;padding:40px;text-align:center;cursor:pointer;margin-bottom:28px;background:#FAF6F0;transition:all 0.3s ease;"
           onmouseover="this.style.background='#F0E8D8';this.style.borderColor='#A89080'" 
           onmouseout="this.style.background='#FAF6F0';this.style.borderColor='#C4A882'">
        <div style="font-size:32px;color:#C4A882;margin-bottom:8px;">🖼️</div>
        <div style="font-size:12px;color:#A89080;font-family:'Georgia',serif;">Click or drag & drop to add a project image</div>
      </div>
      <div id="preview-description" style="display:none;position:relative;margin-bottom:28px;">
        <img id="img-description" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px;display:block;box-shadow:0 4px 12px rgba(61,43,31,0.1);" />
        <button onclick="clearImage()" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.95);border:1px solid #C4A882;border-radius:6px;padding:6px 12px;font-size:11px;cursor:pointer;color:#5C4A3A;font-family:'Georgia',serif;box-shadow:0 2px 8px rgba(0,0,0,0.1);">✕ Remove</button>
      </div>
    </div>

    <!-- Scope of work -->
    <div style="margin-bottom:28px;">
      <h3 style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#8B7355;margin:0 0 8px;">Scope of work</h3>
      {{#if scope}}
        <p style="font-size:14px;color:#5C4A3A;margin:0;line-height:1.7;">{{scope}}</p>
      {{else}}
        <ul style="margin:0;padding:0;list-style:none;">
          {{#each objectives}}
          <li style="font-size:14px;color:#5C4A3A;padding:6px 0;line-height:1.7;border-bottom:1px dotted #E8DDD0;">
            <span style="color:#C4A882;margin-right:10px;font-size:16px;">◆</span>{{this}}
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
           style="border:2px dashed #C4A882;border-radius:12px;padding:40px;text-align:center;cursor:pointer;margin-bottom:28px;background:#FAF6F0;transition:all 0.3s ease;"
           onmouseover="this.style.background='#F0E8D8';this.style.borderColor='#A89080'" 
           onmouseout="this.style.background='#FAF6F0';this.style.borderColor='#C4A882'">
        <div style="font-size:32px;color:#C4A882;margin-bottom:8px;">🖼️</div>
        <div style="font-size:12px;color:#A89080;font-family:'Georgia',serif;">Click or drag & drop to add a project image</div>
      </div>
      <div id="preview-scope" style="display:none;position:relative;margin-bottom:28px;">
        <img id="img-scope" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px;display:block;box-shadow:0 4px 12px rgba(61,43,31,0.1);" />
        <button onclick="clearImage()" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.95);border:1px solid #C4A882;border-radius:6px;padding:6px 12px;font-size:11px;cursor:pointer;color:#5C4A3A;font-family:'Georgia',serif;box-shadow:0 2px 8px rgba(0,0,0,0.1);">✕ Remove</button>
      </div>
    </div>

    <!-- Deliverables -->
    <div style="margin-bottom:28px;">
      <h3 style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#8B7355;margin:0 0 8px;">Deliverables</h3>
      <ul style="margin:0;padding:0;list-style:none;">
        {{#each deliverables}}
        <li style="font-size:14px;color:#5C4A3A;padding:6px 0;line-height:1.7;border-bottom:1px dotted #E8DDD0;">
          <span style="color:#C4A882;margin-right:10px;font-size:16px;">◆</span>{{this}}
        </li>
        {{/each}}
      </ul>
    </div>

    <!-- Timeline -->
    <div style="margin-bottom:28px;">
      <h3 style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#8B7355;margin:0 0 8px;">Timeline</h3>
      <div style="background:#FAF6F0;padding:16px 20px;border-radius:8px;border-left:4px solid #C4A882;">
        <p style="font-size:14px;color:#5C4A3A;margin:0;line-height:1.7;">
          <span style="color:#C4A882;margin-right:10px;">📅</span>{{timeline}}
        </p>
      </div>
    </div>

    <!-- Investment -->
    <div style="margin-bottom:44px;">
      <h3 style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#8B7355;margin:0 0 8px;">Investment</h3>
      <div style="background:#3D2B1F;padding:24px;border-radius:12px;margin-bottom:12px;">
        <p style="font-size:24px;color:#F5F0E8;margin:0;font-weight:600;font-family:'Georgia',serif;">
          <span style="font-size:16px;color:#C4A882;vertical-align:top;">$</span>{{cost}}
        </p>
      </div>
      {{#if terms}}
      <p style="font-size:13px;color:#8B7355;margin:0;line-height:1.6;font-style:italic;">{{terms}}</p>
      {{/if}}
    </div>

  </div>

  <!-- Footer -->
  <div style="background:#3D2B1F;padding:32px 50px;display:flex;justify-content:space-between;align-items:center;border-radius:0 0 8px 8px;">
    <div>
      <div style="font-size:15px;font-weight:600;color:#F5F0E8;margin-bottom:8px;font-family:'Georgia',serif;">{{companyName}}</div>
      <div style="font-size:12px;color:#C4A882;line-height:1.8;">
        {{companyAddress}}<br>
        {{#if companyEmail}}{{companyEmail}}<br>{{/if}}
        {{#if companyPhone}}{{companyPhone}}{{/if}}
      </div>
    </div>
    <svg width="48" height="48" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:0.7">
      <circle cx="30" cy="30" r="24" stroke="#C4A882" stroke-width="1.5" fill="none"/>
      <path d="M30 12 L30 48" stroke="#C4A882" stroke-width="1" opacity="0.5"/>
      <path d="M12 30 L48 30" stroke="#C4A882" stroke-width="1" opacity="0.5"/>
      <circle cx="30" cy="30" r="8" stroke="#C4A882" stroke-width="1.5" fill="rgba(196,168,130,0.1)"/>
      <path d="M22 22 Q30 18 38 22" stroke="#C4A882" stroke-width="1" fill="none" opacity="0.6"/>
      <path d="M22 38 Q30 42 38 38" stroke="#C4A882" stroke-width="1" fill="none" opacity="0.6"/>
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
      if (btn) {
        if (p === pos) {
          btn.style.background = '#3D2B1F'; btn.style.color = '#F5F0E8'; btn.style.borderColor = '#3D2B1F';
        } else {
          btn.style.background = '#FAF6F0'; btn.style.color = '#5C4A3A'; btn.style.borderColor = '#C4A882';
        }
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
  font-family: 'Georgia', 'Times New Roman', serif;
  background:#F5F0E8;
  color:#3D2B1F;
  max-width:900px;
  margin:auto;
  padding:50px;
  box-shadow:0 4px 24px rgba(61,43,31,0.08);
  border-radius:4px;
">

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #C4A882;padding-bottom:30px;margin-bottom:10px;">
<div style="width:55%;">
<h1 style="font-size:56px;margin:0;font-weight:700;letter-spacing:1px;color:#3D2B1F;font-family:'Georgia',serif;">
{{#if invoiceNumber}}INVOICE{{else}}{{#if quotationNumber}}QUOTATION{{else}}PROPOSAL{{/if}}{{/if}}
</h1>
<div style="margin-top:25px;font-size:13px;">
<div style="display:flex;border-bottom:1px solid #D4C4B0;padding:10px 0;">
<div style="width:160px;font-weight:600;color:#8B7355;letter-spacing:0.05em;">NUMBER</div>
<div style="color:#3D2B1F;font-weight:500;">{{invoiceNumber}}{{quotationNumber}}{{proposalNumber}}</div>
</div>
<div style="display:flex;border-bottom:1px solid #D4C4B0;padding:10px 0;">
<div style="width:160px;font-weight:600;color:#8B7355;letter-spacing:0.05em;">DATE</div>
<div style="color:#3D2B1F;font-weight:500;">{{invoiceDate}}{{quotationDate}}{{proposalDate}}</div>
</div>
{{#if dueDate}}
<div style="display:flex;border-bottom:1px solid #D4C4B0;padding:10px 0;">
<div style="width:160px;font-weight:600;color:#8B7355;letter-spacing:0.05em;">DUE DATE</div>
<div style="color:#3D2B1F;font-weight:500;">{{dueDate}}</div>
</div>
{{/if}}
</div>
</div>
<div style="text-align:right;width:35%;">
<h2 style="margin:0;color:#3D2B1F;font-size:24px;font-family:'Georgia',serif;">{{companyName}}</h2>
<p style="margin:8px 0;color:#5C4A3A;font-size:13px;line-height:1.6;">{{companyAddress}}</p>
{{#if companyPhone}}<p style="color:#8B7355;font-size:13px;">{{companyPhone}}</p>{{/if}}
{{#if companyEmail}}<p style="color:#8B7355;font-size:13px;">{{companyEmail}}</p>{{/if}}
</div>
</div>

<!-- Customer -->
<div style="display:flex;justify-content:space-between;margin-top:40px;">
<div style="width:48%;background:#FAF6F0;border:1px solid #E8DDD0;padding:24px;border-radius:8px;">
<h3 style="margin-top:0;color:#8B7355;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">BILL TO</h3>
<p style="color:#3D2B1F;font-size:15px;font-weight:600;margin-bottom:4px;">{{clientName}}</p>
{{#if clientCompany}}<p style="color:#5C4A3A;font-size:13px;margin:4px 0;">{{clientCompany}}</p>{{/if}}
<p style="color:#5C4A3A;font-size:13px;line-height:1.6;">{{clientAddress}}</p>
<p style="color:#8B7355;font-size:13px;">{{clientEmail}}</p>
</div>
<div style="width:40%;padding:24px 0;">
<h3 style="color:#8B7355;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-top:0;">PAYABLE TO</h3>
<p style="color:#3D2B1F;font-size:15px;font-weight:600;margin-bottom:4px;">{{companyName}}</p>
<p style="color:#5C4A3A;font-size:13px;line-height:1.6;">{{companyAddress}}</p>
{{#if companyPhone}}<p style="color:#8B7355;font-size:13px;">{{companyPhone}}</p>{{/if}}
{{#if companyEmail}}<p style="color:#8B7355;font-size:13px;">{{companyEmail}}</p>{{/if}}
</div>
</div>

<!-- Table -->
<table style="width:100%;margin-top:40px;border-collapse:separate;border-spacing:0;font-size:13px;">
<thead>
<tr style="background:#3D2B1F;color:#F5F0E8;">
<th style="padding:14px 12px;text-align:center;border-radius:8px 0 0 0;font-weight:600;letter-spacing:0.05em;">NO.</th>
<th style="padding:14px 12px;text-align:left;font-weight:600;letter-spacing:0.05em;">ITEM DESCRIPTION</th>
<th style="padding:14px 12px;text-align:center;font-weight:600;letter-spacing:0.05em;">QTY</th>
<th style="padding:14px 12px;text-align:right;border-radius:0 8px 0 0;font-weight:600;letter-spacing:0.05em;">PRICE/ITEM</th>
</tr>
</thead>
<tbody>
{{#each items}}
<tr style="background:{{#if @index}}{{#if_odd @index}}#FAF6F0{{else}}#FFFFFF{{/if_odd}}{{else}}#FFFFFF{{/if}};">
<td style="border-bottom:1px solid #E8DDD0;padding:14px 12px;text-align:center;color:#5C4A3A;">{{inc @index}}</td>
<td style="border-bottom:1px solid #E8DDD0;padding:14px 12px;color:#3D2B1F;font-weight:500;">{{description}}</td>
<td style="border-bottom:1px solid #E8DDD0;padding:14px 12px;text-align:center;color:#5C4A3A;">{{quantity}}</td>
<td style="border-bottom:1px solid #E8DDD0;padding:14px 12px;text-align:right;color:#3D2B1F;font-weight:600;">$ {{unitPrice}}</td>
</tr>
{{/each}}
</tbody>
</table>

<!-- Totals -->
<div style="display:flex;justify-content:flex-end;margin-top:32px;">
<div style="width:340px;background:#FAF6F0;padding:24px;border-radius:8px;border:1px solid #E8DDD0;">
{{#if subtotal}}<div style="display:flex;justify-content:space-between;padding:8px 0;color:#5C4A3A;font-size:14px;"><span>Subtotal</span><span style="font-weight:500;">$ {{subtotal}}</span></div>{{/if}}
{{#if discount}}<div style="display:flex;justify-content:space-between;padding:8px 0;color:#5C4A3A;font-size:14px;"><span>Discount</span><span style="font-weight:500;">$ {{discount}}</span></div>{{/if}}
{{#if tax}}<div style="display:flex;justify-content:space-between;padding:8px 0;color:#5C4A3A;font-size:14px;"><span>Sales Tax</span><span style="font-weight:500;">$ {{tax}}</span></div>{{/if}}
<div style="display:flex;justify-content:space-between;padding:16px 0 0;margin-top:12px;border-top:2px solid #C4A882;font-size:22px;font-weight:700;color:#3D2B1F;font-family:'Georgia',serif;">
<span>TOTAL</span>
<span>$ {{total}}</span>
</div>
</div>
</div>

{{#if notes}}<div style="margin-top:40px;"><h3 style="color:#8B7355;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">NOTES</h3><p style="color:#5C4A3A;font-size:14px;line-height:1.7;">{{notes}}</p></div>{{/if}}
{{#if scope}}<div style="margin-top:40px;"><h3 style="color:#8B7355;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">SCOPE OF WORK</h3><p style="color:#5C4A3A;font-size:14px;line-height:1.7;">{{scope}}</p></div>{{/if}}

<!-- Signature -->
<div style="margin-top:60px;display:flex;justify-content:flex-end;">
<div style="width:280px;text-align:center;">
<div style="border-bottom:2px solid #C4A882;height:50px;margin-bottom:12px;"></div>
<div style="color:#8B7355;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Authorized Signature</div>
</div>
</div>

<!-- Footer -->
<div style="text-align:center;margin-top:60px;padding-top:30px;border-top:1px solid #E8DDD0;">
<div style="font-size:28px;font-weight:600;letter-spacing:0.05em;color:#3D2B1F;font-family:'Georgia',serif;margin-bottom:8px;">
Thank you for your business
</div>
<div style="width:40px;height:2px;background:#C4A882;margin:0 auto;"></div>
</div>
</div>
`;

// ─── Default HTML Template (Invoice / Quotation) ───────────────────────────────
const QUOTE_HTML_TEMPLATE = `
<div style="
  font-family: 'Georgia', 'Times New Roman', serif;
  background:#F5F0E8;
  color:#3D2B1F;
  max-width:900px;
  margin:auto;
  padding:50px;
  box-shadow:0 4px 24px rgba(61,43,31,0.08);
  border-radius:4px;
">

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #C4A882;padding-bottom:30px;margin-bottom:10px;">
<div style="width:55%;">
<h1 style="font-size:56px;margin:0;font-weight:700;letter-spacing:1px;color:#3D2B1F;font-family:'Georgia',serif;">
{{#if invoiceNumber}}INVOICE{{else}}{{#if quotationNumber}}QUOTATION{{else}}PROPOSAL{{/if}}{{/if}}
</h1>
<div style="margin-top:25px;font-size:13px;">
<div style="display:flex;border-bottom:1px solid #D4C4B0;padding:10px 0;">
<div style="width:160px;font-weight:600;color:#8B7355;letter-spacing:0.05em;">NUMBER</div>
<div style="color:#3D2B1F;font-weight:500;">{{invoiceNumber}}{{quotationNumber}}{{proposalNumber}}</div>
</div>
<div style="display:flex;border-bottom:1px solid #D4C4B0;padding:10px 0;">
<div style="width:160px;font-weight:600;color:#8B7355;letter-spacing:0.05em;">DATE</div>
<div style="color:#3D2B1F;font-weight:500;">{{invoiceDate}}{{quotationDate}}{{proposalDate}}</div>
</div>
{{#if dueDate}}
<div style="display:flex;border-bottom:1px solid #D4C4B0;padding:10px 0;">
<div style="width:160px;font-weight:600;color:#8B7355;letter-spacing:0.05em;">DUE DATE</div>
<div style="color:#3D2B1F;font-weight:500;">{{dueDate}}</div>
</div>
{{/if}}
</div>
</div>
<div style="text-align:right;width:35%;">
<h2 style="margin:0;color:#3D2B1F;font-size:24px;font-family:'Georgia',serif;">{{companyName}}</h2>
<p style="margin:8px 0;color:#5C4A3A;font-size:13px;line-height:1.6;">{{companyAddress}}</p>
{{#if companyPhone}}<p style="color:#8B7355;font-size:13px;">{{companyPhone}}</p>{{/if}}
{{#if companyEmail}}<p style="color:#8B7355;font-size:13px;">{{companyEmail}}</p>{{/if}}
</div>
</div>

<!-- Customer -->
<div style="display:flex;justify-content:space-between;margin-top:40px;">
<div style="width:48%;background:#FAF6F0;border:1px solid #E8DDD0;padding:24px;border-radius:8px;">
<h3 style="margin-top:0;color:#8B7355;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">BILL TO</h3>
<p style="color:#3D2B1F;font-size:15px;font-weight:600;margin-bottom:4px;">{{clientName}}</p>
{{#if clientCompany}}<p style="color:#5C4A3A;font-size:13px;margin:4px 0;">{{clientCompany}}</p>{{/if}}
<p style="color:#5C4A3A;font-size:13px;line-height:1.6;">{{clientAddress}}</p>
<p style="color:#8B7355;font-size:13px;">{{clientEmail}}</p>
</div>
<div style="width:40%;padding:24px 0;">
<h3 style="color:#8B7355;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-top:0;">PAYABLE TO</h3>
<p style="color:#3D2B1F;font-size:15px;font-weight:600;margin-bottom:4px;">{{companyName}}</p>
<p style="color:#5C4A3A;font-size:13px;line-height:1.6;">{{companyAddress}}</p>
{{#if companyPhone}}<p style="color:#8B7355;font-size:13px;">{{companyPhone}}</p>{{/if}}
{{#if companyEmail}}<p style="color:#8B7355;font-size:13px;">{{companyEmail}}</p>{{/if}}
</div>
</div>

<!-- Table -->
<table style="width:100%;margin-top:40px;border-collapse:separate;border-spacing:0;font-size:13px;">
<thead>
<tr style="background:#3D2B1F;color:#F5F0E8;">
<th style="padding:14px 12px;text-align:center;border-radius:8px 0 0 0;font-weight:600;letter-spacing:0.05em;">NO.</th>
<th style="padding:14px 12px;text-align:left;font-weight:600;letter-spacing:0.05em;">ITEM DESCRIPTION</th>
<th style="padding:14px 12px;text-align:center;font-weight:600;letter-spacing:0.05em;">QTY</th>
<th style="padding:14px 12px;text-align:right;border-radius:0 8px 0 0;font-weight:600;letter-spacing:0.05em;">PRICE/ITEM</th>
</tr>
</thead>
<tbody>
{{#each items}}
<tr style="background:{{#if @index}}{{#if_odd @index}}#FAF6F0{{else}}#FFFFFF{{/if_odd}}{{else}}#FFFFFF{{/if}};">
<td style="border-bottom:1px solid #E8DDD0;padding:14px 12px;text-align:center;color:#5C4A3A;">{{inc @index}}</td>
<td style="border-bottom:1px solid #E8DDD0;padding:14px 12px;color:#3D2B1F;font-weight:500;">{{description}}</td>
<td style="border-bottom:1px solid #E8DDD0;padding:14px 12px;text-align:center;color:#5C4A3A;">{{quantity}}</td>
<td style="border-bottom:1px solid #E8DDD0;padding:14px 12px;text-align:right;color:#3D2B1F;font-weight:600;">$ {{unitPrice}}</td>
</tr>
{{/each}}
</tbody>
</table>

<!-- Totals -->
<div style="display:flex;justify-content:flex-end;margin-top:32px;">
<div style="width:340px;background:#FAF6F0;padding:24px;border-radius:8px;border:1px solid #E8DDD0;">
{{#if subtotal}}<div style="display:flex;justify-content:space-between;padding:8px 0;color:#5C4A3A;font-size:14px;"><span>Subtotal</span><span style="font-weight:500;">$ {{subtotal}}</span></div>{{/if}}
{{#if discount}}<div style="display:flex;justify-content:space-between;padding:8px 0;color:#5C4A3A;font-size:14px;"><span>Discount</span><span style="font-weight:500;">$ {{discount}}</span></div>{{/if}}
{{#if tax}}<div style="display:flex;justify-content:space-between;padding:8px 0;color:#5C4A3A;font-size:14px;"><span>Sales Tax</span><span style="font-weight:500;">$ {{tax}}</span></div>{{/if}}
<div style="display:flex;justify-content:space-between;padding:16px 0 0;margin-top:12px;border-top:2px solid #C4A882;font-size:22px;font-weight:700;color:#3D2B1F;font-family:'Georgia',serif;">
<span>TOTAL</span>
<span>$ {{total}}</span>
</div>
</div>
</div>

{{#if notes}}<div style="margin-top:40px;"><h3 style="color:#8B7355;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">NOTES</h3><p style="color:#5C4A3A;font-size:14px;line-height:1.7;">{{notes}}</p></div>{{/if}}
{{#if scope}}<div style="margin-top:40px;"><h3 style="color:#8B7355;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">SCOPE OF WORK</h3><p style="color:#5C4A3A;font-size:14px;line-height:1.7;">{{scope}}</p></div>{{/if}}

<!-- Signature -->
<div style="margin-top:60px;display:flex;justify-content:flex-end;">
<div style="width:280px;text-align:center;">
<div style="border-bottom:2px solid #C4A882;height:50px;margin-bottom:12px;"></div>
<div style="color:#8B7355;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Authorized Signature</div>
</div>
</div>

<!-- Footer -->
<div style="text-align:center;margin-top:60px;padding-top:30px;border-top:1px solid #E8DDD0;">
<div style="font-size:28px;font-weight:600;letter-spacing:0.05em;color:#3D2B1F;font-family:'Georgia',serif;margin-bottom:8px;">
Thank you for your business
</div>
<div style="width:40px;height:2px;background:#C4A882;margin:0 auto;"></div>
</div>
</div>
`;

// ─── Template Cache ────────────────────────────────────────────────────────────
const templateCache = new Map<string, HandlebarsTemplateDelegate<any>>();

function compileTemplate(templateStr: string) {
  if (templateCache.has(templateStr)) {
    return templateCache.get(templateStr)!;
  }
  const compiled = Handlebars.compile(templateStr);
  templateCache.set(templateStr, compiled);
  return compiled;
}

// ─── Skill Prompts ─────────────────────────────────────────────────────────────
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
  "companyName": "Stone.tech",
  "companyAddress": "PnomPenh Cambodia"
}`,
};

// ─── Generate Document (HTML) ──────────────────────────────────────────────────
export async function generateDocument(
  input: GenerateDocumentInput,
): Promise<GenerateDocumentOutput> {
  try {
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

    const extractedJson = await extractDocumentData({
      userPrompt: input.userInput,
      templateType: input.templateType,
      skillContent,
      memoryContext: input.memoryContext,
      provider: input.llmProvider,
    });

    if (Array.isArray(extractedJson.items)) {
      extractedJson.items = extractedJson.items.map(
        (item: any, index: number) => ({ ...item, no: index + 1 }),
      );
    }

    let template: string;

    switch (input.templateType) {
      case "proposal":
        template = PROPOSAL_HTML_TEMPLATE;
        break;

      case "quotation":
        template = QUOTE_HTML_TEMPLATE;
        break;

      case "invoice":
      default:
        template = DEFAULT_HTML_TEMPLATE;
        break;
    }

    const compiled = compileTemplate(template);
    const html = compiled(extractedJson);

    const timestamp = new Date().toISOString().split("T")[0];
    const documentNumber =
      extractedJson.invoiceNumber ||
      extractedJson.quotationNumber ||
      extractedJson.proposalNumber ||
      "DOC";
    const fileName = `${input.templateType}_${documentNumber}_${timestamp}.html`;

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

// ─── PDF Helpers ───────────────────────────────────────────────────────────────
// Brand colours
const BLUE = "#233BCB";
const DARK = "#2d2d2d";
const MUTED = "#666666";
const LIGHT_GRAY = "#d4c9b8";
const FOOTER_BG: [number, number, number] = [90, 58, 58]; // #5a3a3a
const FOOTER_TEXT: [number, number, number] = [240, 212, 184]; // #f0d4b8
const FOOTER_SUB: [number, number, number] = [176, 144, 144]; // #b09090

const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Draw a horizontal rule */
function hRule(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  color = LIGHT_GRAY,
): void {
  doc
    .save()
    .strokeColor(color)
    .lineWidth(0.5)
    .moveTo(MARGIN, y)
    .lineTo(PAGE_W - MARGIN, y)
    .stroke()
    .restore();
}

/** Draw a section heading (small caps style) */
function sectionHeading(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  y: number,
): number {
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(DARK)
    .text(label.toUpperCase(), MARGIN, y, { characterSpacing: 1.5 });
  return doc.y + 4;
}

/** Wrap text and return new Y position */
function bodyText(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  y: number,
  options: Record<string, unknown> = {},
): number {
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(MUTED)
    .text(text, MARGIN, y, { width: CONTENT_W, lineGap: 3, ...options });
  return doc.y + 4;
}

/** Bullet list item */
function bulletItem(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  y: number,
): number {
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(LIGHT_GRAY)
    .text("—", MARGIN, y)
    .fillColor(MUTED)
    .text(text, MARGIN + 16, y, { width: CONTENT_W - 16, lineGap: 3 });
  return doc.y + 4;
}

// ─── generatePDF ───────────────────────────────────────────────────────────────
/**
 * Generates a PDF Buffer from the extracted JSON data.
 *
 * Install:  npm in stall pdfkit && npm install --save-dev @types/pdfkit
 *
 * Usage:
 *   const result = await generateDocument(input);
 *   const pdfBuffer = await generatePDF(result.json, result.json.templateType ?? "invoice");
 *   // Send as response:
 *   res.setHeader("Content-Type", "application/pdf");
 *   res.setHeader("Content-Disposition", `attachment; filename="${result.fileName.replace('.html','.pdf')}"`);
 *   res.send(pdfBuffer);
 */
export async function generatePDF(
  data: Record<string, any>,
  templateType: "invoice" | "quotation" | "proposal" = "invoice",
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      info: {
        Title:
          templateType === "invoice"
            ? `Invoice ${data.invoiceNumber ?? ""}`
            : templateType === "quotation"
              ? `Quotation ${data.quotationNumber ?? ""}`
              : `Proposal ${data.proposalNumber ?? ""}`,
        Author: data.companyName ?? "Your Company",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Dispatch to the correct renderer ──────────────────────────────────────
    if (templateType === "proposal") {
      renderProposalPDF(doc, data);
    } else {
      renderInvoiceQuotationPDF(doc, data, templateType);
    }

    doc.end();
  });
}

// ─── Invoice / Quotation PDF ───────────────────────────────────────────────────
function renderInvoiceQuotationPDF(
  doc: InstanceType<typeof PDFDocument>,
  data: Record<string, any>,
  type: "invoice" | "quotation",
): void {
  const docNumber =
    type === "invoice" ? data.invoiceNumber : data.quotationNumber;
  const docDate = type === "invoice" ? data.invoiceDate : data.quotationDate;
  const docLabel = type === "invoice" ? "INVOICE" : "QUOTATION";

  // ── Big title ──────────────────────────────────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(48)
    .fillColor(BLUE)
    .text(docLabel, MARGIN, MARGIN);

  // ── Meta table (left) ─────────────────────────────────────────────────────
  let y = MARGIN + 70;
  const metaRows = [
    ["NUMBER", docNumber ?? ""],
    ["DATE", docDate ?? ""],
    ...(data.dueDate ? [["DUE DATE", data.dueDate]] : []),
  ];
  for (const [label, value] of metaRows) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(BLUE)
      .text(label, MARGIN, y, { width: 140 });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(BLUE)
      .text(String(value), MARGIN + 150, y);
    y += 22;
    hRule(doc, y - 4, BLUE);
  }

  // ── Company info (right) ──────────────────────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(BLUE)
    .text(data.companyName ?? "", 0, MARGIN + 4, { align: "right" });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(BLUE)
    .text(
      [data.companyAddress, data.companyPhone, data.companyEmail]
        .filter(Boolean)
        .join("\n"),
      0,
      MARGIN + 26,
      { align: "right" },
    );

  y += 30;

  // ── Bill To / Payable To ──────────────────────────────────────────────────
  const colW = CONTENT_W / 2 - 10;

  // Bill To box
  doc.save().rect(MARGIN, y, colW, 90).stroke(BLUE).restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BLUE)
    .text("BILL TO", MARGIN + 12, y + 10);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BLUE)
    .text(data.clientName ?? "", MARGIN + 12, y + 26);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BLUE)
    .text(
      [data.clientAddress, data.clientEmail].filter(Boolean).join("\n"),
      MARGIN + 12,
      y + 40,
      { width: colW - 24 },
    );

  // Payable To
  const col2X = MARGIN + colW + 20;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BLUE)
    .text("PAYABLE TO", col2X, y + 10);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BLUE)
    .text(data.companyName ?? "", col2X, y + 26);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BLUE)
    .text(
      [data.companyAddress, data.companyPhone, data.companyEmail]
        .filter(Boolean)
        .join("\n"),
      col2X,
      y + 40,
      { width: colW },
    );

  y += 110;

  // ── Items table ───────────────────────────────────────────────────────────
  const cols = { no: 30, desc: 220, qty: 50, price: 70, total: 70 };
  const colX = {
    no: MARGIN,
    desc: MARGIN + cols.no + 5,
    qty: MARGIN + cols.no + cols.desc + 5,
    price: MARGIN + cols.no + cols.desc + cols.qty + 5,
    total: MARGIN + cols.no + cols.desc + cols.qty + cols.price + 5,
  };

  // Header row
  doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE);
  hRule(doc, y, BLUE);
  y += 6;
  doc.text("NO.", colX.no, y, { width: cols.no, align: "center" });
  doc.text("DESCRIPTION", colX.desc, y, { width: cols.desc });
  doc.text("QTY", colX.qty, y, { width: cols.qty, align: "center" });
  doc.text("PRICE", colX.price, y, { width: cols.price, align: "right" });
  doc.text("TOTAL", colX.total, y, { width: cols.total, align: "right" });
  y += 18;
  hRule(doc, y, BLUE);
  y += 8;

  // Data rows
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    doc.font("Helvetica").fontSize(9).fillColor(BLUE);
    doc.text(String(i + 1), colX.no, y, { width: cols.no, align: "center" });
    doc.text(item.description ?? "", colX.desc, y, { width: cols.desc });
    doc.text(String(item.quantity ?? 1), colX.qty, y, {
      width: cols.qty,
      align: "center",
    });
    doc.text(`$ ${item.unitPrice ?? 0}`, colX.price, y, {
      width: cols.price,
      align: "right",
    });
    doc.text(`$ ${item.amount ?? 0}`, colX.total, y, {
      width: cols.total,
      align: "right",
    });
    y += 20;
    hRule(doc, y - 4, BLUE);
  }

  y += 16;

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalsX = PAGE_W - MARGIN - 200;
  const totalsW = 200;

  if (data.subtotal != null) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(BLUE)
      .text("Subtotal", totalsX, y, { width: 100 });
    doc.text(`$ ${data.subtotal}`, totalsX + 100, y, {
      width: 100,
      align: "right",
    });
    y += 18;
  }
  if (data.tax != null && data.tax !== 0) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(BLUE)
      .text("Sales Tax", totalsX, y, { width: 100 });
    doc.text(`$ ${data.tax}`, totalsX + 100, y, { width: 100, align: "right" });
    y += 18;
  }

  hRule(doc, y, BLUE);
  y += 6;
  doc.font("Helvetica-Bold").fontSize(14).fillColor(BLUE);
  doc.text("TOTAL", totalsX, y, { width: 100 });
  doc.text(`$ ${data.total ?? 0}`, totalsX + 100, y, {
    width: 100,
    align: "right",
  });
  y += 30;

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (data.notes) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(BLUE)
      .text("NOTES", MARGIN, y);
    y += 14;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BLUE)
      .text(data.notes, MARGIN, y, { width: CONTENT_W });
    y += doc.currentLineHeight() + 20;
  }

  // ── Signature ─────────────────────────────────────────────────────────────
  y = Math.max(y, PAGE_H - 160);
  hRule(doc, y + 40, BLUE);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BLUE)
    .text("Authorized Signature", PAGE_W - MARGIN - 200, y + 46, {
      width: 200,
      align: "center",
    });

  // ── Footer ────────────────────────────────────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(BLUE)
    .text("THANK YOU FOR YOUR BUSINESS!", MARGIN, PAGE_H - 60, {
      width: CONTENT_W,
      align: "center",
    });
}

// ─── Proposal PDF ──────────────────────────────────────────────────────────────
function renderProposalPDF(
  doc: InstanceType<typeof PDFDocument>,
  data: Record<string, any>,
): void {
  let y = MARGIN;

  // ── Header: prepared for / by ──────────────────────────────────────────────
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#999999")
    .text("Prepared for", MARGIN, y);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(DARK)
    .text(data.clientName ?? "Client Name", MARGIN, y + 10);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#999999")
    .text("Prepared by", 0, y, { align: "right" });
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(DARK)
    .text(data.companyName ?? "Your Company", 0, y + 10, { align: "right" });

  // ── Title ─────────────────────────────────────────────────────────────────
  y += 50;
  doc
    .font("Helvetica")
    .fontSize(22)
    .fillColor("#999999")
    .text("Project ", MARGIN, y, { continued: true, characterSpacing: 2 });
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor(DARK)
    .text("Proposal", { characterSpacing: 2 });

  y = doc.y + 10;
  hRule(doc, y);
  y += 20;

  // ── Project name ──────────────────────────────────────────────────────────
  y = sectionHeading(doc, "Project Name", y);
  y = bodyText(doc, data.proposalTitle ?? "", y);
  y += 8;

  // ── Description ───────────────────────────────────────────────────────────
  y = sectionHeading(doc, "Description", y);
  y = bodyText(doc, data.introduction ?? "", y);
  y += 8;

  // ── Scope of work ─────────────────────────────────────────────────────────
  y = sectionHeading(doc, "Scope of Work", y);
  if (data.scope) {
    y = bodyText(doc, data.scope, y);
  } else if (Array.isArray(data.objectives)) {
    for (const obj of data.objectives) {
      y = bulletItem(doc, obj, y);
    }
  }
  y += 8;

  // ── Deliverables ──────────────────────────────────────────────────────────
  y = sectionHeading(doc, "Deliverables", y);
  if (Array.isArray(data.deliverables)) {
    for (const d of data.deliverables) {
      y = bulletItem(doc, d, y);
    }
  }
  y += 8;

  // ── Timeline ──────────────────────────────────────────────────────────────
  y = sectionHeading(doc, "Timeline", y);
  y = bulletItem(doc, data.timeline ?? "", y);
  y += 8;

  // ── Investment ────────────────────────────────────────────────────────────
  y = sectionHeading(doc, "Investment", y);
  y = bulletItem(
    doc,
    data.cost != null ? `$${data.cost.toLocaleString()}` : "",
    y,
  );
  if (data.terms) {
    y = bodyText(doc, data.terms, y);
  }

  // ── Footer band ───────────────────────────────────────────────────────────
  const footerY = PAGE_H - 100;
  doc.save().rect(0, footerY, PAGE_W, 100).fill(FOOTER_BG).restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(FOOTER_TEXT)
    .text(data.companyName ?? "", MARGIN, footerY + 18);

  const footerDetails = [
    data.companyAddress,
    data.companyEmail,
    data.companyPhone,
  ]
    .filter(Boolean)
    .join("   |   ");

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(FOOTER_SUB)
    .text(footerDetails, MARGIN, footerY + 36, { width: CONTENT_W - 60 });
}
