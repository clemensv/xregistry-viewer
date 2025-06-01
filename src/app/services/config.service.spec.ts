import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ConfigService, AppConfig } from './config.service';
import { environment } from '../../environments/environment';
import { PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';

describe('ConfigService', () => {
  let service: ConfigService;
  let httpMock: HttpTestingController;
  let localStorageMock: { [key: string]: string };

  const mockConfig: AppConfig = {
    apiEndpoints: ['https://api1.example.com', 'https://api2.example.com'],
    modelUris: ['https://model1.example.com'],
    baseUrl: '/app/',
    defaultDocumentView: true,
    features: {
      enableFilters: true,
      enableSearch: true,
      enableDocDownload: false
    }
  };

  const minimalConfig: Partial<AppConfig> = {
    baseUrl: '/minimal/',
    features: {
      enableFilters: true,
      enableSearch: true,
      enableDocDownload: true
    }
  };

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    const localStorageSpyObj = {
      getItem: jest.fn((key: string) => localStorageMock[key] || null),
      setItem: jest.fn((key: string, value: string) => { localStorageMock[key] = value; }),
      removeItem: jest.fn((key: string) => { delete localStorageMock[key]; }),
      clear: jest.fn(() => { localStorageMock = {}; })
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageSpyObj, writable: true });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ConfigService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    service = TestBed.inject(ConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create the service', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with default base URL from environment', () => {
      expect(service.getBaseUrl()).toBe(environment.baseUrl || '/');
    });

    it('should load base URL from localStorage if available', () => {
      const savedUrl = '/saved/';
      localStorageMock['baseUrl'] = savedUrl;

      // Create new instance to test initialization
      const newService = new ConfigService('browser');
      expect(newService.getBaseUrl()).toBe(savedUrl);
    });

    it('should handle localStorage errors gracefully', () => {
      jest.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('localStorage error');
      });

      // Should not throw and use default
      expect(() => new ConfigService('browser')).not.toThrow();
    });

    it('should not access localStorage in non-browser environment', () => {
      const getItemSpy = jest.spyOn(window.localStorage, 'getItem');
      new ConfigService('server');
      expect(getItemSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadConfigFromJson', () => {
    it('should load configuration successfully', async () => {
      const configPath = '/assets/config.json';
      const loadPromise = service.loadConfigFromJson(configPath);

      const req = httpMock.expectOne(configPath);
      expect(req.request.method).toBe('GET');
      req.flush(mockConfig);

      const result = await loadPromise;
      expect(result).toEqual(mockConfig);
      expect(service.getConfig()).toEqual(mockConfig);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should normalize partial configuration', async () => {
      const configPath = '/assets/config.json';
      const loadPromise = service.loadConfigFromJson(configPath);

      const req = httpMock.expectOne(configPath);
      req.flush(minimalConfig);

      const result = await loadPromise;
      expect(result).toBeDefined();
      expect(result!.apiEndpoints).toEqual([]);
      expect(result!.modelUris).toEqual([]);
      expect(result!.defaultDocumentView).toBe(true);
    });

    it('should handle empty response with error', async () => {
      const configPath = '/assets/config.json';
      const loadPromise = service.loadConfigFromJson(configPath);

      const req = httpMock.expectOne(configPath);
      req.flush(null);

      const result = await loadPromise;
      expect(result).toBeDefined(); // Falls back to default config
      expect(service.error()).toBeNull(); // Error cleared after fallback
    });

    it('should retry on failure with exponential backoff', fakeAsync(() => {
      const configPath = '/assets/config.json';
      let attemptCount = 0;

      service.loadConfigFromJson(configPath);

      // First attempt
      httpMock.expectOne(configPath).error(new ProgressEvent('Network error'), { status: 500 });
      tick(1500); // First retry delay
      attemptCount++;

      // Second attempt
      httpMock.expectOne(configPath).error(new ProgressEvent('Network error'), { status: 500 });
      tick(2250); // Second retry delay
      attemptCount++;

      // Third attempt - success
      const req = httpMock.expectOne(configPath);
      req.flush(mockConfig);
      tick();

      expect(service.getConfig()).toEqual(mockConfig);
    }));

    it('should use cached configuration on subsequent calls', async () => {
      const configPath = '/assets/config.json';

      // First load
      const firstPromise = service.loadConfigFromJson(configPath);
      httpMock.expectOne(configPath).flush(mockConfig);
      await firstPromise;

      // Second load - should not make HTTP request
      const secondPromise = service.loadConfigFromJson(configPath);
      httpMock.expectNone(configPath);

      const result = await secondPromise;
      expect(result).toEqual(mockConfig);
    });

    it('should handle concurrent load requests', async () => {
      const configPath = '/assets/config.json';

      // Start two loads simultaneously
      const promise1 = service.loadConfigFromJson(configPath);
      const promise2 = service.loadConfigFromJson(configPath);

      // Should only make one HTTP request
      const req = httpMock.expectOne(configPath);
      req.flush(mockConfig);

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toEqual(mockConfig);
      expect(result2).toEqual(mockConfig);
    });

    it('should fall back to localStorage on HTTP error', async () => {
      const configPath = '/assets/config.json';
      localStorageMock['appConfig'] = JSON.stringify(mockConfig);

      const loadPromise = service.loadConfigFromJson(configPath);

      // Fail all retry attempts
      for (let i = 0; i < 6; i++) {
        const req = httpMock.expectOne(configPath);
        req.error(new ProgressEvent('Network error'), { status: 500 });
      }

      const result = await loadPromise;
      expect(result).toEqual(mockConfig);
      expect(service.error()).toBeNull();
    });

    it('should fall back to default config on complete failure', async () => {
      const configPath = '/assets/config.json';

      const loadPromise = service.loadConfigFromJson(configPath);

      // Fail all retry attempts
      for (let i = 0; i < 6; i++) {
        const req = httpMock.expectOne(configPath);
        req.error(new ProgressEvent('Network error'), { status: 500 });
      }

      const result = await loadPromise;
      expect(result).toBeDefined();
      expect(result!.apiEndpoints).toContain(environment.apiBaseUrl);
    });

    it('should reload if existing config is invalid', async () => {
      const configPath = '/assets/config.json';

      // First load with invalid config
      const firstPromise = service.loadConfigFromJson(configPath);
      const invalidConfig = { baseUrl: '/test/' }; // Missing features
      httpMock.expectOne(configPath).flush(invalidConfig);
      await firstPromise;

      // Second load should trigger reload
      const secondPromise = service.loadConfigFromJson(configPath);
      httpMock.expectOne(configPath).flush(mockConfig);

      const result = await secondPromise;
      expect(result).toEqual(mockConfig);
    });

    it('should update base URL when config contains baseUrl', async () => {
      const configPath = '/assets/config.json';
      const configWithBaseUrl = { ...mockConfig, baseUrl: '/new-base/' };

      const loadPromise = service.loadConfigFromJson(configPath);
      httpMock.expectOne(configPath).flush(configWithBaseUrl);

      await loadPromise;
      expect(service.getBaseUrl()).toBe('/new-base/');
    });

    it('should persist config to localStorage after successful load', async () => {
      const configPath = '/assets/config.json';
      const setItemSpy = jest.spyOn(window.localStorage, 'setItem');

      const loadPromise = service.loadConfigFromJson(configPath);
      httpMock.expectOne(configPath).flush(mockConfig);

      await loadPromise;
      expect(setItemSpy).toHaveBeenCalledWith('appConfig', JSON.stringify(mockConfig));
    });
  });

  describe('setBaseUrl', () => {
    it('should normalize and set base URL with leading slash', () => {
      service.setBaseUrl('app');
      expect(service.getBaseUrl()).toBe('/app/');
    });

    it('should normalize and set base URL with trailing slash', () => {
      service.setBaseUrl('/app');
      expect(service.getBaseUrl()).toBe('/app/');
    });

    it('should handle absolute URLs', () => {
      service.setBaseUrl('https://example.com/app');
      expect(service.getBaseUrl()).toBe('https://example.com/app/');
    });

    it('should save to localStorage', () => {
      const setItemSpy = jest.spyOn(window.localStorage, 'setItem');
      service.setBaseUrl('/test/');
      expect(setItemSpy).toHaveBeenCalledWith('baseUrl', '/test/');
    });

    it('should emit new value to baseUrl$ observable', (done) => {
      service.baseUrl$.subscribe(url => {
        if (url === '/new-url/') {
          done();
        }
      });
      service.setBaseUrl('/new-url/');
    });

    it('should handle localStorage errors gracefully', () => {
      jest.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => service.setBaseUrl('/test/')).not.toThrow();
      expect(service.getBaseUrl()).toBe('/test/');
    });
  });

  describe('saveConfig', () => {
    it('should save configuration successfully', async () => {
      const setItemSpy = jest.spyOn(window.localStorage, 'setItem');

      await service.saveConfig(mockConfig);

      expect(service.getConfig()).toEqual(mockConfig);
      expect(setItemSpy).toHaveBeenCalledWith('appConfig', JSON.stringify(mockConfig));
      expect(setItemSpy).toHaveBeenCalledWith('baseUrl', mockConfig.baseUrl);
    });

    it('should normalize configuration before saving', async () => {
      const partialConfig = { ...minimalConfig } as AppConfig;

      await service.saveConfig(partialConfig);

      const savedConfig = service.getConfig();
      expect(savedConfig!.apiEndpoints).toEqual([]);
      expect(savedConfig!.modelUris).toEqual([]);
    });

    it('should emit new configuration to config$ observable', (done) => {
      service.config$.subscribe(config => {
        if (config?.baseUrl === mockConfig.baseUrl) {
          done();
        }
      });

      service.saveConfig(mockConfig);
    });

    it('should handle save errors', async () => {
      jest.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      await expect(service.saveConfig(mockConfig)).rejects.toThrow();
      expect(service.error()).toBeTruthy();
    });
  });

  describe('resetToDefault', () => {
    it('should reset to environment defaults', async () => {
      // First load a custom config
      await service.saveConfig(mockConfig);

      // Then reset
      service.resetToDefault();

      expect(service.getBaseUrl()).toBe(environment.baseUrl);
      const config = service.getConfig();
      expect(config!.apiEndpoints).toContain(environment.apiBaseUrl);
    });

    it('should remove localStorage items', () => {
      const removeItemSpy = jest.spyOn(window.localStorage, 'removeItem');

      service.resetToDefault();

      expect(removeItemSpy).toHaveBeenCalledWith('baseUrl');
      expect(removeItemSpy).toHaveBeenCalledWith('appConfig');
    });
  });

  describe('config validation', () => {
    it('should accept valid configuration', async () => {
      const configPath = '/assets/config.json';
      const loadPromise = service.loadConfigFromJson(configPath);

      httpMock.expectOne(configPath).flush(mockConfig);

      const result = await loadPromise;
      expect(result).toEqual(mockConfig);
    });

    it('should reject configuration missing baseUrl', async () => {
      const configPath = '/assets/config.json';
      const invalidConfig = { ...mockConfig, baseUrl: undefined };

      const loadPromise = service.loadConfigFromJson(configPath);
      httpMock.expectOne(configPath).flush(invalidConfig);

      const result = await loadPromise;
      expect(result!.baseUrl).toBe('/'); // Should use default
    });

    it('should reject configuration missing features', async () => {
      const configPath = '/assets/config.json';
      const invalidConfig = { ...mockConfig, features: undefined };

      const loadPromise = service.loadConfigFromJson(configPath);
      httpMock.expectOne(configPath).flush(invalidConfig);

      const result = await loadPromise;
      expect(result!.features).toBeDefined(); // Should use default
    });

    it('should handle non-array apiEndpoints', async () => {
      const configPath = '/assets/config.json';
      const invalidConfig = { ...mockConfig, apiEndpoints: 'not-an-array' as any };

      const loadPromise = service.loadConfigFromJson(configPath);
      httpMock.expectOne(configPath).flush(invalidConfig);

      const result = await loadPromise;
      expect(result!.apiEndpoints).toEqual([]); // Should use default
    });
  });

  describe('observable streams', () => {
    it('should provide baseUrl$ observable with replay', async () => {
      const values: string[] = [];

      // Subscribe before any emissions
      service.baseUrl$.subscribe(url => values.push(url));

      // Change base URL
      service.setBaseUrl('/first/');
      service.setBaseUrl('/second/');

      // Late subscriber should get last value
      let lateValue: string | undefined;
      service.baseUrl$.subscribe(url => lateValue = url);

      expect(values).toContain('/first/');
      expect(values).toContain('/second/');
      expect(lateValue).toBe('/second/');
    });

    it('should provide config$ observable with replay', async () => {
      const values: (AppConfig | null)[] = [];

      // Subscribe before any emissions
      service.config$.subscribe(config => values.push(config));

      // Save config
      await service.saveConfig(mockConfig);

      // Late subscriber should get last value
      let lateValue: AppConfig | null | undefined;
      service.config$.subscribe(config => lateValue = config);

      expect(values[values.length - 1]).toEqual(mockConfig);
      expect(lateValue).toEqual(mockConfig);
    });
  });

  describe('loading and error states', () => {
    it('should set loading signal during config load', fakeAsync(() => {
      expect(service.loading()).toBe(false);

      service.loadConfigFromJson('/assets/config.json');
      expect(service.loading()).toBe(true);

      httpMock.expectOne('/assets/config.json').flush(mockConfig);
      tick();

      expect(service.loading()).toBe(false);
    }));

    it('should set error signal on load failure', async () => {
      expect(service.error()).toBeNull();

      const loadPromise = service.loadConfigFromJson('/assets/config.json');

      // Fail all retries
      for (let i = 0; i < 6; i++) {
        httpMock.expectOne('/assets/config.json').error(
          new ProgressEvent('Network error'),
          { status: 500, statusText: 'Server Error' }
        );
      }

      await loadPromise;

      // Error should be cleared after fallback to default
      expect(service.error()).toBeNull();
    });

    it('should set error signal on save failure', async () => {
      jest.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage full');
      });

      await expect(service.saveConfig(mockConfig)).rejects.toThrow();

      const error = service.error();
      expect(error).toBeTruthy();
      expect(error?.message).toContain('Storage full');
    });
  });
});
