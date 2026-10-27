import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FaqApiService } from '../../core/api/services/faq-api.service';
import { Faq } from '../../core/api/api.types';
import { FaqAccordionComponent } from '../../shared/components/faq-accordion/faq-accordion.component';
import { SeoService } from '../../core/services/seo.service';
import { buildBreadcrumbSchema, buildFaqSchema } from '../../core/seo/schema.util';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';

interface FaqGroup {
  key: string;
  label: string;
  items: Faq[];
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  booking: 'Booking & Scheduling',
  home_collection: 'Home Collection',
  reports: 'Reports',
  payments: 'Payments & Refunds',
  account: 'Account',
};

@Component({
  selector: 'app-faq-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FaqAccordionComponent, BreadcrumbComponent],
  template: `
    <div class="faq-page">
      <!-- Hero -->
      <header class="faq-hero">
        <div class="faq-hero__inner">
          <app-breadcrumb [items]="[{ label: 'Home', path: '/' }, { label: 'FAQ' }]" />
          <span class="faq-eyebrow">Help Centre</span>
          <h1 class="faq-title">Frequently Asked Questions</h1>
          <p class="faq-subtitle">
            Answers to common questions about booking tests, home collection,
            reports, payments and more. Can't find what you're looking for?
            <a routerLink="/contact">Contact our team</a>.
          </p>
        </div>
      </header>

      <div class="faq-body">
        @if (loading()) {
          <div class="faq-state">Loading FAQs…</div>
        } @else if (groups().length === 0) {
          <div class="faq-state">No FAQs available yet. Please check back soon.</div>
        } @else {
          @for (group of groups(); track group.key) {
            <section class="faq-group">
              <h2 class="faq-group__title">{{ group.label }}</h2>
              <app-faq-accordion [items]="group.items" />
            </section>
          }

          <div class="faq-cta">
            <h3>Still have questions?</h3>
            <p>Our support team is happy to help you with anything else.</p>
            <a routerLink="/contact" class="faq-cta__btn">Contact Us</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .faq-page { min-height: 60vh; }

    .faq-hero {
      background: linear-gradient(180deg, #EEF4FF 0%, #FFFFFF 100%);
      border-bottom: 1px solid #E2E8F0;
      padding: 3.5rem 1.5rem 2.75rem;
    }
    .faq-hero__inner { max-width: 820px; margin: 0 auto; text-align: center; }
    .faq-eyebrow {
      display: inline-block; background: #E6F8F7; color: #007A76;
      border: 1px solid rgba(0,180,174,.28); border-radius: 999px;
      padding: .3rem .85rem; font-size: .72rem; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase; margin-bottom: 1rem;
    }
    .faq-title {
      font-family: var(--font-display, 'Poppins'); font-weight: 700;
      font-size: clamp(1.8rem, 4vw, 2.6rem); color: #0D1F3C; margin: 0 0 .75rem;
      letter-spacing: -0.02em;
    }
    .faq-subtitle { font-size: 1.02rem; line-height: 1.7; color: #475569; margin: 0; }
    .faq-subtitle a { color: #0047CC; font-weight: 600; text-decoration: none; }
    .faq-subtitle a:hover { text-decoration: underline; }

    .faq-body { max-width: 820px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
    .faq-state { text-align: center; color: #64748B; padding: 3rem 0; }

    .faq-group { margin-bottom: 2.5rem; }
    .faq-group__title {
      font-family: var(--font-display, 'Poppins'); font-weight: 600;
      font-size: 1.15rem; color: #0D1F3C; margin: 0 0 1rem;
    }

    .faq-cta {
      margin-top: 3rem; text-align: center; background: #F8FAFC;
      border: 1px solid #E2E8F0; border-radius: 1.1rem; padding: 2.25rem 1.5rem;
    }
    .faq-cta h3 {
      font-family: var(--font-display, 'Poppins'); font-weight: 600;
      font-size: 1.25rem; color: #0D1F3C; margin: 0 0 .4rem;
    }
    .faq-cta p { color: #64748B; margin: 0 0 1.25rem; }
    .faq-cta__btn {
      display: inline-block; background: linear-gradient(135deg, #0047CC, #003399);
      color: #fff; font-weight: 600; text-decoration: none;
      padding: .7rem 1.6rem; border-radius: .75rem;
      box-shadow: 0 4px 12px rgba(0,71,204,.20); transition: transform .16s, box-shadow .16s;
    }
    .faq-cta__btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,71,204,.35); }

    @media (max-width: 640px) {
      .faq-hero { padding: 2.5rem 1.15rem 2rem; }
      .faq-body { padding: 1.75rem 1.15rem 3rem; }
    }
  `],
})
export class FaqComponent implements OnInit {
  loading = signal(true);
  faqs = signal<Faq[]>([]);

  groups = computed<FaqGroup[]>(() => {
    const byCat = new Map<string, Faq[]>();
    for (const f of this.faqs()) {
      const list = byCat.get(f.category) ?? [];
      list.push(f);
      byCat.set(f.category, list);
    }
    return Array.from(byCat.entries()).map(([key, items]) => ({
      key,
      label: CATEGORY_LABELS[key] ?? this.titleize(key),
      items,
    }));
  });

  private seo = inject(SeoService);

  constructor(private faqApi: FaqApiService) {}

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Frequently Asked Questions',
      description:
        'Answers to common questions about booking diagnostic tests, home sample collection, reports, payments and refunds at Sri Health Plus.',
      path: '/faq',
    });
    this.seo.setJsonLd('breadcrumb', buildBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'FAQ', path: '/faq' },
    ]));

    this.faqApi.list().subscribe({
      next: (faqs) => {
        this.faqs.set(faqs);
        this.loading.set(false);
        if (faqs.length) {
          this.seo.setJsonLd('faqpage', buildFaqSchema(faqs.map((f) => ({ question: f.question, answer: f.answer }))));
        }
      },
      error: () => { this.loading.set(false); },
    });
  }

  private titleize(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
