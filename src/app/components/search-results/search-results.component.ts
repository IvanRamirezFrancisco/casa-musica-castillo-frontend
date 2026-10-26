import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SearchService, SearchResult } from '../../services/search.service';
import { PublicProduct } from '../../models/product.model';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './search-results.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./search-results.component.css']
})
export class SearchResultsComponent implements OnInit, OnDestroy {
  searchQuery = '';
  searchResults: PublicProduct[] = [];
  totalResults = 0;
  executionTime = 0;
  isLoading = true;
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private searchService: SearchService
  ) {}

  ngOnInit(): void {
    // Obtener query parameter
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      this.searchQuery = params['q'] || '';
      if (this.searchQuery.trim()) {
        this.performSearch();
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  performSearch(): void {
    this.isLoading = true;
    
    this.searchService.search(this.searchQuery).subscribe({
      next: (result: SearchResult | any[]) => {
        if (Array.isArray(result)) {
          this.searchResults = [];
          this.totalResults = 0;
        } else {
          this.searchResults = result.products;
          this.totalResults = result.totalResults;
          this.executionTime = result.executionTime;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error en búsqueda:', err);
        this.searchResults = [];
        this.isLoading = false;
      }
    });
  }

  viewProductDetail(product: PublicProduct): void {
    this.router.navigate(['/producto', product.id]);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
