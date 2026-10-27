import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="error-banner" role="alert">
      <span>{{ message }}</span>
      <button *ngIf="retryLabel" mat-button color="warn" (click)="retry.emit()">
        {{ retryLabel }}
      </button>
    </div>
  `,
  styles: [`
    .error-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fdecea;
      border: 1px solid #f44336;
      border-radius: 4px;
      padding: 0.75rem 1rem;
      color: #c62828;
      gap: 1rem;
    }
  `],
})
export class ErrorBannerComponent {
  @Input() message = 'Something went wrong.';
  @Input() retryLabel?: string;
  @Output() retry = new EventEmitter<void>();
}
