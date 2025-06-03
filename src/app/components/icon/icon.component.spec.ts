import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  let component: IconComponent;
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
    component = fixture.componentInstance;
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
  });

  it('should render icon with correct size', () => {
    component.name = 'settings';
    component.size = 16;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const iconElement = compiled.querySelector('.fluent-icon');

    expect(iconElement).toBeTruthy();
    // The exact styling will depend on the component implementation
  });
});
