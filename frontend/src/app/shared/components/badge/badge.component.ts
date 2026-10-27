import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'accent';
export type BadgeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="badgeClasses">
      @if (dot) {
        <span class="badge__dot"></span>
      }
      <ng-content />
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    
    span.badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      font-weight: var(--font-medium);
      border-radius: var(--radius-full);
      white-space: nowrap;
    }
    
    .badge--sm {
      height: var(--badge-height-sm);
      padding: 0 var(--space-2);
      font-size: var(--text-2xs);
    }
    .badge--md {
      height: var(--badge-height-md);
      padding: 0 var(--space-2-5);
      font-size: var(--text-xs);
    }
    .badge--lg {
      height: var(--badge-height-lg);
      padding: 0 var(--space-3);
      font-size: var(--text-sm);
    }
    
    .badge--default {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }
    .badge--primary {
      background: var(--color-primary-100);
      color: var(--color-primary-700);
    }
    .badge--secondary {
      background: var(--color-secondary-100);
      color: var(--color-secondary-700);
    }
    .badge--success {
      background: var(--color-success-100);
      color: var(--color-success-700);
    }
    .badge--warning {
      background: var(--color-warning-100);
      color: var(--color-warning-700);
    }
    .badge--error {
      background: var(--color-error-100);
      color: var(--color-error-700);
    }
    .badge--info {
      background: var(--color-info-100);
      color: var(--color-info-700);
    }
    .badge--accent {
      background: var(--color-accent-100);
      color: var(--color-accent-700);
    }
    
    .badge__dot {
      width: 6px;
      height: 6px;
      border-radius: var(--radius-full);
      background: currentColor;
    }
  `]
})
export class BadgeComponent {
  @Input() variant: BadgeVariant = 'default';
  @Input() size: BadgeSize = 'md';
  @Input() dot = false;

  /** Alias for variant — allows [color]="'success'" syntax used throughout the app */
  @Input() set color(val: string) { this.variant = (val || 'default') as BadgeVariant; }

  get badgeClasses(): string {
    return `badge badge--${this.variant} badge--${this.size}`;
  }
}
