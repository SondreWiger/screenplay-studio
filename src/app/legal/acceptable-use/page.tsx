import Link from 'next/link';

export const metadata = {
  title: 'Acceptable Use Policy | Screenplay Studio',
  description: 'Rules and guidelines for using Screenplay Studio responsibly.',
};

export default function AcceptableUsePolicyPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Policy</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Acceptable Use Policy</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white">
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Overview</h2>
            <p className="text-surface-300 mb-4">
              This Acceptable Use Policy (&ldquo;AUP&rdquo;) governs your use of Screenplay Studio and all related services. By accessing or using Screenplay Studio, you agree to comply with this policy. This AUP is incorporated into and supplements our{' '}
              <Link href="/legal/terms" className="text-red-400 hover:text-red-300">
                Terms of Service
              </Link>.
            </p>
            <p className="text-surface-300">
              We reserve the right to modify this policy at any time. Continued use of the service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Lawful Use</h2>
            <p className="text-surface-300 mb-4">
              You must use Screenplay Studio only for lawful purposes and in accordance with all applicable local, national, and international laws and regulations. You are solely responsible for ensuring that your use of the service complies with all applicable laws in your jurisdiction.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Content Standards</h2>
            <p className="text-surface-300 mb-4">
              All content created, uploaded, or shared through Screenplay Studio must meet the following standards:
            </p>
            <ul className="list-disc list-inside text-surface-300 space-y-2">
              <li>Content must be <strong className="text-white">original work</strong> or you must have the <strong className="text-white">proper rights</strong>, licenses, or permissions to use, reproduce, and share it.</li>
              <li>Content must not infringe upon the intellectual property rights, privacy rights, or other rights of any third party.</li>
              <li>Content shared publicly or with collaborators must comply with our{' '}
                <Link href="/legal/community-guidelines" className="text-red-400 hover:text-red-300">
                  Community Guidelines
                </Link>{' '}
                and{' '}
                <Link href="/legal/content-policy" className="text-red-400 hover:text-red-300">
                  Content Policy
                </Link>.
              </li>
              <li>You must have the right to grant Screenplay Studio the licenses described in our Terms of Service for any content you upload.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Prohibited Activities</h2>
            <p className="text-surface-300 mb-4">
              The following activities are strictly prohibited when using Screenplay Studio. Engaging in any of these activities may result in immediate account suspension or termination:
            </p>

            <div className="space-y-3">
              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Security &amp; Infrastructure</h3>
                <ol className="list-decimal list-inside text-surface-300 space-y-2">
                  <li>
                    <strong className="text-white">Hacking &amp; Unauthorized Access:</strong> Attempting to gain unauthorized access to Screenplay Studio&apos;s systems, servers, networks, or other users&apos; accounts through any means, including brute-force attacks, password guessing, or exploiting vulnerabilities.
                  </li>
                  <li>
                    <strong className="text-white">DDoS &amp; Denial of Service:</strong> Launching or participating in distributed denial-of-service attacks, flooding, or any activity intended to disrupt, degrade, or overwhelm our infrastructure.
                  </li>
                  <li>
                    <strong className="text-white">Malware &amp; Malicious Code:</strong> Uploading, transmitting, or distributing viruses, trojans, worms, ransomware, spyware, or any other malicious code or software.
                  </li>
                  <li>
                    <strong className="text-white">Vulnerability Exploitation:</strong> Exploiting any security vulnerability, bug, or misconfiguration in our systems without prior written authorization through our responsible disclosure program.
                  </li>
                  <li>
                    <strong className="text-white">Content Injection:</strong> Injecting malicious content, scripts (XSS), SQL injection, or any other code into Screenplay Studio&apos;s pages, forms, APIs, or databases.
                  </li>
                  <li>
                    <strong className="text-white">Decompiling &amp; Reverse Engineering:</strong> Decompiling, disassembling, reverse engineering, or otherwise attempting to derive the source code, algorithms, or data structures of Screenplay Studio, except as permitted by applicable law.
                  </li>
                </ol>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Access &amp; Authentication</h3>
                <ol start={7} className="list-decimal list-inside text-surface-300 space-y-2">
                  <li>
                    <strong className="text-white">Unauthorized API Access:</strong> Accessing or using Screenplay Studio&apos;s APIs in any manner not explicitly authorized, including bypassing authentication mechanisms or exceeding documented access scopes.
                  </li>
                  <li>
                    <strong className="text-white">Credential Sharing:</strong> Sharing your account credentials with any third party, or using another user&apos;s credentials without their explicit authorization.
                  </li>
                  <li>
                    <strong className="text-white">Ban Evasion:</strong> Creating new accounts or using any method to circumvent a suspension, ban, or other enforcement action taken against your account.
                  </li>
                  <li>
                    <strong className="text-white">Paywall Circumvention:</strong> Attempting to access Pro features, paid content, or premium functionality without a valid subscription, including exploiting trial systems, referral programs, or API endpoints.
                  </li>
                  <li>
                    <strong className="text-white">Proxy/VPN Abuse for Circumvention:</strong> Using proxies, VPNs, or other tools specifically to circumvent geographic restrictions, enforcement actions, rate limits, or access controls imposed by Screenplay Studio.
                  </li>
                </ol>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Data &amp; Automation</h3>
                <ol start={12} className="list-decimal list-inside text-surface-300 space-y-2">
                  <li>
                    <strong className="text-white">Scraping &amp; Data Harvesting:</strong> Using bots, crawlers, scrapers, or any automated means to extract, collect, or harvest data from Screenplay Studio without explicit written permission.
                  </li>
                  <li>
                    <strong className="text-white">Automated Access:</strong> Using automated tools, scripts, or bots to access, interact with, or manipulate Screenplay Studio in any way not explicitly permitted by our API documentation.
                  </li>
                  <li>
                    <strong className="text-white">Rate Limit Abuse:</strong> Deliberately circumventing, bypassing, or exceeding rate limits, throttling mechanisms, or usage quotas imposed by our systems.
                  </li>
                  <li>
                    <strong className="text-white">Unauthorized Data Collection:</strong> Collecting, storing, or processing personal information of other Screenplay Studio users without their explicit consent and a lawful basis for doing so.
                  </li>
                </ol>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Content &amp; Conduct</h3>
                <ol start={16} className="list-decimal list-inside text-surface-300 space-y-2">
                  <li>
                    <strong className="text-white">Spam &amp; Unsolicited Content:</strong> Sending unsolicited messages, comments, or content to other users; using the platform for bulk messaging, advertising, or promotional campaigns without authorization.
                  </li>
                  <li>
                    <strong className="text-white">Harassment &amp; Abuse:</strong> Engaging in harassment, bullying, threats, intimidation, doxxing, or any behavior intended to harm, distress, or intimidate other users.
                  </li>
                  <li>
                    <strong className="text-white">Impersonation:</strong> Impersonating any person, organization, or entity, or falsely claiming an affiliation with any person or organization, including Screenplay Studio staff.
                  </li>
                  <li>
                    <strong className="text-white">False Accounts:</strong> Creating accounts with false, misleading, or fraudulent registration information, or maintaining multiple accounts to manipulate features, voting, or community interactions.
                  </li>
                  <li>
                    <strong className="text-white">Illegal Content:</strong> Uploading, sharing, or distributing content that is illegal, promotes illegal activity, or violates the rights of others, including but not limited to child exploitation material, terroristic content, or content that incites violence.
                  </li>
                  <li>
                    <strong className="text-white">Copyright Infringement:</strong> Uploading, sharing, or distributing copyrighted material without proper authorization. Repeat infringers are subject to permanent account termination under our{' '}
                    <Link href="/legal/dmca" className="text-red-400 hover:text-red-300">
                      DMCA Policy
                    </Link>.
                  </li>
                </ol>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Network Security</h2>
            <p className="text-surface-300 mb-4">
              Users must not engage in any activity that compromises the security or integrity of Screenplay Studio&apos;s network, systems, or infrastructure. This includes but is not limited to:
            </p>
            <ul className="list-disc list-inside text-surface-300 space-y-2">
              <li>Monitoring or intercepting network traffic not intended for your account.</li>
              <li>Interfering with service to any user, host, or network, including mail-bombing, flooding, or deliberate overloading.</li>
              <li>Forging any TCP/IP packet header or any part of the header information in any communication.</li>
              <li>Bypassing or tampering with our security measures, encryption, or access controls.</li>
              <li>Testing the vulnerability of our systems or networks without explicit written authorization.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Responsible Disclosure</h2>
            <p className="text-surface-300 mb-4">
              If you discover a security vulnerability in Screenplay Studio, we encourage you to report it responsibly. Please do <strong className="text-white">not</strong> exploit the vulnerability or publicly disclose it before we have had a chance to address it.
            </p>
            <div className="bg-surface-900 border border-surface-800 rounded-lg p-6">
              <p className="text-surface-300 mb-2">
                <strong className="text-white">Report security vulnerabilities to:</strong>
              </p>
              <a href="mailto:security@screenplaystudio.fun" className="text-red-400 hover:text-red-300 text-lg font-mono">
                security@screenplaystudio.fun
              </a>
              <p className="text-surface-400 text-sm mt-3">
                Please include a detailed description of the vulnerability, steps to reproduce it, and any relevant screenshots or proof-of-concept code. We will acknowledge your report within 48 hours and aim to resolve verified vulnerabilities promptly.
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Rate Limits</h2>
            <p className="text-surface-300 mb-4">
              To ensure fair usage and protect our infrastructure, Screenplay Studio enforces rate limits on API requests, page loads, and certain features. These limits are designed to prevent abuse while allowing normal use of the platform.
            </p>
            <ul className="list-disc list-inside text-surface-300 space-y-2">
              <li>Rate limits vary by endpoint, account type, and subscription tier.</li>
              <li>Exceeding rate limits will result in temporary throttling (HTTP 429 responses).</li>
              <li>Persistent or deliberate rate limit abuse may result in account suspension.</li>
              <li>If you require higher rate limits for legitimate use, contact us at{' '}
                <a href="mailto:support@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                  support@screenplaystudio.fun
                </a>.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Consequences of Violations</h2>
            <p className="text-surface-300 mb-4">
              Violations of this Acceptable Use Policy may result in one or more of the following actions, at our sole discretion and depending on the severity and frequency of the violation:
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-4 bg-surface-900 border border-surface-800 rounded-lg p-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-900/50 text-yellow-400 flex items-center justify-center font-bold text-sm">1</span>
                <div>
                  <h3 className="text-white font-semibold">Warning</h3>
                  <p className="text-surface-400 text-sm">A formal notice identifying the violation and requesting immediate corrective action.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-surface-900 border border-surface-800 rounded-lg p-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-900/50 text-orange-400 flex items-center justify-center font-bold text-sm">2</span>
                <div>
                  <h3 className="text-white font-semibold">Temporary Suspension</h3>
                  <p className="text-surface-400 text-sm">Your account may be temporarily suspended for a defined period while the violation is investigated.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-surface-900 border border-surface-800 rounded-lg p-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-900/50 text-red-400 flex items-center justify-center font-bold text-sm">3</span>
                <div>
                  <h3 className="text-white font-semibold">Permanent Ban</h3>
                  <p className="text-surface-400 text-sm">Your account may be permanently terminated for severe or repeated violations.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-surface-900 border border-surface-800 rounded-lg p-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-900/50 text-red-400 flex items-center justify-center font-bold text-sm">4</span>
                <div>
                  <h3 className="text-white font-semibold">Content Removal</h3>
                  <p className="text-surface-400 text-sm">Violating content may be removed or made inaccessible without prior notice.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-surface-900 border border-surface-800 rounded-lg p-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-950/50 text-red-500 flex items-center justify-center font-bold text-sm">5</span>
                <div>
                  <h3 className="text-white font-semibold">Legal Action</h3>
                  <p className="text-surface-400 text-sm">In cases of illegal activity, significant harm, or persistent violations, we may pursue legal remedies and cooperate with law enforcement authorities.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Reporting Violations</h2>
            <p className="text-surface-300 mb-4">
              If you become aware of any violation of this Acceptable Use Policy, please report it immediately. You can report violations through the following channels:
            </p>
            <ul className="list-disc list-inside text-surface-300 space-y-2">
              <li>
                <strong className="text-white">Email:</strong>{' '}
                <a href="mailto:abuse@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                  abuse@screenplaystudio.fun
                </a>
              </li>
              <li>
                <strong className="text-white">In-App Reporting:</strong> Use the report button available on user profiles, projects, and community content.
              </li>
              <li>
                <strong className="text-white">Support:</strong> Contact our{' '}
                <Link href="/support" className="text-red-400 hover:text-red-300">
                  Support team
                </Link>{' '}
                for assistance.
              </li>
            </ul>
            <p className="text-surface-400 text-sm mt-4">
              All reports are reviewed confidentially. We do not disclose the identity of reporters unless required by law.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
