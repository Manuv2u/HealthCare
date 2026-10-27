import { Component, EventEmitter, HostListener, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpEventType } from '@angular/common/http';
import { PrescriptionApiService } from '../../../core/api/services/prescription-api.service';
import { sanitizePhoneInput } from '../../../core/utils/phone.util';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

/**
 * Shared "Upload Prescription" dialog (green/yellow healthcare theme).
 * Desktop: centered dialog. Mobile: bottom sheet.
 * Flow: fill details → attach up to 3 prescription files → submit.
 * Mobile-OTP verification is currently disabled (see `otpRequired`) — the
 * OTP send/verify UI and code path are kept intact for a future re-enable.
 */
@Component({
  selector: 'app-upload-prescription-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    @if (isOpen) {
      <div class="upm-backdrop" (click)="requestClose()"></div>

      <div class="upm-dialog" role="dialog" aria-modal="true" aria-labelledby="upm-title">
        <div class="upm-grabber" aria-hidden="true"></div>

        <div class="upm-head">
          <div class="upm-badge"><mat-icon>upload_file</mat-icon></div>
          <div class="upm-head-text">
            <h3 id="upm-title">Upload Prescription</h3>
            <p>Not sure which tests to take? Upload your doctor's prescription and our
               healthcare experts will call you to help book the right diagnostic tests.</p>
          </div>
          <button type="button" class="upm-close" (click)="requestClose()" aria-label="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        @if (done()) {
          <div class="upm-success">
            <div class="upm-success-icon"><mat-icon>check_circle</mat-icon></div>
            <h4>✅ Thank you!</h4>
            <p>Our healthcare team will contact you within <strong>30 minutes</strong>.</p>
            @if (requestNumber()) {
              <p class="upm-refno">Reference: <strong>{{ requestNumber() }}</strong></p>
            }
            <button type="button" class="upm-submit" (click)="requestClose()">Done</button>
          </div>
        } @else {
          <form class="upm-form" [formGroup]="form" (ngSubmit)="submit()">

            <label class="upm-field">
              <span class="upm-label">Patient Name <span class="req">*</span></span>
              <input type="text" formControlName="patient_name" placeholder="Full name"
                     maxlength="100" autocomplete="name"
                     [class.err-border]="showError('patient_name')" />
              @if (showError('patient_name')) {
                <span class="upm-err"><mat-icon>error_outline</mat-icon> Patient name is required</span>
              }
            </label>

            <!-- Mobile + OTP -->
            <div class="upm-field">
              <label class="upm-label" for="upm-mobile">Mobile Number <span class="req">*</span></label>
              <div class="upm-phone-row">
                <div class="upm-phone" [class.invalid]="showError('mobile')" [class.locked]="otpVerified()">
                  <span class="upm-prefix">+91</span>
                  <input id="upm-mobile" type="tel" formControlName="mobile"
                         placeholder="10-digit mobile number" inputmode="numeric" maxlength="10"
                         autocomplete="tel-national" (input)="sanitizeMobile($event)" />
                  @if (otpVerified()) {
                    <span class="upm-verified-chip"><mat-icon>verified</mat-icon> Verified</span>
                  }
                </div>
                @if (otpRequired && !otpVerified()) {
                  <button type="button" class="upm-otp-btn"
                          [disabled]="form.get('mobile')?.invalid || sendingOtp() || resendIn() > 0"
                          (click)="sendOtp()">
                    @if (sendingOtp()) { Sending… }
                    @else if (resendIn() > 0) { Resend in {{ resendIn() }}s }
                    @else if (otpSent()) { Resend OTP }
                    @else { Send OTP }
                  </button>
                }
              </div>
              @if (showError('mobile')) {
                <span class="upm-err"><mat-icon>error_outline</mat-icon> Enter a valid 10-digit mobile number</span>
              }

              @if (otpRequired && otpSent() && !otpVerified()) {
                <div class="upm-otp-row">
                  <input class="upm-otp-input" type="text" formControlName="otp" placeholder="6-digit OTP"
                         inputmode="numeric" maxlength="6" autocomplete="one-time-code"
                         (input)="sanitizeDigits($event, 'otp', 6)" />
                  <button type="button" class="upm-verify-btn"
                          [disabled]="(form.get('otp')?.value?.length ?? 0) !== 6 || verifyingOtp()"
                          (click)="verifyOtp()">
                    {{ verifyingOtp() ? 'Verifying…' : 'Verify OTP' }}
                  </button>
                </div>
                <span class="upm-hint">OTP sent to +91 {{ form.get('mobile')?.value }} · valid for 5 minutes</span>
              }
              @if (otpError()) {
                <span class="upm-err"><mat-icon>error_outline</mat-icon> {{ otpError() }}</span>
              }
            </div>

            <div class="upm-two-col">
              <label class="upm-field">
                <span class="upm-label">City <span class="req">*</span></span>
                <input type="text" formControlName="city" placeholder="Your city" maxlength="80"
                       autocomplete="address-level2" [class.err-border]="showError('city')" />
                @if (showError('city')) {
                  <span class="upm-err"><mat-icon>error_outline</mat-icon> City is required</span>
                }
              </label>

              <label class="upm-field">
                <span class="upm-label">Email <span class="opt">(optional)</span></span>
                <input type="email" formControlName="email" placeholder="you@example.com"
                       maxlength="120" autocomplete="email" [class.err-border]="showError('email')" />
                @if (showError('email')) {
                  <span class="upm-err"><mat-icon>error_outline</mat-icon> Enter a valid email address</span>
                }
              </label>
            </div>

            <div class="upm-field">
              <span class="upm-label">Preferred Callback Time</span>
              <div class="upm-chips" role="radiogroup" aria-label="Preferred callback time">
                @for (slot of timeSlots; track slot.value) {
                  <button type="button" class="upm-chip" role="radio"
                          [attr.aria-checked]="form.get('callback_time')?.value === slot.value"
                          [class.selected]="form.get('callback_time')?.value === slot.value"
                          (click)="form.get('callback_time')?.setValue(slot.value)">
                    <mat-icon>{{ slot.icon }}</mat-icon>
                    {{ slot.label }}
                  </button>
                }
              </div>
            </div>

            <label class="upm-field">
              <span class="upm-label">Remarks <span class="opt">(optional)</span></span>
              <textarea formControlName="remarks" rows="2" maxlength="500"
                        placeholder="Anything we should know — symptoms, doctor's advice…"></textarea>
            </label>

            <!-- File dropzone -->
            <div class="upm-field">
              <span class="upm-label">Upload Prescription <span class="req">*</span>
                <span class="opt">(PDF, JPG, PNG · max {{ maxFiles }} files · 10 MB each)</span>
              </span>

              @if (selectedFiles().length < maxFiles) {
                <div class="upm-dropzone" [class.dragging]="dragging()"
                     (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)"
                     (drop)="onDrop($event)" (click)="fileInput.click()"
                     (keydown.enter)="fileInput.click()" (keydown.space)="fileInput.click()"
                     tabindex="0" role="button" aria-label="Upload prescription files">
                  <mat-icon>cloud_upload</mat-icon>
                  <div class="upm-dz-text">
                    <strong>Drag &amp; drop</strong> your prescription here
                    <span class="upm-dz-or">or</span>
                    <span class="upm-dz-browse">Browse files</span>
                  </div>
                </div>
              }
              <input #fileInput type="file" hidden multiple
                     accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                     (change)="onFilesPicked($event)" />

              @if (fileError()) {
                <span class="upm-err"><mat-icon>error_outline</mat-icon> {{ fileError() }}</span>
              }

              @for (f of selectedFiles(); track f.name + f.size) {
                <div class="upm-file">
                  <mat-icon class="upm-file-icon">{{ f.type === 'application/pdf' ? 'picture_as_pdf' : 'image' }}</mat-icon>
                  <div class="upm-file-meta">
                    <span class="upm-file-name">{{ f.name }}</span>
                    <span class="upm-file-size">{{ formatSize(f.size) }}</span>
                  </div>
                  @if (!submitting()) {
                    <button type="button" class="upm-file-remove" (click)="removeFile(f)"
                            [attr.aria-label]="'Remove ' + f.name">
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                </div>
              }
            </div>

            @if (error()) {
              <div class="upm-form-err" role="alert">
                <mat-icon>error_outline</mat-icon>
                {{ error() }}
              </div>
            }

            @if (submitting()) {
              <div class="upm-progress" role="progressbar" [attr.aria-valuenow]="uploadProgress()"
                   aria-valuemin="0" aria-valuemax="100">
                <div class="upm-progress-bar" [style.width.%]="uploadProgress()"></div>
              </div>
            }

            @if (otpRequired && !otpVerified()) {
              <p class="upm-verify-note"><mat-icon>lock</mat-icon> Verify your mobile number to enable submission</p>
            }

            <button type="submit" class="upm-submit"
                    [disabled]="submitting() || (otpRequired && !otpVerified()) || form.invalid || selectedFiles().length === 0">
              @if (submitting()) {
                <span class="upm-spinner" aria-hidden="true"></span>
                Uploading… {{ uploadProgress() }}%
              } @else {
                <mat-icon>send</mat-icon> Submit Prescription
              }
            </button>
          </form>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      --upm-green:       #003399;
      --upm-green-dark:  #002577;
      --upm-green-deep:  #001B57;
      --upm-green-lt:    #EEF4FF;
      --upm-green-mid:   #B3CAFF;
      --upm-yellow:      #0047CC;
      --upm-yellow-dark: #003399;
      --upm-yellow-ink:  #001B57;
    }

    .upm-backdrop {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(15, 23, 42, .55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      animation: upm-fade .18s ease;
    }
    @keyframes upm-fade { from { opacity: 0; } to { opacity: 1; } }

    .upm-dialog {
      position: fixed; z-index: 1001;
      top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: min(560px, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      background: var(--surface, #fff);
      border-radius: var(--r-xl, 20px);
      box-shadow: 0 30px 60px -12px rgba(15, 23, 42, .4);
      animation: upm-pop .22s cubic-bezier(0, 0, .2, 1);
    }
    @keyframes upm-pop {
      from { opacity: 0; transform: translate(-50%, -46%) scale(.97); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .upm-grabber { display: none; }

    /* ── Header ── */
    .upm-head {
      display: flex; align-items: flex-start; gap: .9rem;
      padding: 1.4rem 1.5rem 1rem;
      border-bottom: 1px solid var(--border, #E2E8F0);
    }
    .upm-badge {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, var(--upm-green) 0%, var(--upm-green-dark) 100%);
      color: #fff; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 16px -4px rgba(0, 51, 153, .45);
    }
    .upm-head-text h3 { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text, #0F172A); }
    .upm-head-text p  { margin: .15rem 0 0; font-size: .85rem; color: var(--text-2, #475569); }
    .upm-close {
      margin-left: auto; flex-shrink: 0;
      background: none; border: none; cursor: pointer;
      color: var(--muted, #94A3B8); border-radius: 8px; padding: .25rem; line-height: 0;
      transition: background .15s, color .15s;
    }
    .upm-close:hover { background: var(--bg, #F8F9FF); color: var(--text, #0F172A); }
    .upm-close:focus-visible { outline: 2px solid var(--upm-green); outline-offset: 2px; }

    /* ── Form ── */
    .upm-form { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem 1.5rem 1.5rem; }
    .upm-field { display: flex; flex-direction: column; gap: .4rem; }
    .upm-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .upm-label { font-size: .82rem; font-weight: 600; color: var(--text, #0F172A); }
    .upm-label .req { color: var(--red, #EF4444); }
    .upm-label .opt { color: var(--muted, #94A3B8); font-weight: 400; }

    .upm-field input,
    .upm-field textarea {
      width: 100%; padding: .7rem .85rem;
      border: 1px solid var(--border, #E2E8F0); border-radius: var(--r, 12px);
      font: inherit; font-size: .92rem; color: var(--text, #0F172A);
      background: var(--surface, #fff);
      transition: border-color .15s, box-shadow .15s;
    }
    .upm-field input:focus,
    .upm-field textarea:focus {
      outline: none; border-color: var(--upm-green);
      box-shadow: 0 0 0 3px rgba(0, 51, 153, .14);
    }
    .upm-field textarea { resize: vertical; min-height: 60px; }
    .upm-field input::placeholder,
    .upm-field textarea::placeholder { color: var(--muted, #94A3B8); }
    .upm-field input.err-border { border-color: var(--red, #EF4444); }

    /* Phone with +91 prefix + Send OTP */
    .upm-phone-row { display: flex; gap: .5rem; align-items: stretch; }
    .upm-phone {
      display: flex; align-items: stretch; flex: 1; min-width: 0;
      border: 1px solid var(--border, #E2E8F0); border-radius: var(--r, 12px);
      background: var(--surface, #fff); overflow: hidden;
      transition: border-color .15s, box-shadow .15s;
    }
    .upm-phone:focus-within {
      border-color: var(--upm-green);
      box-shadow: 0 0 0 3px rgba(0, 51, 153, .14);
    }
    .upm-phone.invalid { border-color: var(--red, #EF4444); }
    .upm-phone.locked { background: var(--upm-green-lt); border-color: var(--upm-green-mid); }
    .upm-prefix {
      display: flex; align-items: center;
      padding: 0 .75rem;
      font-size: .9rem; font-weight: 600; color: var(--text-2, #475569);
      background: var(--bg, #F8F9FF);
      border-right: 1px solid var(--border, #E2E8F0);
    }
    .upm-phone input { border: none; border-radius: 0; flex: 1; min-width: 0; padding: .7rem .85rem; font: inherit; font-size: .92rem; }
    .upm-phone input:focus { outline: none; box-shadow: none; }
    .upm-phone.locked input { background: transparent; color: var(--upm-green-deep); font-weight: 600; }
    .upm-verified-chip {
      display: inline-flex; align-items: center; gap: .25rem;
      margin: auto .6rem; padding: .2rem .55rem;
      background: var(--upm-green); color: #fff;
      border-radius: 999px; font-size: .72rem; font-weight: 700; white-space: nowrap;
    }
    .upm-verified-chip mat-icon { font-size: .9rem; width: .9rem; height: .9rem; }

    .upm-otp-btn, .upm-verify-btn {
      flex-shrink: 0; padding: 0 1rem;
      border: 1px solid var(--upm-green); border-radius: var(--r, 12px);
      background: var(--upm-green-lt); color: var(--upm-green-dark);
      font: inherit; font-size: .85rem; font-weight: 700; cursor: pointer;
      transition: background .15s, color .15s, opacity .15s;
      white-space: nowrap;
    }
    .upm-otp-btn:hover:not(:disabled), .upm-verify-btn:hover:not(:disabled) {
      background: var(--upm-green); color: #fff;
    }
    .upm-otp-btn:disabled, .upm-verify-btn:disabled { opacity: .55; cursor: not-allowed; }
    .upm-otp-btn:focus-visible, .upm-verify-btn:focus-visible { outline: 2px solid var(--upm-green); outline-offset: 2px; }

    .upm-otp-row { display: flex; gap: .5rem; margin-top: .5rem; }
    .upm-otp-input {
      flex: 1; min-width: 0;
      letter-spacing: .35em; font-weight: 700; text-align: center;
    }
    .upm-verify-btn { padding: .55rem 1rem; }
    .upm-hint { font-size: .76rem; color: var(--muted, #94A3B8); margin-top: .3rem; }

    .upm-err {
      display: inline-flex; align-items: center; gap: .3rem;
      font-size: .78rem; color: var(--red, #EF4444);
    }
    .upm-err mat-icon { font-size: .95rem; width: .95rem; height: .95rem; }

    /* Callback-time chips */
    .upm-chips { display: flex; flex-wrap: wrap; gap: .5rem; }
    .upm-chip {
      display: inline-flex; align-items: center; gap: .35rem;
      padding: .5rem .8rem;
      border: 1px solid var(--border, #E2E8F0); border-radius: var(--r-pill, 999px);
      background: var(--surface, #fff);
      font: inherit; font-size: .82rem; font-weight: 600; color: var(--text-2, #475569);
      cursor: pointer;
      transition: border-color .15s, background .15s, color .15s;
    }
    .upm-chip mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }
    .upm-chip:hover { border-color: var(--upm-green-mid); color: var(--upm-green-dark); }
    .upm-chip.selected {
      background: var(--upm-green-lt);
      border-color: var(--upm-green);
      color: var(--upm-green-dark);
    }
    .upm-chip:focus-visible { outline: 2px solid var(--upm-green); outline-offset: 2px; }

    /* Dropzone */
    .upm-dropzone {
      display: flex; align-items: center; gap: .9rem;
      padding: 1.1rem 1.2rem;
      border: 2px dashed var(--upm-green-mid);
      border-radius: var(--r, 12px);
      background: var(--upm-green-lt);
      color: var(--upm-green-dark);
      cursor: pointer;
      transition: border-color .15s, background .15s;
    }
    .upm-dropzone:hover, .upm-dropzone.dragging {
      border-color: var(--upm-green);
      background: #dcfce7;
    }
    .upm-dropzone:focus-visible { outline: 2px solid var(--upm-green); outline-offset: 2px; }
    .upm-dropzone mat-icon { font-size: 2rem; width: 2rem; height: 2rem; flex-shrink: 0; }
    .upm-dz-text { font-size: .88rem; color: var(--text-2, #475569); }
    .upm-dz-text strong { color: var(--text, #0F172A); }
    .upm-dz-or { margin: 0 .4rem; color: var(--muted, #94A3B8); }
    .upm-dz-browse {
      color: var(--upm-green-dark); font-weight: 700; text-decoration: underline;
    }

    /* Selected files */
    .upm-file {
      display: flex; align-items: center; gap: .7rem;
      padding: .55rem .75rem;
      border: 1px solid var(--border, #E2E8F0); border-radius: var(--r, 12px);
      background: var(--surface, #fff);
    }
    .upm-file-icon { color: var(--upm-green-dark); flex-shrink: 0; }
    .upm-file-meta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .upm-file-name {
      font-size: .85rem; font-weight: 600; color: var(--text, #0F172A);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .upm-file-size { font-size: .74rem; color: var(--muted, #94A3B8); }
    .upm-file-remove {
      flex-shrink: 0; background: none; border: none; cursor: pointer;
      color: var(--muted, #94A3B8); border-radius: 8px; padding: .2rem; line-height: 0;
      transition: background .15s, color .15s;
    }
    .upm-file-remove:hover { background: #FEF2F2; color: var(--red, #EF4444); }
    .upm-file-remove:focus-visible { outline: 2px solid var(--red, #EF4444); outline-offset: 2px; }
    .upm-file-remove mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }

    /* Error banner */
    .upm-form-err {
      display: flex; align-items: flex-start; gap: .5rem;
      font-size: .85rem; color: #B91C1C; background: #FEF2F2;
      border: 1px solid #FECACA; border-radius: var(--r, 12px);
      padding: .6rem .8rem;
    }
    .upm-form-err mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; flex-shrink: 0; }

    /* Upload progress */
    .upm-progress {
      height: 8px; border-radius: 999px; overflow: hidden;
      background: var(--border-lt, #F1F5F9);
    }
    .upm-progress-bar {
      height: 100%; border-radius: 999px;
      background: linear-gradient(90deg, var(--upm-green) 0%, var(--upm-green-dark) 100%);
      transition: width .2s ease;
    }

    .upm-verify-note {
      display: flex; align-items: center; gap: .4rem;
      margin: 0; font-size: .78rem; color: var(--muted, #94A3B8);
    }
    .upm-verify-note mat-icon { font-size: .95rem; width: .95rem; height: .95rem; }

    /* Submit — yellow CTA */
    .upm-submit {
      margin-top: .2rem; padding: .85rem 1rem;
      display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
      background: linear-gradient(135deg, var(--upm-yellow) 0%, var(--upm-yellow-dark) 100%);
      color: var(--upm-yellow-ink); border: none; border-radius: var(--r, 12px);
      font: inherit; font-size: .95rem; font-weight: 800; cursor: pointer;
      box-shadow: 0 6px 16px -4px rgba(234, 179, 8, .55);
      transition: filter .15s, opacity .15s;
    }
    .upm-submit mat-icon { font-size: 1.15rem; width: 1.15rem; height: 1.15rem; }
    .upm-submit:hover:not(:disabled) { filter: brightness(1.05); }
    .upm-submit:disabled { opacity: .55; cursor: not-allowed; }
    .upm-submit:focus-visible { outline: 2px solid var(--upm-green-deep); outline-offset: 2px; }

    .upm-spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(66, 32, 6, .35); border-top-color: var(--upm-yellow-ink);
      animation: upm-spin .7s linear infinite;
    }
    @keyframes upm-spin { to { transform: rotate(360deg); } }

    /* Success state */
    .upm-success { text-align: center; padding: 2rem 1.5rem 1.75rem; }
    .upm-success-icon {
      width: 72px; height: 72px; margin: 0 auto .75rem;
      border-radius: 50%; background: var(--upm-green-lt);
      display: flex; align-items: center; justify-content: center;
      color: var(--upm-green);
    }
    .upm-success-icon mat-icon { font-size: 44px; width: 44px; height: 44px; }
    .upm-success h4 { margin: 0 0 .4rem; font-size: 1.2rem; font-weight: 700; color: var(--text, #0F172A); }
    .upm-success p  { margin: 0 0 .6rem; color: var(--text-2, #475569); font-size: .92rem; }
    .upm-refno { font-size: .85rem; color: var(--upm-green-dark) !important; }
    .upm-success .upm-submit { width: 100%; margin-top: .8rem; }

    /* ── Mobile: bottom sheet ── */
    @media (max-width: 600px) {
      .upm-dialog {
        top: auto; left: 0; right: 0; bottom: 0;
        transform: none;
        width: 100%;
        max-height: calc(100dvh - 3rem);
        border-radius: var(--r-xl, 20px) var(--r-xl, 20px) 0 0;
        padding-bottom: env(safe-area-inset-bottom, 0px);
        animation: upm-slide-up .26s cubic-bezier(0, 0, .2, 1);
      }
      @keyframes upm-slide-up {
        from { opacity: .6; transform: translateY(40px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .upm-grabber {
        display: block;
        width: 40px; height: 4px;
        margin: .6rem auto 0;
        border-radius: 999px;
        background: var(--border, #E2E8F0);
      }
      .upm-head { padding: .9rem 1.25rem 1rem; }
      .upm-form { padding: 1.1rem 1.25rem 1.35rem; }
      .upm-two-col { grid-template-columns: 1fr; }
      .upm-chip { flex: 1 1 calc(33% - .34rem); justify-content: center; }
      .upm-phone-row { flex-direction: column; }
      .upm-otp-btn { padding: .65rem 1rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      .upm-backdrop, .upm-dialog, .upm-progress-bar { animation: none; transition: none; }
    }
  `],
})
export class UploadPrescriptionModalComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(PrescriptionApiService);

  @Output() closed = new EventEmitter<void>();

  readonly maxFiles = MAX_FILES;
  /** OTP_DISABLED: mobile-OTP verification is turned off for now (matches the
   * backend's PRESCRIPTION_OTP_REQUIRED flag in prescription_request_service.py).
   * Flip both back to true to restore the "verify mobile via OTP" step. */
  readonly otpRequired = false;

  isOpen = false;
  @Input() set open(value: boolean) {
    if (value && !this.isOpen) this.reset();
    this.isOpen = value;
    document.body.style.overflow = value ? 'hidden' : '';
  }

  submitting = signal(false);
  done = signal(false);
  error = signal<string | null>(null);
  requestNumber = signal<string | null>(null);
  uploadProgress = signal(0);

  sendingOtp = signal(false);
  otpSent = signal(false);
  verifyingOtp = signal(false);
  otpVerified = signal(false);
  otpError = signal<string | null>(null);
  resendIn = signal(0);
  private resendTimer?: number;
  private verificationToken: string | null = null;

  dragging = signal(false);
  selectedFiles = signal<File[]>([]);
  fileError = signal<string | null>(null);

  readonly timeSlots = [
    { value: 'Morning (9 AM – 12 PM)', label: 'Morning', icon: 'wb_sunny' },
    { value: 'Afternoon (12 – 4 PM)', label: 'Afternoon', icon: 'light_mode' },
    { value: 'Evening (4 – 8 PM)', label: 'Evening', icon: 'wb_twilight' },
  ];

  form = this.fb.group({
    patient_name: ['', [Validators.required, Validators.minLength(2)]],
    mobile: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    otp: [''],
    city: ['', Validators.required],
    email: ['', Validators.email],
    callback_time: [''],
    remarks: [''],
  });

  constructor() {
    // Editing the mobile after verification invalidates it.
    this.form.get('mobile')!.valueChanges.subscribe(() => {
      if (this.otpVerified() || this.otpSent()) {
        this.otpVerified.set(false);
        this.otpSent.set(false);
        this.otpError.set(null);
        this.verificationToken = null;
        this.form.get('otp')?.setValue('', { emitEvent: false });
        this.stopResendTimer();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.isOpen) document.body.style.overflow = '';
    this.stopResendTimer();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) this.requestClose();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  showError(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.touched && c.invalid;
  }

  /** Plain digit-clamp — used by the OTP field, where a bare slice is correct. */
  sanitizeDigits(event: Event, control: string, maxLen: number): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, maxLen);
    if (digits !== input.value) {
      input.value = digits;
      this.form.get(control)?.setValue(digits);
    }
  }

  sanitizeMobile(event: Event): void {
    sanitizePhoneInput(event, (v) => this.form.get('mobile')?.setValue(v));
  }

  formatSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
    return bytes + ' B';
  }

  requestClose(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  private reset(): void {
    this.form.reset({
      patient_name: '', mobile: '', otp: '', city: '', email: '', callback_time: '', remarks: '',
    });
    this.done.set(false);
    this.error.set(null);
    this.requestNumber.set(null);
    this.submitting.set(false);
    this.uploadProgress.set(0);
    this.sendingOtp.set(false);
    this.otpSent.set(false);
    this.verifyingOtp.set(false);
    this.otpVerified.set(false);
    this.otpError.set(null);
    this.verificationToken = null;
    this.selectedFiles.set([]);
    this.fileError.set(null);
    this.dragging.set(false);
    this.stopResendTimer();
  }

  // ── OTP flow ─────────────────────────────────────────────────────────────

  sendOtp(): void {
    const mobile = this.form.get('mobile')?.value;
    if (!mobile || this.form.get('mobile')?.invalid) return;
    this.sendingOtp.set(true);
    this.otpError.set(null);
    this.api.sendOtp(mobile).subscribe({
      next: () => {
        this.sendingOtp.set(false);
        this.otpSent.set(true);
        this.startResendTimer(30);
      },
      error: (err) => {
        this.sendingOtp.set(false);
        this.otpError.set(
          err?.error?.detail?.message ?? 'Could not send OTP. Please try again.',
        );
      },
    });
  }

  verifyOtp(): void {
    const mobile = this.form.get('mobile')?.value;
    const otp = this.form.get('otp')?.value;
    if (!mobile || !otp || otp.length !== 6) return;
    this.verifyingOtp.set(true);
    this.otpError.set(null);
    this.api.verifyOtp(mobile, otp).subscribe({
      next: (r) => {
        this.verifyingOtp.set(false);
        this.verificationToken = r.verification_token;
        this.otpVerified.set(true);
        this.stopResendTimer();
      },
      error: (err) => {
        this.verifyingOtp.set(false);
        this.otpError.set(
          err?.error?.detail?.message ?? 'Invalid or expired OTP. Please try again.',
        );
      },
    });
  }

  private startResendTimer(seconds: number): void {
    this.stopResendTimer();
    this.resendIn.set(seconds);
    this.resendTimer = window.setInterval(() => {
      const next = this.resendIn() - 1;
      this.resendIn.set(Math.max(0, next));
      if (next <= 0) this.stopResendTimer();
    }, 1000);
  }

  private stopResendTimer(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = undefined;
    }
    this.resendIn.set(0);
  }

  // ── Files ────────────────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (event.dataTransfer?.files) this.addFiles(Array.from(event.dataTransfer.files));
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = ''; // allow re-picking the same file after removal
  }

  private addFiles(incoming: File[]): void {
    this.fileError.set(null);
    const current = [...this.selectedFiles()];
    for (const f of incoming) {
      if (current.length >= MAX_FILES) {
        this.fileError.set(`Maximum ${MAX_FILES} files allowed`);
        break;
      }
      const ext = f.name.includes('.') ? f.name.split('.').pop()!.toLowerCase() : '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        this.fileError.set(`${f.name}: only PDF, JPG, JPEG and PNG files are allowed`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        this.fileError.set(`${f.name}: file is larger than 10 MB`);
        continue;
      }
      if (current.some((c) => c.name === f.name && c.size === f.size)) continue;
      current.push(f);
    }
    this.selectedFiles.set(current);
  }

  removeFile(file: File): void {
    this.selectedFiles.set(this.selectedFiles().filter((f) => f !== file));
    this.fileError.set(null);
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  submit(): void {
    if (this.form.invalid || (this.otpRequired && (!this.otpVerified() || !this.verificationToken))) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.selectedFiles().length === 0) {
      this.fileError.set('Upload at least one prescription file');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.uploadProgress.set(0);
    const v = this.form.value;
    this.api.submit({
      patient_name: v.patient_name!.trim(),
      mobile: v.mobile!,
      city: v.city!.trim(),
      verification_token: this.verificationToken ?? 'otp-disabled',
      email: v.email?.trim() || undefined,
      callback_time: v.callback_time || undefined,
      remarks: v.remarks?.trim() || undefined,
      files: this.selectedFiles(),
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress.set(Math.round((event.loaded / event.total) * 100));
        } else if (event.type === HttpEventType.Response) {
          this.submitting.set(false);
          this.requestNumber.set(event.body?.request_number ?? null);
          this.done.set(true);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.uploadProgress.set(0);
        this.error.set(
          err?.error?.detail?.message
          ?? 'Could not submit your prescription. Please try again or call us directly.',
        );
      },
    });
  }
}
