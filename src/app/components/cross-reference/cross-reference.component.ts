import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CrossReference } from '../../models/registry.model';
import { IconComponent } from '../icon/icon.component';

/**
 * Production-grade component for displaying cross-references (xref) between xRegistry resources
 * following Angular 18+ best practices with accessibility compliance
 */
@Component({
  selector: 'app-cross-reference',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="xref-container"
      [attr.aria-label]="'Cross references for this resource'"
      [attr.role]="'region'">

      <!-- Section header -->
      <div class="xref-header" *ngIf="showHeader">
        <h3 class="xref-title">
          <app-icon name="link" class="xref-icon" aria-hidden="true"></app-icon>
          <span>Cross References</span>
          <span class="xref-count" *ngIf="crossReferences.length > 0">({{ crossReferences.length }})</span>
        </h3>
        <p class="xref-description" *ngIf="showDescription">
          Related resources and references across the registry
        </p>
      </div>

      <!-- Cross references list -->
      <div class="xref-list" *ngIf="crossReferences.length > 0">
        <div
          *ngFor="let xref of crossReferences; trackBy: trackByXref"
          class="xref-item"
          [attr.aria-label]="getXrefAriaLabel(xref)">

          <!-- Cross reference link -->
          <a
            [routerLink]="buildRouterLink(xref)"
            class="xref-link"
            [attr.title]="getXrefTooltip(xref)"
            [attr.aria-describedby]="'xref-desc-' + getXrefId(xref)">

            <!-- Icon indicating resource type -->
            <app-icon
              [name]="getXrefIcon(xref)"
              class="xref-type-icon"
              aria-hidden="true">
            </app-icon>

            <!-- Resource identification -->
            <div class="xref-details">
              <div class="xref-path">
                <span class="xref-group-type">{{ xref.grouptype }}</span>
                <span class="xref-separator">/</span>
                <span class="xref-group-id">{{ xref.groupid }}</span>
                <span class="xref-separator" *ngIf="xref.resourcetype">/</span>
                <span class="xref-resource-type" *ngIf="xref.resourcetype">{{ xref.resourcetype }}</span>
                <span class="xref-separator" *ngIf="xref.resourceid">/</span>
                <span class="xref-resource-id" *ngIf="xref.resourceid">{{ xref.resourceid }}</span>
                <span class="xref-separator" *ngIf="xref.versionid">/</span>
                <span class="xref-version-id" *ngIf="xref.versionid">{{ xref.versionid }}</span>
              </div>

              <!-- Resource type indicator -->
              <div class="xref-type-indicator">
                <span class="xref-type-label">{{ getXrefTypeLabel(xref) }}</span>
              </div>
            </div>

            <!-- External link indicator -->
            <app-icon
              name="open"
              class="external-icon"
              aria-hidden="true"
              *ngIf="isExternalRef(xref)">
            </app-icon>
          </a>

          <!-- Hidden description for screen readers -->
          <span
            [id]="'xref-desc-' + getXrefId(xref)"
            class="sr-only">
            {{ getXrefDescription(xref) }}
          </span>
        </div>
      </div>

      <!-- Empty state -->
      <div class="xref-empty" *ngIf="crossReferences.length === 0 && showEmpty">
        <app-icon name="link_off" class="empty-icon" aria-hidden="true"></app-icon>
        <p class="empty-message">No cross references available</p>
      </div>

      <!-- Compact mode toggle -->
      <button
        *ngIf="compactMode && crossReferences.length > compactLimit"
        type="button"
        class="xref-toggle"
        (click)="toggleExpanded()"
        [attr.aria-expanded]="expanded"
        [attr.aria-controls]="'xref-list-' + componentId">
        <span>{{ expanded ? 'Show fewer' : 'Show all' }} ({{ crossReferences.length }})</span>
        <app-icon
          [name]="expanded ? 'chevron_up' : 'chevron_down'"
          class="toggle-icon"
          aria-hidden="true">
        </app-icon>
      </button>
    </div>
  `,
  styles: [`
    .xref-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Header styling */
    .xref-header {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .xref-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--fg-text, #111827);
    }

    .xref-icon {
      font-size: 1.25rem;
      color: var(--primary-color, #3b82f6);
    }

    .xref-count {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--fg-secondary-text, #6b7280);
      background-color: var(--bg-secondary, #f3f4f6);
      padding: 0.125rem 0.5rem;
      border-radius: 0.375rem;
    }

    .xref-description {
      margin: 0;
      font-size: 0.875rem;
      color: var(--fg-secondary-text, #6b7280);
      line-height: 1.4;
    }

    /* List styling */
    .xref-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .xref-item {
      border: 1px solid var(--fg-border, #e5e7eb);
      border-radius: 0.375rem;
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .xref-item:hover {
      border-color: var(--primary-color, #3b82f6);
      box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
    }

    /* Link styling */
    .xref-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      text-decoration: none;
      color: var(--fg-text, #111827);
      transition: all 0.2s ease;
      width: 100%;
    }

    .xref-link:hover {
      background-color: var(--bg-hover, #f9fafb);
      color: var(--primary-color, #3b82f6);
    }

    .xref-link:focus {
      outline: 2px solid var(--focus-ring, #3b82f6);
      outline-offset: -2px;
    }

    /* Type icon */
    .xref-type-icon {
      flex-shrink: 0;
      font-size: 1.25rem;
      color: var(--fg-secondary-text, #6b7280);
    }

    .xref-link:hover .xref-type-icon {
      color: var(--primary-color, #3b82f6);
    }

    /* Details styling */
    .xref-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0; /* Allow text truncation */
    }

    .xref-path {
      display: flex;
      align-items: center;
      gap: 0.125rem;
      font-family: var(--font-mono, 'Courier New', monospace);
      font-size: 0.875rem;
      line-height: 1.4;
      word-break: break-all;
    }

    .xref-group-type {
      color: var(--fg-text, #111827);
      font-weight: 600;
    }

    .xref-group-id {
      color: var(--primary-color, #3b82f6);
      font-weight: 500;
    }

    .xref-resource-type {
      color: var(--fg-secondary-text, #6b7280);
      font-weight: 500;
    }

    .xref-resource-id {
      color: var(--fg-text, #111827);
      font-weight: 500;
    }

    .xref-version-id {
      color: var(--fg-muted-text, #9ca3af);
      font-style: italic;
    }

    .xref-separator {
      color: var(--fg-muted-text, #9ca3af);
      font-weight: 400;
    }

    .xref-type-indicator {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .xref-type-label {
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      color: var(--fg-muted-text, #9ca3af);
    }

    /* External link icon */
    .external-icon {
      flex-shrink: 0;
      font-size: 1rem;
      color: var(--fg-muted-text, #9ca3af);
    }

    /* Empty state */
    .xref-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2rem;
      text-align: center;
      color: var(--fg-muted-text, #9ca3af);
    }

    .empty-icon {
      font-size: 2rem;
      opacity: 0.6;
    }

    .empty-message {
      margin: 0;
      font-size: 0.875rem;
    }

    /* Compact mode toggle */
    .xref-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: none;
      border: 1px solid var(--fg-border, #e5e7eb);
      border-radius: 0.375rem;
      padding: 0.5rem 1rem;
      color: var(--fg-secondary-text, #6b7280);
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.875rem;
    }

    .xref-toggle:hover {
      background-color: var(--bg-hover, #f9fafb);
      border-color: var(--primary-color, #3b82f6);
      color: var(--primary-color, #3b82f6);
    }

    .xref-toggle:focus {
      outline: 2px solid var(--focus-ring, #3b82f6);
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

    /* Responsive design */
    @media (max-width: 768px) {
      .xref-link {
        padding: 0.625rem;
        gap: 0.5rem;
      }

      .xref-path {
        font-size: 0.75rem;
        flex-wrap: wrap;
      }

      .xref-type-label {
        font-size: 0.6875rem;
      }
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .xref-item {
        border-width: 2px;
      }

      .xref-toggle {
        border-width: 2px;
      }
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      .xref-item,
      .xref-link,
      .xref-toggle,
      .toggle-icon {
        transition: none;
      }
    }
  `]
})
export class CrossReferenceComponent {
  @Input() crossReferences: CrossReference[] = [];
  @Input() showHeader: boolean = true;
  @Input() showDescription: boolean = true;
  @Input() showEmpty: boolean = true;
  @Input() compactMode: boolean = false;
  @Input() compactLimit: number = 5;

  expanded = false;
  readonly componentId = Math.random().toString(36).substr(2, 9);

  get displayedReferences(): CrossReference[] {
    if (!this.compactMode || this.expanded) {
      return this.crossReferences;
    }
    return this.crossReferences.slice(0, this.compactLimit);
  }

  trackByXref(index: number, xref: CrossReference): string {
    return this.getXrefId(xref);
  }

  getXrefId(xref: CrossReference): string {
    const parts = [xref.grouptype, xref.groupid];
    if (xref.resourcetype) parts.push(xref.resourcetype);
    if (xref.resourceid) parts.push(xref.resourceid);
    if (xref.versionid) parts.push(xref.versionid);
    return parts.join('-');
  }

  buildRouterLink(xref: CrossReference): string[] {
    const path = ['/', xref.grouptype, xref.groupid];

    if (xref.resourcetype) {
      path.push(xref.resourcetype);

      if (xref.resourceid) {
        path.push(xref.resourceid);

        if (xref.versionid) {
          path.push('versions', xref.versionid);
        }
      }
    }

    return path;
  }

  getXrefIcon(xref: CrossReference): string {
    if (xref.versionid) return 'tag';
    if (xref.resourceid) return 'document';
    if (xref.resourcetype) return 'folder_open';
    return 'folder';
  }

  getXrefTypeLabel(xref: CrossReference): string {
    if (xref.versionid) return 'Version';
    if (xref.resourceid) return 'Resource';
    if (xref.resourcetype) return 'Collection';
    return 'Group';
  }

  getXrefAriaLabel(xref: CrossReference): string {
    const type = this.getXrefTypeLabel(xref);
    const path = this.buildXrefPath(xref);
    return `${type}: ${path}`;
  }

  getXrefTooltip(xref: CrossReference): string {
    const type = this.getXrefTypeLabel(xref);
    const path = this.buildXrefPath(xref);
    return `Navigate to ${type.toLowerCase()}: ${path}`;
  }

  getXrefDescription(xref: CrossReference): string {
    const type = this.getXrefTypeLabel(xref);
    const path = this.buildXrefPath(xref);
    return `Cross reference to ${type.toLowerCase()} at ${path}`;
  }

  private buildXrefPath(xref: CrossReference): string {
    const parts = [xref.grouptype, xref.groupid];
    if (xref.resourcetype) parts.push(xref.resourcetype);
    if (xref.resourceid) parts.push(xref.resourceid);
    if (xref.versionid) parts.push(xref.versionid);
    return parts.join('/');
  }

  isExternalRef(xref: CrossReference): boolean {
    // Could be enhanced to detect external references based on URL patterns
    // For now, assume all are internal
    return false;
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }
}
