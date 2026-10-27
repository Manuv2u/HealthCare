import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';

interface CancellationConfig {
  id: string;
  charge_type: 'percentage' | 'fixed';
  charge_value: number;
  is_active: boolean;
}

@Component({
  selector: 'app-admin-cancellation-config',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent, AlertComponent, ButtonComponent, InputComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Cancellation Fee Configuration</h1>
      <p class="page-sub">Configure the fee deducted when a patient cancels a booking.</p>
    </div>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }
  @if (success()) { <app-alert type="success" [dismissible]="true" (dismissed)="success.set('')">{{ success() }}</app-alert> }

  @if (loading()) { <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {

    <!-- Toggle Card -->
    <div class="setting-card">
      <div class="setting-row">
        <div class="setting-text">
          <h3 class="setting-title">Enable Cancellation Fee</h3>
          <p class="setting-desc">When enabled, a fee will be deducted from the refund when a booking is cancelled.</p>
        </div>
        <button class="toggle-btn" [class.on]="feeEnabled()" (click)="toggleFee()" [disabled]="toggling()" [attr.aria-label]="feeEnabled() ? 'Disable fee' : 'Enable fee'">
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>

    <!-- Fee Settings -->
    @if (feeEnabled()) {
      <div class="setting-card">
        <h3 class="card-section-title">Fee Settings</h3>
        <div class="form-grid">
          <div class="field">
            <label>Fee Type</label>
            <div class="radio-group">
              <label class="radio-opt" [class.checked]="chargeType === 'fixed'">
                <input type="radio" [(ngModel)]="chargeType" value="fixed" /> Fixed Amount (₹)
              </label>
              <label class="radio-opt" [class.checked]="chargeType === 'percentage'">
                <input type="radio" [(ngModel)]="chargeType" value="percentage" /> Percentage (%)
              </label>
            </div>
          </div>

          <app-input
            [label]="chargeType === 'fixed' ? 'Fee Amount (₹)' : 'Fee Percentage (%)'"
            [icon]="chargeType === 'fixed' ? 'currency_rupee' : 'percent'"
            type="number"
            [min]="0"
            [max]="chargeType === 'percentage' ? 100 : 99999"
            [hint]="chargeType === 'fixed' ? 'Flat rupees deducted from refund' : 'Percentage of total paid'"
            [(ngModel)]="chargeValue"
          />
        </div>

        <!-- Preview -->
        <div class="preview-box">
          <p class="preview-title">Preview</p>
          @for (amt of [500, 1200, 3000]; track amt) {
            <div class="preview-row">
              <span>₹{{ amt }} booking</span>
              <span class="preview-vals">
                <span class="fee-val">₹{{ calcFee(amt) | number:'1.0-0' }} fee</span>
                <span class="refund-val">₹{{ amt - calcFee(amt) | number:'1.0-0' }} refunded</span>
              </span>
            </div>
          }
        </div>

        <div class="save-row">
          <app-button variant="primary" [loading]="saving()" (click)="save()">Save Settings</app-button>
        </div>
      </div>
    }

    @if (!feeEnabled()) {
      <div class="info-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Cancellation fee is disabled. Cancelled bookings will receive a full refund.
      </div>
    }
  }
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; max-width:680px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .setting-card { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.5rem; }
    .setting-row { display:flex; justify-content:space-between; align-items:flex-start; gap:1.5rem; }
    .setting-title { font-size:1rem; font-weight:600; color:#0F172A; margin:0 0 0.25rem 0; }
    .setting-desc { font-size:0.875rem; color:#475569; margin:0; line-height:1.625; }
    .card-section-title { font-size:1rem; font-weight:600; color:#0F172A; margin:0 0 1.25rem 0; }
    .toggle-btn { position:relative; width:52px; height:28px; border-radius:9999px; border:none; cursor:pointer; background:#CBD5E1; transition:background 200ms; flex-shrink:0; &.on { background:#38A169; } &:disabled { opacity:.6; cursor:not-allowed; } }
    .toggle-knob { position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:9999px; background:#FFFFFF; transition:transform 200ms; box-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1); }
    .toggle-btn.on .toggle-knob { transform:translateX(24px); }
    .form-grid { display:flex; flex-direction:column; gap:1.25rem; margin-bottom:1.25rem; }
    /* Still used by the Fee Type radio group, which isn't an app-input. */
    .field { display:flex; flex-direction:column; gap:0.5rem; label { font-size:13px; font-weight:600; color:#0F172A; } }
    .radio-group { display:flex; gap:0.75rem; flex-wrap:wrap; }
    .radio-opt { display:flex; align-items:center; gap:0.5rem; padding:0.625rem 1rem; border:1px solid #E2E8F0; border-radius:0.75rem; cursor:pointer; font-size:0.875rem; transition:all 150ms; input { accent-color:#003399; } &.checked, &:hover { border-color:#0047CC; background:#EEF4FF; color:#002577; } }
    .preview-box { background:#F8FAFC; border:1px solid #F1F5F9; border-radius:0.75rem; padding:1.25rem; margin-bottom:1.25rem; }
    .preview-title { font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94A3B8; margin:0 0 0.75rem 0; }
    .preview-row { display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid #F1F5F9; font-size:0.875rem; color:#475569; &:last-child { border-bottom:none; } }
    .preview-vals { display:flex; gap:1rem; }
    .fee-val { font-weight:600; color:#DC2626; }
    .refund-val { font-weight:600; color:#2F855A; }
    .save-row { display:flex; justify-content:flex-end; }
    .info-banner { display:flex; align-items:center; gap:0.75rem; padding:1rem 1.25rem; background:#F0F9FF; border:1px solid #BAE6FD; border-radius:1rem; font-size:0.875rem; color:#0369A1; svg { width:20px; height:20px; flex-shrink:0; color:#0EA5E9; } }
  `]
})
export class AdminCancellationConfigComponent implements OnInit {
  loading = signal(false); saving = signal(false); toggling = signal(false);
  error = signal(''); success = signal('');
  feeEnabled = signal(false);
  chargeType: 'percentage' | 'fixed' = 'fixed';
  chargeValue = 100;
  private configId = '';

  constructor(private http: HttpClient, private confirm: ConfirmDialogService) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<CancellationConfig | null>('/admin/settings/cancellation').subscribe({
      next: cfg => {
        if (cfg) { this.feeEnabled.set(cfg.is_active); this.chargeType = cfg.charge_type; this.chargeValue = cfg.charge_value; this.configId = cfg.id; }
        else { this.feeEnabled.set(false); }
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load configuration.'); this.loading.set(false); }
    });
  }

  async toggleFee() {
    if (this.feeEnabled()) {
      // Turning the fee off removes it server-side straight away; turning it on
      // only reveals the form, and nothing is live until save().
      const ok = await this.confirm.ask({
        title: 'Turn off the cancellation fee?',
        message: 'Customers will be able to cancel bookings free of charge from now on.',
        confirmLabel: 'Turn off',
        tone: 'live',
      });
      if (!ok) return;
      this.toggling.set(true);
      this.http.delete('/admin/settings/cancellation').subscribe({
        next: () => { this.feeEnabled.set(false); this.toggling.set(false); this.success.set('Cancellation fee disabled.'); setTimeout(() => this.success.set(''), 3000); },
        error: () => { this.error.set('Failed to update.'); this.toggling.set(false); }
      });
    } else {
      this.feeEnabled.set(true); this.toggling.set(false);
    }
  }

  calcFee(total: number): number {
    if (this.chargeType === 'percentage') return Math.min(Math.round(total * this.chargeValue / 100), total);
    return Math.min(this.chargeValue, total);
  }

  async save() {
    const ok = await this.confirm.ask({
      title: 'Apply new cancellation fee?',
      message: 'This changes what every customer is charged when they cancel a booking, starting immediately.',
      changes: [
        this.chargeType === 'percentage'
          ? `Fee: ${this.chargeValue}% of the booking total`
          : `Fee: ₹${this.chargeValue} flat`,
      ],
      confirmLabel: 'Apply to live',
      tone: 'live',
    });
    if (!ok) return;
    this.saving.set(true);
    this.http.put<CancellationConfig>('/admin/settings/cancellation', { charge_type: this.chargeType, charge_value: this.chargeValue }).subscribe({
      next: cfg => { this.configId = cfg.id; this.feeEnabled.set(cfg.is_active); this.saving.set(false); this.success.set('Settings saved successfully.'); setTimeout(() => this.success.set(''), 3000); },
      error: err => { this.error.set(err.error?.message || 'Failed to save.'); this.saving.set(false); }
    });
  }
}
