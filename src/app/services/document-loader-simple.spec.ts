/**
 * SPDX-License-Identifier: MIT
 * Unit tests for DocumentLoaderService
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DocumentLoaderService, ContentResult } from './document-loader.service';

describe('DocumentLoaderService', () => {
  let service: DocumentLoaderService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DocumentLoaderService]
    });

    service = TestBed.inject(DocumentLoaderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with zero active blob URLs', () => {
    expect(service.getActiveBlobUrlCount()).toBe(0);
  });
});
