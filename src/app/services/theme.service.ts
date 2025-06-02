import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

export type FontSize = 'small' | 'medium' | 'large';
export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly FONT_SIZE_KEY = 'app-font-size';
  private readonly THEME_KEY = 'app-theme';

  private fontSizeSubject = new BehaviorSubject<FontSize>('medium');
  private themeSubject = new BehaviorSubject<Theme>('light');

  public fontSize$: Observable<FontSize> = this.fontSizeSubject.asObservable();
  public theme$: Observable<Theme> = this.themeSubject.asObservable();

  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loadSettings();
    this.applySettings();
  }

  private loadSettings(): void {
    if (!this.isBrowser) return;

    const savedFontSize = localStorage.getItem(this.FONT_SIZE_KEY) as FontSize;
    const savedTheme = localStorage.getItem(this.THEME_KEY) as Theme;

    if (savedFontSize && ['small', 'medium', 'large'].includes(savedFontSize)) {
      this.fontSizeSubject.next(savedFontSize);
    }

    if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
      this.themeSubject.next(savedTheme);
    }
  }

  private applySettings(): void {
    if (!this.isBrowser) return;

    // Apply font size class
    this.fontSize$.subscribe(fontSize => {
      this._applyFontSizeToBody(fontSize);
    });

    // Apply theme class
    this.theme$.subscribe(theme => {
      this._applyThemeToBody(theme);
    });
  }

  private _applyFontSizeToBody(fontSize: FontSize): void {
    if (!this.isBrowser) return;
    document.body.className = document.body.className.replace(/font-size-\w+/g, '');
    document.body.classList.add(`font-size-${fontSize}`);
  }

  private _applyThemeToBody(theme: Theme): void {
    if (!this.isBrowser) return;
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${theme}`);
  }

  setFontSize(fontSize: FontSize): void {
    if (!this.isBrowser) return;

    this.fontSizeSubject.next(fontSize);
    localStorage.setItem(this.FONT_SIZE_KEY, fontSize);
    this._applyFontSizeToBody(fontSize);
  }

  setTheme(theme: Theme): void {
    if (!this.isBrowser) return;

    this.themeSubject.next(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this._applyThemeToBody(theme);
  }

  getCurrentFontSize(): FontSize {
    return this.fontSizeSubject.value;
  }

  getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }
}
