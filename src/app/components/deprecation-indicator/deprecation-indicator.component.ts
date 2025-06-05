import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeprecatedInfo } from '../../models/registry.model';
import { IconComponent } from '../icon/icon.component';

/**
 * Production-grade component for displaying deprecation status and information
 * following Angular 18+ best practices with accessibility compliance
 */
@Component({
  selector: 'app-deprecation-indicator',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="deprecation-indicator"
      [class.deprecated]="isDeprecated"
      [attr.aria-label]="ariaLabel"
      [attr.role]="'status'"
      [attr.aria-live]="'polite'">

      <ng-container *ngIf="isDeprecated">
        <!-- Deprecation badge -->
        <span class="deprecated-badge"
              [attr.title]="deprecationTooltip">
          <app-icon name="warning" class="deprecated-icon" aria-hidden="true"></app-icon>
          <span class="deprecated-text">Deprecated</span>
        </span>

        <!-- Detailed deprecation info (expandable) -->
        <div class="deprecation-details" *ngIf="showDetails && deprecatedInfo">
          <div class="detail-item" *ngIf="deprecatedInfo.reason">
            <strong>Reason:</strong>
            <span>{{ deprecatedInfo.reason }}</span>
          </div>

          <div class="detail-item" *ngIf="deprecatedInfo.alternative">
            <strong>Alternative:</strong>
            <span>{{ deprecatedInfo.alternative }}</span>
          </div>

          <div class="detail-item" *ngIf="deprecatedInfo.since">
            <strong>Deprecated Since:</strong>
            <span>{{ deprecatedInfo.since | date:'medium' }}</span>
          </div>
        </div>

        <!-- Toggle details button -->
        <button
          *ngIf="hasDetailsToShow"
          class="details-toggle"
          type="button"
          [attr.aria-expanded]="showDetails"
          [attr.aria-controls]="detailsId"
          (click)="toggleDetails()"
          (keydown.enter)="toggleDetails()"
          (keydown.space)="$event.preventDefault(); toggleDetails()">
          <app-icon
            [name]="showDetails ? 'chevron_up' : 'chevron_down'"
            class="toggle-icon"
            aria-hidden="true">
          </app-icon>
          <span class="sr-only">{{ showDetails ? 'Hide' : 'Show' }} deprecation details</span>
        </button>
      </ng-container>

      <!-- Not deprecated indicator (optional) -->
      <span
        *ngIf="!isDeprecated && showActive"
        class="active-badge"
        [attr.title]="'This item is currently active and not deprecated'">
        <app-icon name="check_circle" class="active-icon" aria-hidden="true"></app-icon>
        <span class="active-text">Active</span>
      </span>
    </div>
  `,
  styles: [`
    .deprecation-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    /* Deprecated state styling */
    .deprecated-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      background-color: var(--warning-bg, #fff3cd);
      color: var(--warning-text, #856404);
      border: 1px solid var(--warning-border, #ffeaa7);
      border-radius: 0.375rem;
      font-weight: 500;
      cursor: help;
      transition: all 0.2s ease;
    }

    .deprecated-badge:hover {
      background-color: var(--warning-bg-hover, #fff1b3);
      border-color: var(--warning-border-hover, #ffdd57);
    }

    .deprecated-icon {
      font-size: 1rem;
      color: var(--warning-icon, #f39c12);
    }

    .deprecated-text {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    /* Active state styling */
    .active-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      background-color: var(--success-bg, #d4edda);
      color: var(--success-text, #155724);
      border: 1px solid var(--success-border, #c3e6cb);
      border-radius: 0.375rem;
      font-weight: 500;
    }

    .active-icon {
      font-size: 1rem;
      color: var(--success-icon, #28a745);
    }

    .active-text {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    /* Deprecation details */
    .deprecation-details {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--bg-elevated, #ffffff);
      border: 1px solid var(--fg-border, #dee2e6);
      border-radius: 0.375rem;
      box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
      padding: 0.75rem;
      margin-top: 0.25rem;
      z-index: 10;
      max-width: 300px;
      font-size: 0.875rem;
    }

    .detail-item {
      margin-bottom: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .detail-item:last-child {
      margin-bottom: 0;
    }

    .detail-item strong {
      color: var(--fg-text, #212529);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .detail-item span {
      color: var(--fg-secondary-text, #6c757d);
      line-height: 1.4;
    }

    /* Details toggle button */
    .details-toggle {
      background: none;
      border: none;
      padding: 0.25rem;
      border-radius: 0.25rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      color: var(--fg-secondary-text, #6c757d);
      transition: all 0.2s ease;
    }

    .details-toggle:hover {
      background-color: var(--bg-hover, #f8f9fa);
      color: var(--fg-text, #212529);
    }

    .details-toggle:focus {
      outline: 2px solid var(--focus-ring, #0066cc);
      outline-offset: 2px;
    }

    .toggle-icon {
      font-size: 1rem;
      transition: transform 0.2s ease;
    }

    /* Screen reader only content */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* Relative positioning for details popup */
    .deprecation-indicator.deprecated {
      position: relative;
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .deprecation-details {
        position: fixed;
        top: auto;
        bottom: 10px;
        left: 10px;
        right: 10px;
        max-width: none;
      }
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .deprecated-badge {
        border-width: 2px;
      }

      .active-badge {
        border-width: 2px;
      }
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      .deprecated-badge,
      .details-toggle,
      .toggle-icon {
        transition: none;
      }
    }
  `]
})
export class DeprecationIndicatorComponent {
  @Input() deprecatedInfo: DeprecatedInfo | null = null;
  @Input() showActive: boolean = false; // Whether to show "Active" badge for non-deprecated items
  @Input() showDetails: boolean = false; // Whether to show expanded details

  showDetailsInternal = false;
  readonly detailsId = `deprecation-details-${Math.random().toString(36).substr(2, 9)}`;

  get isDeprecated(): boolean {
    return this.deprecatedInfo !== null && this.deprecatedInfo !== undefined;
  }

  get hasDetailsToShow(): boolean {
    if (!this.deprecatedInfo) return false;
    return !!(this.deprecatedInfo.reason || this.deprecatedInfo.alternative || this.deprecatedInfo.since);
  }

  get deprecationTooltip(): string {
    if (!this.isDeprecated) return '';

    const parts: string[] = [];
    if (this.deprecatedInfo?.reason) {
      parts.push(`Reason: ${this.deprecatedInfo.reason}`);
    }
    if (this.deprecatedInfo?.alternative) {
      parts.push(`Alternative: ${this.deprecatedInfo.alternative}`);
    }
    if (this.deprecatedInfo?.since) {
      parts.push(`Since: ${new Date(this.deprecatedInfo.since).toLocaleDateString()}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'This item is deprecated';
  }

  get ariaLabel(): string {
    if (!this.isDeprecated) {
      return this.showActive ? 'Active item' : '';
    }

    let label = 'Deprecated item';
    if (this.deprecatedInfo?.reason) {
      label += `, reason: ${this.deprecatedInfo.reason}`;
    }
    if (this.deprecatedInfo?.alternative) {
      label += `, alternative: ${this.deprecatedInfo.alternative}`;
    }
    return label;
  }

  toggleDetails(): void {
    this.showDetailsInternal = !this.showDetailsInternal;
  }
}
