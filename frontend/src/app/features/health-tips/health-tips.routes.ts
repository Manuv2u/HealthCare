import { Routes } from '@angular/router';

/** Static, public Health Tips & Insights pages (listing + per-article read-more). */
export const HEALTH_TIPS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./health-tips-list.component').then((m) => m.HealthTipsListComponent),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./health-tips-detail.component').then((m) => m.HealthTipsDetailComponent),
  },
];
