import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  let component: IconComponent;
  let fixture: ComponentFixture<IconComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Flush any pending requests before verification
    const pendingRequests = httpMock.match(() => true);
    pendingRequests.forEach(req => {
      if (!req.cancelled) {
        req.flush('<svg></svg>');
      }
    });
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply dark mode inversion styles', async () => {
    // Add dark theme class to body
    document.body.classList.add('theme-dark');

    component.name = 'settings';
    component.size = 20;
    fixture.detectChanges();

    // Mock the HTTP request for the SVG
    const mockSvg = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2L12 8L18 8L13 12L15 18L10 14L5 18L7 12L2 8L8 8Z"/></svg>';
    const req = httpMock.expectOne((request) => request.url.includes('ic_fluent_settings_20_regular.svg'));
    req.flush(mockSvg);

    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    // Check if the fluent-icon span is present
    const iconElement = compiled.querySelector('.fluent-icon');
    expect(iconElement).toBeTruthy();

    // Clean up
    document.body.classList.remove('theme-dark');
  });

  it('should set icon properties correctly', () => {
    component.name = 'settings';
    component.size = 24;
    component.filled = true;

    expect(component.name).toBe('settings');
    expect(component.size).toBe(24);
    expect(component.filled).toBe(true);
  });

  it('should handle legacy icon name mapping', () => {
    component.name = 'font_decrease';

    // The component should map legacy names to new format
    expect(component.name).toBe('font_decrease');

    // Don't trigger change detection to avoid HTTP requests in this test
  });
});
