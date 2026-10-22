/**
 * StudySynth Lite — Client-Side Offline Document & PDF Text Extractor
 * Extracts readable text streams from plain text, Markdown, and standard PDF bytes
 * using native browser streams and regex parsing without external CDNs or servers.
 */

(function (global) {
  'use strict';

  /**
   * Extract text from ArrayBuffer of a PDF file offline.
   * Parses standard PDF text markers (BT...ET, Tj, TJ) and handles uncompressed & deflate streams.
   */
  async function extractTextFromPDF(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const textDecoder = new TextDecoder('latin1');
    const pdfRaw = textDecoder.decode(bytes);

    const pagesText = [];
    let currentPage = 1;

    // Search for stream blocks
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match;

    while ((match = streamRegex.exec(pdfRaw)) !== null) {
      const streamContent = match[1];
      let extractedBlock = '';

      // Check if this stream has BT...ET text blocks
      if (streamContent.includes('BT') && streamContent.includes('ET')) {
        extractedBlock = parsePdfTextOperators(streamContent);
      }

      // Check if compressed with FlateDecode and decompress if browser supports DecompressionStream
      if (!extractedBlock && typeof DecompressionStream !== 'undefined') {
        try {
          const startIndex = match.index + match[0].indexOf(streamContent);
          const rawStreamBytes = bytes.subarray(startIndex, startIndex + streamContent.length);
          const decompressed = await decompressFlate(rawStreamBytes);
          if (decompressed && decompressed.includes('BT')) {
            extractedBlock = parsePdfTextOperators(decompressed);
          }
        } catch (e) {
          // Non-critical: some streams are image data or XObjects
        }
      }

      if (extractedBlock && extractedBlock.trim().length > 15) {
        pagesText.push(`==Page ${currentPage}==\n` + extractedBlock.trim());
        currentPage++;
      }
    }

    if (pagesText.length > 0) {
      return pagesText.join('\n\n');
    }

    // Fallback: extract any ASCII text sequences of length >= 4
    const textMatches = pdfRaw.match(/\(([^\(\)\\]{3,})\)\s*Tj/g);
    if (textMatches && textMatches.length > 5) {
      const simple = textMatches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' ');
      return `==Page 1==\n` + simple;
    }

    throw new Error('No selectable text streams found in PDF. Note: Pure scanned image PDFs require OCR.');
  }

  function parsePdfTextOperators(streamText) {
    const lines = [];
    // Match text blocks inside BT ... ET
    const btMatches = streamText.match(/BT[\s\S]*?ET/g);
    if (!btMatches) return '';

    for (const bt of btMatches) {
      // 1. Array text objects: [(part1) 12 (part2)] TJ
      const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
      let tjMatch;
      while ((tjMatch = tjArrayRegex.exec(bt)) !== null) {
        const parts = tjMatch[1].match(/\((.*?)\)/g);
        if (parts) {
          const joined = parts.map(p => p.slice(1, -1)).join('');
          if (joined.trim()) lines.push(cleanPdfEscape(joined));
        }
      }

      // 2. Simple text objects: (text) Tj or '
      const tjSingleRegex = /\((.*?)\)\s*(?:Tj|'|")/g;
      let sMatch;
      while ((sMatch = tjSingleRegex.exec(bt)) !== null) {
        const text = sMatch[1];
        if (text && text.trim()) lines.push(cleanPdfEscape(text));
      }
    }

    return lines.join(' ');
  }

  function cleanPdfEscape(s) {
    return s.replace(/\\([()\\])/g, '$1')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/\\t/g, ' ');
  }

  async function decompressFlate(uint8Array) {
    if (typeof DecompressionStream === 'undefined') return null;
    try {
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(uint8Array);
      writer.close();
      const response = new Response(ds.readable);
      const buffer = await response.arrayBuffer();
      return new TextDecoder('latin1').decode(new Uint8Array(buffer));
    } catch (e) {
      return null;
    }
  }

  /**
   * Unified file reader for File or Blob object (supports PDF, TXT, MD, and image photo OCR)
   */
  async function readFileContent(file, onProgress) {
    const name = file.name || 'document.txt';
    const ext = name.split('.').pop().toLowerCase();

    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      if (typeof window !== 'undefined' && window.LocalOCR) {
        const res = await window.LocalOCR.recognizeFile(file, onProgress);
        return res.text;
      } else {
        throw new Error('Local OCR module is not initialized.');
      }
    } else if (ext === 'pdf') {
      const buffer = await file.arrayBuffer();
      return extractTextFromPDF(buffer);
    } else {
      // TXT, Markdown, CSV, JSON
      return await file.text();
    }
  }

  const OfflineDocParser = {
    extractTextFromPDF,
    readFileContent
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineDocParser;
  }
  if (typeof window !== 'undefined') {
    window.OfflineDocParser = OfflineDocParser;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
