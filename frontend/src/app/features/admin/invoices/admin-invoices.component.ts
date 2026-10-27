import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BillingApiService } from '../../../core/api/services/billing-api.service';
import { InvoiceRecord } from '../../../core/api/api.types';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent, AlertComponent, BadgeComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Invoices</h1>
      <p class="page-sub">Every issued invoice — search by invoice number, payment ID, booking ID or date.</p>
    </div>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }

  <div class="filter-bar">
    <input class="field grow" type="text" placeholder="Invoice number, payment ID or booking ID…"
           [(ngModel)]="query" (keyup.enter)="search(1)" />
    <input class="field" type="date" [(ngModel)]="dateFrom" title="From date" />
    <input class="field" type="date" [(ngModel)]="dateTo" title="To date" />
    <button class="btn-primary" (click)="search(1)">Search</button>
    <button class="btn-ghost" (click)="clear()">Clear</button>
  </div>

  @if (loading()) { <div class="load-wrap"><app-spinner size="md" /></div>
  } @else if (!items().length) {
    <div class="empty">No invoices found. Invoices are created automatically when a payment succeeds.</div>
  } @else {
    <div class="table-wrap">
      <div class="inv-head">
        <span>Invoice #</span><span>Date</span><span>Patient</span><span>Booking Ref</span><span>Method</span><span class="right">Total</span><span></span>
      </div>
      @for (inv of items(); track inv.id) {
        <div class="inv-row">
          <span class="mono strong">{{ inv.invoice_number }}</span>
          <span>{{ inv.issued_at | date:'dd MMM yyyy' }}</span>
          <span>{{ inv.customer?.patient_name || inv.customer?.name || '—' }}</span>
          <span class="mono">{{ inv.customer?.booking_reference || '—' }}</span>
          <span><app-badge size="sm" [color]="inv.payment_method === 'cash' ? 'warning' : 'info'">{{ inv.payment_method | uppercase }}</app-badge></span>
          <span class="right strong">₹{{ inv.total | number:'1.2-2' }}</span>
          <span class="actions">
            <button class="btn-link" (click)="view(inv)">View</button>
            <button class="btn-link" (click)="download(inv)">PDF</button>
          </span>
        </div>
      }
    </div>

    <div class="pager">
      <button class="btn-ghost" [disabled]="page() <= 1" (click)="search(page() - 1)">‹ Prev</button>
      <span class="pager-info">Page {{ page() }} of {{ totalPages() }} · {{ total() }} invoices</span>
      <button class="btn-ghost" [disabled]="page() >= totalPages()" (click)="search(page() + 1)">Next ›</button>
    </div>
  }

  @if (preview(); as p) {
    <div class="overlay" (click)="closePreview()">
      <div class="preview-panel" (click)="$event.stopPropagation()">
        <div class="preview-head">
          <div class="preview-title">
            <span class="mono strong">{{ p.invoice.invoice_number }}</span>
            <span class="preview-sub">{{ p.invoice.customer?.patient_name || p.invoice.customer?.name || '' }} · ₹{{ p.invoice.total | number:'1.2-2' }}</span>
          </div>
          <div class="preview-actions">
            <button class="btn-ghost sm" (click)="download(p.invoice)">Download</button>
            <button class="btn-ghost sm" (click)="printPreview()">Print</button>
            <button class="btn-ghost sm" [disabled]="busy()" (click)="toggleEmail()">Email</button>
            <button class="btn-ghost sm" [disabled]="!waLink()" (click)="openWhatsApp()">WhatsApp</button>
            <button class="btn-ghost sm" [disabled]="busy()" (click)="regenerate(p.invoice)">{{ busy() === 'regen' ? 'Regenerating…' : 'Regenerate' }}</button>
            <button class="btn-ghost sm" (click)="closePreview()">✕ Close</button>
          </div>
        </div>
        @if (emailOpen()) {
          <div class="email-bar">
            <input class="field grow" type="email" placeholder="Recipient email" [(ngModel)]="emailTo" />
            <button class="btn-primary sm" [disabled]="busy()" (click)="sendEmail(p.invoice)">{{ busy() === 'email' ? 'Sending…' : 'Send Invoice' }}</button>
          </div>
        }
        @if (notice()) { <div class="notice">{{ notice() }}</div> }
        <iframe class="preview-frame" [src]="p.url" title="Invoice preview"></iframe>
      </div>
    </div>
  }
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .filter-bar { display:flex; gap:.6rem; flex-wrap:wrap; }
    .field { border:1px solid #E2E8F0; border-radius:.5rem; padding:.55rem .75rem; font-size:.875rem; color:#0F172A; background:#fff; }
    .grow { flex:1; min-width:220px; }
    .btn-primary { background:#0F766E; color:#fff; border:none; border-radius:.5rem; padding:.55rem 1.1rem; font-size:.85rem; font-weight:600; cursor:pointer; }
    .btn-ghost { background:none; border:1px solid #E2E8F0; border-radius:.5rem; padding:.55rem 1rem; font-size:.85rem; font-weight:600; color:#334155; cursor:pointer; }
    .btn-ghost:disabled { opacity:.4; cursor:default; }
    .btn-link { background:none; border:none; font-size:.82rem; font-weight:600; color:#0F766E; cursor:pointer; padding:0; }
    .btn-link:hover { text-decoration:underline; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .empty { background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:.75rem; padding:2rem; text-align:center; color:#64748B; font-size:.9rem; }
    .table-wrap { border:1px solid #F1F5F9; border-radius:.75rem; overflow-x:auto; background:#fff; }
    .inv-head, .inv-row { display:grid; grid-template-columns:1.3fr 1fr 1.2fr 1.1fr .8fr .9fr .8fr; gap:.5rem; padding:.7rem 1rem; font-size:.85rem; min-width:820px; align-items:center; }
    .inv-head { background:#F8FAFC; font-weight:700; color:#64748B; font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; }
    .inv-row { border-top:1px solid #F1F5F9; color:#334155; }
    .mono { font-family:ui-monospace, monospace; font-size:.8rem; }
    .strong { font-weight:700; color:#0F172A; }
    .right { text-align:right; }
    .actions { display:flex; gap:.75rem; justify-content:flex-end; }
    .pager { display:flex; align-items:center; justify-content:center; gap:1rem; }
    .pager-info { font-size:.82rem; color:#64748B; }
    .overlay { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:60; padding:1.5rem; }
    .preview-panel { background:#fff; border-radius:.75rem; width:min(960px, 100%); height:min(92vh, 100%); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,.25); }
    .preview-head { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:.7rem 1rem; border-bottom:1px solid #E2E8F0; flex-wrap:wrap; }
    .preview-title { display:flex; flex-direction:column; }
    .preview-sub { font-size:.78rem; color:#64748B; }
    .preview-actions { display:flex; gap:.4rem; flex-wrap:wrap; }
    .btn-ghost.sm, .btn-primary.sm { padding:.4rem .7rem; font-size:.78rem; }
    .email-bar { display:flex; gap:.5rem; padding:.6rem 1rem; border-bottom:1px solid #E2E8F0; background:#F8FAFC; }
    .notice { padding:.5rem 1rem; font-size:.8rem; color:#0F766E; background:#F0FDFA; border-bottom:1px solid #CCFBF1; }
    .preview-frame { flex:1; border:none; width:100%; }
  `]
})
export class AdminInvoicesComponent implements OnInit, OnDestroy {
  loading = signal(false);
  error = signal('');
  items = signal<InvoiceRecord[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = 20;

  query = '';
  dateFrom = '';
  dateTo = '';

  preview = signal<{ invoice: InvoiceRecord; url: SafeResourceUrl } | null>(null);
  busy = signal<'' | 'email' | 'regen'>('');
  notice = signal('');
  emailOpen = signal(false);
  emailTo = '';
  private previewBlobUrl = '';

  constructor(private api: BillingApiService, private sanitizer: DomSanitizer) {}

  ngOnInit() { this.search(1); }

  ngOnDestroy() { this.revokePreviewUrl(); }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  search(page: number) {
    this.loading.set(true);
    this.api.searchInvoices({
      q: this.query || undefined,
      date_from: this.dateFrom || undefined,
      date_to: this.dateTo || undefined,
      page,
      page_size: this.pageSize,
    }).subscribe({
      next: r => {
        this.items.set(r.items); this.total.set(r.total); this.page.set(r.page);
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load invoices.'); this.loading.set(false); },
    });
  }

  clear() {
    this.query = ''; this.dateFrom = ''; this.dateTo = '';
    this.search(1);
  }

  view(inv: InvoiceRecord) {
    this.api.invoicePdf(inv.id).subscribe({
      next: blob => this.showPreview(inv, blob),
      error: () => this.error.set('Failed to open invoice PDF.'),
    });
  }

  download(inv: InvoiceRecord) {
    this.api.invoicePdf(inv.id, true).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${inv.invoice_number}.pdf`; a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Failed to download invoice PDF.'),
    });
  }

  // ── preview overlay ─────────────────────────────────────────────────────────

  private showPreview(inv: InvoiceRecord, blob: Blob) {
    this.revokePreviewUrl();
    this.previewBlobUrl = URL.createObjectURL(blob);
    this.preview.set({
      invoice: inv,
      url: this.sanitizer.bypassSecurityTrustResourceUrl(this.previewBlobUrl),
    });
    this.notice.set('');
    this.emailOpen.set(false);
    this.emailTo = inv.customer?.email || '';
  }

  closePreview() {
    this.revokePreviewUrl();
    this.preview.set(null);
    this.notice.set('');
    this.emailOpen.set(false);
  }

  private revokePreviewUrl() {
    if (this.previewBlobUrl) { URL.revokeObjectURL(this.previewBlobUrl); this.previewBlobUrl = ''; }
  }

  printPreview() {
    // The blob URL is same-origin, so the embedded PDF viewer can be printed.
    const frame = document.querySelector<HTMLIFrameElement>('.preview-frame');
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } else if (this.previewBlobUrl) {
      window.open(this.previewBlobUrl, '_blank');
    }
  }

  toggleEmail() { this.emailOpen.update(v => !v); }

  sendEmail(inv: InvoiceRecord) {
    this.busy.set('email');
    this.api.emailInvoice(inv.id, this.emailTo || undefined).subscribe({
      next: r => {
        this.busy.set('');
        this.emailOpen.set(false);
        this.notice.set(`Invoice emailed to ${r.email}.`);
      },
      error: err => {
        this.busy.set('');
        const msg = err?.error?.detail?.message || 'Failed to send invoice email.';
        this.notice.set(msg);
      },
    });
  }

  /** wa.me share link with the invoice summary and a direct PDF link.
   *  WhatsApp cannot receive file attachments via link, so the message
   *  points at the public, unauthenticated PDF route (same one printed as
   *  a QR code on the invoice) — the patient can open it on any phone
   *  without logging in. */
  waLink(): string | null {
    const p = this.preview();
    if (!p) return null;
    const phone = (p.invoice.customer?.phone || '').replace(/\D/g, '');
    if (!phone) return null;
    const to = phone.length === 10 ? `91${phone}` : phone;
    const pdfUrl = `${environment.siteUrl}${environment.apiUrl}/invoices/public/${p.invoice.id}/pdf`;
    const text = encodeURIComponent(
      `Dear ${p.invoice.customer?.patient_name || p.invoice.customer?.name || 'Patient'},\n\n` +
      `This is Sri Health Care. Your invoice ${p.invoice.invoice_number} for booking ` +
      `${p.invoice.customer?.booking_reference || ''} (₹${p.invoice.total.toFixed(2)}) is ready.\n\n` +
      `Download it here: ${pdfUrl}`,
    );
    return `https://wa.me/${to}?text=${text}`;
  }

  openWhatsApp() {
    const link = this.waLink();
    if (link) window.open(link, '_blank');
  }

  regenerate(inv: InvoiceRecord) {
    this.busy.set('regen');
    this.api.regenerateInvoicePdf(inv.id).subscribe({
      next: blob => {
        this.busy.set('');
        this.showPreview(inv, blob);
        this.notice.set('PDF regenerated from the invoice snapshot.');
      },
      error: () => {
        this.busy.set('');
        this.notice.set('Failed to regenerate the PDF.');
      },
    });
  }
}
