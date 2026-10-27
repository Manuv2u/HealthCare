import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article [class]="cardClasses" [class.card--clickable]="clickable">
      @if (header) {
        <header class="card__header">
          <ng-content select="[card-header]" />
        </header>
      }
      <div class="card__body" [class.card__body--no-padding]="noPadding">
        <ng-content />
      </div>
      @if (footer) {
        <footer class="card__footer">
          <ng-content select="[card-footer]" />
        </footer>
      }
    </article>
  `,
  styles: [`
    .card {
      background: var(--bg-primary);
      border-radius: var(--card-radius);
      overflow: hidden;
      transition: all var(--duration-fast) var(--ease-default);
    }
    
    .card--default {
      border: 1px solid var(--border-subtle);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
    }
    .card--elevated {
      box-shadow: var(--shadow-lg);
    }
    .card--outlined {
      border: 1px solid var(--border-strong);
    }
    .card--filled {
      background: var(--bg-secondary);
    }

    .card--clickable {
      cursor: pointer;
      &:hover {
        border-color: var(--color-primary-200);
        box-shadow: 0 20px 48px rgba(0, 71, 204, 0.12);
        transform: translateY(-4px);
      }
      &:active { transform: translateY(-1px); }
    }
    
    .card__header {
      padding: var(--space-4) var(--card-padding);
      border-bottom: 1px solid var(--border-subtle);
    }
    
    .card__body {
      padding: var(--card-padding);
      &.card__body--no-padding { padding: 0; }
    }
    
    .card__footer {
      padding: var(--space-4) var(--card-padding);
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-secondary);
    }
  `]
})
export class CardComponent {
  @Input() variant: CardVariant = 'default';
  @Input() header = false;
  @Input() footer = false;
  @Input() clickable = false;
  @Input() noPadding = false;
  
  get cardClasses(): string {
    return `card card--${this.variant}`;
  }
}
