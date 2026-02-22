import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Community Guidelines — Screenplay Studio',
  description: 'Rules and guidelines for participating in the Screenplay Studio community.',
};

export default function CommunityGuidelinesPage() {
  return (
    <div>
      <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Community</p>
        <h1 className="text-3xl font-bold text-white tracking-tight">Community Guidelines</h1>
        <p className="text-sm text-surface-500 mt-2">Last updated: February 22, 2026</p>
        <p className="text-surface-400 leading-relaxed mt-4 text-[15px]">
          Screenplay Studio is a creative community built for writers, filmmakers, and storytellers.
          These guidelines ensure everyone can collaborate, share, and grow in a respectful and
          supportive environment. By participating in our community features, you agree to follow these rules.
        </p>
      </div>

      {/* Table of Contents */}
      <nav className="bg-surface-900/50 border border-surface-800 rounded-xl p-6 mb-10">
        <h2 className="text-sm font-semibold text-white mb-3">Table of Contents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {[
            { id: 'core-principles', label: '1. Core Principles' },
            { id: 'posting-guidelines', label: '2. Posting Guidelines' },
            { id: 'commenting', label: '3. Commenting & Feedback' },
            { id: 'collaboration', label: '4. Collaborative Editing Etiquette' },
            { id: 'challenges', label: '5. Challenges & Competitions' },
            { id: 'direct-messaging', label: '6. Direct Messaging Rules' },
            { id: 'sharing-scripts', label: '7. Sharing Scripts Publicly' },
            { id: 'prohibited', label: '8. Prohibited Content' },
            { id: 'enforcement', label: '9. Enforcement' },
            { id: 'reporting', label: '10. Reporting Violations' },
            { id: 'appeals', label: '11. Appeals Process' },
            { id: 'community-trust', label: '12. Community Trust & Safety' },
          ].map((item) => (
            <a key={item.id} href={`#${item.id}`} className="text-xs text-surface-400 hover:text-red-400 transition-colors py-1">
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-10">
        {/* ── Core Principles ───────────────────────────── */}
        <section id="core-principles">
          <h2 className="text-lg font-semibold text-white mb-4">1. Core Principles</h2>
          <div className="grid gap-3">
            {[
              { icon: '🎬', title: 'Celebrate Creativity', desc: 'Support fellow creatives. Offer constructive feedback, encourage experimentation, and celebrate the craft of storytelling.' },
              { icon: '🤝', title: 'Be Respectful', desc: 'Treat every member with dignity. Disagreements are fine; personal attacks are not. Critique the work, not the person.' },
              { icon: '🔒', title: 'Protect Original Work', desc: 'Respect intellectual property. Only share work you own or have permission to share. Give proper credit.' },
              { icon: '🌍', title: 'Be Inclusive', desc: 'Our community is global. Be mindful of cultural differences and ensure everyone feels welcome regardless of their background.' },
              { icon: '💡', title: 'Contribute Positively', desc: 'Every interaction should add value — whether it\'s encouragement, constructive criticism, a shared resource, or simply a kind word.' },
              { icon: '🛡️', title: 'Keep Everyone Safe', desc: 'If you see something concerning, report it. We all share the responsibility of maintaining a safe community.' },
            ].map((p) => (
              <div key={p.title} className="bg-surface-900 rounded-lg p-4 border border-surface-800">
                <h3 className="text-sm font-semibold text-white mb-1">{p.icon} {p.title}</h3>
                <p className="text-xs text-surface-400">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Posting Guidelines ──────────────────────────── */}
        <section id="posting-guidelines">
          <h2 className="text-lg font-semibold text-white mb-4">2. Posting Guidelines</h2>
          <p className="text-sm text-surface-300 mb-4">When sharing content in the community — posts, scripts, discussions, or resources:</p>
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <span className="text-green-400 text-sm mt-0.5 shrink-0">✓ Do:</span>
              <ul className="list-disc pl-4 space-y-1.5 text-xs text-surface-300">
                <li>Share original work, helpful resources, or thoughtful discussions</li>
                <li>Use appropriate titles and descriptions that accurately represent your content</li>
                <li>Tag your posts with relevant categories to help others find them</li>
                <li>Provide content warnings for scripts dealing with sensitive themes (violence, trauma, etc.)</li>
                <li>Credit collaborators, co-writers, and sources of inspiration</li>
                <li>Ask specific questions and provide context when seeking feedback</li>
                <li>Use descriptive labels for mature or triggering content</li>
              </ul>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-red-400 text-sm mt-0.5 shrink-0">✗ Don&apos;t:</span>
              <ul className="list-disc pl-4 space-y-1.5 text-xs text-surface-300">
                <li>Post spam, self-promotion unrelated to screenwriting, or commercially-motivated advertising</li>
                <li>Share scripts or content that belongs to someone else without their explicit permission</li>
                <li>Post misleading titles, clickbait, or content that misrepresents what it contains</li>
                <li>Share copyrighted scripts from produced films unless it&apos;s clearly public domain or freely licensed</li>
                <li>Post duplicate content or flood the feed with repetitive submissions</li>
                <li>Share personal information of others without consent (doxxing)</li>
                <li>Use deceptive AI-generated content without disclosure</li>
                <li>Engage in vote manipulation or coordinated promotion schemes</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Commenting & Feedback ───────────────────────── */}
        <section id="commenting">
          <h2 className="text-lg font-semibold text-white mb-4">3. Commenting &amp; Feedback Guidelines</h2>
          <p className="text-sm text-surface-300 mb-4">
            Feedback is the lifeblood of a creative community. When commenting on other members&apos; work:
          </p>
          <div className="space-y-3">
            {[
              { title: 'Be Constructive', desc: 'Point out what works well and what could be improved. "This doesn\'t work" is not helpful; "The dialogue in Act 2 feels expository — maybe show the conflict through action instead?" is.' },
              { title: 'Be Specific', desc: 'Reference particular scenes, pages, or lines when giving feedback. Vague praise or criticism doesn\'t help the writer grow.' },
              { title: 'Be Kind', desc: 'Remember there\'s a person behind every script. Sharing creative work requires vulnerability. Treat others\' work as you\'d want yours treated.' },
              { title: 'Stay On Topic', desc: 'Keep comments relevant to the work or discussion. Off-topic conversations can derail productive feedback sessions.' },
              { title: 'No Personal Attacks', desc: 'Criticize the work, never the person. Comments attacking a writer\'s identity, background, or character will be removed immediately.' },
              { title: 'Respect the Vision', desc: 'You can suggest alternatives, but don\'t demand that someone change their creative choices. It\'s their story.' },
            ].map((rule) => (
              <div key={rule.title} className="bg-surface-900/50 border border-surface-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-1">{rule.title}</h3>
                <p className="text-xs text-surface-400">{rule.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Collaborative Editing Etiquette ────────────── */}
        <section id="collaboration">
          <h2 className="text-lg font-semibold text-white mb-4">4. Collaborative Editing Etiquette</h2>
          <p className="text-sm text-surface-300 mb-4">When working in shared projects and editing scripts collaboratively:</p>
          <ul className="space-y-3 text-sm text-surface-300">
            <li className="flex gap-2"><span className="text-red-400 shrink-0">•</span><div><strong className="text-white">Communicate changes:</strong> Discuss significant edits with your collaborators before making them. Use project chat or comments.</div></li>
            <li className="flex gap-2"><span className="text-red-400 shrink-0">•</span><div><strong className="text-white">Use revision tools:</strong> Track your changes and label drafts clearly so everyone can follow the script&apos;s evolution.</div></li>
            <li className="flex gap-2"><span className="text-red-400 shrink-0">•</span><div><strong className="text-white">Respect roles:</strong> Each project has defined roles (owner, admin, writer, editor, viewer). Operate within your assigned role.</div></li>
            <li className="flex gap-2"><span className="text-red-400 shrink-0">•</span><div><strong className="text-white">Don&apos;t delete others&apos; work:</strong> If you disagree, discuss it. Don&apos;t unilaterally remove scenes without consensus.</div></li>
            <li className="flex gap-2"><span className="text-red-400 shrink-0">•</span><div><strong className="text-white">Save drafts:</strong> Before making major changes, save a draft snapshot so the team can revert if needed.</div></li>
            <li className="flex gap-2"><span className="text-red-400 shrink-0">•</span><div><strong className="text-white">Credit contributions:</strong> Acknowledge collaborators&apos; contributions on the title page and in conversations.</div></li>
          </ul>
        </section>

        {/* ── Challenges & Competitions ────────────────── */}
        <section id="challenges">
          <h2 className="text-lg font-semibold text-white mb-4">5. Challenges &amp; Competitions</h2>
          <p className="text-sm text-surface-300 mb-4">Our community hosts writing challenges and competitions. When participating:</p>
          <ul className="list-disc pl-6 space-y-2 text-sm text-surface-300">
            <li>Submit only <strong className="text-white">original work</strong> created specifically for the challenge</li>
            <li>Follow the specific rules, themes, and constraints of each challenge</li>
            <li>Submit before the deadline — late submissions may not be accepted</li>
            <li>Vote fairly and honestly based on the quality of the work, not personal relationships</li>
            <li>Accept results gracefully — not every entry wins, and that&apos;s okay</li>
            <li>Don&apos;t manipulate votes through fake accounts or coordinated voting</li>
            <li>Provide feedback on other entries — challenges are about learning as much as winning</li>
            <li>AI-assisted entries must be clearly disclosed as such</li>
          </ul>
        </section>

        {/* ── Direct Messaging ──────────────────────────── */}
        <section id="direct-messaging">
          <h2 className="text-lg font-semibold text-white mb-4">6. Direct Messaging Rules</h2>
          <p className="text-sm text-surface-300 mb-4">Our direct messaging feature is for genuine connection between community members:</p>
          <ul className="list-disc pl-6 space-y-2 text-sm text-surface-300">
            <li>Only message people who have DMs enabled and are open to contact</li>
            <li>Introduce yourself before asking for favors — cold pitches without context are unwelcome</li>
            <li>Don&apos;t send unsolicited promotional content, scripts for coverage, or requests for free work</li>
            <li>Respect boundaries — if someone doesn&apos;t respond or asks you to stop, do so immediately</li>
            <li>No harassment, threats, or inappropriate content in private messages</li>
            <li>Report abusive messages using the report feature and block the offending user</li>
            <li>DM abuse may result in messaging restrictions or account suspension</li>
          </ul>
        </section>

        {/* ── Sharing Scripts ──────────────────────────── */}
        <section id="sharing-scripts">
          <h2 className="text-lg font-semibold text-white mb-4">7. Sharing Scripts Publicly</h2>
          <p className="text-sm text-surface-300 mb-4">When sharing scripts in the Free Scripts section or community feed:</p>
          <ul className="list-disc pl-6 space-y-2 text-sm text-surface-300">
            <li>Only share work you own or have written permission to share</li>
            <li>Clearly state the license or terms under which you&apos;re sharing (e.g., &quot;free to read&quot;, &quot;open for collaboration&quot;, &quot;attribution required&quot;)</li>
            <li>Add appropriate content warnings for mature themes</li>
            <li>Do not upload copyrighted scripts from produced films, TV shows, or other writers</li>
            <li>Understand that once shared publicly, others may read and comment on your work</li>
            <li>You can unpublish or remove your shared scripts at any time</li>
            <li>Public scripts are protected from AI scraping — see our <Link href="/legal/security" className="text-red-400 hover:text-red-300">Security Policy</Link></li>
          </ul>
        </section>

        {/* ── Prohibited Content ────────────────────────── */}
        <section id="prohibited">
          <h2 className="text-lg font-semibold text-white mb-4">8. Prohibited Content</h2>
          <p className="text-sm text-surface-300 mb-4">The following content is strictly prohibited in all community areas:</p>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
            <ul className="list-disc pl-4 space-y-2 text-xs text-surface-300">
              <li>Hate speech, slurs, or content that promotes discrimination based on race, ethnicity, gender, sexual orientation, religion, disability, or any other characteristic</li>
              <li>Threats of violence, promotion of terrorism, or content inciting harm to any individual or group</li>
              <li>Sexually explicit content, pornographic material, or content sexualizing minors in any form</li>
              <li>Doxxing — sharing personal, private, or identifying information about others without consent</li>
              <li>Misinformation or content deliberately designed to deceive or manipulate others</li>
              <li>Content that infringes on copyrights, trademarks, or other intellectual property rights</li>
              <li>Malicious links, phishing attempts, or content intended to compromise users&apos; security</li>
              <li>Impersonation of other users, public figures, or organizations</li>
              <li>Coordinated manipulation, including vote manipulation, fake accounts, or astroturfing</li>
              <li>Illegal content or content promoting illegal activities</li>
              <li>Content intended to harass, bully, or intimidate specific individuals</li>
            </ul>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mt-4">
            <p className="text-xs text-surface-400">
              <strong className="text-red-400">Note on creative works:</strong> We distinguish between content shared <em>as creative fiction</em> (scripts depicting
              conflict, violence, or mature themes as part of storytelling) and content that <em>promotes or glorifies</em> harmful behavior.
              Well-crafted stories that explore difficult themes responsibly are welcome; gratuitous harmful content is not.
              See our <Link href="/legal/content-policy" className="text-red-400 hover:text-red-300">Content Policy</Link> for details.
            </p>
          </div>
        </section>

        {/* ── Enforcement ────────────────────────────────── */}
        <section id="enforcement">
          <h2 className="text-lg font-semibold text-white mb-4">9. Enforcement</h2>
          <p className="text-sm text-surface-300 mb-4">We enforce these guidelines through a graduated response system:</p>
          <div className="space-y-2">
            {[
              { step: '1st', color: 'yellow', title: 'Warning', desc: 'For minor first-time violations, you\'ll receive a warning explaining which guideline was violated.' },
              { step: '2nd', color: 'orange', title: 'Content Removal', desc: 'Repeated violations or more serious offenses result in content being removed and a formal notice.' },
              { step: '3rd', color: 'orange', title: 'Temporary Suspension', desc: 'Continued violations lead to a temporary suspension from community features (7-30 days).' },
              { step: '4th', color: 'red', title: 'Permanent Ban', desc: 'Severe or repeated violations result in permanent removal from the community.' },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-3 bg-surface-900 rounded-lg p-3 border border-surface-800">
                <span className={`text-${s.color}-400 text-sm font-bold shrink-0`}>{s.step}</span>
                <div>
                  <strong className="text-white text-sm">{s.title}</strong>
                  <p className="text-xs text-surface-400 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-surface-500">
            Severe violations (hate speech, threats, illegal content) may result in immediate permanent ban without prior warnings.
          </p>
        </section>

        {/* ── Reporting ───────────────────────────────────── */}
        <section id="reporting">
          <h2 className="text-lg font-semibold text-white mb-4">10. Reporting Violations</h2>
          <p className="text-sm text-surface-300 mb-4">If you encounter content or behavior that violates these guidelines:</p>
          <ul className="list-disc pl-6 space-y-2 text-sm text-surface-300">
            <li>Use the <strong className="text-white">Report</strong> button available on posts, comments, and user profiles</li>
            <li>Include as much context as possible — screenshots, links, and descriptions help us investigate</li>
            <li>Reports are <strong className="text-white">confidential</strong> — we will not reveal your identity to the person being reported</li>
            <li>We review all reports within 48 hours and take action as appropriate</li>
            <li>False or malicious reports may result in action against the reporter</li>
            <li>For urgent safety concerns, email us directly at{' '}
              <a href="mailto:safety@screenplaystudio.fun" className="text-red-400 hover:text-red-300">safety@screenplaystudio.fun</a>
            </li>
          </ul>
        </section>

        {/* ── Appeals ─────────────────────────────────────── */}
        <section id="appeals">
          <h2 className="text-lg font-semibold text-white mb-4">11. Appeals Process</h2>
          <p className="text-sm text-surface-300 mb-4">
            If you believe a moderation action was taken in error, you can appeal:
          </p>
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-3">
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-500/15 text-red-400 text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
              <p className="text-sm text-surface-300">Email <a href="mailto:appeals@screenplaystudio.fun" className="text-red-400 hover:text-red-300">appeals@screenplaystudio.fun</a> with your username, the content in question, and your explanation.</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-500/15 text-red-400 text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
              <p className="text-sm text-surface-300">A different moderator from the one who made the original decision will review your appeal.</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-500/15 text-red-400 text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
              <p className="text-sm text-surface-300">We will respond with our decision within 7 business days.</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-500/15 text-red-400 text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
              <p className="text-sm text-surface-300">Appeal decisions are final unless new evidence is presented.</p>
            </div>
          </div>
        </section>

        {/* ── Community Trust & Safety ─────────────────────── */}
        <section id="community-trust">
          <h2 className="text-lg font-semibold text-white mb-4">12. Community Trust &amp; Safety</h2>
          <p className="text-sm text-surface-300 mb-4">
            We are committed to maintaining a community where every member feels safe and valued:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-surface-900 border border-surface-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-2">🔍 Proactive Monitoring</h3>
              <p className="text-xs text-surface-400">Our moderation team actively monitors community spaces to identify and address potential issues before they escalate.</p>
            </div>
            <div className="bg-surface-900 border border-surface-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-2">🤖 Automated Detection</h3>
              <p className="text-xs text-surface-400">We use automated tools to detect spam, harassment patterns, and prohibited content — but human moderators make all final decisions.</p>
            </div>
            <div className="bg-surface-900 border border-surface-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-2">📊 Transparency Reports</h3>
              <p className="text-xs text-surface-400">We periodically publish community trust & safety reports covering moderation actions, ban statistics, and policy updates.</p>
            </div>
            <div className="bg-surface-900 border border-surface-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-2">💬 Feedback Welcome</h3>
              <p className="text-xs text-surface-400">These guidelines evolve based on community feedback. Suggest improvements via our support channels or Legal Blog.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Links */}
      <div className="mt-16 pt-8 border-t border-surface-800">
        <h3 className="text-sm font-semibold text-white mb-3">Related Policies</h3>
        <div className="flex flex-wrap gap-4 text-xs text-surface-500">
          <Link href="/legal/terms" className="hover:text-red-400 transition-colors">Terms of Service</Link>
          <Link href="/legal/privacy" className="hover:text-red-400 transition-colors">Privacy Policy</Link>
          <Link href="/legal/acceptable-use" className="hover:text-red-400 transition-colors">Acceptable Use Policy</Link>
          <Link href="/legal/content-policy" className="hover:text-red-400 transition-colors">Content Policy</Link>
          <Link href="/legal/dmca" className="hover:text-red-400 transition-colors">DMCA Policy</Link>
        </div>
        <p className="text-xs text-surface-600 mt-4">
          Questions about these guidelines? Contact us at{' '}
          <a href="mailto:community@screenplaystudio.fun" className="text-red-400 hover:text-red-300">community@screenplaystudio.fun</a>
        </p>
      </div>
      </div>
    </div>
  );
}
