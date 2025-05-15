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
  let apiBaseUrlSubject: BehaviorSubject<string>;

  beforeEach(() => {
    apiBaseUrlSubject = new BehaviorSubject<string>('https://test-api.mcpxreg.org');
    
    configServiceSpy = jasmine.createSpyObj('ConfigService', ['getApiBaseUrl'], {
      apiBaseUrl$: apiBaseUrlSubject.asObservable()
    });
    configServiceSpy.getApiBaseUrl.and.returnValue('https://test-api.mcpxreg.org');

    modelServiceSpy = jasmine.createSpyObj('ModelService', ['getRegistryModel']);
    modelServiceSpy.getRegistryModel.and.returnValue(of({
      groups: {
        testGroup: {
          singular: 'testgroup',
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
    expect(configServiceSpy.getApiBaseUrl).toHaveBeenCalled();
  });
});
