import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// Cap extracted text to prevent DoS via enormous documents
const MAX_TEXT_LENGTH = 100_000; // 100 KB of text

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty file');
  }

  if (mimeType === 'application/pdf') {
    return extractTextFromPDF(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return extractTextFromDocx(buffer);
  }

  // Plain text fallback — still cap length
  return buffer.toString('utf-8').slice(0, MAX_TEXT_LENGTH);
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text.slice(0, MAX_TEXT_LENGTH);
  } catch {
    throw new Error('Failed to parse PDF document');
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.slice(0, MAX_TEXT_LENGTH);
  } catch {
    throw new Error('Failed to parse DOCX document');
  }
}
