import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Screenplay Studio',
  description: 'Terms of Service for Screenplay Studio. Read our comprehensive terms governing the use of our screenwriting platform.',
};

export default function TermsOfServicePage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Legal Agreement</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Terms of Service</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 rounded-lg bg-surface-900/50 border border-surface-800/60 p-6">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">Table of Contents</h2>
          <ol className="list-decimal list-inside space-y-1.5 text-surface-400 text-[13px] columns-1 sm:columns-2 gap-8">
            <li><a href="#acceptance" className="hover:text-red-400 transition-colors">Acceptance of Terms</a></li>
            <li><a href="#eligibility" className="hover:text-red-400 transition-colors">Eligibility</a></li>
            <li><a href="#account" className="hover:text-red-400 transition-colors">Account Registration &amp; Security</a></li>
            <li><a href="#your-content" className="hover:text-red-400 transition-colors">Your Content</a></li>
            <li><a href="#license-grant" className="hover:text-red-400 transition-colors">License Grant to Screenplay Studio</a></li>
            <li><a href="#billing" className="hover:text-red-400 transition-colors">Subscription Plans &amp; Billing</a></li>
            <li><a href="#free-tier" className="hover:text-red-400 transition-colors">Free Tier Rights</a></li>
            <li><a href="#conduct" className="hover:text-red-400 transition-colors">Acceptable Conduct</a></li>
            <li><a href="#prohibited" className="hover:text-red-400 transition-colors">Prohibited Activities</a></li>
            <li><a href="#collaboration" className="hover:text-red-400 transition-colors">Collaboration &amp; Shared Projects</a></li>
            <li><a href="#community" className="hover:text-red-400 transition-colors">Community Features</a></li>
            <li><a href="#third-party" className="hover:text-red-400 transition-colors">Third-Party Services</a></li>
            <li><a href="#ip" className="hover:text-red-400 transition-colors">Intellectual Property</a></li>
            <li><a href="#data-portability" className="hover:text-red-400 transition-colors">Data Portability</a></li>
            <li><a href="#privacy" className="hover:text-red-400 transition-colors">Privacy</a></li>
            <li><a href="#ai-ml" className="hover:text-red-400 transition-colors">AI &amp; Machine Learning</a></li>
            <li><a href="#api" className="hover:text-red-400 transition-colors">API &amp; Automation</a></li>
            <li><a href="#availability" className="hover:text-red-400 transition-colors">Service Availability &amp; Modifications</a></li>
            <li><a href="#disclaimers" className="hover:text-red-400 transition-colors">Disclaimers</a></li>
            <li><a href="#liability" className="hover:text-red-400 transition-colors">Limitation of Liability</a></li>
            <li><a href="#indemnification" className="hover:text-red-400 transition-colors">Indemnification</a></li>
            <li><a href="#governing-law" className="hover:text-red-400 transition-colors">Governing Law</a></li>
            <li><a href="#disputes" className="hover:text-red-400 transition-colors">Dispute Resolution</a></li>
            <li><a href="#class-action" className="hover:text-red-400 transition-colors">Class Action Waiver</a></li>
            <li><a href="#changes" className="hover:text-red-400 transition-colors">Changes to Terms</a></li>
            <li><a href="#severability" className="hover:text-red-400 transition-colors">Severability</a></li>
            <li><a href="#entire-agreement" className="hover:text-red-400 transition-colors">Entire Agreement</a></li>
            <li><a href="#contact" className="hover:text-red-400 transition-colors">Contact</a></li>
          </ol>
        </nav>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white prose-headings:border-b prose-headings:border-surface-800/60 prose-headings:pb-3 prose-headings:mb-5">
          {/* 1. Acceptance of Terms */}
          <h2 id="acceptance" className="scroll-mt-24">1. Acceptance of Terms</h2>
          <p>
            Welcome to Screenplay Studio (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;), a screenwriting and production planning platform developed and operated by <a href="https://development.northem.no/" target="_blank" rel="noopener noreferrer">Northem Development</a>, a Norwegian software development company (&quot;the Company&quot;, &quot;Northem&quot;). By accessing or using our website at screenplaystudio.fun, our web application, APIs, or any associated services, you (&quot;you&quot;, &quot;the User&quot;, &quot;your&quot;) acknowledge that you have read, understood, and agree to be bound by these Terms of Service (&quot;Terms&quot;, &quot;Agreement&quot;).
          </p>
          <p>
            If you do not agree to these Terms in their entirety, you must immediately cease all use of the Service. Your continued access to or use of the Service following the posting of any changes to these Terms constitutes acceptance of those changes, subject to the notice requirements set forth in Section 25.
          </p>
          <p>
            These Terms constitute a legally binding agreement between you and the Company. If you are accessing or using the Service on behalf of a company, organization, or other legal entity, you represent and warrant that you have the authority to bind that entity to these Terms, in which case &quot;you&quot; and &quot;your&quot; shall refer to that entity.
          </p>

          {/* 2. Eligibility */}
          <h2 id="eligibility" className="scroll-mt-24">2. Eligibility</h2>
          <p>
            You must be at least sixteen (16) years of age to use the Service. By creating an account or using the Service, you represent and warrant that you are at least 16 years old and have the legal capacity to enter into this Agreement. If you are between the ages of 16 and 18 (or the age of legal majority in your jurisdiction), you represent that your parent or legal guardian has reviewed and agreed to these Terms on your behalf.
          </p>
          <p>
            We reserve the right to request proof of age at any time. If we discover or have reason to believe that a User does not meet the minimum age requirement, we will promptly terminate that User&apos;s account and delete all associated data, in compliance with applicable child protection laws including the EU General Data Protection Regulation (GDPR) and the Norwegian Personal Data Act (Personopplysningsloven).
          </p>
          <p>
            Users who have been previously suspended, banned, or otherwise prohibited from using the Service are not eligible to create new accounts or access the Service in any manner.
          </p>

          {/* 3. Account Registration & Security */}
          <h2 id="account" className="scroll-mt-24">3. Account Registration &amp; Security</h2>
          <p>
            To access certain features of the Service, you must register for an account by providing accurate, current, and complete information. You agree to update your account information promptly to keep it accurate and current at all times.
          </p>
          <p>
            You are solely responsible for:
          </p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials, including your password.</li>
            <li>All activities that occur under your account, whether or not you authorized such activities.</li>
            <li>Notifying us immediately at <a href="mailto:legal@screenplaystudio.fun">legal@screenplaystudio.fun</a> if you suspect any unauthorized use of your account or any other breach of security.</li>
          </ul>
          <p>
            You may not share your login credentials with any other person. Each account is for a single individual User. We reserve the right to suspend or terminate accounts where we detect credential sharing, concurrent sessions from multiple geographic locations suggesting shared access, or other indicators of unauthorized multi-user access to a single account.
          </p>
          <p>
            We will never ask you for your password via email, phone, or any communication channel. If you receive such a request purporting to be from us, do not respond and report it to our security team.
          </p>

          {/* 4. Your Content */}
          <h2 id="your-content" className="scroll-mt-24">4. Your Content</h2>
          <p className="font-semibold text-white">
            You own 100% of the content you create on Screenplay Studio. This is a foundational principle of our service and will never change.
          </p>
          <p>
            All screenplays, scripts, treatments, outlines, scene descriptions, character profiles, dialogue, storyboards, shot lists, budgets, schedules, notes, annotations, and any other creative content you create, upload, or store through the Service (&quot;Your Content&quot;) remains your sole and exclusive intellectual property. The Company claims no ownership rights whatsoever in Your Content.
          </p>
          <p>
            You retain all rights, title, and interest in and to Your Content, including but not limited to all copyrights, moral rights, trademarks, trade secrets, and any other intellectual property rights therein. Nothing in these Terms shall be construed as transferring any ownership rights in Your Content to the Company.
          </p>
          <p>
            This ownership principle applies regardless of:
          </p>
          <ul>
            <li>Whether you use a free or paid subscription plan.</li>
            <li>Whether your account is active or terminated.</li>
            <li>Whether the content was created individually or collaboratively.</li>
            <li>The format or medium in which the content exists on our platform.</li>
          </ul>
          <p>
            For collaborative projects, ownership of jointly created content is determined by the agreements between the collaborating parties. Screenplay Studio does not adjudicate ownership disputes between collaborators. We recommend that collaborators establish clear ownership and credit agreements before commencing work on shared projects.
          </p>

          {/* 5. License Grant to Screenplay Studio */}
          <h2 id="license-grant" className="scroll-mt-24">5. License Grant to Screenplay Studio</h2>
          <p>
            By uploading or creating content on the Service, you grant the Company a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to host, store, display, reproduce, and transmit Your Content solely for the following operational purposes:
          </p>
          <ul>
            <li>Storing and displaying Your Content to you within the Service.</li>
            <li>Sharing Your Content with collaborators you have explicitly authorized.</li>
            <li>Displaying Your Content on community showcase pages where you have opted to publish it.</li>
            <li>Creating backups and redundant copies necessary for service reliability and data security.</li>
            <li>Transmitting Your Content as necessary to provide the technical functionality of the Service (e.g., rendering scripts in proper screenplay format).</li>
            <li>Generating thumbnails, previews, or summaries of Your Content within the Service interface.</li>
          </ul>
          <p>
            This license exists only for the duration of your use of the Service and terminates upon deletion of Your Content or termination of your account, subject to our data retention policy as described in our <Link href="/legal/privacy" className="text-red-400 hover:text-red-300 transition-colors">Privacy Policy</Link>. This license does not grant us any right to sell, commercially exploit, sublicense, or use Your Content for any purpose other than operating and providing the Service to you.
          </p>

          {/* 6. Subscription Plans & Billing */}
          <h2 id="billing" className="scroll-mt-24">6. Subscription Plans &amp; Billing</h2>
          <p>
            Screenplay Studio offers the following subscription plans:
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="text-left py-2 pr-4 text-white">Plan</th>
                  <th className="text-left py-2 pr-4 text-white">Price</th>
                  <th className="text-left py-2 text-white">Details</th>
                </tr>
              </thead>
              <tbody className="text-surface-300">
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4 font-medium text-white">Free</td>
                  <td className="py-2 pr-4">$0</td>
                  <td className="py-2">Unlimited projects, collaboration, and community access</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4 font-medium text-white">Pro</td>
                  <td className="py-2 pr-4">$200/year</td>
                  <td className="py-2">Advanced features, priority support, annual auto-renewal</td>
                </tr>
                <tr className="border-b border-surface-800">
                  <td className="py-2 pr-4 font-medium text-white">Per-Production</td>
                  <td className="py-2 pr-4">$100 one-time</td>
                  <td className="py-2">Pro features for a single project, no recurring charges</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-white">Team</td>
                  <td className="py-2 pr-4">$160/seat/year</td>
                  <td className="py-2">Multi-seat team plan with centralized billing, annual auto-renewal</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <strong>Auto-Renewal:</strong> Paid subscriptions with annual billing (Pro and Team plans) automatically renew at the end of each billing period unless cancelled at least 24 hours before the renewal date. You will receive a renewal reminder email at least 14 days before your subscription renews.
          </p>
          <p>
            <strong>Refund Policy:</strong> You are entitled to a full refund within fourteen (14) days of the initial purchase or renewal of any subscription plan, provided you have not materially used the paid features during that period. Refund requests should be submitted to <a href="mailto:legal@screenplaystudio.fun">legal@screenplaystudio.fun</a>. For Per-Production plans, the 14-day refund window applies from the date of purchase.
          </p>
          <p>
            <strong>Cancellation:</strong> You may cancel your subscription at any time through your account settings. Upon cancellation, your paid features will remain active until the end of the current billing period. After the billing period expires, your account will revert to the Free tier. No partial refunds are issued for unused portions of a billing period beyond the 14-day refund window.
          </p>
          <p>
            <strong>Price Changes:</strong> We reserve the right to modify subscription prices. Any price changes will be communicated at least thirty (30) days in advance via email and will take effect at the start of your next billing cycle. Continued use of the paid Service after a price change constitutes acceptance of the new pricing. If you do not agree with a price change, you may cancel your subscription before the new price takes effect.
          </p>
          <p>
            <strong>Taxes:</strong> All prices are exclusive of applicable taxes unless otherwise stated. You are responsible for any sales tax, VAT, or other taxes imposed by your jurisdiction.
          </p>
          <p>
            <strong>Payment Processing:</strong> Payments are processed through our third-party payment processor, PayPal. By making a purchase, you agree to PayPal&apos;s terms of service in addition to these Terms. We do not store your credit card or debit card information on our servers.
          </p>

          {/* 7. Free Tier Rights */}
          <h2 id="free-tier" className="scroll-mt-24">7. Free Tier Rights</h2>
          <p>
            Screenplay Studio is committed to providing a generous free tier. Free tier users are entitled to:
          </p>
          <ul>
            <li>Unlimited screenplay and script projects with no word, page, or project count limits.</li>
            <li>Full real-time collaboration with unlimited team members on all projects.</li>
            <li>Access to all community features, including the showcase, forums, and messaging.</li>
            <li>Standard screenplay formatting and export capabilities.</li>
            <li>Full ownership and data portability rights for all content.</li>
          </ul>
          <p>
            We will not retroactively impose limitations on existing free tier functionality without providing at least ninety (90) days&apos; notice and a migration path for affected users. The free tier is not a trial — it is a permanent offering.
          </p>

          {/* 8. Acceptable Conduct */}
          <h2 id="conduct" className="scroll-mt-24">8. Acceptable Conduct</h2>
          <p>
            You agree to use the Service in a manner that is lawful, respectful, and consistent with its intended purpose as a creative screenwriting and production platform. You shall:
          </p>
          <ul>
            <li>Treat other users, collaborators, and community members with respect and professionalism.</li>
            <li>Use the Service only for purposes related to screenwriting, scriptwriting, and film/television/media production planning.</li>
            <li>Comply with all applicable local, national, and international laws and regulations.</li>
            <li>Respect the intellectual property rights of others, including copyright, trademark, and moral rights.</li>
            <li>Report violations of these Terms or illegal activity to us promptly at <a href="mailto:legal@screenplaystudio.fun">legal@screenplaystudio.fun</a>.</li>
            <li>Abide by our <Link href="/legal/community-guidelines" className="text-red-400 hover:text-red-300 transition-colors">Community Guidelines</Link> when participating in community features.</li>
          </ul>

          {/* 9. Prohibited Activities */}
          <h2 id="prohibited" className="scroll-mt-24">9. Prohibited Activities</h2>
          <p>
            You agree not to engage in any of the following prohibited activities. Violation of any of these prohibitions may result in immediate suspension or termination of your account, without refund, and may also result in civil or criminal liability:
          </p>
          <ol>
            <li><strong>Scraping &amp; Data Harvesting:</strong> Using automated tools, bots, crawlers, scrapers, or any other automated means to access, collect, copy, or extract data from the Service, including but not limited to user profiles, scripts, project data, or community content.</li>
            <li><strong>Hacking &amp; Unauthorized Access:</strong> Attempting to gain unauthorized access to the Service, other users&apos; accounts, our servers, databases, or any systems or networks connected to the Service.</li>
            <li><strong>Reverse Engineering:</strong> Decompiling, disassembling, reverse engineering, or otherwise attempting to derive the source code, algorithms, or underlying architecture of the Service or any component thereof.</li>
            <li><strong>Credential Sharing:</strong> Sharing, selling, lending, or otherwise distributing your account credentials to any third party, or using another person&apos;s credentials to access the Service.</li>
            <li><strong>Spam &amp; Unsolicited Messages:</strong> Sending unsolicited promotional messages, chain messages, bulk messages, or spam through any Service communication channel, including community features, direct messages, or collaboration invitations.</li>
            <li><strong>Harassment &amp; Abuse:</strong> Engaging in harassment, bullying, intimidation, threats, hate speech, discriminatory language, doxxing, or any form of abusive behaviour toward other users or Company personnel.</li>
            <li><strong>Impersonation:</strong> Impersonating any person or entity, including other users, Company employees, or public figures, or falsely claiming an affiliation with any person or entity.</li>
            <li><strong>Circumventing Paywalls:</strong> Attempting to access paid features, premium content, or subscription benefits without a valid subscription, including exploiting bugs, using modified clients, or employing technical workarounds to bypass payment requirements.</li>
            <li><strong>Malware &amp; Malicious Code:</strong> Uploading, transmitting, or distributing any viruses, worms, trojan horses, ransomware, spyware, adware, or other malicious software or code.</li>
            <li><strong>Service Interference:</strong> Interfering with, disrupting, or placing an undue burden on the Service or its infrastructure, including DDoS attacks, resource exhaustion, or deliberate attempts to degrade performance for other users.</li>
            <li><strong>Illegal Content:</strong> Using the Service to store, create, distribute, or facilitate any content that violates applicable laws, including but not limited to content that constitutes child sexual abuse material (CSAM), facilitates terrorism, or promotes illegal drug trafficking.</li>
            <li><strong>Copyright Infringement:</strong> Uploading, storing, or distributing content that infringes the intellectual property rights of any third party, including submitting others&apos; screenplays, scripts, or copyrighted material as your own.</li>
            <li><strong>Fraudulent Activity:</strong> Using the Service for any fraudulent, deceptive, or misleading purpose, including creating fake accounts, manipulating community metrics, or engaging in phishing.</li>
            <li><strong>Account Farming:</strong> Creating multiple accounts to circumvent limitations, bans, or restrictions, or to manipulate community features such as voting, showcasing, or rankings.</li>
            <li><strong>Reselling the Service:</strong> Reselling, sublicensing, or offering access to the Service or any portion thereof to third parties without our prior written consent.</li>
            <li><strong>Benchmark Testing:</strong> Using the Service for competitive benchmarking, performance testing, or analysis intended for publication without our prior written consent.</li>
            <li><strong>Encouraging Violations:</strong> Encouraging, facilitating, or instructing others to engage in any of the above prohibited activities.</li>
          </ol>

          {/* 10. Collaboration & Shared Projects */}
          <h2 id="collaboration" className="scroll-mt-24">10. Collaboration &amp; Shared Projects</h2>
          <p>
            The Service allows you to collaborate with other users on shared projects. When you invite collaborators to a project or accept an invitation to collaborate:
          </p>
          <ul>
            <li>You grant authorized collaborators access to view and edit project content in accordance with the permission levels you set (e.g., read-only, editor, admin).</li>
            <li>The project owner retains administrative control over the project, including the right to remove collaborators, change permissions, or delete the project.</li>
            <li>Each collaborator retains ownership of the content they individually contribute, unless otherwise agreed between the parties in writing.</li>
            <li>Screenplay Studio is not a party to any ownership, credit, or compensation agreements between collaborators and bears no responsibility for resolving disputes between collaborating parties.</li>
          </ul>
          <p>
            We strongly recommend that collaborators establish clear agreements regarding content ownership, writing credits, revenue sharing, and intellectual property rights before beginning collaborative work. Such agreements should be documented outside of the Service.
          </p>

          {/* 11. Community Features */}
          <h2 id="community" className="scroll-mt-24">11. Community Features</h2>
          <p>
            The Service may include community features such as showcase pages, discussion forums, direct messaging, user profiles, and other social and interactive functionality. By using community features:
          </p>
          <ul>
            <li>You agree to our <Link href="/legal/community-guidelines" className="text-red-400 hover:text-red-300 transition-colors">Community Guidelines</Link>, which supplement these Terms.</li>
            <li>Content you publish to community features (such as showcase pages) becomes visible to other users and, in some cases, the public. You are solely responsible for content you publish to community areas.</li>
            <li>We reserve the right to moderate, remove, or restrict community content that violates these Terms, our Community Guidelines, or applicable law, without prior notice.</li>
            <li>Community features are provided for creative collaboration and professional networking. Commercial solicitation, advertising, or promotional activities are not permitted without prior written consent from the Company.</li>
          </ul>

          {/* 12. Third-Party Services */}
          <h2 id="third-party" className="scroll-mt-24">12. Third-Party Services</h2>
          <p>
            The Service integrates with or relies upon certain third-party services, including but not limited to Supabase (database and authentication), Vercel (hosting and deployment), PayPal (payment processing), and Google Fonts (typography). These third-party services are governed by their own respective terms of service and privacy policies.
          </p>
          <p>
            We are not responsible for the availability, performance, security, or practices of any third-party service. Your use of third-party services through the Service is at your own risk. We make no warranties or representations regarding third-party services, and we shall not be liable for any loss or damage arising from your use of or reliance on such services.
          </p>

          {/* 13. Intellectual Property */}
          <h2 id="ip" className="scroll-mt-24">13. Intellectual Property</h2>
          <p>
            The Service, including but not limited to its source code, object code, user interface designs, visual elements, graphics, logos, icons, trademarks, service marks, trade names, domain names, documentation, and all other proprietary materials (&quot;Company IP&quot;), is owned by or licensed to the Company and is protected by copyright, trademark, patent, trade secret, and other intellectual property laws.
          </p>
          <p>
            The &quot;Screenplay Studio&quot; name, logo, and all related marks are trademarks of the Company. You may not use our trademarks without prior written consent, except as necessary to accurately refer to the Service (e.g., in reviews or educational materials) in accordance with fair use principles.
          </p>
          <p>
            You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Service for its intended purpose, subject to these Terms. This license does not include any right to copy, modify, distribute, sell, or create derivative works based on Company IP.
          </p>

          {/* 14. Data Portability */}
          <h2 id="data-portability" className="scroll-mt-24">14. Data Portability</h2>
          <p>
            We believe your data belongs to you, and you should be able to take it with you. You have the right to export all of Your Content from the Service at any time, in industry-standard formats including:
          </p>
          <ul>
            <li>Fountain (.fountain) format for screenplays and scripts.</li>
            <li>Final Draft (.fdx) format for screenplays and scripts.</li>
            <li>PDF format for formatted scripts, storyboards, and production documents.</li>
            <li>JSON format for project metadata, characters, scenes, and structured data.</li>
          </ul>
          <p>
            Export functionality is available to all users, including free tier users, and will not be restricted or paywalled. Upon account termination (whether voluntary or involuntary), we will provide a reasonable window of at least thirty (30) days during which you may export Your Content before it is permanently deleted.
          </p>

          {/* 15. Privacy */}
          <h2 id="privacy" className="scroll-mt-24">15. Privacy</h2>
          <p>
            Your privacy is important to us. Our collection, use, storage, and protection of your personal data is governed by our <Link href="/legal/privacy" className="text-red-400 hover:text-red-300 transition-colors">Privacy Policy</Link>, which is incorporated into these Terms by reference. By using the Service, you consent to the data practices described in our Privacy Policy.
          </p>
          <p>
            Key privacy commitments include:
          </p>
          <ul>
            <li>We will never sell your personal data to third parties.</li>
            <li>We will never use your creative content to train AI or machine learning models.</li>
            <li>We comply with GDPR, the Norwegian Personal Data Act, and other applicable data protection regulations.</li>
            <li>You have the right to access, rectify, delete, and port your personal data as described in our Privacy Policy.</li>
          </ul>

          {/* 16. AI & Machine Learning */}
          <h2 id="ai-ml" className="scroll-mt-24">16. AI &amp; Machine Learning</h2>
          <p className="font-semibold text-white">
            Screenplay Studio does NOT use your content to train artificial intelligence or machine learning models. This is an unconditional commitment.
          </p>
          <p>
            Your screenplays, scripts, treatments, story ideas, characters, dialogue, and all other creative content are never:
          </p>
          <ul>
            <li>Used as training data for AI models, language models, generative AI systems, or any machine learning algorithms, whether owned by us or licensed from third parties.</li>
            <li>Fed into natural language processing (NLP) pipelines, text analysis systems, or content generation engines.</li>
            <li>Shared with or sold to third parties for the purpose of AI training or data augmentation.</li>
            <li>Analysed in aggregate or anonymized form for AI or ML purposes.</li>
            <li>Used to develop, improve, or benchmark any AI-based product or service.</li>
          </ul>
          <p>
            If we introduce optional AI-powered features in the future (such as formatting suggestions or structural analysis), such features will:
          </p>
          <ul>
            <li>Process data locally within your session only, with no data retained after the session ends.</li>
            <li>Be entirely opt-in and clearly disclosed.</li>
            <li>Never transmit your creative content to external AI services without your explicit, informed, per-instance consent.</li>
            <li>Be subject to a separate, clearly communicated AI usage policy.</li>
          </ul>

          {/* 17. API & Automation */}
          <h2 id="api" className="scroll-mt-24">17. API &amp; Automation</h2>
          <p>
            If we provide APIs, webhooks, or other programmatic interfaces, the following terms apply:
          </p>
          <ul>
            <li>API access may be subject to rate limits, authentication requirements, and separate API-specific terms.</li>
            <li>You may not use the API to build a competing product or to replicate the core functionality of the Service.</li>
            <li>API keys and tokens are confidential and must not be shared, published, or embedded in client-side code.</li>
            <li>We reserve the right to modify, deprecate, or discontinue APIs with reasonable prior notice.</li>
            <li>Automated access to the Service outside of provided APIs is expressly prohibited.</li>
          </ul>

          {/* 18. Service Availability & Modifications */}
          <h2 id="availability" className="scroll-mt-24">18. Service Availability &amp; Modifications</h2>
          <p>
            We strive to maintain high availability of the Service but do not guarantee uninterrupted or error-free access. The Service may be temporarily unavailable due to:
          </p>
          <ul>
            <li>Scheduled maintenance (we will provide advance notice when possible).</li>
            <li>Unscheduled maintenance or emergency repairs.</li>
            <li>Third-party service outages or disruptions.</li>
            <li>Force majeure events beyond our reasonable control.</li>
          </ul>
          <p>
            We reserve the right to modify, update, add features to, or remove features from the Service at any time. Material changes that significantly reduce the functionality available to paying subscribers will be communicated at least thirty (30) days in advance. If you are a paying subscriber and a material change adversely affects your use of the Service, you may cancel your subscription for a pro-rata refund of unused pre-paid fees.
          </p>

          {/* 19. Disclaimers */}
          <h2 id="disclaimers" className="scroll-mt-24">19. Disclaimers</h2>
          <p className="uppercase font-semibold">
            THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
          </p>
          <p>
            Without limiting the foregoing, we do not warrant that:
          </p>
          <ul>
            <li>The Service will meet your specific requirements or expectations.</li>
            <li>The Service will be uninterrupted, timely, secure, or error-free.</li>
            <li>Any errors or defects in the Service will be corrected.</li>
            <li>The Service will be compatible with all devices, browsers, or operating systems.</li>
            <li>The results obtained from using the Service will be accurate or reliable.</li>
            <li>Data stored on the Service will not be lost, corrupted, or compromised, despite our best efforts to prevent such occurrences.</li>
          </ul>
          <p>
            You acknowledge that you use the Service at your own risk and that you are solely responsible for maintaining backups of Your Content.
          </p>

          {/* 20. Limitation of Liability */}
          <h2 id="liability" className="scroll-mt-24">20. Limitation of Liability</h2>
          <p className="uppercase font-semibold">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE COMPANY, ITS DIRECTORS, OFFICERS, EMPLOYEES, AGENTS, CONTRACTORS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, DATA, USE, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE.
          </p>
          <p>
            <strong>Liability Cap:</strong> The Company&apos;s total aggregate liability to you for all claims arising out of or relating to these Terms or your use of the Service shall not exceed the total amount of fees you have paid to the Company in the twelve (12) months immediately preceding the event giving rise to the claim. For free tier users, this cap shall be one hundred Norwegian Kroner (NOK 100).
          </p>
          <p>
            The limitations in this section apply regardless of the legal theory on which the claim is based, whether in contract, tort (including negligence), strict liability, or otherwise, and even if the Company has been advised of the possibility of such damages. Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the above limitations may not apply to you.
          </p>

          {/* 21. Indemnification */}
          <h2 id="indemnification" className="scroll-mt-24">21. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless the Company and its directors, officers, employees, agents, contractors, and affiliates from and against any and all claims, demands, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or relating to:
          </p>
          <ul>
            <li>Your use of or access to the Service.</li>
            <li>Your violation of these Terms or any applicable law or regulation.</li>
            <li>Your Content, including any claims that Your Content infringes or violates the intellectual property rights or other rights of any third party.</li>
            <li>Any dispute between you and another user of the Service.</li>
            <li>Your negligent or wilful misconduct.</li>
          </ul>
          <p>
            We will provide you with prompt written notice of any such claim and reasonably cooperate with you in the defence of such claim. We reserve the right, at our own expense, to assume the exclusive defence and control of any matter otherwise subject to indemnification by you.
          </p>

          {/* 22. Governing Law */}
          <h2 id="governing-law" className="scroll-mt-24">22. Governing Law</h2>
          <p>
            These Terms, and any dispute arising out of or in connection with them or the Service, shall be governed by and construed in accordance with the laws of the Kingdom of Norway, without regard to its conflict of laws principles.
          </p>
          <p>
            Any legal proceedings arising out of or relating to these Terms or the Service shall be brought exclusively before the Oslo District Court (Oslo tingrett), Norway. You irrevocably consent to the personal jurisdiction and venue of the Oslo District Court for any such proceedings. Notwithstanding the foregoing, we may seek injunctive or equitable relief in any court of competent jurisdiction to protect our intellectual property rights.
          </p>
          <p>
            If you are a consumer residing in the European Economic Area (EEA), you may also have the right to bring proceedings in the courts of your country of residence, and nothing in these Terms affects your statutory consumer rights under applicable mandatory law.
          </p>

          {/* 23. Dispute Resolution */}
          <h2 id="disputes" className="scroll-mt-24">23. Dispute Resolution</h2>
          <p>
            Before initiating any formal legal proceeding, you agree to first attempt to resolve any dispute informally by contacting us at <a href="mailto:legal@screenplaystudio.fun">legal@screenplaystudio.fun</a>. We will attempt to resolve the dispute through good-faith negotiations within thirty (30) days of receipt of your written notice of dispute.
          </p>
          <p>
            If the dispute cannot be resolved informally within thirty (30) days, either party may initiate formal proceedings in accordance with the Governing Law section above. Alternatively, either party may elect to submit the dispute to mediation administered by the Oslo Chamber of Commerce (Handelskammeret i Oslo), with costs shared equally between the parties.
          </p>
          <p>
            For disputes involving amounts less than NOK 50,000, we agree to participate in the Norwegian Consumer Dispute Resolution process (Forbrukertilsynet) if you are an individual consumer, as required by Norwegian law.
          </p>

          {/* 24. Class Action Waiver */}
          <h2 id="class-action" className="scroll-mt-24">24. Class Action Waiver</h2>
          <p>
            To the maximum extent permitted by applicable law, you and the Company each agree that any dispute resolution proceedings will be conducted only on an individual basis and not as part of a class, consolidated, or representative action. If a court or arbitral tribunal determines that this class action waiver is unenforceable for any reason, then the entirety of this dispute resolution section shall be deemed void with respect to that particular claim, and the dispute shall proceed in a court of competent jurisdiction.
          </p>
          <p>
            This waiver does not apply where prohibited by applicable mandatory law, including any applicable EU or Norwegian consumer protection legislation that grants you the right to participate in collective actions or representative proceedings.
          </p>

          {/* 25. Changes to Terms */}
          <h2 id="changes" className="scroll-mt-24">25. Changes to Terms</h2>
          <p>
            We reserve the right to modify, amend, or update these Terms at any time. Changes are effective as follows:
          </p>
          <ul>
            <li><strong>General Changes:</strong> We will provide at least thirty (30) days&apos; advance notice of changes by posting the updated Terms on the Service and updating the &quot;Last updated&quot; date. Your continued use of the Service after the effective date constitutes acceptance of the revised Terms.</li>
            <li><strong>Material Changes:</strong> For changes that materially affect your rights or obligations (including changes to pricing, content ownership, data practices, or liability provisions), we will notify you via email to the address associated with your account at least thirty (30) days before the changes take effect. We will clearly summarize the material changes in our notification.</li>
            <li><strong>Urgent Changes:</strong> In rare circumstances where changes are required by law, regulation, or court order, or to address an immediate security threat, we may implement changes with shorter notice. In such cases, we will provide as much advance notice as is reasonably practicable.</li>
          </ul>
          <p>
            If you do not agree with any changes to these Terms, your sole remedy is to cease using the Service and terminate your account before the changes take effect. Paying subscribers who do not agree with material changes may cancel their subscription for a pro-rata refund of unused pre-paid fees.
          </p>

          {/* 26. Severability */}
          <h2 id="severability" className="scroll-mt-24">26. Severability</h2>
          <p>
            If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, that provision shall be modified to the minimum extent necessary to make it valid, legal, and enforceable while preserving the original intent of the parties. If such modification is not possible, the provision shall be severed from these Terms. The invalidity, illegality, or unenforceability of any individual provision shall not affect the validity or enforceability of the remaining provisions of these Terms, which shall continue in full force and effect.
          </p>

          {/* 27. Entire Agreement */}
          <h2 id="entire-agreement" className="scroll-mt-24">27. Entire Agreement</h2>
          <p>
            These Terms, together with the <Link href="/legal/privacy" className="text-red-400 hover:text-red-300 transition-colors">Privacy Policy</Link>, <Link href="/legal/community-guidelines" className="text-red-400 hover:text-red-300 transition-colors">Community Guidelines</Link>, <Link href="/legal/acceptable-use" className="text-red-400 hover:text-red-300 transition-colors">Acceptable Use Policy</Link>, and any other policies incorporated by reference, constitute the entire agreement between you and the Company with respect to the Service and supersede all prior and contemporaneous understandings, agreements, representations, and warranties, both written and oral, regarding the Service.
          </p>
          <p>
            No waiver by the Company of any term or condition set out in these Terms shall be deemed a further or continuing waiver of such term or condition, or a waiver of any other term or condition. Any failure of the Company to assert a right or provision under these Terms shall not constitute a waiver of such right or provision.
          </p>

          {/* 28. Contact */}
          <h2 id="contact" className="scroll-mt-24">28. Contact</h2>
          <p>
            If you have any questions, concerns, or feedback regarding these Terms of Service, please contact us:
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

          <div className="mt-12 pt-8 border-t border-surface-800 text-surface-400 text-sm not-prose">
            <p>
              By using Screenplay Studio, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
            <p className="mt-3 text-surface-500">
              Screenplay Studio is a product of{' '}
              <a href="https://development.northem.no/" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 transition-colors">Northem Development</a>
              {' '}&mdash; made with ♥ in Norway.
            </p>
            <div className="mt-4 flex gap-4">
              <Link href="/legal/privacy" className="text-red-400 hover:text-red-300 transition-colors">Privacy Policy</Link>
              <Link href="/legal/community-guidelines" className="text-red-400 hover:text-red-300 transition-colors">Community Guidelines</Link>
              <Link href="/legal/acceptable-use" className="text-red-400 hover:text-red-300 transition-colors">Acceptable Use Policy</Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
