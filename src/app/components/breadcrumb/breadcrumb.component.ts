import { Component, OnInit, ViewEncapsulation, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, switchMap } from 'rxjs/operators';
import { Observable, of, forkJoin } from 'rxjs';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ModelService } from '../../services/model.service';
import { RegistryService } from '../../services/registry.service';
import { RoutePersistenceService } from '../../services/route-persistence.service';

@Component({
  standalone: true,
  selector: 'app-breadcrumb',
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
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
      switchMap(() => {
        const segments = this.router.url.split('/').filter((seg: string) => seg);
        return this.modelService.getRegistryModel().pipe(
          switchMap(model => {
            const observables = segments.map((seg: string, idx: number) => {
              const url = '/' + segments.slice(0, idx + 1).join('/');
              if (idx === 0) {
                // group type
                const grp = model.groups[seg];
                return of({ label: grp?.plural || seg, url });
              }
              if (idx === 1) {
                // group id
                return this.registryService.getGroup(segments[0], seg).pipe(
                  map(g => ({ label: g.name || seg, url }))
                );
              }
              if (idx === 2) {
                // resource type
                const resType = model.groups[segments[0]]?.resources[seg];
                return of({ label: resType?.plural || seg, url });
              }
              if (idx === 3) {
                // resource id
                return this.registryService.getResource(
                  segments[0],
                  segments[1],
                  segments[2],
                  seg
                ).pipe(map(r => ({ label: r.name || seg, url })));
              }
              if (seg === 'versions') {
                return of({ label: 'Versions', url });
              }
              // version id or fallback
              return of({ label: seg, url });
            });
            return forkJoin(observables);
          })
        );
      })
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
}
