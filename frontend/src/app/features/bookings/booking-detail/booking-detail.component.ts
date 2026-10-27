import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BookingApiService } from '../../../core/api/services/booking-api.service';
import { PaymentApiService } from '../../../core/api/services/payment-api.service';
import { ReportApiService } from '../../../core/api/services/report-api.service';
import { SettingsApiService, CancellationSetting } from '../../../core/api/services/settings-api.service';
import { Booking, CancellationQuote } from '../../../core/api/api.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-booking-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule,
    ButtonComponent, BadgeComponent, SpinnerComponent, AlertComponent, ModalComponent, InputComponent],
  template: `
<div class="detail-page">
  <div class="back-nav">
    <a routerLink="/bookings" class="back-link">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Back to Bookings
    </a>
  </div>

  @if (loading()) {
    <div class="loading-wrap"><app-spinner size="lg" /><p>Loading booking details…</p></div>
  } @else if (error()) {
    <app-alert type="error">{{ error() }}</app-alert>
  } @else if (booking()) {
    <div class="detail-layout">

      @if (isConfirmation() && booking()!.collection_type === 'home' && cancellationSetting()) {
        <div class="notice-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Booking confirmed. Note: {{ cancellationNoticeText() }}</span>
        </div>
      }

      <!-- Header Card -->
      <div class="header-card">
        <div class="header-left">
          <span class="ref-chip">{{ booking()!.reference_number }}</span>
          <h1 class="booking-title">Booking Details</h1>
          <p class="created-on">Placed on {{ formatDate(booking()!.created_at) }}</p>
        </div>
        <div class="header-right">
          <app-badge [color]="statusColor(booking()!.status)" size="lg">
            {{ formatStatus(booking()!.status) }}
          </app-badge>
        </div>
      </div>

      <!-- Main Info Grid -->
      <div class="info-grid">

        <!-- Booking Info -->
        <div class="info-card">
          <h2 class="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Appointment
          </h2>
          <div class="info-rows">
            <div class="info-row"><span class="info-label">Date</span><span class="info-val">{{ formatDate(booking()!.booking_date) }}</span></div>
            @if (booking()!.time_slot; as slot) {
              <div class="info-row"><span class="info-label">Time Slot</span><span class="info-val">{{ formatTime(slot.start_time) }} – {{ formatTime(slot.end_time) }}</span></div>
            }
            <div class="info-row">
              <span class="info-label">Collection</span>
              <span class="info-val">{{ booking()!.collection_type === 'home' ? '🏠 Home Collection' : '🏥 Lab Visit' }}</span>
            </div>
            <div class="info-row"><span class="info-label">Status</span>
              <app-badge [color]="statusColor(booking()!.status)">{{ formatStatus(booking()!.status) }}</app-badge>
            </div>
          </div>
        </div>

        <!-- Payment Info -->
        <div class="info-card">
          <h2 class="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            Payment
          </h2>
          <div class="info-rows">
            <div class="info-row"><span class="info-label">Total Amount</span><span class="info-val amount">₹{{ booking()!.total_amount.toLocaleString('en-IN') }}</span></div>
            <div class="info-row"><span class="info-label">Payment Status</span>
              <app-badge [color]="paymentColor(booking()!.payment_status)">{{ formatStatus(booking()!.payment_status) }}</app-badge>
            </div>
            @if (booking()!.cancellation_fee) {
              <div class="info-row"><span class="info-label">Cancellation Fee</span><span class="info-val error">₹{{ booking()!.cancellation_fee }}</span></div>
            }
            @if (booking()!.payment; as pay) {
              @if (pay.invoice_number) {
                <div class="info-row"><span class="info-label">Invoice</span><span class="info-val">{{ pay.invoice_number }}</span></div>
                <div class="invoice-notice">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <span><strong>Invoice Availability:</strong> This invoice is available for 45 days from the invoice date. Please download and keep it safe for future reference. After 45 days, the invoice will be permanently deleted from our servers and cannot be regenerated.</span>
                </div>
                <div class="invoice-actions">
                  <button class="btn-link" (click)="viewInvoice(pay.id!)">View Invoice</button>
                  <button class="btn-link" (click)="downloadInvoice(pay.id!, pay.invoice_number!)">Download PDF</button>
                </div>
              }
            }
          </div>
        </div>
      </div>

      <!-- Tests Table -->
      @if (booking()!.items?.length) {
        <div class="tests-card">
          <h2 class="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Tests & Packages
          </h2>
          <div class="tests-table">
            <div class="tests-header">
              <span>Item</span><span>Type</span><span class="text-right">Price</span>
            </div>
            @for (item of booking()!.items!; track item.id) {
              <div class="tests-row">
                <span class="item-name">{{ item.item_name }}</span>
                <app-badge [color]="item.item_type === 'package' ? 'accent' : 'info'" size="sm">
                  {{ item.item_type === 'package' ? 'Package' : 'Test' }}
                </app-badge>
                <span class="item-price">₹{{ item.unit_price.toLocaleString('en-IN') }}</span>
              </div>
            }
            <div class="tests-total">
              <span>Total</span>
              <span></span>
              <span class="total-val">₹{{ booking()!.total_amount.toLocaleString('en-IN') }}</span>
            </div>
          </div>
        </div>
      }

      <!-- Reports -->
      @if (booking()!.reports?.length) {
        <div class="tests-card">
          <h2 class="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            Reports
          </h2>
          <ul class="item-list">
            @for (r of booking()!.reports!; track r.id) {
              <li>
                <span>{{ r.file_name }}</span>
                <button class="btn-link" (click)="downloadReport(r.id)">Download</button>
              </li>
            }
          </ul>
        </div>
      }

      <!-- Refund -->
      @if (booking()!.refund; as rf) {
        <div class="info-card">
          <h2 class="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
            Refund
          </h2>
          <div class="info-rows">
            <div class="info-row"><span class="info-label">Amount</span><span class="info-val">₹{{ rf.amount.toLocaleString('en-IN') }}</span></div>
            <div class="info-row"><span class="info-label">Status</span><app-badge [color]="refundColor(rf.status)">{{ formatStatus(rf.status) }}</app-badge></div>
          </div>
        </div>
      }

      <!-- Notes / Cancellation Reason -->
      @if (booking()!.technician_notes) {
        <div class="notes-card info">
          <h3>Technician Notes</h3>
          <p>{{ booking()!.technician_notes }}</p>
        </div>
      }
      @if (booking()!.cancellation_reason) {
        <div class="notes-card error">
          <h3>Cancellation Reason</h3>
          <p>{{ booking()!.cancellation_reason }}</p>
        </div>
      }

      <!-- Timeline -->
      @if (booking()!.status_history?.length) {
        <div class="tests-card">
          <h2 class="card-title">Booking Timeline</h2>
          <ul class="timeline">
            @for (h of booking()!.status_history!; track $index) {
              <li class="tl-item">
                <span class="tl-dot"></span>
                <div class="tl-body">
                  <span class="tl-status">{{ formatStatus(h.to_status) }}</span>
                  @if (h.changed_at) { <span class="tl-time">{{ h.changed_at | date:'dd MMM yyyy, HH:mm' }}</span> }
                </div>
              </li>
            }
          </ul>
        </div>
      }

      <!-- Actions -->
      @if (canCancel()) {
        <div class="actions-row">
          <app-button variant="danger" (click)="openCancelModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Cancel Booking
          </app-button>
        </div>
      }
    </div>
  }

  <!-- Cancel Modal -->
  <app-modal [isOpen]="showCancelModal()" title="Cancel Booking" size="sm" (close)="showCancelModal.set(false)">
    <div class="cancel-form">
      @if (loadingQuote()) {
        <div class="quote-loading"><app-spinner size="sm" /><span>Checking refund details…</span></div>
      } @else {
        @if (cancelQuote(); as q) {
        @if (q.has_charge) {
          <!-- Show the deduction before they commit, not on the refund receipt. -->
          <div class="refund-panel">
            <div class="refund-row">
              <span class="refund-label">Amount paid</span>
              <span class="refund-val">₹{{ q.amount_paid.toFixed(2) }}</span>
            </div>
            <div class="refund-row refund-row--charge">
              <span class="refund-label">
                Cancellation charge
                @if (q.fee_type === 'percentage') { <em>({{ q.charge_value }}%)</em> }
              </span>
              <span class="refund-val">− ₹{{ q.cancellation_charge.toFixed(2) }}</span>
            </div>
            <div class="refund-row refund-row--total">
              <span class="refund-label">Refund amount</span>
              <span class="refund-val">₹{{ q.refund_amount.toFixed(2) }}</span>
            </div>
            @if (q.payment_method) {
              <div class="refund-row">
                <span class="refund-label">Payment method</span>
                <span class="refund-val">{{ paymentMethodLabel(q.payment_method) }}</span>
              </div>
            }
            <p class="refund-note">
              ₹{{ q.refund_amount.toFixed(2) }} will be refunded to your original payment method
              after cancellation{{ q.refund_eta_text ? ' — typically within ' + q.refund_eta_text : '' }}.
            </p>
          </div>
        } @else if (q.amount_paid > 0) {
          <div class="refund-panel refund-panel--full">
            <div class="refund-row refund-row--total">
              <span class="refund-label">Refund amount</span>
              <span class="refund-val">₹{{ q.refund_amount.toFixed(2) }}</span>
            </div>
            <p class="refund-note">
              No cancellation charge applies — you'll be refunded in full
              {{ q.refund_eta_text ? 'within ' + q.refund_eta_text : '' }} after cancellation.
            </p>
          </div>
        }
        }
      }
      <p class="cancel-hint">Please provide a reason for cancellation.</p>
      <app-input label="Reason" [formControl]="cancelReason" placeholder="Why are you cancelling?" [error]="cancelReason.touched && cancelReason.invalid" [errorMessage]="'Reason is required'" />
    </div>
    <div modal-footer>
      <app-button variant="outline" (click)="showCancelModal.set(false)">Keep Booking</app-button>
      <app-button variant="danger" [loading]="cancelling()" (click)="cancelBooking()">Yes, Cancel</app-button>
    </div>
  </app-modal>
</div>`,
  styles: [`
    :host {
      --color-primary-50: #EEF4FF;
      --color-primary-100: #D9E5FF;
      --color-primary-500: #0047CC;
      --color-primary-600: #003399;
      --color-primary-700: #002577;
      --color-primary-800: #001B57;
      --color-accent-100: #EEF4FF;
      --color-accent-700: #001B57;
      --shadow-primary: 0 4px 14px 0 rgba(0, 51, 153, 0.28);
      display: block;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .detail-page { max-width:900px; margin:0 auto; padding:2rem 1.5rem; animation: fadeIn .35s ease both; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .back-link { display:inline-flex; align-items:center; gap:0.5rem; font-size:0.875rem; font-weight:600; color:#475569; text-decoration:none; margin-bottom:1.25rem; transition:color 150ms; &:hover { color:#003399; } &:focus-visible { outline:2px solid #0047CC; outline-offset:2px; border-radius:4px; } }
    .loading-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4rem; gap:1rem; color:#475569; }
    .detail-layout { display:flex; flex-direction:column; gap:1.25rem; }
    .header-card { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; background:linear-gradient(145deg,#003399,#0047CC 45%,#003399); border-radius:1.25rem; padding:2rem; color:#FFFFFF; box-shadow:0 12px 30px -8px rgba(0, 37, 119,.35); }
    .ref-chip { display:inline-block; background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.2); border-radius:9999px; padding:0.25rem 0.75rem; font-size:0.75rem; font-family:'JetBrains Mono','SF Mono','Fira Code',monospace; font-weight:600; margin-bottom:0.5rem; }
    .booking-title { font-size:1.5rem; font-weight:800; letter-spacing:-0.01em; margin:0 0 0.25rem 0; color:#FFFFFF; }
    .created-on { font-size:0.875rem; opacity:0.85; margin:0; color:#FFFFFF; }
    .info-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1.25rem; }
    .info-card, .tests-card, .notes-card {
      background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.5rem;
    }
    .card-title { display:flex; align-items:center; gap:0.5rem; font-size:1rem; font-weight:700; color:#0F172A; margin:0 0 1rem 0; svg { color:#003399; } }
    .info-rows { display:flex; flex-direction:column; gap:0.75rem; }
    .info-row { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; }
    .info-label { font-size:0.875rem; color:#475569; }
    .info-val { font-size:0.875rem; font-weight:600; color:#0F172A; text-align:right; &.amount { font-size:1.25rem; font-weight:700; color:#002577; } &.error { color:#DC2626; } }
    .tests-table { border:1px solid #F1F5F9; border-radius:0.75rem; overflow:hidden; }
    .tests-header { display:grid; grid-template-columns:1fr auto auto; gap:1rem; padding:0.75rem 1rem; background:#F8FAFC; font-size:0.75rem; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:0.025em; }
    .tests-row { display:grid; grid-template-columns:1fr auto auto; gap:1rem; padding:0.75rem 1rem; align-items:center; border-top:1px solid #F1F5F9; }
    .item-name { font-size:0.875rem; font-weight:600; color:#0F172A; }
    .item-price { font-size:0.875rem; font-weight:600; color:#0F172A; text-align:right; }
    .tests-total { display:grid; grid-template-columns:1fr auto auto; gap:1rem; padding:1rem; background:#EEF4FF; border-top:2px solid #B3CAFF; font-weight:700; color:#0F172A; }
    .total-val { font-size:1.125rem; color:#002577; text-align:right; }
    .text-right { text-align:right; }
    .notes-card {
      padding:1.25rem; h3 { font-size:0.875rem; font-weight:700; margin:0 0 0.5rem 0; } p { font-size:0.875rem; margin:0; line-height:1.625; }
      &.info { background:#F0F9FF; border-color:#BAE6FD; h3 { color:#0369A1; } p { color:#075985; } }
      &.error { background:#FEF2F2; border-color:#FECACA; h3 { color:#B91C1C; } p { color:#991B1B; } }
    }
    .notice-banner { display:flex; align-items:flex-start; gap:0.625rem; background:#EEF4FF; border:1px solid #B3CAFF; color:#001B57; border-radius:0.75rem; padding:0.875rem 1rem; font-size:0.8125rem; line-height:1.5; svg { flex-shrink:0; margin-top:1px; } }
    .item-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:0.375rem; }
    .item-list li { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; font-size:0.8125rem; color:#475569; padding:0.5rem 0.75rem; background:#F8FAFC; border-radius:0.5rem; }
    .btn-link { background:none; border:none; font-size:0.8125rem; font-weight:600; color:#003399; cursor:pointer; padding:0; &:hover { text-decoration:underline; } }
    .invoice-actions { display:flex; gap:1rem; padding-top:0.25rem; }
    .invoice-notice { display:flex; align-items:flex-start; gap:0.5rem; background:#FFFBEB; border:1px solid #FDE68A; color:#78350F; border-radius:0.625rem; padding:0.625rem 0.75rem; font-size:0.75rem; line-height:1.5; margin-top:0.25rem; svg { flex-shrink:0; margin-top:1px; } }
    .timeline { list-style:none; margin:0; padding:0.375rem 0 0.25rem; display:flex; align-items:flex-start; overflow-x:auto; }
    .tl-item { display:flex; flex-direction:column; align-items:center; gap:0.5rem; position:relative; flex:1 0 0; min-width:96px; padding:0 0.5rem; text-align:center; }
    .tl-item:not(:last-child)::after { content:''; position:absolute; top:4px; left:50%; width:100%; height:2px; background:#DCE4F5; }
    .tl-dot { width:10px; height:10px; border-radius:50%; background:#0047CC; flex-shrink:0; box-shadow:0 0 0 3px rgba(0, 71, 204,.15); position:relative; z-index:1; }
    .tl-body { display:flex; flex-direction:column; align-items:center; gap:0.125rem; }
    .tl-status { font-size:0.8125rem; font-weight:600; color:#0F172A; }
    .tl-time { font-size:0.6875rem; color:#94A3B8; }
    .actions-row { display:flex; justify-content:flex-end; padding-top:0.5rem; }
    .cancel-form { display:flex; flex-direction:column; gap:1rem; }
    .cancel-hint { font-size:0.875rem; color:#475569; margin:0; }
    .quote-loading { display:flex; align-items:center; gap:0.5rem; font-size:0.875rem; color:#475569; }
    .refund-panel { display:flex; flex-direction:column; gap:0.375rem; padding:0.875rem 1rem; background:#FFFBEB; border:1px solid #FDE68A; border-radius:0.75rem; }
    .refund-panel--full { background:#ECFDF5; border-color:#A7F3D0; }
    .refund-row { display:flex; justify-content:space-between; align-items:baseline; gap:1rem; font-size:0.875rem; color:#78350F; }
    .refund-panel--full .refund-row { color:#065F46; }
    .refund-label em { font-style:normal; opacity:0.75; }
    .refund-val { font-variant-numeric:tabular-nums; white-space:nowrap; }
    .refund-row--charge .refund-val { color:#B45309; font-weight:600; }
    .refund-row--total { margin-top:0.25rem; padding-top:0.5rem; border-top:1px dashed #FDE68A; font-size:1rem; font-weight:700; color:#0F172A; }
    .refund-panel--full .refund-row--total { border-top-color:#A7F3D0; }
    .refund-note { margin:0.25rem 0 0 0; font-size:0.75rem; line-height:1.5; color:#92400E; }
    .refund-panel--full .refund-note { color:#047857; }
    @media (prefers-reduced-motion: reduce) {
      .detail-page { animation:none; }
    }
    @media(max-width:768px) {
      .detail-page { padding:1.25rem 1rem; }
      .info-grid { grid-template-columns:1fr; }
      .header-card { flex-direction:column; gap:1rem; }
      .tests-header, .tests-row, .tests-total { grid-template-columns:1fr auto; }
      .tests-header span:nth-child(2), .tests-row app-badge { display:none; }
    }
  `]
})
export class BookingDetailComponent implements OnInit {
  booking = signal<Booking | null>(null);
  loading = signal(true);
  error = signal('');
  cancelling = signal(false);
  showCancelModal = signal(false);
  cancelReason = new FormControl('', Validators.required);
  cancellationSetting = signal<CancellationSetting | null>(null);
  /* What this cancellation will cost/refund — fetched when the dialog opens so
     the user sees the deduction before confirming, not after. */
  cancelQuote = signal<CancellationQuote | null>(null);
  loadingQuote = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingApi: BookingApiService,
    private reportApi: ReportApiService,
    private settingsApi: SettingsApiService,
    private paymentApi: PaymentApiService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.bookingApi.get(id).subscribe({
      next: b => { this.booking.set(b); this.loading.set(false); },
      error: () => { this.error.set('Failed to load booking.'); this.loading.set(false); }
    });
    if (this.isConfirmation()) {
      this.settingsApi.getCancellationSetting().subscribe({
        next: s => this.cancellationSetting.set(s),
        error: () => this.cancellationSetting.set(null),
      });
    }
  }

  isConfirmation(): boolean {
    return this.route.snapshot.queryParamMap.get('success') === 'true';
  }

  cancellationNoticeText(): string {
    const s = this.cancellationSetting();
    if (!s) return '';
    const amount = s.charge_type === 'percentage' ? `${s.charge_value}%` : `₹${s.charge_value}`;
    return `Home Collection bookings may incur a ${amount} cancellation charge if cancelled after confirmation or technician assignment.`;
  }

  downloadReport(reportId: string) {
    this.reportApi.getDownloadUrl(reportId).subscribe({
      next: (r) => window.open(r.download_url, '_blank'),
      error: () => this.error.set('Failed to generate download link.'),
    });
  }

  paymentMethodLabel(method: string): string {
    const m: Record<string, string> = {
      online: 'Paid Online', card: 'Card', upi: 'UPI',
      netbanking: 'Net Banking', cash: 'Cash at Lab',
    };
    return m[method] ?? this.formatStatus(method);
  }

  /** Open the invoice PDF in a new tab (browser viewer handles print). */
  viewInvoice(paymentId: string) {
    this.paymentApi.getInvoice(paymentId).subscribe({
      next: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
      error: () => this.error.set('Failed to load invoice.'),
    });
  }

  downloadInvoice(paymentId: string, invoiceNumber: string) {
    this.paymentApi.getInvoice(paymentId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoiceNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Failed to download invoice.'),
    });
  }

  refundColor(s: string) { const m: Record<string,string> = { initiated:'warning', approved:'info', completed:'success', failed:'error' }; return m[s] ?? 'default'; }

  private readonly cancellableStatuses = new Set(['booked', 'technician_assigned', 'accepted']);

  canCancel() {
    const s = this.booking()?.status;
    return !!s && this.cancellableStatuses.has(s);
  }

  openCancelModal() {
    this.showCancelModal.set(true);
    this.cancelReason.reset('');
    this.cancelQuote.set(null);

    const id = this.booking()?.id;
    if (!id) return;

    this.loadingQuote.set(true);
    this.bookingApi.cancellationQuote(id).subscribe({
      /* On failure show no figures rather than guessed ones — the confirm step
         still works, and the real charge is applied server-side either way. */
      next: q => { this.cancelQuote.set(q); this.loadingQuote.set(false); },
      error: () => { this.cancelQuote.set(null); this.loadingQuote.set(false); },
    });
  }

  cancelBooking() {
    if (this.cancelReason.invalid) { this.cancelReason.markAsTouched(); return; }
    this.cancelling.set(true);
    this.bookingApi.cancel(this.booking()!.id, this.cancelReason.value!).subscribe({
      next: b => { this.booking.set(b); this.cancelling.set(false); this.showCancelModal.set(false); },
      error: () => { this.cancelling.set(false); this.error.set('Failed to cancel booking.'); }
    });
  }

  formatDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }); }
  formatTime(time: string) {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    return `${h % 12 || 12}:${minutes} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  formatStatus(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  statusColor(s: string) { const m: Record<string,string> = { pending:'warning', confirmed:'info', in_progress:'primary', completed:'success', cancelled:'error' }; return m[s] ?? 'default'; }
  paymentColor(s: string) { const m: Record<string,string> = { paid:'success', pending:'warning', failed:'error', refunded:'info' }; return m[s] ?? 'default'; }
}
