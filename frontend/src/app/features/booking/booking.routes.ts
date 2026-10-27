import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const BOOKING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./wizard-new/booking-wizard-new.component').then((m) => m.BookingWizardNewComponent),
    canActivate: [authGuard],
  },
];
