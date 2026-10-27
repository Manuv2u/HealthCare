import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { HealthImageComponent } from '../../shared/components/health-image/health-image.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { SeoService } from '../../core/services/seo.service';
import { buildBreadcrumbSchema } from '../../core/seo/schema.util';
import { ORG_INFO } from '../../core/seo/organization.data';

@Component({
  selector: 'app-home-sample-collection',
  standalone: true,
  imports: [RouterLink, MatIconModule, HealthImageComponent, BreadcrumbComponent],
  template: `
    <!-- ── HERO ─────────────────────────────────────────────────── -->
    <section class="hero">
      <div class="hero-inner">
        <app-breadcrumb [items]="[{ label: 'Home', path: '/' }, { label: 'Home Sample Collection' }]" />
        <div class="hero-eyebrow"><mat-icon>home</mat-icon><span>Home Collection Service</span></div>
        <h1 class="hero-title">Home Sample Collection<br /><em class="hero-accent">across Shivamogga</em></h1>
        <p class="hero-sub">
          Skip the lab queue. A certified phlebotomist reaches your doorstep with
          sterile, single-use kits — usually within 60 minutes of booking — and
          your NABL-certified report lands on WhatsApp the same day.
        </p>
        <div class="hero-actions">
          <a routerLink="/booking" class="btn-primary"><mat-icon>event_available</mat-icon> Schedule Pickup</a>
          <a routerLink="/available-locations" class="btn-ghost">Check Availability In My Area <mat-icon>arrow_forward</mat-icon></a>
        </div>
      </div>
      <div class="hero-media">
        <app-health-image src="assets/photos/home-collection.jpg" [ratioInput]="1.1" [rounded]="true" alt="Phlebotomist collecting a blood sample at a patient's home" />
      </div>
    </section>

    <!-- ── WHY HOME COLLECTION ─────────────────────────────────────── -->
    <section class="why-section">
      <div class="section-inner">
        <div class="section-label">Why Choose Home Collection</div>
        <h2 class="section-title">Lab-accurate testing, without the trip</h2>
        <div class="why-grid">
          @for (f of features; track f.title) {
            <div class="why-card">
              <span class="why-ic"><mat-icon>{{ f.icon }}</mat-icon></span>
              <h3>{{ f.title }}</h3>
              <p>{{ f.desc }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ── HOW IT WORKS ─────────────────────────────────────────────── -->
    <section class="steps-section">
      <div class="section-inner">
        <div class="section-label">How It Works</div>
        <h2 class="section-title">Book in minutes, tested at home</h2>
        <div class="steps-grid">
          @for (s of steps; track s.n) {
            <div class="step-card">
              <span class="step-num">{{ s.n }}</span>
              <mat-icon class="step-ic">{{ s.icon }}</mat-icon>
              <h3>{{ s.title }}</h3>
              <p>{{ s.desc }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ── COVERAGE ─────────────────────────────────────────────────── -->
    <section class="coverage-section">
      <div class="coverage-inner">
        <app-health-image src="assets/photos/home-phlebotomy.jpg" [ratioInput]="1.4" [rounded]="true" alt="Certified phlebotomist with a home collection kit" class="coverage-media" />
        <div>
          <div class="section-label">Service Area</div>
          <h2 class="section-title section-title--sm">Serving Shivamogga &amp; 12+ surrounding districts</h2>
          <p class="coverage-body">
            We're expanding home-collection coverage across Karnataka every month.
            Enter your pin code to confirm same-day slots in your neighbourhood.
          </p>
          <div class="coverage-actions">
            <a routerLink="/available-locations" class="btn-primary">Check My Area <mat-icon>place</mat-icon></a>
            <a routerLink="/lab-locations" class="btn-outline">Find A Lab Instead</a>
          </div>
        </div>
      </div>
    </section>

    <!-- ── TRUST BADGES ─────────────────────────────────────────────── -->
    <section class="trust-section">
      <div class="trust-inner">
        <span class="trust-item"><mat-icon>verified</mat-icon> NABL Accredited</span>
        <span class="trust-item"><mat-icon>workspace_premium</mat-icon> ISO 15189 Certified</span>
        <span class="trust-item"><mat-icon>science</mat-icon> Sterile, Single-Use Kits</span>
        <span class="trust-item"><mat-icon>bolt</mat-icon> 60-Minute Average Arrival</span>
      </div>
    </section>

    <!-- ── CTA STRIP ─────────────────────────────────────────────────── -->
    <section class="cta-strip">
      <div class="cta-strip-inner">
        <div class="cta-text">
          <h2>Ready for your sample to be collected at home?</h2>
          <p>Free home collection on most tests and packages. Results in 6–8 hours.</p>
        </div>
        <div class="cta-actions">
          <a routerLink="/tests" class="btn-primary btn-primary--lg"><mat-icon>science</mat-icon> Browse Tests</a>
          <a routerLink="/packages" class="btn-outline-white">View Health Packages</a>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #F8F9FF; color: #0F172A; }

    .hero { display: flex; align-items: center; gap: 56px; max-width: 1200px; margin: 0 auto; padding: 24px 24px 56px; }
    .hero-inner { flex: 1; max-width: 560px; }
    .hero-media { flex: 1; max-width: 420px; }
    .hero-eyebrow { display: inline-flex; align-items: center; gap: 6px; background: #E6F8F7; border: 1px solid rgba(0,180,174,.28); border-radius: 999px; padding: 5px 14px 5px 8px; color: #007A76; font-size: .78rem; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; margin: 10px 0 20px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #009994; } }
    .hero-title { font-family: 'Poppins','Inter',system-ui,sans-serif; font-size: clamp(1.9rem,4vw,2.6rem); font-weight: 700; line-height: 1.18; color: #0D1F3C; text-wrap: balance; margin: 0 0 18px; }
    .hero-accent { font-style: normal; color: #0047CC; }
    .hero-sub { font-size: 1rem; line-height: 1.7; color: #64748B; margin: 0 0 32px; max-width: 480px; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; }

    .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg,#0047CC 0%,#003399 100%); color: #fff; border-radius: 12px; padding: 12px 24px; font-size: .92rem; font-weight: 700; text-decoration: none; transition: transform .18s, box-shadow .18s; box-shadow: 0 4px 12px rgba(0,71,204,.2);
      mat-icon { font-size: 18px; width: 18px; height: 18px; } }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,71,204,.35); }
    .btn-primary--lg { padding: 13px 28px; font-size: .95rem; }

    .btn-ghost { display: inline-flex; align-items: center; gap: 6px; background: #fff; color: #0047CC; border: 1.5px solid #C7D8F7; border-radius: 12px; padding: 12px 20px; font-size: .92rem; font-weight: 600; text-decoration: none; transition: background .18s, border-color .18s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; transition: transform .18s; } }
    .btn-ghost:hover { background: #EEF4FF; border-color: #0047CC; mat-icon { transform: translateX(3px); } }

    .btn-outline { display: inline-flex; align-items: center; gap: 6px; background: #fff; color: #0F172A; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 12px 20px; font-size: .92rem; font-weight: 600; text-decoration: none; transition: border-color .18s; }
    .btn-outline:hover { border-color: #0047CC; color: #0047CC; }

    .btn-outline-white { display: inline-flex; align-items: center; background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,.3); border-radius: 12px; padding: 13px 24px; font-size: .92rem; font-weight: 600; text-decoration: none; transition: border-color .18s, background .18s; }
    .btn-outline-white:hover { border-color: rgba(255,255,255,.6); background: rgba(255,255,255,.07); }

    @media (max-width: 780px) { .hero { flex-direction: column; padding: 20px 20px 40px; } .hero-inner, .hero-media { max-width: 100%; } }

    .section-inner { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
    .section-label { display: inline-block; font-size: .72rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #0047CC; background: #EEF4FF; border-radius: 999px; padding: 4px 12px; margin-bottom: 12px; }
    .section-title { font-size: clamp(1.5rem,3vw,2rem); font-weight: 800; color: #0F172A; text-wrap: balance; margin: 0 0 40px; line-height: 1.25; }
    .section-title--sm { font-size: clamp(1.25rem,2.5vw,1.6rem); margin-bottom: 16px; }

    .why-section { padding: 56px 0; }
    .why-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(230px,1fr)); gap: 20px; }
    .why-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; box-shadow: 0 2px 12px rgba(0,71,204,.06); transition: transform .2s, box-shadow .2s; }
    .why-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(0,71,204,.13); }
    .why-ic { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: #E6F8F7; margin-bottom: 14px;
      mat-icon { color: #009994; } }
    .why-card h3 { font-size: 1rem; font-weight: 700; margin: 0 0 6px; color: #0F172A; }
    .why-card p { font-size: .88rem; line-height: 1.65; color: #475569; margin: 0; }

    .steps-section { padding: 56px 0; background: #fff; }
    .steps-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr)); gap: 20px; }
    .step-card { position: relative; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; }
    .step-num { position: absolute; top: 16px; right: 20px; font-size: 1.6rem; font-weight: 900; color: #E2E8F0; }
    .step-ic { color: #0047CC; margin-bottom: 10px; }
    .step-card h3 { font-size: .98rem; font-weight: 700; margin: 0 0 6px; color: #0F172A; }
    .step-card p { font-size: .86rem; line-height: 1.6; color: #475569; margin: 0; }

    .coverage-section { padding: 64px 24px; }
    .coverage-inner { max-width: 1040px; margin: 0 auto; display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 48px; align-items: center; }
    .coverage-media { border-radius: 20px; overflow: hidden; }
    .coverage-body { font-size: .95rem; line-height: 1.75; color: #475569; margin: 0 0 24px; }
    .coverage-actions { display: flex; flex-wrap: wrap; gap: 12px; }
    @media (max-width: 860px) { .coverage-inner { grid-template-columns: 1fr; } }

    .trust-section { background: linear-gradient(100deg,#003399 0%,#0047CC 45%,#003399 100%); padding: 32px 24px; }
    .trust-inner { max-width: 1040px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: center; gap: 28px; }
    .trust-item { display: flex; align-items: center; gap: 8px; color: #fff; font-size: .88rem; font-weight: 600;
      mat-icon { font-size: 20px; width: 20px; height: 20px; } }

    .cta-strip { background: #0F172A; padding: 56px 24px; }
    .cta-strip-inner { max-width: 900px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap; }
    .cta-text h2 { font-size: clamp(1.25rem,2.5vw,1.6rem); font-weight: 800; color: #fff; margin: 0 0 6px; }
    .cta-text p { font-size: .9rem; color: #94A3B8; margin: 0; }
    .cta-actions { display: flex; gap: 12px; flex-wrap: wrap; }
  `],
})
export class HomeSampleCollectionComponent implements OnInit {
  private readonly seo = inject(SeoService);

