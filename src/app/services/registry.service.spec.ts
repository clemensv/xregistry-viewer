import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RegistryService } from './registry.service';
import { ConfigService } from './config.service';
import { ModelService } from './model.service';
import { of, BehaviorSubject } from 'rxjs';

describe('RegistryService', () => {
  let service: RegistryService;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;
  let modelServiceSpy: jasmine.SpyObj<ModelService>;

  beforeEach(() => {
    configServiceSpy = jasmine.createSpyObj('ConfigService', ['getConfig'], {
      config$: of({ apiEndpoints: ['https://test-api.mcpxreg.org'], baseUrl: '/', defaultDocumentView: true, features: { enableFilters: true, enableSearch: true, enableDocDownload: true }, modelUris: [] })
    });
    configServiceSpy.getConfig.and.returnValue({ apiEndpoints: ['https://test-api.mcpxreg.org'], baseUrl: '/', defaultDocumentView: true, features: { enableFilters: true, enableSearch: true, enableDocDownload: true }, modelUris: [] });    modelServiceSpy = jasmine.createSpyObj('ModelService', ['getRegistryModel']);
    modelServiceSpy.getRegistryModel.and.returnValue(of({
      specversion: '1.0.0',
      registryid: 'test-registry',
      name: 'Test Registry',
      description: 'Test Registry for Unit Tests',
      capabilities: {
        apis: ['api1', 'api2'],
        schemas: ['schema1'],
        pagination: true
      },
      groups: {
        testGroup: {
          singular: 'testgroup',
          plural: 'testgroups',
          description: 'Test group',
          attributes: { name: { type: 'string' } },
          resources: {}
        }
      }
    }));

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        RegistryService,
        { provide: ConfigService, useValue: configServiceSpy },
        { provide: ModelService, useValue: modelServiceSpy }
      ]
    });
    service = TestBed.inject(RegistryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should use the API URL from config service', () => {
    expect(configServiceSpy.getConfig).toHaveBeenCalled();
  });
});
