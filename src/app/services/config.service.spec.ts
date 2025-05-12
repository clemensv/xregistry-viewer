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

  it('should initialize with default API URL from environment', () => {
    // When localStorage has no saved URL
    localStorage.getItem.and.returnValue(null);

    // Re-create service to trigger constructor
    service = TestBed.inject(ConfigService);

    expect(service.getApiBaseUrl()).toEqual(environment.apiBaseUrl);
  });

  it('should initialize with saved API URL from localStorage', () => {
    const savedUrl = 'https://test-api.example.com';
    localStorage.getItem.and.returnValue(savedUrl);

    // Re-create service to trigger constructor
    service = TestBed.inject(ConfigService);

    expect(service.getApiBaseUrl()).toEqual(savedUrl);
  });

  it('should update API URL and save to localStorage', () => {
    const newUrl = 'https://new-api.example.com';
    service.setApiBaseUrl(newUrl);

    expect(service.getApiBaseUrl()).toEqual(newUrl);
    expect(localStorage.setItem).toHaveBeenCalledWith('apiBaseUrl', newUrl);
  });

  it('should reset API URL to default and remove from localStorage', () => {
    service.resetToDefault();

    expect(service.getApiBaseUrl()).toEqual(environment.apiBaseUrl);
    expect(localStorage.removeItem).toHaveBeenCalledWith('apiBaseUrl');
  });
  it('should throw error for invalid URL format', () => {
    const invalidUrl = 'not-a-valid-url';

    expect(() => {
      service.setApiBaseUrl(invalidUrl);
    }).toThrow(new Error('Invalid URL format'));

    // localStorage should not be updated with invalid URL
    expect(localStorage.setItem).not.toHaveBeenCalled();
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
    serverService.setApiBaseUrl('https://valid-url.example.com');
    serverService.resetToDefault();

    // localStorage should not be called in server environment
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });
});
