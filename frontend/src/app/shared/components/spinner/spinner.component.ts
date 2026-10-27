import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="spinner" [class]="'spinner--' + size" role="status" aria-label="Loading">
      <svg viewBox="0 0 50 50">
        <circle class="spinner__track" cx="25" cy="25" r="20" fill="none" stroke-width="4"/>
        <circle class="spinner__circle" cx="25" cy="25" r="20" fill="none" stroke-width="4"/>
      </svg>
      @if (label) {
        <span class="spinner__label">{{ label }}</span>
      }
    </div>
  `,
  styles: [`
    .spinner {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
    }
    
    .spinner--sm svg { width: 24px; height: 24px; }
    .spinner--md svg { width: 40px; height: 40px; }
    .spinner--lg svg { width: 64px; height: 64px; }
    
    .spinner__track {
      stroke: var(--border-default);
    }
    
    .spinner__circle {
      stroke: var(--color-primary-600);
      stroke-linecap: round;
      stroke-dasharray: 100;
      stroke-dashoffset: 75;
      transform-origin: center;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .spinner__label {
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }
    
    @media (prefers-reduced-motion: reduce) {
      .spinner__circle { animation-duration: 2s; }
    }
  `]
})
export class SpinnerComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() label?: string;
}
