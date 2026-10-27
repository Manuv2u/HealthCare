import { Routes } from '@angular/router';

export const TESTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./test-catalog/test-catalog.component').then((m) => m.TestCatalogComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./test-detail/test-detail.component').then((m) => m.TestDetailComponent),
  },
];
