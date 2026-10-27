import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OtpOverview,
  ProviderAdminApiService,
} from '../../../core/api/services/provider-admin-api.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { HelpPanelComponent, HelpSection } from '../../../shared/components/help-panel/help-panel.component';

const OTP_HELP: HelpSection[] = [
  {
    title: 'What this page does',
    paragraphs: [
      'Sri Health Plus sends one-time passwords (OTPs) by SMS so patients can log in without a password. This page shows which SMS company (the "provider") is delivering those messages, whether it is working, and how many OTPs are being sent.',
    ],
  },
  {
    title: 'How OTP login works',
    bullets: [
      'The patient enters their phone number and taps "Send OTP".',
      'Our server creates a random 6-digit code, stores it securely (encrypted), and asks the provider to deliver it by SMS.',
      'The code works once, expires after 10 minutes, and allows only a few wrong attempts.',
      'Requesting codes too often is blocked automatically to prevent misuse and wasted SMS credits.',
    ],
  },
  {
    title: 'SMS delivery & credits',
    paragraphs: [
      'Each SMS costs credits purchased from the provider. When the balance runs out, OTPs stop being delivered and patients cannot log in — recharge before it reaches zero.',
    ],
    bullets: [
      '"SMS Balance" shows remaining credits when the provider supports it.',
      '"Delivery Success Rate" is the share of OTP messages the provider accepted.',
      'Anything the provider cannot report is shown as "Not Supported" — that is normal, not an error.',
    ],
  },
  {
    title: 'Switching providers',
    paragraphs: [
      'The active provider can be changed here without a deployment. The new provider must have its API key configured on the server (an environment variable) — a provider without keys shows as "Unconfigured" and cannot send.',
    ],
  },
  {
    title: 'Common issues',
    bullets: [
      'Status "Unconfigured": the provider API key is missing on the server. Ask your technical contact to set it.',
      'OTPs not arriving but status OK: check SMS balance, then the provider dashboard for delivery reports or DND-blocked numbers.',
      'Sudden spike in failures: the provider may be down — check their status page, or switch providers temporarily.',
      '"Too many OTP requests" errors for a patient: rate limiting is protecting the account; it clears within 15 minutes.',
    ],
  },
  {
    title: 'Best practices',
    bullets: [
      'Keep at least a week’s worth of SMS credits.',
      'Check the failure rate after any provider-side change (template, sender ID).',
      'Never share API keys; they live only in server configuration.',
    ],
  },
];

