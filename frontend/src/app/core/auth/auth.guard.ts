import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthStateService } from './auth-state.service';

export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const auth = inject(AuthStateService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Save the attempted URL so we can redirect back after login
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/** Landing route for an authenticated user based on their role. */
export const homeUrlForRole = (role: string | null): string => {
  switch (role) {
    case 'admin': return '/admin/dashboard';
    case 'technician': return '/technician';
    default: return '/dashboard';
  }
};

export const roleGuard = (allowedRoles: string[]): CanActivateFn => (_route, state) => {
  const auth = inject(AuthStateService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
  }

  const role = auth.role();
  if (role && allowedRoles.includes(role)) {
    return true;
  }
  // Authenticated but wrong role → send to their own home, not an arbitrary page
  return router.createUrlTree([homeUrlForRole(role)]);
};

// Redirect already-authenticated users away from auth pages
export const redirectIfAuthenticated: CanActivateFn = () => {
  const auth = inject(AuthStateService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return router.createUrlTree([homeUrlForRole(auth.role())]);
  }
  return true;
};
