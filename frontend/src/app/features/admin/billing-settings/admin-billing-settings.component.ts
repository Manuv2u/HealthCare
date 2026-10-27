import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingApiService, BillingSettings } from '../../../core/api/services/billing-api.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { HelpPanelComponent, HelpSection } from '../../../shared/components/help-panel/help-panel.component';

const BILLING_HELP: HelpSection[] = [
  {
    title: 'What this page controls',
    paragraphs: [
      'Everything about how bookings are billed and invoiced: GST, the company details printed on invoices, invoice numbering, and the refund time estimate shown to patients when they cancel.',
    ],
  },
  {
    title: 'GST',
    bullets: [
      'When GST is ON, the configured percentage is added to every new booking and shown at checkout, on payment summaries and on invoices (with your GSTIN).',
      'When GST is OFF, GST lines disappear everywhere — checkout, bookings and new invoices.',
      'Changing GST never rewrites old invoices — an issued invoice is a permanent record.',
    ],
  },
  {
    title: 'Invoices',
    bullets: [
      'Invoices are created automatically the moment a payment succeeds and stored permanently.',
      'The prefix only affects future invoice numbers (e.g. INV-2026-000123). Numbering never resets or repeats.',
      'Turning invoice generation OFF stops new invoices; existing ones remain viewable and downloadable.',
    ],
  },
  {
    title: 'Invoice layout',
    bullets: [
      'The layout toggles control which sections future invoice PDFs include — barcode, QR code, referring doctor, technician details, patient address, signature block and report information.',
      'The QR code links directly to that invoice’s PDF — scanning it with any phone camera opens the invoice immediately, no login required.',
      'Currency symbol and decimal precision apply to every amount printed on the invoice.',
      'Website, CIN, NABL registration number and ISO certification appear in the invoice letterhead when filled in — leave them blank if not genuinely applicable.',
    ],
  },
  {
    title: 'Refund time estimate',
    paragraphs: [
      'Shown to patients in the cancellation confirmation ("refunded within 5–7 working days"). Banks and card networks control the actual timing — keep this honest and slightly conservative.',
    ],
  },
];

type BooleanSettingKey =
  | 'show_barcode' | 'show_doctor' | 'show_technician'
  | 'show_patient_address' | 'show_signature' | 'show_report_info' | 'show_qr_code';

