import Link from 'next/link';

export const metadata = {
  title: 'Open-Source Kill Switch — Screenplay Studio',
  description: 'Our open-source kill switch policy: how we use feature flags to disable platform features, your rights, and transparency commitments.',
};

export default function OpensourceKillswitchPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Platform Safety</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Open-Source Kill Switch</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 rounded-lg bg-surface-900/50 border border-surface-800/60 p-6">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">Table of Contents</h2>
          <ol className="list-decimal list-inside space-y-1.5 text-surface-400 text-[13px] columns-1 sm:columns-2 gap-8">
            <li><a href="#what" className="hover:text-red-400 transition-colors">What Is the Open-Source Kill Switch</a></li>
            <li><a href="#why" className="hover:text-red-400 transition-colors">Why It Exists</a></li>
            <li><a href="#scope" className="hover:text-red-400 transition-colors">What It Controls</a></li>
            <li><a href="#how" className="hover:text-red-400 transition-colors">How It Works</a></li>
            <li><a href="#your-rights" className="hover:text-red-400 transition-colors">Your Rights</a></li>
            <li><a href="#transparency" className="hover:text-red-400 transition-colors">Transparency Commitments</a></li>
            <li><a href="#limitations" className="hover:text-red-400 transition-colors">Limitations</a></li>
            <li><a href="#contact" className="hover:text-red-400 transition-colors">Contact</a></li>
          </ol>
        </nav>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white prose-headings:border-b prose-headings:border-surface-800/60 prose-headings:pb-3 prose-headings:mb-5">
          {/* 1. What Is the Open-Source Kill Switch */}
          <h2 id="what" className="scroll-mt-24">1. What Is the Open-Source Kill Switch</h2>
          <p>
            Screenplay Studio includes an open-source kill switch &mdash; a platform-level control that allows us to
            instantly disable specific features across the entire platform without requiring a code deployment or
            server restart. This mechanism is built on our feature flags system and is governed by strict internal
            policies.
          </p>
          <p>
            The kill switch is designed as a safety tool, not a censorship mechanism. It exists to protect users,
            maintain platform integrity, and respond to urgent situations such as security vulnerabilities, legal
            requirements, or misbehaving features.
          </p>

          {/* 2. Why It Exists */}
          <h2 id="why" className="scroll-mt-24">2. Why It Exists</h2>
          <p>
            The open-source kill switch serves several important purposes:
          </p>
          <ul>
            <li>
              <strong className="text-white">User safety:</strong> If a feature is discovered to have a security
              vulnerability or is being exploited in a way that threatens user data or privacy, we can disable it
              immediately while a fix is developed.
            </li>
            <li>
              <strong className="text-white">Platform stability:</strong> If a feature is causing unexpected
              performance degradation, data corruption, or service instability, the kill switch allows us to
              isolate the problem without taking down the entire platform.
            </li>
            <li>
              <strong className="text-white">Legal compliance:</strong> If a feature is found to conflict with
              applicable laws, regulations, or court orders in a specific jurisdiction, we can disable it to
              maintain compliance while we evaluate next steps.
            </li>
            <li>
              <strong className="text-white">Rollback capability:</strong> When deploying new features, the kill
              switch provides a safety net. If a newly released feature causes unexpected issues, we can disable
              it instantly rather than rolling back an entire deployment.
            </li>
            <li>
              <strong className="text-white">Community protection:</strong> If a feature is being used in violation
              of our <Link href="/legal/community-guidelines" className="text-red-400 hover:text-red-300 transition-colors">Community Guidelines</Link> or{' '}
              <Link href="/legal/acceptable-use" className="text-red-400 hover:text-red-300 transition-colors">Acceptable Use Policy</Link> at
              scale, the kill switch allows us to address the issue while preserving access to all other features.
            </li>
          </ul>

          {/* 3. What It Controls */}
          <h2 id="scope" className="scroll-mt-24">3. What It Controls</h2>
          <p>
            The kill switch operates through our feature flags system. Each feature on the platform is associated
            with a feature flag that has one of four tiers:
          </p>
          <div className="overflow-x-auto not-prose">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="text-left py-2 pr-4 text-white">Tier</th>
                  <th className="text-left py-2 pr-4 text-white">Access</th>
                  <th className="text-left py-2 text-white">Description</th>
                </tr>
              </thead>
              <tbody className="text-surface-300">
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4 font-medium text-white">Released</td>
                  <td className="py-2 pr-4">All users</td>
                  <td className="py-2">Feature is fully available to everyone</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4 font-medium text-white">Beta</td>
                  <td className="py-2 pr-4">Selected users</td>
                  <td className="py-2">Feature is in beta testing with a subset of users</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4 font-medium text-white">Alpha</td>
                  <td className="py-2 pr-4">Internal only</td>
                  <td className="py-2">Feature is in early development, not publicly accessible</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-white">Disabled</td>
                  <td className="py-2 pr-4">No one</td>
                  <td className="py-2">Feature is completely off &mdash; this is the kill switch state</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            When the kill switch is activated for a feature, its tier is set to <strong className="text-white">Disabled</strong>.
            This immediately hides all UI elements associated with that feature from every user on the platform.
            No server redeployment is required &mdash; the change takes effect within seconds as client applications
            refresh their feature flag state.
          </p>

          {/* 4. How It Works */}
          <h2 id="how" className="scroll-mt-24">4. How It Works</h2>
          <p>
            The kill switch operates through a database-driven feature flag system. Here is the technical flow:
          </p>
          <ol>
            <li>
              <strong className="text-white">Flag storage:</strong> Feature flags are stored in a PostgreSQL
              database table (<code className="text-surface-300 bg-surface-900 px-1.5 py-0.5 rounded text-sm">feature_flags</code>)
              with tier-based access control.
            </li>
            <li>
              <strong className="text-white">Admin action:</strong> An authorized administrator navigates to the
              admin panel at <code className="text-surface-300 bg-surface-900 px-1.5 py-0.5 rounded text-sm">/admin/features</code> and
              changes a feature&apos;s tier to &quot;Disabled.&quot;
            </li>
            <li>
              <strong className="text-white">Database update:</strong> The tier change is written to the database
              with Row Level Security (RLS) ensuring only admin users can modify feature flags.
            </li>
            <li>
              <strong className="text-white">Client propagation:</strong> Client applications fetch feature flags
              from the database and cache them for up to 60 seconds. Within this window, all clients will see
              the feature as disabled.
            </li>
            <li>
              <strong className="text-white">UI update:</strong> The client-side feature gate component
              (<code className="text-surface-300 bg-surface-900 px-1.5 py-0.5 rounded text-sm">FeatureGate</code>)
              checks the flag tier and returns <code className="text-surface-300 bg-surface-900 px-1.5 py-0.5 rounded text-sm">false</code> for
              disabled features, causing the associated UI to be hidden.
            </li>
          </ol>

          {/* 5. Your Rights */}
          <h2 id="your-rights" className="scroll-mt-24">5. Your Rights</h2>
          <p>
            The open-source kill switch is designed with user rights in mind:
          </p>
          <ul>
            <li>
              <strong className="text-white">No content deletion:</strong> Disabling a feature does not delete,
              modify, or restrict access to any of your content. Your screenplays, scripts, and all creative
              works remain fully accessible and intact.
            </li>
            <li>
              <strong className="text-white">No account impact:</strong> Activating the kill switch does not
              affect your account status, subscription, or access to other features on the platform.
            </li>
            <li>
              <strong className="text-white">Data portability preserved:</strong> Your ability to export your
              content is never affected by the kill switch. Export functionality operates independently of
              individual feature flags.
            </li>
            <li>
              <strong className="text-white">Notification:</strong> When a feature is disabled due to the kill
              switch, we will provide notice through appropriate channels, including email notifications for
              features that materially affect your workflow, and in-app messaging where feasible.
            </li>
            <li>
              <strong className="text-white">Restoration:</strong> Features disabled via the kill switch will be
              restored as soon as the underlying issue is resolved. There is no indefinite suspension of features
              through this mechanism.
            </li>
          </ul>

          {/* 6. Transparency Commitments */}
          <h2 id="transparency" className="scroll-mt-24">6. Transparency Commitments</h2>
          <p>
            We are committed to transparency in how we use the kill switch:
          </p>
          <ul>
            <li>
              <strong className="text-white">Public changelog:</strong> All feature flag changes are logged and
              documented in our platform changelog. Significant kill switch activations will be accompanied by
              a post explaining the reason and expected resolution timeline.
            </li>
            <li>
              <strong className="text-white">No hidden deprecation:</strong> The kill switch will never be used
              to permanently remove a feature without going through our standard
              <Link href="/legal/terms" className="text-red-400 hover:text-red-300 transition-colors">Terms of Service</Link> change
              process, including the required 30-day advance notice for material changes.
            </li>
            <li>
              <strong className="text-white">Audit trail:</strong> All kill switch activations are logged with
              timestamps, the administrator who performed the action, and the reason for activation. These
              logs are retained for audit purposes.
            </li>
            <li>
              <strong className="text-white">Annual reporting:</strong> We will publish an annual transparency
              report summarizing how many times the kill switch was activated, for which features, and the
              general categories of reasons (security, stability, compliance, etc.).
            </li>
          </ul>

          {/* 7. Limitations */}
          <h2 id="limitations" className="scroll-mt-24">7. Limitations</h2>
          <p>
            The kill switch has inherent limitations that are important to understand:
          </p>
          <ul>
            <li>
              <strong className="text-white">Client-side caching:</strong> Because feature flags are cached on
              the client for up to 60 seconds, there may be a brief window (up to one minute) after activation
              where some users still see the feature before their cache refreshes.
            </li>
            <li>
              <strong className="text-white">API access:</strong> If you access Screenplay Studio data through
              our API, feature flag changes may not immediately affect API behavior. API-level access controls
              operate independently of the feature flag system.
            </li>
            <li>
              <strong className="text-white">Third-party integrations:</strong> Features that integrate with
              third-party services may have partial functionality even when the kill switch is activated, if
              the third-party service continues to operate independently.
            </li>
            <li>
              <strong className="text-white">Not a substitute for deployment:</strong> The kill switch is designed
              for emergency response. For planned feature deprecations, we follow our standard deprecation
              process with appropriate notice periods as outlined in our Terms of Service.
            </li>
          </ul>

          {/* 8. Contact */}
          <h2 id="contact" className="scroll-mt-24">8. Contact</h2>
          <p>
            If you have questions about the open-source kill switch, how it has been used, or its impact
            on your access to the platform, please contact us:
          </p>
          <div className="rounded-lg bg-surface-900 border border-surface-800 p-4 not-prose text-surface-300">
            <p><strong className="text-white">Northem Development</strong></p>
            <p className="mt-1 text-surface-400 text-sm">Operator of Screenplay Studio</p>
            <p className="mt-2">Legal Department</p>
            <p>Email: <a href="mailto:legal@screenplaystudio.fun" className="text-red-400 hover:text-red-300 transition-colors">legal@screenplaystudio.fun</a></p>
            <p className="mt-2">
              <a href="https://development.northem.no/" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 transition-colors">development.northem.no</a>
            </p>
          </div>

          {/* Related Policies */}
          <section className="mt-12 rounded-lg bg-surface-900 border border-surface-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Related Policies</h3>
            <ul className="text-surface-300 space-y-2 list-none pl-0">
              <li>
                <Link href="/legal/terms" className="text-red-400 hover:text-red-300">Terms of Service</Link>
              </li>
              <li>
                <Link href="/legal/security" className="text-red-400 hover:text-red-300">Security Policy</Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="text-red-400 hover:text-red-300">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/legal/acceptable-use" className="text-red-400 hover:text-red-300">Acceptable Use Policy</Link>
              </li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
