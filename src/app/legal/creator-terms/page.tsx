import Link from 'next/link';

export const metadata = {
  title: 'Creator Affiliate Terms — Screenplay Studio',
  description:
    'Terms and conditions for participating in the Screenplay Studio Creator Affiliate Program, including referral tracking, proportional payouts, and eligibility requirements.',
};

export default function CreatorTermsPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-[#FF5F1F] uppercase tracking-wider mb-3">Creator Program</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Creator Affiliate Terms</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: subject to program availability</p>
        </div>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-[#FF5F1F] prose-a:no-underline hover:prose-a:text-orange-400 prose-strong:text-white">

          <section>
            <h2 className="text-2xl font-semibold text-white">1. Overview</h2>
            <p className="text-surface-300">
              The Screenplay Studio Creator Affiliate Program (&ldquo;Program&rdquo;) allows approved creators to earn
              monetary compensation by referring new users to Screenplay Studio through unique referral links. These
              terms govern your participation in the Program and supplement our general{' '}
              <Link href="/legal/terms">Terms of Service</Link>.
            </p>
            <p className="text-surface-300">
              By applying to or participating in the Program, you agree to these Creator Affiliate Terms in full.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">2. Eligibility &amp; Application</h2>
            <ul className="text-surface-300 space-y-2">
              <li>You must have an active Screenplay Studio account in good standing.</li>
              <li>Applications are reviewed manually and approved at Screenplay Studio&rsquo;s sole discretion.</li>
              <li>Acceptance into the Program does not guarantee continued participation or any specific payout amount.</li>
              <li>You must be at least 18 years old, or have parental/guardian consent where applicable law requires it.</li>
              <li>Approved creators are assigned a unique referral code (your username) used to identify referred signups.</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">3. Referral Tracking</h2>
            <p className="text-surface-300">
              When a user visits <code>/ref/[your-username]</code>, their visit is recorded and a first-party
              browser token is stored in localStorage. If that visitor creates a new Screenplay Studio account
              within the same browser session, the signup is attributed to your referral link.
            </p>
            <ul className="text-surface-300 space-y-2">
              <li>Each new account can only be attributed to one creator (the most recent referral link visited).</li>
              <li>Self-referrals are not counted — you cannot earn credit for your own signup.</li>
              <li>We do not use third-party cookies or cross-site tracking for attribution.</li>
              <li>Attribution data is retained for the purpose of computing the monthly payout batch only.</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">4. Payout Structure</h2>
            <p className="text-surface-300">
              Payouts are distributed <strong>on the 12th of each calendar month</strong> (or the next business day
              if the 12th falls on a weekend or public holiday), subject to the conditions below.
            </p>
            <ul className="text-surface-300 space-y-2">
              <li>
                <strong>Proportional distribution:</strong> The total monthly payout pool is divided among all active
                creators proportionally, based on the number of verified new signups each creator referred during the
                preceding calendar month.
              </li>
              <li>
                <strong>No guaranteed amount:</strong> Individual payout amounts depend on the total pool size (set by
                Screenplay Studio at its discretion) and the number of participating creators. We make no guarantees
                regarding the minimum or maximum amount you will receive.
              </li>
              <li>
                <strong>Minimum threshold:</strong> Payouts below a minimum threshold (currently $5.00 USD) may be
                rolled over to the following month.
              </li>
              <li>
                <strong>No retroactive payouts:</strong> Signups are attributed to the calendar month in which they
                occurred. Approved creators do not receive credit for signups that happened before their application
                was approved.
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">5. Payment Method</h2>
            <p className="text-surface-300">
              Payout method details will be communicated to approved creators separately. Screenplay Studio reserves
              the right to request identity verification and tax documentation (e.g. W-9 or equivalent) before
              issuing any payment. Payments are issued in USD unless otherwise agreed.
            </p>
            <p className="text-surface-300">
              You are responsible for any taxes, fees, or withholding obligations arising from payments you receive
              under the Program.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">6. Program Availability &amp; Pausing</h2>
            <p className="text-surface-300">
              Screenplay Studio may pause, modify, or discontinue the Program (or any aspect of it) at any time,
              with or without notice. Specifically:
            </p>
            <ul className="text-surface-300 space-y-2">
              <li>Monthly payouts may be paused by administrators without terminating creator profiles.</li>
              <li>
                If the Program is discontinued, any accrued but unpaid balances above the minimum threshold will be
                paid out in a final batch within 30 days of the discontinuation notice.
              </li>
              <li>During periods when the Program is disabled, referral links continue to redirect to registration but signups are not tracked for payout purposes.</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">7. Creator Conduct</h2>
            <p className="text-surface-300">
              As a creator, you agree to:
            </p>
            <ul className="text-surface-300 space-y-2">
              <li>Promote Screenplay Studio honestly and accurately. Do not make false claims about features, pricing, or capabilities.</li>
              <li>Comply with all applicable platform advertising disclosure requirements (e.g. FTC guidelines, ASA rules) by clearly disclosing your affiliate relationship when promoting your referral link.</li>
              <li>Not use spam, automated bots, click farms, or any artificial means to generate visits or signups.</li>
              <li>Not incentivize third parties with cash, gifts, or other compensation to sign up through your link.</li>
              <li>Abide by Screenplay Studio&rsquo;s <Link href="/legal/community-guidelines">Community Guidelines</Link> and <Link href="/legal/acceptable-use">Acceptable Use Policy</Link> at all times.</li>
            </ul>
            <p className="text-surface-300">
              Violation of these conduct rules will result in immediate removal from the Program and forfeiture of
              any unpaid balance.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">8. Termination</h2>
            <p className="text-surface-300">
              Either party may terminate participation in the Program at any time:
            </p>
            <ul className="text-surface-300 space-y-2">
              <li>You may withdraw from the Program by removing your creator profile in Settings.</li>
              <li>Screenplay Studio may revoke creator status at any time for any reason, including but not limited to breach of these terms, inactivity, or program policy changes.</li>
              <li>Upon termination, tracked referral data is retained per our <Link href="/legal/privacy">Privacy Policy</Link> but no further payout tracking occurs for your account.</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">9. Intellectual Property</h2>
            <p className="text-surface-300">
              Participation in the Program does not grant you any license to use the Screenplay Studio name, logo,
              or trademarks beyond what is reasonably necessary to describe your affiliation (e.g., &ldquo;I&rsquo;m
              a Screenplay Studio creator&rdquo;). You may not modify or distort our branding.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">10. Limitation of Liability</h2>
            <p className="text-surface-300">
              To the maximum extent permitted by applicable law, Screenplay Studio&rsquo;s total liability to you
              under the Program is limited to the amount of unpaid payout balance accrued in the month immediately
              preceding any claim. We are not liable for lost profits, indirect damages, or business interruption
              arising from changes to or termination of the Program.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">11. Changes to These Terms</h2>
            <p className="text-surface-300">
              We may update these terms at any time. Material changes will be communicated via the platform or
              email. Continued participation after notice of changes constitutes acceptance of the revised terms.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-white">12. Contact</h2>
            <p className="text-surface-300">
              Questions about the Creator Affiliate Terms can be directed to our support team via the{' '}
              <Link href="/support">Support page</Link>.
            </p>
          </section>

        </article>
      </div>
    </div>
  );
}
