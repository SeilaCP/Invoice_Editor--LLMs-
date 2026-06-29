/**
 * Demo/Mock LLM responses for testing without API keys
 * This allows users to test the full platform workflow
 */

export function generateMockInvoiceData(userInput: string) {
  // Parse user input for key information - more flexible patterns
  const clientNameMatch = userInput.match(/(?:for|to|client|bill to|invoice for)\s+([A-Za-z\s&]+?)(?:,|\s+\$|\s+amount|\.|$)/i);
  const amountMatch = userInput.match(/[\$](\d+(?:\.\d{2})?)|(\d+)\s*(?:dollars|usd|amount|cost|total|price)/i);
  const dueMatch = userInput.match(/(?:due|payment due|due date)\s+(?:on\s+)?([A-Za-z0-9\s,]+?)(?:\.|\s*$)/i);
  const companyMatch = userInput.match(/(?:Company|company name)\s*:\s*([A-Za-z0-9\s&,.]+?)(?:\.|\s*$)/i);
  const serviceMatch = userInput.match(/(?:for|service|item|product|work)\s+([A-Za-z0-9\s,\.&\-]+?)(?:,\s*\$|\s+\$|,\s+amount|$)/i);
  const quantityMatch = userInput.match(/(\d+)\s*x\s*|quantity\s*:\s*(\d+)/i);

  const clientName = clientNameMatch ? clientNameMatch[1].trim() : "Client Name";
  const amountStr = amountMatch ? (amountMatch[1] || amountMatch[2]) : "5000";
  const amount = parseFloat(amountStr) || 5000;
  const dueDate = dueMatch ? dueMatch[1].trim() : "2024-02-15";
  const companyName = companyMatch ? companyMatch[1].trim() : "Your Company";
  const service = serviceMatch ? serviceMatch[1].trim() : "Professional Services";
  const quantity = quantityMatch ? parseInt(quantityMatch[1] || quantityMatch[2]) : 1;

  const unitPrice = Math.round((amount / quantity) * 100) / 100;
  const subtotal = amount;
  const tax = Math.round(amount * 0.1 * 100) / 100;
  const total = subtotal + tax;

  return {
    clientName,
    clientEmail: `${clientName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    clientAddress: "123 Business St, New York, NY 10001",
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate,
    items: [
      {
        description: service,
        quantity,
        unitPrice,
        amount: Math.round(quantity * unitPrice * 100) / 100,
      },
    ],
    subtotal,
    tax,
    total,
    notes: "Thank you for your business! Payment is due by the due date. Please contact us if you have any questions.",
    companyName,
    companyAddress: "456 Business Ave, Suite 100, New York, NY 10002",
  };
}

export function generateMockQuotationData(userInput: string) {
  const clientNameMatch = userInput.match(/(?:for|to|client|quote for|quotation for)\s+([A-Za-z\s&]+?)(?:,|\s+\$|\s+amount|\.|$)/i);
  const amountMatch = userInput.match(/[\$](\d+(?:\.\d{2})?)|(\d+)\s*(?:dollars|usd|amount|cost|price)/i);
  const validMatch = userInput.match(/(?:valid|expires?|good)\s+(?:for|until|on)\s+([A-Za-z\s0-9,]+?)(?:\.|\s*$)/i);
  const companyMatch = userInput.match(/(?:Company|company name)\s*:\s*([A-Za-z0-9\s&,.]+?)(?:\.|\s*$)/i);
  const serviceMatch = userInput.match(/(?:for|service|work|project|design)\s+([A-Za-z0-9\s,\.&\-]+?)(?:,\s*\$|\s+\$|,\s+amount|$)/i);

  const clientName = clientNameMatch ? clientNameMatch[1].trim() : "Client Name";
  const amountStr = amountMatch ? (amountMatch[1] || amountMatch[2]) : "3500";
  const amount = parseFloat(amountStr) || 3500;
  const validUntil = validMatch ? validMatch[1].trim() : "2024-02-28";
  const companyName = companyMatch ? companyMatch[1].trim() : "Your Company";
  const service = serviceMatch ? serviceMatch[1].trim() : "Professional Services";

  const tax = Math.round(amount * 0.08 * 100) / 100;
  const total = amount + tax;

  return {
    clientName,
    clientEmail: `${clientName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    clientAddress: "789 Client Ave, Los Angeles, CA 90001",
    quotationNumber: `QT-${Date.now().toString().slice(-6)}`,
    quotationDate: new Date().toISOString().split('T')[0],
    validUntil,
    items: [
      {
        description: service,
        quantity: 1,
        unitPrice: amount,
        amount: amount,
      },
    ],
    subtotal: amount,
    tax,
    total,
    notes:
      "This quotation is valid until the date above. Please confirm acceptance to proceed. Standard payment terms: Net 30.",
    companyName,
    companyAddress: "456 Business Ave, Suite 100, New York, NY 10002",
  };
}

export function generateMockProposalData(userInput: string) {
  const clientNameMatch = userInput.match(/(?:for|to|client)\s+([A-Za-z\s&]+?)(?:,|\s+for|\s+to|\.|$)/i);
  const costMatch = userInput.match(/[\$](\d+(?:\.\d{2})?)|(\d+)\s*(?:dollars|usd|amount|cost|price|total)/i);
  const companyMatch = userInput.match(/(?:Company|company name)\s*:\s*([A-Za-z0-9\s&,.]+?)(?:\.|\s*$)/i);
  const projectMatch = userInput.match(/(?:project|proposal|development|app)\s+(?:for\s+)?([A-Za-z0-9\s\-&]+?)(?:,|\.|$)/i);
  const timelineMatch = userInput.match(/(?:timeline|duration|time|months?)\s+(?:of\s+)?(\d+)\s*(?:months?|weeks?|days?)/i);

  const clientName = clientNameMatch ? clientNameMatch[1].trim() : "Client Name";
  const costStr = costMatch ? (costMatch[1] || costMatch[2]) : "8000";
  const cost = parseFloat(costStr) || 8000;
  const companyName = companyMatch ? companyMatch[1].trim() : "Your Company";
  const projectTitle = projectMatch ? projectMatch[1].trim() : "Professional Services Project";
  const timelineValue = timelineMatch ? timelineMatch[1] : "12";
  const timelineUnit = userInput.match(/weeks?/i) ? "weeks" : "months";

  return {
    clientName,
    clientEmail: `${clientName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    clientAddress: "999 Enterprise Blvd, Chicago, IL 60601",
    proposalNumber: `PROP-${Date.now().toString().slice(-6)}`,
    proposalDate: new Date().toISOString().split('T')[0],
    proposalTitle: projectTitle,
    introduction: `We are pleased to submit this proposal for ${projectTitle}. Our team has extensive experience delivering high-quality solutions tailored to your specific needs.`,
    objectives: [
      "Deliver exceptional value and quality",
      "Meet all project deadlines",
      "Provide comprehensive support and documentation",
      "Ensure client satisfaction",
    ],
    scope: `Our proposal includes a comprehensive scope of work that covers all aspects of ${projectTitle.toLowerCase()}. We will work closely with your team to ensure all requirements are met and exceeded.`,
    deliverables: [
      "Complete project deliverables",
      "Comprehensive documentation",
      "Training and support materials",
      "Post-delivery support (30 days)",
    ],
    timeline: `${timelineValue} ${timelineUnit} from project start date`,
    cost,
    terms:
      "Payment Terms: 50% upfront, 50% upon completion. Acceptance of this proposal constitutes agreement to our standard terms and conditions.",
    notes: "We look forward to partnering with you on this exciting project. Please contact us if you have any questions or would like to discuss any aspect of this proposal.",
    companyName,
    companyAddress: "456 Business Ave, Suite 100, New York, NY 10002",
  };
}
