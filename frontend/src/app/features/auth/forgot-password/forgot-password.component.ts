import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthApiService } from '../../../core/api/services/auth-api.service';

@Component({
  selector: 'app-forgot-password',
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
            <span class="eyebrow">Secure account recovery</span>
            <h1 class="showcase-title">Locked out?<br/><span class="grad">We'll get you back in.</span></h1>
            <p class="showcase-sub">
              Resetting your password is quick and secure. We'll send a verified link to
              the email or phone on your account.
            </p>

            <ul class="trust-list">
              <li class="trust-chip trust-chip--blue">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"/></svg></i>
                Secure Reset Process
              </li>
              <li class="trust-chip trust-chip--cyan">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg></i>
                Verified Delivery
              </li>
              <li class="trust-chip trust-chip--emerald">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></i>
                Instant Recovery
              </li>
              <li class="trust-chip trust-chip--violet">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></i>
                Protected Information
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

            @if (!emailSent()) {
              <div class="panel-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>

              <div class="panel-head">
                <h2 class="panel-title">Forgot password?</h2>
                <p class="panel-sub">Enter your email address and we'll send you a link to reset your password.</p>
              </div>

              @if (error()) {
                <div class="alert alert--error" role="alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <span>{{ error() }}</span>
                  <button type="button" class="alert-x" aria-label="Dismiss" (click)="error.set(null)">&times;</button>
                </div>
              }

              <form [formGroup]="forgotForm" (ngSubmit)="submit()" class="auth-form" novalidate>
                <div class="field">
                  <div class="field-control">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>
                    <input id="email" type="email" formControlName="email" placeholder=" " autocomplete="username" />
                    <label for="email">Email address</label>
                  </div>
                </div>

                <button type="submit" class="btn btn-primary" [disabled]="loading() || forgotForm.invalid">
                  @if (loading()) {
                    <svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    <span>Sending…</span>
                  } @else {
                    <span>Send Reset Link</span>
                    <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  }
                </button>
              </form>
            } @else {
              <div class="state">
                <div class="state-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h2 class="state-title">Check your inbox</h2>
                <p class="state-text">We've sent a password reset link to<br/><strong>{{ sentTo() }}</strong></p>
                <button type="button" class="btn btn-secondary" (click)="resetForm()">Try a different account</button>
              </div>
            }

            <div class="divider"><span>need help?</span></div>

            <div class="auth-alt" style="margin-top:0">
              <a routerLink="/auth/login" class="back-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Back to sign in
              </a>
            </div>
          </div>

          <p class="panel-legal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Reset links expire for your security
          </p>
        </section>
      </div>
    </div>
  `,
  styleUrls: ['../auth-theme.scss']
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authApi = inject(AuthApiService);

  currentYear = new Date().getFullYear();
  loading = signal(false);
  error = signal<string | null>(null);
  emailSent = signal(false);
  sentTo = signal('');

  forgotForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  submit(): void {
    if (this.forgotForm.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const email = this.forgotForm.value.email!;

    this.authApi.forgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.sentTo.set(email);
        this.emailSent.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        let errorMessage = 'Failed to send reset link. Please try again.';
        if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error.detail) {
            errorMessage = typeof err.error.detail === 'string'
              ? err.error.detail
              : JSON.stringify(err.error.detail);
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        }
        this.error.set(errorMessage);
      }
    });
  }

  resetForm(): void {
    this.emailSent.set(false);
    this.forgotForm.reset();
  }
}
