import { Component, inject, OnInit, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BookingWizardStore } from '../../../core/store/booking-wizard.store';
import { BookingApiService } from '../../../core/api/services/booking-api.service';
import { PaymentApiService } from '../../../core/api/services/payment-api.service';
import { BillingApiService } from '../../../core/api/services/billing-api.service';
import { PackageApiService } from '../../../core/api/services/package-api.service';
import { CouponApiService } from '../../../core/api/services/coupon-api.service';
import { UserApiService } from '../../../core/api/services/user-api.service';
import { RazorpayCheckoutService } from '../../../core/utils/razorpay-checkout.service';
import { CashfreeCheckoutService } from '../../../core/utils/cashfree-checkout.service';
import { SettingsApiService, CancellationSetting } from '../../../core/api/services/settings-api.service';
import { BillingTotals, CouponSummary, Payment } from '../../../core/api/api.types';
import { ButtonComponent, SpinnerComponent, BadgeComponent, AlertComponent, InputComponent } from '../../../shared/components';

@Component({
  selector: 'app-payment-step-new',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, SpinnerComponent, BadgeComponent, AlertComponent, InputComponent],
  template: `
    <div class="payment-step">
      <!-- Order Summary — collapsed by default; tap to review the full breakdown -->
      <div class="order-summary">
        <button type="button" class="summary-toggle" (click)="summaryExpanded.set(!summaryExpanded())" [attr.aria-expanded]="summaryExpanded()">
          <div class="summary-toggle__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div class="summary-toggle__text">
            <span class="summary-toggle__title">{{ itemsSummaryText() }} &middot; {{ store.collectionType() === 'home' ? 'Home Collection' : 'Lab Visit' }}</span>
            <span class="summary-toggle__sub">{{ formatDateShort(store.slotDate()) }}{{ store.slotLabel() ? ', ' + store.slotLabel() : '' }}</span>
          </div>
          <div class="summary-toggle__right">
            @if (totals(); as t) {
              <span class="summary-toggle__amount">₹{{ t.total | number:'1.2-2' }}</span>
            }
            <svg class="summary-toggle__chevron" [class.summary-toggle__chevron--open]="summaryExpanded()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </button>

        @if (summaryExpanded()) {
          <div class="summary-details">
            <!-- Patient -->
            <div class="summary-row">
              <span class="summary-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Patient
              </span>
              <span class="summary-value">{{ store.patientName() || 'Myself' }}</span>
            </div>

            <!-- Tests -->
            <div class="summary-section">
              <span class="section-label">Selected Tests/Packages</span>
              <div class="items-list">
                @for (test of store.selectedTests(); track test.id) {
                  <div class="item-row">
                    <span class="item-name">{{ test.name }}</span>
                    <span class="item-price">₹{{ test.price }}</span>
                  </div>
                }
                @for (pkg of store.selectedPackages(); track pkg.id) {
                  <div class="item-row item-row--package">
                    <span class="item-name">{{ pkg.name }}</span>
                    <span class="item-price">₹{{ pkg.price }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Collection Details -->
            <div class="summary-row">
              <span class="summary-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  @if (store.collectionType() === 'home') {
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  } @else {
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                    <path d="M9 22v-4h6v4"/>
                  }
                </svg>
                Collection Type
              </span>
              <span class="summary-value">{{ store.collectionType() === 'home' ? 'Home Collection' : 'Lab Visit' }}</span>
            </div>

            <!-- Schedule -->
            <div class="summary-row">
              <span class="summary-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Scheduled For
              </span>
              <span class="summary-value summary-value--schedule">
                <span>{{ formatDate(store.slotDate()) }}</span>
                @if (store.slotLabel()) {
                  <span class="summary-slot-time">{{ store.slotLabel() }}</span>
                }
              </span>
            </div>

            <!-- Price Breakdown — every figure comes from the backend billing engine -->
            <div class="price-breakdown">
              @if (totals(); as t) {
                <div class="price-row">
                  <span>Subtotal</span>
                  <span>₹{{ t.subtotal | number:'1.2-2' }}</span>
                </div>
                @for (adj of t.adjustments; track adj.label) {
                  <div class="price-row" [class.price-row--discount]="adj.kind === 'discount'">
                    <span>{{ adj.label }}</span>
                    <span>{{ adj.kind === 'discount' ? '−' : '' }}₹{{ adj.amount | number:'1.2-2' }}</span>
                  </div>
                }
                @if (t.gst_enabled) {
                  <div class="price-row">
                    <span>GST ({{ t.gst_percentage | number:'1.0-2' }}%)</span>
                    <span>₹{{ t.gst_amount | number:'1.2-2' }}</span>
                  </div>
                }
                @if (store.collectionType() === 'home') {
                  <div class="price-row price-row--discount">
                    <span>Home Collection Fee</span>
                    <span>FREE</span>
                  </div>
                }
                <div class="price-row price-row--total">
                  <span>Total Amount</span>
                  <span>₹{{ t.total | number:'1.2-2' }}</span>
                </div>
              } @else if (quoteError()) {
                <div class="price-row"><span>{{ quoteError() }}</span></div>
              } @else {
                <div class="price-row"><app-spinner size="sm" /><span>Calculating total…</span></div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Coupon code -->
      <div class="coupon-block">
        <h4 class="methods-title">Have a Coupon Code?</h4>
        @if (couponApplied()?.valid) {
          <div class="coupon-applied">
            <span>✓ Code <strong>{{ couponApplied()!.coupon!.code }}</strong> applied</span>
            <button type="button" class="coupon-remove" (click)="removeCoupon()">Remove</button>
          </div>
        } @else {
          <div class="coupon-input-row">
            <app-input placeholder="Enter coupon code" [ngModel]="couponCode()" (ngModelChange)="couponCode.set($event)" />
            <app-button variant="outline" [loading]="applyingCoupon()" [disabled]="!couponCode().trim()" (click)="applyCoupon()">Apply</app-button>
          </div>
          @if (couponError()) { <p class="coupon-error">{{ couponError() }}</p> }
          @if (suggestedCoupons().length) {
            <div class="coupon-suggestions">
              @for (s of suggestedCoupons(); track s.code) {
                <button type="button" class="coupon-suggestion" (click)="useSuggestedCoupon(s.code)">
                  💡 {{ s.packageName }}: try code <strong>{{ s.code }}</strong>
                </button>
              }
            </div>
          }
        }
      </div>

      <!-- Cancellation charge notice (home collection only) -->
      @if (store.collectionType() === 'home' && cancellationNoticeText()) {
        <div class="notice-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{{ cancellationNoticeText() }}</span>
        </div>
      }

      <!-- Payment Methods -->
      <div class="payment-methods">
        <h4 class="methods-title">Payment Method</h4>

        <div class="method-card method-card--selected">
          <div class="method-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <div class="method-card__content">
            <span class="method-card__name">Pay Online</span>
            <span class="method-card__desc">Credit/Debit Card, UPI, Net Banking</span>
          </div>
          <div class="method-card__check method-card__check--visible">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Sandbox keys are configured (rzp_test_*): say so loudly, so a staging
           checkout is never mistaken for one that charges a real card. -->
      @if (isTestMode()) {
        <div class="test-mode-note" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/>
          </svg>
          <div>
            <strong>Test mode — no real money will be charged.</strong>
            @if (activeGateway() === 'cashfree') {
              Use test card <code>4111 1111 1111 1111</code> (any future expiry, CVV <code>123</code>)
              or UPI ID <code>testsuccess&#64;gocash</code>.
            } @else {
              Use test card <code>4111 1111 1111 1111</code> (any future expiry &amp; CVV)
              or UPI ID <code>success&#64;razorpay</code>.
            }
          </div>
        </div>
      }

      <!-- Error Alert -->
      @if (error()) {
        <app-alert type="error" [dismissible]="true" (dismiss)="error.set(null)">
          {{ error() }}
        </app-alert>
      }
    </div>

    <!-- Sticky pay bar — total + primary action always reachable, no scrolling required -->
    <div class="sticky-pay-bar">
      <div class="sticky-pay-bar__inner">
        <app-button variant="outline" size="lg" [disabled]="processing()" (click)="back.emit()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon btn-icon--left">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span class="sticky-pay-bar__back-text">Back</span>
        </app-button>

        <div class="sticky-pay-bar__total">
          <span class="sticky-pay-bar__total-label">Total</span>
          <span class="sticky-pay-bar__total-value">
            @if (totals(); as t) {
              ₹{{ t.total | number:'1.2-2' }}
            } @else {
              …
            }
          </span>
        </div>

        <app-button
          variant="primary"
          size="lg"
          [disabled]="!canProceed() || processing()"
          [loading]="processing()"
          (click)="placeOrder()"
        >
          Pay ₹{{ payNowLabel() }}
        </app-button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --color-primary-50: #EEF4FF;
      --color-primary-100: #D9E5FF;
      --color-primary-500: #0047CC;
      --color-primary-600: #003399;
      --color-primary-700: #002577;
      --color-primary-800: #001B57;
      --shadow-primary: 0 4px 14px 0 rgba(0, 51, 153, 0.28);
      display: block;
    }

    .payment-step {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* Order Summary */
    .order-summary {
      background: #F8FAFC;
      border-radius: 1rem;
      border: 1px solid #F1F5F9;
      overflow: hidden;
    }

    /* Collapsed, always-visible header — the "mini" view of the order. */
    .summary-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
      font: inherit;
      color: inherit;
    }

    .summary-toggle__icon {
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      background: #DCFCE7;
      color: #15803D;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      svg { width: 18px; height: 18px; }
    }

    .summary-toggle__text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .summary-toggle__title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0F172A;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .summary-toggle__sub {
      font-size: 0.75rem;
      color: #64748B;
    }

    .summary-toggle__right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .summary-toggle__amount {
      font-size: 0.9375rem;
      font-weight: 700;
      color: #0F172A;
    }

    .summary-toggle__chevron {
      width: 18px;
      height: 18px;
      color: #94A3B8;
      transition: transform 150ms;
    }

    .summary-toggle__chevron--open {
      transform: rotate(180deg);
    }

    /* Expanded details panel */
    .summary-details {
      padding: 0 1rem 1rem 1rem;
      border-top: 1px solid #E2E8F0;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
    }

    .summary-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #475569;

      svg {
        width: 18px;
        height: 18px;
        opacity: 0.6;
      }
    }

    .summary-value {
      font-size: 0.875rem;
      font-weight: 500;
      color: #0F172A;
    }

    /* Date on top, slot window beneath it, both right-aligned with the row. */
    .summary-value--schedule {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      text-align: right;
    }
    .summary-slot-time {
      font-size: 0.8rem;
      font-weight: 600;
      color: #0047CC;
    }

    .summary-section {
      padding: 0.75rem 0;
    }

    .section-label {
      display: block;
      font-size: 0.875rem;
      color: #475569;
      margin-bottom: 0.5rem;
    }

    .items-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: #FFFFFF;
      border-radius: 0.5rem;
    }

    .item-row--package {
      border-left: 3px solid #003399;
    }

    .item-name {
      font-size: 0.875rem;
      color: #0F172A;
    }

    .item-price {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0F172A;
    }

    /* Coupon */
    .coupon-block {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .coupon-input-row {
      display: flex;
      align-items: flex-end;
      gap: 0.75rem;

      app-input { flex: 1; }
    }

    .coupon-applied {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      border-radius: 0.75rem;
      color: #15803D;
      font-size: 0.875rem;
    }

    .coupon-remove {
      background: none;
      border: none;
      color: #DC2626;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: underline;
    }

    .coupon-error {
      font-size: 0.8rem;
      color: #DC2626;
      margin: 0;
    }

    .coupon-suggestions {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .coupon-suggestion {
      text-align: left;
      background: #EEF4FF;
      border: 1px dashed #84A6FF;
      border-radius: 0.5rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
      color: #002577;
      cursor: pointer;

      &:hover { background: #E0EAFF; }
    }

    /* Price Breakdown (nested inside the expanded order-summary) */
    .price-breakdown {
      margin-top: 0.5rem;
      padding: 1rem;
      background: #FFFFFF;
      border-radius: 0.75rem;
      border: 1px solid #F1F5F9;
    }

    .price-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      font-size: 0.875rem;
      color: #475569;

      & + & {
        border-top: 1px solid #F1F5F9;
      }
    }

    .price-row--discount {
      color: #2F855A;
    }

    .price-row--total {
      padding-top: 0.75rem;
      margin-top: 0.5rem;
      border-top: 2px solid #E2E8F0;
      font-size: 1.125rem;
      font-weight: 700;
      color: #0F172A;
    }

    /* Cancellation notice */
    .notice-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      background: #EEF4FF;
      border: 1px solid #B3CAFF;
      color: #001B57;
      border-radius: 0.75rem;
      padding: 0.875rem 1rem;
      font-size: 0.8125rem;
      line-height: 1.5;

      svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 1px;
      }
    }

    /* Payment Methods */
    .payment-methods {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .methods-title {
      font-size: 1rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0;
    }

    .test-mode-note {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      margin-top: 0.75rem;
      padding: 0.75rem 0.875rem;
      border: 1px solid #FCD34D;
      background: #FFFBEB;
      border-radius: 0.75rem;
      font-size: 0.8125rem;
      line-height: 1.45;
      color: #78350F;

      svg { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
      strong { display: block; font-weight: 700; }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        background: #FEF3C7;
        padding: 0.05rem 0.3rem;
        border-radius: 0.25rem;
      }
    }

    .method-card {
      position: relative;
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: #FFFFFF;
      border: 2px solid #E2E8F0;
      border-radius: 1rem;
      cursor: pointer;
      transition: all 150ms;
      text-align: left;

      &:hover {
        border-color: #84A6FF;
      }
    }

    .method-card--selected {
      border-color: #0047CC;
      background: #EEF4FF;
    }

    .method-card__icon {
      width: 48px;
      height: 48px;
      border-radius: 0.75rem;
      background: #B3CAFF;
      color: #003399;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      svg {
        width: 24px;
        height: 24px;
      }
    }

    .method-card__content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .method-card__name {
      font-size: 1rem;
      font-weight: 600;
      color: #0F172A;
    }

    .method-card__desc {
      font-size: 0.875rem;
      color: #475569;
    }

    .method-card__check {
      width: 24px;
      height: 24px;
      border-radius: 9999px;
      background: #0047CC;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: scale(0.7);
      transition: all 150ms;

      svg {
        width: 14px;
        height: 14px;
      }
    }

    .method-card__check--visible {
      opacity: 1;
      transform: scale(1);
    }

    /* Pay bar — sits in-flow directly under the order content so the primary
       action stays close to what the user just reviewed (no floating gap). */
    .sticky-pay-bar {
      margin-top: 1.25rem;
      background: #FFFFFF;
      border-top: 1px solid #E2E8F0;
    }

    .sticky-pay-bar__inner {
      padding: 1rem 0 0 0;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .sticky-pay-bar__total {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .sticky-pay-bar__total-label {
      font-size: 0.75rem;
      color: #64748B;
    }

    .sticky-pay-bar__total-value {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0F172A;
    }

    /* Step Actions (legacy class kept for icon spacing reused by the sticky bar's Back button) */
    .btn-icon {
      width: 18px;
      height: 18px;
      margin-left: 0.5rem;
    }

    .btn-icon--left {
      margin-left: 0;
      margin-right: 0.5rem;
    }

    @media (max-width: 768px) {
      .sticky-pay-bar__inner {
        gap: 0.625rem;
      }

      /* Keep the Back button as an icon-only tap target to leave room for the total + Pay CTA. */
      .sticky-pay-bar__back-text {
        display: none;
      }

      .btn-icon--left {
        margin-right: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .method-card,
      .method-card__check,
      .summary-toggle__chevron {
        transition: none;
      }
    }
  `]
})
export class PaymentStepNewComponent implements OnInit {
  back = output<void>();

