import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * LegalPageComponent
 *
 * Shared, reusable layout for static legal / compliance documents
 * (Privacy Policy, Terms of Service, Refund & Cancellation, Disclaimer).
 *
 * Renders a consistent hero (eyebrow + title + subtitle + "last updated")
 * and a styled prose container. Page-specific copy is projected via
 * <ng-content> wrapped in a `.legal-prose` block, so every legal page shares
 * one set of typography rules instead of duplicating layout CSS.
 *
 * Usage:
 *   <app-legal-page eyebrow="Legal" title="Privacy Policy" updated="14 July 2026"
 *     subtitle="How we collect, use and protect your information.">
 *     <h2>Section</h2>
 *     <p>…</p>
 *   </app-legal-page>
 */
@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <article class="legal">
      <!-- ── Hero ─────────────────────────────────────────────── -->
      <header class="legal-hero">
        <div class="legal-hero__inner">
          <span class="legal-eyebrow">{{ eyebrow }}</span>
          <h1 class="legal-title">{{ title }}</h1>
          @if (subtitle) {
            <p class="legal-subtitle">{{ subtitle }}</p>
          }
          @if (updated) {
            <p class="legal-updated">Last updated: {{ updated }}</p>
          }
        </div>
      </header>

      <!-- ── Body ─────────────────────────────────────────────── -->
      <div class="legal-body">
        <div class="legal-prose">
          <ng-content />
        </div>

        <!-- Cross-links to the other legal documents -->
        <nav class="legal-related" aria-label="Related policies">
          <span class="legal-related__label">Related policies</span>
          <div class="legal-related__links">
            <a routerLink="/privacy-policy">Privacy Policy</a>
            <a routerLink="/terms-of-service">Terms of Service</a>
            <a routerLink="/refund-and-cancellation">Refund &amp; Cancellation</a>
            <a routerLink="/disclaimer">Disclaimer</a>
          </div>
        </nav>

        <div class="legal-help">
          <p>Have a question about this policy?</p>
          <a routerLink="/contact" class="legal-help__btn">Contact Us</a>
        </div>
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; background: #F8F9FF; color: #0F172A;
      font-family: 'Inter', system-ui, -apple-system, sans-serif; }

    /* ── Hero ─────────────────────────────────────────────────── */
    .legal-hero {
      background:
        linear-gradient(180deg, #EEF4FF 0%, #FFFFFF 100%);
      border-bottom: 1px solid #E2E8F0;
      padding: 3.25rem 1.5rem 2.5rem;
    }
    .legal-hero__inner { max-width: 820px; margin: 0 auto; text-align: center; }
    .legal-eyebrow {
      display: inline-block; background: #E6F8F7; color: #007A76;
      border: 1px solid rgba(0,180,174,.28); border-radius: 999px;
      padding: .3rem .85rem; font-size: .72rem; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase; margin-bottom: 1rem;
    }
    .legal-title {
      font-family: 'Poppins', 'Inter', system-ui, sans-serif; font-weight: 700;
      font-size: clamp(1.8rem, 4vw, 2.5rem); color: #0D1F3C; margin: 0 0 .75rem;
      letter-spacing: -0.02em; line-height: 1.2;
    }
    .legal-subtitle { font-size: 1.02rem; line-height: 1.7; color: #475569; margin: 0 auto; max-width: 620px; }
    .legal-updated {
      margin: 1rem 0 0; font-size: .8rem; font-weight: 600; color: #94A3B8;
    }

    /* ── Body ─────────────────────────────────────────────────── */
    .legal-body { max-width: 820px; margin: 0 auto; padding: 2.75rem 1.5rem 4rem; }

    /* ── Prose (projected content) ────────────────────────────── */
    .legal-prose { color: #334155; font-size: .96rem; line-height: 1.8; }
    .legal-prose ::ng-deep h2 {
      font-family: 'Poppins', 'Inter', system-ui, sans-serif; font-weight: 700;
      font-size: 1.25rem; color: #0D1F3C; margin: 2.25rem 0 .85rem;
      padding-top: 1.5rem; border-top: 1px solid #E9EEF6;
    }
    .legal-prose ::ng-deep h2:first-child { border-top: 0; padding-top: 0; margin-top: 0; }
    .legal-prose ::ng-deep h3 {
      font-weight: 700; font-size: 1.02rem; color: #1E293B; margin: 1.5rem 0 .5rem;
    }
    .legal-prose ::ng-deep p { margin: 0 0 1rem; }
    .legal-prose ::ng-deep ul,
    .legal-prose ::ng-deep ol { margin: 0 0 1.15rem; padding-left: 1.35rem; }
    .legal-prose ::ng-deep li { margin: 0 0 .5rem; }
    .legal-prose ::ng-deep a { color: #0047CC; font-weight: 600; text-decoration: none; }
    .legal-prose ::ng-deep a:hover { text-decoration: underline; }
    .legal-prose ::ng-deep strong { color: #0F172A; font-weight: 700; }
    .legal-prose ::ng-deep .legal-note {
      background: #FFF7ED; border: 1px solid #FCD9A6; border-radius: .75rem;
      padding: 1rem 1.15rem; margin: 0 0 1.35rem; color: #7C4A03; font-size: .9rem;
    }
    .legal-prose ::ng-deep .legal-lead {
      font-size: 1.02rem; color: #475569; margin-bottom: 1.5rem;
    }

    /* ── Related policies ─────────────────────────────────────── */
    .legal-related {
      margin-top: 3rem; padding-top: 1.75rem; border-top: 1px solid #E2E8F0;
    }
    .legal-related__label {
      display: block; font-size: .72rem; font-weight: 700; letter-spacing: .1em;
      text-transform: uppercase; color: #94A3B8; margin-bottom: .85rem;
    }
    .legal-related__links { display: flex; flex-wrap: wrap; gap: .6rem; }
    .legal-related__links a {
      font-size: .84rem; font-weight: 600; color: #0047CC; text-decoration: none;
      background: #EEF4FF; border: 1px solid #DCE6F7; border-radius: 999px;
      padding: .4rem .9rem; transition: background .16s, border-color .16s;
    }
    .legal-related__links a:hover { background: #E0EAFF; border-color: #0047CC; }

    /* ── Help CTA ─────────────────────────────────────────────── */
    .legal-help {
      margin-top: 2rem; text-align: center; background: #F8FAFC;
      border: 1px solid #E2E8F0; border-radius: 1.1rem; padding: 2rem 1.5rem;
    }
    .legal-help p { color: #475569; margin: 0 0 1.1rem; font-weight: 600; }
    .legal-help__btn {
      display: inline-block; background: linear-gradient(135deg, #0047CC, #003399);
      color: #fff; font-weight: 600; text-decoration: none;
      padding: .7rem 1.6rem; border-radius: .75rem;
      box-shadow: 0 4px 12px rgba(0,71,204,.20); transition: transform .16s, box-shadow .16s;
    }
    .legal-help__btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,71,204,.35); }

    @media (max-width: 640px) {
      .legal-hero { padding: 2.5rem 1.15rem 2rem; }
      .legal-body { padding: 2rem 1.15rem 3rem; }
    }
  `],
})
export class LegalPageComponent {
  @Input() eyebrow = 'Legal';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() updated = '';
}
