import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/auth/auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-shell.component').then(m => m.AdminShellComponent),
    canActivate: [authGuard, roleGuard(['admin'])],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',          loadComponent: () => import('./dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
      { path: 'users',              loadComponent: () => import('./users/admin-users.component').then(m => m.AdminUsersComponent) },
      { path: 'users/:id',          loadComponent: () => import('./users/admin-user-detail.component').then(m => m.AdminUserDetailComponent) },
      { path: 'tests',              loadComponent: () => import('./tests/admin-tests.component').then(m => m.AdminTestsComponent) },
      { path: 'packages',           loadComponent: () => import('./packages/admin-packages.component').then(m => m.AdminPackagesComponent) },
      { path: 'technicians',        loadComponent: () => import('./technicians/admin-technicians.component').then(m => m.AdminTechniciansComponent) },
      { path: 'bookings',           loadComponent: () => import('./bookings/admin-bookings.component').then(m => m.AdminBookingsComponent) },
      { path: 'appointment-calendar', loadComponent: () => import('./appointment-calendar/admin-appointment-calendar.component').then(m => m.AdminAppointmentCalendarComponent) },
      { path: 'lab-branches',       loadComponent: () => import('./lab-branches/admin-lab-branches.component').then(m => m.AdminLabBranchesComponent) },
      { path: 'service-areas',      loadComponent: () => import('./service-areas/admin-service-areas.component').then(m => m.AdminServiceAreasComponent) },
      { path: 'analytics',          loadComponent: () => import('./analytics/admin-analytics.component').then(m => m.AdminAnalyticsComponent) },
      { path: 'cancellation-config',loadComponent: () => import('./cancellation-config/admin-cancellation-config.component').then(m => m.AdminCancellationConfigComponent) },
      { path: 'contact-settings',   loadComponent: () => import('./contact-settings/admin-contact-settings.component').then(m => m.AdminContactSettingsComponent) },
      { path: 'payment-management', loadComponent: () => import('./payment-management/admin-payment-management.component').then(m => m.AdminPaymentManagementComponent) },
      { path: 'otp-management',     loadComponent: () => import('./otp-management/admin-otp-management.component').then(m => m.AdminOtpManagementComponent) },
      { path: 'invoices',           loadComponent: () => import('./invoices/admin-invoices.component').then(m => m.AdminInvoicesComponent) },
      { path: 'billing-settings',   loadComponent: () => import('./billing-settings/admin-billing-settings.component').then(m => m.AdminBillingSettingsComponent) },
      { path: 'feature-flags',      loadComponent: () => import('./feature-flags/admin-feature-flags.component').then(m => m.AdminFeatureFlagsComponent) },
      { path: 'health-concerns',    loadComponent: () => import('./health-concerns/admin-health-concerns.component').then(m => m.AdminHealthConcernsComponent) },
      { path: 'banners',            loadComponent: () => import('./banners/admin-banners.component').then(m => m.AdminBannersComponent) },
      { path: 'coupons',            loadComponent: () => import('./coupons/admin-coupons.component').then(m => m.AdminCouponsComponent) },
      { path: 'faqs',               loadComponent: () => import('./faqs/admin-faqs.component').then(m => m.AdminFaqsComponent) },
      { path: 'callback-requests',  loadComponent: () => import('./callback-requests/admin-callback-requests.component').then(m => m.AdminCallbackRequestsComponent) },
      { path: 'prescription-requests', loadComponent: () => import('./prescription-requests/admin-prescription-requests.component').then(m => m.AdminPrescriptionRequestsComponent) },
    ],
  },
];
