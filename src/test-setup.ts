import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import { getTestBed } from '@angular/core/testing';

// Check if test environment is already initialized
const testBed = getTestBed();
const isInitialized = (testBed as any)._instantiated || (testBed as any)._testModuleRef;

if (!isInitialized) {
  // Setup Angular testing environment only if not already initialized
  setupZoneTestEnv({
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
  });
}

// Configure Testing Library if it's installed
try {
  const { configure } = require('@testing-library/angular');
  configure({
    defaultHidden: true,
    asyncUtilTimeout: 3000,
  });
} catch (e) {
  // @testing-library/angular is not installed, skip configuration
}

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Reset localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }

  // Reset sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
});

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(global, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

// Store original console methods
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

// Track if we're in a test that expects console output
let expectingConsoleOutput = false;

// Helper to enable console output for specific tests
(global as any).expectConsoleOutput = () => {
  expectingConsoleOutput = true;
};

// Suppress console outputs during tests unless explicitly testing error scenarios
beforeEach(() => {
  expectingConsoleOutput = false;
  console.error = jest.fn((...args) => {
    const message = args[0]?.toString() || '';

    // Always suppress these known/expected messages
    const suppressedPatterns = [
      'NG0',
      'NG04',
      'ExpressionChangedAfterItHasBeenCheckedError',
      'ConfigService:', // ConfigService logs are part of normal operation
      'Invalid base URL format:', // Expected in validation tests
      'Error saving configuration:', // Expected in error tests
      'This should be suppressed', // Test messages
    ];

    const shouldSuppress = suppressedPatterns.some(pattern => message.includes(pattern));

    if (!shouldSuppress && expectingConsoleOutput) {
      originalError(...args);
    }
  });
  console.warn = jest.fn((...args) => {
    const message = args[0]?.toString() || '';

    // Always suppress these known/expected warnings
    const suppressedPatterns = [
      'deprecated',
      'ConfigService:', // ConfigService warnings are expected
      'Retry attempt', // Retry warnings are expected behavior
      'This should also be suppressed', // Test messages
    ];

    const shouldSuppress = suppressedPatterns.some(pattern => message.includes(pattern));

    if (!shouldSuppress && expectingConsoleOutput) {
      originalWarn(...args);
    }
  });

  // Always suppress console.log in tests
  console.log = jest.fn();
});

afterEach(() => {
  expectingConsoleOutput = false;
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});

// Add custom matchers if needed
expect.extend({
  toHaveBeenCalledWithMatch(received: jest.Mock, expected: any) {
    const calls = received.mock.calls;
    const pass = calls.some(call =>
      call.some((arg: any) =>
        JSON.stringify(arg).includes(JSON.stringify(expected))
      )
    );

    return {
      pass,
      message: () =>
        pass
          ? `Expected not to have been called with matching ${expected}`
          : `Expected to have been called with matching ${expected}`,
    };
  },
});

// Type augmentation for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWithMatch(expected: any): R;
    }
  }

  // Add type for expectConsoleOutput
  function expectConsoleOutput(): void;
}

// Export for use in tests
export { expectingConsoleOutput };
