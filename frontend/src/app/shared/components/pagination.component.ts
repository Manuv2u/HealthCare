import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="pagination">
      <button mat-icon-button [disabled]="page <= 1" (click)="pageChange.emit(page - 1)">
        <mat-icon>chevron_left</mat-icon>
      </button>
      <span>Page {{ page }} of {{ totalPages }}</span>
      <button mat-icon-button [disabled]="page >= totalPages" (click)="pageChange.emit(page + 1)">
        <mat-icon>chevron_right</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .pagination {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: center;
      padding: 1rem;
    }
  `],
})
export class PaginationComponent {
  @Input() page = 1;
  @Input() total = 0;
  @Input() pageSize = 20;
  @Output() pageChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }
}
