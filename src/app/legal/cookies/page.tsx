import Link from 'next/link';

export const metadata = {
  title: 'Cookie Policy | Screenplay Studio',
  description: 'Learn about how Screenplay Studio uses cookies and similar technologies.',
};

export default function CookiePolicyPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Cookies</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Cookie Policy</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white">
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">What Are Cookies?</h2>
            <p className="text-surface-300 mb-4">
              Cookies are small text files that are stored on your device (computer, tablet, or mobile) when you visit a website. They are widely used to make websites work more efficiently, provide a better user experience, and supply information to the site owners.
            </p>
            <p className="text-surface-300 mb-4">
              Screenplay Studio also uses similar technologies such as <strong className="text-white">localStorage</strong> and <strong className="text-white">sessionStorage</strong> to store preferences and session data locally in your browser. Throughout this policy, we refer to all of these technologies collectively as &ldquo;cookies.&rdquo;
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Cookie Categories</h2>

            <div className="space-y-6">
              <div className="bg-surface-900 border border-surface-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-2">1. Strictly Necessary Cookies</h3>
                <p className="text-surface-300 mb-2">
                  These cookies are essential for the website to function and cannot be switched off. They are usually set in response to actions you take, such as logging in or filling out forms. Without these cookies, core features like authentication would not work.
                </p>
                <p className="text-surface-400 text-sm">
                  <strong className="text-surface-300">Examples:</strong> Authentication session tokens, CSRF (Cross-Site Request Forgery) protection tokens.
                </p>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-2">2. Functional Cookies</h3>
                <p className="text-surface-300 mb-2">
                  These cookies enable enhanced functionality and personalization, such as remembering your display preferences, theme selection, and editor settings. They may be set by us or by third-party providers whose services we have added to our pages.
                </p>
                <p className="text-surface-400 text-sm">
                  <strong className="text-surface-300">Examples:</strong> Theme preference (dark/light mode), display settings, editor layout preferences.
                </p>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-2">3. Analytics Cookies</h3>
                <p className="text-surface-300 mb-2">
                  These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This data helps us improve the performance and usability of Screenplay Studio. All analytics data is anonymized and aggregated.
                </p>
                <p className="text-surface-400 text-sm">
                  <strong className="text-surface-300">Examples:</strong> Page views, feature usage metrics, performance data.
                </p>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-2">4. Marketing Cookies</h3>
                <p className="text-surface-300 mb-2">
                  We do <strong className="text-white">not currently use</strong> any marketing or advertising cookies. If this changes in the future, we will update this policy and request your consent before deploying any marketing cookies.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Cookies We Use</h2>
            <p className="text-surface-300 mb-4">
              The following table details the specific cookies and local storage items used by Screenplay Studio:
            </p>

            <div className="overflow-x-auto rounded-lg border border-surface-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-900">
                  <tr>
                    <th className="px-4 py-3 text-surface-300 font-semibold border-b border-surface-800">Name</th>
                    <th className="px-4 py-3 text-surface-300 font-semibold border-b border-surface-800">Provider</th>
                    <th className="px-4 py-3 text-surface-300 font-semibold border-b border-surface-800">Purpose</th>
                    <th className="px-4 py-3 text-surface-300 font-semibold border-b border-surface-800">Duration</th>
                    <th className="px-4 py-3 text-surface-300 font-semibold border-b border-surface-800">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  <tr className="bg-surface-950">
                    <td className="px-4 py-3 text-white font-mono text-xs">sb-*-auth-token</td>
                    <td className="px-4 py-3 text-surface-300">Supabase</td>
                    <td className="px-4 py-3 text-surface-300">Stores the authenticated user session token. Essential for maintaining your login state across page loads.</td>
                    <td className="px-4 py-3 text-surface-400">Session / 1 year</td>
                    <td className="px-4 py-3 text-surface-400">Strictly Necessary</td>
                  </tr>
                  <tr className="bg-surface-900">
                    <td className="px-4 py-3 text-white font-mono text-xs">sb-*-auth-token-code-verifier</td>
                    <td className="px-4 py-3 text-surface-300">Supabase</td>
                    <td className="px-4 py-3 text-surface-300">PKCE code verifier used during the OAuth authentication flow for security purposes.</td>
                    <td className="px-4 py-3 text-surface-400">Session</td>
                    <td className="px-4 py-3 text-surface-400">Strictly Necessary</td>
                  </tr>
                  <tr className="bg-surface-950">
                    <td className="px-4 py-3 text-white font-mono text-xs">sb-*-auth-token.0 / .1</td>
                    <td className="px-4 py-3 text-surface-300">Supabase</td>
                    <td className="px-4 py-3 text-surface-300">Chunked authentication cookies used when the session token exceeds maximum cookie size limits.</td>
                    <td className="px-4 py-3 text-surface-400">Session / 1 year</td>
                    <td className="px-4 py-3 text-surface-400">Strictly Necessary</td>
                  </tr>
                  <tr className="bg-surface-900">
                    <td className="px-4 py-3 text-white font-mono text-xs">ss_display_settings</td>
                    <td className="px-4 py-3 text-surface-300">Screenplay Studio</td>
                    <td className="px-4 py-3 text-surface-300">Stores your display preferences such as font size, page layout, and editor view settings.</td>
                    <td className="px-4 py-3 text-surface-400">Persistent</td>
                    <td className="px-4 py-3 text-surface-400">Functional (localStorage)</td>
                  </tr>
                  <tr className="bg-surface-950">
                    <td className="px-4 py-3 text-white font-mono text-xs">theme_preference</td>
                    <td className="px-4 py-3 text-surface-300">Screenplay Studio</td>
                    <td className="px-4 py-3 text-surface-300">Remembers your chosen color theme (dark/light mode) so it persists between visits.</td>
                    <td className="px-4 py-3 text-surface-400">Persistent</td>
                    <td className="px-4 py-3 text-surface-400">Functional (localStorage)</td>
                  </tr>
                  <tr className="bg-surface-900">
                    <td className="px-4 py-3 text-white font-mono text-xs">va</td>
                    <td className="px-4 py-3 text-surface-300">Vercel Analytics</td>
                    <td className="px-4 py-3 text-surface-300">Collects anonymized, aggregated usage data to help us understand traffic patterns and improve site performance. No personally identifiable information is stored.</td>
                    <td className="px-4 py-3 text-surface-400">Session</td>
                    <td className="px-4 py-3 text-surface-400">Analytics</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">How to Manage Cookies</h2>
            <p className="text-surface-300 mb-4">
              You have several options for controlling and managing cookies:
            </p>
            <ul className="list-disc list-inside text-surface-300 space-y-3 mb-4">
              <li>
                <strong className="text-white">Browser Settings:</strong> Most web browsers allow you to control cookies through their settings. You can typically find these in the &ldquo;Privacy&rdquo; or &ldquo;Security&rdquo; section of your browser preferences. You can choose to block all cookies, accept all cookies, or be notified when a cookie is set. Note that blocking strictly necessary cookies will prevent you from using Screenplay Studio.
              </li>
              <li>
                <strong className="text-white">In-App Preferences:</strong> Visit your{' '}
                <Link href="/settings" className="text-red-400 hover:text-red-300">
                  Settings
                </Link>{' '}
                page to manage functional preferences such as theme, display settings, and other personalization options.
              </li>
              <li>
                <strong className="text-white">Clear Existing Cookies:</strong> You can delete cookies that have already been stored on your device through your browser settings. This will sign you out of Screenplay Studio and reset your preferences.
              </li>
            </ul>

            <div className="bg-surface-900 border border-surface-800 rounded-lg p-4">
              <p className="text-surface-400 text-sm">
                <strong className="text-surface-300">Common browser cookie settings:</strong>{' '}
                Chrome (Settings → Privacy and Security → Cookies), Firefox (Settings → Privacy &amp; Security → Cookies), Safari (Preferences → Privacy), Edge (Settings → Privacy, Search, and Services → Cookies).
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Third-Party Cookies</h2>
            <p className="text-surface-300 mb-4">
              Some cookies are placed by third-party services that appear on our pages. We do not control how these third parties use their cookies. The third-party services we use include:
            </p>
            <ul className="list-disc list-inside text-surface-300 space-y-2">
              <li>
                <strong className="text-white">Supabase</strong> &mdash; Authentication and backend services. Their cookies are essential for login functionality.
              </li>
              <li>
                <strong className="text-white">Vercel</strong> &mdash; Hosting and anonymized analytics. Used to measure site performance and usage patterns.
              </li>
            </ul>
            <p className="text-surface-300 mt-4">
              We encourage you to review the privacy policies of these third-party providers for more information about how they handle your data.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Changes to This Cookie Policy</h2>
            <p className="text-surface-300 mb-4">
              We may update this Cookie Policy from time to time to reflect changes in the cookies we use, changes in technology, or for other operational, legal, or regulatory reasons. When we make changes, we will update the &ldquo;Last updated&rdquo; date at the top of this page.
            </p>
            <p className="text-surface-300 mb-4">
              If we introduce any new categories of cookies (such as marketing cookies), we will notify you and seek your consent where required by law.
            </p>
            <p className="text-surface-300">
              We recommend checking this page periodically to stay informed about our use of cookies.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
            <p className="text-surface-300">
              If you have any questions about our use of cookies, please contact us at{' '}
              <a href="mailto:support@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                support@screenplaystudio.fun
              </a>{' '}
              or visit our{' '}
              <Link href="/support" className="text-red-400 hover:text-red-300">
                Support
              </Link>{' '}
              page.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
