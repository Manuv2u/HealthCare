import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PrescriptionModalService } from '../upload-prescription-modal/prescription-modal.service';

/**
 * Site-wide footer. Rendered once by AppComponent for every page that uses the
 * global shell, so the homepage and the inner pages stay identical.
 */
@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <footer class="footer">
      <div class="shell footer-grid">
        <div class="footer-brand">
          <div class="footer-logo">
            <img src="assets/logo-mark.png" alt="Sri Health Plus" class="footer-logo-mark" onerror="this.style.display='none'" />
            <div><div class="footer-logo-name">Sri Health Plus</div><div class="footer-logo-sub">Diagnostic Laboratory &amp; Health Care</div></div>
          </div>
          <p class="footer-about">NABL-accredited diagnostic laboratory delivering precision healthcare to your doorstep across Shivamogga.</p>
          <div class="footer-contact">
            <span><mat-icon>call</mat-icon> {{ phone }}</span>
            <span><mat-icon>place</mat-icon> Kuvempu Road, near Hosmane, Shivamogga 577201</span>
          </div>
          <div class="footer-social">
            <a href="https://www.instagram.com/sri_health_care_diagnostic_lab" target="_blank" rel="noopener" aria-label="Instagram" class="social-btn">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a href="https://www.facebook.com/share/18yJGUH82o/" target="_blank" rel="noopener" aria-label="Facebook" class="social-btn">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
          </div>
        </div>
        <div class="footer-col">
          <h4>Popular Tests</h4>
          <a routerLink="/tests">Complete Blood Count</a>
          <a routerLink="/tests">Thyroid Profile</a>
          <a routerLink="/tests">Lipid Profile</a>
          <a routerLink="/tests">HbA1c Test</a>
          <a routerLink="/tests">Liver Function Test</a>
        </div>
        <div class="footer-col">
          <h4>Quick Links</h4>
          <a routerLink="/tests">Browse Tests</a>
          <a routerLink="/packages">Health Packages</a>
          <a routerLink="/home-sample-collection">Home Sample Collection</a>
          <a routerLink="/booking">Book Now</a>
          <button type="button" class="footer-link-btn" (click)="prescriptionModal.open()">Upload Prescription</button>
          <a routerLink="/lab-locations">Lab Locations</a>
          <a routerLink="/available-locations">Available Locations</a>
          <a routerLink="/blog">Blog</a>
          <a routerLink="/about">About Us</a>
          <a routerLink="/contact">Contact Us</a>
          <a routerLink="/faq">FAQ</a>
        </div>
        <div class="footer-col">
          <h4>Get In Touch</h4>
          <p class="footer-nl-desc">Health tips and package offers, straight to your inbox.</p>
          <form class="footer-nl" (ngSubmit)="$event.preventDefault()">
            <input type="email" placeholder="Your email address" aria-label="Email address" />
            <button type="submit">Subscribe</button>
          </form>
          <div class="footer-cta">
            <a [href]="'tel:+91' + phone" class="cta-btn cta-btn--call" aria-label="Call Sri Health Plus">
              <mat-icon>call</mat-icon>
              <span>Call Us</span>
            </a>
            <a [href]="'https://wa.me/91' + phone" target="_blank" rel="noopener" class="cta-btn cta-btn--wa" aria-label="Chat with Sri Health Plus on WhatsApp">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.335-1.652a12 12 0 0 0 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411"/></svg>
              <span>WhatsApp</span>
            </a>
          </div>
          <div class="footer-badges">
            <span><mat-icon>verified</mat-icon> NABL</span>
            <span><mat-icon>workspace_premium</mat-icon> ISO 15189</span>
          </div>
        </div>
      </div>
      <div class="footer-bottom shell">
        <span>© 2026 Sri Health Plus — Diagnostic Laboratory &amp; Health Care. All rights reserved.</span>
        <span class="footer-bottom-links"><a routerLink="/privacy-policy">Privacy Policy</a><a routerLink="/terms-of-service">Terms of Service</a><a routerLink="/refund-and-cancellation">Refund &amp; Cancellation</a><a routerLink="/disclaimer">Disclaimer</a></span>
      </div>
    </footer>
  `,
  styles: [`
    :host { display: block; font-family: var(--font-sans); margin-top: auto; }
    * { box-sizing: border-box; }

    .shell { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 24px; }

    .footer { background: #0D1F3C; color: rgba(255,255,255,0.8); padding: 64px 0 0; }
    .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 48px; padding-bottom: 56px; }
    .footer-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .footer-logo-mark { width: 44px; height: 44px; border-radius: 12px; object-fit: contain; display: block; }
    .footer-logo-name { font-family: var(--font-display); font-weight: 800; font-size: 20px; color: #fff; }
    .footer-logo-sub { font-size: 10px; color: rgba(255,255,255,0.5); letter-spacing: 0.06em; text-transform: uppercase; }
    .footer-about { font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.6); max-width: 300px; margin-bottom: 20px; }
    .footer-contact { display: flex; flex-direction: column; gap: 10px; span { display: flex; align-items: flex-start; gap: 8px; font-size: 13.5px; color: rgba(255,255,255,0.65); mat-icon { font-size: 18px; width: 18px; height: 18px; color: #00B4AE; } } }
    .footer-social { display: flex; gap: 8px; margin-top: 20px; }
    .social-btn {
      width: 34px; height: 34px; border-radius: 10px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.6);
      transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
      &:hover { background: #00B4AE; border-color: #00B4AE; color: #fff; transform: translateY(-2px); }
    }
    .footer-col { h4 { font-family: var(--font-display); font-weight: 700; font-size: 14px; color: #fff; margin: 0 0 18px; letter-spacing: 0.05em; text-transform: uppercase; } a { display: block; font-size: 13.5px; color: rgba(255,255,255,0.6); text-decoration: none; margin-bottom: 10px; transition: color 0.15s; &:hover { color: #fff; } } }
    .footer-link-btn {
      display: block; background: none; border: none; padding: 0;
      font-family: inherit; font-size: 13.5px; color: rgba(255,255,255,0.6);
      margin-bottom: 10px; text-align: left; cursor: pointer; transition: color 0.15s;
      &:hover { color: #fff; }
    }
    .footer-nl-desc { font-size: 13px; color: rgba(255,255,255,0.55); line-height: 1.6; margin: 0 0 14px; }
    .footer-nl { display: flex; gap: 4px; background: rgba(255,255,255,0.06); border-radius: 12px; padding: 4px; margin-bottom: 20px; input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; padding: 10px 14px; font-size: 13px; color: #fff; } button { background: linear-gradient(135deg,#0047CC,#00B4AE); border: none; border-radius: 10px; padding: 10px 18px; color: #fff; font-size: 12px; font-weight: 600; font-family: var(--font-display); cursor: pointer; } }
    .footer-cta { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    /* Specificity must beat .footer-col a, which sets display/color/margin. */
    .footer-cta .cta-btn {
      display: inline-flex; align-items: center; gap: 7px; margin: 0;
      padding: 9px 14px; border-radius: 10px;
      font-size: 13px; font-weight: 600; font-family: var(--font-display);
      color: #fff; text-decoration: none; cursor: pointer;
      border: 1px solid transparent;
      transition: transform 0.15s, filter 0.15s;
      mat-icon, svg { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
      &:hover { color: #fff; transform: translateY(-2px); filter: brightness(1.08); }
    }
    .footer-cta .cta-btn--call { background: #0047CC; }
    .footer-cta .cta-btn--wa { background: #25D366; }
    .footer-badges { display: flex; gap: 10px; span { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.06); border-radius: 8px; padding: 6px 10px; mat-icon { font-size: 16px; width: 16px; height: 16px; color: #00B4AE; } } }
    .footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); padding: 24px; margin-top: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 13px; color: rgba(255,255,255,0.45); }
    .footer-bottom-links { display: flex; gap: 20px; flex-wrap: wrap; a { color: rgba(255,255,255,0.45); text-decoration: none; &:hover { color: #fff; } } }

    @media (max-width: 900px) {
      .footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
    }
    @media (max-width: 560px) {
      .footer-grid { grid-template-columns: 1fr; gap: 32px; }
    }
  `],
})
export class SiteFooterComponent {
  prescriptionModal = inject(PrescriptionModalService);

  /** National number without country code; used for both tel: and wa.me links. */
  readonly phone = '7795149207';
}