@Component({
  selector: 'app-admin-billing-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent, AlertComponent, HelpPanelComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">
        Billing, Invoice & GST Settings
        <app-help-panel heading="Billing & invoices — how it works" [sections]="help" />
      </h1>
      <p class="page-sub">GST, company identity on invoices, numbering and refund messaging. Changes apply to future bookings and invoices only.</p>
    </div>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }
  @if (success()) { <app-alert type="success" [dismissible]="true" (dismissed)="success.set('')">{{ success() }}</app-alert> }

  @if (loading()) { <div class="load-wrap"><app-spinner size="md" /></div>
  } @else { @if (form(); as f) {

    <!-- GST -->
    <div class="card">
      <div class="setting-row">
        <div class="setting-text">
          <h3 class="setting-title">GST</h3>
          <p class="setting-desc">Add GST to every new booking and print the GST breakdown (and GSTIN) on invoices.</p>
        </div>
        <button class="toggle-btn" [class.on]="f.gst_enabled" (click)="f.gst_enabled = !f.gst_enabled" [attr.aria-label]="f.gst_enabled ? 'Disable GST' : 'Enable GST'">
          <span class="toggle-knob"></span>
        </button>
      </div>
      @if (f.gst_enabled) {
        <div class="grid-2">
          <label class="fld">
            <span>GST Percentage (%)</span>
            <input class="field" type="number" min="0" max="100" step="0.01" [(ngModel)]="f.gst_percentage" />
          </label>
          <label class="fld">
            <span>GSTIN</span>
            <input class="field" type="text" maxlength="15" placeholder="e.g. 29ABCDE1234F1Z5" [(ngModel)]="f.gstin" />
          </label>
        </div>
      }
    </div>

    <!-- Invoices -->
    <div class="card">
      <div class="setting-row">
        <div class="setting-text">
          <h3 class="setting-title">Invoice Generation</h3>
          <p class="setting-desc">Automatically issue a permanent invoice when a payment succeeds.</p>
        </div>
        <button class="toggle-btn" [class.on]="f.invoice_enabled" (click)="f.invoice_enabled = !f.invoice_enabled" [attr.aria-label]="f.invoice_enabled ? 'Disable invoices' : 'Enable invoices'">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="grid-2">
        <label class="fld">
          <span>Invoice Prefix</span>
          <input class="field" type="text" maxlength="10" [(ngModel)]="f.invoice_prefix" />
          <small>Preview: {{ (f.invoice_prefix || 'INV') + '-' + year + '-000123' }}</small>
        </label>
        <label class="fld">
          <span>Show company name as logo header</span>
          <select class="field" [(ngModel)]="f.show_logo">
            <option [ngValue]="true">Yes — prominent branded header</option>
            <option [ngValue]="false">No — plain text header</option>
          </select>
        </label>
      </div>
    </div>

    <!-- Invoice layout -->
    <div class="card">
      <h3 class="setting-title">Invoice Layout</h3>
      <p class="setting-desc">Which sections the invoice PDF includes. Applies to invoices issued from now on — already-issued invoices keep the layout they were issued with.</p>
      <div class="toggle-grid">
        @for (t of layoutToggles; track t.key) {
          <label class="toggle-item">
            <input type="checkbox" [ngModel]="!!f[t.key]" (ngModelChange)="setFlag(t.key, $event)" />
            <span class="toggle-item-text">
              <span class="toggle-item-label">{{ t.label }}</span>
              <span class="toggle-item-desc">{{ t.desc }}</span>
            </span>
          </label>
        }
      </div>
      <div class="grid-2">
        <label class="fld">
          <span>Currency Symbol</span>
          <input class="field" type="text" maxlength="8" placeholder="₹" [(ngModel)]="f.currency_symbol" />
          <small>“₹” prints as “Rs.” in the PDF (print-safe font).</small>
        </label>
        <label class="fld">
          <span>Decimal Precision</span>
          <select class="field" [(ngModel)]="f.decimal_precision">
            <option [ngValue]="0">0 — whole rupees</option>
            <option [ngValue]="2">2 — paise (recommended)</option>
          </select>
        </label>
        <label class="fld"><span>Website (letterhead)</span><input class="field" type="text" maxlength="200" placeholder="www.example.in" [(ngModel)]="f.company_website" /></label>
        <label class="fld"><span>CIN (letterhead, optional)</span><input class="field" type="text" maxlength="30" [(ngModel)]="f.company_cin" /></label>
        <label class="fld">
          <span>NABL Registration No. (optional)</span>
          <input class="field" type="text" maxlength="50" placeholder="e.g. MC-1234" [(ngModel)]="f.nabl_registration_number" />
          <small>Only printed when filled in — leave blank unless genuinely NABL-accredited.</small>
        </label>
        <label class="fld">
          <span>ISO Certification (optional)</span>
          <input class="field" type="text" maxlength="50" placeholder="e.g. ISO 9001:2015" [(ngModel)]="f.iso_certification" />
          <small>Only printed when filled in — leave blank unless genuinely certified.</small>
        </label>
      </div>
    </div>

    <!-- Company -->
    <div class="card">
      <h3 class="setting-title">Company Billing Information</h3>
      <p class="setting-desc">Printed on every invoice issued from now on.</p>
      <div class="grid-2">
        <label class="fld"><span>Company Name</span><input class="field" type="text" [(ngModel)]="f.company_name" /></label>
        <label class="fld"><span>Support Phone</span><input class="field" type="text" [(ngModel)]="f.company_phone" /></label>
        <label class="fld"><span>Support Email</span><input class="field" type="email" [(ngModel)]="f.company_email" /></label>
        <label class="fld"><span>Refund time estimate</span><input class="field" type="text" maxlength="100" placeholder="5–7 working days" [(ngModel)]="f.refund_eta_text" /></label>
      </div>
      <label class="fld">
        <span>Company Address</span>
        <textarea class="field textarea" rows="3" [(ngModel)]="f.company_address"></textarea>
      </label>
      <label class="fld">
        <span>Invoice Footer</span>
        <textarea class="field textarea" rows="2" placeholder="e.g. This is a computer-generated invoice. For queries contact support." [(ngModel)]="f.invoice_footer"></textarea>
      </label>
    </div>

    <div class="save-row">
      <button class="btn-primary" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save Settings' }}</button>
    </div>
  } }
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; max-width:760px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; display:flex; align-items:center; gap:.5rem; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .card { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.5rem; display:flex; flex-direction:column; gap:1rem; }
    .setting-row { display:flex; justify-content:space-between; align-items:flex-start; gap:1.5rem; }
    .setting-title { font-size:1rem; font-weight:600; color:#0F172A; margin:0 0 0.25rem 0; }
    .setting-desc { font-size:0.875rem; color:#475569; margin:0; line-height:1.6; }
    .toggle-btn { position:relative; width:52px; height:28px; border-radius:9999px; border:none; cursor:pointer; background:#CBD5E1; transition:background 200ms; flex-shrink:0; &.on { background:#0F766E; } }
    .toggle-knob { position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:9999px; background:#FFFFFF; transition:transform 200ms; box-shadow:0 1px 3px rgba(0,0,0,.15); }
    .toggle-btn.on .toggle-knob { transform:translateX(24px); }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .toggle-grid { display:grid; grid-template-columns:1fr 1fr; gap:.6rem 1.25rem; }
    .toggle-item { display:flex; align-items:flex-start; gap:.6rem; cursor:pointer; }
    .toggle-item input { margin-top:.2rem; accent-color:#0F766E; width:1rem; height:1rem; flex-shrink:0; }
    .toggle-item-text { display:flex; flex-direction:column; gap:.1rem; }
    .toggle-item-label { font-size:.85rem; font-weight:600; color:#0F172A; }
    .toggle-item-desc { font-size:.75rem; font-weight:400; color:#64748B; line-height:1.45; }
    @media (max-width: 640px) { .toggle-grid { grid-template-columns:1fr; } }
    .fld { display:flex; flex-direction:column; gap:.35rem; font-size:.8rem; font-weight:600; color:#334155; }
    .fld small { font-weight:500; color:#94A3B8; }
    .field { border:1px solid #E2E8F0; border-radius:.5rem; padding:.55rem .75rem; font-size:.875rem; color:#0F172A; background:#fff; font-weight:400; }
    .textarea { resize:vertical; font-family:inherit; }
    .save-row { display:flex; justify-content:flex-end; }
    .btn-primary { background:#0F766E; color:#fff; border:none; border-radius:.5rem; padding:.65rem 1.4rem; font-size:.9rem; font-weight:600; cursor:pointer; }
    .btn-primary:disabled { opacity:.5; cursor:default; }
    @media (max-width: 640px) { .grid-2 { grid-template-columns:1fr; } }
  `]
})
export class AdminBillingSettingsComponent implements OnInit {
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');
  form = signal<BillingSettings | null>(null);
  help = BILLING_HELP;
  year = new Date().getFullYear();

  readonly layoutToggles: { key: BooleanSettingKey; label: string; desc: string }[] = [
    { key: 'show_barcode', label: 'Barcode', desc: 'Code 128 barcode of the invoice number, printed in the letterhead.' },
    { key: 'show_doctor', label: 'Referred By (Doctor)', desc: 'Referring doctor line in patient details.' },
    { key: 'show_technician', label: 'Technician Details', desc: 'Home-collection technician block.' },
    { key: 'show_patient_address', label: 'Patient Address', desc: 'Collection address in patient details.' },
    { key: 'show_signature', label: 'Signature Block', desc: '“Authorised Signatory” block at the end.' },
    { key: 'show_report_info', label: 'Report Information', desc: 'Report status / pathologist section.' },
    { key: 'show_qr_code', label: 'QR Code (Scan to View)', desc: 'Scannable QR code in the letterhead that opens this exact invoice — any phone camera works, no app or login needed.' },
  ];

  setFlag(key: BooleanSettingKey, value: boolean) {
    const f = this.form();
    if (f) this.form.set({ ...f, [key]: value });
  }

  constructor(private api: BillingApiService, private confirm: ConfirmDialogService) {}

  ngOnInit() {
    this.loading.set(true);
    this.api.getBillingSettings().subscribe({
      next: s => { this.form.set({ ...s }); this.loading.set(false); },
      error: () => { this.error.set('Failed to load billing settings.'); this.loading.set(false); },
    });
  }

  async save() {
    const f = this.form();
    if (!f) return;
    if (f.gst_enabled && (f.gst_percentage < 0 || f.gst_percentage > 100)) {
      this.error.set('GST percentage must be between 0 and 100.');
      return;
    }
    const ok = await this.confirm.ask({
      title: 'Apply billing settings?',
      message: 'These settings change what every customer is charged and what appears on future invoices, starting immediately. Issued invoices are not affected.',
      changes: [
        `GST: ${f.gst_enabled ? f.gst_percentage + '%' + (f.gstin ? ' · GSTIN ' + f.gstin : '') : 'disabled'}`,
        `Invoices: ${f.invoice_enabled ? 'enabled, prefix ' + f.invoice_prefix : 'disabled'}`,
        `Refund estimate: ${f.refund_eta_text}`,
      ],
      confirmLabel: 'Apply to live',
      tone: 'live',
    });
    if (!ok) return;
    this.saving.set(true);
    this.api.updateBillingSettings(f).subscribe({
      next: s => {
        this.form.set({ ...s }); this.saving.set(false);
        this.success.set('Billing settings saved.');
        setTimeout(() => this.success.set(''), 4000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail?.message ?? 'Failed to save settings.');
      },
    });
  }
}
