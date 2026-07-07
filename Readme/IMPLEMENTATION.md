# Auto-Detect Document Template Feature

## Overview
Added intelligent automatic template detection to the Document Generator. Users can now generate professional documents (invoices, quotations, proposals) by simply describing what they need in natural language—the AI automatically detects the correct template type.

## What's New

### 1. **Auto-Detection AI Function** (`lib/ai/index.ts`)
- **`detectTemplateType(userInput, provider?)`**: Uses AI to analyze user input and determine the most appropriate document template
- **`detectTemplateTypeHeuristic(userInput)`**: Fallback keyword-based detection for offline/error scenarios
- Supports all three LLM providers: Google Gemini, OpenAI, and Anthropic Claude

### 2. **Server Action** (`app/actions.ts`)
- **`detectTemplateTypeAction(userInput, provider?)`**: Server action that wraps the detection function for client-side calls
- Handles errors gracefully and falls back to heuristic detection

### 3. **Chat Dashboard Enhancement** (`components/chat-dashboard.tsx`)
- **Auto-Detect Toggle**: New button in the header to enable/disable automatic template detection (enabled by default)
- **Suggested Type Display**: Shows which template type was auto-detected with a sparkle icon indicator
- **Smart Workflow**:
  - When user sends a message with auto-detect enabled, the AI analyzes the text
  - Displays a confirmation message showing the detected document type
  - Generates the document with the correct template automatically
  - User can still manually select a different template if desired

### 4. **Detection Logic**
The AI uses intelligent analysis to categorize requests:
- **Invoice**: Billing documents after work completion. Keywords: "invoice", "bill", "payment", "amount due"
- **Quotation**: Price estimates before work. Keywords: "quote", "estimate", "pricing", "cost"
- **Proposal**: Detailed project proposals. Keywords: "proposal", "project", "bid", "scope", "timeline"

## User Experience

### How It Works
1. User enters a description of their document need (e.g., "I need a proposal for a mobile app project")
2. Click the Send button or press Enter
3. Auto-Detect (if enabled):
   - Analyzes the input text using AI
   - Automatically selects the appropriate template type
   - Shows a notification: "📋 Auto-detected: proposal. Generating your document..."
   - Generates the document
4. Document appears with preview and download options (HTML/JSON)

### Toggle Auto-Detect
- Click the **"Auto-Detect"** button in the header to turn automatic detection on/off
- When enabled: Shows in blue/accent color
- When disabled: Shows in muted color (manual template selection required)

### Manual Override
- Users can still manually select a template from the dropdown
- Manually selecting a template disables auto-detect for that message
- The selected template type is used instead of auto-detection

## Code Changes Summary

### Files Modified
1. **`lib/ai/index.ts`** (+61 lines)
   - Added `detectTemplateType()` AI function
   - Added `detectTemplateTypeHeuristic()` fallback function

2. **`app/actions.ts`** (+15 lines)
   - Added import for `detectTemplateType`
   - Added `detectTemplateTypeAction()` server action

3. **`components/chat-dashboard.tsx`** (+40 lines)
   - Added imports: `Sparkles` icon, `detectTemplateTypeAction`
   - Added state: `autoDetectEnabled`, `suggestedType`, `isDetecting`
   - Updated `handleSendMessage()` with auto-detection logic
   - Enhanced header UI with auto-detect toggle and suggested type display
   - Updated message handling to show detection status

## Benefits

✅ **Faster Document Creation**: No need to manually select template type  
✅ **Intelligent Categorization**: AI understands natural language requests  
✅ **User Friendly**: Clear visual feedback on detected type  
✅ **Flexible**: Toggle on/off or manually override anytime  
✅ **Resilient**: Falls back to keyword-based detection if AI fails  
✅ **Compatible**: Works with all three LLM providers  

## Testing

To test the auto-detection:
1. Enable auto-detect (should be on by default)
2. Type: "Create an invoice for John Doe, $5000, due Jan 31"
   - Expected: Detects "invoice"
3. Type: "I need a quotation for web design services, $2500"
   - Expected: Detects "quotation"
4. Type: "Write a proposal for an app development project, 6 months, $50000"
   - Expected: Detects "proposal"

## Future Enhancements

- Add more document types (contracts, agreements, etc.)
- Store detection preferences per user
- Improve detection accuracy with fine-tuning
- Add multilingual support
- Create custom templates for different industries
