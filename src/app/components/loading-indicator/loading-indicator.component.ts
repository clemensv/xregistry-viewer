import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

/**
 * Production-grade loading indicator component with accessibility compliance
 * Provides consistent loading states across the xRegistry Viewer application
 */
@Component({
  selector: 'app-loading-indicator',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="loading-container"
      [class]="containerClass"
      [attr.aria-live]="'polite'"
      [attr.aria-busy]="'true'"
      [attr.role]="'status'">

      <!-- Loading spinner -->
      <div class="loading-content">
        <app-icon
          [name]="iconName"
          class="loading-icon"
          [class]="iconClass"
          aria-hidden="true">
        </app-icon>

        <!-- Loading text -->
        <div class="loading-text-container" *ngIf="showText">
          <h3 class="loading-title" *ngIf="title">{{ title }}</h3>
          <p class="loading-message" *ngIf="message">{{ message }}</p>
          <div class="loading-progress" *ngIf="showProgress">
            <span>{{ progressText }}</span>
          </div>
        </div>
      </div>

      <!-- Progress bar (optional) -->
      <div
        class="progress-bar-container"
        *ngIf="showProgressBar"
        [attr.aria-label]="'Loading progress: ' + progressPercentage + '%'">
        <div
          class="progress-bar"
          [style.width.%]="progressPercentage"
          [attr.aria-valuenow]="progressPercentage"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="100">
        </div>
      </div>

      <!-- Screen reader announcement -->
      <span class="sr-only">
        {{ srText || (title ? title + '. ' : '') + (message || 'Loading, please wait...') }}
      </span>
    </div>
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
      gap: 1rem;
    }

    /* Size variants */
    .loading-container.size-small {
      padding: 1rem;
      gap: 0.5rem;
    }

    .loading-container.size-large {
      padding: 3rem;
      gap: 1.5rem;
      min-height: 400px;
    }

    .loading-container.size-inline {
      padding: 0.5rem;
      gap: 0.5rem;
      flex-direction: row;
      justify-content: flex-start;
      text-align: left;
    }

    .loading-container.size-fullscreen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(248, 249, 250, 0.95);
      backdrop-filter: blur(2px);
      z-index: 1000;
      padding: 3rem;
      gap: 2rem;
    }

    /* Loading content */
    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .loading-container.size-inline .loading-content {
      flex-direction: row;
      gap: 0.5rem;
    }

    /* Loading icon */
    .loading-icon {
      animation: spin 1.5s linear infinite;
      color: var(--primary-color, #007bff);
    }

    .loading-icon.size-small {
      font-size: 1.25rem;
    }

    .loading-icon.size-medium {
      font-size: 2rem;
    }

    .loading-icon.size-large {
      font-size: 3rem;
    }

    .loading-icon.size-inline {
      font-size: 1rem;
    }

    /* Loading text */
    .loading-text-container {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 400px;
    }

    .loading-container.size-inline .loading-text-container {
      gap: 0.25rem;
    }

    .loading-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--fg-text, #212529);
    }

    .loading-container.size-small .loading-title {
      font-size: 1rem;
    }

    .loading-container.size-large .loading-title {
      font-size: 1.5rem;
    }

    .loading-container.size-inline .loading-title {
      font-size: 0.875rem;
      font-weight: 500;
    }

    .loading-message {
      margin: 0;
      font-size: 0.875rem;
      color: var(--fg-secondary-text, #6c757d);
      line-height: 1.4;
    }

    .loading-container.size-small .loading-message {
      font-size: 0.75rem;
    }

    .loading-container.size-large .loading-message {
      font-size: 1rem;
    }

    .loading-container.size-inline .loading-message {
      font-size: 0.75rem;
    }

    .loading-progress {
      font-size: 0.75rem;
      color: var(--fg-muted-text, #9ca3af);
      font-weight: 500;
    }

    /* Progress bar */
    .progress-bar-container {
      width: 100%;
      max-width: 300px;
      height: 0.25rem;
      background-color: var(--bg-border, #e5e7eb);
      border-radius: 0.125rem;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background-color: var(--primary-color, #007bff);
      border-radius: 0.125rem;
      transition: width 0.3s ease;
      animation: progress-shimmer 1.5s ease-in-out infinite;
    }

    /* Background variants */
    .loading-container.bg-elevated {
      background-color: var(--bg-elevated, #ffffff);
      border: 1px solid var(--fg-border, #dee2e6);
      border-radius: 0.5rem;
      box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
    }

    .loading-container.bg-card {
      background-color: var(--bg-card, #ffffff);
      border-radius: 0.5rem;
      box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
    }

    /* Animations */
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes progress-shimmer {
      0% {
        background-position: -200px 0;
      }
      100% {
        background-position: calc(200px + 100%) 0;
      }
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
      .loading-container {
        padding: 1.5rem;
      }

      .loading-container.size-large {
        padding: 2rem;
        min-height: 300px;
      }
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      .loading-icon {
        animation: none;
      }

      .progress-bar {
        transition: none;
        animation: none;
      }
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .loading-icon {
        color: var(--high-contrast-accent, #0000ff);
      }

      .progress-bar {
        background-color: var(--high-contrast-accent, #0000ff);
      }
    }

    /* Dark mode optimizations */
    @media (prefers-color-scheme: dark) {
      .loading-container.size-fullscreen {
        background-color: rgba(33, 37, 41, 0.95);
      }
    }
  `]
})
export class LoadingIndicatorComponent {
  @Input() size: 'small' | 'medium' | 'large' | 'inline' | 'fullscreen' = 'medium';
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() showText: boolean = true;
  @Input() showProgress: boolean = false;
  @Input() progressText: string = '';
  @Input() showProgressBar: boolean = false;
  @Input() progressPercentage: number = 0;
  @Input() background: 'none' | 'elevated' | 'card' = 'none';
  @Input() iconName: string = 'arrow_sync_circle';
  @Input() srText: string = ''; // Custom screen reader text

  get containerClass(): string {
    const classes = [`size-${this.size}`];

    if (this.background !== 'none') {
      classes.push(`bg-${this.background}`);
    }

    return classes.join(' ');
  }

  get iconClass(): string {
    return `size-${this.size}`;
  }
}
