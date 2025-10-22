import type { Config } from 'jest';

const config: Config = {
  displayName: 'xregistry-viewer',
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
  ],
  coverageDirectory: '<rootDir>/coverage/xregistry-viewer',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|@angular|@ngrx))'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@env/(.*)$': '<rootDir>/src/environments/$1',
    // Mock SVG files to fix Jest import issues
    '\\.svg$': '<rootDir>/src/test-mocks/svg-mock.ts',
    // Mock file-type ESM module for tests
    '^file-type$': '<rootDir>/src/test-mocks/file-type-mock.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'html', 'svg'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/test-setup.ts',
    '!src/environments/*.ts',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.[jt]s?(x)',
    '<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)',
  ],
  maxWorkers: 1,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true
};

export default config;
