# AI Document Generator - Complete Features

## Overview
An intelligent document generation system that automatically creates professional invoices, quotations, and proposals from natural language descriptions. The system automatically detects the document type and fills in all data intelligently.

## Key Features

### 1. Auto-Detect Document Type
- **Smart Detection**: AI analyzes user input and automatically identifies the right document type
- **Keywords it recognizes**:
  - **Invoice**: "bill", "invoice", "payment due", "amount due", "paid"
  - **Quotation**: "quote", "estimate", "pricing", "how much", "cost"
  - **Proposal**: "proposal", "project", "bid", "scope", "timeline"
- **Fallback Heuristic**: If AI is unavailable, uses keyword-based detection
- **Toggle**: Users can disable auto-detect and manually select template

### 2. Intelligent Data Extraction
The system intelligently extracts and fills data from natural language input:

#### Invoice Example
```
Input: "Invoice for John Doe and Sam, 3 x $100 web development services, due Jan 31"

Extracts:
- clientName: "John Doe and Sam"
- quantity: 3
- unitPrice: $100
- service: "web development services"
- dueDate: "Jan 31"
- Calculates: subtotal=$300, tax=$30, total=$330
```

#### Quotation Example
```
Input: "Quote for ABC Corp, $2500 for UI/UX design, valid until Feb 28"

Extracts:
- clientName: "ABC Corp"
- amount: $2500
- service: "UI/UX design"
- validUntil: "Feb 28"
- Calculates: tax=$200, total=$2700
```

#### Proposal Example
```
Input: "Proposal for TechCorp, mobile app development, 6 months, $50000"

Extracts:
- clientName: "TechCorp"
- projectTitle: "mobile app development"
- timeline: "6 months"
- cost: $50000
- Auto-generates objectives, scope, deliverables
```

### 3. Dual Format Output

#### HTML Preview
- Professional, print-ready rendering
- Shows all document details nicely formatted
- Uses templates with company branding
- Includes line items, totals, and terms

#### JSON Data Export
- Structured data format
- Pretty-printed for readability
- Contains all extracted fields
- Easy to import into other systems

### 4. Download Options
- **Download HTML**: Get a ready-to-print HTML file
- **Download JSON**: Export structured data as JSON
- Both buttons visible on every generated document

### 5. Tab-Based Interface
- Switch between "Preview" (HTML) and "JSON Data" views
- Seamless tab switching
- All data visible in both formats

## Supported Input Formats

### Flexible Parsing
The system understands multiple ways to express the same information:

```
Amounts:
- "$500"
- "500 dollars"
- "amount $500"
- "500 USD"
- "cost: 500"

Quantities:
- "3 x $100"
- "quantity 3"
- "3 items at $100"

Dates:
- "due Jan 31"
- "due date January 31"
- "expires Feb 28"
- "valid until 2024-02-28"

Timelines:
- "6 months"
- "12 weeks"
- "3 months timeline"
```

## Generated Document Fields

### All Documents Include
- Client name and contact info
- Company name and address
- Document number (auto-generated)
- Document date
- Notes/terms section

### Invoice Specific
- Invoice number
- Invoice date
- Due date
- Line items (description, quantity, unit price, amount)
- Subtotal, tax (10%), total

### Quotation Specific
- Quotation number
- Quotation date
- Valid until date
- Line items
- Subtotal, tax (8%), total

### Proposal Specific
- Proposal number
- Proposal date
- Project title
- Introduction
- Objectives (auto-generated list)
- Scope of work
- Deliverables (auto-generated list)
- Timeline
- Cost
- Payment terms

## User Workflow

### Step 1: Enable Auto-Detect (Optional)
- Auto-Detect is ON by default
- Click the "Auto-Detect" button to toggle on/off

### Step 2: Describe Your Document
```
"Invoice for John Doe, $500 for web development, due Jan 31"
```

### Step 3: System Auto-Detects
- AI identifies it as an Invoice
- Shows: "📋 Auto-detected: invoice"
- Document type updates to show "Invoice"

### Step 4: View and Download
- Click "Preview" tab → see HTML rendering
- Click "JSON Data" tab → see structured JSON
- Click "Download HTML" → get .html file
- Click "Download JSON" → get .json file

## Technical Stack

- **Framework**: Next.js 16 (App Router)
- **AI**: Vercel AI Gateway (supports multiple providers)
- **Templating**: Handlebars
- **Database**: Mock database (built-in demo mode)
- **Styling**: Tailwind CSS + shadcn/ui

## Demo Mode
- Works without any API keys
- Uses intelligent parsing to fill data
- Perfect for testing and demonstrations
- All features fully functional

## API Providers (Optional)
- **Google Gemini** (default)
- **OpenAI GPT-4**
- **Anthropic Claude**

Set API keys in Settings → (gear icon) to enable real AI processing.

## Example Use Cases

1. **Freelancer**: Generate invoices from project descriptions
2. **Sales Team**: Create proposals from customer needs
3. **Admin**: Issue quotes quickly without manual data entry
4. **Automation**: Integrate JSON output into accounting systems
5. **Documentation**: Export standardized business documents

## Tips for Best Results

1. **Include key information**: client name, amount, date, service
2. **Be specific**: "Invoice for John Smith, $5000 for website redesign"
3. **Use natural language**: The system understands colloquial input
4. **Minimal but complete**: Even basic info gets auto-completed intelligently
5. **Numbers and dates**: Use clear formats: $500, Jan 31, 6 months

## Troubleshooting

### Data not filling?
- Check your input has: client name, amount, service
- More specific info → better extraction

### Want to change template?
- Click the document type dropdown
- Select Invoice, Quotation, or Proposal
- Auto-detect will turn off

### Need different format?
- Switch to JSON Data tab
- Download JSON and transform as needed

### Want to use real AI?
- Go to Settings (gear icon)
- Add API key for your preferred provider
- System will use real AI instead of heuristics
