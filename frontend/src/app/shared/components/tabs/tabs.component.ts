import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
  disabled?: boolean;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tabs" [class.tabs--full-width]="fullWidth">
      <div class="tabs__list" role="tablist">
        @for (tab of tabs; track tab.id) {
          <button
            class="tabs__tab"
            [class.tabs__tab--active]="tab.id === activeTab()"
            [class.tabs__tab--disabled]="tab.disabled"
            [disabled]="tab.disabled"
            role="tab"
            [attr.aria-selected]="tab.id === activeTab()"
            [attr.aria-controls]="'tabpanel-' + tab.id"
            (click)="selectTab(tab)"
          >
            @if (tab.icon) {
              <span class="tabs__icon" [innerHTML]="tab.icon"></span>
            }
            <span class="tabs__label">{{ tab.label }}</span>
            @if (tab.badge !== undefined) {
              <span class="tabs__badge">{{ tab.badge }}</span>
            }
          </button>
        }
        <div class="tabs__indicator" [style.width.%]="indicatorWidth" [style.left.%]="indicatorLeft"></div>
      </div>
    </div>
  `,
  styles: [`
    .tabs__list {
      position: relative;
      display: inline-flex;
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      padding: var(--space-1);
    }
    
    .tabs--full-width .tabs__list {
      display: flex;
      width: 100%;
    }
    
    .tabs__tab {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
      z-index: 1;
      
      &:hover:not(:disabled) {
        color: var(--text-primary);
      }
      
      &.tabs__tab--active {
        color: var(--text-primary);
        background: var(--bg-primary);
        box-shadow: var(--shadow-sm);
      }

      &.tabs__tab--disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    
    .tabs--full-width .tabs__tab {
      flex: 1;
    }
    
    .tabs__icon {
      width: 16px;
      height: 16px;
      :deep(svg) { width: 100%; height: 100%; }
    }
    
    .tabs__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 var(--space-1);
      background: var(--color-primary-100);
      color: var(--color-primary-700);
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      border-radius: var(--radius-full);
    }
    
    .tabs__tab--active .tabs__badge {
      background: var(--color-primary-600);
      color: var(--text-inverse);
    }
  `]
})
export class TabsComponent {
  @Input() tabs: Tab[] = [];
  @Input() set active(value: string) { this.activeTab.set(value); }
  @Input() fullWidth = false;
  @Output() tabChange = new EventEmitter<string>();
  
  activeTab = signal('');
  
  get indicatorWidth(): number {
    return this.tabs.length > 0 ? 100 / this.tabs.length : 0;
  }
  
  get indicatorLeft(): number {
    const index = this.tabs.findIndex(t => t.id === this.activeTab());
    return index >= 0 ? (index * 100) / this.tabs.length : 0;
  }
  
  selectTab(tab: Tab): void {
    if (!tab.disabled) {
      this.activeTab.set(tab.id);
      this.tabChange.emit(tab.id);
    }
  }
}
