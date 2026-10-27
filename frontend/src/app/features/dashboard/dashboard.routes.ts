import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/auth/auth.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'bookings',
    pathMatch: 'full',
  },
  {
    path: 'technician',
    loadComponent: () => import('./technician-dashboard/technician-dashboard.component').then(m => m.TechnicianDashboardComponent),
    canActivate: [authGuard, roleGuard(['technician'])]
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin-dashboard-new/admin-dashboard-new.component').then(m => m.AdminDashboardNewComponent),
    canActivate: [authGuard, roleGuard(['admin'])]
  },
  {
    path: 'bookings',
    loadComponent: () => import('../bookings/booking-history/booking-history.component').then(m => m.BookingHistoryComponent),
    canActivate: [authGuard],
  },
  {
    path: 'bookings/:id',
    loadComponent: () => import('../bookings/booking-detail/booking-detail.component').then(m => m.BookingDetailComponent),
    canActivate: [authGuard],
  }
];