  readonly store = inject(BookingWizardStore);
  private bookingApi = inject(BookingApiService);
  private paymentApi = inject(PaymentApiService);
  private settingsApi = inject(SettingsApiService);
  private billingApi = inject(BillingApiService);
  private packageApi = inject(PackageApiService);
  private couponApi = inject(CouponApiService);
  private userApi = inject(UserApiService);
  private razorpay = inject(RazorpayCheckoutService);
  private cashfree = inject(CashfreeCheckoutService);
  private router = inject(Router);

  /* State */
  processing = signal(false);
  error = signal<string | null>(null);
  cancellationSetting = signal<CancellationSetting | null>(null);
  /* Which gateway environment the server is configured against — 'test' means
     sandbox keys, so we warn the patient that no real money moves. */
  gatewayMode = signal<string>('unknown');
  activeGateway = signal<string>('razorpay');
  isTestMode = computed(() => this.gatewayMode() === 'test');
  /* Server-computed money summary — never calculated locally. */
  totals = signal<BillingTotals | null>(null);
  quoteError = signal<string | null>(null);
  /* Logged-in user's contact info, used to prefill Razorpay so it doesn't
     re-ask for a phone number the account already has. */
  userPrefill = signal<{ name?: string; contact?: string; email?: string }>({});

  /* Order Summary starts collapsed — the "mini" view — so the page fits in one
     glance; users who want to double-check details can expand it. */
  summaryExpanded = signal(false);

