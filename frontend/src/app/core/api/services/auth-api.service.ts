import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthTokens } from '../api.types';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  constructor(private http: HttpClient) {}

  loginOtp(phone: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/auth/login-otp', { phone });
  }

  register(name: string, phone: string, email: string, password: string): Observable<{ message: string; email: string }> {
    return this.http.post<{ message: string; email: string }>('/auth/register', { name, phone, email, password });
  }

  verifyOtp(phone: string, otp: string, name?: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>('/auth/verify-otp', { phone, otp, name });
  }

  verifyEmailOtp(email: string, otp: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>('/auth/verify-email-otp', { email, otp });
  }

  resendVerificationOtp(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/auth/resend-verification-otp', { email });
  }

  login(phone_or_email: string, password: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>('/auth/login', { phone_or_email, password });
  }

  logout(): Observable<void> {
    return this.http.post<void>('/auth/logout', {});
  }

  refresh(refresh_token: string): Observable<{ access_token: string }> {
    return this.http.post<{ access_token: string }>('/auth/refresh', { refresh_token });
  }

  // TODO(TEMP_PASSWORD_AUTH): Remove these methods when replacing password-based auth
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string, confirm_password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/auth/reset-password', { token, password, confirm_password });
  }

  changePassword(current_password: string, new_password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/auth/change-password', { current_password, new_password });
  }
}
