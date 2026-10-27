import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ContactSettingsApiService } from '../../../core/api/services/contact-settings-api.service';
import { ContactSettings } from '../../../core/api/api.types';
import { CallbackRequestModalComponent } from '../callback-request-modal/callback-request-modal.component';

/**
 * "Book via Call / Get a Callback / WhatsApp" cards, driven by the site-wide
 * ContactSettings admin setting — drop this in anywhere (home page, test
 * detail sidebar) with zero wiring and it stays in sync with the admin panel.
 */
@Component({
  selector: 'app-action-cards',
  standalone: true,
  imports: [CommonModule, MatIconModule, CallbackRequestModalComponent],
  template: `
    <div class="ac-grid" [class.ac-stack]="layout === 'stack'">
      @if (contact()?.call_enabled) {
        <a class="ac-card ac-call" [href]="callHref()" aria-label="Book via phone call">
          <span class="ac-badge ac-badge-call">
            <mat-icon>call</mat-icon>
          </span>
          <span class="ac-title">Book via Call</span>
          <span class="ac-desc">Speak to an advisor now</span>
          <span class="ac-cta">{{ contact()?.phone_number }} <mat-icon>arrow_forward</mat-icon></span>
        </a>
      }

      @if (contact()?.callback_enabled) {
        <button type="button" class="ac-card ac-callback" (click)="openCallback()" aria-label="Request a callback">
          <span class="ac-badge ac-badge-callback">
            <mat-icon>support_agent</mat-icon>
          </span>
          <span class="ac-title">Get a Callback</span>
          <span class="ac-desc">We'll call you at your preferred time</span>
          <span class="ac-cta">Get a callback <mat-icon>arrow_forward</mat-icon></span>
        </button>
      }

      @if (contact()?.whatsapp_enabled) {
        <a class="ac-card ac-whatsapp" [href]="whatsappHref()" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">
          <span class="ac-badge ac-badge-whatsapp">
            <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/></svg>
          </span>
          <span class="ac-title">WhatsApp</span>
          <span class="ac-desc">Chat with us instantly</span>
          <span class="ac-cta">Start chat <mat-icon>arrow_forward</mat-icon></span>
        </a>
      }
    </div>

    <app-callback-request-modal [open]="callbackOpen()" (closed)="closeCallback()" />
  `,
  styles: [`
    .ac-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
    }
    .ac-grid.ac-stack {
      grid-template-columns: 1fr;
      gap: .85rem;
    }

    .ac-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: .5rem;
      padding: 2rem 1.5rem 1.6rem;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #E2E8F0);
      border-radius: var(--r-xl, 1rem);
      text-decoration: none;
      cursor: pointer;
      font: inherit;
      color: var(--text, #0F172A);
      transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
      box-shadow: 0 1px 2px rgba(15,23,42,.04);
    }
    .ac-stack .ac-card {
      flex-direction: row;
      text-align: left;
      align-items: center;
      padding: 1.1rem 1.2rem;
      gap: 1rem;
    }
    .ac-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 32px -12px rgba(0, 37, 119,.22);
      border-color: transparent;
    }
    .ac-stack .ac-card:hover { transform: translateY(-2px); }
    .ac-card:focus-visible { outline: 2px solid var(--indigo, #0047CC); outline-offset: 3px; }

    .ac-badge {
      width: 68px; height: 68px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: .35rem;
      color: #fff;
      flex-shrink: 0;
      box-shadow: 0 8px 20px -6px rgba(15,23,42,.35);
    }
    .ac-stack .ac-badge { width: 52px; height: 52px; margin-bottom: 0; }
    .ac-badge mat-icon { font-size: 30px; width: 30px; height: 30px; }
    .ac-stack .ac-badge mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .ac-badge-call     { background: linear-gradient(135deg, var(--indigo, #0047CC) 0%, var(--indigo-dark, #003399) 100%); box-shadow: 0 8px 20px -6px rgba(0, 71, 204,.55); }
    .ac-badge-callback { background: linear-gradient(135deg, var(--orange, #003399) 0%, var(--orange-dark, #001B57) 100%); box-shadow: 0 8px 20px -6px rgba(0, 71, 204,.5); }
    .ac-badge-whatsapp { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); box-shadow: 0 8px 20px -6px rgba(37,211,102,.5); }

    .ac-title { font-size: 1.15rem; font-weight: 700; color: var(--text, #0F172A); }
    .ac-stack .ac-title { font-size: .95rem; }
    .ac-desc  { font-size: .9rem; color: var(--text-2, #64748B); }
    .ac-stack .ac-desc { font-size: .8rem; }
    .ac-cta {
      margin-top: .55rem;
      display: inline-flex; align-items: center; gap: .3rem;
      font-size: .9rem; font-weight: 600; color: var(--indigo, #0047CC);
    }
    .ac-stack .ac-cta { display: none; }
    .ac-cta mat-icon { font-size: 1.05rem; width: 1.05rem; height: 1.05rem; transition: transform .2s; }
    .ac-card:hover .ac-cta mat-icon { transform: translateX(3px); }
    .ac-callback .ac-cta { color: var(--orange-dark, #001B57); }
    .ac-whatsapp .ac-cta { color: #128C7E; }

    @media (max-width: 768px) {
      .ac-grid:not(.ac-stack) { grid-template-columns: 1fr; gap: 1rem; }
      .ac-grid:not(.ac-stack) .ac-card { flex-direction: row; text-align: left; align-items: center; padding: 1.1rem 1.2rem; gap: 1rem; }
      .ac-grid:not(.ac-stack) .ac-badge { width: 56px; height: 56px; margin-bottom: 0; }
      .ac-grid:not(.ac-stack) .ac-badge mat-icon { font-size: 26px; width: 26px; height: 26px; }
      .ac-grid:not(.ac-stack) .ac-title { font-size: 1.05rem; }
      .ac-grid:not(.ac-stack) .ac-card .ac-cta { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ac-card { transition: none; }
    }
  `],
})
export class ActionCardsComponent implements OnInit {
  @Input() layout: 'grid' | 'stack' = 'grid';

  contact = signal<ContactSettings | null>(null);
  callbackOpen = signal(false);
  readonly whatsappMessage = "Hello, I'd like to book a diagnostic test.";

  constructor(private contactSettingsApi: ContactSettingsApiService) {}

  ngOnInit(): void {
    this.contactSettingsApi.get().subscribe({
      next: (c) => this.contact.set(c),
    });
  }

  private static readonly FALLBACK_PHONE = '+917795149207';

  callHref(): string {
    const phone = (this.contact()?.phone_number || ActionCardsComponent.FALLBACK_PHONE)
      .replace(/[^+\d]/g, '');
    return `tel:${phone}`;
  }

  whatsappHref(): string {
    // wa.me wants digits only (country code included, no "+", no spaces)
    let number = (this.contact()?.whatsapp_number || this.contact()?.phone_number || ActionCardsComponent.FALLBACK_PHONE)
      .replace(/\D/g, '');
    if (number.length === 10) number = `91${number}`;
    return `https://wa.me/${number}?text=${encodeURIComponent(this.whatsappMessage)}`;
  }

  openCallback(): void { this.callbackOpen.set(true); }
  closeCallback(): void { this.callbackOpen.set(false); }
}
