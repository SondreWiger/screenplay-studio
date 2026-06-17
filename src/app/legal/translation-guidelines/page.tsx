import Link from 'next/link';

export const metadata = {
  title: 'Translation Guidelines, Screenplay Studio',
  description: 'Guidelines for contributing translations to Screenplay Studio. Read the quality standards and community rules for the Translator Hub.',
};

export default function TranslationGuidelinesPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-orange-400 uppercase tracking-wider mb-3">Community Guidelines</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Translation Guidelines</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: June 17, 2026</p>
        </div>

        <nav className="mb-12 rounded-lg bg-surface-900/50 border border-surface-800/60 p-6">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">Table of Contents</h2>
          <ol className="list-decimal list-inside space-y-1.5 text-surface-400 text-[13px]">
            <li><a href="#overview" className="hover:text-orange-400 transition-colors">Overview</a></li>
            <li><a href="#eligibility" className="hover:text-orange-400 transition-colors">Eligibility</a></li>
            <li><a href="#quality" className="hover:text-orange-400 transition-colors">Quality Standards</a></li>
            <li><a href="#voting" className="hover:text-orange-400 transition-colors">Voting System</a></li>
            <li><a href="#adding-languages" className="hover:text-orange-400 transition-colors">Adding New Languages</a></li>
            <li><a href="#prohibited" className="hover:text-orange-400 transition-colors">Prohibited Content</a></li>
            <li><a href="#ip" className="hover:text-orange-400 transition-colors">Intellectual Property</a></li>
            <li><a href="#moderation" className="hover:text-orange-400 transition-colors">Moderation</a></li>
            <li><a href="#changes" className="hover:text-orange-400 transition-colors">Changes to Guidelines</a></li>
            <li><a href="#contact" className="hover:text-orange-400 transition-colors">Contact</a></li>
          </ol>
        </nav>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300 prose-strong:text-white prose-headings:border-b prose-headings:border-surface-800/60 prose-headings:pb-3 prose-headings:mb-5">
          <h2 id="overview" className="scroll-mt-24">1. Overview</h2>
          <p>
            The Translator Hub allows Screenplay Studio users to collaboratively translate the application into their native languages. By participating, you help make screenwriting tools accessible to creators worldwide.
          </p>
          <p>
            These guidelines apply to all translation contributions, including text suggestions, votes on translations, and language additions. By submitting any translation contribution, you agree to these guidelines in addition to our <Link href="/legal/terms" className="text-orange-400 hover:text-orange-300">Terms of Service</Link> and <Link href="/legal/community-guidelines" className="text-orange-400 hover:text-orange-300">Community Guidelines</Link>.
          </p>

          <h2 id="eligibility" className="scroll-mt-24">2. Eligibility</h2>
          <p>To contribute translations, you must:</p>
          <ul>
            <li>Have a registered Screenplay Studio account in good standing</li>
            <li>Have accepted these Translation Guidelines</li>
            <li>Be genuinely fluent in the language you are translating to or from</li>
            <li>Pass the language verification quiz when adding a new language</li>
          </ul>
          <p>
            Translations are a community effort. We trust our contributors to be honest about their language abilities. Attempting to bypass language verification or submitting translations in languages you do not speak is a violation of these guidelines.
          </p>

          <h2 id="quality" className="scroll-mt-24">3. Quality Standards</h2>
          <p>All translation contributions should meet the following standards:</p>
          <ul>
            <li><strong>Accuracy:</strong> Translations must faithfully convey the meaning of the original English text. Do not add, remove, or alter the intent of the source material.</li>
            <li><strong>Natural phrasing:</strong> Translations should read naturally in the target language. Avoid literal word-for-word translations that sound awkward or robotic.</li>
            <li><strong>Context awareness:</strong> Consider the context in which the text appears. A button label should be concise; an error message should be clear; a page heading should be descriptive.</li>
            <li><strong>Consistency:</strong> Use consistent terminology throughout. If you translate &quot;Save&quot; as one term, use the same term for all &quot;Save&quot; buttons.</li>
            <li><strong>No machine translations:</strong> Do not submit raw machine-translated text (e.g., from Google Translate, DeepL, or similar services) without thorough human review and refinement. Machine translations often miss context, tone, and cultural nuance.</li>
            <li><strong>Formatting:</strong> Preserve any formatting, placeholders (e.g., {'{name}'}, {'{count}'}), or special characters from the source text.</li>
          </ul>

          <h2 id="voting" className="scroll-mt-24">4. Voting System</h2>
          <p>
            Every translation suggestion can be voted on by the community. The suggestion with the highest net score (upvotes minus downvotes) for each key and language becomes the active translation.
          </p>
          <ul>
            <li><strong>Upvote</strong> a suggestion if it is accurate, natural, and well-suited to the context.</li>
            <li><strong>Downvote</strong> a suggestion if it is inaccurate, awkward, or inappropriate.</li>
            <li>You may change or remove your vote at any time.</li>
            <li>Do not manipulate votes through multiple accounts, coordinated voting, or any other method.</li>
          </ul>
          <p>
            The voting system is designed to surface the best community translations without requiring admin approval for every change. Admins may intervene to remove or reject translations that violate these guidelines.
          </p>

          <h2 id="adding-languages" className="scroll-mt-24">5. Adding New Languages</h2>
          <p>
            If your language is not yet available, you can request to add it by passing a short fluency quiz. This quiz verifies that you genuinely speak the language and helps maintain translation quality.
          </p>
          <ul>
            <li>The quiz consists of basic vocabulary and grammar questions in the target language.</li>
            <li>You must answer at least 3 out of 5 questions correctly to pass.</li>
            <li>If you fail, you may retry after 24 hours.</li>
            <li>By adding a language, you take responsibility as its initial champion. While anyone can contribute translations for that language, you helped bring it to the platform.</li>
          </ul>
          <p>
            False language claims — passing a quiz through external assistance or collaborative cheating — result in immediate suspension from the Translator Hub and may lead to account action.
          </p>

          <h2 id="prohibited" className="scroll-mt-24">6. Prohibited Content</h2>
          <p>The following are not permitted in translation contributions:</p>
          <ul>
            <li>Hate speech, slurs, or discriminatory language</li>
            <li>Profanity or vulgar language (unless it is an accurate translation of equally strong source text)</li>
            <li>Spam, advertising, or promotional content</li>
            <li>Deliberately misleading or nonsensical translations</li>
            <li>Translations that promote violence, illegal activity, or self-harm</li>
            <li>Personal attacks or inappropriate content directed at other users</li>
            <li>Any content that violates our <Link href="/legal/community-guidelines" className="text-orange-400 hover:text-orange-300">Community Guidelines</Link></li>
          </ul>

          <h2 id="ip" className="scroll-mt-24">7. Intellectual Property</h2>
          <p>
            By submitting a translation, you grant Screenplay Studio a non-exclusive, worldwide, royalty-free license to use, modify, and display your translation within the application. You retain ownership of your contributions.
          </p>
          <p>
            Translations are derivative works of the original English text. The original UI text remains the property of Screenplay Studio / Northem Development.
          </p>

          <h2 id="moderation" className="scroll-mt-24">8. Moderation</h2>
          <p>
            Screenplay Studio administrators reserve the right to:
          </p>
          <ul>
            <li>Reject or remove any translation that violates these guidelines</li>
            <li>Override community votes when necessary to maintain quality or safety</li>
            <li>Disable voting or translation submissions for specific keys or languages</li>
            <li>Suspend or revoke Translator Hub access for users who violate these guidelines</li>
            <li>Modify quiz questions or passing thresholds</li>
          </ul>
          <p>
            Moderation actions are taken at the discretion of the admin team. Repeated violations may result in account suspension as described in our Terms of Service.
          </p>

          <h2 id="changes" className="scroll-mt-24">9. Changes to Guidelines</h2>
          <p>
            We may update these guidelines from time to time. Significant changes will be communicated through the platform. Continued participation in the Translator Hub after changes constitutes acceptance of the updated guidelines.
          </p>

          <h2 id="contact" className="scroll-mt-24">10. Contact</h2>
          <p>
            Questions about these guidelines? Reach out at{' '}
            <a href="mailto:legal@screenplaystudio.fun" className="text-orange-400 hover:text-orange-300">legal@screenplaystudio.fun</a>.
          </p>
        </article>
      </div>
    </div>
  );
}
