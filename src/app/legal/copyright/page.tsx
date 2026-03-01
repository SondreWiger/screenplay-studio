import Link from 'next/link';

export const metadata = {
  title: 'Copyright & IP Policy — Screenplay Studio',
  description: 'Learn about content ownership, intellectual property rights, and how we handle your creative works at Screenplay Studio.',
};

export default function CopyrightPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Intellectual Property</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Copyright Policy</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white">
        <p className="text-surface-300 text-lg">
          At Screenplay Studio, we believe creators should own their work. This policy explains how intellectual
          property and content ownership works on our platform.
        </p>

        {/* ── User Content Ownership ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">1. User Content Ownership</h2>
          <p className="text-surface-300">
            You retain <strong className="text-white">100% ownership</strong> of all content you create on
            Screenplay Studio, including but not limited to:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>Screenplays, scripts, and drafts</li>
            <li>Original characters and character descriptions</li>
            <li>Stories, plot outlines, and treatments</li>
            <li>Notes, annotations, and comments on your own work</li>
            <li>Storyboard descriptions and shot lists</li>
            <li>Any other creative content you produce using our tools</li>
          </ul>
          <p className="text-surface-300">
            We do not claim any ownership rights over your creative content. Your scripts are yours — before, during,
            and after using Screenplay Studio.
          </p>
        </section>

        {/* ── Operational License Grant ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">2. Operational License Grant</h2>
          <p className="text-surface-300">
            By uploading or creating content on Screenplay Studio, you grant us a limited, non-exclusive,
            royalty-free license solely for the purpose of operating the service. This means we may:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>Store your content on our servers and in encrypted backups</li>
            <li>Display your content back to you and your authorized collaborators</li>
            <li>Transmit your content as needed to deliver the service (e.g., syncing across devices)</li>
            <li>Process your content to provide features you request (e.g., formatting, PDF export)</li>
          </ul>
          <p className="text-surface-300">
            This license is limited strictly to what is technically necessary to run the service. We will
            <strong className="text-white"> never</strong> use your content for training AI models, marketing
            purposes, or any use beyond providing you with our service — unless you explicitly opt in.
          </p>
        </section>

        {/* ── Screenplay Studio's IP ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">3. Screenplay Studio&apos;s Intellectual Property</h2>
          <p className="text-surface-300">
            The following remain the exclusive property of Screenplay Studio:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>Our source code, software, and application design</li>
            <li>The Screenplay Studio name, logo, and trademarks</li>
            <li>UI/UX designs, icons, and visual assets</li>
            <li>Documentation, help articles, and marketing materials</li>
            <li>Proprietary algorithms and formatting engines</li>
          </ul>
          <p className="text-surface-300">
            You may not copy, modify, distribute, or reverse-engineer any part of Screenplay Studio&apos;s
            proprietary technology without our prior written consent.
          </p>
        </section>

        {/* ── Collaboration Content ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">4. Collaboration Content</h2>
          <p className="text-surface-300">
            When multiple users collaborate on a project:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Joint ownership:</strong> Each contributor retains ownership of
              their individual contributions to the project.
            </li>
            <li>
              <strong className="text-white">Contribution rights:</strong> Each collaborator maintains the right
              to reference, reuse, or build upon their own contributions independently.
            </li>
            <li>
              <strong className="text-white">Project-level rights:</strong> The project owner controls access
              and sharing settings for the combined work.
            </li>
            <li>
              <strong className="text-white">Dispute resolution:</strong> In the event of an ownership dispute,
              we may restrict access to disputed content until the parties reach a resolution. Screenplay Studio
              does not arbitrate ownership disputes.
            </li>
          </ul>
          <p className="text-surface-300">
            We recommend collaborators establish clear agreements regarding ownership and usage rights before
            beginning a joint project.
          </p>
        </section>

        {/* ── Showcase & Community Content ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">5. Showcase &amp; Community Content</h2>
          <p className="text-surface-300">
            When you opt in to share your work via our Showcase or Community features:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              You grant a <strong className="text-white">public viewing license</strong> that allows other users
              to read and view your shared content on the platform.
            </li>
            <li>
              This license is <strong className="text-white">revocable</strong> — you can remove your content
              from the Showcase or Community at any time by changing your sharing settings.
            </li>
            <li>
              Public viewing does not grant other users the right to copy, reproduce, distribute, or create
              derivative works from your content.
            </li>
            <li>
              Community comments and feedback posted on your shared content are owned by their respective authors.
            </li>
          </ul>
        </section>

        {/* ── Public Domain & Fair Use ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">6. Public Domain &amp; Fair Use</h2>
          <p className="text-surface-300">
            Screenplay Studio respects public domain works and the principles of fair use:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              You may create adaptations of public domain works. Your original adaptation remains your intellectual
              property, while the underlying public domain material stays in the public domain.
            </li>
            <li>
              Fair use of copyrighted material (e.g., for commentary, criticism, parody, or educational purposes)
              is permitted to the extent allowed by applicable law.
            </li>
            <li>
              You are responsible for ensuring your use of third-party material complies with copyright law.
              Screenplay Studio cannot provide legal advice on fair use determinations.
            </li>
          </ul>
        </section>

        {/* ── AI-Generated Content ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">7. AI-Generated Content</h2>
          <p className="text-surface-300">
            If you use AI tools (including any AI features within Screenplay Studio) to generate or assist with content:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Disclosure required:</strong> You must clearly disclose that your content
              is AI-generated or AI-assisted when sharing it publicly on the platform.
            </li>
            <li>
              The legal ownership of AI-generated content may vary by jurisdiction. Screenplay Studio does not make
              representations about the copyrightability of AI-generated works.
            </li>
            <li>
              You remain responsible for ensuring AI-generated content does not infringe on third-party copyrights
              or violate our <Link href="/legal/content-policy" className="text-red-400 hover:text-red-300">Content Policy</Link>.
            </li>
          </ul>
        </section>

        {/* ── Content Removal ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">8. Content Removal</h2>
          <p className="text-surface-300">
            You have full control over your content:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              <strong className="text-white">Immediate deletion:</strong> You can delete your content at any time
              through your account settings or project management tools.
            </li>
            <li>
              <strong className="text-white">Backup removal:</strong> After you delete content, we will remove it
              from all backups within <strong className="text-white">30 days</strong>.
            </li>
            <li>
              <strong className="text-white">Account deletion:</strong> If you delete your account, all associated
              content will be permanently removed, including from backups, within 30 days.
            </li>
            <li>
              We may retain anonymized, aggregated data (e.g., usage statistics) that cannot be linked back to your
              content or identity.
            </li>
          </ul>
        </section>

        {/* ── Attribution Requirements ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">9. Attribution Requirements</h2>
          <p className="text-surface-300">
            When sharing content publicly through Screenplay Studio:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>
              Shared content will display the author&apos;s chosen display name or username as attribution.
            </li>
            <li>
              If you share or reference another user&apos;s publicly showcased work outside the platform, you must
              provide proper attribution including the original author&apos;s name and a link to the original work
              where possible.
            </li>
            <li>
              Removing or altering attribution on shared content is a violation of this policy and may result in
              account action.
            </li>
          </ul>
        </section>

        {/* ── DMCA & Takedown ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">10. Copyright Infringement &amp; DMCA</h2>
          <p className="text-surface-300">
            If you believe your copyrighted work has been posted on Screenplay Studio without authorization, you may
            submit a takedown request to{' '}
            <a href="mailto:legal@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
              legal@screenplaystudio.fun
            </a>
            . Please include:
          </p>
          <ul className="text-surface-300 space-y-1">
            <li>Identification of the copyrighted work</li>
            <li>Identification of the infringing material and its location on our platform</li>
            <li>Your contact information</li>
            <li>A statement of good faith belief that the use is not authorized</li>
            <li>A statement, under penalty of perjury, that the information is accurate</li>
            <li>Your physical or electronic signature</li>
          </ul>
          <p className="text-surface-300">
            We will respond to valid takedown requests promptly and in accordance with applicable law.
          </p>
        </section>

        {/* ── Contact ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">11. Contact</h2>
          <p className="text-surface-300">
            For questions about this Copyright &amp; IP Policy, contact us at{' '}
            <a href="mailto:legal@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
              legal@screenplaystudio.fun
            </a>.
          </p>
        </section>

        {/* ── Related Policies ── */}
        <section className="mt-12 rounded-lg bg-surface-900 border border-surface-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Related Policies</h3>
          <ul className="text-surface-300 space-y-2 list-none pl-0">
            <li>
              <Link href="/legal/terms" className="text-red-400 hover:text-red-300">Terms of Service</Link>
            </li>
            <li>
              <Link href="/legal/privacy" className="text-red-400 hover:text-red-300">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/legal/content-policy" className="text-red-400 hover:text-red-300">Content Policy</Link>
            </li>
            <li>
              <Link href="/legal/data-processing" className="text-red-400 hover:text-red-300">Data Processing Agreement</Link>
            </li>
          </ul>
        </section>
      </article>
      </div>
    </div>
  );
}
