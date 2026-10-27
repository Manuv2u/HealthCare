import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PaymentOverview,
  ProviderAdminApiService,
} from '../../../core/api/services/provider-admin-api.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { HelpPanelComponent, HelpSection } from '../../../shared/components/help-panel/help-panel.component';

const PAYMENT_HELP: HelpSection[] = [
  {
    title: 'What this page does',
    paragraphs: [
      'Online payments for bookings are processed by a payment gateway (currently Razorpay). This page shows whether the gateway is healthy, how much money is flowing through it, refunds, settlements and webhook activity.',
    ],
  },
  {
    title: 'How an online payment flows',
    bullets: [
      'The patient confirms a booking and chooses "Pay Online".',
      'Our server creates an "order" with the gateway for the exact amount — the patient pays inside the gateway’s secure window (card/UPI/net-banking). Card details never touch our servers.',
      'The gateway tells us the payment succeeded in two independent ways: the patient’s browser (verified with a cryptographic signature) and a server-to-server "webhook". Either one confirms the booking; the other becomes a no-op.',
      'On success the booking is marked paid and the invoice is generated automatically.',
    ],
  },
  {
    title: 'Webhooks',
    paragraphs: [
      'A webhook is the gateway calling our server directly whenever something happens (payment captured, refund processed). It is the safety net when a patient closes their browser right after paying.',
    ],
    bullets: [
      '"Last Successful Webhook" should be recent whenever payments are happening.',
      'A growing "failed" trail usually means the webhook secret is wrong or the URL is unreachable — check the gateway dashboard’s webhook section.',
    ],
  },
  {
    title: 'Refunds',
    bullets: [
      'When a paid booking is cancelled, the refund (after any cancellation charge) is sent to the gateway automatically.',
      'The money returns to the patient’s original payment method — typically within 5–7 working days depending on their bank.',
      'If the automatic refund fails (e.g. gateway outage), it stays visible on the booking with a "Retry" button here in admin.',
    ],
  },
  {
    title: 'Settlements',
    paragraphs: [
      'The gateway collects patient money first, then transfers ("settles") it to the clinic bank account on a cycle — usually T+2 working days for Razorpay (T+1 available on request). The Settlements section shows recent transfers when the gateway supports it.',
    ],
  },
  {
    title: 'Common issues',
    bullets: [
      'Status "Unconfigured": API keys are missing on the server — payments cannot be taken.',
      'Payments stuck "pending": the patient likely abandoned checkout; they can retry from the booking page.',
      'Paid but booking not confirmed: check the webhook trail below — a signature/secret mismatch blocks confirmations.',
      'Refund initiated but not completed: normal for a few days; the gateway webhook completes it automatically.',
    ],
  },
];

