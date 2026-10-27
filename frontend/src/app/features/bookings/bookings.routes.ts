import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const BOOKINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./booking-history/booking-history.component').then(m => m.BookingHistoryComponent),
    canActivate: [authGuard],
  },
  {
    path: ':id',
    loadComponent: () => import('./booking-detail/booking-detail.component').then(m => m.BookingDetailComponent),
    canActivate: [authGuard],
  },
];
