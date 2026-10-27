import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PackageApiService } from '../../core/api/services/package-api.service';
import { BannerApiService } from '../../core/api/services/banner-api.service';
import { Package, Banner } from '../../core/api/api.types';
import { PrescriptionModalService } from '../../shared/components/upload-prescription-modal/prescription-modal.service';
import { HeroCarouselComponent } from '../../shared/components/hero-carousel/hero-carousel.component';
import { CallbackRequestModalComponent } from '../../shared/components/callback-request-modal/callback-request-modal.component';
import { HEALTH_ARTICLES, articleImg } from '../health-tips/health-articles.data';
import { SeoService } from '../../core/services/seo.service';

interface Review {
  name: string;
  meta: string;
  initials: string;
  rating: number;
  text: string;
  test: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, HeroCarouselComponent, CallbackRequestModalComponent],
  template: `
    <!-- ══════════════ HERO ══════════════ -->
    <section class="hero">
      <span class="hero-orb hero-orb--a" aria-hidden="true"></span>
      <span class="hero-orb hero-orb--b" aria-hidden="true"></span>
      <div class="shell hero-grid">
        <div class="hero-text">
          <div class="badge badge--brand">
            <span class="pulse-dot" aria-hidden="true"></span>
            NABL Accredited Laboratory — 6+ Years of Trust
          </div>
          <h1 class="hero-title">
            Your Health,<br />
            <span class="grad-text">Diagnosed Right</span>
          </h1>
          <p class="hero-sub">
            Book diagnostic tests from the comfort of your home. NABL-certified lab,
            same-day reports, expert pathologists — healthcare that comes to you.
          </p>

          <form class="hero-search" (ngSubmit)="onSearch()">
            <mat-icon class="hero-search__icon">search</mat-icon>
            <input
              type="text"
              [(ngModel)]="query"
              name="q"
              placeholder="Search tests, packages, or health checkups..."
              aria-label="Search tests"
            />
            <button type="submit" class="btn-primary btn-primary--sm">Search</button>
          </form>

          <div class="hero-chips">
            @for (chip of quickTests; track chip) {
              <a routerLink="/tests" [queryParams]="{ q: chip }" class="chip">{{ chip }}</a>
            }
          </div>

          <div class="hero-trust">
            <div class="trust-item">
              <mat-icon class="trust-star">star</mat-icon>
              <div><div class="trust-val">4.9/5</div><div class="trust-lbl">Google Rating</div></div>
            </div>
            <div class="trust-item">
              <mat-icon class="trust-ic">verified</mat-icon>
              <div><div class="trust-val">NABL</div><div class="trust-lbl">Accredited</div></div>
            </div>
            <div class="trust-item">
              <mat-icon class="trust-ic">bolt</mat-icon>
              <div><div class="trust-val">Same Day</div><div class="trust-lbl">Reports (12–48h)</div></div>
            </div>
          </div>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <div class="hero-photo">
            <img src="assets/photos/home-hero.jpg" alt="" loading="eager" />
          </div>
          <div class="float-card float-card--tl">
            <span class="fc-icon fc-icon--blue"><mat-icon>home</mat-icon></span>
            <div><div class="fc-title">Home Collection</div><div class="fc-sub">Available 7 AM – 9 PM</div></div>
          </div>
          <div class="float-card float-card--bl">
            <span class="fc-icon fc-icon--teal"><mat-icon>description</mat-icon></span>
            <div><div class="fc-title">Reports Ready</div><div class="fc-sub">Digital delivery in 6 hrs</div></div>
          </div>
          <div class="float-card float-card--tr">
            <span class="fc-icon fc-icon--gold"><mat-icon>groups</mat-icon></span>
            <div><div class="fc-title">3500+</div><div class="fc-sub">Happy Patients</div></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════ STATS STRIP ══════════════ -->
    <section class="stats">
      <div class="shell stats-grid">
        @for (s of stats; track s.label) {
          <div class="stat">
            <div class="stat-num">{{ s.display() }}{{ s.suffix }}</div>
            <div class="stat-lbl">{{ s.label }}</div>
          </div>
        }
      </div>
    </section>

    <!-- ══════════════ WHY SRI HEALTH PLUS ══════════════ -->
    <section class="section section--white">
      <div class="shell why-grid">
        <div class="why-media">
          <div class="why-photo"><img src="assets/photos/home-diagnostics.jpg" alt="Lab technician running diagnostics" loading="lazy" /></div>
          <div class="why-badge">
            <span class="fc-icon fc-icon--brand"><mat-icon>workspace_premium</mat-icon></span>
            <div><div class="fc-title">ISO 15189:2022</div><div class="fc-sub">Quality Management Certified</div></div>
          </div>
        </div>
        <div>
          <div class="badge badge--teal">Why Choose Sri Health Plus</div>
          <h2 class="h2">Healthcare Built on<br /><span class="brand">Trust &amp; Precision</span></h2>
          <p class="lead">We combine clinical excellence with digital convenience so every patient gets accurate results, fast delivery, and genuine care.</p>
          <div class="feature-grid">
            @for (f of features; track f.title) {
              <div class="feature-card card-hover">
                <span class="feature-ic" [style.background]="f.bg" [style.color]="f.color"><mat-icon>{{ f.icon }}</mat-icon></span>
                <div class="feature-title">{{ f.title }}</div>
                <div class="feature-desc">{{ f.desc }}</div>
              </div>
            }
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════ HERO BANNER CAROUSEL ══════════════ -->
    @if (banners().length) {
      <section class="banner-carousel-section">
        <app-hero-carousel [banners]="banners()" [interval]="2000" />
      </section>
    }

    <!-- ══════════════ POPULAR TESTS ══════════════ -->
    <section class="section section--muted">
      <div class="shell">
        <div class="section-head">
          <div class="badge badge--brand">Most Booked Tests</div>
          <h2 class="h2">Popular Diagnostic Tests</h2>
          <p class="lead lead--center">Trusted by 3500+ patients — precise, fast, and delivered to your inbox.</p>
        </div>
        <div class="tests-grid">
          @for (t of popularTests; track t.name) {
            <a routerLink="/tests" [queryParams]="{ q: t.name }" class="test-card card-hover">
              <div class="test-card__media" [style.background]="t.grad">
                <mat-icon>{{ t.icon }}</mat-icon>
                <span class="tag" [style.background]="t.tagBg" [style.color]="t.tagColor">{{ t.tag }}</span>
              </div>
              <div class="test-card__body">
                <div class="test-card__name">{{ t.name }}</div>
                <div class="test-card__short">{{ t.short }}</div>
                <p class="test-card__desc">{{ t.desc }}</p>
                <div class="test-card__foot">
                  <div><span class="price">₹{{ t.price }}</span><span class="mrp">₹{{ t.mrp }}</span></div>
                  <span class="btn-primary btn-primary--xs book-btn">Book Now</span>
                </div>
              </div>
            </a>
          }
        </div>
        <div class="center-cta">
          <a routerLink="/tests" class="btn-outline">Browse All Tests <mat-icon>arrow_forward</mat-icon></a>
        </div>
      </div>
    </section>

    <!-- ══════════════ FEATURED PACKAGES ══════════════ -->
    <section class="section section--white">
      <div class="shell">
        <div class="section-head">
          <div class="badge badge--teal">Health Packages</div>
          <h2 class="h2">Curated Health Packages</h2>
          <p class="lead lead--center">Comprehensive bundles designed by expert pathologists for every life stage.</p>
        </div>
        <div class="pkg-grid">
          @if (pkgLoading()) {
            @for (i of [1,2,3,4]; track i) { <div class="pkg-card skeleton" style="height:340px"></div> }
          } @else {
            @for (pkg of displayPackages(); track pkg.id) {
              <div class="pkg-card card-hover" role="button" tabindex="0" (click)="viewPackageDetails(pkg)" (keydown.enter)="viewPackageDetails(pkg)">
                <div class="pkg-card__head" [style.background]="pkg.grad">
                  <span class="badge badge--glass">{{ pkg.badge }}</span>
                  <div>
                    <div class="pkg-card__name">{{ pkg.name }}</div>
                    <div class="pkg-card__sub">{{ pkg.subtitle }}</div>
                  </div>
                </div>
                <div class="pkg-card__body">
                  <div class="pkg-includes">
                    @for (inc of pkg.includes; track inc) {
                      <div class="pkg-inc"><mat-icon>check</mat-icon>{{ inc }}</div>
                    }
                  </div>
                  <div class="pkg-card__foot">
                    <div>
                      <div class="pkg-tests"><strong>{{ pkg.testCount }}+</strong> Tests included</div>
                      <div class="pkg-price"><span class="price">₹{{ pkg.price }}</span><span class="mrp">₹{{ pkg.mrp }}</span></div>
                    </div>
                    <button type="button" class="btn-primary btn-primary--sm" (click)="bookPackage(pkg, $event)">Book Package</button>
                  </div>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </section>

    <!-- ══════════════ HOW IT WORKS ══════════════ -->
    <section class="section section--muted">
      <div class="shell">
        <div class="section-head">
          <div class="badge badge--brand">Simple Process</div>
          <h2 class="h2">How It Works</h2>
          <p class="lead lead--center">From booking to report delivery — hassle-free healthcare in 4 easy steps.</p>
        </div>
        <div class="steps">
          <div class="steps-line" aria-hidden="true"></div>
          @for (step of steps; track step.n) {
            <div class="step">
              <div class="step-ring" [style.borderColor]="step.color" [style.boxShadow]="'0 8px 32px ' + step.color + '22'">
                <span class="step-n" [style.background]="step.color">{{ step.n }}</span>
                <mat-icon [style.color]="step.color">{{ step.icon }}</mat-icon>
              </div>
              <div class="step-title">{{ step.title }}</div>
              <p class="step-desc">{{ step.desc }}</p>
            </div>
          }
        </div>
        <div class="center-cta center-cta--lg">
          <a routerLink="/booking" class="btn-primary btn-primary--lg">Book Your Test Now <mat-icon>arrow_forward</mat-icon></a>
        </div>
      </div>
    </section>

    <!-- ══════════════ MORE WAYS TO BOOK ══════════════ -->
    <section class="section section--white">
      <div class="shell">
        <div class="section-head">
          <div class="badge badge--brand">Booking Options</div>
          <h2 class="h2">More Ways to Book</h2>
          <p class="lead lead--center">Multiple channels, one commitment — your convenience comes first.</p>
        </div>
        <div class="ways-grid">
          <a href="tel:+917795149207" class="way-card card-hover" style="background:linear-gradient(135deg,#EEF4FF,#DBEAFE)">
            <span class="way-ic" style="color:#0047CC"><mat-icon>call</mat-icon></span>
            <div class="way-title">Call Us</div>
            <p class="way-desc">Talk to our healthcare advisors 7 AM – 10 PM, 7 days a week.</p>
            <span class="way-cta" style="color:#0047CC">Call Now <mat-icon>chevron_right</mat-icon></span>
          </a>
          <a href="https://wa.me/917795149207?text=Hi%2C%20I%27d%20like%20to%20book%20a%20diagnostic%20test." target="_blank" rel="noopener" class="way-card card-hover" style="background:linear-gradient(135deg,#F0FDF4,#DCFCE7)">
            <span class="way-ic" style="color:#16A34A"><mat-icon>chat</mat-icon></span>
            <div class="way-title">WhatsApp</div>
            <p class="way-desc">Send a message and get a booking confirmation in under 2 minutes.</p>
            <span class="way-cta" style="color:#16A34A">Chat Now <mat-icon>chevron_right</mat-icon></span>
          </a>
          <button type="button" class="way-card card-hover" style="background:linear-gradient(135deg,#F5F3FF,#EDE9FE)" (click)="prescriptionModal.open()">
            <span class="way-ic" style="color:#8B5CF6"><mat-icon>upload_file</mat-icon></span>
            <div class="way-title">Upload Prescription</div>
            <p class="way-desc">Share your doctor's prescription — we'll curate the right tests.</p>
            <span class="way-cta" style="color:#8B5CF6">Upload <mat-icon>chevron_right</mat-icon></span>
          </button>
          <button type="button" class="way-card card-hover" style="background:linear-gradient(135deg,#FFFBEB,#FEF3C7)" (click)="callbackOpen.set(true)">
            <span class="way-ic" style="color:#F59E0B"><mat-icon>schedule</mat-icon></span>
            <div class="way-title">Request Callback</div>
            <p class="way-desc">Leave your number and a healthcare advisor will call you within 15 minutes.</p>
            <span class="way-cta" style="color:#F59E0B">Request <mat-icon>chevron_right</mat-icon></span>
          </button>
        </div>
      </div>
    </section>

    <app-callback-request-modal [open]="callbackOpen()" (closed)="callbackOpen.set(false)" />

    <!-- ══════════════ HEALTHCARE COMES TO YOU ══════════════ -->
    <section class="section section--muted">
      <div class="shell comes-grid">
        <div>
          <div class="badge badge--teal">Home Collection Service</div>
          <h2 class="h2">Healthcare Comes<br /><span class="brand">To You</span></h2>
          <p class="lead">No more driving to labs or waiting in queues. Our certified phlebotomist reaches your doorstep within 60 minutes of booking.</p>
          <div class="comes-list">
            @for (c of comesFeatures; track c.title) {
              <div class="comes-item">
                <span class="comes-ic"><mat-icon>{{ c.icon }}</mat-icon></span>
                <div><div class="comes-title">{{ c.title }}</div><div class="comes-desc">{{ c.desc }}</div></div>
              </div>
            }
          </div>
          <div class="comes-cta">
            <a routerLink="/booking" class="btn-primary">Schedule Pickup <mat-icon>arrow_forward</mat-icon></a>
            <a routerLink="/home-sample-collection" class="btn-outline">Learn More</a>
          </div>
        </div>
        <div class="comes-media">
          <div class="comes-photo"><img src="assets/photos/home-collection.jpg" alt="Home healthcare collection service" loading="lazy" /></div>
          <div class="comes-float">
            <span class="comes-float-ic"><mat-icon>bolt</mat-icon></span>
            <div><div class="fc-title">60 Min Arrival</div><div class="fc-sub">Average collection time in your city</div></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════ HEALTH TIPS & INSIGHTS ══════════════ -->
    <section class="section section--white tips">
      <div class="shell">
        <div class="tips-head">
          <div>
            <div class="badge badge--teal">Health Education</div>
            <h2 class="h2">Health Tips &amp; Insights</h2>
            <p class="lead tips-sub">Simple, doctor-backed guidance on common conditions, preventive care and healthy living — because knowing more helps you stay well.</p>
          </div>
          <a routerLink="/blog" class="btn-outline tips-viewall">View All Articles <mat-icon>arrow_forward</mat-icon></a>
        </div>

        <div class="tips-grid">
          @for (a of healthArticles; track a.slug) {
            <a [routerLink]="['/blog', a.slug]" class="tip-card card-hover">
              <div class="tip-card__media">
                <img [src]="articleImg(a.image, 600)" [alt]="a.title" loading="lazy" />
                <span class="tip-cat" [style.background]="a.accentBg" [style.color]="a.accent">
                  <mat-icon>{{ a.icon }}</mat-icon>{{ a.category }}
                </span>
              </div>
              <div class="tip-card__body">
                <div class="tip-meta">
                  <mat-icon>schedule</mat-icon>{{ a.readingTime }}
                </div>
                <h3 class="tip-title">{{ a.title }}</h3>
                <p class="tip-desc">{{ a.excerpt }}</p>
                <span class="tip-more" [style.color]="a.accent">Read More <mat-icon>arrow_forward</mat-icon></span>
              </div>
            </a>
          }
        </div>
      </div>
    </section>

    <!-- ══════════════ TESTIMONIALS ══════════════ -->
    <section class="section testimonials">
      <div class="shell shell--narrow">
        <div class="section-head">
          <div class="badge badge--brand">Patient Stories</div>
          <h2 class="h2">What Our Patients Say</h2>
        </div>
        <div class="review-card">
          <mat-icon class="review-quote" aria-hidden="true">format_quote</mat-icon>
          <div class="review-head">
            <span class="review-avatar">{{ reviews[active()].initials }}</span>
            <div>
              <div class="review-name">{{ reviews[active()].name }}</div>
              <div class="review-meta">{{ reviews[active()].meta }}</div>
              <div class="review-stars">
                @for (s of starsFor(reviews[active()].rating); track $index) { <mat-icon>star</mat-icon> }
              </div>
            </div>
            <span class="badge badge--brand review-verified">✓ Verified Patient</span>
          </div>
          <blockquote class="review-text">"{{ reviews[active()].text }}"</blockquote>
          <div class="review-booked">Booked: {{ reviews[active()].test }}</div>
        </div>
        <div class="review-nav">
          <button type="button" class="review-arrow" (click)="prev()" aria-label="Previous review"><mat-icon>chevron_left</mat-icon></button>
          @for (r of reviews; track $index) {
            <button type="button" class="review-dot" [class.review-dot--active]="$index === active()" (click)="go($index)" [attr.aria-label]="'Review ' + ($index + 1)"></button>
          }
          <button type="button" class="review-arrow" (click)="next()" aria-label="Next review"><mat-icon>chevron_right</mat-icon></button>
        </div>
      </div>
    </section>

    <!-- ══════════════ TRUST / CERTIFICATIONS ══════════════ -->
    <section class="section section--white trust-section">
      <div class="shell">
        <div class="section-head">
          <div class="badge badge--brand">Accreditations &amp; Trust</div>
          <h2 class="h2 h2--sm">Certified. Accredited. Trusted.</h2>
        </div>
        <div class="cert-row">
          @for (c of certs; track c.label) {
            <div class="cert-card">
              <span class="cert-ic"><mat-icon>{{ c.icon }}</mat-icon></span>
              <div><div class="cert-label">{{ c.label }}</div><div class="cert-sub">{{ c.sub }}</div></div>
            </div>
          }
        </div>
      </div>
    </section>

  `,
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private packageApi = inject(PackageApiService);
  private bannerApi = inject(BannerApiService);
  private router = inject(Router);
  private seo = inject(SeoService);
  prescriptionModal = inject(PrescriptionModalService);

  query = '';
  callbackOpen = signal(false);
  banners = signal<Banner[]>([]);
  packages = signal<Package[]>([]);
  pkgLoading = signal(true);
  active = signal(0);
  private rotateTimer?: ReturnType<typeof setInterval>;
  private countRaf?: number;

  quickTests = ['CBC Test', 'Thyroid Panel', 'Diabetes Check', 'Full Body Checkup'];

  healthArticles = HEALTH_ARTICLES;
  articleImg = articleImg;

  stats = [
    { target: 50000, suffix: '+', label: 'Patients Served', display: signal('0') },
    { target: 2000, suffix: '+', label: 'Tests Available', display: signal('0') },
    { target: 6, suffix: '+', label: 'Years of Trust', display: signal('0') },
    { target: 99, suffix: '.8%', label: 'Report Accuracy', display: signal('0') },
  ];

  features = [
    { icon: 'home', color: '#0047CC', bg: '#EEF4FF', title: 'Free Home Collection', desc: 'Certified phlebotomists at your door within 60 minutes.' },
    { icon: 'workspace_premium', color: '#00B4AE', bg: '#E6F9F8', title: 'NABL Accredited', desc: 'Nationally accredited lab meeting the highest quality standards.' },
    { icon: 'bolt', color: '#F59E0B', bg: '#FEF9EC', title: 'Same Day Reports', desc: 'Digital reports delivered within 6–8 hours of sample collection.' },
    { icon: 'biotech', color: '#8B5CF6', bg: '#F3F0FF', title: 'Expert Pathologists', desc: 'MD Pathologists with 10+ years reviewing every report.' },
    { icon: 'description', color: '#10B981', bg: '#ECFDF5', title: 'Digital Reports', desc: 'Secure PDF reports accessible any time via WhatsApp or email.' },
    { icon: 'shield', color: '#EF4444', bg: '#FEF2F2', title: 'Affordable Pricing', desc: 'Up to 40% less than hospitals with zero compromise on quality.' },
  ];

  popularTests = [
    { name: 'Complete Blood Count', short: 'CBC', icon: 'bloodtype', grad: 'linear-gradient(135deg,#EEF4FF,#DBEAFE)', desc: 'Evaluates red cells, white cells, and platelets to detect anemia, infections.', price: 299, mrp: 550, tag: 'Most Popular', tagColor: '#0047CC', tagBg: '#EEF4FF' },
    { name: 'Thyroid Profile', short: 'T3 T4 TSH', icon: 'monitor_heart', grad: 'linear-gradient(135deg,#E6F9F8,#CFFAF8)', desc: 'Complete thyroid panel to detect hypothyroidism, hyperthyroidism & disorders.', price: 449, mrp: 800, tag: 'High Demand', tagColor: '#00B4AE', tagBg: '#E6F9F8' },
    { name: 'Lipid Profile', short: 'Cholesterol', icon: 'favorite', grad: 'linear-gradient(135deg,#FEF2F2,#FEE2E2)', desc: 'Measures LDL, HDL, triglycerides to assess heart disease risk factors.', price: 349, mrp: 650, tag: 'Heart Care', tagColor: '#EF4444', tagBg: '#FEF2F2' },
    { name: 'HbA1c — Diabetes', short: 'Blood Sugar', icon: 'water_drop', grad: 'linear-gradient(135deg,#F3F0FF,#EDE9FE)', desc: '3-month average blood sugar level. Essential for managing diabetes.', price: 399, mrp: 700, tag: 'Diabetes', tagColor: '#8B5CF6', tagBg: '#F3F0FF' },
    { name: 'Vitamin D3', short: '25-OH Vit D', icon: 'wb_sunny', grad: 'linear-gradient(135deg,#FEF9EC,#FEF3C7)', desc: 'Measures bone health vitamin critical for immunity and muscle function.', price: 699, mrp: 1200, tag: 'Bone Health', tagColor: '#F59E0B', tagBg: '#FEF9EC' },
    { name: 'Liver Function Test', short: 'LFT', icon: 'science', grad: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', desc: 'Assesses liver enzymes and proteins to monitor liver health and disease.', price: 499, mrp: 900, tag: 'Liver Care', tagColor: '#10B981', tagBg: '#ECFDF5' },
  ];

  private fallbackPackages = [
    { id: 'fp1', name: 'Executive Health Checkup', subtitle: 'Complete Corporate Wellness', grad: 'linear-gradient(145deg,#0047CC,#003399)', badge: 'Best Value', testCount: 85, price: 2499, mrp: 5500, includes: ['CBC, LFT, KFT', 'Lipid Profile', 'Thyroid Panel', 'ECG, X-Ray', 'Vitamin D, B12', 'Diabetes Screening'] },
    { id: 'fp2', name: 'Diabetes Care Package', subtitle: 'Comprehensive Diabetes Management', grad: 'linear-gradient(145deg,#7C3AED,#5B21B6)', badge: 'Diabetic Friendly', testCount: 42, price: 999, mrp: 2200, includes: ['HbA1c', 'Fasting Blood Sugar', 'Post Prandial Sugar', 'Urine Microalbumin', 'Kidney Function', 'Lipid Profile'] },
    { id: 'fp3', name: "Women's Wellness", subtitle: "Designed for Women's Health", grad: 'linear-gradient(145deg,#DB2777,#BE185D)', badge: "Women's Special", testCount: 68, price: 1799, mrp: 3800, includes: ['Hormone Panel', 'Thyroid Profile', 'Iron Studies', 'Vitamin D, B12', 'PAP Smear', 'CBC & Blood Group'] },
    { id: 'fp4', name: 'Senior Citizen Package', subtitle: 'Tailored for 60+ Health', grad: 'linear-gradient(145deg,#D97706,#B45309)', badge: 'Senior Care', testCount: 95, price: 2999, mrp: 6500, includes: ['Cardiac Risk Markers', 'Bone Density', 'Kidney & Liver Function', 'Complete Blood Panel', 'ECG + Spirometry', 'Prostate/Gynae'] },
  ];

  displayPackages = signal(this.fallbackPackages);

  steps = [
    { n: '01', icon: 'search', title: 'Choose Your Test', desc: "Browse 2000+ tests and packages or search by symptom, health concern, or doctor's recommendation.", color: '#0047CC' },
    { n: '02', icon: 'calendar_today', title: 'Book & Schedule', desc: 'Select a convenient time slot. A certified phlebotomist will arrive at your doorstep.', color: '#00B4AE' },
    { n: '03', icon: 'water_drop', title: 'Sample Collected', desc: 'Our trained technician collects the sample with sterile, disposable equipment at your home.', color: '#8B5CF6' },
    { n: '04', icon: 'description', title: 'Get Your Report', desc: 'Receive NABL-certified digital reports within 6–8 hours via WhatsApp, email, or app.', color: '#F59E0B' },
  ];

  comesFeatures = [
    { icon: 'home', title: 'At Your Home', desc: 'Sample pickup from your address — living room, bedroom, or office.' },
    { icon: 'schedule', title: 'Your Schedule', desc: 'Choose from morning, afternoon, or evening slots, 365 days a year.' },
    { icon: 'science', title: 'Sterile Collection', desc: 'Single-use sterile kits, trained phlebotomists, zero contamination risk.' },
    { icon: 'notifications_active', title: 'Live Updates', desc: 'Real-time SMS + WhatsApp notifications from collection to report delivery.' },
  ];

  reviews: Review[] = [
    { name: 'Priya Sharma', meta: '34, Shivamogga', initials: 'PS', rating: 5, text: 'Absolutely seamless experience! The phlebotomist arrived at 7 AM sharp, very professional. Got my thyroid report on WhatsApp by 1 PM. Will never go to a lab physically again.', test: 'Thyroid Profile + CBC' },
    { name: 'Rajesh Kumar', meta: '52, Bhadravathi', initials: 'RK', rating: 5, text: 'As a diabetic I need quarterly tests. Sri Health Plus\'s diabetes package is affordable and the reports come with doctor comments. My endocrinologist loves the report format!', test: 'Diabetes Care Package' },
    { name: 'Meena Krishnan', meta: '28, Sagar', initials: 'MK', rating: 5, text: 'I was surprised how affordable the women\'s wellness package was. Great value. The phlebotomist was trained, gentle, and wore gloves. Highly recommend.', test: "Women's Wellness Package" },
    { name: 'Arjun Nair', meta: '45, Shivamogga', initials: 'AN', rating: 5, text: 'I booked the Executive Health Checkup for my whole family. Everything from scheduling to digital reports was flawless. The reports include reference ranges and explanations.', test: 'Executive Health Checkup' },
  ];

  certs = [
    { label: 'NABL Accredited', sub: 'National Accreditation Board', icon: 'verified' },
    { label: 'ISO 15189:2022', sub: 'Medical Laboratories Quality', icon: 'workspace_premium' },
    { label: 'ICMR Approved', sub: 'Govt of India Certified', icon: 'account_balance' },
    { label: 'CAP Certified', sub: 'College of American Pathologists', icon: 'biotech' },
    { label: '4.9★ Google', sub: '2,400+ Verified Reviews', icon: 'star' },
  ];

  ngOnInit(): void {
    this.seo.setPage({
      title: 'NABL-Accredited Diagnostic Lab & Home Sample Collection',
      description:
        'Sri Health Plus is a NABL-accredited diagnostic laboratory in Shivamogga offering 2000+ tests, health packages, and free home sample collection with reports in 6-8 hours.',
      path: '/',
      image: 'assets/photos/home-hero.jpg',
    });

    this.bannerApi.list().subscribe({
      next: (list) => this.banners.set(list),
      error: () => this.banners.set([]),
    });

    this.packageApi.list().subscribe({
      next: (res) => {
        const items = res.items?.slice(0, 4) ?? [];
        if (items.length) {
          const mapped = items.map((p, i) => {
            const fb = this.fallbackPackages[i % this.fallbackPackages.length];
            return {
              id: p.id,
              name: p.name,
              subtitle: p.description || fb.subtitle,
              grad: fb.grad,
              badge: fb.badge,
              testCount: p.tests?.length ?? fb.testCount,
              price: p.discounted_price ?? fb.price,
              mrp: p.original_price ?? fb.mrp,
              includes: (p.tests?.slice(0, 6).map((t) => t.name) ?? fb.includes),
            };
          });
          this.displayPackages.set(mapped);
        }
        this.packages.set(items);
        this.pkgLoading.set(false);
      },
      error: () => this.pkgLoading.set(false),
    });

    this.animateCounts();
    this.rotateTimer = setInterval(() => this.next(), 6000);
  }

  viewPackageDetails(pkg: { id: string }): void {
    this.router.navigate(['/packages'], { queryParams: { pkg: pkg.id } });
  }

  bookPackage(pkg: { id: string }, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/booking'], { queryParams: { package_id: pkg.id } });
  }

  ngOnDestroy(): void {
    if (this.rotateTimer) clearInterval(this.rotateTimer);
    if (this.countRaf) cancelAnimationFrame(this.countRaf);
  }

  onSearch(): void {
    const q = this.query.trim();
    this.router.navigate(['/tests'], q ? { queryParams: { q } } : {});
  }

  starsFor(n: number): number[] { return Array.from({ length: n }); }
  next(): void { this.active.set((this.active() + 1) % this.reviews.length); }
  prev(): void { this.active.set((this.active() - 1 + this.reviews.length) % this.reviews.length); }
  go(i: number): void { this.active.set(i); }

  private animateCounts(): void {
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      this.stats.forEach((s) => s.display.set(s.target.toLocaleString()));
      return;
    }
    const duration = 1800;
    const start = Date.now();
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.stats.forEach((s) => s.display.set(Math.round(eased * s.target).toLocaleString()));
      if (progress < 1) this.countRaf = requestAnimationFrame(tick);
    };
    this.countRaf = requestAnimationFrame(tick);
  }
}
