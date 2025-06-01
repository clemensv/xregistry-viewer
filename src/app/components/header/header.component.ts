import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ThemeService, FontSize, Theme } from '../../services/theme.service';
import { SearchComponent } from '../search/search.component';
import { IconComponent } from '../icon/icon.component';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [RouterModule, CommonModule, SearchComponent, IconComponent, BreadcrumbComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  currentFontSize: FontSize = 'medium';
  currentTheme: Theme = 'light';
  fontMenuOpen = false;

  private destroy$ = new Subject<void>();

  constructor(private themeService: ThemeService, private router: Router) {}

  ngOnInit(): void {
    this.themeService.fontSize$
      .pipe(takeUntil(this.destroy$))
      .subscribe(fontSize => this.currentFontSize = fontSize);

    this.themeService.theme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => this.currentTheme = theme);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setFontSize(fontSize: FontSize): void {
    this.themeService.setFontSize(fontSize);
  }

  getFontSizeIcon(): string {
    switch (this.currentFontSize) {
      case 'small': return 'font_decrease';
      case 'medium': return 'font_size';
      case 'large': return 'font_increase';
      default: return 'font_size';
    }
  }

  toggleTheme(): void {
    const newTheme: Theme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.themeService.setTheme(newTheme);
  }

  navigateToConfig(): void {
    this.router.navigate(['/config']);
  }
}
