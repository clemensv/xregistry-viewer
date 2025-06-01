import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { RegistryService } from './registry.service';
import { ConfigService } from './config.service';
import { ModelService } from './model.service';
import { PLATFORM_ID } from '@angular/core';

describe('RegistryService', () => {
  let service: RegistryService;
  let configServiceSpy: jest.Mocked<ConfigService>;
  let modelServiceSpy: jest.Mocked<ModelService>;

  beforeEach(() => {
    const configMock = {
      getConfig: jest.fn().mockReturnValue({
        apiEndpoints: ['https://test-api.mcpxreg.org'],
        baseUrl: '/',
        defaultDocumentView: true,
        features: {
          enableFilters: true,
          enableSearch: true,
          enableDocDownload: true
        },
        modelUris: []
      }),
      config$: of({
        apiEndpoints: ['https://test-api.mcpxreg.org'],
        baseUrl: '/',
        defaultDocumentView: true,
        features: {
          enableFilters: true,
          enableSearch: true,
          enableDocDownload: true
        },
        modelUris: []
      })
    };

    const modelMock = {
      getRegistryModel: jest.fn()
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        RegistryService,
        { provide: ConfigService, useValue: configMock },
        { provide: ModelService, useValue: modelMock },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    service = TestBed.inject(RegistryService);
    configServiceSpy = TestBed.inject(ConfigService) as jest.Mocked<ConfigService>;
    modelServiceSpy = TestBed.inject(ModelService) as jest.Mocked<ModelService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should use the API URL from config service', () => {
    expect(configServiceSpy.getConfig).toHaveBeenCalled();
    expect(service).toBeTruthy();
  });
});