  /* Coupon — never auto-applied; the user must enter/apply it explicitly. */
  couponCode = signal('');
  couponApplied = signal<{ valid: boolean; coupon?: CouponSummary | null } | null>(null);
  couponError = signal<string | null>(null);
  applyingCoupon = signal(false);
  suggestedCoupons = signal<{ packageName: string; code: string }[]>([]);

  payNowLabel = computed(() => {
    const t = this.totals();
    return t ? t.total.toFixed(2) : '…';
  });

  /** Short "N Tests, M Packages" label for the collapsed summary row. */
  itemsSummaryText = computed(() => {
    const testCount = this.store.selectedTests().length;
    const pkgCount = this.store.selectedPackages().length;
    const parts: string[] = [];
    if (testCount) parts.push(`${testCount} Test${testCount > 1 ? 's' : ''}`);
    if (pkgCount) parts.push(`${pkgCount} Package${pkgCount > 1 ? 's' : ''}`);
    return parts.join(', ') || 'Order';
  });

  ngOnInit(): void {
    this.settingsApi.getCancellationSetting().subscribe({
      next: s => this.cancellationSetting.set(s),
      error: () => this.cancellationSetting.set(null),
    });
    this.paymentApi.checkoutConfig().subscribe({
      next: c => { this.gatewayMode.set(c.mode ?? 'unknown'); this.activeGateway.set(c.gateway); },
      error: () => this.gatewayMode.set('unknown'),
    });
    this.userApi.getProfile().subscribe({
      next: u => this.userPrefill.set({ name: u.name, contact: u.phone, email: u.email }),
      error: () => this.userPrefill.set({}),
    });
    this.loadQuote();
    this.loadSuggestedCoupons();
  }

