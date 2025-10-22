/**
 * SPDX-License-Identifier: MIT
 * DocumentLoaderService - Comprehensive binary content processing service
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { fileTypeFromBuffer } from 'file-type';

/**
 * Result interface for content processing operations
 */
export interface ContentResult {
  /** The URL to access the content (data URL or blob URL) */
  url: string;
  /** The detected or provided MIME type */
  mimeType: string;
  /** Whether this is a blob URL that needs cleanup */
  isBlob: boolean;
}

/**
 * DocumentLoaderService handles MIME type detection, binary content processing,
 * and blob URL management for displaying various file types in the browser.
 *
 * Features:
 * - MIME type detection from binary data using the file-type library
 * - Base64 to binary conversion
 * - Blob URL creation and memory management
 * - Support for images, PDFs, and other binary file formats
 */
@Injectable({ providedIn: 'root' })
export class DocumentLoaderService {
  private readonly http = inject(HttpClient);
  private readonly blobUrls = new Set<string>();

  /**
   * Processes content from a URL, handling both text and binary content
   * @param url The URL to fetch content from
   * @returns Observable of ContentResult
   */
  processDocumentationUrl(url: string): Observable<ContentResult> {
    return this.http.get(url, {
      responseType: 'arraybuffer',
      observe: 'response'
    }).pipe(
      switchMap(response => {
        const arrayBuffer = response.body;
        if (!arrayBuffer) {
          return throwError(() => new Error('No content received from URL'));
        }        // Get MIME type from response headers or detect from content
        let mimeType = response.headers.get('content-type') || '';
        if (mimeType) {
          // Clean up MIME type (remove charset, etc.)
          mimeType = mimeType.split(';')[0].trim();
        }        if (!mimeType || mimeType === 'application/octet-stream') {
          return from(this.detectContentType(arrayBuffer)).pipe(
            switchMap(detectedType => {
              mimeType = detectedType;
              return from(this.createContentResult(arrayBuffer, mimeType));
            })
          );
        }

        return from(this.createContentResult(arrayBuffer, mimeType));
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching documentation URL:', error);
        return throwError(() => new Error(`Failed to fetch content from ${url}: ${error.message}`));
      })
    );
  }  /**
   * Processes base64-encoded content
   * @param base64 The base64-encoded content (with or without data URL prefix)
   * @returns Observable of ContentResult
   */
  processBase64Content(base64: string): Observable<ContentResult> {
    return from(this.processBase64ContentSync(base64));
  }  /**
   * Synchronously processes base64-encoded content
   * @param base64 The base64-encoded content
   * @returns Promise of ContentResult
   */
  private async processBase64ContentSync(base64: string): Promise<ContentResult> {
    try {
      let mimeType = '';
      let base64Data = base64;

      // Handle data URLs
      if (base64.startsWith('data:')) {
        const dataUrlMatch = base64.match(/^data:([^;]+)(;base64)?,(.+)$/);
        if (dataUrlMatch) {
          mimeType = dataUrlMatch[1] || '';
          const isBase64 = !!dataUrlMatch[2];
          base64Data = dataUrlMatch[3];

          if (!isBase64) {
            // Handle URL-encoded data
            base64Data = btoa(decodeURIComponent(base64Data));
          }
        } else {
          throw new Error('Invalid data URL format');
        }
      }

      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const uint8Array = new Uint8Array(arrayBuffer);

      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }      // Detect MIME type if not provided or is generic
      if (!mimeType || mimeType === 'application/octet-stream') {
        mimeType = await this.detectContentType(arrayBuffer);
      }

      return this.createContentResult(arrayBuffer, mimeType);
    } catch (error) {
      throw new Error(`Failed to process base64 content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates a ContentResult from ArrayBuffer and MIME type
   * @param arrayBuffer The content as ArrayBuffer
   * @param mimeType The MIME type
   * @returns Promise of ContentResult
   */  private async createContentResult(arrayBuffer: ArrayBuffer, mimeType: string): Promise<ContentResult> {
    if (this.isBinaryContentType(mimeType)) {
      // Create blob URL for binary content
      const blob = new Blob([arrayBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      this.blobUrls.add(url);

      return {
        url,
        mimeType,
        isBlob: true
      };
    } else {
      // Create data URL for text content
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = btoa(String.fromCharCode(...uint8Array));
      const url = `data:${mimeType};base64,${base64}`;

      return {
        url,
        mimeType,
        isBlob: false
      };
    }
  }
  /**
   * Detects content type from ArrayBuffer using the file-type library
   * @param arrayBuffer The content to analyze
   * @returns Promise resolving to the detected MIME type
   */
  async detectContentType(arrayBuffer: ArrayBuffer): Promise<string> {
    const uint8Array = new Uint8Array(arrayBuffer);

    try {
      // Use file-type library for binary content detection
      const fileType = await fileTypeFromBuffer(uint8Array);
      if (fileType) {
        return fileType.mime;
      }
    } catch (error) {
      console.warn('Error detecting file type:', error);
    }

    // Try to detect text content
    if (this.isLikelyTextContent(uint8Array)) {
      return this.detectTextContentType(uint8Array);
    }

    // Default to binary
    return 'application/octet-stream';
  }

  /**
   * Checks if content is likely text-based
   * @param bytes The byte array to check
   * @returns True if content appears to be text
   */
  private isLikelyTextContent(bytes: Uint8Array): boolean {
    if (bytes.length === 0) return false;

    // Check first 512 bytes for text indicators
    const sampleSize = Math.min(bytes.length, 512);
    const sample = bytes.slice(0, sampleSize);

    let printableCount = 0;
    let controlCount = 0;

    for (const byte of sample) {
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        printableCount++;
      } else if (byte < 32) {
        controlCount++;
      }
    }

    // Consider it text if most characters are printable
    const printableRatio = printableCount / sampleSize;
    const controlRatio = controlCount / sampleSize;

    return printableRatio > 0.7 && controlRatio < 0.3;
  }

  /**
   * Detects specific text content types
   * @param bytes The byte array
   * @returns The detected text MIME type
   */
  private detectTextContentType(bytes: Uint8Array): string {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(bytes.slice(0, Math.min(bytes.length, 1024))).toLowerCase();

    // Check for specific text formats
    if (text.includes('<?xml') || text.includes('<xml')) {
      return 'application/xml';
    }
    if (text.includes('<!doctype html') || text.includes('<html')) {
      return 'text/html';
    }
    if (text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) {
      try {
        JSON.parse(text);
        return 'application/json';
      } catch {
        // Not valid JSON
      }
    }
    if (text.includes('function') || text.includes('var ') || text.includes('const ') || text.includes('let ')) {
      return 'application/javascript';
    }
    if (text.includes('#include') || text.includes('int main') || text.includes('public class')) {
      return 'text/x-c'; // Generic code
    }

    // Check for CSV (simple heuristic)
    const lines = text.split('\n').slice(0, 5);
    if (lines.length > 1 && lines.every(line => line.includes(',') || line.includes(';'))) {
      return 'text/csv';
    }

    return 'text/plain';
  }

  /**
   * Checks if a MIME type represents binary content
   * @param mimeType The MIME type to check
   * @returns True if the content type is binary
   */
  isBinaryContentType(mimeType: string): boolean {
    const textTypes = [
      'text/',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/x-javascript',
      'application/xhtml+xml'
    ];

    return !textTypes.some(type => mimeType.startsWith(type));
  }

  /**
   * Checks if a MIME type represents image content
   * @param mimeType The MIME type to check
   * @returns True if the content type is an image
   */
  isImageContentType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Cleans up a specific blob URL
   * @param url The blob URL to clean up
   */
  cleanupBlobUrl(url: string): void {
    if (this.blobUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.blobUrls.delete(url);
    }
  }

  /**
   * Cleans up all managed blob URLs
   */
  cleanupAllBlobUrls(): void {
    for (const url of this.blobUrls) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls.clear();
  }

  /**
   * Gets the number of currently managed blob URLs (for debugging/monitoring)
   * @returns The number of active blob URLs
   */
  getActiveBlobUrlCount(): number {
    return this.blobUrls.size;
  }
}
