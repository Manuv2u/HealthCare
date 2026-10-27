import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalPageComponent } from '../../../shared/components/legal-page/legal-page.component';

@Component({
  selector: 'app-refund-cancellation',
  standalone: true,
  imports: [LegalPageComponent, RouterLink],
  template: `
    <app-legal-page
      eyebrow="Legal"
      title="Refund & Cancellation Policy"
      updated="14 July 2026"
      subtitle="How cancellations, rescheduling and refunds work for your diagnostic bookings.">

      <p class="legal-lead">
        We understand that plans change. This policy explains how you can cancel or reschedule a
        booking and how refunds are handled at Sri Health Plus — Diagnostic Laboratory &amp; Health Care.
      </p>

      <h2>1. Cancellation by You</h2>
      <ul>
        <li><strong>Before sample collection:</strong> You may cancel a booking any time before the sample is collected and be eligible for a refund as described below.</li>
        <li><strong>After sample collection:</strong> Once a sample has been collected and processing has begun, the booking cannot be cancelled and is not eligible for a refund.</li>
        <li>To cancel, use your account's booking section or contact our support team.</li>
      </ul>

      <h2>2. Rescheduling</h2>
      <p>
        You may reschedule a home collection appointment free of charge if requested in advance,
        subject to slot availability in your area. Repeated last-minute rescheduling may be
        declined.
      </p>

      <h2>3. Refund Eligibility</h2>
      <ul>
        <li><strong>Full refund</strong> — for prepaid bookings cancelled before sample collection, or when we are unable to fulfil a booking (e.g. service unavailable in your area).</li>
        <li><strong>Partial refund</strong> — where part of a package has been processed, a refund may be issued for the unfulfilled portion only.</li>
        <li><strong>No refund</strong> — once samples are collected and testing has commenced, or for missed appointments where our team arrived as scheduled.</li>
      </ul>

      <h2>4. Refunds for Service Issues</h2>
      <p>
        If a test cannot be completed due to an issue on our side — such as an insufficient or
        compromised sample that is not attributable to you — we will arrange a free re-collection
        or, where that is not possible, issue an appropriate refund.
      </p>

      <h2>5. Refund Method &amp; Timeline</h2>
      <ul>
        <li>Approved refunds are credited to the original payment method used at booking.</li>
        <li>Refunds are typically processed within <strong>5–7 business days</strong>, though the time for the amount to reflect in your account depends on your bank or payment provider.</li>
        <li>You will receive a confirmation once the refund has been initiated.</li>
      </ul>

      <h2>6. Non-Refundable Situations</h2>
      <ul>
        <li>Failure to follow required test preparation (e.g. fasting) resulting in an invalid sample.</li>
        <li>Providing an incorrect address or being unavailable at the scheduled collection time.</li>
        <li>Change of mind after the sample has already been collected.</li>
      </ul>

      <h2>7. How to Request a Refund</h2>
      <p>
        To request a cancellation or refund, visit your bookings in your account or
        <a routerLink="/contact">contact our support team</a> with your booking reference. Our team
        will review the request and confirm the outcome.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may revise this Refund &amp; Cancellation Policy from time to time. The latest version will
        always be available on this page. This policy forms part of our
        <a routerLink="/terms-of-service">Terms of Service</a>.
      </p>
    </app-legal-page>
  `,
})
export class RefundCancellationComponent {}
