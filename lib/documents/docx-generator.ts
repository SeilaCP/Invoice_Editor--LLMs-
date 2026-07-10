import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

/**
 * docxtemplater is configured to look for {{ }} delimited tags. Our upload
 * pipeline supports three placeholder syntaxes ({{x}}, ${x}, [x]) so that
 * templates authored with any of those styles are still detected. Before
 * rendering, we normalize any ${x}/[x] occurrences in the raw document XML
 * to {{x}} so docxtemplater can find and replace them too.
 *
 * This is a best-effort text-level substitution: it assumes placeholders are
 * not split across multiple XML runs (a reasonable assumption for most real
 * templates, since Word only splits runs when formatting changes mid-tag).
 * Placeholders using the native {{ }} syntax are unaffected.
 */
function normalizePlaceholderDelimiters(xml: string): string {
  return xml
    .replace(/\$\{\s*([^{}]+?)\s*\}/g, (_match, name) => `{{${name}}}`)
    .replace(/\[\s*([^\[\]]+?)\s*\]/g, (_match, name) => `{{${name}}}`);
}

export async function generateDocxFromTemplate(
  templateBase64: string,
  data: Record<string, any>,
): Promise<Buffer> {
  const templateBuffer = Buffer.from(templateBase64, "base64");
  const zip = new PizZip(templateBuffer);

  const documentXmlFile = zip.file("word/document.xml");
  if (documentXmlFile) {
    const normalizedXml = normalizePlaceholderDelimiters(
      documentXmlFile.asText(),
    );
    zip.file("word/document.xml", normalizedXml);
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: "{{",
      end: "}}",
    },
    // Render an empty string instead of throwing when a placeholder has no
    // matching value in `data` (e.g. the LLM couldn't confidently extract it).
    nullGetter: () => "",
  });

  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer" });
}
