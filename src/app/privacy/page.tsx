import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Screenplay Studio',
  description: 'Our privacy policy explains how we collect, use, and protect your personal data in compliance with GDPR.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-surface-500 mb-12">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              Screenplay Studio (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting your personal
              data. This privacy policy explains how we collect, use, store, and share your information
              when you use our screenwriting platform, in compliance with the General Data Protection
              Regulation (GDPR) and other applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Data Controller</h2>
            <p>
              Screenplay Studio is the data controller for the personal data collected through this
              platform. If you have questions about how we handle your data, please contact us at{' '}
              <a href="mailto:privacy@screenplaystudio.app" className="text-brand-400 hover:text-brand-300">
                privacy@screenplaystudio.app
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Data We Collect</h2>
            <p className="mb-3">We collect the following categories of personal data:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Account Information:</strong> Email address, name, avatar, and authentication credentials.</li>
              <li><strong className="text-white">Profile Data:</strong> Bio, website, location, and social links you choose to provide.</li>
              <li><strong className="text-white">Project Data:</strong> Scripts, documents, characters, notes, and other creative content you create.</li>
              <li><strong className="text-white">Usage Data:</strong> Page views, feature usage, and interaction patterns (with your consent).</li>
              <li><strong className="text-white">Technical Data:</strong> IP address, browser type, device information, and session data.</li>
              <li><strong className="text-white">Communication Data:</strong> Messages, comments, and chat content within the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Legal Basis for Processing</h2>
            <p className="mb-3">We process your data based on:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Contract Performance:</strong> Processing necessary to provide our screenwriting services to you.</li>
              <li><strong className="text-white">Legitimate Interests:</strong> Platform security, fraud prevention, and service improvement.</li>
              <li><strong className="text-white">Consent:</strong> Analytics cookies and marketing communications (you can withdraw consent at any time).</li>
              <li><strong className="text-white">Legal Obligation:</strong> Compliance with applicable laws and regulations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve the platform</li>
              <li>Authenticate your identity and manage your account</li>
              <li>Enable real-time collaboration features</li>
              <li>Send service-related notifications</li>
              <li>Analyze usage patterns to improve features (with consent)</li>
              <li>Prevent fraud and ensure platform security</li>
              <li>Respond to support requests and communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data Sharing</h2>
            <p className="mb-3">
              We do not sell your personal data. We may share data with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Service Providers:</strong> Supabase (database hosting), Vercel (hosting), and other infrastructure providers.</li>
              <li><strong className="text-white">Collaborators:</strong> Users you invite to your projects can see project-related content.</li>
              <li><strong className="text-white">Legal Requirements:</strong> When required by law or to protect our rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Your Rights (GDPR)</h2>
            <p className="mb-3">Under the GDPR, you have the following rights:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Right of Access:</strong> Request a copy of all personal data we hold about you.</li>
              <li><strong className="text-white">Right to Rectification:</strong> Correct inaccurate personal data.</li>
              <li><strong className="text-white">Right to Erasure:</strong> Request deletion of your personal data (&ldquo;right to be forgotten&rdquo;).</li>
              <li><strong className="text-white">Right to Restrict Processing:</strong> Limit how we use your data.</li>
              <li><strong className="text-white">Right to Data Portability:</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong className="text-white">Right to Object:</strong> Object to processing based on legitimate interests.</li>
              <li><strong className="text-white">Right to Withdraw Consent:</strong> Withdraw consent for optional data processing at any time.</li>
            </ul>
            <p className="mt-3">
              You can exercise these rights from your{' '}
              <a href="/dashboard" className="text-brand-400 hover:text-brand-300">account settings</a>{' '}
              or by contacting us at{' '}
              <a href="mailto:privacy@screenplaystudio.app" className="text-brand-400 hover:text-brand-300">
                privacy@screenplaystudio.app
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to
              provide our services. When you delete your account, we will delete or anonymize your
              personal data within 30 days, unless we are required to retain it for legal purposes.
              Project data shared with collaborators may persist in their copies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your data,
              including encryption in transit (TLS), encryption at rest, access controls, and
              regular security audits. Our infrastructure is hosted on industry-standard cloud
              platforms with SOC 2 compliance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Cookies</h2>
            <p className="mb-3">We use the following types of cookies:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Necessary:</strong> Required for authentication, security, and basic functionality. Cannot be disabled.</li>
              <li><strong className="text-white">Analytics:</strong> Help us understand usage patterns. Enabled only with your consent.</li>
              <li><strong className="text-white">Marketing:</strong> Used for personalized recommendations. Enabled only with your consent.</li>
            </ul>
            <p className="mt-3">
              You can manage your cookie preferences at any time through the cookie settings in the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. International Transfers</h2>
            <p>
              Your data may be processed in countries outside the EEA. When this occurs, we ensure
              appropriate safeguards are in place, such as Standard Contractual Clauses (SCCs) or
              adequacy decisions by the European Commission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Children&rsquo;s Privacy</h2>
            <p>
              Our platform is not intended for children under 16. We do not knowingly collect
              personal data from children. If you believe a child has provided us with personal
              data, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of significant
              changes via email or an in-app notification. Continued use of the platform after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">14. Contact Us</h2>
            <p>
              If you have questions about this policy or wish to exercise your data rights, contact us at:{' '}
              <a href="mailto:privacy@screenplaystudio.app" className="text-brand-400 hover:text-brand-300">
                privacy@screenplaystudio.app
              </a>
            </p>
            <p className="mt-2">
              You also have the right to lodge a complaint with your local data protection authority.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-surface-800 flex flex-wrap gap-4 text-xs text-surface-500">
          <Link href="/terms" className="hover:text-brand-400">Terms of Service</Link>
          <Link href="/community-guidelines" className="hover:text-brand-400">Community Guidelines</Link>
          <Link href="/acceptable-use" className="hover:text-brand-400">Acceptable Use Policy</Link>
          <Link href="/content-policy" className="hover:text-brand-400">Content Policy</Link>
          <Link href="/" className="hover:text-brand-400">&larr; Back to Screenplay Studio</Link>
        </div>
      </div>
    </div>
  );
}
