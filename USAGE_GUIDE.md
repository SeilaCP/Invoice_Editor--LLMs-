# Document Generator - Usage Guide

## Key Features

### 1. **Auto-Detect Template Type** (NEW!)
The app now intelligently detects the type of document you need based on your description.

#### Location
- **Header Button**: Blue "✨ Auto-Detect" button in the top-right corner
- **Status**: Enabled by default (blue = on, gray = off)

#### How to Use
1. Make sure "Auto-Detect" is enabled (blue button)
2. Type your document request in natural language:
   - For invoices: "Invoice for John Doe, $5000, due Dec 31"
   - For quotations: "Quotation for web design services, $2500"
   - For proposals: "Proposal for app development project, 6 months, $50000"
3. Press Enter or click the Send button
4. The AI will:
   - Detect the template type automatically
   - Show a confirmation: "📋 Auto-detected: [type]"
   - Generate your document

### 2. **Manual Template Selection**
Still want to choose manually? No problem!

#### How to Manually Select
1. Click the dropdown showing the current template type (e.g., "Invoice")
2. Choose from: Invoice, Quotation, or Proposal
3. Type your request in the message box
4. Send the message
5. The document will be generated with your chosen template

#### Toggle Auto-Detect Off
1. Click the "Auto-Detect" button to turn it off (becomes gray)
2. Now manual template selection is required for each request

### 3. **Document Preview & Download**
After generation, you get:

- **Preview**: HTML preview of your document
- **Download HTML**: Get the formatted document as an HTML file
- **Download JSON**: Get the extracted data as a JSON file

## Example Requests

### Invoice Detection
```
"Invoice for Sarah Johnson at Acme Corp, $2,500 for web development services, due January 31st"
```
✅ Auto-detects: **Invoice**

### Quotation Detection
```
"I need a quotation for 5 custom web pages at $500 each, valid for 30 days"
```
✅ Auto-detects: **Quotation**

### Proposal Detection
```
"Send a proposal to TechCorp for a mobile app project. Timeline: 6 months. Budget: $75,000. Include iOS and Android apps, backend API, and admin dashboard."
```
✅ Auto-detects: **Proposal**

## Settings

### LLM Provider
Located in the **Settings** panel (gear icon, top-right):

- **Google Gemini**: Fast and efficient (default)
- **OpenAI GPT-4**: Most capable
- **Anthropic Claude**: Best for complex reasoning

The selected provider is used for:
- Document data extraction
- Auto-detection of template type

### API Keys
You can optionally add API keys for each provider:
- Leave empty to use demo mode (limited features)
- Add your API key to use real AI generation

## Tips for Best Results

1. **Be Descriptive**: More details = better auto-detection
2. **Include Key Info**: Client name, amounts, dates, key services
3. **Use Clear Language**: Say what you need (invoice, quote, proposal, etc.)
4. **Leverage AI**: Don't worry about formatting—AI fills in missing data
5. **Manual Override**: If detection is wrong, just select the template manually

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift + Enter**: New line in text box
- **Escape**: Close any open menu

## Troubleshooting

### Auto-Detect Not Working?
- Make sure the button is blue (enabled)
- Try typing a longer description (>10 characters)
- Check that an LLM provider is selected

### Document Generation Failed?
- Check the error message for details
- Make sure your description is clear
- Try switching to a different LLM provider
- Enable Settings and add an API key if using demo mode limits

### Template Type Wrong?
- Click the dropdown to manually select the correct template
- Re-send the message with the manual selection
- Or improve your description to be clearer

## Document Types Explained

### Invoice
Use for **billing after work is done**:
- Client information
- Services/products provided
- Quantities and prices
- Payment terms and due date
- Example: "Invoice ABC Corp for $5,000 in consulting services"

### Quotation
Use for **providing price estimates**:
- What you're quoting (items/services)
- Unit prices
- Quantities
- Total estimate
- Validity period
- Example: "Quote 10 hours of web development at $100/hour"

### Proposal
Use for **project proposals with detailed terms**:
- Project scope and objectives
- Deliverables
- Timeline/milestones
- Budget breakdown
- Terms and conditions
- Example: "Propose a 3-month project to build a mobile app"

---

**Need help?** Try describing your document naturally—the AI will figure out the rest!
