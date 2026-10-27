import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="alert" [class]="'alert--' + variant" role="alert">
      <span class="alert__icon" [innerHTML]="icon"></span>
      <div class="alert__content">
        @if (title) {
          <h4 class="alert__title">{{ title }}</h4>
        }
        <p class="alert__message"><ng-content /></p>
      </div>
      @if (dismissible) {
        <button class="alert__close" (click)="dismiss.emit()" aria-label="Dismiss">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      }
    </div>
  `,
  styles: [`
    .alert {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      border: 1px solid transparent;
    }
    
    .alert--info {
      background: var(--color-info-50);
      border-color: var(--color-info-200);
      .alert__icon { color: var(--color-info-600); }
      .alert__title { color: var(--color-info-800); }
    }
    .alert--success {
      background: var(--color-success-50);
      border-color: var(--color-success-200);
      .alert__icon { color: var(--color-success-600); }
      .alert__title { color: var(--color-success-800); }
    }
    .alert--warning {
      background: var(--color-warning-50);
      border-color: var(--color-warning-200);
      .alert__icon { color: var(--color-warning-600); }
      .alert__title { color: var(--color-warning-800); }
    }
    .alert--error {
      background: var(--color-error-50);
      border-color: var(--color-error-200);
      .alert__icon { color: var(--color-error-600); }
      .alert__title { color: var(--color-error-800); }
    }
    
    .alert__icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      :deep(svg) { width: 100%; height: 100%; }
    }
    
    .alert__content { flex: 1; }
    
    .alert__title {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      margin: 0 0 var(--space-1) 0;
    }
    
    .alert__message {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin: 0;
    }
    
    .alert__close {
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: all var(--duration-fast);
      
      &:hover { background: rgba(0,0,0,0.05); color: var(--text-secondary); }
      svg { width: 16px; height: 16px; }
    }
  `]
})
export class AlertComponent {
  @Input() variant: AlertVariant = 'info';
  @Input() title?: string;
  @Input() dismissible = false;
  @Output() dismiss = new EventEmitter<void>();
  
  get icon(): string {
    const icons: Record<AlertVariant, string> = {
      info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    };
    return icons[this.variant];
  }
}
