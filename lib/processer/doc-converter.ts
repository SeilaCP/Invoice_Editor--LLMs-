/**
 * Legacy .doc -> .docx conversion via LibreOffice headless (soffice).
 *
 * This requires LibreOffice to be installed on the host running this code
 * (the `soffice` binary must be reachable). It will NOT work on typical
 * serverless hosting without a custom layer/container that bundles LibreOffice.
 * If LibreOffice isn't available, this throws a clear, user-facing error so
 * callers can surface it instead of failing silently.
 */
import libreConvert from "libreoffice-convert";
import { promisify } from "util";

const convertAsync = promisify(libreConvert.convert);

export class LibreOfficeUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      "Converting .doc files requires LibreOffice (soffice) to be installed on the server. " +
        "It was not found in this environment, so .doc uploads cannot be processed here. " +
        "Please upload a .docx file instead, or install LibreOffice on the deployment host.",
    );
    this.name = "LibreOfficeUnavailableError";
    if (cause) this.cause = cause as Error;
  }
}

export async function convertDocToDocx(docBuffer: Buffer): Promise<Buffer> {
  try {
    const docxBuffer = await convertAsync(docBuffer, ".docx", undefined);
    return Buffer.from(docxBuffer as Buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const looksLikeMissingBinary = /soffice|ENOENT|not found|spawn/i.test(
      message,
    );
    if (looksLikeMissingBinary) {
      throw new LibreOfficeUnavailableError(error);
    }
    throw error;
  }
}