@Component({
  selector: 'app-admin-otp-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent, AlertComponent, BadgeComponent, HelpPanelComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">
        OTP Management
        <app-help-panel heading="OTP & SMS — how it works" [sections]="help" />
      </h1>
      <p class="page-sub">SMS one-time-password provider, delivery health and usage.</p>
    </div>
    <button class="btn-refresh" (click)="load()" [disabled]="loading()">Refresh</button>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }
  @if (success()) { <app-alert type="success" [dismissible]="true" (dismissed)="success.set('')">{{ success() }}</app-alert> }

  @if (loading()) { <div class="load-wrap"><app-spinner size="md" /></div>
  } @else { @if (ov(); as o) {

    <!-- Provider card -->
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">Active Provider</h3>
        <app-badge [color]="statusColor(o.provider_status)">{{ statusLabel(o.provider_status) }}</app-badge>
      </div>
      <div class="provider-row">
        <div class="provider-name">{{ providerLabel(o.active_provider) }}</div>
        <div class="provider-switch">
          <select class="field" [(ngModel)]="selectedProvider">
            @for (p of o.available_providers; track p) {
              <option [value]="p">{{ providerLabel(p) }}</option>
            }
          </select>
          <button class="btn-primary" [disabled]="busy() || selectedProvider === o.active_provider" (click)="switchProvider()">
            Switch
          </button>
        </div>
      </div>
      <p class="health-detail">{{ o.provider_health_detail }}</p>

      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">SMS Balance / Credits</span>
          <span class="stat-value">
            @if (!o.balance_supported) { <em class="ns">Not Supported</em> }
            @else if (o.sms_balance === null) { — }
            @else { {{ o.sms_balance | number:'1.0-0' }} }
          </span>
        </div>
        <div class="stat">
          <span class="stat-label">Delivery Reports</span>
          <span class="stat-value">
            @if (!o.delivery_reports_supported) { <em class="ns">Not Supported</em> } @else { Available }
          </span>
        </div>
        <div class="stat">
          <span class="stat-label">Last OTP Sent</span>
          <span class="stat-value">{{ o.last_otp_sent_at ? (o.last_otp_sent_at | date:'dd MMM, HH:mm') : 'Never' }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Last API Sync</span>
          <span class="stat-value">{{ o.last_synced_at | date:'dd MMM, HH:mm:ss' }}</span>
        </div>
      </div>

      @if (hasLinks(o)) {
        <div class="links-row">
          @if (o.links.dashboard) { <a class="ext-link" [href]="o.links.dashboard" target="_blank" rel="noopener">Provider Dashboard ↗</a> }
          @if (o.links.recharge) { <a class="ext-link" [href]="o.links.recharge" target="_blank" rel="noopener">Recharge SMS Credits ↗</a> }
          @if (o.links.billing) { <a class="ext-link" [href]="o.links.billing" target="_blank" rel="noopener">Billing / Payment History ↗</a> }
        </div>
      }
    </div>

    <!-- Usage card -->
    <div class="card">
      <h3 class="card-title">OTP Usage & Delivery</h3>
      <div class="usage-table">
        <div class="usage-head">
          <span>Period</span><span>Requests</span><span>Delivered to provider</span><span>Failed</span><span>Success rate</span>
        </div>
        @for (row of usageRows(); track row.label) {
          <div class="usage-row">
            <span class="u-label">{{ row.label }}</span>
            <span>{{ row.w.total }}</span>
            <span>{{ row.w.sent }}</span>
            <span [class.err]="row.w.failed > 0">{{ row.w.failed }}</span>
            <span>{{ row.w.success_rate === null ? '—' : row.w.success_rate + '%' }}</span>
          </div>
        }
      </div>
      <p class="fine-print">
        Success rate counts hand-off to the SMS provider. Handset-level delivery reports:
        {{ o.delivery_reports_supported ? 'available on the provider dashboard' : 'Not Supported by this provider' }}.
      </p>
    </div>
  } }
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; max-width:860px; }
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
    .health-detail { font-size:.85rem; color:#64748B; margin:.5rem 0 1rem; }
    .stat-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:1rem; }
    .stat { background:#F8FAFC; border:1px solid #F1F5F9; border-radius:.75rem; padding:.9rem 1rem; display:flex; flex-direction:column; gap:.3rem; }
    .stat-label { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#94A3B8; }
    .stat-value { font-size:1.05rem; font-weight:700; color:#0F172A; }
    .ns { color:#94A3B8; font-style:normal; font-weight:600; font-size:.9rem; }
    .links-row { display:flex; gap:1.25rem; margin-top:1rem; flex-wrap:wrap; }
    .ext-link { font-size:.85rem; font-weight:600; color:#0F766E; text-decoration:none; }
    .ext-link:hover { text-decoration:underline; }
    .usage-table { border:1px solid #F1F5F9; border-radius:.75rem; overflow:hidden; }
    .usage-head, .usage-row { display:grid; grid-template-columns:1.2fr 1fr 1.4fr 1fr 1fr; gap:.5rem; padding:.65rem 1rem; font-size:.85rem; }
    .usage-head { background:#F8FAFC; font-weight:700; color:#64748B; font-size:.75rem; text-transform:uppercase; letter-spacing:.04em; }
    .usage-row { border-top:1px solid #F1F5F9; color:#334155; }
    .u-label { font-weight:600; color:#0F172A; }
    .err { color:#B91C1C; font-weight:700; }
    .fine-print { font-size:.75rem; color:#94A3B8; margin:.75rem 0 0; }
    @media (max-width: 640px) {
      .usage-head, .usage-row { grid-template-columns:1fr 1fr 1fr; }
      .usage-head span:nth-child(3), .usage-row span:nth-child(3) { display:none; }
    }
  `]
})
export class AdminOtpManagementComponent implements OnInit {
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  success = signal('');
  ov = signal<OtpOverview | null>(null);
  selectedProvider = '';
  help = OTP_HELP;

  usageRows = computed(() => {
    const o = this.ov();
    if (!o) return [];
    return [
      { label: 'Today', w: o.usage.today },
      { label: 'Last 7 days', w: o.usage.week },
      { label: 'Last 30 days', w: o.usage.month },
    ];
  });

  constructor(private api: ProviderAdminApiService, private confirm: ConfirmDialogService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.otpOverview().subscribe({
      next: o => { this.ov.set(o); this.selectedProvider = o.active_provider; this.loading.set(false); },
      error: () => { this.error.set('Failed to load OTP provider status.'); this.loading.set(false); },
    });
  }

  hasLinks(o: OtpOverview): boolean {
    return !!(o.links.dashboard || o.links.recharge || o.links.billing);
  }

  providerLabel(p: string): string {
    const m: Record<string, string> = { twofactor: '2Factor', msg91: 'MSG91', mock: 'Mock (dev only)' };
    return m[p] ?? p;
  }

  statusColor(s: string) { return s === 'ok' ? 'success' : s === 'unconfigured' ? 'warning' : 'error'; }
  statusLabel(s: string) { return s === 'ok' ? 'Active' : s === 'unconfigured' ? 'Unconfigured' : 'Error'; }

  async switchProvider() {
    const target = this.selectedProvider;
    const ok = await this.confirm.ask({
      title: `Switch OTP provider to ${this.providerLabel(target)}?`,
      message: 'All future login and verification SMS will be sent through this provider, starting immediately. Its API key must already be configured on the server.',
      confirmLabel: 'Switch provider',
      tone: 'live',
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.setOtpProvider(target).subscribe({
      next: o => {
        this.ov.set(o); this.selectedProvider = o.active_provider; this.busy.set(false);
        this.success.set(`OTP provider switched to ${this.providerLabel(o.active_provider)}.`);
        setTimeout(() => this.success.set(''), 4000);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.detail?.message ?? 'Failed to switch provider.');
      },
    });
  }
}
