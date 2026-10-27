import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { HealthImageComponent } from '../../shared/components/health-image/health-image.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { SeoService } from '../../core/services/seo.service';
import { buildBreadcrumbSchema } from '../../core/seo/schema.util';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, MatIconModule, HealthImageComponent, BreadcrumbComponent],
  template: `
    <!-- ── HERO ─────────────────────────────────────────────────── -->
    <section class="hero">
      <div class="hero-bg-grid"></div>
      <div class="hero-inner">
        <app-breadcrumb [items]="[{ label: 'Home', path: '/' }, { label: 'About Us' }]" />
        <div class="hero-eyebrow">
          <mat-icon class="eyebrow-icon">local_hospital</mat-icon>
          <span>Trusted Diagnostics Since 2010</span>
        </div>
        <h1 class="hero-title">
          Precision care for every<br>
          <em class="hero-accent">family in Karnataka</em>
        </h1>
        <p class="hero-sub">
          Sri Health Plus — Diagnostic Laboratory &amp; Health Care combines state-of-the-art
          technology with expert pathologists — delivering accurate, timely
          results you can rely on, right here in Shivamogga.
        </p>
        <div class="hero-actions">
          <a routerLink="/tests" class="btn-primary">
            <mat-icon>science</mat-icon> Explore Tests
          </a>
          <a routerLink="/contact" class="btn-ghost">
            Get in Touch <mat-icon>arrow_forward</mat-icon>
          </a>
        </div>
      </div>
      <div class="hero-deco" aria-hidden="true">
        <div class="deco-ring deco-ring--lg"></div>
        <div class="deco-ring deco-ring--sm"></div>
        <div class="deco-badge">
          <mat-icon>verified</mat-icon>
          <span>NABL Accredited</span>
        </div>
      </div>
    </section>

    <!-- ── WHO / VISION / MISSION ─────────────────────────────────── -->
    <section class="values-section">
      <div class="section-inner">
        <div class="section-label">Our Foundation</div>
        <h2 class="section-title">Built on trust, driven by accuracy</h2>
        <div class="values-grid">

          <div class="value-card value-card--who">
            <app-health-image class="vc-media" src="assets/photos/about-who.jpg" [ratioInput]="1.6" [rounded]="false" alt="Our lab technicians and expert team" />
            <div class="vc-body">
              <h3>Who We Are</h3>
              <p>
                A trusted diagnostic centre serving the Shivamogga region for
                over a decade. We combine advanced instrumentation with expert
                pathologists to deliver results physicians and patients both
                depend on.
              </p>
              <div class="vc-foot">
                <span class="vc-tag">Shivamogga, Karnataka</span>
              </div>
            </div>
          </div>

          <div class="value-card value-card--vision">
            <app-health-image class="vc-media" src="assets/photos/about-vision.jpg" [ratioInput]="1.6" [rounded]="false" alt="Quality healthcare accessible to every family" />
            <div class="vc-body">
              <h3>Our Vision</h3>
              <p>
                To be the most trusted diagnostic partner across Karnataka —
                making quality healthcare accessible to every family through
                innovation, integrity, and relentless excellence.
              </p>
              <div class="vc-foot">
                <span class="vc-tag">12+ Districts</span>
              </div>
            </div>
          </div>

          <div class="value-card value-card--mission">
            <app-health-image class="vc-media" src="assets/photos/about-mission.jpg" [ratioInput]="1.6" [rounded]="false" alt="Doctors and patients making informed health decisions" />
            <div class="vc-body">
              <h3>Our Mission</h3>
              <p>
                Deliver accurate diagnostic results with speed and care —
                empowering patients and physicians alike to make confident,
                informed health decisions every single day.
              </p>
              <div class="vc-foot">
                <span class="vc-tag">24 / 7 Support</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ── STATS BAND ─────────────────────────────────────────────── -->
    <section class="stats-band" aria-label="Key statistics">
      <div class="stats-band-inner">
        <div class="stat-item">
          <span class="stat-num">6K<span class="stat-plus">+</span></span>
          <span class="stat-label">Tests Conducted</span>
        </div>
        <div class="stat-divider" aria-hidden="true"></div>
        <div class="stat-item">
          <span class="stat-num">12<span class="stat-plus">+</span></span>
          <span class="stat-label">Districts Served</span>
        </div>
        <div class="stat-divider" aria-hidden="true"></div>
        <div class="stat-item">
          <span class="stat-num">99.9<span class="stat-plus">%</span></span>
          <span class="stat-label">Accuracy Rate</span>
        </div>
        <div class="stat-divider" aria-hidden="true"></div>
        <div class="stat-item">
          <span class="stat-num">24<span class="stat-plus">/7</span></span>
          <span class="stat-label">Always Available</span>
        </div>
      </div>
    </section>

    <!-- ── CERTIFICATIONS ─────────────────────────────────────────── -->
    <section class="certs-section">
      <div class="section-inner certs-inner">
        <div class="certs-left">
          <div class="section-label">Accreditations</div>
          <h2 class="section-title section-title--sm">
            Certified to the highest standards
          </h2>
          <p class="certs-body">
            Every result we deliver is backed by internationally recognised
            quality certifications. Our accreditations are not just badges —
            they represent rigorous, ongoing audits of our processes,
            equipment, and team competency.
          </p>
        </div>
        <div class="certs-right">
          <div class="cert-card">
            <div class="cert-icon-wrap">
              <mat-icon>verified</mat-icon>
            </div>
            <div class="cert-info">
              <h4>NABL Accredited</h4>
              <p>National Accreditation Board for Testing and Calibration
                 Laboratories — the gold standard for Indian diagnostics.</p>
            </div>
          </div>
          <div class="cert-card">
            <div class="cert-icon-wrap cert-icon-wrap--saffron">
              <mat-icon>workspace_premium</mat-icon>
            </div>
            <div class="cert-info">
              <h4>ISO 9001 : 2015</h4>
              <p>International Quality Management System certification covering
                 every step from sample collection to result delivery.</p>
            </div>
          </div>
          <div class="cert-card">
            <div class="cert-icon-wrap">
              <mat-icon>military_tech</mat-icon>
            </div>
            <div class="cert-info">
              <h4>CAP Certified</h4>
              <p>College of American Pathologists accreditation — recognised
                 globally as the benchmark for laboratory excellence.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── HOW WE SERVE ───────────────────────────────────────────── -->
    <section class="serve-section" aria-labelledby="serve-heading">
      <div class="section-inner">
        <div class="section-label">How we serve you</div>
        <h2 id="serve-heading" class="section-title">From doorstep to diagnosis</h2>
        <p class="serve-sub">End-to-end diagnostic care — designed around your comfort and backed by an accredited lab.</p>
        <div class="serve-grid">
          <article class="serve-card">
            <app-health-image class="serve-illus" src="assets/photos/about-serve-home.jpg" [ratioInput]="1.5" [rounded]="false" alt="Sterile single-use blood collection kits" />
            <h3>Home Sample Collection</h3>
            <p>Certified phlebotomists collect your sample at home with sterile, single-use kits.</p>
            <a routerLink="/home-sample-collection" class="serve-link">Learn more <mat-icon>arrow_forward</mat-icon></a>
          </article>
          <article class="serve-card">
            <app-health-image class="serve-illus" src="assets/photos/about-serve-lab.jpg" [ratioInput]="1.5" [rounded]="false" alt="Microscope pathology analysis at the laboratory" />
            <h3>Advanced Diagnostics</h3>
            <p>Samples are processed on modern analysers at our NABL-accredited laboratory.</p>
          </article>
          <article class="serve-card">
            <app-health-image class="serve-illus" src="assets/photos/about-serve-reports.jpg" [ratioInput]="1.5" [rounded]="false" alt="Doctor reviewing a diagnostic report" />
            <h3>Same-Day Digital Reports</h3>
            <p>Accurate, doctor-reviewed reports delivered to your phone within hours.</p>
          </article>
        </div>
      </div>
    </section>

    <!-- ── CTA STRIP ──────────────────────────────────────────────── -->
    <section class="cta-strip">
      <div class="cta-strip-inner">
        <div class="cta-text">
          <h2>Ready to book your test?</h2>
          <p>Home collection available across Shivamogga. Results in 24 hrs.</p>
        </div>
        <div class="cta-actions">
          <a routerLink="/tests" class="btn-primary btn-primary--lg">
            <mat-icon>science</mat-icon> Book a Test
          </a>
          <a routerLink="/contact" class="btn-outline-white">
            Contact Us
          </a>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #F8F9FF;
      color: #0F172A;
    }

    /* ── HERO ─────────────────────────────────────────────────────── */
    .hero {
      position: relative;
      background:
        linear-gradient(180deg, rgba(255,255,255,0) 55%, rgba(255,255,255,.85) 100%),
        linear-gradient(90deg, #EEF4FF 0%, rgba(238,244,255,.96) 42%, rgba(238,244,255,.66) 66%, rgba(238,244,255,.08) 100%),
        url('/assets/photos/about-who.jpg') right center / cover no-repeat;
      min-height: 380px;
      padding: 64px 24px 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 96px;
      overflow: hidden;
    }

    .hero-bg-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(0, 71, 204, .045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 71, 204, .045) 1px, transparent 1px);
      background-size: 40px 40px;
      -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
      mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
      pointer-events: none;
    }

    .hero-inner {
      position: relative;
      z-index: 1;
      max-width: 580px;
      flex: 1;
    }

    .hero-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #E6F8F7;
      border: 1px solid rgba(0, 180, 174, .28);
      border-radius: 999px;
      padding: 5px 14px 5px 8px;
      color: #007A76;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    .eyebrow-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #009994;
    }

    .hero-title {
      font-family: 'Poppins', 'Inter', system-ui, sans-serif;
      font-size: clamp(1.9rem, 4vw, 2.6rem);
      font-weight: 700;
      line-height: 1.18;
      color: #0D1F3C;
      text-wrap: balance;
      margin: 0 0 18px;
    }

    .hero-accent {
      font-style: normal;
      color: #0047CC;
    }

    .hero-sub {
      font-size: 1rem;
      line-height: 1.7;
      color: #64748B;
      margin: 0 0 32px;
      max-width: 480px;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #0047CC 0%, #003399 100%);
      color: #fff;
      border-radius: 12px;
      padding: 12px 24px;
      font-size: 0.92rem;
      font-weight: 700;
      text-decoration: none;
      transition: transform 0.18s, box-shadow 0.18s;
      box-shadow: 0 4px 12px rgba(0, 71, 204,.2);

      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(0, 71, 204,.35);
    }

    .btn-ghost {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #fff;
      color: #0047CC;
      border: 1.5px solid #C7D8F7;
      border-radius: 12px;
      padding: 12px 20px;
      font-size: 0.92rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.18s, border-color 0.18s;

      mat-icon { font-size: 16px; width: 16px; height: 16px; transition: transform 0.18s; }
    }
    .btn-ghost:hover {
      background: #EEF4FF;
      border-color: #0047CC;
      mat-icon { transform: translateX(3px); }
    }

    /* hero decoration */
    .hero-deco {
      position: relative;
      z-index: 1;
      flex-shrink: 0;
      width: 220px;
      height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .deco-ring {
      position: absolute;
      border-radius: 50%;
      border: 2px solid rgba(0, 71, 204, .1);
    }
    .deco-ring--lg { width: 200px; height: 200px; }
    .deco-ring--sm { width: 130px; height: 130px; border-color: rgba(0, 180, 174, .22); }

    .deco-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      background: #fff;
      border: 1.5px solid #DCE6F7;
      border-radius: 16px;
      padding: 18px 22px;
      color: #0D1F3C;
      text-align: center;
      box-shadow: 0 10px 30px rgba(13, 31, 60, .08);

      mat-icon { font-size: 2rem; width: 2rem; height: 2rem; color: #0047CC; }
      span { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    }

    @media (max-width: 660px) {
      .hero { padding: 64px 20px 56px; flex-direction: column; }
      .hero-deco { display: none; }
    }

    /* ── SHARED SECTION UTILS ──────────────────────────────────────── */
    .section-inner {
      max-width: 1040px;
      margin: 0 auto;
      padding: 0 24px;
    }

    .section-label {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #0047CC;
      background: #EEF4FF;
      border-radius: 999px;
      padding: 4px 12px;
      margin-bottom: 12px;
    }

    .section-title {
      font-size: clamp(1.5rem, 3vw, 2rem);
      font-weight: 800;
      color: #0F172A;
      text-wrap: balance;
      margin: 0 0 40px;
      line-height: 1.25;
    }
    .section-title--sm {
      font-size: clamp(1.25rem, 2.5vw, 1.6rem);
      margin-bottom: 16px;
    }

    /* ── VALUES GRID ───────────────────────────────────────────────── */
    .values-section {
      padding: 72px 0 64px;
    }

    .values-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: 20px;
    }

    .value-card {
      background: #fff;
      border-radius: 16px;
      border: 1px solid #E2E8F0;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 12px rgba(0, 71, 204,.06);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .value-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 28px rgba(0, 71, 204,.13);
    }

    .vc-media { width: 100%; }
    .vc-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 24px 28px 28px;
      flex: 1;
    }

    .value-card h3 {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
    }

    .value-card p {
      font-size: 0.9rem;
      line-height: 1.72;
      color: #475569;
      margin: 0;
      flex: 1;
    }

    .vc-foot { margin-top: 4px; }
    .vc-tag {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: #94A3B8;
      background: #F8F9FF;
      border: 1px solid #E2E8F0;
      border-radius: 999px;
      padding: 3px 10px;
    }

    /* ── STATS BAND ────────────────────────────────────────────────── */
    .stats-band {
      background: linear-gradient(100deg, #003399 0%, #0047CC 45%, #003399 100%);
      padding: 48px 24px;
      position: relative;
      overflow: hidden;
    }
    .stats-band::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      pointer-events: none;
    }

    .stats-band-inner {
      position: relative;
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: nowrap;
      gap: 0;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 0 clamp(16px, 3vw, 48px);
    }

    .stat-num {
      font-size: clamp(2rem, 4vw, 2.75rem);
      font-weight: 900;
      color: #fff;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .stat-plus {
      font-size: 0.6em;
      font-weight: 700;
      vertical-align: super;
      opacity: 0.85;
    }

    .stat-label {
      font-size: 0.76rem;
      font-weight: 600;
      color: rgba(255,255,255,.75);
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .stat-divider {
      width: 1px;
      height: 48px;
      background: rgba(255,255,255,.25);
      flex-shrink: 0;
    }

    @media (max-width: 900px) {
      .stats-band-inner {
        display: grid;
        grid-template-columns: 1fr 1fr;
        row-gap: 28px;
        column-gap: 8px;
      }
      .stat-item { padding: 0 12px; }
      .stat-divider { display: none; }
    }

    /* ── CERTIFICATIONS ────────────────────────────────────────────── */
    .certs-section {
      padding: 72px 0 64px;
    }

    .certs-inner {
      display: grid;
      grid-template-columns: 1fr 1.4fr;
      gap: 56px;
      align-items: start;
    }

    .certs-body {
      font-size: 0.92rem;
      line-height: 1.75;
      color: #475569;
      margin: 0;
    }

    .certs-right {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .cert-card {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      background: #fff;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
      padding: 20px;
      box-shadow: 0 1px 6px rgba(0,0,0,.04);
      transition: transform 0.18s, box-shadow 0.18s;
    }
    .cert-card:hover {
      transform: translateX(4px);
      box-shadow: 0 4px 16px rgba(0, 71, 204,.1);
    }

    .cert-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #EEF4FF;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #0047CC; }
    }
    .cert-icon-wrap--saffron {
      background: #EEF4FF;
      mat-icon { color: #003399; }
    }

    .cert-info h4 {
      font-size: 0.95rem;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 4px;
    }
    .cert-info p {
      font-size: 0.84rem;
      line-height: 1.6;
      color: #475569;
      margin: 0;
    }

    @media (max-width: 768px) {
      .certs-inner { grid-template-columns: 1fr; gap: 36px; }
    }

    /* ── CTA STRIP ──────────────────────────────────────────────────── */
    .cta-strip {
      background: #0F172A;
      padding: 56px 24px;
    }

    .cta-strip-inner {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 32px;
      flex-wrap: wrap;
    }

    .cta-text h2 {
      font-size: clamp(1.25rem, 2.5vw, 1.6rem);
      font-weight: 800;
      color: #fff;
      margin: 0 0 6px;
    }
    .cta-text p {
      font-size: 0.9rem;
      color: #94A3B8;
      margin: 0;
    }

    .cta-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .btn-primary--lg {
      padding: 13px 28px;
      font-size: 0.95rem;
    }

    .btn-outline-white {
      display: inline-flex;
      align-items: center;
      background: transparent;
      color: #fff;
      border: 1.5px solid rgba(255,255,255,.3);
      border-radius: 12px;
      padding: 13px 24px;
      font-size: 0.92rem;
      font-weight: 600;
      text-decoration: none;
      transition: border-color 0.18s, background 0.18s;
    }
    .btn-outline-white:hover {
      border-color: rgba(255,255,255,.6);
      background: rgba(255,255,255,.07);
    }

    /* ── HOW WE SERVE ─────────────────────────────────────────────── */
    .serve-section {
      padding: 72px 24px;
      background: #fff;
    }
    .serve-sub {
      font-size: 1rem;
      line-height: 1.6;
      color: #475569;
      max-width: 560px;
      margin: 10px 0 40px;
    }
    .serve-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    .serve-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 20px;
      padding: 28px 24px;
      text-align: center;
      transition: box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease;
    }
    .serve-card:hover {
      box-shadow: 0 14px 34px rgba(0, 71, 204, 0.13);
      border-color: #D9E5FF;
      transform: translateY(-4px);
    }
    .serve-illus {
      width: 190px;
      max-width: 72%;
      margin: 0 auto 14px;
    }
    .serve-card h3 {
      font-size: 1.1rem;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 8px;
    }
    .serve-card p {
      font-size: 0.9rem;
      line-height: 1.6;
      color: #475569;
      margin: 0;
    }
    .serve-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 12px;
      font-size: 0.86rem;
      font-weight: 600;
      color: #0047CC;
      text-decoration: none;

      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .serve-link:hover { text-decoration: underline; }
    @media (max-width: 860px) {
      .serve-grid { grid-template-columns: 1fr; }
      .serve-section { padding: 48px 20px; }
    }
  `],
})
export class AboutComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setPage({
      title: 'About Us',
      description:
        'Sri Health Plus is a NABL-accredited, ISO 15189-certified diagnostic laboratory serving Shivamogga and 12+ districts across Karnataka since 2010.',
      path: '/about',
      image: 'assets/photos/about-who.jpg',
    });
    this.seo.setJsonLd('breadcrumb', buildBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'About Us', path: '/about' },
    ]));
  }
}