@Component({
  selector: 'app-admin-payment-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent, AlertComponent, BadgeComponent, HelpPanelComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">
        Payment Management
        <app-help-panel heading="Payments, webhooks & refunds — how it works" [sections]="help" />
      </h1>
      <p class="page-sub">Gateway health, transactions, refunds, settlements and webhooks.</p>
    </div>
    <button class="btn-refresh" (click)="load()" [disabled]="loading()">Refresh</button>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }
  @if (success()) { <app-alert type="success" [dismissible]="true" (dismissed)="success.set('')">{{ success() }}</app-alert> }

  @if (loading()) { <div class="load-wrap"><app-spinner size="md" /></div>
  } @else { @if (ov(); as o) {

    <!-- Gateway card -->
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">Active Payment Gateway</h3>
        <div class="head-badges">
          @if (o.gateway_mode === 'test' || o.gateway_mode === 'live') {
            <app-badge [color]="o.gateway_mode === 'live' ? 'success' : 'warning'">
              {{ o.gateway_mode === 'live' ? 'LIVE MODE' : 'TEST MODE' }}
            </app-badge>
          }
          <app-badge [color]="statusColor(o.gateway_status)">{{ statusLabel(o.gateway_status) }}</app-badge>
        </div>
      </div>
      <div class="provider-row">
        <div class="provider-name">{{ gatewayLabel(o.active_gateway) }}</div>
        <div class="provider-switch">
          <select class="field" [(ngModel)]="selectedGateway">
            @for (g of o.available_gateways; track g) {
              <option [value]="g">{{ gatewayLabel(g) }}</option>
            }
          </select>
          <button class="btn-primary" [disabled]="busy() || selectedGateway === o.active_gateway" (click)="switchGateway()">
            Switch
          </button>
        </div>
      </div>
      @if (o.gateway_mode === 'test') {
        <p class="mode-warning">
          Sandbox keys are configured (<code>rzp_test_…</code>) — payments here are simulated and
          <strong>no real money moves</strong>. Switch the server to <code>rzp_live_…</code> keys to go live.
        </p>
      }
      <p class="health-detail">{{ o.gateway_health_detail }} · Settlement cycle: T+2 working days (T+1 on request from the gateway).</p>
      @if (hasLinks(o)) {
        <div class="links-row">
          @if (o.links.dashboard) { <a class="ext-link" [href]="o.links.dashboard" target="_blank" rel="noopener">Gateway Dashboard ↗</a> }
          @if (o.links.settlements) { <a class="ext-link" [href]="o.links.settlements" target="_blank" rel="noopener">Settlement Reports ↗</a> }
          @if (o.links.reports) { <a class="ext-link" [href]="o.links.reports" target="_blank" rel="noopener">Billing Reports ↗</a> }
        </div>
      }
    </div>

    <!-- Analytics -->
    <div class="card">
      <h3 class="card-title">Payment Analytics</h3>
      <div class="usage-table">
        <div class="usage-head">
          <span>Period</span><span>Transactions</span><span>Successful</span><span>Failed</span><span>Pending</span><span>Revenue</span>
        </div>
        @for (row of analyticsRows(); track row.label) {
          <div class="usage-row">
            <span class="u-label">{{ row.label }}</span>
            <span>{{ row.s.transactions }}</span>
            <span class="ok">{{ row.s.successful }}</span>
            <span [class.err]="row.s.failed > 0">{{ row.s.failed }}</span>
            <span>{{ row.s.pending }}</span>
            <span class="u-strong">₹{{ row.s.revenue | number:'1.2-2' }}</span>
          </div>
        }
      </div>
    </div>

    <!-- Refunds + Webhooks -->
    <div class="two-col">
      <div class="card">
        <h3 class="card-title">Refund Statistics</h3>
        <div class="stat-grid">
          @for (r of refundRows(); track r.label) {
            <div class="stat">
              <span class="stat-label">{{ r.label }}</span>
              <span class="stat-value">{{ r.count }} <small>(₹{{ r.amount | number:'1.0-0' }})</small></span>
            </div>
          }
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">Webhook Status</h3>
        <div class="info-rows">
          <div class="info-row">
            <span class="info-label">Last Successful</span>
            <span class="info-val">
              {{ o.webhooks.last_successful_at ? (o.webhooks.last_successful_at | date:'dd MMM, HH:mm:ss') : 'None yet' }}
              @if (o.webhooks.last_successful_event) { <small>({{ o.webhooks.last_successful_event }})</small> }
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Last Failed</span>
            <span class="info-val" [class.err]="!!o.webhooks.last_failed_at">
              {{ o.webhooks.last_failed_at ? (o.webhooks.last_failed_at | date:'dd MMM, HH:mm:ss') : 'None' }}
            </span>
          </div>
          @if (o.webhooks.last_failed_error) {
            <div class="info-row"><span class="info-label">Failure Reason</span><span class="info-val err">{{ o.webhooks.last_failed_error }}</span></div>
          }
        </div>
      </div>
    </div>

    <!-- Settlements -->
    <div class="card">
      <h3 class="card-title">Settlements</h3>
      @if (!o.settlements_supported) {
        <p class="ns">Not Supported by this gateway.</p>
      } @else if (!o.settlements?.length) {
        <p class="ns">No settlements reported yet (or gateway unreachable).</p>
      } @else {
        <div class="usage-table">
          <div class="usage-head"><span>Settlement ID</span><span>Amount</span><span>Status</span></div>
          @for (s of o.settlements!; track s.id) {
            <div class="usage-row settlement-row">
              <span class="mono">{{ s.id }}</span>
              <span class="u-strong">₹{{ s.amount | number:'1.2-2' }}</span>
              <span>{{ s.status }}</span>
            </div>
          }
        </div>
      }
      <p class="fine-print">Last synced {{ o.last_synced_at | date:'dd MMM, HH:mm:ss' }}.</p>
    </div>
  } }
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; max-width:980px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; display:flex; align-items:center; gap:.5rem; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .btn-refresh { border:1px solid #E2E8F0; background:#fff; border-radius:.5rem; padding:.5rem 1rem; font-size:.85rem; font-weight:600; color:#334155; cursor:pointer; }
    .btn-refresh:hover { background:#F8FAFC; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .card { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.5rem; }
    .card-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:.75rem; }
    .card-title { font-size:1rem; font-weight:600; color:#0F172A; margin:0 0 .75rem 0; }
    .card-head .card-title { margin:0; }
    .provider-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; }
    .provider-name { font-size:1.35rem; font-weight:800; color:#0F766E; }
    .provider-switch { display:flex; gap:.5rem; align-items:center; }
    .field { border:1px solid #E2E8F0; border-radius:.5rem; padding:.5rem .75rem; font-size:.875rem; color:#0F172A; background:#fff; }
    .btn-primary { background:#0F766E; color:#fff; border:none; border-radius:.5rem; padding:.55rem 1rem; font-size:.85rem; font-weight:600; cursor:pointer; }
    .btn-primary:disabled { opacity:.5; cursor:default; }
    .health-detail { font-size:.85rem; color:#64748B; margin:.5rem 0 0; }
    .head-badges { display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; }
    .mode-warning {
      font-size:.85rem; color:#78350F; background:#FFFBEB; border:1px solid #FCD34D;
      border-radius:.5rem; padding:.6rem .75rem; margin:.75rem 0 0;
      code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; background:#FEF3C7; padding:.05rem .3rem; border-radius:.25rem; }
    }
    .links-row { display:flex; gap:1.25rem; margin-top:1rem; flex-wrap:wrap; }
    .ext-link { font-size:.85rem; font-weight:600; color:#0F766E; text-decoration:none; }
    .ext-link:hover { text-decoration:underline; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }
    .stat-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:1rem; }
    .stat { background:#F8FAFC; border:1px solid #F1F5F9; border-radius:.75rem; padding:.9rem 1rem; display:flex; flex-direction:column; gap:.3rem; }
    .stat-label { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#94A3B8; }
    .stat-value { font-size:1.05rem; font-weight:700; color:#0F172A; small { color:#64748B; font-weight:600; } }
    .usage-table { border:1px solid #F1F5F9; border-radius:.75rem; overflow:hidden; overflow-x:auto; }
    .usage-head, .usage-row { display:grid; grid-template-columns:1.1fr 1fr 1fr 1fr 1fr 1.1fr; gap:.5rem; padding:.65rem 1rem; font-size:.85rem; min-width:520px; }
    .settlement-row, .usage-head:has(+ .settlement-row) { grid-template-columns:2fr 1fr 1fr; min-width:0; }
    .usage-head { background:#F8FAFC; font-weight:700; color:#64748B; font-size:.75rem; text-transform:uppercase; letter-spacing:.04em; }
    .usage-row { border-top:1px solid #F1F5F9; color:#334155; }
    .u-label { font-weight:600; color:#0F172A; }
    .u-strong { font-weight:700; color:#0F172A; }
    .ok { color:#047857; font-weight:600; }
    .err { color:#B91C1C; font-weight:600; }
    .mono { font-family:ui-monospace, monospace; font-size:.8rem; }
    .info-rows { display:flex; flex-direction:column; gap:.6rem; }
    .info-row { display:flex; justify-content:space-between; gap:1rem; font-size:.875rem; }
    .info-label { color:#64748B; }
    .info-val { color:#0F172A; font-weight:600; text-align:right; small { color:#64748B; font-weight:500; } }
    .ns { color:#94A3B8; font-size:.875rem; font-weight:600; margin:0; }
    .fine-print { font-size:.75rem; color:#94A3B8; margin:.75rem 0 0; }
    @media (max-width: 760px) { .two-col { grid-template-columns:1fr; } }
  `]
})
export class AdminPaymentManagementComponent implements OnInit {
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  success = signal('');
  ov = signal<PaymentOverview | null>(null);
  selectedGateway = '';
  help = PAYMENT_HELP;

  analyticsRows = computed(() => {
    const o = this.ov();
    if (!o) return [];
    return [
      { label: "Today", s: o.analytics.today },
      { label: 'Last 7 days', s: o.analytics.week },
      { label: 'Last 30 days', s: o.analytics.month },
      { label: 'All time', s: o.analytics.all_time },
    ];
  });

  refundRows = computed(() => {
    const o = this.ov();
    if (!o) return [];
    const labels: Record<string, string> = {
      initiated: 'Initiated', approved: 'Processing', completed: 'Completed', failed: 'Failed',
    };
    return Object.entries(labels).map(([key, label]) => {
      const v = o.refunds[key];
      const stat = typeof v === 'object' && v !== null ? v : { count: 0, amount: 0 };
      return { label, count: stat.count ?? 0, amount: stat.amount ?? 0 };
    });
  });

  constructor(private api: ProviderAdminApiService, private confirm: ConfirmDialogService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.paymentOverview().subscribe({
      next: o => { this.ov.set(o); this.selectedGateway = o.active_gateway; this.loading.set(false); },
      error: () => { this.error.set('Failed to load payment gateway status.'); this.loading.set(false); },
    });
  }

  hasLinks(o: PaymentOverview): boolean {
    return !!(o.links.dashboard || o.links.settlements || o.links.reports);
  }

  gatewayLabel(g: string): string {
    const m: Record<string, string> = { razorpay: 'Razorpay', cashfree: 'Cashfree' };
    return m[g] ?? g;
  }

  statusColor(s: string) { return s === 'ok' ? 'success' : s === 'unconfigured' ? 'warning' : 'error'; }
  statusLabel(s: string) { return s === 'ok' ? 'Active' : s === 'unconfigured' ? 'Unconfigured' : 'Error'; }

  async switchGateway() {
    const target = this.selectedGateway;
    const ok = await this.confirm.ask({
      title: `Switch payment gateway to ${this.gatewayLabel(target)}?`,
      message: 'All future online payments will be processed by this gateway, starting immediately. Its API keys must already be configured on the server. In-flight payments on the old gateway still complete normally.',
      confirmLabel: 'Switch gateway',
      tone: 'live',
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.setPaymentGateway(target).subscribe({
      next: o => {
        this.ov.set(o); this.selectedGateway = o.active_gateway; this.busy.set(false);
        this.success.set(`Payment gateway switched to ${this.gatewayLabel(o.active_gateway)}.`);
        setTimeout(() => this.success.set(''), 4000);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.detail?.message ?? 'Failed to switch gateway.');
      },
    });
  }
}
