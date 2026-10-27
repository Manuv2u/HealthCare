import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CallbackRequestModalComponent } from '../callback-request-modal/callback-request-modal.component';

@Component({
  selector: 'app-quick-help-widget',
  standalone: true,
  imports: [CommonModule, MatIconModule, CallbackRequestModalComponent],
  template: `
    <button
      type="button"
      class="fab"
      (click)="open()"
      aria-label="Request a callback"
    >
      <mat-icon>support_agent</mat-icon>
    </button>

    <app-callback-request-modal [open]="isOpen()" (closed)="close()" />
  `,
  styles: [`
    .fab {
      position: fixed;
      right: 1.5rem;
      bottom: 1.5rem;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #0047CC 0%, #003399 100%);
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 20px rgba(0,51,153,0.35);
      cursor: pointer;
      z-index: 500;
      transition: transform 150ms, box-shadow 150ms;
    }
    .fab:hover { transform: scale(1.05); box-shadow: 0 10px 24px rgba(0,51,153,0.45); }
    .fab:focus-visible { outline: 2px solid #003399; outline-offset: 3px; }
    .fab mat-icon { font-size: 26px; width: 26px; height: 26px; }

    /* On mobile the bottom navigation bar (height --bnav-h) is fixed to the
       bottom edge, so lift the FAB above it to keep the Profile item tappable. */
    @media (max-width: 768px) {
      .fab {
        right: 1rem;
        bottom: calc(var(--bnav-h, 64px) + env(safe-area-inset-bottom, 0px) + 0.9rem);
        width: 50px;
        height: 50px;
      }
      .fab mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .fab { transition: none; }
    }
  `],
})
export class QuickHelpWidgetComponent {
  isOpen = signal(false);

  open(): void { this.isOpen.set(true); }
  close(): void { this.isOpen.set(false); }
}
