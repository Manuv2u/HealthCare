import { Component, HostListener, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmDialogService } from './confirm-dialog.service';

/**
 * Renders whatever ConfirmDialogService currently has pending. Mount once, near
 * the root of a shell — never per page.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (svc.pending(); as c) {
      <div class="cd-backdrop" (click)="svc.resolve(false)"></div>
      <div
        class="cd-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby="cd-msg"
      >
        <div class="cd-icon" [class]="'cd-icon--' + (c.tone ?? 'neutral')">
          <mat-icon>{{ c.tone === 'danger' ? 'delete_forever' : 'warning' }}</mat-icon>
        </div>

        <h2 id="cd-title" class="cd-title">{{ c.title }}</h2>
        <p id="cd-msg" class="cd-msg">{{ c.message }}</p>

        @if (c.changes?.length) {
          <div class="cd-changes">
            <span class="cd-changes-label">Changing:</span>
            <ul>
              @for (change of c.changes; track change) {
                <li>{{ change }}</li>
              }
            </ul>
          </div>
        }

        <div class="cd-actions">
          <button type="button" class="cd-btn cd-btn--cancel" (click)="svc.resolve(false)">
            {{ c.cancelLabel ?? 'Cancel' }}
          </button>
          <button
            type="button"
            class="cd-btn"
            [class.cd-btn--danger]="c.tone === 'danger'"
            [class.cd-btn--live]="c.tone !== 'danger'"
            (click)="svc.resolve(true)"
          >
            {{ c.confirmLabel ?? 'Confirm' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .cd-backdrop {
      position: fixed; inset: 0; z-index: 2000;
      background: rgba(15, 23, 42, .55);
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
      animation: cd-fade .15s ease;
    }
    @keyframes cd-fade { from { opacity: 0; } to { opacity: 1; } }

    .cd-dialog {
      position: fixed; z-index: 2001;
      top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: min(440px, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem); overflow-y: auto;
      background: #fff; border-radius: 16px;
      padding: 1.75rem 1.5rem 1.35rem;
      text-align: center;
      box-shadow: 0 30px 60px -12px rgba(15, 23, 42, .4);
      animation: cd-pop .18s cubic-bezier(0, 0, .2, 1);
    }
    @keyframes cd-pop {
      from { opacity: 0; transform: translate(-50%, -46%) scale(.97); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .cd-icon {
      width: 56px; height: 56px; margin: 0 auto .9rem;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .cd-icon mat-icon { font-size: 30px; width: 30px; height: 30px; }
    .cd-icon--live    { background: #FFF7ED; color: #F59E0B; }
    .cd-icon--danger  { background: #FEF2F2; color: #EF4444; }
    .cd-icon--neutral { background: #EEF4FF; color: #0047CC; }

    .cd-title { margin: 0 0 .4rem; font-size: 1.15rem; font-weight: 700; color: #0F172A; }
    .cd-msg   { margin: 0; font-size: .9rem; line-height: 1.55; color: #475569; }

    .cd-changes {
      margin: 1rem 0 0; padding: .75rem .9rem;
      background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px;
      text-align: left;
    }
    .cd-changes-label {
      font-size: .7rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .05em; color: #94A3B8;
    }
    .cd-changes ul { margin: .4rem 0 0; padding-left: 1.1rem; }
    .cd-changes li { font-size: .85rem; color: #0F172A; margin-bottom: .2rem; }

    .cd-actions { display: flex; gap: .6rem; margin-top: 1.35rem; }
    .cd-btn {
      flex: 1; padding: .7rem 1rem;
      border-radius: 10px; border: 1px solid transparent;
      font: inherit; font-size: .9rem; font-weight: 600; cursor: pointer;
      transition: background .15s, border-color .15s, filter .15s;
    }
    .cd-btn--cancel {
      background: #fff; border-color: #E2E8F0; color: #475569;
      &:hover { background: #F8FAFC; border-color: #CBD5E1; }
    }
    .cd-btn--live {
      background: #0047CC; color: #fff;
      &:hover { filter: brightness(1.08); }
    }
    .cd-btn--danger {
      background: #EF4444; color: #fff;
      &:hover { filter: brightness(1.08); }
    }
    .cd-btn:focus-visible { outline: 2px solid #0047CC; outline-offset: 2px; }

    @media (prefers-reduced-motion: reduce) {
      .cd-backdrop, .cd-dialog { animation: none; }
    }
  `],
})
export class ConfirmDialogComponent {
  svc = inject(ConfirmDialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.svc.pending()) this.svc.resolve(false);
  }
}
