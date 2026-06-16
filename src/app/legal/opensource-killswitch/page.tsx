import Link from 'next/link';

export const metadata = {
  title: 'Open-Source Kill Switch — Screenplay Studio',
  description: 'What happens to Screenplay Studio if the project can no longer be maintained — open-sourcing, self-hosting, and data portability guarantees.',
};

export default function OpensourceKillswitchPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Project Continuity</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Open-Source Kill Switch</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 rounded-lg bg-surface-900/50 border border-surface-800/60 p-6">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">Table of Contents</h2>
          <ol className="list-decimal list-inside space-y-1.5 text-surface-400 text-[13px] columns-1 sm:columns-2 gap-8">
            <li><a href="#what" className="hover:text-red-400 transition-colors">What Is the Open-Source Kill Switch</a></li>
            <li><a href="#why" className="hover:text-red-400 transition-colors">Why It Exists</a></li>
            <li><a href="#trigger" className="hover:text-red-400 transition-colors">When It Activates</a></li>
            <li><a href="#warning" className="hover:text-red-400 transition-colors">30-Day Warning Period</a></li>
            <li><a href="#code-release" className="hover:text-red-400 transition-colors">Codebase Release</a></li>
            <li><a href="#self-hosting" className="hover:text-red-400 transition-colors">Self-Hosting</a></li>
            <li><a href="#data" className="hover:text-red-400 transition-colors">What Happens to Your Data</a></li>
            <li><a href="#continuity" className="hover:text-red-400 transition-colors">Community Continuity</a></li>
            <li><a href="#contact" className="hover:text-red-400 transition-colors">Contact</a></li>
          </ol>
        </nav>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white prose-headings:border-b prose-headings:border-surface-800/60 prose-headings:pb-3 prose-headings:mb-5">
          {/* 1. What Is the Open-Source Kill Switch */}
          <h2 id="what" className="scroll-mt-24">1. What Is the Open-Source Kill Switch</h2>
          <p>
            Screenplay Studio is developed and maintained by Northem Development, currently as a solo
            development effort. The open-source kill switch is a commitment that if the project can no
            longer be maintained — whether due to personal circumstances, financial constraints, or any
            other reason — the full codebase will be released publicly so that users can continue running
            the software on their own infrastructure.
          </p>
          <p>
            This is not an internal feature toggle. This is a guarantee that the software will never die
            with its maintainer. If I can&apos;t keep going, you keep going.
          </p>

          {/* 2. Why It Exists */}
          <h2 id="why" className="scroll-mt-24">2. Why It Exists</h2>
          <p>
            Solo-maintained open-source projects carry a fundamental risk: what happens when the single
            maintainer can no longer maintain it? The open-source kill switch addresses this directly:
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
          <h2 id="trigger" className="scroll-mt-24">3. When It Activates</h2>
          <p>
            The open-source kill switch is triggered when the project maintainer determines that the
            project can no longer be actively maintained. This includes, but is not limited to:
          </p>
          <ul>
            <li>The maintainer is unable to continue development due to personal health, life circumstances, or other obligations.</li>
            <li>Northem Development ceases operations or is dissolved.</li>
            <li>The project has been inactive for an extended period with no reasonable prospect of resumption.</li>
            <li>The maintainer voluntarily decides to step away from the project.</li>
          </ul>
          <p>
            The determination of whether the kill switch should be activated is at the sole discretion
            of the project maintainer. The goal is to ensure continuity for users, not to create
            bureaucratic hurdles.
          </p>

          {/* 4. 30-Day Warning Period */}
          <h2 id="warning" className="scroll-mt-24">4. 30-Day Warning Period</h2>
          <p>
            Before the kill switch is activated, users will receive a <strong className="text-white">minimum
            30-day advance warning</strong>. During this period:
          </p>
          <ul>
            <li>All registered users will be notified via email to the address associated with their account.</li>
            <li>A prominent notice will be displayed on the platform.</li>
            <li>The warning will clearly state the expected shutdown date and provide instructions for data export.</li>
            <li>Users will have full access to all features during the warning period to export their content.</li>
          </ul>
          <p>
            This 30-day period is a minimum. The actual warning period may be longer depending on the
            circumstances. The intent is to give users ample time to export their data and prepare for
            self-hosting or migration.
          </p>

          {/* 5. Codebase Release */}
          <h2 id="code-release" className="scroll-mt-24">5. Codebase Release</h2>
          <p>
            Upon activation of the kill switch, the complete source code of Screenplay Studio will be
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
            ensure redundancy. The license will permit free use, modification, and distribution —
            ensuring the community can maintain and improve the software independently.
          </p>

          {/* 6. Self-Hosting */}
          <h2 id="self-hosting" className="scroll-mt-24">6. Self-Hosting</h2>
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
            For users without the technical capability to self-host, the 30-day warning period provides
            sufficient time to export all content in standard formats (Fountain, Final Draft, PDF, JSON)
            for use in other tools.
          </p>

          {/* 7. What Happens to Your Data */}
          <h2 id="data" className="scroll-mt-24">7. What Happens to Your Data</h2>
          <p>
            Your data remains yours. Here is exactly what happens:
          </p>
          <ul>
            <li>
              <strong className="text-white">During the warning period:</strong> Full access to all data
              and export functionality. Export your screenplays, scripts, and project data at any time
              in Fountain, Final Draft (.fdx), PDF, or JSON format.
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

          {/* 8. Community Continuity */}
          <h2 id="continuity" className="scroll-mt-24">8. Community Continuity</h2>
          <p>
            The open-source kill switch is designed to enable seamless community takeover:
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

          {/* 9. Contact */}
          <h2 id="contact" className="scroll-mt-24">9. Contact</h2>
          <p>
            If you have questions about the open-source kill switch, the project&apos;s continuity plans,
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
