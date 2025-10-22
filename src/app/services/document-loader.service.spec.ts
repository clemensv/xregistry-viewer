/**
 * SPDX-License-Identifier: MIT
 * Unit tests for DocumentLoaderService
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DocumentLoaderService, ContentResult } from './document-loader.service';
import * as fileType from 'file-type';

describe('DocumentLoaderService', () => {
  let service: DocumentLoaderService;
  let httpMock: HttpTestingController;
  let mockFileTypeFromBuffer: jest.SpyInstance;

  // Test data - magic numbers for different file types
  const testData = {
    pngBytes: new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]),
    jpegBytes: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]),
    gifBytes: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]),
    pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A]),
    zipBytes: new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]),
    textBytes: new Uint8Array(Array.from('Hello, World!', c => c.charCodeAt(0))),
    jsonBytes: new Uint8Array(Array.from('{"key": "value"}', c => c.charCodeAt(0))),
    xmlBytes: new Uint8Array(Array.from('<?xml version="1.0"?><root></root>', c => c.charCodeAt(0))),
    htmlBytes: new Uint8Array(Array.from('<!DOCTYPE html><html></html>', c => c.charCodeAt(0))),
    csvBytes: new Uint8Array(Array.from('name,age,city\nJohn,30,NYC\nJane,25,LA', c => c.charCodeAt(0)))
  };

  // Mock URL methods for Node.js environment
  const mockBlobUrls = new Set<string>();
  let blobUrlCounter = 0;
  beforeEach(() => {
    // Mock the file-type library
    mockFileTypeFromBuffer = jest.spyOn(fileType, 'fileTypeFromBuffer').mockImplementation();

    // Mock URL.createObjectURL and URL.revokeObjectURL
    if (typeof URL.createObjectURL === 'undefined') {
      (global as any).URL = {
        createObjectURL: jest.fn(() => {
          const url = `blob:mock-${++blobUrlCounter}`;
          mockBlobUrls.add(url);
          return url;
        }),
        revokeObjectURL: jest.fn((url: string) => {
          mockBlobUrls.delete(url);
        })
      };
    } else {
      // If URL already exists, just mock the methods
      jest.spyOn(URL, 'createObjectURL').mockImplementation(() => {
        const url = `blob:mock-${++blobUrlCounter}`;
        mockBlobUrls.add(url);
        return url;
      });
      jest.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
        mockBlobUrls.delete(url);
      });
    }

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DocumentLoaderService]
    });

    service = TestBed.inject(DocumentLoaderService);
    httpMock = TestBed.inject(HttpTestingController);

    // Reset mocks
    mockFileTypeFromBuffer.mockReset();
  });

  afterEach(() => {
    httpMock.verify();
    jest.restoreAllMocks();
    mockBlobUrls.clear();
    blobUrlCounter = 0;
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should start with zero active blob URLs', () => {
      expect(service.getActiveBlobUrlCount()).toBe(0);
    });
  });

  describe('Content Type Detection with file-type library', () => {
    it('should detect PNG images using file-type library', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });

      const mimeType = await service.detectContentType(testData.pngBytes.buffer);
      expect(mimeType).toBe('image/png');
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(testData.pngBytes);
    });

    it('should detect JPEG images using file-type library', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'jpg', mime: 'image/jpeg' });

      const mimeType = await service.detectContentType(testData.jpegBytes.buffer);
      expect(mimeType).toBe('image/jpeg');
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(testData.jpegBytes);
    });

    it('should detect GIF images using file-type library', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'gif', mime: 'image/gif' });

      const mimeType = await service.detectContentType(testData.gifBytes.buffer);
      expect(mimeType).toBe('image/gif');
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(testData.gifBytes);
    });

    it('should detect PDF documents using file-type library', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });

      const mimeType = await service.detectContentType(testData.pdfBytes.buffer);
      expect(mimeType).toBe('application/pdf');
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(testData.pdfBytes);
    });

    it('should detect ZIP archives using file-type library', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'zip', mime: 'application/zip' });

      const mimeType = await service.detectContentType(testData.zipBytes.buffer);
      expect(mimeType).toBe('application/zip');
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(testData.zipBytes);
    });

    it('should fallback to text detection when file-type returns undefined', async () => {
      mockFileTypeFromBuffer.mockResolvedValue(undefined);

      const mimeType = await service.detectContentType(testData.jsonBytes.buffer);
      expect(mimeType).toBe('application/json');
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(testData.jsonBytes);
    });

    it('should handle file-type library errors gracefully', async () => {
      mockFileTypeFromBuffer.mockRejectedValue(new Error('file-type error'));

      const mimeType = await service.detectContentType(testData.textBytes.buffer);
      expect(mimeType).toBe('text/plain');
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(testData.textBytes);
    });

    it('should return octet-stream for unknown binary content', async () => {
      mockFileTypeFromBuffer.mockResolvedValue(undefined);
      const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x80, 0x81, 0x82, 0x83]);

      const mimeType = await service.detectContentType(unknownBytes.buffer);
      expect(mimeType).toBe('application/octet-stream');
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(unknownBytes);
    });

    it('should handle empty byte arrays', async () => {
      mockFileTypeFromBuffer.mockResolvedValue(undefined);
      const emptyBytes = new Uint8Array([]);

      const mimeType = await service.detectContentType(emptyBytes.buffer);
      expect(mimeType).toBe('application/octet-stream');
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(emptyBytes);
    });
  });

  describe('Text Content Type Detection', () => {
    beforeEach(() => {
      // Set up file-type to return undefined for text content
      mockFileTypeFromBuffer.mockResolvedValue(undefined);
    });

    it('should detect JSON content', async () => {
      const mimeType = await service.detectContentType(testData.jsonBytes.buffer);
      expect(mimeType).toBe('application/json');
    });

    it('should detect XML content', async () => {
      const mimeType = await service.detectContentType(testData.xmlBytes.buffer);
      expect(mimeType).toBe('application/xml');
    });

    it('should detect HTML content', async () => {
      const mimeType = await service.detectContentType(testData.htmlBytes.buffer);
      expect(mimeType).toBe('text/html');
    });

    it('should detect CSV content', async () => {
      const mimeType = await service.detectContentType(testData.csvBytes.buffer);
      expect(mimeType).toBe('text/csv');
    });

    it('should detect plain text content', async () => {
      const mimeType = await service.detectContentType(testData.textBytes.buffer);
      expect(mimeType).toBe('text/plain');
    });

    it('should prefer file-type detection over text detection for binary that looks like text', async () => {
      // Create bytes that look like JSON but have a PNG signature
      const pngWithJsonBytes = new Uint8Array([...testData.pngBytes, ...testData.jsonBytes]);
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });

      const mimeType = await service.detectContentType(pngWithJsonBytes.buffer);
      expect(mimeType).toBe('image/png');
    });
  });

  describe('Content Type Helpers', () => {
    it('should correctly identify binary content types', () => {
      expect(service.isBinaryContentType('image/png')).toBe(true);
      expect(service.isBinaryContentType('application/pdf')).toBe(true);
      expect(service.isBinaryContentType('application/zip')).toBe(true);
      expect(service.isBinaryContentType('text/plain')).toBe(false);
      expect(service.isBinaryContentType('application/json')).toBe(false);
      expect(service.isBinaryContentType('application/xml')).toBe(false);
    });

    it('should correctly identify image content types', () => {
      expect(service.isImageContentType('image/png')).toBe(true);
      expect(service.isImageContentType('image/jpeg')).toBe(true);
      expect(service.isImageContentType('image/gif')).toBe(true);
      expect(service.isImageContentType('application/pdf')).toBe(false);
      expect(service.isImageContentType('text/plain')).toBe(false);
    });
  });

  describe('URL Processing', () => {
    it('should process documentation URL with explicit content-type', (done) => {
      mockFileTypeFromBuffer.mockResolvedValue(undefined);

      service.processDocumentationUrl('https://example.com/image.png').subscribe({
        next: (result: ContentResult) => {
          expect(result.url).toMatch(/^blob:mock-\d+$/);
          expect(result.mimeType).toBe('image/png');
          expect(result.isBlob).toBe(true);
          expect(service.getActiveBlobUrlCount()).toBe(1);
          done();
        },
        error: done.fail
      });

      const req = httpMock.expectOne('https://example.com/image.png');
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('arraybuffer');

      req.flush(testData.pngBytes.buffer, {
        headers: { 'content-type': 'image/png' }
      });
    });

    it('should process documentation URL with content-type detection', (done) => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });

      service.processDocumentationUrl('https://example.com/document').subscribe({
        next: (result: ContentResult) => {
          expect(result.url).toMatch(/^blob:mock-\d+$/);
          expect(result.mimeType).toBe('application/pdf');
          expect(result.isBlob).toBe(true);
          expect(service.getActiveBlobUrlCount()).toBe(1);
          done();
        },
        error: done.fail
      });

      const req = httpMock.expectOne('https://example.com/document');
      req.flush(testData.pdfBytes.buffer, {
        headers: { 'content-type': 'application/octet-stream' }
      });
    });

    it('should process text content from URL as data URL', (done) => {
      mockFileTypeFromBuffer.mockResolvedValue(undefined);

      service.processDocumentationUrl('https://example.com/data.json').subscribe({
        next: (result: ContentResult) => {
          expect(result.url).toMatch(/^data:application\/json;base64,/);
          expect(result.mimeType).toBe('application/json');
          expect(result.isBlob).toBe(false);
          expect(service.getActiveBlobUrlCount()).toBe(0);
          done();
        },
        error: done.fail
      });

      const req = httpMock.expectOne('https://example.com/data.json');
      req.flush(testData.jsonBytes.buffer, {
        headers: { 'content-type': 'application/json' }
      });
    });

    it('should handle HTTP errors gracefully', (done) => {
      service.processDocumentationUrl('https://example.com/notfound').subscribe({
        next: () => done.fail('Should have thrown an error'),
        error: (error) => {
          expect(error.message).toContain('Failed to fetch content from https://example.com/notfound');
          done();
        }
      });

      const req = httpMock.expectOne('https://example.com/notfound');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    });

    it('should handle empty response', (done) => {
      service.processDocumentationUrl('https://example.com/empty').subscribe({
        next: () => done.fail('Should have thrown an error'),
        error: (error) => {
          expect(error.message).toBe('No content received from URL');
          done();
        }
      });

      const req = httpMock.expectOne('https://example.com/empty');
      req.flush(null);
    });
  });

  describe('Base64 Processing', () => {
    beforeEach(() => {
      mockFileTypeFromBuffer.mockResolvedValue(undefined);
    });

    it('should process base64 content without data URL prefix', (done) => {
      const base64 = btoa(String.fromCharCode(...testData.pngBytes));
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });

      service.processBase64Content(base64).subscribe({
        next: (result: ContentResult) => {
          expect(result.url).toMatch(/^blob:mock-\d+$/);
          expect(result.mimeType).toBe('image/png');
          expect(result.isBlob).toBe(true);
          expect(service.getActiveBlobUrlCount()).toBe(1);
          done();
        },
        error: done.fail
      });
    });

    it('should process data URL with MIME type', (done) => {
      const base64 = btoa(String.fromCharCode(...testData.pdfBytes));
      const dataUrl = `data:application/pdf;base64,${base64}`;

      service.processBase64Content(dataUrl).subscribe({
        next: (result: ContentResult) => {
          expect(result.url).toMatch(/^blob:mock-\d+$/);
          expect(result.mimeType).toBe('application/pdf');
          expect(result.isBlob).toBe(true);
          expect(service.getActiveBlobUrlCount()).toBe(1);
          done();
        },
        error: done.fail
      });
    });

    it('should process data URL with text content', (done) => {
      const base64 = btoa(String.fromCharCode(...testData.jsonBytes));
      const dataUrl = `data:application/json;base64,${base64}`;

      service.processBase64Content(dataUrl).subscribe({
        next: (result: ContentResult) => {
          expect(result.url).toMatch(/^data:application\/json;base64,/);
          expect(result.mimeType).toBe('application/json');
          expect(result.isBlob).toBe(false);
          expect(service.getActiveBlobUrlCount()).toBe(0);
          done();
        },
        error: done.fail
      });
    });

    it('should handle URL-encoded data URLs', (done) => {
      const textData = 'Hello, World! Special chars: <>&"';
      const urlEncoded = encodeURIComponent(textData);
      const dataUrl = `data:text/plain,${urlEncoded}`;

      service.processBase64Content(dataUrl).subscribe({
        next: (result: ContentResult) => {
          expect(result.url).toMatch(/^data:text\/plain;base64,/);
          expect(result.mimeType).toBe('text/plain');
          expect(result.isBlob).toBe(false);

          // Decode the base64 to verify content
          const base64Part = result.url.split(',')[1];
          const decoded = atob(base64Part);
          expect(decoded).toBe(textData);
          done();
        },
        error: done.fail
      });
    });

    it('should detect MIME type from content when not provided in data URL', (done) => {
      const base64 = btoa(String.fromCharCode(...testData.pngBytes));
      const dataUrl = `data:;base64,${base64}`;
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });

      service.processBase64Content(dataUrl).subscribe({
        next: (result: ContentResult) => {
          expect(result.mimeType).toBe('image/png');
          done();
        },
        error: done.fail
      });
    });

    it('should handle invalid base64 data', (done) => {
      const invalidBase64 = 'invalid!!!base64!!!data';

      service.processBase64Content(invalidBase64).subscribe({
        next: () => done.fail('Should have thrown an error'),
        error: (error) => {
          expect(error.message).toContain('Failed to process base64 content');
          done();
        }
      });
    });

    it('should handle invalid data URL format', (done) => {
      const invalidDataUrl = 'data:invalid format';

      service.processBase64Content(invalidDataUrl).subscribe({
        next: () => done.fail('Should have thrown an error'),
        error: (error) => {
          expect(error.message).toContain('Invalid data URL format');
          done();
        }
      });
    });
  });

  describe('Blob URL Management', () => {
    beforeEach(() => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });
    });

    it('should track and cleanup individual blob URLs', (done) => {
      const base64 = btoa(String.fromCharCode(...testData.pngBytes));

      service.processBase64Content(base64).subscribe({
        next: (result: ContentResult) => {
          expect(service.getActiveBlobUrlCount()).toBe(1);

          service.cleanupBlobUrl(result.url);
          expect(service.getActiveBlobUrlCount()).toBe(0);
          done();
        },
        error: done.fail
      });
    });

    it('should cleanup all blob URLs at once', (done) => {
      const base64 = btoa(String.fromCharCode(...testData.pngBytes));

      // Create multiple blob URLs
      const observables = [
        service.processBase64Content(base64),
        service.processBase64Content(base64),
        service.processBase64Content(base64)
      ];

      Promise.all(observables.map(obs => obs.toPromise())).then(() => {
        expect(service.getActiveBlobUrlCount()).toBe(3);

        service.cleanupAllBlobUrls();
        expect(service.getActiveBlobUrlCount()).toBe(0);
        done();
      }).catch(done.fail);
    });

    it('should not fail when cleaning up non-existent blob URL', () => {
      expect(() => service.cleanupBlobUrl('blob:non-existent-url')).not.toThrow();
      expect(service.getActiveBlobUrlCount()).toBe(0);
    });

    it('should not fail when cleaning up all blob URLs when none exist', () => {
      expect(() => service.cleanupAllBlobUrls()).not.toThrow();
      expect(service.getActiveBlobUrlCount()).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very small files', async () => {
      mockFileTypeFromBuffer.mockResolvedValue(undefined);
      const smallBytes = new Uint8Array([0x41]); // Single 'A' character

      const mimeType = await service.detectContentType(smallBytes.buffer);
      expect(mimeType).toBe('text/plain');
    });

    it('should handle large files (memory efficiency)', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'bin', mime: 'application/octet-stream' });
      // Create a 1MB array
      const largeBytes = new Uint8Array(1024 * 1024);
      largeBytes.fill(0x42);

      const mimeType = await service.detectContentType(largeBytes.buffer);
      expect(mimeType).toBe('application/octet-stream');
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(largeBytes);
    });

    it('should handle files with BOM markers', async () => {
      mockFileTypeFromBuffer.mockResolvedValue(undefined);
      // UTF-8 BOM + JSON content
      const bomJsonBytes = new Uint8Array([0xEF, 0xBB, 0xBF, ...testData.jsonBytes]);

      const mimeType = await service.detectContentType(bomJsonBytes.buffer);
      expect(mimeType).toBe('application/json');
    });

    it('should handle mixed content (binary + text)', async () => {
      // Set PNG signature at the beginning
      const mixedBytes = new Uint8Array([...testData.pngBytes, ...testData.jsonBytes]);
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });

      const mimeType = await service.detectContentType(mixedBytes.buffer);
      expect(mimeType).toBe('image/png');
    });
  });
});
