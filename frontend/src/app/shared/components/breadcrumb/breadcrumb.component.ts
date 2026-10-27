import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbLink {
  label: string;
  path?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol>
        @for (item of items; track item.label; let last = $last) {
          <li>
            @if (item.path && !last) {
              <a [routerLink]="item.path">{{ item.label }}</a>
            } @else {
              <span aria-current="page">{{ item.label }}</span>
            }
            @if (!last) {
              <span class="sep" aria-hidden="true">/</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [`
    .breadcrumb { padding: 14px 0; }
    ol { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; list-style: none; margin: 0; padding: 0; font-size: 13.5px; }
    li { display: flex; align-items: center; gap: 6px; }
    a { color: var(--color-text-muted, #6b7280); text-decoration: none; }
    a:hover { color: var(--color-primary, #00B4AE); text-decoration: underline; }
    span[aria-current] { color: var(--color-text, #1f2937); font-weight: 600; }
    .sep { color: var(--color-text-muted, #9ca3af); }
  `],
})
export class BreadcrumbComponent {
  @Input({ required: true }) items: BreadcrumbLink[] = [];
}
