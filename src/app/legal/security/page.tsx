import Link from 'next/link';

export const metadata = {
  title: 'Security Policy — Screenplay Studio',
  description: 'Learn about our infrastructure security, encryption, access controls, vulnerability disclosure program, and compliance measures at Screenplay Studio.',
};

export default function SecurityPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Security</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Security</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white">
        {/* ── Security Commitment ── */}
        <section>
          <h2 className="text-2xl font-semibold text-white">1. Our Security Commitment</h2>
          <p className="text-surface-300">
            Screenplay Studio is built with security at its core. Your screenplays, stories, and creative works
            are valuable intellectual property, and we treat them with the highest level of care. This policy
            outlines the technical and organizational measures we employ to protect your data.
          </p>
        </section>

        {/* ── Infrastructure ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">2. Infrastructure Security</h2>
          <p className="text-surface-300">
            Our infrastructure is designed for reliability, performance, and security:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Vercel Edge Network:</strong> Our application is deployed on
              Vercel&apos;s global edge network, providing low-latency access with built-in DDoS protection
              and automatic failover across multiple regions.
            </li>
            <li>
              <strong className="text-white">Supabase Managed PostgreSQL:</strong> Our database runs on
              Supabase&apos;s managed PostgreSQL infrastructure hosted in the EU (Frankfurt), with
              enterprise-grade security controls, automated patching, and continuous monitoring.
            </li>
            <li>
              <strong className="text-white">Geographic redundancy:</strong> Data is replicated across
              multiple availability zones to ensure high availability. Backups are stored in geographically
              separate locations for disaster recovery.
            </li>
          </ul>
        </section>

        {/* ── Application Security ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">3. Application Security</h2>
          <p className="text-surface-300">
            We implement multiple layers of application-level security:
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="py-3 pr-4 text-white font-semibold">Protection</th>
                  <th className="py-3 text-white font-semibold">Implementation</th>
                </tr>
              </thead>
              <tbody className="text-surface-300">
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">CSRF Protection</td>
                  <td className="py-3">
                    Anti-CSRF tokens are used on all state-changing requests, preventing cross-site request forgery attacks.
                  </td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">XSS Prevention</td>
                  <td className="py-3">
                    All user input is sanitized and escaped before rendering. React&apos;s built-in XSS protections are
                    complemented by strict Content Security Policy headers.
                  </td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">SQL Injection Prevention</td>
                  <td className="py-3">
                    All database queries use parameterized queries through Supabase&apos;s client library, eliminating
                    SQL injection vectors.
                  </td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Rate Limiting</td>
                  <td className="py-3">
                    Middleware-level rate limiting protects all API endpoints from abuse, with progressive backoff for
                    repeated violations.
                  </td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">CSP Headers</td>
                  <td className="py-3">
                    Strict Content Security Policy headers restrict resource loading to trusted origins, mitigating
                    injection and data exfiltration risks.
                  </td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Input Validation &amp; Sanitization</td>
                  <td className="py-3">
                    All user input is validated on the server side with strict type checking, length limits, and
                    content sanitization before processing or storage.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Authentication ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">4. Authentication &amp; Identity</h2>
          <p className="text-surface-300">
            We use Supabase Auth for secure, industry-standard authentication:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Password hashing:</strong> All passwords are hashed using bcrypt with
              a unique salt per user. We never store plain-text passwords.
            </li>
            <li>
              <strong className="text-white">Session management:</strong> Session tokens are issued as httpOnly,
              Secure cookies with SameSite attributes, preventing client-side JavaScript access and cross-site attacks.
            </li>
            <li>
              <strong className="text-white">Email verification:</strong> All accounts require email verification
              before gaining full access to the platform.
            </li>
            <li>
              <strong className="text-white">Suspicious login detection:</strong> We monitor for unusual login
              patterns, including logins from new devices, unexpected geographic locations, and rapid successive
              authentication attempts. Suspicious activity triggers additional verification steps.
            </li>
          </ul>
        </section>

        {/* ── Encryption ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">5. Encryption</h2>
          <p className="text-surface-300">
            Your data is encrypted at every stage:
          </p>
          <div className="rounded-lg bg-surface-900 border border-surface-800 p-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-white font-semibold mb-2">At Rest</h4>
                <p className="text-surface-300 text-sm">
                  All data stored in our database and file storage is encrypted using <strong className="text-white">AES-256</strong> encryption,
                  the same standard used by financial institutions and government agencies.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">In Transit</h4>
                <p className="text-surface-300 text-sm">
                  All data transmitted between your browser and our servers is encrypted using{' '}
                  <strong className="text-white">TLS 1.3</strong>, the latest and most secure transport protocol.
                  We enforce HTTPS on all connections.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">Backups</h4>
                <p className="text-surface-300 text-sm">
                  All database backups are encrypted before storage and kept in geographically separate,
                  access-controlled locations. Backup encryption keys are managed separately from data encryption keys.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Access Controls ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">6. Access Controls</h2>
          <p className="text-surface-300">
            We enforce strict access controls at multiple levels:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Row Level Security (RLS):</strong> PostgreSQL Row Level Security
              policies ensure that database queries can only return data the authenticated user is authorized to
              access. This provides a security guarantee at the database level, independent of application logic.
            </li>
            <li>
              <strong className="text-white">Role-based access:</strong> Users are assigned roles (owner, editor,
              viewer) that determine their permissions within projects and across the platform.
            </li>
            <li>
              <strong className="text-white">Project-level permissions:</strong> Each project has granular
              permission settings controlling who can view, edit, comment on, or manage the project and its contents.
            </li>
            <li>
              <strong className="text-white">Admin panel restrictions:</strong> Administrative functions are
              restricted to authorized personnel with elevated credentials, separate authentication, and full
              audit logging of all administrative actions.
            </li>
          </ul>
        </section>

        {/* ── Monitoring ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">7. Monitoring &amp; Detection</h2>
          <p className="text-surface-300">
            We continuously monitor our systems to detect and respond to threats:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Request &amp; error logging:</strong> All API requests and errors
              are logged with relevant metadata for security analysis and debugging.
            </li>
            <li>
              <strong className="text-white">Anomaly detection:</strong> Automated systems monitor for unusual
              patterns in traffic, authentication attempts, data access, and API usage that may indicate an
              attack or compromise.
            </li>
            <li>
              <strong className="text-white">Real-time alerts:</strong> Critical security events trigger
              immediate alerts to our engineering team, enabling rapid response to potential incidents.
            </li>
          </ul>
        </section>

        {/* ── Vulnerability Disclosure ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">8. Vulnerability Disclosure Program</h2>
          <p className="text-surface-300">
            We welcome responsible security research and vulnerability reports from the community.
          </p>
          <div className="rounded-lg bg-surface-900 border border-surface-800 p-6 mt-4">
            <h4 className="text-white font-semibold mb-3">Reporting a Vulnerability</h4>
            <p className="text-surface-300 mb-4">
              If you discover a security vulnerability in Screenplay Studio, please report it responsibly:
            </p>
            <ul className="text-surface-300 space-y-2">
              <li>
                <strong className="text-white">Email:</strong>{' '}
                <a href="mailto:security@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                  security@screenplaystudio.fun
                </a>
              </li>
              <li>
                <strong className="text-white">Disclosure timeline:</strong> We follow a 90-day coordinated
                disclosure timeline. We ask that you give us 90 days from your report to address the vulnerability
                before making any public disclosure.
              </li>
              <li>
                <strong className="text-white">Recognition:</strong> We recognize and credit security researchers
                who responsibly report valid vulnerabilities. With your permission, we will acknowledge your
                contribution publicly.
              </li>
            </ul>
            <h4 className="text-white font-semibold mt-6 mb-3">What We Ask</h4>
            <ul className="text-surface-300 space-y-1">
              <li>Do not access or modify other users&apos; data</li>
              <li>Do not perform denial-of-service attacks</li>
              <li>Do not use automated scanning tools without prior authorization</li>
              <li>Provide sufficient detail for us to reproduce the issue</li>
            </ul>
          </div>
        </section>

        {/* ── Incident Response ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">9. Incident Response</h2>
          <p className="text-surface-300">
            We maintain a structured incident response process:
          </p>
          <div className="mt-4 space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center text-white font-bold text-sm">1</div>
              <div>
                <h4 className="text-white font-semibold">Detect</h4>
                <p className="text-surface-400 text-sm">Identify the security incident through monitoring, alerts, or external reports.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center text-white font-bold text-sm">2</div>
              <div>
                <h4 className="text-white font-semibold">Contain</h4>
                <p className="text-surface-400 text-sm">Immediately isolate affected systems and prevent further damage or data exposure.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center text-white font-bold text-sm">3</div>
              <div>
                <h4 className="text-white font-semibold">Assess</h4>
                <p className="text-surface-400 text-sm">Determine the scope, severity, and impact of the incident, including what data may be affected.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center text-white font-bold text-sm">4</div>
              <div>
                <h4 className="text-white font-semibold">Notify (within 72 hours)</h4>
                <p className="text-surface-400 text-sm">Notify affected users and relevant supervisory authorities within 72 hours of confirming a data breach, as required by GDPR.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center text-white font-bold text-sm">5</div>
              <div>
                <h4 className="text-white font-semibold">Remediate</h4>
                <p className="text-surface-400 text-sm">Fix the root cause, patch vulnerabilities, and restore affected systems to full operation.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center text-white font-bold text-sm">6</div>
              <div>
                <h4 className="text-white font-semibold">Post-mortem</h4>
                <p className="text-surface-400 text-sm">Conduct a thorough review of the incident, document lessons learned, and implement preventive measures.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Compliance ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">10. Compliance</h2>
          <p className="text-surface-300">
            Screenplay Studio is designed to comply with major data protection regulations:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">GDPR</strong> (General Data Protection Regulation) — We comply with
              all GDPR requirements for EU users, including data subject rights, lawful processing bases, and
              cross-border transfer safeguards. See our{' '}
              <Link href="/legal/data-processing" className="text-red-400 hover:text-red-300">Data Processing Agreement</Link> for details.
            </li>
            <li>
              <strong className="text-white">CCPA</strong> (California Consumer Privacy Act) — California residents
              have additional rights under the CCPA, including the right to know what personal information is collected,
              the right to delete, and the right to opt out of the sale of personal information. We do not sell personal
              information. See our <Link href="/legal/privacy" className="text-red-400 hover:text-red-300">Privacy Policy</Link> for
              CCPA-specific disclosures.
            </li>
          </ul>
        </section>

        {/* ── Security Updates ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">11. Security Updates</h2>
          <p className="text-surface-300">
            We maintain the security of our platform through:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>Regular dependency updates and vulnerability patching</li>
            <li>Automated security scanning of our codebase and dependencies</li>
            <li>Prompt application of critical security patches (within 24 hours for critical vulnerabilities)</li>
            <li>Version-controlled deployments with rollback capability</li>
          </ul>
        </section>

        {/* ── Penetration Testing ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">12. Penetration Testing</h2>
          <p className="text-surface-300">
            We conduct <strong className="text-white">annual penetration testing</strong> performed by qualified
            independent security professionals. These assessments cover:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>Web application security testing (OWASP Top 10)</li>
            <li>API security assessment</li>
            <li>Authentication and authorization testing</li>
            <li>Infrastructure and configuration review</li>
          </ul>
          <p className="text-surface-300">
            Findings are prioritized by severity and addressed promptly. Critical and high-severity findings are
            remediated immediately, with verification testing to confirm fixes.
          </p>
        </section>

        {/* ── Contact ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">13. Contact</h2>
          <p className="text-surface-300">
            For security concerns or questions about this policy:
          </p>
          <ul className="text-surface-300 space-y-1 list-none pl-0">
            <li>
              <strong className="text-white">Security issues:</strong>{' '}
              <a href="mailto:security@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                security@screenplaystudio.fun
              </a>
            </li>
            <li>
              <strong className="text-white">General inquiries:</strong>{' '}
              <a href="mailto:support@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                support@screenplaystudio.fun
              </a>
            </li>
          </ul>
        </section>

        {/* ── Related Policies ── */}
        <section className="mt-12 rounded-lg bg-surface-900 border border-surface-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Related Policies</h3>
          <ul className="text-surface-300 space-y-2 list-none pl-0">
            <li>
              <Link href="/legal/privacy" className="text-red-400 hover:text-red-300">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/legal/data-processing" className="text-red-400 hover:text-red-300">Data Processing Agreement</Link>
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