  private loadQuote(): void {
    const test_ids = this.store.selectedTests().map(t => t.id);
    const package_ids = this.store.selectedPackages().map(p => p.id);
    const coupon = this.couponApplied()?.coupon?.code;
    this.billingApi.quote(test_ids, package_ids, coupon).subscribe({
      next: t => this.totals.set(t),
      error: () => this.quoteError.set('Could not calculate the total. Please go back and try again.'),
    });
  }

  /** Best-effort hint: fetch eligible-coupon info for the packages in this
   * booking so the user knows a code exists, without ever applying it. */
  private loadSuggestedCoupons(): void {
    const packages = this.store.selectedPackages();
    if (!packages.length) return;
    forkJoin(packages.map(p => this.packageApi.get(p.id).pipe(catchError(() => of(null))))).subscribe((results) => {
      const seen = new Set<string>();
      const suggestions: { packageName: string; code: string }[] = [];
      results.forEach((pkg, i) => {
        const code = pkg?.eligible_coupon?.code;
        if (code && !seen.has(code)) {
          seen.add(code);
          suggestions.push({ packageName: packages[i].name, code });
        }
      });
      this.suggestedCoupons.set(suggestions);
    });
  }

  useSuggestedCoupon(code: string): void {
    this.couponCode.set(code);
    this.applyCoupon();
  }

