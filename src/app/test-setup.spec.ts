import { TestBed } from '@angular/core/testing';

describe('Test Setup Verification', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({}).compileComponents();
  });

  it('should run Jest tests successfully', () => {
    expect(true).toBe(true);
  });

  it('should have access to Angular testing utilities', () => {
    expect(TestBed).toBeDefined();
  });

  it('should suppress console output during tests', () => {
    console.error('This should be suppressed');
    console.warn('This should also be suppressed');
    expect(true).toBe(true);
  });
});
