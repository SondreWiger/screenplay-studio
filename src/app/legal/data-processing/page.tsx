import Link from 'next/link';

export const metadata = {
  title: 'Data Processing Agreement — Screenplay Studio',
  description: 'Data Processing Agreement (DPA) for Screenplay Studio, outlining GDPR-compliant data handling, sub-processors, security measures, and data subject rights.',
};

export default function DataProcessingPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Data</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Data Processing Agreement</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white">
        <p className="text-surface-300 text-lg">
          This Data Processing Agreement (&quot;DPA&quot;) forms part of the Terms of Service between Screenplay
          Studio (&quot;Processor&quot;) and you (&quot;Controller&quot;) and governs the processing of personal
          data in connection with the Screenplay Studio service.
        </p>

        {/* ── Scope ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">1. Scope</h2>
          <p className="text-surface-300">
            This DPA applies to all personal data processed by Screenplay Studio on behalf of users in the course
            of providing the service. It covers:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>Account and profile information (name, email, avatar)</li>
            <li>Project data and content created within the platform</li>
            <li>Collaboration and communication data</li>
            <li>Usage data and analytics</li>
            <li>Payment and billing information (processed via PayPal)</li>
          </ul>
          <p className="text-surface-300">
            This DPA is designed to comply with the General Data Protection Regulation (EU) 2016/679 (&quot;GDPR&quot;)
            and supplements our <Link href="/legal/privacy" className="text-red-400 hover:text-red-300">Privacy Policy</Link>.
          </p>
        </section>

        {/* ── Definitions ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">2. Definitions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="py-3 pr-4 text-white font-semibold">Term</th>
                  <th className="py-3 text-white font-semibold">Definition</th>
                </tr>
              </thead>
              <tbody className="text-surface-300">
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Controller</td>
                  <td className="py-3">
                    The user or entity that determines the purposes and means of the processing of personal data.
                    In most cases, this is you — the Screenplay Studio user.
                  </td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Processor</td>
                  <td className="py-3">
                    Screenplay Studio, which processes personal data on behalf of the Controller to provide the service.
                  </td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Sub-processor</td>
                  <td className="py-3">
                    A third-party service provider engaged by Screenplay Studio to assist in processing personal data
                    (e.g., hosting providers, payment processors).
                  </td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Data Subject</td>
                  <td className="py-3">
                    An identified or identifiable natural person whose personal data is processed. This includes
                    end users, collaborators, and any individual whose data appears in content created on the platform.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Processor Obligations ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">3. Processor Obligations</h2>
          <p className="text-surface-300">
            In accordance with Article 28 of the GDPR, Screenplay Studio as Processor shall:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>Process personal data only on documented instructions from the Controller</li>
            <li>Ensure all persons authorized to process personal data are bound by confidentiality obligations</li>
            <li>Implement appropriate technical and organizational security measures</li>
            <li>Respect the conditions for engaging sub-processors</li>
            <li>Assist the Controller in responding to data subject rights requests</li>
            <li>Assist the Controller in ensuring compliance with security, breach notification, and DPIA obligations</li>
            <li>Delete or return all personal data upon termination of the service, at the Controller&apos;s choice</li>
            <li>Make available all information necessary to demonstrate compliance with Article 28 obligations</li>
          </ul>
        </section>

        {/* ── Sub-processors ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">4. Sub-processors</h2>
          <p className="text-surface-300">
            We engage the following sub-processors to deliver our service. Each sub-processor is bound by data
            processing agreements that offer equivalent protections to this DPA.
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="py-3 pr-4 text-white font-semibold">Sub-processor</th>
                  <th className="py-3 pr-4 text-white font-semibold">Purpose</th>
                  <th className="py-3 pr-4 text-white font-semibold">Data Location</th>
                </tr>
              </thead>
              <tbody className="text-surface-300">
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Supabase Inc.</td>
                  <td className="py-3 pr-4">Database hosting, authentication, file storage</td>
                  <td className="py-3 pr-4">EU (Frankfurt)</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Vercel Inc.</td>
                  <td className="py-3 pr-4">Application hosting, CDN, edge functions</td>
                  <td className="py-3 pr-4">Global with EU edge nodes</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">PayPal (Europe) S.à r.l. et Cie, S.C.A.</td>
                  <td className="py-3 pr-4">Payment processing, subscription billing</td>
                  <td className="py-3">EU / US</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-surface-300 mt-4">
            We will notify you of any intended changes to our sub-processors at least 30 days in advance, giving you
            the opportunity to object. If you object and we cannot reasonably accommodate your objection, you may
            terminate the affected services.
          </p>
        </section>

        {/* ── Data Subject Rights ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">5. Data Subject Rights</h2>
          <p className="text-surface-300">
            Screenplay Studio will assist the Controller in fulfilling data subject requests under GDPR Articles 15–22,
            including:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li><strong className="text-white">Right of access</strong> — We provide data export tools in your account settings</li>
            <li><strong className="text-white">Right to rectification</strong> — You can update your data at any time through your profile</li>
            <li><strong className="text-white">Right to erasure</strong> — Account and content deletion is available in settings</li>
            <li><strong className="text-white">Right to restrict processing</strong> — Contact us to restrict specific processing activities</li>
            <li><strong className="text-white">Right to data portability</strong> — Export your data in standard formats (JSON, PDF, Fountain)</li>
            <li><strong className="text-white">Right to object</strong> — You may object to specific processing; we will cease unless we have compelling legitimate grounds</li>
          </ul>
          <p className="text-surface-300">
            We will respond to data subject requests within 30 days. For complex requests, this may be extended by an
            additional 60 days with notification.
          </p>
        </section>

        {/* ── Security Measures ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">6. Security Measures</h2>
          <p className="text-surface-300">
            We implement the following technical and organizational measures to protect personal data:
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="py-3 pr-4 text-white font-semibold">Measure</th>
                  <th className="py-3 pr-4 text-white font-semibold">Implementation</th>
                  <th className="py-3 text-white font-semibold">Standard</th>
                </tr>
              </thead>
              <tbody className="text-surface-300">
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Encryption at rest</td>
                  <td className="py-3 pr-4">All data encrypted at rest in the database and file storage</td>
                  <td className="py-3">AES-256</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Encryption in transit</td>
                  <td className="py-3 pr-4">All data encrypted during transmission between client and server</td>
                  <td className="py-3">TLS 1.3</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Row Level Security</td>
                  <td className="py-3 pr-4">Database-level policies ensuring users can only access their own data</td>
                  <td className="py-3">Supabase RLS</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Access logging</td>
                  <td className="py-3 pr-4">Comprehensive logging of data access for audit purposes</td>
                  <td className="py-3">Real-time</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Automated backups</td>
                  <td className="py-3 pr-4">Regular encrypted backups with point-in-time recovery</td>
                  <td className="py-3">Daily + PITR</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Penetration testing</td>
                  <td className="py-3 pr-4">Regular security assessments by independent parties</td>
                  <td className="py-3">Annual</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Breach Notification ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">7. Breach Notification</h2>
          <p className="text-surface-300">
            In the event of a personal data breach, Screenplay Studio will:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              Notify the Controller without undue delay and within <strong className="text-white">72 hours</strong> of
              becoming aware of the breach
            </li>
            <li>
              Provide the following details:
              <ul className="mt-2 space-y-1">
                <li>Nature of the breach, including categories and approximate number of data subjects affected</li>
                <li>Name and contact details of the data protection point of contact</li>
                <li>Likely consequences of the breach</li>
                <li>Measures taken or proposed to address the breach and mitigate its effects</li>
              </ul>
            </li>
            <li>Document all breaches, including facts, effects, and remedial actions taken</li>
            <li>Cooperate with the Controller and supervisory authorities as required</li>
          </ul>
        </section>

        {/* ── Audit Rights ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">8. Audit Rights</h2>
          <p className="text-surface-300">
            The Controller has the right to audit Screenplay Studio&apos;s compliance with this DPA. This includes:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>Requesting documentation of our security measures and data processing activities</li>
            <li>Conducting or commissioning audits and inspections, with reasonable prior notice</li>
            <li>Reviewing our sub-processor agreements and security certifications</li>
          </ul>
          <p className="text-surface-300">
            Audits shall be conducted during normal business hours with at least 30 days&apos; written notice. We may
            charge reasonable fees for audits that exceed one per year.
          </p>
        </section>

        {/* ── Data Return & Deletion ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">9. Data Return &amp; Deletion Upon Termination</h2>
          <p className="text-surface-300">
            Upon termination of the service or at the Controller&apos;s request:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Data return:</strong> We will provide all personal data in a structured,
              commonly used, machine-readable format (JSON, CSV, or PDF as applicable)
            </li>
            <li>
              <strong className="text-white">Data deletion:</strong> We will delete all personal data within 30 days
              of termination, including from backups, unless retention is required by law
            </li>
            <li>
              <strong className="text-white">Certification:</strong> Upon request, we will provide written confirmation
              that all data has been deleted
            </li>
          </ul>
        </section>

        {/* ── International Transfers ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">10. International Data Transfers</h2>
          <p className="text-surface-300">
            We take the following measures to ensure lawful international data transfers:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">EU-US Data Privacy Framework:</strong> Our US-based sub-processors
              (where applicable) participate in and are certified under the EU-US Data Privacy Framework
            </li>
            <li>
              <strong className="text-white">Standard Contractual Clauses (SCCs):</strong> Where the Data Privacy
              Framework does not apply, we rely on the European Commission&apos;s Standard Contractual Clauses
              (2021/914) to safeguard transfers
            </li>
            <li>
              <strong className="text-white">Data localization:</strong> Our primary database is hosted in the EU
              (Frankfurt). Application data is served via Vercel&apos;s global edge network with EU edge nodes
              prioritized for EU users
            </li>
          </ul>
        </section>

        {/* ── TOMS ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">11. Technical and Organizational Measures (TOMs)</h2>
          <p className="text-surface-300">
            The following is a comprehensive list of our Technical and Organizational Measures:
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="py-3 pr-4 text-white font-semibold">Category</th>
                  <th className="py-3 pr-4 text-white font-semibold">Measure</th>
                  <th className="py-3 text-white font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="text-surface-300">
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Confidentiality</td>
                  <td className="py-3 pr-4">Access control</td>
                  <td className="py-3">Role-based access, Row Level Security, project-level permissions</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Confidentiality</td>
                  <td className="py-3 pr-4">Authentication</td>
                  <td className="py-3">Supabase Auth, bcrypt hashing, session tokens, email verification</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Confidentiality</td>
                  <td className="py-3 pr-4">Encryption</td>
                  <td className="py-3">AES-256 at rest, TLS 1.3 in transit</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Integrity</td>
                  <td className="py-3 pr-4">Input validation</td>
                  <td className="py-3">Server-side validation, parameterized queries, XSS prevention</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Integrity</td>
                  <td className="py-3 pr-4">Change management</td>
                  <td className="py-3">Version-controlled deployments, automated testing, staging environment</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Availability</td>
                  <td className="py-3 pr-4">Backup &amp; recovery</td>
                  <td className="py-3">Daily automated backups, point-in-time recovery, encrypted backup storage</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Availability</td>
                  <td className="py-3 pr-4">Infrastructure</td>
                  <td className="py-3">Vercel edge network, geographic redundancy, auto-scaling</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Availability</td>
                  <td className="py-3 pr-4">Monitoring</td>
                  <td className="py-3">Real-time error tracking, uptime monitoring, anomaly detection</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Resilience</td>
                  <td className="py-3 pr-4">Incident response</td>
                  <td className="py-3">Documented incident response plan, 72h breach notification, post-mortems</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Resilience</td>
                  <td className="py-3 pr-4">Testing</td>
                  <td className="py-3">Annual penetration testing, vulnerability scanning, dependency audits</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Accountability</td>
                  <td className="py-3 pr-4">Logging &amp; audit</td>
                  <td className="py-3">Access logging, request logging, audit trail for sensitive operations</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Accountability</td>
                  <td className="py-3 pr-4">Data minimization</td>
                  <td className="py-3">Collect only necessary data, automatic data expiry, anonymization</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Contact ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">12. Contact</h2>
          <p className="text-surface-300">
            For questions about this Data Processing Agreement, contact our Data Protection Officer at{' '}
            <a href="mailto:dpo@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
              dpo@screenplaystudio.fun
            </a>.
          </p>
        </section>

        {/* ── Related Policies ── */}
        <section className="mt-12 rounded-lg bg-surface-900 border border-surface-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Related Policies</h3>
          <ul className="text-surface-300 space-y-2 list-none pl-0">
            <li>
              <Link href="/legal/privacy" className="text-red-400 hover:text-red-300">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/legal/security" className="text-red-400 hover:text-red-300">Security Policy</Link>
            </li>
            <li>
              <Link href="/legal/copyright" className="text-red-400 hover:text-red-300">Copyright &amp; IP Policy</Link>
            </li>
            <li>
              <Link href="/legal/terms" className="text-red-400 hover:text-red-300">Terms of Service</Link>
            </li>
          </ul>
        </section>
      </article>
      </div>
    </div>
  );
}
