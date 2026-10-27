import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FaqItem } from '../../../core/api/api.types';

@Component({
  selector: 'app-faq-accordion',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="faq-list">
      @for (item of items; track $index) {
        <div class="faq-item" [class.open]="openIndex() === $index">
          <button type="button" class="faq-q" (click)="toggle($index)" [attr.aria-expanded]="openIndex() === $index">
            <span>{{ item.question }}</span>
            <mat-icon class="chev">expand_more</mat-icon>
          </button>
          @if (openIndex() === $index) {
            <div class="faq-a">{{ item.answer }}</div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .faq-list { display: flex; flex-direction: column; gap: .65rem; }
    .faq-item {
      border: 1px solid var(--border, #E2E8F0);
      border-radius: .85rem;
      background: var(--surface, #fff);
      overflow: hidden;
      transition: border-color .15s;
    }
    .faq-item.open { border-color: var(--indigo, #0047CC); }
    .faq-q {
      width: 100%;
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 1rem 1.15rem;
      background: none; border: none; cursor: pointer; text-align: left;
      font: inherit; font-weight: 600; font-size: .95rem; color: var(--text, #0F172A);
    }
    .faq-q .chev { color: var(--text-2, #64748B); transition: transform .2s; flex-shrink: 0; }
    .faq-item.open .faq-q .chev { transform: rotate(180deg); color: var(--indigo, #0047CC); }
    .faq-a {
      padding: 0 1.15rem 1.1rem;
      font-size: .9rem; line-height: 1.65; color: var(--text-2, #475569);
    }
  `],
})
export class FaqAccordionComponent {
  @Input() items: FaqItem[] = [];

  openIndex = signal<number | null>(0);

  toggle(index: number): void {
    this.openIndex.set(this.openIndex() === index ? null : index);
  }
}
