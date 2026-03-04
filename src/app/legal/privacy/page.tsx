import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Screenplay Studio',
  description: 'Privacy Policy for Screenplay Studio. Learn how we collect, use, and protect your personal data in compliance with GDPR and applicable data protection laws.',
};

export default function PrivacyPolicyPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Privacy</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 rounded-lg bg-surface-900/50 border border-surface-800/60 p-6">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">Table of Contents</h2>
          <ol className="list-decimal list-inside space-y-1 text-surface-300 text-sm columns-1 sm:columns-2 gap-8">
            <li><a href="#introduction" className="hover:text-red-400 transition-colors">Introduction &amp; Data Controller</a></li>
            <li><a href="#data-collected" className="hover:text-red-400 transition-colors">Data We Collect</a></li>
            <li><a href="#legal-basis" className="hover:text-red-400 transition-colors">Legal Basis for Processing</a></li>
            <li><a href="#how-we-use" className="hover:text-red-400 transition-colors">How We Use Your Data</a></li>
            <li><a href="#third-party-processors" className="hover:text-red-400 transition-colors">Third-Party Processors</a></li>
            <li><a href="#data-sharing" className="hover:text-red-400 transition-colors">Data Sharing</a></li>
            <li><a href="#ai-ml" className="hover:text-red-400 transition-colors">AI &amp; Machine Learning Policy</a></li>
            <li><a href="#international-transfers" className="hover:text-red-400 transition-colors">International Transfers</a></li>
            <li><a href="#data-retention" className="hover:text-red-400 transition-colors">Data Retention</a></li>
            <li><a href="#gdpr-rights" className="hover:text-red-400 transition-colors">Your GDPR Rights</a></li>
            <li><a href="#ccpa-rights" className="hover:text-red-400 transition-colors">CCPA Rights</a></li>
            <li><a href="#children" className="hover:text-red-400 transition-colors">Children&apos;s Privacy</a></li>
            <li><a href="#security" className="hover:text-red-400 transition-colors">Security</a></li>
            <li><a href="#cookies" className="hover:text-red-400 transition-colors">Cookies &amp; Tracking Technologies</a></li>
            <li><a href="#marketing" className="hover:text-red-400 transition-colors">Marketing Communications</a></li>
            <li><a href="#breach-notification" className="hover:text-red-400 transition-colors">Breach Notification</a></li>
            <li><a href="#automated-decisions" className="hover:text-red-400 transition-colors">Automated Decision-Making</a></li>
            <li><a href="#changes" className="hover:text-red-400 transition-colors">Changes to This Policy</a></li>
            <li><a href="#dpo" className="hover:text-red-400 transition-colors">Data Protection Officer</a></li>
            <li><a href="#contact" className="hover:text-red-400 transition-colors">Contact</a></li>
          </ol>
        </nav>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white">
          {/* 1. Introduction & Data Controller */}
          <h2 id="introduction" className="scroll-mt-24">1. Introduction &amp; Data Controller</h2>
          <p>
            Screenplay Studio (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;, &quot;the Company&quot;) is developed and operated by <a href="https://development.northem.no/" target="_blank" rel="noopener noreferrer">Northem Development</a>, a Norwegian software development company. We are committed to protecting and respecting your privacy. This Privacy Policy explains how we collect, use, store, share, and protect your personal data when you access or use our website at screenplaystudio.fun, our web application, APIs, and any related services (collectively, &quot;the Service&quot;).
          </p>
          <p>
            The data controller responsible for your personal data within the meaning of the EU General Data Protection Regulation (GDPR) and the Norwegian Personal Data Act (Personopplysningsloven) is:
          </p>
          <div className="rounded-lg bg-surface-900 border border-surface-800 p-4 not-prose text-surface-300 mb-4">
            <p><strong className="text-white">Screenplay Studio</strong></p>
            <p>Norway</p>
            <p>Email: <a href="mailto:dpo@screenplaystudio.fun" className="text-red-400 hover:text-red-300 transition-colors">dpo@screenplaystudio.fun</a></p>
          </div>
          <p>
            This Privacy Policy should be read in conjunction with our <Link href="/legal/terms" className="text-red-400 hover:text-red-300 transition-colors">Terms of Service</Link>. By using the Service, you acknowledge that you have read and understood this Privacy Policy. If you do not agree with how we process your data, please do not use the Service.
          </p>

          {/* 2. Data We Collect */}
          <h2 id="data-collected" className="scroll-mt-24">2. Data We Collect</h2>
          <p>
            We collect and process the following categories of personal data:
          </p>

          <h3>2.1 Account Data</h3>
          <p>Data provided during account registration and management:</p>
          <ul>
            <li><strong>Email address</strong> — used for authentication, account recovery, and communications.</li>
            <li><strong>Display name / username</strong> — used for identification within the Service.</li>
            <li><strong>Password hash</strong> — securely hashed using industry-standard algorithms (bcrypt/argon2). We never store passwords in plain text and cannot access your actual password.</li>
            <li><strong>Authentication provider data</strong> — if you sign in via a third-party provider (e.g., Google, GitHub), we receive your name, email, and profile picture URL from that provider.</li>
          </ul>

          <h3>2.2 Profile Data</h3>
          <p>Optional information you choose to add to your public profile:</p>
          <ul>
            <li><strong>Biography / about text</strong> — your self-description visible on your profile.</li>
            <li><strong>Avatar / profile picture</strong> — uploaded image or Gravatar.</li>
            <li><strong>External links</strong> — links to your website, IMDb, social media, or portfolio.</li>
            <li><strong>Location</strong> — optional self-reported location (city, country).</li>
            <li><strong>Professional role / title</strong> — e.g., screenwriter, director, producer.</li>
          </ul>

          <h3>2.3 Project &amp; Creative Data</h3>
          <p>Content you create, upload, or store within the Service:</p>
          <ul>
            <li><strong>Screenplays and scripts</strong> — full text of your scripts, including dialogue, action lines, scene headings, and all formatting elements.</li>
            <li><strong>Scenes and scene metadata</strong> — scene breakdowns, scene numbers, locations, times of day, and scene notes.</li>
            <li><strong>Characters</strong> — character names, descriptions, backstories, relationships, and arcs.</li>
            <li><strong>Storyboard shots</strong> — shot descriptions, camera angles, visual references, and annotations.</li>
            <li><strong>Budgets</strong> — production budget items, estimates, and financial planning data.</li>
            <li><strong>Schedules</strong> — shooting schedules, production calendars, and timeline data.</li>
            <li><strong>Project metadata</strong> — project titles, loglines, genres, tags, creation dates, and modification history.</li>
            <li><strong>Comments and annotations</strong> — notes, feedback, and comments within projects.</li>
          </ul>
          <p className="font-semibold text-white">
            Important: You retain 100% ownership of all creative content. We never access your creative content for any purpose other than providing the Service to you. See Section 7 (AI &amp; Machine Learning Policy) for our commitment regarding AI.
          </p>

          <h3>2.4 Usage Data</h3>
          <p>Data automatically collected about how you interact with the Service:</p>
          <ul>
            <li><strong>Page views and navigation</strong> — which pages and features you visit.</li>
            <li><strong>Feature usage</strong> — which tools and features you use, frequency, and duration.</li>
            <li><strong>Session duration</strong> — how long you use the Service per session.</li>
            <li><strong>Referral source</strong> — how you arrived at the Service (e.g., search engine, direct link).</li>
            <li><strong>Interaction events</strong> — clicks, scrolls, and UI interactions (anonymized and aggregated).</li>
          </ul>

          <h3>2.5 Technical Data</h3>
          <p>Data automatically collected from your device and connection:</p>
          <ul>
            <li><strong>IP address</strong> — used for security, fraud prevention, and approximate geolocation.</li>
            <li><strong>Browser type and version</strong> — e.g., Chrome 120, Firefox 121, Safari 17.</li>
            <li><strong>Device type and operating system</strong> — e.g., desktop/macOS, mobile/iOS.</li>
            <li><strong>Screen resolution</strong> — used for responsive design optimization.</li>
            <li><strong>Language and timezone</strong> — browser language preference and timezone setting.</li>
            <li><strong>User agent string</strong> — technical browser identification string.</li>
          </ul>

          <h3>2.6 Communication Data</h3>
          <p>Data arising from your communications with us and other users:</p>
          <ul>
            <li><strong>Support requests</strong> — messages, tickets, and attachments sent to our support team.</li>
            <li><strong>Direct messages</strong> — messages sent to other users through the Service&apos;s messaging features.</li>
            <li><strong>Community posts</strong> — content posted in community forums, showcase comments, and discussion threads.</li>
            <li><strong>Feedback and surveys</strong> — responses to feedback requests or surveys.</li>
          </ul>

          <h3>2.7 Payment Data</h3>
          <p>Data related to paid subscriptions and transactions:</p>
          <ul>
            <li><strong>PayPal email address</strong> — the email associated with your PayPal account used for payment.</li>
            <li><strong>Transaction IDs</strong> — PayPal transaction reference numbers for record-keeping.</li>
            <li><strong>Subscription plan and status</strong> — which plan you subscribe to and whether it is active, cancelled, or expired.</li>
            <li><strong>Billing dates</strong> — subscription start date, renewal date, and cancellation date.</li>
            <li><strong>Transaction amounts</strong> — payment amounts and currency.</li>
          </ul>
          <p className="font-semibold text-white">
            We never collect, store, or have access to your credit card numbers, debit card numbers, bank account numbers, or other direct financial instrument data. All payment processing is handled entirely by PayPal.
          </p>

          <h3>2.8 Cookies &amp; Similar Technologies</h3>
          <p>
            We use cookies and similar technologies to operate the Service. For complete details, see Section 14 (<a href="#cookies">Cookies &amp; Tracking Technologies</a>) and our <Link href="/legal/cookies" className="text-red-400 hover:text-red-300 transition-colors">Cookie Policy</Link>.
          </p>

          {/* 3. Legal Basis for Processing */}
          <h2 id="legal-basis" className="scroll-mt-24">3. Legal Basis for Processing</h2>
          <p>
            Under the GDPR and Norwegian data protection law, we process your personal data on the following legal bases:
          </p>

          <h3>3.1 Performance of Contract (Article 6(1)(b) GDPR)</h3>
          <p>Processing necessary to perform our contract with you (the Terms of Service), including:</p>
          <ul>
            <li>Creating and managing your account.</li>
            <li>Storing and displaying your projects and creative content.</li>
            <li>Enabling collaboration features with users you invite.</li>
            <li>Processing subscription payments and managing billing.</li>
            <li>Providing customer support.</li>
            <li>Enabling data export and portability.</li>
          </ul>

          <h3>3.2 Consent (Article 6(1)(a) GDPR)</h3>
          <p>Processing based on your freely given, specific, informed, and unambiguous consent, including:</p>
          <ul>
            <li>Sending marketing emails and newsletters (opt-in only).</li>
            <li>Setting non-essential cookies and analytics tracking.</li>
            <li>Publishing your content on community showcase pages.</li>
            <li>Processing your data for any optional AI-powered features (if introduced).</li>
          </ul>
          <p>You may withdraw consent at any time without affecting the lawfulness of processing carried out before withdrawal.</p>

          <h3>3.3 Legitimate Interest (Article 6(1)(f) GDPR)</h3>
          <p>Processing necessary for our legitimate interests, provided these are not overridden by your fundamental rights and freedoms, including:</p>
          <ul>
            <li>Analysing anonymized and aggregated usage patterns to improve the Service.</li>
            <li>Detecting, preventing, and investigating fraud, abuse, and security incidents.</li>
            <li>Enforcing our Terms of Service and Community Guidelines.</li>
            <li>Maintaining service stability and performance monitoring.</li>
            <li>Internal record-keeping and administration.</li>
          </ul>

          <h3>3.4 Legal Obligation (Article 6(1)(c) GDPR)</h3>
          <p>Processing necessary to comply with legal obligations to which we are subject, including:</p>
          <ul>
            <li>Retaining financial and transaction records as required by Norwegian tax and accounting laws.</li>
            <li>Responding to lawful requests from law enforcement or regulatory authorities.</li>
            <li>Complying with data protection laws (GDPR, Personopplysningsloven) regarding data subject rights.</li>
            <li>Reporting personal data breaches to the Norwegian Data Protection Authority (Datatilsynet) where required.</li>
          </ul>

          {/* 4. How We Use Your Data */}
          <h2 id="how-we-use" className="scroll-mt-24">4. How We Use Your Data</h2>
          <p>
            We use your personal data for the following specific purposes:
          </p>
          <ol>
            <li><strong>Account Management:</strong> Creating, authenticating, and maintaining your user account, including password recovery and two-factor authentication.</li>
            <li><strong>Service Delivery:</strong> Providing core Service functionality, including script editing, formatting, project management, and storage.</li>
            <li><strong>Collaboration:</strong> Enabling real-time and asynchronous collaboration between users you invite to your projects, including notifications, presence indicators, and change tracking.</li>
            <li><strong>Community Features:</strong> Operating community showcase pages, forums, messaging, user profiles, and social features.</li>
            <li><strong>Payment Processing:</strong> Processing subscription purchases, renewals, cancellations, and refunds through PayPal.</li>
            <li><strong>Customer Support:</strong> Responding to support requests, troubleshooting issues, and providing technical assistance.</li>
            <li><strong>Service Improvement:</strong> Analysing anonymized and aggregated usage data to identify bugs, improve features, optimize performance, and develop new functionality.</li>
            <li><strong>Personalization:</strong> Adapting the Service interface to your preferences, such as timezone, language, and display settings.</li>
            <li><strong>Security:</strong> Detecting, preventing, and investigating unauthorized access, fraud, abuse, and other security threats.</li>
            <li><strong>Compliance:</strong> Meeting our legal obligations under GDPR, Norwegian law, tax regulations, and other applicable legislation.</li>
            <li><strong>Communications:</strong> Sending transactional emails (account verification, password resets, subscription confirmations, collaboration invitations) and, with your consent, marketing emails.</li>
            <li><strong>Data Export:</strong> Generating downloadable exports of your projects and personal data upon request.</li>
            <li><strong>Moderation:</strong> Enforcing our Terms of Service and Community Guidelines to maintain a safe and professional environment.</li>
            <li><strong>Analytics:</strong> Producing anonymized, aggregated statistical reports about Service usage (these reports never contain personally identifiable information or creative content).</li>
            <li><strong>Legal Proceedings:</strong> Establishing, exercising, or defending legal claims where necessary.</li>
          </ol>

          {/* 5. Third-Party Processors */}
          <h2 id="third-party-processors" className="scroll-mt-24">5. Third-Party Processors</h2>
          <p>
            We use the following third-party service providers (data processors) to operate the Service. Each processor operates under a Data Processing Agreement (DPA) that ensures GDPR-compliant data handling:
          </p>

          <div className="space-y-6">
            <div className="rounded-lg bg-surface-900 border border-surface-800 p-4 not-prose">
              <h4 className="text-white font-semibold mb-2">Supabase (Supabase Inc.)</h4>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Role:</strong> Database hosting, user authentication, real-time subscriptions, file storage</p>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Data Received:</strong> Account data (email, password hash, profile data), project and creative data, collaboration data, authentication tokens and sessions</p>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Location:</strong> EU region (Frankfurt, Germany)</p>
              <p className="text-surface-300 text-sm"><strong className="text-surface-200">Privacy:</strong> <a href="https://supabase.com/privacy" className="text-red-400 hover:text-red-300 transition-colors" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a></p>
            </div>

            <div className="rounded-lg bg-surface-900 border border-surface-800 p-4 not-prose">
              <h4 className="text-white font-semibold mb-2">Vercel (Vercel Inc.)</h4>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Role:</strong> Web application hosting, edge network delivery, serverless functions</p>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Data Received:</strong> Technical data (IP address, browser, device information), request logs, edge function execution data</p>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Location:</strong> Global CDN with EU processing capabilities</p>
              <p className="text-surface-300 text-sm"><strong className="text-surface-200">Privacy:</strong> <a href="https://vercel.com/legal/privacy-policy" className="text-red-400 hover:text-red-300 transition-colors" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a></p>
            </div>

            <div className="rounded-lg bg-surface-900 border border-surface-800 p-4 not-prose">
              <h4 className="text-white font-semibold mb-2">PayPal (PayPal Holdings Inc.)</h4>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Role:</strong> Payment processing for subscriptions</p>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Data Received:</strong> PayPal email, transaction amounts, subscription plan details, transaction IDs, billing country</p>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Location:</strong> EU/US (PayPal (Europe) S.à r.l. et Cie, S.C.A. for EU users)</p>
              <p className="text-surface-300 text-sm"><strong className="text-surface-200">Privacy:</strong> <a href="https://www.paypal.com/privacy" className="text-red-400 hover:text-red-300 transition-colors" target="_blank" rel="noopener noreferrer">paypal.com/privacy</a></p>
            </div>

            <div className="rounded-lg bg-surface-900 border border-surface-800 p-4 not-prose">
              <h4 className="text-white font-semibold mb-2">Google Fonts (Google LLC)</h4>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Role:</strong> Web font delivery for typography</p>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Data Received:</strong> IP address, browser user agent string (transmitted when font files are requested)</p>
              <p className="text-surface-300 text-sm mb-2"><strong className="text-surface-200">Location:</strong> Global</p>
              <p className="text-surface-300 text-sm"><strong className="text-surface-200">Privacy:</strong> <a href="https://policies.google.com/privacy" className="text-red-400 hover:text-red-300 transition-colors" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a></p>
            </div>
          </div>

          <p className="mt-4">
            We regularly review our third-party processors to ensure they maintain adequate data protection standards. We do not engage processors in countries without adequate data protection safeguards unless appropriate supplementary measures (such as Standard Contractual Clauses) are in place.
          </p>

          {/* 6. Data Sharing */}
          <h2 id="data-sharing" className="scroll-mt-24">6. Data Sharing</h2>
          <p>
            We share your personal data only in the following limited circumstances:
          </p>

          <h3>6.1 With Your Collaborators</h3>
          <p>
            When you invite users to collaborate on a project, they will have access to the project content and your profile information (display name, avatar) within the context of that project, in accordance with the permission levels you set.
          </p>

          <h3>6.2 Community &amp; Showcase Viewers</h3>
          <p>
            If you choose to publish content to community showcase pages, that content and your associated public profile information will be visible to other registered users and, for public showcases, to the general public.
          </p>

          <h3>6.3 Service Providers</h3>
          <p>
            We share data with the third-party processors listed in Section 5, solely for the purposes of operating and providing the Service.
          </p>

          <h3>6.4 Legal Requirements</h3>
          <p>
            We may disclose your personal data if required to do so by law, regulation, legal process, or governmental request, or if we believe in good faith that disclosure is necessary to protect our rights, your safety, the safety of others, investigate fraud, or respond to a government request.
          </p>

          <h3>6.5 Business Transfers</h3>
          <p>
            In the event of a merger, acquisition, reorganization, bankruptcy, or sale of all or a portion of our assets, your personal data may be transferred as part of that transaction. We will notify you via email and/or a prominent notice on the Service of any such change in ownership and any choices you may have regarding your personal data.
          </p>

          <p className="font-semibold text-white text-lg mt-6">
            We NEVER sell your personal data to third parties. We NEVER share your creative content with advertisers, data brokers, or marketing companies. This is an absolute, unconditional commitment.
          </p>

          {/* 7. AI & Machine Learning Policy */}
          <h2 id="ai-ml" className="scroll-mt-24">7. AI &amp; Machine Learning Policy</h2>
          <p className="font-semibold text-white">
            Screenplay Studio does NOT use your scripts, screenplays, or creative content to train, develop, or improve any artificial intelligence or machine learning models. This is an unconditional, irrevocable commitment.
          </p>
          <p>
            Specifically, your data is never:
          </p>
          <ul>
            <li>Used as training data for large language models (LLMs), generative AI, or any other machine learning system.</li>
            <li>Fed into AI training pipelines, fine-tuning processes, or reinforcement learning systems.</li>
            <li>Used for prompt engineering, model evaluation, or AI benchmarking.</li>
            <li>Shared with or sold to any third party for AI or ML training purposes.</li>
            <li>Analysed by AI systems for content understanding, pattern recognition, or style analysis, except as explicitly described below.</li>
            <li>Used to generate synthetic training data or data augmentation datasets.</li>
            <li>Included in any anonymized or aggregated datasets used for machine learning.</li>
          </ul>
          <p>
            If we introduce optional AI-powered features in the future (such as formatting assistance, structural analysis, or writing tools):
          </p>
          <ul>
            <li>All AI processing will occur locally within your user session only. No creative content will be stored, cached, or retained by any AI system after your session ends.</li>
            <li>Any AI features will be strictly opt-in. You will never be enrolled in AI features without explicit, informed consent.</li>
            <li>We will publish a separate, detailed AI Usage Policy before launching any AI features, clearly explaining what data is processed, how, and by whom.</li>
            <li>You will have the ability to opt out of all AI features at any time, with immediate effect and no loss of other Service functionality.</li>
            <li>No user content will be transmitted to external AI providers (e.g., OpenAI, Anthropic, Google) without your explicit, per-instance consent.</li>
          </ul>

          {/* 8. International Transfers */}
          <h2 id="international-transfers" className="scroll-mt-24">8. International Transfers</h2>
          <p>
            As a Norway-based company, we primarily store and process your data within the European Economic Area (EEA). However, some of our third-party processors operate in or have infrastructure in countries outside the EEA, including the United States.
          </p>
          <p>
            When your personal data is transferred outside the EEA, we ensure that appropriate safeguards are in place in accordance with Chapter V of the GDPR, including:
          </p>
          <ul>
            <li><strong>Adequacy Decisions:</strong> Where the European Commission has determined that the recipient country provides an adequate level of data protection (e.g., EU-US Data Privacy Framework for certified organisations).</li>
            <li><strong>Standard Contractual Clauses (SCCs):</strong> We require processors outside the EEA to execute the European Commission&apos;s Standard Contractual Clauses, providing contractual safeguards for your data.</li>
            <li><strong>Supplementary Measures:</strong> Where necessary, we implement additional technical and organizational measures, such as encryption in transit and at rest, to supplement SCCs and ensure an adequate level of protection.</li>
          </ul>
          <p>
            You may obtain a copy of the safeguards we use for international transfers by contacting our DPO at <a href="mailto:dpo@screenplaystudio.fun">dpo@screenplaystudio.fun</a>.
          </p>

          {/* 9. Data Retention */}
          <h2 id="data-retention" className="scroll-mt-24">9. Data Retention</h2>
          <p>
            We retain your personal data only for as long as necessary to fulfil the purposes for which it was collected, to comply with legal obligations, and to resolve disputes. The specific retention periods are:
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="text-left py-2 pr-4 text-white">Data Category</th>
                  <th className="text-left py-2 pr-4 text-white">Retention Period</th>
                  <th className="text-left py-2 text-white">Basis</th>
                </tr>
              </thead>
              <tbody className="text-surface-300">
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4">Account data</td>
                  <td className="py-2 pr-4">Until account deletion + 30 days</td>
                  <td className="py-2">Contract; 30-day grace period for recovery</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4">Profile data</td>
                  <td className="py-2 pr-4">Until account deletion + 30 days</td>
                  <td className="py-2">Contract; deleted with account</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4">Projects &amp; creative content</td>
                  <td className="py-2 pr-4">Until deleted by user or account deletion + 30 days</td>
                  <td className="py-2">Contract; user-controlled</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4">Usage &amp; analytics data</td>
                  <td className="py-2 pr-4">90 days (raw), then anonymized</td>
                  <td className="py-2">Legitimate interest</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4">Technical logs</td>
                  <td className="py-2 pr-4">90 days</td>
                  <td className="py-2">Legitimate interest; security</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4">Support communications</td>
                  <td className="py-2 pr-4">2 years from resolution</td>
                  <td className="py-2">Legitimate interest; quality assurance</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4">Payment records</td>
                  <td className="py-2 pr-4">7 years</td>
                  <td className="py-2">Legal obligation (Norwegian Bookkeeping Act / Bokføringsloven)</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4">Direct messages</td>
                  <td className="py-2 pr-4">Until deleted by user or account deletion + 30 days</td>
                  <td className="py-2">Contract; user-controlled</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Community posts</td>
                  <td className="py-2 pr-4">Until deleted by user or moderation action</td>
                  <td className="py-2">Consent; legitimate interest</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4">
            After the retention period expires, data is permanently deleted or irreversibly anonymized. Backups containing expired data are purged within 30 days of the retention period ending. When you delete your account, we initiate a 30-day grace period during which you may recover your account. After 30 days, all data is permanently and irreversibly deleted, except for payment records retained under legal obligation.
          </p>

          {/* 10. Your GDPR Rights */}
          <h2 id="gdpr-rights" className="scroll-mt-24">10. Your GDPR Rights</h2>
          <p>
            If you are located in the European Economic Area (EEA), the United Kingdom, or Norway, you have the following rights under the GDPR and applicable national data protection law. You may exercise these rights at any time by contacting us at <a href="mailto:dpo@screenplaystudio.fun">dpo@screenplaystudio.fun</a> or through the relevant functionality in your account settings.
          </p>

          <h3>10.1 Right of Access (Article 15 GDPR)</h3>
          <p>
            You have the right to request confirmation of whether we process your personal data and, if so, to obtain a copy of that data along with information about the purposes of processing, categories of data, recipients, retention periods, and your rights. We will respond to access requests within one (1) month, extendable by two additional months for complex requests.
          </p>

          <h3>10.2 Right to Rectification (Article 16 GDPR)</h3>
          <p>
            You have the right to have inaccurate personal data corrected and incomplete data completed. You can update most account and profile data directly through your account settings. For data you cannot correct yourself, contact our DPO.
          </p>

          <h3>10.3 Right to Erasure / Right to Be Forgotten (Article 17 GDPR)</h3>
          <p>
            You have the right to request deletion of your personal data where the data is no longer necessary for the purposes for which it was collected, you withdraw consent, the data was processed unlawfully, or erasure is required to comply with a legal obligation. You can delete your account through account settings, which will trigger deletion of all associated data (subject to legal retention requirements). Note that we cannot erase payment records we are legally obligated to retain.
          </p>

          <h3>10.4 Right to Restrict Processing (Article 18 GDPR)</h3>
          <p>
            You have the right to request that we restrict the processing of your personal data in certain circumstances, including where you contest the accuracy of the data, the processing is unlawful but you oppose erasure, or we no longer need the data but you require it for legal claims.
          </p>

          <h3>10.5 Right to Data Portability (Article 20 GDPR)</h3>
          <p>
            You have the right to receive your personal data in a structured, commonly used, and machine-readable format (JSON, Fountain, FDX), and to transmit that data to another controller. This right applies to data processed based on consent or contract performance and carried out by automated means. Our export features allow you to exercise this right directly from your account.
          </p>

          <h3>10.6 Right to Object (Article 21 GDPR)</h3>
          <p>
            You have the right to object to processing based on legitimate interest. Upon objection, we will cease processing unless we demonstrate compelling legitimate grounds that override your interests, rights, and freedoms. You have an absolute right to object to processing for direct marketing purposes.
          </p>

          <h3>10.7 Right to Withdraw Consent (Article 7(3) GDPR)</h3>
          <p>
            Where processing is based on consent, you may withdraw that consent at any time. Withdrawal does not affect the lawfulness of processing before withdrawal. You can withdraw consent through account settings, email preferences, or by contacting our DPO.
          </p>

          <h3>10.8 Right to Lodge a Complaint</h3>
          <p>
            You have the right to lodge a complaint with a supervisory authority. For users in Norway, the relevant authority is:
          </p>
          <div className="rounded-lg bg-surface-900 border border-surface-800 p-4 not-prose text-surface-300">
            <p><strong className="text-white">Datatilsynet (Norwegian Data Protection Authority)</strong></p>
            <p>Postboks 458 Sentrum, 0105 Oslo, Norway</p>
            <p>Phone: +47 22 39 69 00</p>
            <p>Website: <a href="https://www.datatilsynet.no" className="text-red-400 hover:text-red-300 transition-colors" target="_blank" rel="noopener noreferrer">datatilsynet.no</a></p>
          </div>
          <p className="mt-4">
            We kindly request that you contact us first at <a href="mailto:dpo@screenplaystudio.fun">dpo@screenplaystudio.fun</a> to give us the opportunity to address your concern before filing a complaint.
          </p>

          {/* 11. CCPA Rights */}
          <h2 id="ccpa-rights" className="scroll-mt-24">11. CCPA Rights (California Residents)</h2>
          <p>
            If you are a California resident, the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA) provide you with specific rights regarding your personal information:
          </p>
          <ul>
            <li><strong>Right to Know:</strong> You have the right to request that we disclose the categories and specific pieces of personal information we have collected about you, the categories of sources, the business purposes for collection, and the categories of third parties with whom we share your data.</li>
            <li><strong>Right to Delete:</strong> You have the right to request deletion of your personal information, subject to certain exceptions (e.g., data necessary to complete a transaction, detect security incidents, or comply with legal obligations).</li>
            <li><strong>Right to Correct:</strong> You have the right to request that we correct inaccurate personal information.</li>
            <li><strong>Right to Opt-Out of Sale/Sharing:</strong> We do not sell your personal information. We do not share your personal information for cross-context behavioral advertising. Therefore, there is no need for an opt-out mechanism for sale or sharing.</li>
            <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of your CCPA/CPRA rights.</li>
          </ul>
          <p>
            To exercise your CCPA rights, contact us at <a href="mailto:dpo@screenplaystudio.fun">dpo@screenplaystudio.fun</a>. We will verify your identity before processing your request. We will respond to verifiable consumer requests within forty-five (45) days.
          </p>

          {/* 12. Children's Privacy */}
          <h2 id="children" className="scroll-mt-24">12. Children&apos;s Privacy</h2>
          <p>
            The Service is not intended for use by children under the age of sixteen (16). We do not knowingly collect, solicit, or maintain personal data from anyone under 16 years of age. If we become aware that we have collected personal data from a child under 16, we will promptly delete that data and terminate the associated account.
          </p>
          <p>
            If you are a parent or guardian and believe that your child under 16 has provided us with personal data, please contact us immediately at <a href="mailto:dpo@screenplaystudio.fun">dpo@screenplaystudio.fun</a>, and we will take steps to remove the data from our systems.
          </p>
          <p>
            This age requirement complies with Article 8 of the GDPR regarding conditions applicable to a child&apos;s consent in relation to information society services and the relevant provisions of the Norwegian Personal Data Act.
          </p>

          {/* 13. Security */}
          <h2 id="security" className="scroll-mt-24">13. Security</h2>
          <p>
            We implement comprehensive technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. These measures include:
          </p>

          <h3>Technical Measures</h3>
          <ul>
            <li><strong>Encryption in Transit:</strong> All data transmitted between your browser and our servers is encrypted using TLS 1.2 or higher (HTTPS).</li>
            <li><strong>Encryption at Rest:</strong> All data stored in our databases is encrypted at rest using AES-256 encryption.</li>
            <li><strong>Password Hashing:</strong> User passwords are hashed using bcrypt with appropriate work factors, making them computationally infeasible to reverse.</li>
            <li><strong>Row-Level Security (RLS):</strong> Our database implements row-level security policies ensuring that users can only access data they are authorized to view. This means that even in the event of an application-level vulnerability, database queries are restricted to authorized data only.</li>
            <li><strong>Secure Authentication:</strong> We use industry-standard authentication protocols including secure session tokens, CSRF protection, and support for two-factor authentication.</li>
            <li><strong>Content Security Policy (CSP):</strong> We implement strict CSP headers to mitigate cross-site scripting (XSS) and other injection attacks.</li>
            <li><strong>Regular Updates:</strong> All software dependencies and infrastructure components are regularly updated to patch known vulnerabilities.</li>
          </ul>

          <h3>Organizational Measures</h3>
          <ul>
            <li><strong>Access Controls:</strong> Access to personal data is restricted to authorized personnel on a need-to-know basis, with role-based access controls.</li>
            <li><strong>Security Audits:</strong> We conduct periodic security assessments and code reviews to identify and remediate vulnerabilities.</li>
            <li><strong>Incident Response:</strong> We maintain a documented incident response plan for detecting, responding to, and recovering from security incidents.</li>
            <li><strong>Data Minimization:</strong> We collect and retain only the data necessary for the specified purposes, in accordance with the GDPR principle of data minimization.</li>
          </ul>

          <p>
            While we take security seriously and implement industry best practices, no method of transmission over the Internet or method of electronic storage is 100% secure. We cannot guarantee absolute security, but we commit to promptly addressing any security vulnerabilities that are discovered and notifying affected users in accordance with applicable law.
          </p>

          {/* 14. Cookies & Tracking Technologies */}
          <h2 id="cookies" className="scroll-mt-24">14. Cookies &amp; Tracking Technologies</h2>
          <p>
            We use cookies and similar technologies to operate the Service, remember your preferences, and understand how you interact with the Service. A cookie is a small text file stored on your device by your web browser.
          </p>
          <p>
            We use the following categories of cookies:
          </p>
          <ul>
            <li><strong>Strictly Necessary Cookies:</strong> Essential for the Service to function, including authentication session cookies, CSRF tokens, and security cookies. These cannot be disabled.</li>
            <li><strong>Functional Cookies:</strong> Remember your preferences and settings (e.g., theme, language, editor preferences). Set with your consent.</li>
            <li><strong>Analytics Cookies:</strong> Help us understand how users interact with the Service by collecting anonymized usage data. Set with your consent.</li>
          </ul>
          <p>
            We do not use advertising cookies, tracking pixels, or any third-party advertising or retargeting technologies. We do not engage in cross-site tracking.
          </p>
          <p>
            For complete details about our cookie practices, including how to manage or disable cookies, please see our <Link href="/legal/cookies" className="text-red-400 hover:text-red-300 transition-colors">Cookie Policy</Link>.
          </p>

          {/* 15. Marketing Communications */}
          <h2 id="marketing" className="scroll-mt-24">15. Marketing Communications</h2>
          <p>
            We will only send you marketing communications (newsletters, product updates, feature announcements, promotional offers) if you have explicitly opted in to receive them. Marketing consent is:
          </p>
          <ul>
            <li><strong>Opt-in only:</strong> You will never be enrolled in marketing communications by default. You must actively choose to subscribe.</li>
            <li><strong>Separate from account creation:</strong> Creating an account does not subscribe you to marketing emails.</li>
            <li><strong>Easily revocable:</strong> Every marketing email includes a one-click unsubscribe link. You can also manage marketing preferences in your account settings.</li>
            <li><strong>Immediately effective:</strong> Unsubscribe requests are processed immediately, though previously scheduled emails may take up to 48 hours to cease.</li>
          </ul>
          <p>
            Transactional emails (account verification, password resets, billing confirmations, security alerts, collaboration invitations, critical service notifications) are not marketing communications and will be sent as necessary regardless of your marketing preferences, as they are essential to the operation of your account.
          </p>

          {/* 16. Breach Notification */}
          <h2 id="breach-notification" className="scroll-mt-24">16. Breach Notification</h2>
          <p>
            In the event of a personal data breach that is likely to result in a risk to the rights and freedoms of natural persons, we will:
          </p>
          <ul>
            <li><strong>Notify the supervisory authority</strong> (Datatilsynet) without undue delay and, where feasible, within seventy-two (72) hours of becoming aware of the breach, as required by Article 33 of the GDPR. The notification will include the nature of the breach, categories and approximate number of data subjects affected, likely consequences, and measures taken or proposed to address and mitigate the breach.</li>
            <li><strong>Notify affected users</strong> without undue delay where the breach is likely to result in a high risk to their rights and freedoms, as required by Article 34 of the GDPR. Notification will be made via email to the address associated with your account and, where appropriate, via a prominent notice on the Service.</li>
          </ul>
          <p>
            Our notification to affected users will clearly describe, in plain language:
          </p>
          <ul>
            <li>The nature of the breach and what data was affected.</li>
            <li>What we are doing to address and mitigate the breach.</li>
            <li>What steps you can take to protect yourself (e.g., changing passwords).</li>
            <li>Contact details for our DPO for further questions.</li>
          </ul>
          <p>
            We maintain an internal breach register documenting all personal data breaches, regardless of whether they are reportable to the supervisory authority or affected individuals.
          </p>

          {/* 17. Automated Decision-Making */}
          <h2 id="automated-decisions" className="scroll-mt-24">17. Automated Decision-Making</h2>
          <p>
            We do not engage in automated individual decision-making or profiling that produces legal effects concerning you or similarly significantly affects you, within the meaning of Article 22 of the GDPR.
          </p>
          <p>
            Our Service may use automated processes for:
          </p>
          <ul>
            <li>Spam detection in community features — flagging potentially spam content for human review.</li>
            <li>Rate limiting and abuse prevention — automatically throttling requests that exceed normal usage patterns.</li>
            <li>Basic personalization — displaying recently used features or projects.</li>
          </ul>
          <p>
            None of these automated processes make decisions that have legal or similarly significant effects on you. Moderation actions affecting your account are always subject to human review.
          </p>

          {/* 18. Changes to This Policy */}
          <h2 id="changes" className="scroll-mt-24">18. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices, technologies, legal requirements, or other factors. When we make changes:
          </p>
          <ul>
            <li><strong>General Changes:</strong> We will post the updated Privacy Policy on the Service and update the &quot;Last updated&quot; date at the top of this page. We will provide at least thirty (30) days&apos; notice before changes take effect.</li>
            <li><strong>Material Changes:</strong> For changes that materially affect how we collect, use, or share your personal data, we will notify you via email to the address associated with your account at least thirty (30) days before the changes take effect. We will clearly describe the material changes in our notification and, where required by law, obtain your consent before the changes apply.</li>
          </ul>
          <p>
            We encourage you to review this Privacy Policy periodically. Your continued use of the Service after the effective date of an updated Privacy Policy constitutes acceptance of the revised policy, except where your consent is required for specific changes.
          </p>

          {/* 19. Data Protection Officer */}
          <h2 id="dpo" className="scroll-mt-24">19. Data Protection Officer</h2>
          <p>
            We have appointed a Data Protection Officer (DPO) who is responsible for overseeing our data protection strategy and compliance. You may contact our DPO for any questions or concerns regarding this Privacy Policy, how we process your personal data, or to exercise your data protection rights:
          </p>
          <div className="rounded-lg bg-surface-900 border border-surface-800 p-4 not-prose text-surface-300">
            <p><strong className="text-white">Data Protection Officer</strong></p>
            <p>Screenplay Studio</p>
            <p>Email: <a href="mailto:dpo@screenplaystudio.fun" className="text-red-400 hover:text-red-300 transition-colors">dpo@screenplaystudio.fun</a></p>
          </div>
          <p className="mt-4">
            Our DPO will acknowledge receipt of your inquiry within two (2) business days and provide a substantive response within one (1) month, extendable by two additional months for complex matters with prior notification.
          </p>

          {/* 20. Contact */}
          <h2 id="contact" className="scroll-mt-24">20. Contact</h2>
          <p>
            For general inquiries about this Privacy Policy or our data practices that are not specifically related to data protection rights (which should be directed to the DPO), you may contact us:
          </p>
          <div className="rounded-lg bg-surface-900 border border-surface-800 p-4 not-prose text-surface-300">
            <p><strong className="text-white">Northem Development</strong></p>
            <p className="mt-1 text-surface-400 text-sm">Operator of Screenplay Studio</p>
            <p className="mt-2">Privacy Inquiries</p>
            <p>Email: <a href="mailto:legal@screenplaystudio.fun" className="text-red-400 hover:text-red-300 transition-colors">legal@screenplaystudio.fun</a></p>
            <p>DPO: <a href="mailto:dpo@screenplaystudio.fun" className="text-red-400 hover:text-red-300 transition-colors">dpo@screenplaystudio.fun</a></p>
            <p className="mt-2"><a href="https://development.northem.no/" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 transition-colors">development.northem.no</a></p>
          </div>

          <div className="mt-12 pt-8 border-t border-surface-800 text-surface-400 text-sm not-prose">
            <p>
              By using Screenplay Studio, you acknowledge that you have read and understood this Privacy Policy and agree to the collection and use of your data as described herein.
            </p>
            <p className="mt-3 text-surface-500">
              Screenplay Studio is a product of{' '}
              <a href="https://development.northem.no/" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 transition-colors">Northem Development</a>
              {' '}&mdash; made with ♥ in Norway.
            </p>
            <div className="mt-4 flex gap-4">
              <Link href="/legal/terms" className="text-red-400 hover:text-red-300 transition-colors">Terms of Service</Link>
              <Link href="/legal/cookies" className="text-red-400 hover:text-red-300 transition-colors">Cookie Policy</Link>
              <Link href="/legal/community-guidelines" className="text-red-400 hover:text-red-300 transition-colors">Community Guidelines</Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
