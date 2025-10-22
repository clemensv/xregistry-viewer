/**
 * Mock for file-type ESM package
 * Used in Jest tests to avoid ESM import issues
 */

export interface FileTypeResult {
  ext: string;
  mime: string;
}

/**
 * Mock implementation of fileTypeFromBuffer
 * Returns a promise that resolves to a FileTypeResult or undefined
 */
export async function fileTypeFromBuffer(
  buffer: ArrayBuffer | Uint8Array
): Promise<FileTypeResult | undefined> {
  // Simple mock implementation
  // In tests, this can be further mocked with jest.mock() if needed
  const arr = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  
  // Check for common file signatures
  if (arr.length >= 4) {
    // PNG signature
    if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
      return { ext: 'png', mime: 'image/png' };
    }
    // JPEG signature
    if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
      return { ext: 'jpg', mime: 'image/jpeg' };
    }
    // GIF signature
    if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46) {
      return { ext: 'gif', mime: 'image/gif' };
    }
    // PDF signature
    if (arr[0] === 0x25 && arr[1] === 0x50 && arr[2] === 0x44 && arr[3] === 0x46) {
      return { ext: 'pdf', mime: 'application/pdf' };
    }
  }
  
  // Unknown or text file
  return undefined;
}
