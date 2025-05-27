import { Component, Input, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-documentation-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="documentation-viewer" *ngIf="documentationUrl">
      <div class="documentation-header">
        <h3>Documentation</h3>
        <button
          class="pop-out-btn"
          (click)="openInNewWindow()"
          title="Open documentation in new window"
          [attr.aria-label]="'Open documentation in new window'">
          <span class="material-icons">open_in_new</span>
        </button>
      </div>
      <div class="documentation-content">
        <iframe
          [src]="safeUrl"
          frameborder="0"
          [attr.title]="'Documentation for ' + resourceId"
          class="documentation-iframe">
        </iframe>
      </div>
    </div>
  `,
  styleUrls: ['./documentation-viewer.component.scss']
})
export class DocumentationViewerComponent implements OnInit {
  @Input() documentationUrl!: string;
  @Input() resourceId: string = '';

  safeUrl: SafeResourceUrl | null = null;
  private isBrowser: boolean;

  constructor(
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.documentationUrl && this.isBrowser) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.documentationUrl);
    }
  }

  openInNewWindow(): void {
    if (this.documentationUrl && this.isBrowser) {
      window.open(this.documentationUrl, '_blank', 'noopener,noreferrer');
    }
  }
}
