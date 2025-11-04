import { Component, OnInit, ViewEncapsulation, AfterViewInit, Inject, PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, switchMap, catchError, startWith } from 'rxjs/operators';
import { Observable, of, forkJoin } from 'rxjs';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ModelService } from '../../services/model.service';
import { RegistryService } from '../../services/registry.service';
import { RoutePersistenceService } from '../../services/route-persistence.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  standalone: true,
  selector: 'app-breadcrumb',
  imports: [CommonModule, RouterModule, IconComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss'],
  encapsulation: ViewEncapsulation.None // This is critical for global styles to be applied
})
export class BreadcrumbComponent implements OnInit, AfterViewInit {
  breadcrumbs$!: Observable<{ label: string; url: string }[]>;
  private isBrowser: boolean;

  constructor(
    private router: Router,
    private modelService: ModelService,
    private registryService: RegistryService,
    private routePersistenceService: RoutePersistenceService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  ngOnInit(): void {
    this.breadcrumbs$ = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      startWith({ urlAfterRedirects: this.router.url } as NavigationEnd), // Trigger immediately with current URL
      switchMap(() => {
        const segments = this.router.url.split('/').filter((seg: string) => seg);

        console.log('Breadcrumb: Building breadcrumbs for URL:', this.router.url, 'segments:', segments);

        // If no segments, return empty breadcrumbs
        if (segments.length === 0) {
          return of([]);
        }

        return this.modelService.getRegistryModel().pipe(
          switchMap(model => {
            const observables = segments.map((seg: string, idx: number) => {
              const url = '/' + segments.slice(0, idx + 1).join('/');

              try {
                if (idx === 0) {
                  // group type - use model data with fallback to segment
                  const grp = model.groups?.[seg];
                  const label = grp?.plural || seg;
                  console.log(`Breadcrumb: Group type ${seg} -> ${label}`);
                  return of({ label, url });
                }
                if (idx === 1) {
                  // group id - try API call with fallback to segment
                  console.log(`Breadcrumb: Loading group ${segments[0]}/${seg}`);
                  return this.registryService.getGroup(segments[0], seg).pipe(
                    map(g => {
                      const label = g.name || seg;
                      console.log(`Breadcrumb: Group ${segments[0]}/${seg} -> ${label}`);
                      return { label, url };
                    }),
                    catchError((error) => {
                      console.warn(`Breadcrumb: Failed to load group ${segments[0]}/${seg}:`, error.status || error.message);
                      return of({ label: seg, url });
                    })
                  );
                }
                if (idx === 2) {
                  // resource type - use model data with fallback to segment
                  const resType = model.groups?.[segments[0]]?.resources?.[seg];
                  const label = resType?.plural || seg;
                  console.log(`Breadcrumb: Resource type ${seg} -> ${label}`);
                  return of({ label, url });
                }                if (idx === 3) {
                  // resource id - try API call with fallback to segment
                  return this.registryService.getResource(
                    segments[0],
                    segments[1],
                    segments[2],
                    seg
                  ).pipe(
                    map(r => {
                      // Check if the API response name looks like a filename (contains common file extensions)
                      const isFilename = r.name && /\.(yaml|yml|json|xml|txt|md|html|pdf|doc|xls)$/i.test(r.name);
                      // Use URL segment if name looks like a filename, otherwise use API response name
                      const label = (isFilename || !r.name) ? seg : r.name;
                      return { label, url };
                    }),
                    catchError((error) => {
                      console.warn(`Breadcrumb: Failed to load resource ${segments[0]}/${segments[1]}/${segments[2]}/${seg}:`, error.status || error.message);
                      return of({ label: seg, url });
                    })
                  );
                }
                if (seg === 'versions') {
                  console.log(`Breadcrumb: Versions segment`);
                  return of({ label: 'Versions', url });
                }
                // version id or other fallback - always use segment as label
                console.log(`Breadcrumb: Generic segment ${seg}`);
                return of({ label: seg, url });
              } catch (error) {
                console.warn(`Breadcrumb: Error processing segment ${idx} (${seg}):`, error);
                return of({ label: seg, url });
              }
            });

            return forkJoin(observables);
          }),
          catchError((error) => {
            // If model loading fails, create breadcrumbs from URL segments only
            console.warn('Breadcrumb: Model loading failed, using URL segments as labels:', error);
            const segments = this.router.url.split('/').filter((seg: string) => seg);
            const fallbackBreadcrumbs = segments.map((seg: string, idx: number) => {
              const url = '/' + segments.slice(0, idx + 1).join('/');
              return { label: seg, url };
            });
            console.log('Breadcrumb: Fallback breadcrumbs:', fallbackBreadcrumbs);
            return of(fallbackBreadcrumbs);
          })
        );
      }),
      catchError((error) => {
        // Final fallback - if everything fails, at least show the current page
        console.error('Breadcrumb: Complete failure, using current URL:', error);
        const segments = this.router.url.split('/').filter((seg: string) => seg);
        if (segments.length > 0) {
          const lastSegment = segments[segments.length - 1];
          return of([{ label: lastSegment, url: this.router.url }]);
        }
        return of([]);      })
    );
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      console.log('Breadcrumb structure:', document.querySelector('app-breadcrumb'));
      console.log('Breadcrumb items:', document.querySelectorAll('.breadcrumb-item'));
    }
  }

  /**
   * Handle navigation to home - clear stored route so users stay on home
   */
  onHomeClick(): void {
    this.routePersistenceService.clearStoredRoute();
    this.router.navigate(['/']);
  }

  /**
   * Handle keyboard events for home button accessibility
   */
  onHomeKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onHomeClick();
    }
  }
}
