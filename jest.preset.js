// jest.preset.js
const nxPreset = require('@nx/jest/preset').default;

module.exports = { 
  ...nxPreset,
  // Remove any duplicate configuration that might cause issues
  testEnvironment: 'jsdom',
  // Ensure we don't have conflicting transform configurations
  transform: undefined,
  // Remove deprecated globals configuration
  globals: undefined,
};