import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

/**
 * Production-grade empty state component with accessibility compliance
 * Handles various empty state scenarios in the xRegistry Viewer application
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="empty-state-container"
      [class]="containerClass"
      [attr.role]="'region'"
      [attr.aria-label]="ariaLabel || title">

      <div class="empty-state-content">
        <!-- Icon -->
        <app-icon
          [name]="iconName"
          class="empty-state-icon"
          [class]="iconClass"
          [attr.aria-hidden]="'true'">
        </app-icon>

        <!-- Title -->
        <h2 class="empty-state-title" *ngIf="title">
          {{ title }}
        </h2>

        <!-- Message -->
        <p class="empty-state-message" *ngIf="message">
          {{ message }}
        </p>

        <!-- Additional details -->
        <div class="empty-state-details" *ngIf="details">
          <p>{{ details }}</p>
        </div>

        <!-- Action buttons -->
        <div class="empty-state-actions" *ngIf="showActions">
          <!-- Primary action -->
          <button
            *ngIf="primaryAction"
            type="button"
            class="action-button primary"
            (click)="onPrimaryAction()"
            [disabled]="primaryActionDisabled"
            [attr.aria-describedby]="primaryAction.description ? actionDescriptionId : null">
            <app-icon
              *ngIf="primaryAction.icon"
              [name]="primaryAction.icon"
              class="action-icon"
              aria-hidden="true">
            </app-icon>
            <span>{{ primaryAction.label }}</span>
          </button>

          <!-- Secondary action -->
          <button
            *ngIf="secondaryAction"
            type="button"
            class="action-button secondary"
            (click)="onSecondaryAction()"
            [disabled]="secondaryActionDisabled"
            [attr.aria-describedby]="secondaryAction.description ? actionDescriptionId : null">
            <app-icon
              *ngIf="secondaryAction.icon"
              [name]="secondaryAction.icon"
              class="action-icon"
              aria-hidden="true">
            </app-icon>
            <span>{{ secondaryAction.label }}</span>
          </button>
        </div>

        <!-- Action descriptions for screen readers -->
        <div
          *ngIf="(primaryAction?.description || secondaryAction?.description)"
          [id]="actionDescriptionId"
          class="sr-only">          <span *ngIf="primaryAction?.description">{{ primaryAction?.description }}</span>
          <span *ngIf="secondaryAction?.description">{{ secondaryAction?.description }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .empty-state-container {
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
      min-height: 300px;
    }

    /* Size variants */
    .empty-state-container.size-small {
      padding: 1rem;
      min-height: 200px;
    }

    .empty-state-container.size-large {
      padding: 3rem;
      min-height: 500px;
    }

    .empty-state-container.size-compact {
      padding: 1.5rem;
      min-height: 150px;
    }

    .empty-state-container.size-fullscreen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: var(--bg-app, #f8f9fa);
      z-index: 1000;
    }

    /* Type variants */
    .empty-state-container.type-error {
      background-color: var(--error-bg-subtle, #fef2f2);
      border: 1px solid var(--error-border-subtle, #fecaca);
      color: var(--error-text, #dc2626);
    }

    .empty-state-container.type-warning {
      background-color: var(--warning-bg-subtle, #fffbeb);
      border: 1px solid var(--warning-border-subtle, #fed7aa);
      color: var(--warning-text, #d97706);
    }

    .empty-state-container.type-info {
      background-color: var(--info-bg-subtle, #eff6ff);
      border: 1px solid var(--info-border-subtle, #bfdbfe);
      color: var(--info-text, #2563eb);
    }

    .empty-state-container.type-success {
      background-color: var(--success-bg-subtle, #f0fdf4);
      border: 1px solid var(--success-border-subtle, #bbf7d0);
      color: var(--success-text, #16a34a);
    }

    /* Background variants */
    .empty-state-container.bg-elevated {
      background-color: var(--bg-elevated, #ffffff);
      border: 1px solid var(--fg-border, #e5e7eb);
      border-radius: 0.5rem;
      box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
    }

    .empty-state-container.bg-card {
      background-color: var(--bg-card, #ffffff);
      border-radius: 0.5rem;
      box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
    }

    /* Content styling */
    .empty-state-content {
      max-width: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .empty-state-container.size-small .empty-state-content {
      max-width: 300px;
      gap: 0.75rem;
    }

    .empty-state-container.size-large .empty-state-content {
      max-width: 500px;
      gap: 1.5rem;
    }

    /* Icon styling */
    .empty-state-icon {
      color: var(--fg-muted-text, #9ca3af);
      opacity: 0.8;
    }

    .empty-state-icon.size-small {
      font-size: 2.5rem;
    }

    .empty-state-icon.size-medium {
      font-size: 4rem;
    }

    .empty-state-icon.size-large {
      font-size: 5rem;
    }

    .empty-state-icon.size-compact {
      font-size: 2rem;
    }

    /* Type-specific icon colors */
    .empty-state-container.type-error .empty-state-icon {
      color: var(--error-icon, #ef4444);
    }

    .empty-state-container.type-warning .empty-state-icon {
      color: var(--warning-icon, #f59e0b);
    }

    .empty-state-container.type-info .empty-state-icon {
      color: var(--info-icon, #3b82f6);
    }

    .empty-state-container.type-success .empty-state-icon {
      color: var(--success-icon, #10b981);
    }

    /* Title styling */
    .empty-state-title {
      margin: 0;
      font-weight: 600;
      color: var(--fg-text, #111827);
    }

    .empty-state-container.size-small .empty-state-title {
      font-size: 1.125rem;
    }

    .empty-state-container.size-medium .empty-state-title {
      font-size: 1.25rem;
    }

    .empty-state-container.size-large .empty-state-title {
      font-size: 1.5rem;
    }

    .empty-state-container.size-compact .empty-state-title {
      font-size: 1rem;
    }

    /* Message styling */
    .empty-state-message {
      margin: 0;
      color: var(--fg-secondary-text, #6b7280);
      line-height: 1.5;
    }

    .empty-state-container.size-small .empty-state-message {
      font-size: 0.875rem;
    }

    .empty-state-container.size-medium .empty-state-message {
      font-size: 0.875rem;
    }

    .empty-state-container.size-large .empty-state-message {
      font-size: 1rem;
    }

    .empty-state-container.size-compact .empty-state-message {
      font-size: 0.75rem;
    }

    /* Details styling */
    .empty-state-details {
      font-size: 0.75rem;
      color: var(--fg-muted-text, #9ca3af);
      line-height: 1.4;
    }

    .empty-state-details p {
      margin: 0;
    }

    /* Actions styling */
    .empty-state-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      align-items: center;
      width: 100%;
    }

    @media (min-width: 640px) {
      .empty-state-actions {
        flex-direction: row;
        justify-content: center;
      }
    }

    .action-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 0.375rem;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
      text-decoration: none;
      min-width: 120px;
      justify-content: center;
    }

    .action-button:focus {
      outline: 2px solid var(--focus-ring, #3b82f6);
      outline-offset: 2px;
    }

    .action-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Primary action button */
    .action-button.primary {
      background-color: var(--primary-color, #3b82f6);
      color: white;
    }

    .action-button.primary:hover:not(:disabled) {
      background-color: var(--primary-color-hover, #2563eb);
    }

    .action-button.primary:active:not(:disabled) {
      background-color: var(--primary-color-active, #1d4ed8);
    }

    /* Secondary action button */
    .action-button.secondary {
      background-color: var(--bg-elevated, #ffffff);
      color: var(--fg-text, #374151);
      border-color: var(--fg-border, #d1d5db);
    }

    .action-button.secondary:hover:not(:disabled) {
      background-color: var(--bg-hover, #f9fafb);
      border-color: var(--fg-border-hover, #9ca3af);
    }

    .action-button.secondary:active:not(:disabled) {
      background-color: var(--bg-active, #f3f4f6);
    }

    .action-icon {
      font-size: 1rem;
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

    /* Responsive design */
    @media (max-width: 768px) {
      .empty-state-container {
        padding: 1.5rem;
      }

      .empty-state-container.size-large {
        padding: 2rem;
        min-height: 400px;
      }

      .empty-state-content {
        max-width: 100%;
      }

      .action-button {
        min-width: 100px;
        padding: 0.5rem 1rem;
        font-size: 0.8rem;
      }
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .action-button {
        border-width: 2px;
      }

      .empty-state-container.type-error,
      .empty-state-container.type-warning,
      .empty-state-container.type-info,
      .empty-state-container.type-success {
        border-width: 2px;
      }
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      .action-button {
        transition: none;
      }
    }
  `]
})
export class EmptyStateComponent {
  @Input() size: 'small' | 'medium' | 'large' | 'compact' | 'fullscreen' = 'medium';
  @Input() type: 'default' | 'error' | 'warning' | 'info' | 'success' = 'default';
  @Input() background: 'none' | 'elevated' | 'card' = 'none';
  @Input() iconName: string = 'inbox';
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() details: string = '';
  @Input() ariaLabel: string = '';
  @Input() showActions: boolean = false;
  @Input() primaryAction: { label: string; icon?: string; description?: string } | null = null;
  @Input() secondaryAction: { label: string; icon?: string; description?: string } | null = null;
  @Input() primaryActionDisabled: boolean = false;
  @Input() secondaryActionDisabled: boolean = false;

  @Output() primaryActionClick = new EventEmitter<void>();
  @Output() secondaryActionClick = new EventEmitter<void>();

  readonly actionDescriptionId = `empty-state-actions-${Math.random().toString(36).substr(2, 9)}`;

  get containerClass(): string {
    const classes = [`size-${this.size}`];

    if (this.type !== 'default') {
      classes.push(`type-${this.type}`);
    }

    if (this.background !== 'none') {
      classes.push(`bg-${this.background}`);
    }

    return classes.join(' ');
  }

  get iconClass(): string {
    return `size-${this.size}`;
  }

  onPrimaryAction(): void {
    if (!this.primaryActionDisabled) {
      this.primaryActionClick.emit();
    }
  }

  onSecondaryAction(): void {
    if (!this.secondaryActionDisabled) {
      this.secondaryActionClick.emit();
    }
  }
}