  applyCoupon(): void {
    const code = this.couponCode().trim();
    if (!code) return;
    const package_ids = this.store.selectedPackages().map(p => p.id);
    this.applyingCoupon.set(true);
    this.couponError.set(null);
    this.couponApi.validate(code, package_ids).subscribe({
      next: (result) => {
        this.applyingCoupon.set(false);
        if (!result.valid) {
          this.couponError.set(result.message || 'This coupon could not be applied.');
          return;
        }
        this.couponApplied.set({ valid: true, coupon: result.coupon });
        this.loadQuote();
      },
      error: (err) => {
        this.applyingCoupon.set(false);
        this.couponError.set(err.error?.detail?.message || 'This coupon could not be applied.');
      },
    });
  }

  removeCoupon(): void {
    this.couponApplied.set(null);
    this.couponCode.set('');
    this.couponError.set(null);
    this.loadQuote();
  }

  cancellationNoticeText(): string {
    const s = this.cancellationSetting();
    if (!s) return '';
    const amount = s.charge_type === 'percentage' ? `${s.charge_value}%` : `₹${s.charge_value}`;
    return `Home Collection bookings may incur a ${amount} cancellation charge if cancelled after confirmation or technician assignment.`;
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  /** Compact "Thu, 23 Jul" form used in the collapsed summary row. */
  formatDateShort(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  canProceed(): boolean {
    // Payment always goes through the server quote — it drives the order amount.
    return this.totals() !== null;
  }

  placeOrder(): void {
    if (!this.canProceed()) return;

    this.processing.set(true);
    this.error.set(null);

    const test_ids: string[] = [];
    const package_ids: string[] = [];

    for (const test of this.store.selectedTests()) {
      test_ids.push(test.id);
    }

    for (const pkg of this.store.selectedPackages()) {
      package_ids.push(pkg.id);
    }

    const bookingData = {
      patient_id: this.store.patientId() || undefined,
      collection_type: this.store.collectionType(),
      time_slot_id: this.store.slotId(),
      booking_date: this.store.slotDate(),
      lab_branch_id: this.store.labBranchId() || undefined,
      /* Without this the booking records only a pincode, and the technician is
         sent to whichever address happens to be the user's default. */
      address_id: this.store.selectedAddressId() || undefined,
      pincode: this.store.pincode() || undefined,
      test_ids,
      package_ids,
      coupon_code: this.couponApplied()?.coupon?.code || undefined,
    };

    this.bookingApi.create(bookingData).subscribe({
      next: (booking) => {
        this.initiatePayment(booking.id);
      },
      error: (err) => {
        console.error('Booking failed:', err);
        let errorMessage = 'Failed to create booking. Please try again.';
        if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (typeof err.error.detail === 'string') {
            errorMessage = err.error.detail;
          } else if (err.error.detail && typeof err.error.detail === 'object') {
            // Handle detail as an object (e.g., validation errors)
            if (Array.isArray(err.error.detail)) {
              errorMessage = err.error.detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
            } else {
              errorMessage = err.error.detail.message || JSON.stringify(err.error.detail);
            }
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        }
        this.error.set(errorMessage);
        this.processing.set(false);
      }
    });
  }

  private initiatePayment(bookingId: string): void {
    this.paymentApi.initiate(bookingId, 'online').subscribe({
      next: (payment) => {
        if (payment.checkout?.gateway === 'razorpay') {
          this.gatewayMode.set(payment.checkout.mode ?? 'unknown');
          this.activeGateway.set('razorpay');
          this.openRazorpay(bookingId, payment);
        } else if (payment.checkout?.gateway === 'cashfree') {
          this.gatewayMode.set(payment.checkout.mode ?? 'unknown');
          this.activeGateway.set('cashfree');
          this.openCashfree(bookingId, payment);
        } else {
          this.error.set('Payment initiation failed. Please try again.');
          this.processing.set(false);
        }
      },
      error: (err) => {
        console.error('Payment failed:', err);
        this.error.set('Payment initiation failed. Please try again.');
        this.processing.set(false);
      }
    });
  }

  private async openRazorpay(bookingId: string, payment: Payment): Promise<void> {
    try {
      const success = await this.razorpay.open(payment.checkout!, {
        name: 'Sri Health Plus',
        description: 'Lab tests & health packages',
        prefill: this.userPrefill(),
        method: { card: 1, netbanking: 1, wallet: 1, upi: 1 },
      });
      // Server-side signature verification confirms the payment; the webhook
      // is a backup path — whichever lands first wins, the other no-ops.
      this.paymentApi.verify({
        booking_id: bookingId,
        gateway_order_id: success.razorpay_order_id,
        gateway_payment_id: success.razorpay_payment_id,
        gateway_signature: success.razorpay_signature,
      }).subscribe({
        next: () => {
          this.processing.set(false);
          this.store.reset();
          this.router.navigate(['/dashboard/bookings', bookingId], { queryParams: { success: true } });
        },
        error: () => {
          this.processing.set(false);
          this.error.set(
            'Payment received but confirmation is pending — it will confirm automatically shortly. ' +
            'Check My Bookings in a minute; do not pay again.'
          );
        },
      });
    } catch (err) {
      // Modal dismissed or checkout failed to load — booking exists, payment pending.
      this.processing.set(false);
      this.error.set(
        (err instanceof Error ? err.message : 'Payment was not completed.') +
        ' Your booking is saved — you can retry payment from the booking page.'
      );
    }
  }

  private async openCashfree(bookingId: string, payment: Payment): Promise<void> {
    try {
      const success = await this.cashfree.open(payment.checkout!);
      // Cashfree hands back no client-side signature — the server resolves
      // the real outcome via an authenticated API call, so payment_id/signature
      // are left blank here; the webhook is still the backup confirmation path.
      this.paymentApi.verify({
        booking_id: bookingId,
        gateway_order_id: success.order_id,
        gateway_payment_id: '',
        gateway_signature: '',
      }).subscribe({
        next: () => {
          this.processing.set(false);
          this.store.reset();
          this.router.navigate(['/dashboard/bookings', bookingId], { queryParams: { success: true } });
        },
        error: () => {
          this.processing.set(false);
          this.error.set(
            'Payment received but confirmation is pending — it will confirm automatically shortly. ' +
            'Check My Bookings in a minute; do not pay again.'
          );
        },
      });
    } catch (err) {
      this.processing.set(false);
      this.error.set(
        (err instanceof Error ? err.message : 'Payment was not completed.') +
        ' Your booking is saved — you can retry payment from the booking page.'
      );
    }
  }
}
