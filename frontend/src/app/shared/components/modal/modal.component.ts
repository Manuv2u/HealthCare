import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen) {
      <div class="modal-backdrop" (click)="onBackdropClick()" role="dialog" aria-modal="true">
        <div 
          class="modal" 
          [class]="'modal--' + size"
          (click)="$event.stopPropagation()"
          role="document"
        >
          @if (showHeader) {
            <header class="modal__header">
              <h2 class="modal__title">{{ title }}</h2>
              @if (showClose) {
                <button class="modal__close" (click)="close.emit()" aria-label="Close modal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              }
            </header>
          }
          
          <div class="modal__body">
            <ng-content />
          </div>
          
          @if (showFooter) {
            <footer class="modal__footer">
              <ng-content select="[modal-footer]" />
            </footer>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4);
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: var(--z-modal-backdrop);
      animation: fadeIn var(--duration-fast) var(--ease-out);
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .modal {
      display: flex;
      flex-direction: column;
      background: var(--bg-primary);
      border-radius: var(--radius-2xl);
      box-shadow: var(--shadow-2xl);
      max-height: calc(100vh - var(--space-8));
      animation: scaleIn var(--duration-normal) var(--ease-out);
      
      &.modal--sm { width: 100%; max-width: 400px; }
      &.modal--md { width: 100%; max-width: 500px; }
      &.modal--lg { width: 100%; max-width: 640px; }
      &.modal--xl { width: 100%; max-width: 800px; }
      &.modal--full { width: 100%; max-width: calc(100vw - var(--space-8)); }
    }
    
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    
    .modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-5) var(--space-6);
      border-bottom: 1px solid var(--border-subtle);
    }
    
    .modal__title {
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--text-primary);
      margin: 0;
    }
    
    .modal__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--duration-fast);
      
      &:hover {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }
      
      svg { width: 20px; height: 20px; }
    }
    
    .modal__body {
      flex: 1;
      padding: var(--space-6);
      overflow-y: auto;
    }
    
    .modal__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-secondary);
      border-radius: 0 0 var(--radius-2xl) var(--radius-2xl);
    }

    /* Callers project a single <div modal-footer> wrapper, so the gap above
       lands on that wrapper and never reaches the buttons inside it — they end
       up touching, separated only by inter-element whitespace. Lay the wrapper
       out here so every modal spaces its actions correctly, rather than relying
       on each of the ~17 call sites to remember. */
    :host ::ng-deep .modal__footer > * {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
    
    @media (prefers-reduced-motion: reduce) {
      .modal-backdrop, .modal {
        animation: none;
      }
    }
  `]
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() size: ModalSize = 'md';
  @Input() showHeader = true;
  @Input() showClose = true;
  @Input() showFooter = true;
  @Input() closeOnBackdrop = true;
  @Input() closeOnEscape = true;
  
  @Output() close = new EventEmitter<void>();
  
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen && this.closeOnEscape) {
      this.close.emit();
    }
  }
  
  onBackdropClick(): void {
    if (this.closeOnBackdrop) {
      this.close.emit();
    }
  }
}
