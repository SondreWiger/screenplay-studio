import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy — Screenplay Studio',
  description: 'Rules governing acceptable use of the Screenplay Studio platform.',
};

export default function AcceptableUsePolicyPage() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-brand-400 hover:text-brand-300 text-sm mb-8 inline-block">&larr; Back to home</Link>

        <h1 className="text-3xl font-bold text-white mb-2">Acceptable Use Policy</h1>
        <p className="text-sm text-surface-500 mb-12">Last updated: February 21, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">

          <section>
            <p className="text-base text-surface-200">
              This Acceptable Use Policy (&quot;AUP&quot;) governs your use of the Screenplay Studio platform and all
              associated services. This policy supplements our{' '}
              <Link href="/terms" className="text-brand-400 hover:text-brand-300">Terms of Service</Link> and applies to
              all users, whether on free or paid plans.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. General Conduct</h2>
            <p>You agree to use Screenplay Studio in a manner that is:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Lawful and compliant with all applicable local, national, and international laws</li>
              <li>Honest and transparent — do not misrepresent your identity or intentions</li>
              <li>Respectful of other users&apos; rights, privacy, and creative works</li>
              <li>Consistent with the intended purpose of the platform as a creative writing and filmmaking tool</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Prohibited Activities</h2>
            <p>The following activities are strictly prohibited:</p>

            <h3 className="text-sm font-semibold text-white mt-4 mb-2">2.1 Security Violations</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Attempting to gain unauthorized access to any account, system, or network</li>
              <li>Probing, scanning, or testing the vulnerability of the Service without authorization</li>
              <li>Breaching or circumventing any security or authentication measures</li>
              <li>Intercepting, monitoring, or altering communications not intended for you</li>
              <li>Using the Service to distribute malware, ransomware, or other malicious software</li>
              <li>Attempting to extract data through scraping, crawling, or automated means without permission</li>
            </ul>

            <h3 className="text-sm font-semibold text-white mt-4 mb-2">2.2 Service Abuse</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Using the Service to send spam, bulk unsolicited messages, or chain messages</li>
              <li>Creating multiple accounts to circumvent bans, restrictions, or rate limits</li>
              <li>Using automated tools or bots to interact with the Service without authorization</li>
              <li>Deliberately introducing bugs, exploiting vulnerabilities, or degrading service performance</li>
              <li>Using the Service primarily as a file storage or content delivery network unrelated to its purpose</li>
              <li>Reselling, sublicensing, or commercializing access to the Service without authorization</li>
            </ul>

            <h3 className="text-sm font-semibold text-white mt-4 mb-2">2.3 Content Violations</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Uploading content that infringes on intellectual property rights</li>
              <li>Sharing content that is illegal under applicable laws</li>
              <li>Uploading sexually explicit, pornographic, or obscene material (distinct from mature-themed creative writing)</li>
              <li>Sharing content that exploits or endangers minors in any way</li>
              <li>Using the platform to plan, coordinate, or promote illegal activities</li>
            </ul>

            <h3 className="text-sm font-semibold text-white mt-4 mb-2">2.4 Harmful Behavior</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Harassment, bullying, stalking, or intimidation of any user</li>
              <li>Promoting or encouraging self-harm or suicide</li>
              <li>Doxxing or revealing personal information about others</li>
              <li>Engaging in fraud, phishing, or social engineering targeting our users</li>
              <li>Creating or participating in coordinated inauthentic behavior (vote manipulation, brigading)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Resource Usage</h2>
            <p>To ensure fair access for all users:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Do not use excessive bandwidth, storage, or computational resources beyond reasonable creative use</li>
              <li>Respect rate limits and API usage guidelines</li>
              <li>Do not use the platform to mine cryptocurrency or perform computationally intensive tasks unrelated to the Service</li>
              <li>We reserve the right to throttle or restrict accounts that consume disproportionate resources</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. API &amp; Integration Usage</h2>
            <p>If you access the Service through APIs or integrations:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use APIs only for their intended purposes as documented</li>
              <li>Do not exceed published rate limits</li>
              <li>Include proper authentication with all API requests</li>
              <li>Do not cache or store data beyond what is necessary for your application&apos;s functionality</li>
              <li>Respect robots.txt directives and API versioning</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Intellectual Property</h2>
            <p>You must respect intellectual property rights at all times:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Only upload content you own or have explicit permission to use</li>
              <li>Respect copyright, trademark, and patent rights of others</li>
              <li>Respond promptly to any infringement notices</li>
              <li>Do not circumvent digital rights management or copy protection mechanisms</li>
              <li>If you believe your work has been infringed, contact us at{' '}
                <a href="mailto:dmca@screenplaystudio.app" className="text-brand-400 hover:text-brand-300">dmca@screenplaystudio.app</a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Account Responsibility</h2>
            <p>You are responsible for:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>All activity that occurs under your account</li>
              <li>Maintaining strong, unique passwords and enabling additional security features when available</li>
              <li>Immediately reporting any unauthorized access to your account</li>
              <li>Not sharing your login credentials with others</li>
              <li>Logging out from shared or public devices</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Monitoring &amp; Enforcement</h2>
            <p>
              We reserve the right to monitor use of the Service for compliance with this AUP. We may:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Investigate suspected violations and cooperate with law enforcement when required</li>
              <li>Remove or disable access to content that violates this policy</li>
              <li>Suspend or terminate accounts engaged in prohibited activities</li>
              <li>Report illegal activities to appropriate authorities</li>
            </ul>
            <p className="mt-2">
              Enforcement actions follow the graduated response system described in our{' '}
              <Link href="/community-guidelines" className="text-brand-400 hover:text-brand-300">Community Guidelines</Link>.
              Severe violations may result in immediate termination without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Reporting Violations</h2>
            <p>
              To report a violation of this AUP, use the in-app report function or email{' '}
              <a href="mailto:abuse@screenplaystudio.app" className="text-brand-400 hover:text-brand-300">abuse@screenplaystudio.app</a>.
              Include the nature of the violation, any relevant evidence, and the usernames or URLs involved.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this AUP from time to time. Material changes will be communicated through the Service
              or via email. Continued use of the Service after changes become effective constitutes acceptance
              of the updated policy.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-surface-800 flex flex-wrap gap-4 text-xs text-surface-500">
          <Link href="/terms" className="hover:text-brand-400">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-brand-400">Privacy Policy</Link>
          <Link href="/community-guidelines" className="hover:text-brand-400">Community Guidelines</Link>
          <Link href="/content-policy" className="hover:text-brand-400">Content Policy</Link>
        </div>
      </div>
    </div>
  );
}
