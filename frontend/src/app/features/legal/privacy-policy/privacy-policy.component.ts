import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalPageComponent } from '../../../shared/components/legal-page/legal-page.component';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [LegalPageComponent, RouterLink],
  template: `
    <app-legal-page
      eyebrow="Legal"
      title="Privacy Policy"
      updated="14 July 2026"
      subtitle="How Sri Health Plus — Diagnostic Laboratory & Health Care collects, uses, and protects your personal and health information.">

      <p class="legal-lead">
        Your privacy matters to us. This Privacy Policy explains what information we collect
        when you use our website, book diagnostic tests, or interact with our services, and how
        we handle that information. By using our services you agree to the practices described below.
      </p>

      <h2>1. Information We Collect</h2>
      <p>We collect information that helps us provide accurate diagnostic services and a smooth experience:</p>
      <ul>
        <li><strong>Personal details</strong> — name, age, gender, phone number, email address and postal address.</li>
        <li><strong>Health information</strong> — test bookings, prescriptions you upload, sample collection details and diagnostic reports.</li>
        <li><strong>Account information</strong> — login credentials and family-member profiles you create.</li>
        <li><strong>Payment information</strong> — billing details processed securely through our payment partners. We do not store full card numbers.</li>
        <li><strong>Technical information</strong> — device, browser and usage data collected automatically to keep the service secure and reliable.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To process test bookings, schedule home sample collection and deliver your reports.</li>
        <li>To verify your identity and manage your account and family profiles.</li>
        <li>To process payments, refunds and cancellations.</li>
        <li>To send appointment confirmations, report-ready alerts and service updates.</li>
        <li>To respond to your enquiries and provide customer support.</li>
        <li>To improve our services, maintain security and comply with legal obligations.</li>
      </ul>

      <h2>3. How We Protect Your Data</h2>
      <p>
        We use industry-standard safeguards — including encryption in transit, access controls and
        secure infrastructure — to protect your personal and health information. Access to diagnostic
        data is restricted to authorised personnel who need it to deliver your care.
      </p>

      <h2>4. Sharing of Information</h2>
      <p>We do not sell your personal information. We may share it only:</p>
      <ul>
        <li>With our laboratory staff, phlebotomists and referring physicians involved in your care.</li>
        <li>With trusted service providers (such as payment and communication partners) who process data on our behalf under confidentiality obligations.</li>
        <li>When required by law, regulation or a valid legal request.</li>
      </ul>

      <h2>5. Cookies &amp; Tracking</h2>
      <p>
        Our website uses cookies and similar technologies to keep you signed in, remember your
        preferences and understand how the site is used. You can control cookies through your
        browser settings, though some features may not work without them.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain your diagnostic records and account information for as long as needed to provide
        our services and to meet legal, regulatory and medical record-keeping requirements. When no
        longer required, information is securely deleted or anonymised.
      </p>

      <h2>7. Your Rights</h2>
      <ul>
        <li>Access the personal information we hold about you.</li>
        <li>Request correction of inaccurate or incomplete information.</li>
        <li>Request deletion of your account, subject to legal retention requirements.</li>
        <li>Opt out of non-essential communications at any time.</li>
      </ul>

      <h2>8. Children's Privacy</h2>
      <p>
        Tests for minors should be booked by a parent or legal guardian through their own account.
        We do not knowingly collect information directly from children.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be posted on this
        page with a revised "last updated" date. Continued use of our services after changes take
        effect constitutes acceptance of the updated policy.
      </p>

      <h2>10. Contact Us</h2>
      <p>
        For any questions about this Privacy Policy or how your information is handled, please
        <a routerLink="/contact">contact us</a> or call our support team. See also our
        <a routerLink="/terms-of-service">Terms of Service</a>.
      </p>
    </app-legal-page>
  `,
})
export class PrivacyPolicyComponent {}
