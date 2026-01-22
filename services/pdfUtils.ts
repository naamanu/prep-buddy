// PDF text extraction utilities using PDF.js
// Handles PDF file parsing and text content extraction for resume processing

import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error - Vite handles ?url imports, provides URL to worker file
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure PDF.js worker using bundled version (avoids CDN dependency)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PDFExtractionResult {
  success: boolean;
  text: string;
  pageCount: number;
  error?: string;
}

/**
 * Extracts text content from a PDF file.
 * Returns structured result with text, page count, and any errors.
 */
export async function extractTextFromPDF(file: File): Promise<PDFExtractionResult> {
  try {
    // Validate file type
    if (file.type !== 'application/pdf') {
      return {
        success: false,
        text: '',
        pageCount: 0,
        error: 'Invalid file type. Please upload a PDF file.',
      };
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pageCount = pdf.numPages;
    const textParts: string[] = [];

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine text items with proper spacing
      const pageText = textContent.items
        .map((item) => {
          if ('str' in item) {
            return item.str;
          }
          return '';
        })
        .join(' ');

      textParts.push(pageText);
    }

    const fullText = textParts.join('\n\n').trim();

    // Check for empty PDF (might be scanned image)
    if (!fullText) {
      return {
        success: false,
        text: '',
        pageCount,
        error:
          'No text could be extracted from this PDF. It may be a scanned image. Please paste your resume text instead.',
      };
    }

    return {
      success: true,
      text: fullText,
      pageCount,
    };
  } catch (error) {
    // Handle specific PDF.js errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('password')) {
      return {
        success: false,
        text: '',
        pageCount: 0,
        error: 'This PDF is password-protected. Please remove the password or paste your resume text instead.',
      };
    }

    if (errorMessage.includes('Invalid PDF')) {
      return {
        success: false,
        text: '',
        pageCount: 0,
        error: 'This file appears to be corrupted or not a valid PDF.',
      };
    }

    return {
      success: false,
      text: '',
      pageCount: 0,
      error: `Failed to extract text from PDF: ${errorMessage}`,
    };
  }
}

/**
 * Reads a plain text file and returns its contents.
 */
export async function extractTextFromTXT(file: File): Promise<PDFExtractionResult> {
  try {
    const text = await file.text();

    if (!text.trim()) {
      return {
        success: false,
        text: '',
        pageCount: 1,
        error: 'The file appears to be empty.',
      };
    }

    return {
      success: true,
      text: text.trim(),
      pageCount: 1,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      text: '',
      pageCount: 0,
      error: `Failed to read text file: ${errorMessage}`,
    };
  }
}

/**
 * Extracts text from a file based on its type.
 * Supports PDF and TXT files.
 */
export async function extractTextFromFile(file: File): Promise<PDFExtractionResult> {
  const fileName = file.name.toLowerCase();

  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
    return extractTextFromPDF(file);
  }

  if (
    file.type === 'text/plain' ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.text')
  ) {
    return extractTextFromTXT(file);
  }

  return {
    success: false,
    text: '',
    pageCount: 0,
    error: 'Unsupported file type. Please upload a PDF or TXT file, or paste your resume text directly.',
  };
}

/**
 * Validates and cleans pasted resume text.
 */
export function validatePastedText(text: string): PDFExtractionResult {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return {
      success: false,
      text: '',
      pageCount: 1,
      error: 'Please enter your resume text.',
    };
  }

  // Basic validation - resume should have reasonable length
  if (trimmedText.length < 50) {
    return {
      success: false,
      text: '',
      pageCount: 1,
      error: 'The text appears too short to be a resume. Please paste your complete resume.',
    };
  }

  return {
    success: true,
    text: trimmedText,
    pageCount: 1,
  };
}
