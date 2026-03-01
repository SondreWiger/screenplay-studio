import Link from 'next/link';

export const metadata = {
  title: 'Content Policy — Screenplay Studio',
  description: 'Understand what content is allowed on Screenplay Studio, including creative works, community guidelines, prohibited content, and our moderation approach.',
};

export default function ContentPolicyPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Content</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Content Policy</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white">
        <p className="text-surface-300 text-lg">
          Screenplay Studio is a platform for creative writers and filmmakers. We support artistic freedom while
          maintaining a safe and respectful environment. This policy outlines what is and isn&apos;t allowed on
          our platform.
        </p>

        {/* ── Private vs Public Content ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">1. Private vs. Public Content</h2>
          <p className="text-surface-300">
            Screenplay Studio distinguishes between private and public content:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="rounded-lg bg-surface-900 border border-surface-800 p-5">
              <h4 className="text-white font-semibold mb-2">Private Content</h4>
              <ul className="text-surface-300 text-sm space-y-1">
                <li>Only visible to you and your invited collaborators</li>
                <li>Broader creative latitude is permitted</li>
                <li>Subject to <Link href="/legal/terms" className="text-red-400 hover:text-red-300">Terms of Service</Link> and
                  legal requirements</li>
                <li>Prohibited content rules still apply</li>
              </ul>
            </div>
            <div className="rounded-lg bg-surface-900 border border-surface-800 p-5">
              <h4 className="text-white font-semibold mb-2">Public Content</h4>
              <ul className="text-surface-300 text-sm space-y-1">
                <li>Visible via Showcase, Community, or shared links</li>
                <li>Must comply with all community guidelines</li>
                <li>Content warnings required for mature themes</li>
                <li>Subject to community moderation</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Creative Works & Mature Themes ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">2. Creative Works &amp; Mature Themes</h2>
          <p className="text-surface-300">
            Screenwriting is an art form that frequently explores difficult, complex, and mature subject matter.
            We recognize this and support creative expression:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Mature themes are allowed</strong> in screenplays and creative
              works, including violence, strong language, substance use, and adult situations — when handled
              with artistic intent and purpose.
            </li>
            <li>
              <strong className="text-white">Content warnings are required</strong> when sharing content
              publicly that contains graphic violence, sexual content, self-harm themes, or other potentially
              distressing material.
            </li>
            <li>
              The key distinction is between <em>depicting</em> something in a creative work and{' '}
              <em>promoting or glorifying</em> it. Depicting a villain&apos;s violent actions in a screenplay
              is acceptable; creating content that incites real-world violence is not.
            </li>
          </ul>
        </section>

        {/* ── Prohibited Content ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">3. Prohibited Content</h2>
          <p className="text-surface-300">
            The following content is <strong className="text-white">strictly prohibited</strong> on Screenplay
            Studio — in both private and public contexts. Violations may result in immediate account termination
            and reporting to the appropriate authorities.
          </p>
          <div className="rounded-lg bg-red-950/30 border border-red-900/50 p-6 mt-4">
            <ul className="text-surface-300 space-y-3">
              <li>
                <strong className="text-white">Child Sexual Abuse Material (CSAM):</strong> Any content that
                depicts, describes, or promotes the sexual exploitation or abuse of minors. This includes
                fictional depictions. We have zero tolerance and will report all instances to NCMEC and law
                enforcement.
              </li>
              <li>
                <strong className="text-white">Real violence promotion:</strong> Content that actively promotes,
                incites, or provides instructions for real-world violence against specific individuals or groups.
              </li>
              <li>
                <strong className="text-white">Non-consensual intimate content:</strong> Sharing or creating
                intimate or sexual images of real people without their consent, including deepfakes and
                AI-generated intimate imagery of real individuals.
              </li>
              <li>
                <strong className="text-white">Illegal content:</strong> Content that facilitates illegal
                activities, including but not limited to drug trafficking, weapons manufacturing, fraud schemes,
                or human trafficking.
              </li>
              <li>
                <strong className="text-white">Terrorism content:</strong> Content that promotes, recruits for,
                or provides material support to designated terrorist organizations.
              </li>
            </ul>
          </div>
        </section>

        {/* ── Community Post/Comment Rules ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">4. Community Posts &amp; Comments</h2>
          <p className="text-surface-300">
            When participating in our Community features (posts, comments, discussions, feedback), the
            following rules apply:
          </p>
          <ul className="text-surface-300 space-y-2">
            <li>
              <strong className="text-white">No hate speech:</strong> Content that attacks, demeans, or
              incites hatred against individuals or groups based on race, ethnicity, gender, sexual orientation,
              religion, disability, or other protected characteristics is not allowed.
            </li>
            <li>
              <strong className="text-white">No harassment:</strong> Targeted harassment, bullying, intimidation,
              or sustained unwanted contact toward any user is prohibited. This includes both direct attacks and
              coordinated harassment campaigns.
            </li>
            <li>
              <strong className="text-white">No doxxing:</strong> Sharing or threatening to share another
              person&apos;s private information (real name, address, phone number, workplace, etc.) without their
              consent is strictly prohibited.
            </li>
            <li>
              <strong className="text-white">No misinformation:</strong> Deliberately spreading false information
              that could cause real-world harm, including health misinformation, election misinformation, or
              fabricated claims about other users.
            </li>
            <li>
              <strong className="text-white">No spam:</strong> Unsolicited advertising, repetitive posting,
              promotional content, or bot activity that disrupts the community experience.
            </li>
            <li>
              <strong className="text-white">NSFW content warnings:</strong> Any community post containing
              mature or potentially disturbing content must be clearly marked with appropriate content warnings.
              Failure to do so may result in content removal.
            </li>
          </ul>
          <p className="text-surface-300">
            For complete community standards, see our{' '}
            <Link href="/legal/community-guidelines" className="text-red-400 hover:text-red-300">Community Guidelines</Link>.
          </p>
        </section>

        {/* ── Screenplay Content Guidelines ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">5. Screenplay Content Guidelines</h2>
          <p className="text-surface-300">
            For screenplays and creative writing projects specifically:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Mature themes are allowed</strong> when they serve the narrative.
              Crime dramas, war stories, psychological thrillers, and other genres that explore dark subject
              matter are welcome on the platform.
            </li>
            <li>
              <strong className="text-white">Content warnings required:</strong> When sharing screenplays
              publicly that contain graphic content, apply the appropriate content tags so readers can make
              informed choices.
            </li>
            <li>
              Content that exists solely to shock, disturb, or offend with no discernible creative or narrative
              purpose may be removed from public spaces.
            </li>
            <li>
              Historical and educational content depicting real events (war crimes, atrocities, etc.) is
              permitted with appropriate framing and content warnings.
            </li>
          </ul>
        </section>

        {/* ── AI-Generated Content ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">6. AI-Generated Content</h2>
          <p className="text-surface-300">
            Screenplay Studio may offer AI-assisted writing features. When using AI tools:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Disclosure required:</strong> Any content that is substantially
              AI-generated must be disclosed as such when shared publicly or in the community. Use the
              &quot;AI-assisted&quot; or &quot;AI-generated&quot; tags provided.
            </li>
            <li>
              <strong className="text-white">Contest restrictions:</strong> AI-generated content is not
              permitted in writing contests, competitions, or challenges on the platform unless the contest
              rules explicitly allow it. Submitting undisclosed AI-generated work to a contest is grounds for
              disqualification and may result in account penalties.
            </li>
            <li>
              You are responsible for all AI-generated content on your account and must ensure it complies with
              this Content Policy and our{' '}
              <Link href="/legal/copyright" className="text-red-400 hover:text-red-300">Copyright &amp; IP Policy</Link>.
            </li>
          </ul>
        </section>

        {/* ── Copyright Respect ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">7. Copyright Respect</h2>
          <p className="text-surface-300">
            Respect the intellectual property rights of others:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>Do not upload, share, or distribute copyrighted material without authorization</li>
            <li>
              Fan fiction and derivative works based on copyrighted material should be clearly identified as such
              and may be subject to takedown requests from rights holders
            </li>
            <li>
              Adaptations of public domain works are permitted — see our{' '}
              <Link href="/legal/copyright" className="text-red-400 hover:text-red-300">Copyright &amp; IP Policy</Link> for details
            </li>
            <li>
              If you believe your copyright has been infringed, follow our{' '}
              <Link href="/legal/copyright" className="text-red-400 hover:text-red-300">DMCA process</Link>
            </li>
          </ul>
        </section>

        {/* ── Content Moderation ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">8. Content Moderation</h2>
          <p className="text-surface-300">
            We use a combination of automated and human moderation to enforce this policy:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Automated scanning:</strong> Public content is screened using
              automated tools that detect prohibited material (particularly CSAM), spam, and content that
              requires review.
            </li>
            <li>
              <strong className="text-white">Human review:</strong> Flagged content and user reports are reviewed
              by trained human moderators who understand the nuances of creative writing and contextual
              interpretation.
            </li>
            <li>
              <strong className="text-white">Appeals process:</strong> If your content is removed or your
              account is restricted, you may appeal the decision. Appeals are reviewed by a different moderator
              than the one who made the original decision. You will receive a response within 7 business days.
            </li>
          </ul>
          <p className="text-surface-300">
            We prioritize accuracy in moderation and understand that creative works often explore challenging
            themes. Moderators are trained to distinguish between artistic expression and policy violations.
          </p>
        </section>

        {/* ── Edge Cases ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">9. Edge Cases &amp; Context</h2>
          <p className="text-surface-300">
            We recognize that content moderation requires nuance. When evaluating edge cases, we consider:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Artistic context:</strong> Is the content part of a larger
              creative work with narrative purpose?
            </li>
            <li>
              <strong className="text-white">Educational value:</strong> Does the content serve an educational
              or informational purpose?
            </li>
            <li>
              <strong className="text-white">Public interest:</strong> Is the content addressing a matter of
              public concern or social commentary?
            </li>
            <li>
              <strong className="text-white">Intent:</strong> Is the content designed to harm, exploit, or
              harass — or is it a good-faith creative effort?
            </li>
            <li>
              <strong className="text-white">Audience:</strong> Is the content appropriately gated with
              warnings, age restrictions, or access controls?
            </li>
          </ul>
          <p className="text-surface-300">
            When in doubt, we err on the side of creative expression — particularly for private content.
            For public content, we may request that you add content warnings or adjust sharing settings rather
            than removing the content outright.
          </p>
        </section>

        {/* ── User Reporting ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">10. User Reporting</h2>
          <p className="text-surface-300">
            If you encounter content that violates this policy, you can report it through:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">In-app reporting:</strong> Use the report button available on all
              public content, community posts, comments, and user profiles.
            </li>
            <li>
              <strong className="text-white">Email:</strong> Send reports to{' '}
              <a href="mailto:report@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                report@screenplaystudio.fun
              </a>{' '}
              with a description and link to the content.
            </li>
            <li>
              <strong className="text-white">Urgent matters:</strong> For content involving imminent danger,
              child exploitation, or threats of violence, contact law enforcement directly and then notify us at{' '}
              <a href="mailto:safety@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                safety@screenplaystudio.fun
              </a>.
            </li>
          </ul>
          <p className="text-surface-300">
            All reports are reviewed within 48 hours. Reports involving prohibited content (Section 3) are
            prioritized for immediate review. We do not disclose the identity of reporters.
          </p>
        </section>

        {/* ── Consequences ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">11. Consequences</h2>
          <p className="text-surface-300">
            Violations of this Content Policy may result in the following actions, depending on severity:
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="py-3 pr-4 text-white font-semibold">Level</th>
                  <th className="py-3 pr-4 text-white font-semibold">Action</th>
                  <th className="py-3 text-white font-semibold">Examples</th>
                </tr>
              </thead>
              <tbody className="text-surface-300">
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Warning</td>
                  <td className="py-3 pr-4">Content removed with notification and guidance</td>
                  <td className="py-3">Missing content warnings, minor community guideline violations</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Temporary restriction</td>
                  <td className="py-3 pr-4">Limited access to community features (7–30 days)</td>
                  <td className="py-3">Repeated warnings, harassment, spam</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Suspension</td>
                  <td className="py-3 pr-4">Account suspended pending review</td>
                  <td className="py-3">Severe harassment, hate speech, copyright infringement</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-3 pr-4 font-medium text-white">Termination</td>
                  <td className="py-3 pr-4">Permanent account termination and data deletion</td>
                  <td className="py-3">CSAM, real violence promotion, terrorism content, illegal activities</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-surface-300 mt-4">
            We may bypass lower levels and proceed directly to suspension or termination for severe violations.
            All enforcement actions can be appealed through the process described in Section 8.
          </p>
        </section>

        {/* ── Changes & Notification ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">12. Changes &amp; Notification</h2>
          <p className="text-surface-300">
            We may update this Content Policy to address new types of content, evolving community standards, or
            changes in applicable law. When we make material changes:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>We will post the updated policy with a new &quot;Last updated&quot; date</li>
            <li>We will notify all users via email and in-app notification at least 14 days before changes take effect</li>
            <li>Material changes to prohibited content categories or enforcement levels will include a summary of what changed</li>
            <li>Continued use of Screenplay Studio after the effective date constitutes acceptance of the updated policy</li>
          </ul>
        </section>

        {/* ── Contact ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">13. Contact</h2>
          <p className="text-surface-300">
            For questions about this Content Policy:
          </p>
          <ul className="text-surface-300 space-y-1 list-none pl-0">
            <li>
              <strong className="text-white">General questions:</strong>{' '}
              <a href="mailto:support@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                support@screenplaystudio.fun
              </a>
            </li>
            <li>
              <strong className="text-white">Content reports:</strong>{' '}
              <a href="mailto:report@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                report@screenplaystudio.fun
              </a>
            </li>
            <li>
              <strong className="text-white">Safety concerns:</strong>{' '}
              <a href="mailto:safety@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                safety@screenplaystudio.fun
              </a>
            </li>
          </ul>
        </section>

        {/* ── Related Policies ── */}
        <section className="mt-12 rounded-lg bg-surface-900 border border-surface-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Related Policies</h3>
          <ul className="text-surface-300 space-y-2 list-none pl-0">
            <li>
              <Link href="/legal/community-guidelines" className="text-red-400 hover:text-red-300">Community Guidelines</Link>
            </li>
            <li>
              <Link href="/legal/copyright" className="text-red-400 hover:text-red-300">Copyright &amp; IP Policy</Link>
            </li>
            <li>
              <Link href="/legal/terms" className="text-red-400 hover:text-red-300">Terms of Service</Link>
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
