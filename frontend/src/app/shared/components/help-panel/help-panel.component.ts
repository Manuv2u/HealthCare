import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface HelpSection {
  title: string;
  /** Paragraphs and/or bullet lists, rendered in order. */
  paragraphs?: string[];
  bullets?: string[];
}

/**
 * Admin help panel: an ⓘ icon that slides open a plain-language explainer.
 * Content is written for administrators without technical knowledge.
 */
@Component({
  selector: 'app-help-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
<button
  type="button"
  class="help-trigger"
  (click)="open.set(true)"
  aria-label="Open help"
  title="How this works"
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
</button>

@if (open()) {
  <div class="help-overlay" (click)="open.set(false)"></div>
  <aside class="help-drawer" role="dialog" [attr.aria-label]="heading()">
    <div class="help-header">
      <h2>{{ heading() }}</h2>
      <button type="button" class="help-close" (click)="open.set(false)" aria-label="Close help">✕</button>
    </div>
    <div class="help-body">
      @for (section of sections(); track section.title) {
        <section class="help-section">
          <h3>{{ section.title }}</h3>
          @for (p of section.paragraphs ?? []; track p) { <p>{{ p }}</p> }
          @if (section.bullets?.length) {
            <ul>
              @for (b of section.bullets!; track b) { <li>{{ b }}</li> }
            </ul>
          }
        </section>
      }
    </div>
  </aside>
}`,
  styles: [`
    .help-trigger { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:999px; border:1px solid #E2E8F0; background:#fff; color:#0F766E; cursor:pointer; transition:background 150ms; vertical-align:middle; }
    .help-trigger:hover { background:#F0FDFA; }
    .help-overlay { position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:70; }
    .help-drawer { position:fixed; top:0; right:0; bottom:0; width:min(440px, 100vw); background:#fff; z-index:71; box-shadow:-12px 0 40px rgba(0,0,0,.18); display:flex; flex-direction:column; }
    .help-header { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 1.5rem; border-bottom:1px solid #F1F5F9; }
    .help-header h2 { font-size:1.05rem; font-weight:700; color:#0F172A; margin:0; }
    .help-close { background:none; border:none; font-size:1rem; color:#64748B; cursor:pointer; padding:.25rem; }
    .help-body { overflow-y:auto; padding:1.25rem 1.5rem; }
    .help-section { margin-bottom:1.5rem; }
    .help-section h3 { font-size:.85rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#0F766E; margin:0 0 .5rem; }
    .help-section p { font-size:.875rem; color:#334155; line-height:1.65; margin:0 0 .5rem; }
    .help-section ul { margin:.25rem 0 0; padding-left:1.1rem; }
    .help-section li { font-size:.875rem; color:#334155; line-height:1.65; margin-bottom:.35rem; }
  `]
})
export class HelpPanelComponent {
  heading = input<string>('How this works');
  sections = input<HelpSection[]>([]);
  open = signal(false);
}
