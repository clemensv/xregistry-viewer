// SPDX-License-Identifier: MIT
// Copyright (c) 2024 xRegistry Viewer Contributors

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

export interface ErrorState {
  hasError: boolean;
  error?: Error | null;
  errorInfo?: string;
  retryCount?: number;
}

@Component({
  selector: 'app-error-boundary',
  standalone: true,
  imports: [CommonModule, IconComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="error-boundary" *ngIf="errorState.hasError; else contentTemplate" role="alert">
      <div class="error-container">
        <app-icon name="ErrorCircle" class="error-icon" aria-hidden="true"></app-icon>

        <div class="error-content">
          <h3 class="error-title">{{ errorTitle }}</h3>
          <p class="error-message">{{ errorMessage }}</p>

          <div class="error-details" *ngIf="showDetails && errorState.error">
            <details>
              <summary>Error Details</summary>
              <pre class="error-stack">{{ getErrorDetails() }}</pre>
            </details>
          </div>

          <div class="error-actions">
            <fluent-button
              appearance="accent"
              (click)="handleRetry()"
              [attr.aria-label]="'Retry operation, attempt ' + (errorState.retryCount || 0 + 1)"
              [disabled]="isRetrying">
              <app-icon name="ArrowClockwise" *ngIf="!isRetrying"></app-icon>
              <app-icon name="Circle" *ngIf="isRetrying" class="spinning"></app-icon>
              {{ isRetrying ? 'Retrying...' : 'Retry' }}
            </fluent-button>

            <fluent-button
              appearance="subtle"
              (click)="handleDismiss()"
              aria-label="Dismiss error and continue">
              Dismiss
            </fluent-button>
          </div>
        </div>
      </div>
    </div>

    <ng-template #contentTemplate>
      <ng-content></ng-content>
    </ng-template>
  `,
  styles: [`
    .error-boundary {
      background: var(--colorPaletteRedBackground1, #fdf6f6);
      border: 1px solid var(--colorPaletteRedBorder1, #f7b2b2);
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1rem 0;
    }

    .error-container {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }

    .error-icon {
      font-size: 2rem;
      color: var(--colorPaletteRedForeground1, #d13438);
      flex-shrink: 0;
    }

    .error-content {
      flex: 1;
    }

    .error-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--colorPaletteRedForeground1, #d13438);
    }

    .error-message {
      margin: 0 0 1rem 0;
      color: var(--colorNeutralForeground1, #242424);
      line-height: 1.5;
    }

    .error-details {
      margin-bottom: 1rem;
    }

    .error-details summary {
      cursor: pointer;
      color: var(--colorNeutralForeground2, #424242);
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .error-stack {
      background: var(--colorNeutralBackground3, #f0f0f0);
      padding: 0.75rem;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      overflow-x: auto;
      white-space: pre-wrap;
      color: var(--colorNeutralForeground1, #242424);
      margin: 0;
    }

    .error-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .error-container {
        flex-direction: column;
        text-align: center;
      }

      .error-actions {
        justify-content: center;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorBoundaryComponent implements OnInit {
  @Input() errorState: ErrorState = { hasError: false };
  @Input() errorTitle = 'Something went wrong';
  @Input() errorMessage = 'An unexpected error occurred. Please try again.';
  @Input() showDetails = false;
  @Input() maxRetries = 3;

  @Output() retry = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  isRetrying = false;

  ngOnInit(): void {    // Ensure errorState has default values
    this.errorState = {
      ...this.errorState,
      retryCount: this.errorState?.retryCount || 0,
      hasError: this.errorState?.hasError || false
    };
  }

  handleRetry(): void {
    if ((this.errorState.retryCount || 0) >= this.maxRetries) {
      return;
    }

    this.isRetrying = true;
    this.errorState.retryCount = (this.errorState.retryCount || 0) + 1;

    // Emit retry event
    this.retry.emit();

    // Reset retrying state after a delay
    setTimeout(() => {
      this.isRetrying = false;
    }, 1000);
  }

  handleDismiss(): void {
    this.errorState.hasError = false;
    this.dismiss.emit();
  }

  getErrorDetails(): string {
    if (!this.errorState.error) return '';

    const error = this.errorState.error;
    let details = `Error: ${error.message}\n`;

    if (error.stack) {
      details += `\nStack Trace:\n${error.stack}`;
    }

    if (this.errorState.errorInfo) {
      details += `\n\nAdditional Info:\n${this.errorState.errorInfo}`;
    }

    return details;
  }
}
