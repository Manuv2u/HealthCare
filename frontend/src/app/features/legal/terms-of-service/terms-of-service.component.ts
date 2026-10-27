import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalPageComponent } from '../../../shared/components/legal-page/legal-page.component';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [LegalPageComponent, RouterLink],
  template: `
    <app-legal-page
      eyebrow="Legal"
      title="Terms of Service"
      updated="14 July 2026"
      subtitle="The terms and conditions that govern your use of Sri Health Plus — Diagnostic Laboratory & Health Care services.">

      <p class="legal-lead">
        These Terms of Service ("Terms") govern your access to and use of our website, mobile
        experience and diagnostic services. By creating an account, booking a test or otherwise
        using our services, you agree to be bound by these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old to create an account and book services. Tests for minors
        or dependents must be booked by a parent or legal guardian who accepts responsibility for
        the booking.
      </p>

      <h2>2. Your Account</h2>
      <ul>
        <li>You are responsible for keeping your login credentials confidential.</li>
        <li>You agree to provide accurate, current and complete information.</li>
        <li>You are responsible for all activity that occurs under your account.</li>
        <li>Notify us immediately if you suspect any unauthorised use of your account.</li>
      </ul>

      <h2>3. Booking &amp; Sample Collection</h2>
      <ul>
        <li>Test bookings are confirmed only after successful scheduling and, where applicable, payment.</li>
        <li>Home sample collection is subject to availability in your service area and to slot availability.</li>
        <li>You agree to provide safe access and accurate details for home collection.</li>
        <li>Certain tests require specific preparation (e.g. fasting). Following these instructions is your responsibility, and failure to do so may affect results or require re-collection.</li>
      </ul>

      <h2>4. Reports &amp; Medical Disclaimer</h2>
      <p>
        Diagnostic reports are made available digitally through your account. Reports are provided
        for informational purposes and are <strong>not a substitute for professional medical advice,
        diagnosis or treatment</strong>. Always consult a qualified doctor to interpret your results.
        Please read our full <a routerLink="/disclaimer">Disclaimer</a>.
      </p>

      <h2>5. Payments</h2>
      <ul>
        <li>Prices are displayed in Indian Rupees (₹) and are inclusive of applicable taxes unless stated otherwise.</li>
        <li>Payments are processed securely through our payment partners.</li>
        <li>We reserve the right to change test prices and package offerings at any time.</li>
      </ul>

      <h2>6. Cancellations &amp; Refunds</h2>
      <p>
        Cancellations and refunds are governed by our
        <a routerLink="/refund-and-cancellation">Refund &amp; Cancellation Policy</a>, which forms
        part of these Terms.
      </p>

      <h2>7. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for any unlawful or fraudulent purpose.</li>
        <li>Attempt to gain unauthorised access to our systems or other users' data.</li>
        <li>Interfere with or disrupt the integrity or performance of the service.</li>
        <li>Upload false prescriptions or misrepresent your identity.</li>
      </ul>

      <h2>8. Intellectual Property</h2>
      <p>
        All content on this website — including text, logos, graphics and software — is the property
        of Sri Health Plus — Diagnostic Laboratory &amp; Health Care or its licensors and is protected by applicable
        laws. You may not copy, reproduce or distribute it without prior written permission.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for any indirect, incidental or
        consequential damages arising from your use of, or inability to use, the service. Nothing in
        these Terms limits liability that cannot be excluded under applicable law.
      </p>

      <h2>10. Termination</h2>
      <p>
        We may suspend or terminate your access if you breach these Terms or misuse the service. You
        may stop using the service at any time and request account deletion, subject to legal
        retention requirements.
      </p>

      <h2>11. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. The revised version will be posted on this page
        with an updated date. Continued use of the service after changes take effect constitutes
        acceptance of the updated Terms.
      </p>

      <h2>12. Governing Law</h2>
      <p>
        These Terms are governed by the laws of India, and any disputes are subject to the exclusive
        jurisdiction of the courts of Shivamogga, Karnataka.
      </p>

      <h2>13. Contact Us</h2>
      <p>
        Questions about these Terms? Please <a routerLink="/contact">contact us</a>. See also our
        <a routerLink="/privacy-policy">Privacy Policy</a>.
      </p>
    </app-legal-page>
  `,
})
export class TermsOfServiceComponent {}
