import { Routes } from '@angular/router';

export const routes: Routes = [
  // ── Public landing — home page
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
    pathMatch: 'full',
  },

  // ── Info pages ──────────────────────────────────────────────────────────────
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'contact',
    loadComponent: () => import('./features/contact/contact.component').then((m) => m.ContactComponent),
  },
  {
    path: 'faq',
    loadComponent: () => import('./features/faq/faq.component').then((m) => m.FaqComponent),
  },
  {
    path: 'blog',
    loadChildren: () =>
      import('./features/health-tips/health-tips.routes').then((m) => m.HEALTH_TIPS_ROUTES),
  },
  {
    path: 'health-tips',
    pathMatch: 'full',
    redirectTo: 'blog',
  },
  {
    path: 'health-tips/:slug',
    redirectTo: 'blog/:slug',
  },
  {
    path: 'home-sample-collection',
    loadComponent: () =>
      import('./features/home-sample-collection/home-sample-collection.component').then(
        (m) => m.HomeSampleCollectionComponent,
      ),
  },

  // ── Legal / compliance pages (static, public) ───────────────────────────────
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./features/legal/privacy-policy/privacy-policy.component').then((m) => m.PrivacyPolicyComponent),
  },
  {
    path: 'terms-of-service',
    loadComponent: () =>
      import('./features/legal/terms-of-service/terms-of-service.component').then((m) => m.TermsOfServiceComponent),
  },
  {
    path: 'refund-and-cancellation',
    loadComponent: () =>
      import('./features/legal/refund-cancellation/refund-cancellation.component').then((m) => m.RefundCancellationComponent),
  },
  {
    path: 'disclaimer',
    loadComponent: () =>
      import('./features/legal/disclaimer/disclaimer.component').then((m) => m.DisclaimerComponent),
  },

  // ── Public routes (no login required) ──────────────────────────────────────
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'tests',
    loadChildren: () =>
      import('./features/tests/tests.routes').then((m) => m.TESTS_ROUTES),
  },
  {
    path: 'packages',
    loadChildren: () =>
      import('./features/packages/packages.routes').then((m) => m.PACKAGES_ROUTES),
  },

  // ── Protected routes (login required) ──────────────────────────────────────
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'booking',
    loadChildren: () =>
      import('./features/booking/booking.routes').then((m) => m.BOOKING_ROUTES),
  },
  {
    path: 'reports',
    loadChildren: () =>
      import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    path: 'payments',
    loadChildren: () =>
      import('./features/payments/payments.routes').then((m) => m.PAYMENTS_ROUTES),
  },
  {
    path: 'bookings',
    loadChildren: () =>
      import('./features/bookings/bookings.routes').then((m) => m.BOOKINGS_ROUTES),
  },

  // ── Admin only ──────────────────────────────────────────────────────────────
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },

  // ── Lab locations (public) ───────────────────────────────────────────────────
  {
    path: 'lab-locations',
    loadComponent: () => import('./features/lab-locations/lab-locations.component').then((m) => m.LabLocationsComponent),
  },

  // ── Available locations / service coverage (public) ─────────────────────────
  {
    path: 'available-locations',
    loadComponent: () => import('./features/available-locations/available-locations.component').then((m) => m.AvailableLocationsComponent),
  },

  // ── Technician only ─────────────────────────────────────────────────────────
  {
    path: 'technician',
    loadChildren: () =>
      import('./features/technician/technician.routes').then((m) => m.TECHNICIAN_ROUTES),
  },

  {
    path: '**',
    redirectTo: 'tests',
  },
];
