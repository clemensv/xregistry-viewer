import { Component, Input } from '@angular/core';

/**
 * Mock Icon Component for testing
 * Replaces the actual IconComponent to avoid dependency resolution issues in tests
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<span data-testid="mock-icon" class="mock-icon">{{ name }}</span>`,
  styles: [`
    .mock-icon {
      display: inline-block;
      width: 16px;
      height: 16px;
    }
  `]
})
export class MockIconComponent {
  @Input() name: string = '';
  @Input() size: string = '16';
  @Input() color: string = 'currentColor';
}
