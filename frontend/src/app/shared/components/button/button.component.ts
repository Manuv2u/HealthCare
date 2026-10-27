import { Component, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="buttonClasses"
      (click)="handleClick($event)"
    >
      @if (loading) {
        <span class="btn__spinner">
          <svg class="animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        </span>
      }
      @if (iconLeft && !loading) {
        <span class="btn__icon btn__icon--left" [innerHTML]="iconLeft"></span>
      }
      <span class="btn__text"><ng-content /></span>
      @if (iconRight) {
        <span class="btn__icon btn__icon--right" [innerHTML]="iconRight"></span>
      }
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      font-family: var(--font-sans);
      font-weight: var(--font-semibold);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
      text-decoration: none;
      border: 2px solid transparent;
      white-space: nowrap;
      
      &:focus-visible {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 2px;
      }
      
      &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
        box-shadow: none;
        transform: none;
      }
    }

    /* Filled variants get a clean, flat "muted" disabled look instead of a
       washed-out translucent gradient (which reads as broken). */
    .btn--primary:disabled,
    .btn--secondary:disabled,
    .btn--danger:disabled,
    .btn--success:disabled {
      opacity: 1;
      background: var(--color-neutral-200);
      color: var(--color-neutral-400);
    }
    
    /* Sizes */
    .btn--sm {
      height: var(--btn-height-sm);
      padding: 0 var(--space-3);
      font-size: var(--text-xs);
    }
    .btn--md {
      height: var(--btn-height-md);
      padding: 0 var(--space-4);
      font-size: var(--text-sm);
    }
    .btn--lg {
      height: var(--btn-height-lg);
      padding: 0 var(--space-5);
      font-size: var(--text-base);
    }
    .btn--xl {
      height: var(--btn-height-xl);
      padding: 0 var(--space-6);
      font-size: var(--text-lg);
    }
    
    /* Variants */
    .btn--primary {
      background: var(--gradient-primary);
      color: var(--text-inverse);
      &:hover:not(:disabled) {
        background: var(--gradient-primary-hover);
        box-shadow: var(--shadow-primary);
        transform: translateY(-1px);
      }
      &:active:not(:disabled) { transform: translateY(0); background: var(--color-primary-800); }
    }
    .btn--secondary {
      background: var(--color-secondary-600);
      color: var(--text-inverse);
      &:hover:not(:disabled) {
        background: var(--color-secondary-700);
      }
      &:active:not(:disabled) { background: var(--color-secondary-800); }
    }
    .btn--outline {
      background: transparent;
      border-color: var(--border-strong);
      color: var(--text-primary);
      &:hover:not(:disabled) {
        background: var(--bg-secondary);
        border-color: var(--color-primary-500);
        color: var(--color-primary-700);
      }
    }
    .btn--ghost {
      background: transparent;
      color: var(--text-secondary);
      &:hover:not(:disabled) {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }
    }
    .btn--danger {
      background: var(--color-error-600);
      color: var(--text-inverse);
      &:hover:not(:disabled) {
        background: var(--color-error-700);
      }
    }
    .btn--success {
      background: var(--color-success-600);
      color: var(--text-inverse);
      &:hover:not(:disabled) {
        background: var(--color-success-700);
      }
    }
    
    .btn--full { width: 100%; }

    /* The global reset sets svg { display:block }, which pushes any icon
       projected into a button onto its own line (chevrons/plus stacking above
       or below the label). Restore inline flow and normalise icon size so every
       app-button lines its icon up beside the text, at 1em, app-wide. */
    .btn__text {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
    .btn__text :deep(svg) {
      display: inline-block;
      width: 1em;
      height: 1em;
      flex-shrink: 0;
      margin: 0;
    }

    .btn__icon {
      display: flex;
      width: 1em;
      height: 1em;
      :deep(svg) { width: 100%; height: 100%; }
    }
    
    .btn__spinner {
      display: flex;
      width: 1.25em;
      height: 1.25em;
      svg { width: 100%; height: 100%; }
    }
    
    .animate-spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() fullWidth = false;
  @Input() iconLeft?: string;
  @Input() iconRight?: string;
  
  @Output() clicked = new EventEmitter<MouseEvent>();
  
  get buttonClasses(): string {
    return [
      'btn',
      `btn--${this.variant}`,
      `btn--${this.size}`,
      this.fullWidth ? 'btn--full' : ''
    ].filter(Boolean).join(' ');
  }
  
  handleClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }
}
