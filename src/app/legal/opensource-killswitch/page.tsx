import Link from 'next/link';

export const metadata = {
  title: 'Automated Dead Man\'s Switch / Escrow | Screenplay Studio',
  description: 'What happens to Screenplay Studio if the project can no longer be maintained—automated code release and self-hosting.',
};

export default function OpensourceKillswitchPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Project Continuity</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Automated Dead Man&apos;s Switch / Escrow</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 rounded-lg bg-surface-900/50 border border-surface-800/60 p-6">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">Table of Contents</h2>
          <ol className="list-decimal list-inside space-y-1.5 text-surface-400 text-[13px] columns-1 sm:columns-2 gap-8">
            <li><a href="#what" className="hover:text-red-400 transition-colors">What Is the Dead Man&apos;s Switch</a></li>
            <li><a href="#why" className="hover:text-red-400 transition-colors">Why It Exists</a></li>
            <li><a href="#trigger" className="hover:text-red-400 transition-colors">When It Activates (60-Day Trigger)</a></li>
            <li><a href="#code-release" className="hover:text-red-400 transition-colors">Codebase Release</a></li>
            <li><a href="#code-release" className="hover:text-red-400 transition-colors">Codebase Release</a></li>
            <li><a href="#self-hosting" className="hover:text-red-400 transition-colors">Self-Hosting</a></li>
            <li><a href="#data" className="hover:text-red-400 transition-colors">What Happens to Your Data</a></li>
            <li><a href="#continuity" className="hover:text-red-400 transition-colors">Community Continuity</a></li>
            <li><a href="#contact" className="hover:text-red-400 transition-colors">Contact</a></li>
          </ol>
        </nav>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white prose-headings:border-b prose-headings:border-surface-800/60 prose-headings:pb-3 prose-headings:mb-5">
          {/* 1. What Is the Open-Source Kill Switch */}
          <h2 id="what" className="scroll-mt-24">1. What Is the Dead Man&apos;s Switch</h2>
          <p>
            Screenplay Studio is developed and maintained by Northem Development, currently as a solo
            development effort. To protect against sudden incapacitation or unforeseen life events, the
            project relies on an automated dead man&apos;s switch and codebase escrow. If the project
            can no longer be maintained, the full codebase will be released publicly automatically so
            that users can continue running the software on their own infrastructure.
          </p>
          <p>
            This is not an internal feature toggle. This is a guarantee that the software will never die
            with its maintainer. If I can&apos;t keep going, you keep going.
          </p>

          {/* 2. Why It Exists */}
          <h2 id="why" className="scroll-mt-24">2. Why It Exists</h2>
          <p>
            Solo-maintained projects carry a fundamental risk: what happens when the single
            maintainer is suddenly incapacitated and cannot manually hand off the project? The automated dead man&apos;s switch addresses this directly:
          </p>
          <ul>
            <li>
              <strong className="text-white">Project survival:</strong> Your screenplays, scripts, and
              production data should not become inaccessible because one person can no longer work on the
              project.
            </li>
            <li>
              <strong className="text-white">User trust:</strong> You are investing time and creative work
              into this platform. You deserve a guarantee that your tools won&apos;t vanish.
            </li>
            <li>
              <strong className="text-white">Community empowerment:</strong> The open-source community can
              fork, improve, and maintain the project independently if the original maintainer steps away.
            </li>
            <li>
              <strong className="text-white">No vendor lock-in:</strong> Unlike proprietary software where
              discontinuation means total loss, open-source ensures the software lives on regardless of
              the company&apos;s fate.
            </li>
          </ul>

          {/* 3. When It Activates */}
          <h2 id="trigger" className="scroll-mt-24">3. When It Activates (60-Day Trigger)</h2>
          <p>
            The automated dead man&apos;s switch is triggered if the primary administrator account is entirely inactive for <strong>60 consecutive days</strong>.
          </p>
          <ul>
            <li>If the developer is incapacitated, hospitalized, or deceased, the 60-day inactivity timer will lapse.</li>
            <li>Once the timer lapses, an automated protocol executes the open-source release.</li>
            <li>The codebase is pushed from private repositories/escrow to public repositories automatically.</li>
            <li>The developer can also trigger this release manually in the event of a planned shutdown.</li>
          </ul>
          <p>
            Because this is an automated system designed for incapacitation, there may not be a 30-day manual warning period. The 60 days of inactivity serves as the delay before the codebase goes public.
          </p>

          {/* 4. Codebase Release */}
          <h2 id="code-release" className="scroll-mt-24">4. Codebase Release</h2>
          <p>
            Upon activation of the switch, the complete source code of Screenplay Studio will be
            made publicly available under an <strong className="text-white">open-source license</strong>.
            This includes:
          </p>
          <ul>
            <li>The full application source code (frontend, backend, and all supporting services).</li>
            <li>Database schemas and migration files.</li>
            <li>Configuration files and deployment guides.</li>
            <li>Documentation for self-hosting and setup.</li>
          </ul>
          <p>
            The code will be published on GitHub and mirrored to at least one additional platform to
            ensure redundancy. The license will permit free use, modification, and distribution , 
            ensuring the community can maintain and improve the software independently.
          </p>

          {/* 5. Self-Hosting */}
          <h2 id="self-hosting" className="scroll-mt-24">5. Self-Hosting</h2>
          <p>
            Screenplay Studio is designed to be self-hostable. After the kill switch activates, users
            with the technical capability to do so can:
          </p>
          <ul>
            <li>Deploy their own instance of the platform on their own infrastructure.</li>
            <li>Maintain their own data and user accounts independently.</li>
            <li>Modify and customise the software to suit their needs.</li>
            <li>Contribute improvements back to the community fork.</li>
          </ul>
          <p>
            Self-hosting requires technical knowledge including Node.js, PostgreSQL, and Supabase
            (or a compatible alternative). The release will include documentation to assist with setup,
            but self-hosted instances are not supported by Northem Development after the project
            transitions to community maintenance.
          </p>
          <p>
            Since the platform operates offline-first, your local files on your computer remain entirely unaffected and fully yours.
          </p>

          {/* 6. What Happens to Your Data */}
          <h2 id="data" className="scroll-mt-24">6. What Happens to Your Data</h2>
          <p>
            Your data remains yours. Here is exactly what happens:
          </p>
          <ul>
            <li>
              <strong className="text-white">Local Desktop Files:</strong> All files saved locally on your computer via the desktop app will remain fully accessible, even if the online service goes down.
            </li>
            <li>
              <strong className="text-white">At shutdown:</strong> The hosted platform at
              screenplaystudio.fun will cease operation. All data remaining on the hosted platform after
              the shutdown date will be permanently deleted in accordance with our data retention policies
              and <Link href="/legal/privacy" className="text-red-400 hover:text-red-300 transition-colors">Privacy Policy</Link>.
            </li>
            <li>
              <strong className="text-white">Self-hosted instances:</strong> Users who deploy their own
              instance before shutdown retain full control of their data on their own infrastructure.
              The codebase release enables this transition.
            </li>
            <li>
              <strong className="text-white">No data selling:</strong> In the event of project shutdown,
              user data will never be sold, transferred to a third party for commercial purposes, or
              used for any purpose other than facilitating the transition to community maintenance.
            </li>
          </ul>

          {/* 7. Community Continuity */}
          <h2 id="continuity" className="scroll-mt-24">7. Community Continuity</h2>
          <p>
            The automated dead man&apos;s switch is designed to enable seamless community takeover:
          </p>
          <ul>
            <li>
              <strong className="text-white">Fork and maintain:</strong> Any community member or
              organisation can fork the released codebase and continue maintaining it as a separate project.
            </li>
            <li>
              <strong className="text-white">Community governance:</strong> The community is free to
              establish its own governance model, contribution guidelines, and release processes for the
              forked project.
            </li>
            <li>
              <strong className="text-white">No orphaned users:</strong> Because the code is open-source,
              there is no scenario where users are left without options. The software exists independently
              of any single maintainer or company.
            </li>
            <li>
              <strong className="text-white">Existing contributions:</strong> All community contributions
              made to the project remain available under the open-source license, ensuring no work is lost.
            </li>
          </ul>

          {/* 8. Contact */}
          <h2 id="contact" className="scroll-mt-24">8. Contact</h2>
          <p>
            If you have questions about the dead man&apos;s switch, the project&apos;s continuity plans,
            or how to prepare for self-hosting, please contact us:
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
                <Link href="/legal/privacy" className="text-red-400 hover:text-red-300">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/legal/copyright" className="text-red-400 hover:text-red-300">Copyright Policy</Link>
              </li>
              <li>
                <Link href="/legal/data-processing" className="text-red-400 hover:text-red-300">Data Processing</Link>
              </li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
