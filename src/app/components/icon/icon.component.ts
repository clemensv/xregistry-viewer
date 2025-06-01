import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, switchMap } from 'rxjs';

/**
 * Icon component that uses official Fluent UI System Icons from @fluentui/svg-icons
 * Icons are loaded from GitHub repository directly to ensure consistency
 */
@Component({
  selector: 'fluent-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="iconSvg$ | async as svg; else loading">
      <span [innerHTML]="svg" [attr.aria-hidden]="true" class="fluent-icon"></span>
    </ng-container>
    <ng-template #loading>
      <span class="fluent-icon-loading" [style.width.px]="size" [style.height.px]="size"></span>
    </ng-template>
  `,
  styles: [`
    :host {
      display: inline-block;
      line-height: 0;
    }
    .fluent-icon {
      display: inline-block;
      vertical-align: middle;
    }
    .fluent-icon-loading {
      display: inline-block;
      vertical-align: middle;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconComponent implements OnInit {
  @Input() set name(value: string) {
    this._name = value;
    this.updateIcon();
  }
  get name(): string {
    return this._name;
  }

  @Input() set size(value: number) {
    this._size = value;
    this.updateIcon();
  }
  get size(): number {
    return this._size;
  }

  @Input() set filled(value: boolean) {
    this._filled = value;
    this.updateIcon();
  }
  get filled(): boolean {
    return this._filled;
  }

  private _name: string = 'info';
  private _size: number = 20;
  private _filled: boolean = false;
  private iconSubject = new BehaviorSubject<{ name: string, size: number, filled: boolean }>({ 
    name: this._name, 
    size: this._size, 
    filled: this._filled 
  });

  iconSvg$: Observable<SafeHtml>;

  // Cache for loaded icons to prevent repeated HTTP requests
  private static iconCache = new Map<string, Observable<SafeHtml>>();

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {
    this.iconSvg$ = this.iconSubject.pipe(
      switchMap(({name, size, filled}) => this.getIconSvg(name, size, filled)),
      shareReplay(1)
    );
  }

  ngOnInit(): void {
    this.updateIcon();
  }

  private updateIcon(): void {
    this.iconSubject.next({
      name: this._name,
      size: this._size,
      filled: this._filled
    });
  }
  private getIconSvg(name: string, size: number, filled: boolean): Observable<SafeHtml> {
    // Convert legacy icon names to the new format
    const iconName = this.mapLegacyIconName(name);
    const variant = filled ? 'filled' : 'regular';
    const cacheKey = `${iconName}_${size}_${variant}`;
    
    // Check cache first
    if (IconComponent.iconCache.has(cacheKey)) {
      return IconComponent.iconCache.get(cacheKey)!;
    }    // Convert to title case for folder name (e.g., 'settings' -> 'Settings')
    const titleCaseName = this.toTitleCase(iconName);
    // Format the file name (e.g., 'ic_fluent_settings_20_regular.svg')
    const fileName = `ic_fluent_${iconName}_${size}_${variant}.svg`;
    // Use GitHub repository directly for icon source with correct folder structure
    const githubUrl = `https://raw.githubusercontent.com/microsoft/fluentui-system-icons/main/assets/${encodeURIComponent(titleCaseName)}/SVG/${fileName}`;
    
    // Fetch the icon and sanitize the SVG
    const icon$ = this.http.get(githubUrl, { responseType: 'text' }).pipe(
      map(svg => this.processAndSanitizeSvg(svg, size)),      catchError(() => {
        console.warn(`Icon not found at: ${githubUrl}`);
        // Return a placeholder icon
        return of(this.sanitizer.bypassSecurityTrustHtml(this.getPlaceholderIcon(size)));
      }),
      shareReplay(1)
    );

    // Store in cache
    IconComponent.iconCache.set(cacheKey, icon$);
    return icon$;
  }

  private processAndSanitizeSvg(svg: string, size: number): SafeHtml {
    // Ensure proper size attributes
    svg = svg.replace(/width="[^"]*"/, `width="${size}"`);
    svg = svg.replace(/height="[^"]*"/, `height="${size}"`);

    // Fix current color if not present
    if (!svg.includes('fill="currentColor"') && !svg.includes('fill="none"')) {
      svg = svg.replace(/<svg/, '<svg fill="currentColor"');
    }

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  private getPlaceholderIcon(size: number): string {
    return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <path d="M7.5 9H12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7.5 12H12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Maps old icon names to the official Fluent UI icon naming convention
   */
  private mapLegacyIconName(name: string): string {
    // Mapping of legacy icon names to official Fluent UI icon names
    const iconMapping: Record<string, string> = {
      // Settings and configuration
      'settings': 'settings',
      
      // Font and text controls
      'font_decrease': 'text_font_size',
      'font_size': 'text_font_size',
      'font_increase': 'text_font_size',
      
      // Theme controls
      'weather_moon': 'weather_moon',
      'weather_sunny': 'weather_sunny',
      
      // Navigation
      'chevron_left': 'chevron_left',
      'chevron_right': 'chevron_right',
      'chevron_up': 'chevron_up',
      'chevron_down': 'chevron_down',
      'chevron_double_left': 'chevron_double_left',
      'chevron_double_right': 'chevron_double_right',
      'arrow_left': 'arrow_left',
      'arrow_right': 'arrow_right',
      'arrow_up': 'arrow_up', 
      'arrow_down': 'arrow_down',
      'arrow_download': 'arrow_download',
      'arrow_sync_circle': 'arrow_sync_circle',
      
      // Actions
      'search': 'search',
      'dismiss': 'dismiss',
      'copy': 'copy',
      'open': 'open',
      'open_in_new': 'open',
      'add': 'add',
      'delete': 'delete',
      'edit': 'edit',
      'refresh': 'arrow_clockwise',
      
      // Content
      'document': 'document',
      'folder': 'folder',
      'folder_open': 'folder_open',
      
      // Status
      'info': 'info',
      'warning': 'warning',
      'error': 'error_circle',
      
      // UI
      'home': 'home',
      'list': 'list',
      'menu': 'line_horizontal_3'
    };
      return iconMapping[name] || name;
  }
  /**
   * Converts a string to title case for folder names (e.g., 'settings' -> 'Settings', 'arrow_sync_circle' -> 'Arrow Sync Circle')
   */
  private toTitleCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
