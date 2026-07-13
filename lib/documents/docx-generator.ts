import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

function normalizePlaceholderDelimiters(xml: string): string {
  return xml
    .replace(/\$\{\s*([^{}]+?)\s*\}/g, (_match, name) => `[${name}]`)
    .replace(/\[\s*([^\[\]]+?)\s*\]/g, (_match, name) => `[${name}]`);
}

function normalizePlaceholderKey(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}


function normalizePlaceholderTagNames(xml: string): string {
  return xml.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, name) => {
    return `[${normalizePlaceholderKey(name)}]`;
  });
}

function normalizeRenderData(data: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    normalized[normalizePlaceholderKey(key)] = value;
  }
  return normalized;
}

export async function generateDocxFromTemplate(
  templateBase64: string,
  data: Record<string, any>,
): Promise<Buffer> {
  const templateBuffer = Buffer.from(templateBase64, "base64");
  const zip = new PizZip(templateBuffer);

  const wordXmlFiles = zip.file(/^word\/.*\.xml$/);
  for (const file of wordXmlFiles) {
    const xml = file.asText();
    const normalizedXml = normalizePlaceholderTagNames(
      normalizePlaceholderDelimiters(xml),
    );
    zip.file(file.name, normalizedXml);
  }

  const normalizedData = normalizeRenderData(data);
  const allTagNames = new Set<string>();
  for (const file of wordXmlFiles) {
    const normalizedXml = zip.file(file.name)?.asText() || "";
    const tagPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(normalizedXml)) !== null) {
      allTagNames.add(match[1].trim());
    }
  }

  const renderKeys = Object.keys(normalizedData);
  const matchedKeys = renderKeys.filter((key) => allTagNames.has(key));
  console.log("[docx] placeholder render stats:", {
    templateTagCount: allTagNames.size,
    renderKeyCount: renderKeys.length,
    matchedKeyCount: matchedKeys.length,
    sampleTemplateTags: Array.from(allTagNames).slice(0, 20),
    sampleRenderKeys: renderKeys.slice(0, 20),
    sampleMatchedKeys: matchedKeys.slice(0, 20),
  });

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: "[",
      end: "]",
    },
    nullGetter: () => "",
  });

  doc.render(normalizedData);
  return doc.getZip().generate({ type: "nodebuffer" });
}
