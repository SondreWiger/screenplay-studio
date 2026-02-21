import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Community Guidelines — Screenplay Studio',
  description: 'Rules and guidelines for participating in the Screenplay Studio community.',
};

export default function CommunityGuidelinesPage() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-brand-400 hover:text-brand-300 text-sm mb-8 inline-block">&larr; Back to home</Link>

        <h1 className="text-3xl font-bold text-white mb-2">Community Guidelines</h1>
        <p className="text-sm text-surface-500 mb-12">Last updated: February 21, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">

          <section>
            <p className="text-base text-surface-200">
              Screenplay Studio is a creative community built for writers, filmmakers, and storytellers.
              These guidelines ensure everyone can collaborate, share, and grow in a respectful and
              supportive environment. By participating in our community features, you agree to follow these rules.
            </p>
          </section>

          {/* ── Core Principles ───────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Core Principles</h2>
            <div className="grid gap-3">
              <div className="bg-surface-900 rounded-lg p-4 border border-surface-800">
                <h3 className="text-sm font-semibold text-white mb-1">🎬 Celebrate Creativity</h3>
                <p className="text-xs">Support fellow creatives. Offer constructive feedback, encourage experimentation, and celebrate the craft of storytelling.</p>
              </div>
              <div className="bg-surface-900 rounded-lg p-4 border border-surface-800">
                <h3 className="text-sm font-semibold text-white mb-1">🤝 Be Respectful</h3>
                <p className="text-xs">Treat every member with dignity. Disagreements are fine; personal attacks are not. Critique the work, not the person.</p>
              </div>
              <div className="bg-surface-900 rounded-lg p-4 border border-surface-800">
                <h3 className="text-sm font-semibold text-white mb-1">🔒 Protect Original Work</h3>
                <p className="text-xs">Respect intellectual property. Only share work you own or have permission to share. Give proper credit.</p>
              </div>
              <div className="bg-surface-900 rounded-lg p-4 border border-surface-800">
                <h3 className="text-sm font-semibold text-white mb-1">🌍 Be Inclusive</h3>
                <p className="text-xs">Our community is global. Be mindful of cultural differences and ensure everyone feels welcome regardless of their background.</p>
              </div>
            </div>
          </section>

          {/* ── Posting Rules ────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Posting Guidelines</h2>
            <p>When sharing content in the community — posts, scripts, discussions, or resources:</p>
            <div className="mt-3 space-y-2">
              <div className="flex gap-3 items-start">
                <span className="text-green-400 text-sm mt-0.5">✓</span>
                <div>
                  <strong className="text-white text-sm">Do:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-1 text-xs">
                    <li>Share original work, helpful resources, or thoughtful discussions</li>
                    <li>Use appropriate titles and descriptions that accurately represent your content</li>
                    <li>Tag your posts with relevant categories to help others find them</li>
                    <li>Provide content warnings for scripts dealing with sensitive themes (violence, trauma, etc.)</li>
                    <li>Credit collaborators, co-writers, and sources of inspiration</li>
                    <li>Ask specific questions and provide context when seeking feedback</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-red-400 text-sm mt-0.5">✗</span>
                <div>
                  <strong className="text-white text-sm">Don&apos;t:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-1 text-xs">
                    <li>Post spam, self-promotion unrelated to screenwriting, or commercially-motivated advertising</li>
                    <li>Share scripts or content that belongs to someone else without their explicit permission</li>
                    <li>Post misleading titles, clickbait, or content that misrepresents what it contains</li>
                    <li>Share copyrighted scripts from produced films unless it&apos;s clearly public domain or freely licensed</li>
                    <li>Post duplicate content or flood the feed with repetitive submissions</li>
                    <li>Share personal information of others without consent</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ── Commenting Rules ──────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Commenting &amp; Feedback Guidelines</h2>
            <p>
              Feedback is the lifeblood of a creative community. When commenting on other members&apos; work:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-white">Be constructive:</strong> Point out what works well <em>and</em> what
                could be improved. &quot;This doesn&apos;t work&quot; is not helpful; &quot;The dialogue in Act 2 feels
                expository — maybe show the conflict through action instead?&quot; is.
              </li>
              <li>
                <strong className="text-white">Be specific:</strong> Reference particular scenes, pages, or lines
                when giving feedback. Vague praise or criticism doesn&apos;t help the writer grow.
              </li>
              <li>
                <strong className="text-white">Be kind:</strong> Remember there&apos;s a person behind every script.
                Sharing creative work requires vulnerability. Treat others&apos; work as you&apos;d want yours treated.
              </li>
              <li>
                <strong className="text-white">Stay on topic:</strong> Keep comments relevant to the work or discussion.
                Offtopic conversations can derail productive feedback sessions.
              </li>
              <li>
                <strong className="text-white">No personal attacks:</strong> Criticize the work, never the person.
                Comments attacking a writer&apos;s identity, background, or character will be removed immediately.
              </li>
              <li>
                <strong className="text-white">Respect the writer&apos;s vision:</strong> You can suggest alternatives,
                but don&apos;t demand that someone change their creative choices. It&apos;s their story.
              </li>
            </ul>
          </section>

          {/* ── Editing & Collaboration ──────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Collaborative Editing Etiquette</h2>
            <p>When working in shared projects and editing scripts collaboratively:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-white">Communicate changes:</strong> Discuss significant edits with your collaborators
                before making them. Use the project chat or comments to explain your reasoning.
              </li>
              <li>
                <strong className="text-white">Use revision tools:</strong> Track your changes and label drafts clearly so everyone
                can follow the evolution of the script.
              </li>
              <li>
                <strong className="text-white">Respect roles:</strong> Each project has defined roles (owner, admin, writer, editor, viewer).
                Operate within your assigned role and reach out to the project owner if you need elevated access.
              </li>
              <li>
                <strong className="text-white">Don&apos;t delete others&apos; work:</strong> If you disagree with something, discuss it.
                Don&apos;t unilaterally remove scenes or rewrite sections another collaborator has contributed without consensus.
              </li>
              <li>
                <strong className="text-white">Save drafts:</strong> Before making major changes, save a draft snapshot so the team
                can always revert if needed.
              </li>
              <li>
                <strong className="text-white">Credit contributions:</strong> Acknowledge your collaborators&apos; contributions on
                the title page and in conversations. Every voice matters.
              </li>
            </ul>
          </section>

          {/* ── Challenges & Competitions ────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Challenges &amp; Competitions</h2>
            <p>Our community hosts writing challenges and competitions. When participating:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Submit only <strong className="text-white">original work</strong> created specifically for the challenge</li>
              <li>Follow the specific rules, themes, and constraints of each challenge</li>
              <li>Submit before the deadline — late submissions may not be accepted</li>
              <li>Vote fairly and honestly based on the quality of the work, not personal relationships</li>
              <li>Accept results gracefully — not every entry wins, and that&apos;s okay</li>
              <li>Don&apos;t manipulate votes through fake accounts or coordinated voting</li>
              <li>Provide feedback on other entries — challenges are about learning as much as winning</li>
            </ul>
          </section>

          {/* ── Direct Messaging ──────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Direct Messaging Rules</h2>
            <p>Our direct messaging feature is for genuine connection between community members:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>Only message people who have DMs enabled and are open to contact</li>
              <li>Introduce yourself before asking for favors — cold pitches without context are unwelcome</li>
              <li>Don&apos;t send unsolicited promotional content, scripts for coverage, or requests for free work</li>
              <li>Respect boundaries — if someone doesn&apos;t respond or asks you to stop, do so immediately</li>
              <li>No harassment, threats, or inappropriate content in private messages</li>
              <li>Report abusive messages using the report feature and block the offending user</li>
            </ul>
          </section>

          {/* ── Shared Scripts & Free Scripts ────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Sharing Scripts Publicly</h2>
            <p>When sharing scripts in the Free Scripts section or community feed:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>Only share work you own or have written permission to share</li>
              <li>Clearly state the license or terms under which you&apos;re sharing (e.g., &quot;free to read&quot;, &quot;open for collaboration&quot;, &quot;attribution required&quot;)</li>
              <li>Add appropriate content warnings for mature themes</li>
              <li>Do not upload copyrighted scripts from produced films, TV shows, or other writers</li>
              <li>Understand that once shared publicly, others may read and comment on your work</li>
              <li>You can unpublish or remove your shared scripts at any time</li>
            </ul>
          </section>

          {/* ── Prohibited Content ────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Prohibited Content</h2>
            <p>The following content is strictly prohibited in all community areas:</p>
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mt-3">
              <ul className="list-disc pl-4 space-y-1.5 text-xs">
                <li>Hate speech, slurs, or content that promotes discrimination based on race, ethnicity, gender, sexual orientation, religion, disability, or any other characteristic</li>
                <li>Threats of violence, promotion of terrorism, or content inciting harm to any individual or group</li>
                <li>Sexually explicit content, pornographic material, or content sexualizing minors in any form</li>
                <li>Doxxing — sharing personal, private, or identifying information about others without consent</li>
                <li>Misinformation or content deliberately designed to deceive or manipulate others</li>
                <li>Content that infringes on copyrights, trademarks, or other intellectual property rights</li>
                <li>Malicious links, phishing attempts, or content intended to compromise users&apos; security</li>
                <li>Impersonation of other users, public figures, or organizations</li>
                <li>Coordinated manipulation, including vote manipulation, fake accounts, or astroturfing</li>
              </ul>
            </div>
            <p className="mt-3 text-xs text-surface-500">
              <strong>Note on creative works:</strong> We distinguish between content shared <em>as creative fiction</em> (scripts depicting
              conflict, violence, or mature themes as part of storytelling) and content that <em>promotes or glorifies</em> harmful behavior.
              Well-crafted stories that explore difficult themes responsibly are welcome; gratuitous harmful content is not.
              See our <Link href="/content-policy" className="text-brand-400 hover:text-brand-300">Content Policy</Link> for details.
            </p>
          </section>

          {/* ── Enforcement ───────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Enforcement</h2>
            <p>We enforce these guidelines through a graduated response system:</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-3 bg-surface-900 rounded-lg p-3 border border-surface-800">
                <span className="text-yellow-400 text-sm font-bold shrink-0">1st</span>
                <div>
                  <strong className="text-white text-sm">Warning</strong>
                  <p className="text-xs mt-0.5">For minor first-time violations, you&apos;ll receive a warning explaining which guideline was violated.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-surface-900 rounded-lg p-3 border border-surface-800">
                <span className="text-orange-400 text-sm font-bold shrink-0">2nd</span>
                <div>
                  <strong className="text-white text-sm">Content Removal</strong>
                  <p className="text-xs mt-0.5">Repeated violations or more serious offenses result in content being removed and a formal notice.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-surface-900 rounded-lg p-3 border border-surface-800">
                <span className="text-orange-500 text-sm font-bold shrink-0">3rd</span>
                <div>
                  <strong className="text-white text-sm">Temporary Suspension</strong>
                  <p className="text-xs mt-0.5">Continued violations lead to a temporary suspension from community features (7-30 days).</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-surface-900 rounded-lg p-3 border border-surface-800">
                <span className="text-red-400 text-sm font-bold shrink-0">4th</span>
                <div>
                  <strong className="text-white text-sm">Permanent Ban</strong>
                  <p className="text-xs mt-0.5">Severe or repeated violations result in permanent removal from the community.</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-surface-500">
              Severe violations (hate speech, threats, illegal content) may result in immediate permanent ban without prior warnings.
            </p>
          </section>

          {/* ── Reporting ─────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Reporting Violations</h2>
            <p>If you encounter content or behavior that violates these guidelines:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use the <strong className="text-white">Report</strong> button available on posts, comments, and user profiles</li>
              <li>Include as much context as possible — screenshots, links, and descriptions help us investigate</li>
              <li>Reports are confidential — we will not reveal your identity to the person being reported</li>
              <li>We review all reports within 48 hours and take action as appropriate</li>
              <li>For urgent safety concerns, email us directly at{' '}
                <a href="mailto:safety@screenplaystudio.app" className="text-brand-400 hover:text-brand-300">safety@screenplaystudio.app</a>
              </li>
            </ul>
          </section>

          {/* ── Appeals ───────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Appeals Process</h2>
            <p>
              If you believe a moderation action was taken in error, you can appeal by emailing{' '}
              <a href="mailto:appeals@screenplaystudio.app" className="text-brand-400 hover:text-brand-300">appeals@screenplaystudio.app</a>.
              Include your username, the content in question, and your explanation. We will review your appeal within 7 business days
              and respond with our decision.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-surface-800 flex flex-wrap gap-4 text-xs text-surface-500">
          <Link href="/terms" className="hover:text-brand-400">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-brand-400">Privacy Policy</Link>
          <Link href="/acceptable-use" className="hover:text-brand-400">Acceptable Use Policy</Link>
          <Link href="/content-policy" className="hover:text-brand-400">Content Policy</Link>
        </div>
      </div>
    </div>
  );
}
