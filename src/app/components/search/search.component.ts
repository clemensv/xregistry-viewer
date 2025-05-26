import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PaginationService } from '../../services/pagination.service';

@Component({
  standalone: true,
  selector: 'app-search',
  imports: [CommonModule, FormsModule, MatInputModule, MatFormFieldModule, MatIconModule, MatButtonModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  searchVisible = false;
  searchTerm = '';
  private destroy$ = new Subject<void>();

  constructor(private paginationService: PaginationService) { }
  ngOnInit(): void {
    // Subscribe to search enabled status
    this.paginationService.searchEnabled$
      .pipe(takeUntil(this.destroy$))
      .subscribe(enabled => {
        console.log('Search component received enabled status:', enabled);
        this.searchVisible = enabled;
        if (!enabled) {
          this.searchTerm = ''; // Clear search term when disabled
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(): void {
    this.paginationService.searchTerm(this.searchTerm);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.paginationService.searchTerm('');
  }
}
