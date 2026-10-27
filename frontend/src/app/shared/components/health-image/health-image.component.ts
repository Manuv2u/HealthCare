import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ILLUSTRATIONS, IllustrationName } from './illustrations';

/**
 * <app-health-image> — semantic healthcare visual.
 *
 * Renders an on-brand teal illustration (currently inline SVG) referenced by a
 * stable semantic `name`. To move to real / AI-generated photos later, change the
 * asset in `illustrations.ts` from kind:'svg' to kind:'photo' — consumers here
 * never change. See the header of `illustrations.ts` for the swap steps.
 *
 * Usage:
 *   <app-health-image name="lab-hero" alt="Modern diagnostic lab" />
 *   <app-health-image name="home-collection" [rounded]="true" [overlay]="true">
 *     <h2>Text over image</h2>
 *   </app-health-image>
 */
@Component({
  selector: 'app-health-image',
  standalone: true,
  imports: [CommonModule],
  template: `
    <figure
      class="health-image"
      [class.health-image--rounded]="rounded"
      [class.health-image--overlay]="overlay"
      [style.aspect-ratio]="ratio"
      [attr.role]="'img'"
      [attr.aria-label]="alt || null"
    >
      @if (asset.kind === 'photo') {
        <img class="health-image__photo" [src]="asset.src" [alt]="alt" loading="lazy" decoding="async" />
      } @else if (safeSvg) {
        <div class="health-image__svg" [innerHTML]="safeSvg" aria-hidden="true"></div>
      }
      @if (overlay) { <span class="health-image__overlay" aria-hidden="true"></span> }
      <figcaption class="health-image__caption"><ng-content /></figcaption>
    </figure>
  `,
  styles: [`
    :host { display: block; }

    .health-image {
      position: relative;
      display: block;
      margin: 0;
      width: 100%;
      overflow: hidden;
    }
    .health-image--rounded { border-radius: var(--radius-2xl); }

    .health-image__svg,
    .health-image__photo {
      display: block;
      width: 100%;
      height: 100%;
    }
    .health-image__svg :deep(svg) {
      display: block;
      width: 100%;
      height: 100%;
    }
    .health-image__photo { object-fit: cover; }

    /* Teal gradient scrim so overlaid text stays legible on any asset. */
    .health-image__overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(35, 78, 82, 0) 30%, rgba(35, 78, 82, 0.72) 100%);
      pointer-events: none;
    }

    .health-image__caption {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: var(--space-6);
      color: var(--text-inverse);
    }
    .health-image__caption:empty { display: none; }
  `]
})
export class HealthImageComponent implements OnChanges {
  /** Semantic asset key — see IllustrationName in illustrations.ts. */
  @Input() name?: IllustrationName;
  /** Direct photo path for a placement-unique image (takes precedence over `name`). */
  @Input() src?: string;
  /** Aspect ratio (w/h) when using a direct `src`. */
  @Input() ratioInput?: number;
  /** Accessible description of the visual. */
  @Input() alt = '';
  /** Apply a large rounded frame. */
  @Input() rounded = true;
  /** Overlay a teal gradient scrim (for text-over-image via projected content). */
  @Input() overlay = false;
  /** 'dark' uses the light-on-transparent variant for placement on dark backgrounds (falls back to light). */
  @Input() tone: 'light' | 'dark' = 'light';

  safeSvg: SafeHtml | null = null;
  asset = ILLUSTRATIONS['empty-generic'];
  ratio = '1';

  constructor(private readonly sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    // Direct per-placement photo (guarantees a unique image per section).
    if (this.src) {
      this.asset = { kind: 'photo', src: this.src, ratio: this.ratioInput ?? 1.5 };
      this.ratio = String(this.asset.ratio);
      this.safeSvg = null;
      return;
    }
    this.asset = (this.name && ILLUSTRATIONS[this.name]) || ILLUSTRATIONS['empty-generic'];
    this.ratio = String(this.asset.ratio);
    const markup = this.tone === 'dark' && this.asset.svgDark ? this.asset.svgDark : this.asset.svg;
    this.safeSvg = this.asset.kind === 'svg' && markup
      ? this.sanitizer.bypassSecurityTrustHtml(markup)
      : null;
  }
}