  features = [
    { icon: 'home', title: 'At Your Doorstep', desc: 'Sample pickup from your living room, bedroom, or office — no travel required.' },
    { icon: 'schedule', title: 'Your Schedule', desc: 'Morning, afternoon, or evening slots, 365 days a year, including Sundays.' },
    { icon: 'science', title: 'Sterile Collection', desc: 'Single-use sterile kits and trained phlebotomists — zero contamination risk.' },
    { icon: 'notifications_active', title: 'Live Updates', desc: 'Real-time SMS + WhatsApp updates from collection through report delivery.' },
  ];

  steps = [
    { n: '01', icon: 'search', title: 'Choose Your Test', desc: 'Pick a test or health package, or tell us your symptoms and we’ll recommend one.' },
    { n: '02', icon: 'calendar_today', title: 'Book & Schedule', desc: 'Select a convenient home-collection time slot in a few taps.' },
    { n: '03', icon: 'water_drop', title: 'Sample Collected At Home', desc: 'A certified phlebotomist visits your address with sterile, disposable equipment.' },
    { n: '04', icon: 'description', title: 'Get Your Report', desc: 'NABL-certified digital reports delivered within 6–8 hours via WhatsApp, email, or app.' },
  ];

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Home Sample Collection in Shivamogga',
      description:
        'Book certified, doorstep blood and sample collection across Shivamogga and 12+ districts. Sterile kits, live tracking, and NABL-certified reports within 6-8 hours.',
      path: '/home-sample-collection',
      image: 'assets/photos/home-collection.jpg',
    });
    this.seo.setJsonLd('breadcrumb', buildBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Home Sample Collection', path: '/home-sample-collection' },
    ]));
    this.seo.setJsonLd('service', {
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: 'Home Sample Collection',
      provider: { '@type': 'MedicalOrganization', name: ORG_INFO.name, url: ORG_INFO.url },
      areaServed: { '@type': 'City', name: 'Shivamogga' },
      description: 'Doorstep blood and diagnostic sample collection by certified phlebotomists.',
    });
  }
}
