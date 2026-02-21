import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Content Policy — Screenplay Studio',
  description: 'Guidelines on what content is allowed on Screenplay Studio, including creative works, community posts, and shared resources.',
};

export default function ContentPolicyPage() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-brand-400 hover:text-brand-300 text-sm mb-8 inline-block">&larr; Back to home</Link>

        <h1 className="text-3xl font-bold text-white mb-2">Content Policy</h1>
        <p className="text-sm text-surface-500 mb-12">Last updated: February 21, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">

          <section>
            <p className="text-base text-surface-200">
              Screenplay Studio is a platform for writers and filmmakers. We recognize that creative storytelling
              often explores difficult, complex, and controversial subjects. This Content Policy explains what content
              is allowed, what requires additional care, and what is strictly prohibited — both in private projects
              and public community spaces.
            </p>
          </section>

          {/* ── Private vs Public Content ─────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Private vs. Public Content</h2>
            <p>We apply different standards depending on context:</p>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <div className="bg-surface-900 rounded-lg p-4 border border-surface-800">
                <h3 className="text-sm font-semibold text-white mb-2">Private Projects</h3>
                <p className="text-xs">
                  Content within your private projects and shared only with invited collaborators has the broadest
                  creative freedom. You can explore any theme, subject, or tone as part of legitimate creative work.
                  However, even private content must not violate laws or involve child exploitation material.
                </p>
              </div>
              <div className="bg-surface-900 rounded-lg p-4 border border-surface-800">
                <h3 className="text-sm font-semibold text-white mb-2">Public/Community Content</h3>
                <p className="text-xs">
                  Content shared publicly — community posts, free scripts, challenge submissions, comments, and
                  profile information — must meet higher standards. This content is visible to all users and must
                  comply with all sections of this policy and our Community Guidelines.
                </p>
              </div>
            </div>
          </section>

          {/* ── Creative Works ────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Creative Works &amp; Mature Themes</h2>
            <p>
              Great storytelling often involves mature themes. The following subjects are <strong className="text-white">allowed in creative
              scripts and writing</strong>, provided they serve the narrative:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-white">Violence &amp; conflict</strong> — as part of dramatic storytelling (action, war, crime genres)</li>
              <li><strong className="text-white">Substance use</strong> — depicted within narrative context</li>
              <li><strong className="text-white">Profanity &amp; strong language</strong> — as natural dialogue for characters</li>
              <li><strong className="text-white">Dark themes</strong> — including death, grief, trauma, mental health struggles, moral ambiguity</li>
              <li><strong className="text-white">Political &amp; social themes</strong> — including criticism, satire, and commentary</li>
              <li><strong className="text-white">Romantic &amp; intimate content</strong> — including sexuality depicted with artistic intent (not pornographic)</li>
              <li><strong className="text-white">Horror &amp; disturbing imagery</strong> — as part of the horror/thriller genre</li>
            </ul>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 mt-3">
              <p className="text-xs text-amber-200/80">
                <strong>Content warnings recommended:</strong> When sharing scripts publicly that contain graphic violence,
                sexual content, or other potentially triggering material, we strongly recommend adding content warnings
                in your post description. This helps other readers make informed choices.
              </p>
            </div>
          </section>

          {/* ── Prohibited Content ────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Prohibited Content</h2>
            <p>The following content is <strong className="text-red-400">never allowed</strong>, in any context, whether private or public:</p>

            <div className="space-y-3 mt-3">
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-400 mb-1">Child Sexual Abuse Material (CSAM)</h3>
                <p className="text-xs">Any depiction, whether real or fictional, that sexualizes minors. This includes written descriptions, scripts, and any other format. We report all CSAM to the National Center for Missing &amp; Exploited Children (NCMEC) and appropriate law enforcement.</p>
              </div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-400 mb-1">Real-World Violence Promotion</h3>
                <p className="text-xs">Content that provides specific instructions for acts of violence, terrorism, or mass harm. There is a clear distinction between <em>depicting</em> violence in fiction and <em>promoting</em> real violence.</p>
              </div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-400 mb-1">Non-Consensual Intimate Content</h3>
                <p className="text-xs">Real intimate images or descriptions of real people shared without their consent (revenge porn, deepfakes, etc.).</p>
              </div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-400 mb-1">Illegal Content</h3>
                <p className="text-xs">Content that violates applicable laws, including but not limited to: pirated copyrighted works, illegal drug trade instructions, fraud schemes, or money laundering guidance.</p>
              </div>
            </div>
          </section>

          {/* ── Community Content Rules ───────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Community Posts &amp; Comments</h2>
            <p>
              Content shared in community areas (feed, discussions, comments, chat) must additionally follow these rules:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong className="text-white">No hate speech:</strong> Content attacking people based on protected characteristics
                (race, ethnicity, nationality, religion, gender identity, sexual orientation, disability, age) is prohibited.
                Characters in scripts may hold bigoted views as part of storytelling, but community posts and comments may not.
              </li>
              <li>
                <strong className="text-white">No targeted harassment:</strong> Content that targets specific individuals with
                the intent to degrade, intimidate, or humiliate is not allowed.
              </li>
              <li>
                <strong className="text-white">No misinformation:</strong> Deliberately false claims presented as fact,
                particularly regarding health, safety, or elections, are not allowed in community discussions.
              </li>
              <li>
                <strong className="text-white">No spam:</strong> Repetitive, low-quality, or commercially motivated posts
                that don&apos;t contribute to the creative community are not allowed.
              </li>
              <li>
                <strong className="text-white">No NSFW without warnings:</strong> Publicly shared scripts or excerpts containing
                graphic content must include clear content warnings.
              </li>
            </ul>
          </section>

          {/* ── Copyright & IP ────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Copyright &amp; Intellectual Property</h2>
            <p>We respect intellectual property rights and expect our users to do the same:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong className="text-white">Your original work:</strong> You may upload and share any content you&apos;ve created yourself.
              </li>
              <li>
                <strong className="text-white">Licensed content:</strong> You may upload content you have a license to use (e.g., public domain works, Creative Commons licensed material). Clearly attribute the source and license.
              </li>
              <li>
                <strong className="text-white">Fair use:</strong> Brief quotations from published works for the purpose of commentary, criticism, education, or parody may be acceptable under fair use/fair dealing doctrines, but you assume the legal risk.
              </li>
              <li>
                <strong className="text-white">Adaptation &amp; fan fiction:</strong> Works that adapt copyrighted source material should be clearly labeled as fan fiction and are shared at your own legal risk. We may remove such content if we receive a valid copyright complaint.
              </li>
              <li>
                <strong className="text-white">DMCA compliance:</strong> We comply with the Digital Millennium Copyright Act. To file a takedown notice, email{' '}
                <a href="mailto:dmca@screenplaystudio.app" className="text-brand-400 hover:text-brand-300">dmca@screenplaystudio.app</a> with the required information.
              </li>
            </ul>
          </section>

          {/* ── AI-Generated Content ──────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. AI-Generated Content</h2>
            <p>Regarding the use of AI tools in combination with our platform:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>AI-assisted writing tools may be used as part of your creative process</li>
              <li>When sharing AI-generated or AI-assisted work publicly, disclosure is strongly recommended</li>
              <li>Challenge and competition entries must follow each challenge&apos;s specific rules regarding AI use</li>
              <li>AI-generated content must still comply with all other content policies</li>
              <li>Do not use AI to mass-generate low-quality content to flood the community</li>
            </ul>
          </section>

          {/* ── Content Moderation ─────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Content Moderation</h2>
            <p>We moderate content through a combination of:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-white">Community reports:</strong> Users flag content that may violate our policies</li>
              <li><strong className="text-white">Team review:</strong> Our moderation team reviews reported content and makes decisions</li>
              <li><strong className="text-white">Automated tools:</strong> Automated systems may flag potentially problematic content for human review</li>
            </ul>
            <p className="mt-2">
              We aim to review all reports within 48 hours. Complex cases may take longer. We err on the side of
              protecting creative expression while maintaining a safe community.
            </p>
          </section>

          {/* ── Edge Cases ─────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Edge Cases &amp; Context Matters</h2>
            <p>
              Content moderation in a creative writing platform requires nuance. We evaluate content by considering:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-white">Context:</strong> Is this part of a script/creative work, or a community post/comment?</li>
              <li><strong className="text-white">Intent:</strong> Is the content exploring a theme or promoting harmful behavior?</li>
              <li><strong className="text-white">Impact:</strong> Could this content cause real-world harm?</li>
              <li><strong className="text-white">Audience:</strong> Is this shared privately or publicly?</li>
              <li><strong className="text-white">Artistic merit:</strong> Does the content serve a legitimate narrative purpose?</li>
            </ul>
            <p className="mt-2 text-xs text-surface-500">
              If you&apos;re unsure whether your content crosses a line, you can reach out to us at{' '}
              <a href="mailto:content@screenplaystudio.app" className="text-brand-400 hover:text-brand-300">content@screenplaystudio.app</a>{' '}
              before sharing publicly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>
              This Content Policy may be updated to reflect new guidelines, emerging content issues, or changes
              in applicable law. We will notify users of significant changes through the platform. The &quot;Last
              updated&quot; date at the top reflects the most recent revision.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-surface-800 flex flex-wrap gap-4 text-xs text-surface-500">
          <Link href="/terms" className="hover:text-brand-400">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-brand-400">Privacy Policy</Link>
          <Link href="/community-guidelines" className="hover:text-brand-400">Community Guidelines</Link>
          <Link href="/acceptable-use" className="hover:text-brand-400">Acceptable Use Policy</Link>
        </div>
      </div>
    </div>
  );
}
