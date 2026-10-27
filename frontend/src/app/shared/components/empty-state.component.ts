import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="empty-state">
      <p class="message">{{ message }}</p>
      <button *ngIf="ctaLabel" mat-stroked-button (click)="ctaClick.emit()">
        {{ ctaLabel }}
      </button>
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem;
      gap: 1rem;
      color: #666;
    }
    .message { font-size: 1rem; }
  `],
})
export class EmptyStateComponent {
  @Input() message = 'No items found.';
  @Input() ctaLabel?: string;
  @Output() ctaClick = new EventEmitter<void>();
}
