import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, FormGroup } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthApiService } from '../../../core/api/services/auth-api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, MatIconModule],
  template: `
    <div class="auth-shell">
      <a routerLink="/" class="auth-back" aria-label="Back to home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        <span>Home</span>
      </a>

      <div class="auth-bg" aria-hidden="true">
        <span class="blob blob--1"></span>
        <span class="blob blob--2"></span>
        <span class="blob blob--3"></span>
      </div>

      <div class="auth-stage">
        <!-- ── Showcase ── -->
        <section class="auth-showcase">
          <a routerLink="/" class="brand" aria-label="Sri Health Plus home">
            <span class="brand-logo"><img src="assets/logo-mark.png" alt="" /></span>
            <span class="brand-text">
              <span class="brand-name">Sri Health Plus</span>
              <span class="brand-tag">Diagnostic Laboratory</span>
            </span>
          </a>

          <div class="showcase-body">
            <span class="eyebrow">Almost there</span>
            <h1 class="showcase-title">Set a new,<br/><span class="grad">stronger password.</span></h1>
            <p class="showcase-sub">
              Choose a password you don't use anywhere else. We'll have you back to managing
              your health in seconds.
            </p>

            <ul class="trust-list">
              <li class="trust-chip trust-chip--blue">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></i>
                Encrypted &amp; Private
              </li>
              <li class="trust-chip trust-chip--emerald">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></i>
                NABL Certified Labs
              </li>
              <li class="trust-chip trust-chip--cyan">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></i>
                Reports in 24-48h
              </li>
              <li class="trust-chip trust-chip--violet">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></i>
                Home Sample Collection
              </li>
            </ul>
          </div>
        </section>

        <!-- ── Panel ── -->
        <section class="auth-panel-wrap">
          <div class="auth-panel">
            <a routerLink="/" class="panel-brand">
              <span class="brand-logo"><img src="assets/logo-mark.png" alt="" /></span>
              <span class="brand-name">Sri Health Plus</span>
            </a>

            @if (!success()) {
              <div class="panel-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"/></svg>
              </div>

              <div class="panel-head">
                <h2 class="panel-title">Reset your password</h2>
                <p class="panel-sub">Create a strong password with at least 8 characters.</p>
              </div>

              @if (error()) {
                <div class="alert alert--error" role="alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <span>{{ error() }}</span>
                  <button type="button" class="alert-x" aria-label="Dismiss" (click)="error.set(null)">&times;</button>
                </div>
              }

              <form [formGroup]="resetForm" (ngSubmit)="submit()" class="auth-form" novalidate>
                <div class="field" [class.field--invalid]="resetForm.get('password')?.invalid && resetForm.get('password')?.touched">
                  <div class="field-control">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <input id="password" [type]="showNew() ? 'text' : 'password'" formControlName="password" placeholder=" " autocomplete="new-password" />
                    <label for="password">New password</label>
                    <button type="button" class="field-eye" [attr.aria-label]="showNew() ? 'Hide password' : 'Show password'" (click)="showNew.set(!showNew())">
                      @if (showNew()) {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      } @else {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  @if (resetForm.get('password')?.invalid && resetForm.get('password')?.touched) {
                    <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{{ getPasswordError() }}</p>
                  } @else {
                    <p class="field-msg">At least 8 characters, with upper &amp; lower case, a number and a special character.</p>
                  }
                </div>

                <div class="field" [class.field--invalid]="resetForm.get('confirmPassword')?.invalid && resetForm.get('confirmPassword')?.touched">
                  <div class="field-control">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <input id="confirmPassword" type="password" formControlName="confirmPassword" placeholder=" " autocomplete="new-password" />
                    <label for="confirmPassword">Confirm new password</label>
                  </div>
                  @if (resetForm.get('confirmPassword')?.invalid && resetForm.get('confirmPassword')?.touched) {
                    <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Passwords do not match</p>
                  }
                </div>

                <button type="submit" class="btn btn-primary" [disabled]="loading() || resetForm.invalid">
                  @if (loading()) {
                    <svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    <span>Resetting…</span>
                  } @else {
                    <span>Reset Password</span>
                    <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  }
                </button>
              </form>

              <div class="auth-alt" style="margin-top:22px">
                <a routerLink="/auth/login" class="back-link">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                  Back to sign in
                </a>
              </div>
            } @else {
              <div class="state">
                <div class="state-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h2 class="state-title">Password reset complete</h2>
                <p class="state-text">Your password has been updated successfully. You can now sign in with your new password.</p>
                <button type="button" class="btn btn-primary" (click)="goToLogin()">
                  <span>Continue to Sign In</span>
                  <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
              </div>
            }
          </div>

          <p class="panel-legal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            256-bit encrypted • Your data stays private
          </p>
        </section>
      </div>
    </div>
  `,
  styleUrls: ['../auth-theme.scss']
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authApi = inject(AuthApiService);

  token = '';
  readonly currentYear = new Date().getFullYear();

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);
  showNew = signal(false);

  resetForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8), this.passwordStrength]],
    confirmPassword: ['', Validators.required]
  }, {
    validators: this.passwordMatchValidator
  });

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        this.router.navigate(['/auth/forgot-password']);
      }
    });
  }

  passwordStrength(control: AbstractControl): { [key: string]: boolean } | null {
    const value = control.value;
    if (!value) return null;
    if (!/[A-Z]/.test(value)) return { noUppercase: true };
    if (!/[a-z]/.test(value)) return { noLowercase: true };
    if (!/\d/.test(value)) return { noNumber: true };
    if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?/]/.test(value)) return { noSpecialChar: true };
    return null;
  }

  passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
      group.get('confirmPassword')?.setErrors({ mismatch: true });
      return { mismatch: true };
    }
    return null;
  }

  getPasswordError(): string {
    const control = this.resetForm.get('password');
    if (control?.hasError('required')) return 'Password is required';
    if (control?.hasError('minlength')) return 'Password must be at least 8 characters';
    if (control?.hasError('noUppercase')) return 'Password must contain at least one uppercase letter';
    if (control?.hasError('noLowercase')) return 'Password must contain at least one lowercase letter';
    if (control?.hasError('noNumber')) return 'Password must contain at least one number';
    if (control?.hasError('noSpecialChar')) return 'Password must contain at least one special character';
    return 'Invalid password';
  }

  submit(): void {
    if (this.resetForm.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const password = this.resetForm.value.password!;
    const confirmPassword = this.resetForm.value.confirmPassword!;

    this.authApi.resetPassword(this.token, password, confirmPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err.error?.detail;
        const message = typeof detail === 'string' ? detail : detail?.message;
        this.error.set(message || 'Failed to reset password. The link may have expired.');
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
