import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../../core/api/services/admin-api.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { FeatureFlag } from '../../../core/api/api.types';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';

@Component({
  selector: 'app-admin-feature-flags',
  standalone: true,
  imports: [CommonModule, SpinnerComponent, AlertComponent, BadgeComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div><h1 class="page-title">Feature Flags</h1><p class="page-sub">Enable or disable application features in real-time</p></div>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }
  @if (success()) { <app-alert type="success" [dismissible]="true" (dismissed)="success.set('')">{{ success() }}</app-alert> }

  @if (loading()) { <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    <div class="flags-list">
      @if (flags().length === 0) { <div class="empty-card">No feature flags configured.</div> }
      @for (f of flags(); track f.id) {
        <div class="flag-card" [class.enabled]="f.is_enabled">
          <div class="flag-icon" [class.on]="f.is_enabled">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          </div>
          <div class="flag-info">
            <div class="flag-row">
              <h3 class="flag-key">{{ f.key }}</h3>
              <app-badge [color]="f.is_enabled ? 'success' : 'default'">{{ f.is_enabled ? 'Enabled' : 'Disabled' }}</app-badge>
            </div>
            @if (f.description) { <p class="flag-desc">{{ f.description }}</p> }
            <p class="flag-updated">Last updated: {{ f.updated_at | date:'dd MMM yyyy, h:mm a' }}</p>
          </div>
          <div class="flag-toggle">
            <button class="toggle-btn" [class.on]="f.is_enabled" (click)="toggle(f)" [disabled]="toggling() === f.id" [attr.aria-label]="f.is_enabled ? 'Disable ' + f.key : 'Enable ' + f.key">
              <span class="toggle-knob"></span>
            </button>
          </div>
        </div>
      }
    </div>
  }
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .flags-list { display:flex; flex-direction:column; gap:0.75rem; }
    .empty-card { text-align:center; padding:3rem; color:#94A3B8; font-size:0.875rem; background:#FFFFFF; border:2px dashed #E2E8F0; border-radius:1rem; }
    .flag-card { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.25rem 1.5rem; display:flex; align-items:center; gap:1.25rem; transition:all 150ms; &.enabled { border-color:#9AE6B4; background:#F0FFF4; } &:hover { box-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1); } }
    .flag-icon { width:44px; height:44px; border-radius:0.75rem; background:#F8FAFC; color:#94A3B8; display:flex; align-items:center; justify-content:center; flex-shrink:0; svg { width:22px; height:22px; } &.on { background:#C6F6D5; color:#2F855A; } }
    .flag-info { flex:1; min-width:0; }
    .flag-row { display:flex; align-items:center; gap:0.75rem; margin-bottom:0.25rem; }
    .flag-key { font-size:1rem; font-weight:600; color:#0F172A; margin:0; font-family:'JetBrains Mono','SF Mono','Fira Code',monospace; }
    .flag-desc { font-size:0.875rem; color:#475569; margin:0 0 0.25rem 0; }
    .flag-updated { font-size:0.75rem; color:#94A3B8; margin:0; }
    .toggle-btn {
      position:relative; width:52px; height:28px; border-radius:9999px; border:none; cursor:pointer; transition:background 200ms;
      background:#CBD5E1;
      &.on { background:#38A169; }
      &:disabled { opacity:.6; cursor:not-allowed; }
    }
    .toggle-knob { position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:9999px; background:#FFFFFF; transition:transform 200ms; box-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1); }
    .toggle-btn.on .toggle-knob { transform:translateX(24px); }
    @media(max-width:640px) { .flag-card { flex-wrap:wrap; } }
  `]
})
export class AdminFeatureFlagsComponent implements OnInit {
  loading = signal(false); toggling = signal<string|null>(null);
  error = signal(''); success = signal('');
  flags = signal<FeatureFlag[]>([]);

  constructor(private adminApi: AdminApiService, private confirm: ConfirmDialogService) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.adminApi.getFeatureFlags().subscribe({
      next: f => { this.flags.set(f); this.loading.set(false); },
      error: () => { this.error.set('Failed to load feature flags.'); this.loading.set(false); }
    });
  }

  async toggle(f: FeatureFlag) {
    const ok = await this.confirm.ask({
      title: f.is_enabled ? `Turn off "${f.key}"?` : `Turn on "${f.key}"?`,
      message: 'Feature flags change how the live site and app behave for everyone, immediately.',
      changes: [`${f.key} → ${f.is_enabled ? 'disabled' : 'enabled'}`],
      confirmLabel: f.is_enabled ? 'Turn off' : 'Turn on',
      tone: 'live',
    });
    if (!ok) return;
    this.toggling.set(f.id);
    this.adminApi.updateFeatureFlag(f.id, { is_enabled: !f.is_enabled }).subscribe({
      next: updated => {
        this.flags.update(list => list.map(fl => fl.id === updated.id ? updated : fl));
        this.success.set(`${f.key} ${updated.is_enabled ? 'enabled' : 'disabled'} successfully`);
        this.toggling.set(null);
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => { this.error.set('Failed to update flag.'); this.toggling.set(null); }
    });
  }
}
