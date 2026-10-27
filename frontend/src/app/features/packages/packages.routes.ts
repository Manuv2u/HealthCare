import { Routes } from '@angular/router';

export const PACKAGES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./packages-list/packages-list.component').then((m) => m.PackagesListComponent),
  },
];
