import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ContactSettingsApiService } from '../../../core/api/services/contact-settings-api.service';
import { InputComponent } from '../../../shared/components/input/input.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'app-admin-contact-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent, AlertComponent, ButtonComponent, InputComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Contact Settings</h1>
      <p class="page-sub">Configure the support numbers, working hours and booking channels shown across the site — the home page, every test detail page, and the booking flow's Home Collection fallback.</p>
    </div>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }
  @if (success()) { <app-alert type="success" [dismissible]="true" (dismissed)="success.set('')">{{ success() }}</app-alert> }

  @if (loading()) { <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {

    <div class="setting-card">
      <h3 class="card-section-title">Booking Channels</h3>

      <div class="setting-row">
        <div class="setting-text">
          <h3 class="setting-title">Enable "Book via Call"</h3>
          <p class="setting-desc">When disabled, the "Call Now" button is hidden everywhere, including the booking flow's Home Collection fallback.</p>
        </div>
        <button class="toggle-btn" [class.on]="callEnabled" (click)="callEnabled = !callEnabled" [attr.aria-label]="callEnabled ? 'Disable call booking' : 'Enable call booking'">
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="setting-row">
        <div class="setting-text">
          <h3 class="setting-title">Enable "WhatsApp"</h3>
          <p class="setting-desc">When disabled, the WhatsApp button is hidden everywhere.</p>
        </div>
        <button class="toggle-btn" [class.on]="whatsappEnabled" (click)="whatsappEnabled = !whatsappEnabled" [attr.aria-label]="whatsappEnabled ? 'Disable WhatsApp booking' : 'Enable WhatsApp booking'">
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="setting-row">
        <div class="setting-text">
          <h3 class="setting-title">Enable "Get a Callback"</h3>
          <p class="setting-desc">When disabled, the callback card is hidden — only "Book via Call" and "WhatsApp" are shown.</p>
        </div>
        <button class="toggle-btn" [class.on]="callbackEnabled" (click)="callbackEnabled = !callbackEnabled" [attr.aria-label]="callbackEnabled ? 'Disable callback card' : 'Enable callback card'">
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>

    <div class="setting-card">
      <h3 class="card-section-title">Numbers &amp; Availability</h3>
      <div class="form-grid">
        <app-input
          label="Phone Number"
          icon="call"
          type="tel"
          placeholder="+91 77951 49207"
          hint="Shown on &quot;Book via Call&quot; and used for the tel: link."
          [(ngModel)]="phoneNumber"
        />
        <app-input
          label="WhatsApp Number"
          icon="chat"
          type="tel"
          placeholder="917795149207"
          hint="Digits only with country code (used for wa.me links)."
          [(ngModel)]="whatsappNumber"
        />
        <app-input
          label="Working Hours"
          icon="schedule"
          placeholder="Mon–Sat, 7:00 AM – 9:00 PM"
          hint="Shown next to the support number so users know when to call. Leave blank to hide."
          [(ngModel)]="workingHours"
        />
      </div>

      <div class="save-row">
        <app-button variant="primary" [loading]="saving()" (click)="save()">Save Settings</app-button>
      </div>
    </div>
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
    .setting-row + .setting-row { margin-top:1.25rem; padding-top:1.25rem; border-top:1px solid #F1F5F9; }
    .setting-title { font-size:1rem; font-weight:600; color:#0F172A; margin:0 0 0.25rem 0; }
    .setting-desc { font-size:0.875rem; color:#475569; margin:0; line-height:1.625; }
    .card-section-title { font-size:1rem; font-weight:600; color:#0F172A; margin:0 0 1.25rem 0; }
    .toggle-btn { position:relative; width:52px; height:28px; border-radius:9999px; border:none; cursor:pointer; background:#CBD5E1; transition:background 200ms; flex-shrink:0; &.on { background:#38A169; } }
    .toggle-knob { position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:9999px; background:#FFFFFF; transition:transform 200ms; box-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1); }
    .toggle-btn.on .toggle-knob { transform:translateX(24px); }
    .form-grid { display:flex; flex-direction:column; gap:1.25rem; margin-bottom:1.25rem; }
    .form-grid app-input { display:block; max-width:420px; }
    .save-row { display:flex; justify-content:flex-end; }
  `]
})
export class AdminContactSettingsComponent implements OnInit {
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');
  callbackEnabled = true;
  callEnabled = true;
  whatsappEnabled = true;
  phoneNumber = '';
  whatsappNumber = '';
  workingHours = '';

  constructor(private contactSettingsApi: ContactSettingsApiService, private confirm: ConfirmDialogService) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.contactSettingsApi.get().subscribe({
      next: (cfg) => {
        this.phoneNumber = cfg.phone_number;
        this.whatsappNumber = cfg.whatsapp_number;
        this.callbackEnabled = cfg.callback_enabled;
        this.callEnabled = cfg.call_enabled;
        this.whatsappEnabled = cfg.whatsapp_enabled;
        this.workingHours = cfg.working_hours ?? '';
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load configuration.'); this.loading.set(false); }
    });
  }

  async save() {
    if (!this.phoneNumber.trim() || !this.whatsappNumber.trim()) {
      this.error.set('Both phone number and WhatsApp number are required.');
      return;
    }
    const ok = await this.confirm.askLiveChange(
      'The contact number, WhatsApp and callback options shown across the site',
      [
        `Phone: ${this.phoneNumber.trim()}`,
        `WhatsApp: ${this.whatsappNumber.trim()}`,
        `Call button: ${this.callEnabled ? 'on' : 'off'}`,
        `WhatsApp button: ${this.whatsappEnabled ? 'on' : 'off'}`,
        `Callback requests: ${this.callbackEnabled ? 'on' : 'off'}`,
      ],
    );
    if (!ok) return;
    this.saving.set(true);
    this.contactSettingsApi.update({
      phone_number: this.phoneNumber.trim(),
      whatsapp_number: this.whatsappNumber.trim(),
      callback_enabled: this.callbackEnabled,
      call_enabled: this.callEnabled,
      whatsapp_enabled: this.whatsappEnabled,
      working_hours: this.workingHours.trim() || null,
    }).subscribe({
      next: () => { this.saving.set(false); this.success.set('Settings saved successfully.'); setTimeout(() => this.success.set(''), 3000); },
      error: err => { this.error.set(err.error?.message || 'Failed to save.'); this.saving.set(false); }
    });
  }
}
