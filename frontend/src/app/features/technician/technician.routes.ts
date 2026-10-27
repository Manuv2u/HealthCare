import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';

export const TECHNICIAN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./technician-shell.component').then((m) => m.TechnicianShellComponent),
    canActivate: [roleGuard(['technician'])],
    children: [
      {
        path: '',
        redirectTo: 'bookings',
        pathMatch: 'full',
      },
      {
        path: 'bookings',
        loadComponent: () => import('./bookings/technician-bookings.component').then((m) => m.TechnicianBookingsComponent),
        canActivate: [roleGuard(['technician'])],
      },
    ],
  },
];
