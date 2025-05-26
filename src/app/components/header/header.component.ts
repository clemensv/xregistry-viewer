import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ThemeService, FontSize, Theme } from '../../services/theme.service';
import { SearchComponent } from '../search/search.component';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [MatToolbarModule, MatButtonModule, MatMenuModule, RouterModule, MatIconModule, CommonModule, SearchComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  currentFontSize: FontSize = 'medium';
  currentTheme: Theme = 'light';

  private destroy$ = new Subject<void>();

  constructor(private themeService: ThemeService) {}

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

  toggleTheme(): void {
    const newTheme: Theme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.themeService.setTheme(newTheme);
  }
}
