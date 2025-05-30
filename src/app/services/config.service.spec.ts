import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';
import { environment } from '../../environments/environment';
import { PLATFORM_ID } from '@angular/core';

describe('ConfigService', () => {
  let service: ConfigService;
  let localStorageSpy: jasmine.SpyObj<Storage>;

  beforeEach(() => {
    // Create a spy for localStorage
    localStorageSpy = jasmine.createSpyObj('localStorage', ['getItem', 'setItem', 'removeItem']);

    // Mock the localStorage methods
    spyOn(localStorage, 'getItem').and.callFake(localStorageSpy.getItem);
    spyOn(localStorage, 'setItem').and.callFake(localStorageSpy.setItem);
    spyOn(localStorage, 'removeItem').and.callFake(localStorageSpy.removeItem);

    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        { provide: PLATFORM_ID, useValue: 'browser' } // Mock browser platform
      ]
    });
    service = TestBed.inject(ConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get the first apiEndpoint from config', () => {
    service['configSubject'].next({ apiEndpoints: ['https://test.com'], baseUrl: '/', defaultDocumentView: true, features: { enableFilters: true, enableSearch: true, enableDocDownload: true }, modelUris: [] });
    expect(service.getConfig()?.apiEndpoints?.[0]).toEqual('https://test.com');
  });

  it('should work correctly in server environment (SSR)', () => {
    // Create a new instance with server platform
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
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
