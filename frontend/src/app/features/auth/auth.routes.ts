import { Routes } from '@angular/router';
import { redirectIfAuthenticated, authGuard } from '../../core/auth/auth.guard';

export const AUTH_ROUTES: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [redirectIfAuthenticated],
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [redirectIfAuthenticated],
    loadComponent: () => import('./register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
  },
  {
    path: 'verify-otp',
    loadComponent: () => import('./otp-verify/otp-verify.component').then((m) => m.OtpVerifyComponent),
  },
  // TODO(TEMP_PASSWORD_AUTH): Remove these three routes when replacing password-based auth
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () => import('./change-password/change-password.component').then((m) => m.ChangePasswordComponent),
  },
];
