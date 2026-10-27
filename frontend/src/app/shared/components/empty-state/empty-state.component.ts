import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthImageComponent } from '../health-image/health-image.component';
import { IllustrationName } from '../health-image/illustrations';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, HealthImageComponent],
  template: `
    <div class="empty-state">
      @if (illustration) {
        <app-health-image class="empty-state__art" [name]="illustration" [rounded]="false" [alt]="title" />
      } @else {
        <div class="empty-state__icon" [innerHTML]="iconSvg"></div>
      }
      <h3 class="empty-state__title">{{ title }}</h3>
      @if (description) {
        <p class="empty-state__description">{{ description }}</p>
      }
      <div class="empty-state__action">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-12) var(--space-6);
      text-align: center;
    }
    
    .empty-state__icon {
      width: 80px;
      height: 80px;
      margin-bottom: var(--space-4);
      color: var(--text-muted);

      :deep(svg) { width: 100%; height: 100%; }
    }

    .empty-state__art {
      width: 200px;
      max-width: 60%;
      margin-bottom: var(--space-5);
    }
    
    .empty-state__title {
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--space-2) 0;
    }
    
    .empty-state__description {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
      margin: 0 0 var(--space-6) 0;
      max-width: 400px;
    }
  `]
})
export class EmptyStateComponent {
  @Input() title = 'No data found';
  @Input() description?: string;
  @Input() icon: 'inbox' | 'search' | 'calendar' | 'file' | 'users' = 'inbox';
  /** When set, renders a premium healthcare illustration instead of the line icon. */
  @Input() illustration?: IllustrationName;
  
  get iconSvg(): string {
    const icons: Record<string, string> = {
      inbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>`,
      search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
      calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
      users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    };
    return icons[this.icon];
  }
}
