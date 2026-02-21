import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — Screenplay Studio',
  description: 'Terms and conditions governing the use of Screenplay Studio.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-brand-400 hover:text-brand-300 text-sm mb-8 inline-block">&larr; Back to home</Link>

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-surface-500 mb-12">Last updated: February 21, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Screenplay Studio (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;).
              If you do not agree to all of these Terms, you may not access or use the Service. These Terms constitute a legally binding
              agreement between you and Screenplay Studio (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Eligibility</h2>
            <p>
              You must be at least 16 years of age to use the Service. By using the Service, you represent and warrant that you
              meet this minimum age requirement and have the legal capacity to enter into these Terms. If you are using the
              Service on behalf of an organization, you represent that you have authority to bind that organization.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Registration</h2>
            <p>To access certain features, you must create an account. You agree to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide accurate, current, and complete registration information</li>
              <li>Maintain and update your information to keep it accurate</li>
              <li>Maintain the security and confidentiality of your login credentials</li>
              <li>Immediately notify us of any unauthorized use of your account</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
            <p className="mt-2">
              We reserve the right to suspend or terminate accounts that violate these Terms or remain inactive for
              extended periods.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Your Content</h2>
            <p>
              <strong className="text-white">Ownership:</strong> You retain full ownership of all content you create, upload, or store on the
              Service, including but not limited to screenplays, scripts, documents, notes, characters, and all other creative works
              (&quot;Your Content&quot;). We do not claim any intellectual property rights over Your Content.
            </p>
            <p className="mt-2">
              <strong className="text-white">License to Us:</strong> By using the Service, you grant us a limited, non-exclusive,
              worldwide license to store, process, display, and transmit Your Content solely for the purpose of providing
              the Service to you. This license terminates when you delete Your Content or your account.
            </p>
            <p className="mt-2">
              <strong className="text-white">Responsibility:</strong> You are solely responsible for Your Content. You represent that
              you have the necessary rights to any content you submit and that Your Content does not violate the rights
              of any third party.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Violate any applicable laws, regulations, or third-party rights</li>
              <li>Upload, transmit, or distribute malware, viruses, or other harmful code</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Attempt to gain unauthorized access to other users&apos; accounts or data</li>
              <li>Harass, abuse, threaten, or intimidate other users</li>
              <li>Use automated means (bots, scrapers) to access the Service without permission</li>
              <li>Circumvent any security features or access restrictions</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation</li>
              <li>Use the Service for any commercial spam or unsolicited advertising</li>
            </ul>
            <p className="mt-2">
              For detailed guidelines on acceptable behavior, see our{' '}
              <Link href="/acceptable-use" className="text-brand-400 hover:text-brand-300">Acceptable Use Policy</Link> and{' '}
              <Link href="/community-guidelines" className="text-brand-400 hover:text-brand-300">Community Guidelines</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Collaboration &amp; Shared Projects</h2>
            <p>
              When you invite others to your project or join another user&apos;s project, you acknowledge that:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Project owners control access permissions and can modify or remove members at any time</li>
              <li>Contributed content within shared projects is governed by agreements between collaborators</li>
              <li>We are not responsible for disputes between collaborators over ownership or creative control</li>
              <li>We recommend establishing written collaboration agreements outside the Service for any professional work</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Community Features</h2>
            <p>
              The Service includes community features such as posts, comments, shared scripts, challenges, and direct
              messaging. When using these features you must comply with our{' '}
              <Link href="/community-guidelines" className="text-brand-400 hover:text-brand-300">Community Guidelines</Link>.
              We reserve the right to remove any community content that violates our policies, with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Subscription &amp; Payments</h2>
            <p>
              Certain features may require a paid subscription. If applicable:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Subscription fees are billed in advance on a recurring basis</li>
              <li>You can cancel your subscription at any time; access continues until the end of the billing period</li>
              <li>Refunds are handled on a case-by-case basis at our discretion</li>
              <li>We may change pricing with 30 days&apos; notice to active subscribers</li>
              <li>Free plans may have limitations on storage, collaborators, or features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Intellectual Property</h2>
            <p>
              The Service, its original content (excluding Your Content), features, and functionality are owned by 
              Screenplay Studio and are protected by international copyright, trademark, and other intellectual property laws.
              Our trademarks, logos, and service marks may not be used without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Data &amp; Privacy</h2>
            <p>
              Your use of the Service is also governed by our{' '}
              <Link href="/privacy" className="text-brand-400 hover:text-brand-300">Privacy Policy</Link>, which describes
              how we collect, use, and protect your personal data. By using the Service, you consent to the practices described therein.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Service Availability</h2>
            <p>
              We strive to provide a reliable service but do not guarantee uninterrupted or error-free operation. We may:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Perform scheduled or emergency maintenance that may temporarily affect availability</li>
              <li>Modify, suspend, or discontinue features with reasonable notice when possible</li>
              <li>Experience outages due to factors beyond our control</li>
            </ul>
            <p className="mt-2">We strongly recommend regularly exporting and backing up your important creative work.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SCREENPLAY STUDIO SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, OR
              GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
            </p>
            <p className="mt-2">
              Our total liability to you for all claims shall not exceed the amount you have paid us in the
              12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Screenplay Studio and its officers, directors, employees,
              and agents from any claims, damages, losses, liabilities, or expenses arising from your use of the Service,
              your violation of these Terms, or your violation of any rights of a third party.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">14. Termination</h2>
            <p>
              We may terminate or suspend your access to the Service immediately, without prior notice, for conduct that
              we determine violates these Terms or is harmful to other users, us, or third parties. Upon termination:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Your right to use the Service ceases immediately</li>
              <li>We may delete your account and data after a reasonable retention period</li>
              <li>All provisions that by their nature should survive termination will survive (including ownership, indemnification, limitations of liability)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">15. Dispute Resolution</h2>
            <p>
              Any disputes arising from these Terms shall first be attempted to be resolved through good-faith
              negotiation. If unresolved, disputes shall be settled under the laws of Norway, with the courts
              of Oslo as the exclusive jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">16. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify users of material changes via email or
              a prominent notice on the Service at least 30 days before they take effect. Your continued use after
              changes become effective constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">17. Contact</h2>
            <p>
              For questions about these Terms, contact us at:{' '}
              <a href="mailto:legal@screenplaystudio.app" className="text-brand-400 hover:text-brand-300">
                legal@screenplaystudio.app
              </a>
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-surface-800 flex flex-wrap gap-4 text-xs text-surface-500">
          <Link href="/privacy" className="hover:text-brand-400">Privacy Policy</Link>
          <Link href="/community-guidelines" className="hover:text-brand-400">Community Guidelines</Link>
          <Link href="/acceptable-use" className="hover:text-brand-400">Acceptable Use Policy</Link>
          <Link href="/content-policy" className="hover:text-brand-400">Content Policy</Link>
        </div>
      </div>
    </div>
  );
}
