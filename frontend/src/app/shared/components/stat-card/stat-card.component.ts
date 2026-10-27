import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatTrend = 'up' | 'down' | 'neutral';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="stat-card">
      <div class="stat-card__header">
        <span class="stat-card__label">{{ label }}</span>
        @if (icon) {
          <span class="stat-card__icon" [innerHTML]="icon"></span>
        }
      </div>
      <div class="stat-card__value">{{ value }}</div>
      @if (change !== undefined) {
        <div class="stat-card__change" [class]="'stat-card__change--' + trend">
          @if (trend === 'up') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          } @else if (trend === 'down') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
              <polyline points="17 18 23 18 23 12"/>
            </svg>
          }
          <span>{{ change > 0 ? '+' : '' }}{{ change }}%</span>
          @if (changeLabel) {
            <span class="stat-card__change-label">{{ changeLabel }}</span>
          }
        </div>
      }
    </article>
  `,
  styles: [`
    .stat-card {
      padding: var(--space-5);
      background: var(--bg-primary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
    }
    
    .stat-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3);
    }
    
    .stat-card__label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--text-secondary);
    }
    
    .stat-card__icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary-50);
      color: var(--color-primary-600);
      border-radius: var(--radius-lg);
      
      :deep(svg) { width: 20px; height: 20px; }
    }
    
    .stat-card__value {
      font-family: var(--font-display);
      font-size: var(--text-3xl);
      font-weight: var(--font-bold);
      color: var(--text-primary);
      line-height: 1;
      margin-bottom: var(--space-2);
    }
    
    .stat-card__change {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      
      svg { width: 16px; height: 16px; }
      
      &.stat-card__change--up { color: var(--color-success-600); }
      &.stat-card__change--down { color: var(--color-error-600); }
      &.stat-card__change--neutral { color: var(--text-tertiary); }
    }
    
    .stat-card__change-label {
      color: var(--text-tertiary);
      font-weight: var(--font-normal);
    }
  `]
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() icon?: string;
  @Input() change?: number;
  @Input() changeLabel?: string;
  @Input() trend: StatTrend = 'neutral';
}
