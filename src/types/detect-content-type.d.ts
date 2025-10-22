/**
 * SPDX-License-Identifier: MIT
 * Type definitions for detect-content-type library
 */

declare module 'detect-content-type' {
  /**
   * Detects the content type of a buffer
   * @param buffer The buffer to analyze
   * @returns The detected MIME type or null if not detected
   */
  function detectContentType(buffer: Buffer | Uint8Array): string | null;
  export = detectContentType;
}
