import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuthStateService } from '../auth/auth-state.service';

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStateService);
  const router = inject(Router);
  const http = inject(HttpClient);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // /auth/login's own 401 (wrong credentials) is not an expired session —
      // there was never one to expire. Let the login form show its own error.
      if (err.status === 401 && !req.url.includes('/auth/refresh') && !req.url.includes('/auth/login')) {
        const refreshToken = auth.getRefreshToken();
        if (refreshToken) {
          return http.post<{ access_token: string }>('/auth/refresh', { refresh_token: refreshToken }).pipe(
            switchMap((res) => {
              auth.setTokens(res.access_token, refreshToken);
              // Also restore user from new token
              try {
                const payload = JSON.parse(atob(res.access_token.split('.')[1]));
                auth.setUser({ id: payload.sub, name: payload.name ?? '', role: payload.role });
              } catch { /* ignore */ }
              return next(req.clone({
                setHeaders: { Authorization: `Bearer ${res.access_token}` },
              }));
            }),
            catchError(() => {
              auth.clearSession();
              router.navigate(['/auth/login'], {
                queryParams: { message: 'Session expired, please log in again' },
              });
              return throwError(() => err);
            }),
          );
        }
        auth.clearSession();
        router.navigate(['/auth/login'], {
          queryParams: { message: 'Session expired, please log in again' },
        });
      }
      return throwError(() => err);
    }),
  );
};
