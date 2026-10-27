// TODO(TEMP_PASSWORD_AUTH): Remove this component when replacing password-based auth.
import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthApiService } from '../../../core/api/services/auth-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const pw = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return pw && confirm && pw !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-change-password',
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

      <div class="solo">
        <section class="auth-panel-wrap">
          <div class="auth-panel">
            @if (!firstLogin) {
              <button class="panel-back" (click)="goBack()" type="button" aria-label="Go back">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
            }

            <a routerLink="/" class="panel-brand">
              <span class="brand-logo"><img src="assets/logo-mark.png" alt="" /></span>
              <span class="brand-name">Sri Health Plus</span>
            </a>

            <div class="panel-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </div>

            <div class="panel-head">
              <h2 class="panel-title">{{ firstLogin ? 'Set your password' : 'Change password' }}</h2>
              <p class="panel-sub">{{ firstLogin ? 'You are using a temporary password. Please set a new one to continue.' : 'Update your account password to keep it secure.' }}</p>
            </div>

            @if (firstLogin && !success()) {
              <div class="alert alert--info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Enter the temporary password you were given as your current password.</span>
              </div>
            }

            @if (success()) {
              <div class="state">
                <div class="state-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h2 class="state-title">{{ firstLogin ? 'Password set!' : 'Password changed!' }}</h2>
                <p class="state-text">{{ firstLogin ? 'Redirecting you to your dashboard…' : 'Your password has been updated successfully.' }}</p>
              </div>
            } @else {
              @if (error()) {
                <div class="alert alert--error" role="alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <span>{{ error() }}</span>
                </div>
              }

              <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form" novalidate>
                <div class="field" [class.field--invalid]="form.get('currentPassword')?.invalid && form.get('currentPassword')?.touched">
                  <div class="field-control">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <input id="currentPassword" formControlName="currentPassword" [type]="showCurrent ? 'text' : 'password'" placeholder=" " autocomplete="current-password" />
                    <label for="currentPassword">Current password</label>
                    <button type="button" class="field-eye" (click)="showCurrent = !showCurrent" [attr.aria-label]="showCurrent ? 'Hide password' : 'Show password'" tabindex="-1">
                      @if (showCurrent) {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      } @else {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  @if (form.get('currentPassword')?.invalid && form.get('currentPassword')?.touched) {
                    <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Enter your current password</p>
                  }
                </div>

                <div class="field" [class.field--invalid]="form.get('newPassword')?.invalid && form.get('newPassword')?.touched">
                  <div class="field-control">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <input id="newPassword" formControlName="newPassword" [type]="showNew ? 'text' : 'password'" placeholder=" " autocomplete="new-password" />
                    <label for="newPassword">New password</label>
                    <button type="button" class="field-eye" (click)="showNew = !showNew" [attr.aria-label]="showNew ? 'Hide password' : 'Show password'" tabindex="-1">
                      @if (showNew) {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      } @else {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  @if (form.get('newPassword')?.errors?.['minlength'] && form.get('newPassword')?.touched) {
                    <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Password must be at least 8 characters</p>
                  } @else {
                    <p class="field-msg">Use at least 8 characters.</p>
                  }
                </div>

                <div class="field" [class.field--invalid]="form.errors?.['mismatch'] && form.get('confirmPassword')?.touched">
                  <div class="field-control">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <input id="confirmPassword" formControlName="confirmPassword" [type]="showNew ? 'text' : 'password'" placeholder=" " autocomplete="new-password" />
                    <label for="confirmPassword">Confirm new password</label>
                  </div>
                  @if (form.errors?.['mismatch'] && form.get('confirmPassword')?.touched) {
                    <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Passwords do not match</p>
                  }
                </div>

                <button class="btn btn-primary" type="submit" [disabled]="form.invalid || loading()">
                  @if (loading()) {
                    <svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    <span>Updating…</span>
                  } @else {
                    <span>Change Password</span>
                    <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  }
                </button>
              </form>
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
  styleUrls: ['../auth-theme.scss'],
  styles: [`
    .solo {
      position: relative;
      z-index: 1;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
    }
    .panel-back {
      position: absolute;
      top: 20px;
      left: 20px;
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      border: 1.5px solid var(--line);
      background: #fff;
      color: var(--ink-2);
      cursor: pointer;
      transition: background .15s, border-color .15s, color .15s;
      z-index: 2;
    }
    .panel-back svg { width: 18px; height: 18px; }
    .panel-back:hover { background: var(--brand-soft); border-color: rgba(37, 99, 235, .3); color: var(--brand-strong); }
    .panel-back:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
    .auth-panel { display: block; }
    .panel-brand { display: flex !important; }
  `]
})
export class ChangePasswordComponent {
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);
  showCurrent = false;
  showNew = false;

  form = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: passwordsMatch });

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authState = inject(AuthStateService);
  firstLogin = false;

  constructor(private fb: FormBuilder, private authApi: AuthApiService, private location: Location) {
    this.firstLogin = this.route.snapshot.queryParamMap.get('firstLogin') === '1'
      || this.authState.mustChangePassword();
  }

  goBack(): void { this.location.back(); }

  submit(): void {
    if (this.form.invalid) return;
    this.error.set(null);
    this.loading.set(true);

    const { currentPassword, newPassword } = this.form.value;
    this.authApi.changePassword(currentPassword!, newPassword!).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.authState.clearMustChangePassword();
        if (this.firstLogin) {
          const role = this.authState.role();
          const target = role === 'admin' ? '/admin/dashboard'
            : role === 'technician' ? '/technician'
            : '/dashboard';
          setTimeout(() => this.router.navigateByUrl(target, { replaceUrl: true }), 1200);
        }
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err.error?.detail;
        const msg = (typeof detail === 'string' ? detail : detail?.message)
          ?? err.error?.message
          ?? 'Failed to change password. Check your current password.';
        this.error.set(msg);
      },
    });
  }
}
