import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ConfigService, AppConfig } from './config.service';
import { environment } from '../../environments/environment';
import { PLATFORM_ID } from '@angular/core';

describe('ConfigService', () => {
  let service: ConfigService;
  let httpMock: HttpTestingController;
  let localStorageSpy: jasmine.SpyObj<Storage>;

  const mockConfig: AppConfig = {
    apiEndpoints: ['https://api-test.example.com'],
    modelUris: ['https://model-test.example.com'],
    baseUrl: '/test-base-url/',
    defaultDocumentView: true,
    features: {
      enableFilters: true,
      enableSearch: true,
      enableDocDownload: true
    }
  };

  beforeEach(() => {
    // Create a spy for localStorage
    localStorageSpy = jasmine.createSpyObj('localStorage', ['getItem', 'setItem', 'removeItem']);

    // Mock the localStorage methods
    spyOn(localStorage, 'getItem').and.callFake(localStorageSpy.getItem);
    spyOn(localStorage, 'setItem').and.callFake(localStorageSpy.setItem);
    spyOn(localStorage, 'removeItem').and.callFake(localStorageSpy.removeItem);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ConfigService,
        { provide: PLATFORM_ID, useValue: 'browser' } // Mock browser platform
      ]
    });    service = TestBed.inject(ConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get the first apiEndpoint from config', () => {
    service['configSubject'].next({ apiEndpoints: ['https://test.com'], baseUrl: '/', defaultDocumentView: true, features: { enableFilters: true, enableSearch: true, enableDocDownload: true }, modelUris: [] });
    expect(service.getConfig()?.apiEndpoints?.[0]).toEqual('https://test.com');
  });

  it('should load config from JSON', fakeAsync(() => {
    const loadingSignal = service.loading;
    const errorSignal = service.error;
    
    expect(loadingSignal()).toBeFalse();
    
    const configPromise = service.loadConfigFromJson('/config.json');
    
    expect(loadingSignal()).toBeTrue();
    expect(errorSignal()).toBeNull();
    
    const req = httpMock.expectOne('/config.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockConfig);
    
    tick();
    
    expect(loadingSignal()).toBeFalse();
    expect(errorSignal()).toBeNull();
    
    configPromise.then(config => {
      expect(config).toEqual(jasmine.objectContaining(mockConfig));
      expect(service.getConfig()).toEqual(jasmine.objectContaining(mockConfig));
    });
  }));

  it('should handle config load error', fakeAsync(() => {
    const loadingSignal = service.loading;
    const errorSignal = service.error;
    
    const configPromise = service.loadConfigFromJson('/config.json');
    
    expect(loadingSignal()).toBeTrue();
    
    const req = httpMock.expectOne('/config.json');
    req.error(new ErrorEvent('Network error'));
    
    tick();
    
    expect(loadingSignal()).toBeFalse();
    expect(errorSignal()).not.toBeNull();
    
    configPromise.then(config => {
      // Should use default config on error
      expect(config).toBeTruthy();
      expect(config?.apiEndpoints).toContain(environment.apiBaseUrl);
    });
  }));

  it('should work correctly in server environment (SSR)', () => {
    // Create a new instance with server platform
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ConfigService,
        { provide: PLATFORM_ID, useValue: 'server' } // Mock server platform
      ]
    });

    // This should not throw an error despite localStorage not being available
    const serverService = TestBed.inject(ConfigService);
    expect(serverService).toBeTruthy();

    // These operations should not throw errors on server
    // serverService.setApiBaseUrl('https://valid-url.example.com');
    serverService.resetToDefault();

    // localStorage should not be called in server environment
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('should get the first apiEndpoint', () => {
    service['configSubject'].next({ apiEndpoints: ['https://test.com'], baseUrl: '/', defaultDocumentView: true, features: { enableFilters: true, enableSearch: true, enableDocDownload: true }, modelUris: [] });
    expect(service.getConfig()?.apiEndpoints?.[0]).toEqual('https://test.com');
  });
});
