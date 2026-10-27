import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./reports-list/reports-list.component').then((m) => m.ReportsListComponent),
    canActivate: [authGuard],
  },
];
