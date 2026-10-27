import { Component, Input, Output, EventEmitter, ContentChildren, QueryList, TemplateRef, AfterContentInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface SortEvent {
  column: string;
  direction: 'asc' | 'desc' | null;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-container" [class.table-container--loading]="loading">
      <table class="table">
        <thead class="table__head">
          <tr>
            @if (selectable) {
              <th class="table__th table__th--checkbox">
                <input 
                  type="checkbox" 
                  [checked]="allSelected"
                  [indeterminate]="someSelected && !allSelected"
                  (change)="toggleSelectAll()"
                  class="table__checkbox"
                />
              </th>
            }
            @for (column of columns; track column.key) {
              <th 
                class="table__th"
                [class.table__th--sortable]="column.sortable"
                [style.width]="column.width"
                [style.text-align]="column.align || 'left'"
                (click)="column.sortable && onSort(column.key)"
              >
                <div class="table__th-content">
                  <span>{{ column.label }}</span>
                  @if (column.sortable) {
                    <span class="table__sort-icon" [class.table__sort-icon--active]="sortColumn === column.key">
                      @if (sortColumn === column.key && sortDirection === 'asc') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                      } @else if (sortColumn === column.key && sortDirection === 'desc') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      } @else {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="7 10 12 5 17 10"/><polyline points="7 14 12 19 17 14"/>
                        </svg>
                      }
                    </span>
                  }
                </div>
              </th>
            }
          </tr>
        </thead>
        <tbody class="table__body">
          @if (loading) {
            @for (i of [1,2,3,4,5]; track i) {
              <tr class="table__row table__row--skeleton">
                @if (selectable) { <td class="table__td"><div class="skeleton skeleton--checkbox"></div></td> }
                @for (col of columns; track col.key) {
                  <td class="table__td"><div class="skeleton"></div></td>
                }
              </tr>
            }
          } @else if (data.length === 0) {
            <tr>
              <td [attr.colspan]="columns.length + (selectable ? 1 : 0)" class="table__empty">
                <div class="empty-state">
                  <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                  </svg>
                  <p class="empty-state__text">{{ emptyMessage }}</p>
                </div>
              </td>
            </tr>
          } @else {
            @for (row of data; track trackByFn(row); let i = $index) {
              <tr 
                class="table__row" 
                [class.table__row--selected]="isSelected(row)"
                [class.table__row--clickable]="rowClickable"
                (click)="onRowClick(row)"
              >
                @if (selectable) {
                  <td class="table__td table__td--checkbox" (click)="$event.stopPropagation()">
                    <input 
                      type="checkbox" 
                      [checked]="isSelected(row)"
                      (change)="toggleSelect(row)"
                      class="table__checkbox"
                    />
                  </td>
                }
                @for (column of columns; track column.key) {
                  <td class="table__td" [style.text-align]="column.align || 'left'">
                    <ng-container *ngTemplateOutlet="getCellTemplate(column.key) || defaultCell; context: { $implicit: row, column: column }"></ng-container>
                    <ng-template #defaultCell>{{ row[column.key] }}</ng-template>
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .table-container {
      width: 100%;
      overflow-x: auto;
      background: var(--bg-primary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
    }
    
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .table__head {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-default);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    
    .table__th {
      padding: var(--space-3) var(--space-4);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      white-space: nowrap;
      
      &.table__th--sortable { cursor: pointer; }
      &.table__th--checkbox { width: 48px; }
    }

    .table__th-content {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }
    
    .table__sort-icon {
      width: 16px;
      height: 16px;
      color: var(--text-muted);
      opacity: 0.5;
      transition: opacity var(--duration-fast);
      
      &.table__sort-icon--active { opacity: 1; color: var(--color-primary-600); }
      svg { width: 100%; height: 100%; }
    }
    
    .table__th--sortable:hover .table__sort-icon { opacity: 1; }
    
    .table__body .table__row {
      border-bottom: 1px solid var(--border-subtle);
      transition: background var(--duration-fast);
      
      &:last-child { border-bottom: none; }
      &:hover { background: var(--bg-secondary); }
      &.table__row--selected { background: var(--color-primary-50); }
      &.table__row--clickable { cursor: pointer; }
    }
    
    .table__td {
      padding: var(--space-4);
      font-size: var(--text-sm);
      color: var(--text-primary);
      vertical-align: middle;
      
      &.table__td--checkbox { width: 48px; }
    }

    .table__checkbox {
      width: 18px;
      height: 18px;
      accent-color: var(--color-primary-600);
      cursor: pointer;
    }
    
    .table__empty {
      padding: var(--space-12) var(--space-4);
    }
    
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      color: var(--text-tertiary);
    }
    
    .empty-state__icon {
      width: 48px;
      height: 48px;
      color: var(--text-muted);
    }
    
    .empty-state__text {
      font-size: var(--text-sm);
      margin: 0;
    }
    
    .skeleton {
      height: 20px;
      background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: var(--radius-md);
      
      &.skeleton--checkbox { width: 18px; height: 18px; }
    }
    
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `]
})
export class DataTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() loading = false;
  @Input() selectable = false;
  @Input() rowClickable = false;
  @Input() emptyMessage = 'No data available';
  @Input() trackBy: string = 'id';
  @Input() cellTemplates: Record<string, TemplateRef<any>> = {};
  
  @Output() sortChange = new EventEmitter<SortEvent>();
  @Output() selectionChange = new EventEmitter<any[]>();
  @Output() rowClick = new EventEmitter<any>();
  
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' | null = null;
  selectedRows: Set<any> = new Set();
  
  get allSelected(): boolean {
    return this.data.length > 0 && this.selectedRows.size === this.data.length;
  }
  
  get someSelected(): boolean {
    return this.selectedRows.size > 0;
  }
  
  trackByFn(row: any): any {
    return row[this.trackBy] ?? row;
  }
  
  getCellTemplate(key: string): TemplateRef<any> | null {
    return this.cellTemplates[key] || null;
  }
  
  onSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 
                          this.sortDirection === 'desc' ? null : 'asc';
      if (!this.sortDirection) this.sortColumn = null;
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortChange.emit({ column: this.sortColumn!, direction: this.sortDirection });
  }
  
  toggleSelectAll(): void {
    if (this.allSelected) {
      this.selectedRows.clear();
    } else {
      this.data.forEach(row => this.selectedRows.add(row));
    }
    this.selectionChange.emit(Array.from(this.selectedRows));
  }
  
  toggleSelect(row: any): void {
    if (this.selectedRows.has(row)) {
      this.selectedRows.delete(row);
    } else {
      this.selectedRows.add(row);
    }
    this.selectionChange.emit(Array.from(this.selectedRows));
  }
  
  isSelected(row: any): boolean {
    return this.selectedRows.has(row);
  }
  
  onRowClick(row: any): void {
    if (this.rowClickable) {
      this.rowClick.emit(row);
    }
  }
}
