import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalPageComponent } from '../../../shared/components/legal-page/legal-page.component';

@Component({
  selector: 'app-disclaimer',
  standalone: true,
  imports: [LegalPageComponent, RouterLink],
  template: `
    <app-legal-page
      eyebrow="Legal"
      title="Disclaimer"
      updated="14 July 2026"
      subtitle="Important information about the use of our diagnostic services and reports.">

      <p class="legal-lead">
        The information and services provided by Sri Health Plus — Diagnostic Laboratory &amp; Health Care are
        intended to support, not replace, the relationship between you and your healthcare provider.
        Please read this Disclaimer carefully.
      </p>

      <h2>1. Not Medical Advice</h2>
      <p>
        Diagnostic reports, reference ranges and any content on this website are provided for
        informational purposes only and <strong>do not constitute medical advice, diagnosis or
        treatment</strong>. Always seek the guidance of a qualified physician regarding any medical
        condition or the interpretation of your test results.
      </p>

      <h2>2. Interpretation of Results</h2>
      <p>
        Test results should be interpreted by a licensed medical professional in the context of your
        overall health, history and symptoms. Reference ranges may vary between laboratories and
        individuals. Do not start, stop or change any treatment based solely on a report obtained
        through our service.
      </p>

      <h2>3. Accuracy of Information</h2>
      <p>
        While we take every reasonable measure to ensure the accuracy and reliability of our tests
        and the information on this website, results can be affected by factors outside our control,
        including sample quality, test preparation and individual biological variation. We do not
        warrant that the service will be error-free or uninterrupted.
      </p>

      <h2>4. No Doctor–Patient Relationship</h2>
      <p>
        Using this website or booking a test does not create a doctor–patient relationship between
        you and Sri Health Plus — Diagnostic Laboratory &amp; Health Care. Any consultation arrangements are
        separate and subject to their own terms.
      </p>

      <h2>5. Emergencies</h2>
      <p>
        Our services are <strong>not intended for medical emergencies</strong>. If you are
        experiencing a medical emergency, call your local emergency number or visit the nearest
        hospital immediately. Do not rely on this website or our reports for urgent care.
      </p>

      <h2>6. Third-Party Links</h2>
      <p>
        Our website may contain links to third-party websites or services. We are not responsible for
        the content, accuracy or practices of those third parties, and including a link does not imply
        endorsement.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, Sri Health Plus — Diagnostic Laboratory &amp; Health Care shall not
        be liable for any decisions made, or actions taken, in reliance on information or reports
        provided through our services. This Disclaimer forms part of our
        <a routerLink="/terms-of-service">Terms of Service</a>.
      </p>

      <h2>8. Contact Us</h2>
      <p>
        If you have any questions about this Disclaimer, please
        <a routerLink="/contact">contact us</a>.
      </p>
    </app-legal-page>
  `,
})
export class DisclaimerComponent {}
