import Link from 'next/link';

export const metadata = {
  title: 'DMCA & Takedown Policy | Screenplay Studio',
  description: 'DMCA takedown procedures, counter-notifications, and copyright enforcement at Screenplay Studio.',
};

export default function DMCAPage() {
  return (
    <div>
      <div className="max-w-4xl">
        <div className="mb-10">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Copyright</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">DMCA &amp; Takedown Notices</h1>
          <p className="text-sm text-surface-500 mt-2">Effective: February 22, 2026</p>
        </div>

        <article className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-surface-300 prose-p:leading-relaxed prose-li:text-surface-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300 prose-strong:text-white">
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Overview</h2>
            <p className="text-surface-300 mb-4">
              Screenplay Studio respects the intellectual property rights of others and expects its users to do the same. In accordance with the Digital Millennium Copyright Act of 1998 (&ldquo;DMCA&rdquo;), we will respond promptly to claims of copyright infringement committed using our service.
            </p>
            <p className="text-surface-300">
              This policy outlines our procedures for handling DMCA takedown requests, counter-notifications, and repeat infringer enforcement. We also accept takedown requests for works protected under international copyright frameworks.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Designated DMCA Agent</h2>
            <p className="text-surface-300 mb-4">
              Our designated agent for receiving notifications of claimed copyright infringement is:
            </p>
            <div className="bg-surface-900 border border-surface-800 rounded-lg p-6">
              <dl className="space-y-2 text-surface-300">
                <div>
                  <dt className="text-surface-500 text-sm">Name</dt>
                  <dd className="text-white font-semibold">DMCA Agent, Screenplay Studio</dd>
                </div>
                <div>
                  <dt className="text-surface-500 text-sm">Email</dt>
                  <dd>
                    <a href="mailto:dmca@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                      dmca@screenplaystudio.fun
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-surface-500 text-sm">Response Time</dt>
                  <dd className="text-surface-300">Within 24 hours of receipt</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Filing a Takedown Notice</h2>
            <p className="text-surface-300 mb-4">
              If you believe that content hosted on Screenplay Studio infringes your copyright, you may submit a DMCA takedown notice to our designated agent. Under 17 U.S.C. § 512(c)(3), your notice must include <strong className="text-white">all six</strong> of the following elements:
            </p>

            <div className="space-y-4">
              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center font-bold text-sm">1</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Physical or Electronic Signature</h3>
                  <p className="text-surface-300 text-sm">A physical or electronic signature of the copyright owner or a person authorized to act on their behalf.</p>
                </div>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center font-bold text-sm">2</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Identification of the Copyrighted Work</h3>
                  <p className="text-surface-300 text-sm">Identification of the copyrighted work claimed to have been infringed. If multiple works are covered by a single notification, provide a representative list.</p>
                </div>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center font-bold text-sm">3</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Identification of the Infringing Material</h3>
                  <p className="text-surface-300 text-sm">Identification of the material that is claimed to be infringing, including the specific URL(s) or other information reasonably sufficient for us to locate the material on our service.</p>
                </div>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center font-bold text-sm">4</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Contact Information</h3>
                  <p className="text-surface-300 text-sm">Your contact information, including your name, mailing address, telephone number, and email address, so that we may contact you regarding the complaint.</p>
                </div>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center font-bold text-sm">5</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Good Faith Statement</h3>
                  <p className="text-surface-300 text-sm">A statement that you have a good faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</p>
                </div>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center font-bold text-sm">6</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Statement Under Penalty of Perjury</h3>
                  <p className="text-surface-300 text-sm">A statement, made under penalty of perjury, that the information in the notification is accurate and that you are the copyright owner or authorized to act on the copyright owner&apos;s behalf.</p>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-surface-900 border border-yellow-800/50 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">
                <strong>Warning:</strong> Under 17 U.S.C. § 512(f), any person who knowingly materially misrepresents that material is infringing may be subject to liability for damages, including costs and attorneys&apos; fees.
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Counter-Notification</h2>
            <p className="text-surface-300 mb-4">
              If you believe that your content was removed or disabled as a result of a mistake or misidentification, you may submit a counter-notification to our designated agent. Under 17 U.S.C. § 512(g)(3), your counter-notification must include <strong className="text-white">all six</strong> of the following elements:
            </p>

            <div className="space-y-4">
              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-900/50 text-green-400 flex items-center justify-center font-bold text-sm">1</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Physical or Electronic Signature</h3>
                  <p className="text-surface-300 text-sm">Your physical or electronic signature.</p>
                </div>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-900/50 text-green-400 flex items-center justify-center font-bold text-sm">2</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Identification of Removed Material</h3>
                  <p className="text-surface-300 text-sm">Identification of the material that was removed or disabled, and the location at which the material appeared before it was removed or disabled (including the URL).</p>
                </div>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-900/50 text-green-400 flex items-center justify-center font-bold text-sm">3</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Statement Under Penalty of Perjury</h3>
                  <p className="text-surface-300 text-sm">A statement, under penalty of perjury, that you have a good faith belief that the material was removed or disabled as a result of mistake or misidentification.</p>
                </div>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-900/50 text-green-400 flex items-center justify-center font-bold text-sm">4</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Contact Information</h3>
                  <p className="text-surface-300 text-sm">Your name, address, and telephone number.</p>
                </div>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-900/50 text-green-400 flex items-center justify-center font-bold text-sm">5</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Consent to Jurisdiction</h3>
                  <p className="text-surface-300 text-sm">A statement that you consent to the jurisdiction of the Federal District Court for the judicial district in which your address is located (or, if outside the United States, any judicial district in which Screenplay Studio may be found), and that you will accept service of process from the person who provided the original DMCA notification or an agent of such person.</p>
                </div>
              </div>

              <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-900/50 text-green-400 flex items-center justify-center font-bold text-sm">6</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">Submission to DMCA Agent</h3>
                  <p className="text-surface-300 text-sm">Send the counter-notification to our designated DMCA agent at{' '}
                    <a href="mailto:dmca@screenplaystudio.fun" className="text-red-400 hover:text-red-300">
                      dmca@screenplaystudio.fun
                    </a>.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Repeat Infringer Policy</h2>
            <p className="text-surface-300 mb-4">
              Screenplay Studio maintains a strict repeat infringer policy in accordance with the DMCA. We operate a <strong className="text-white">three-strike system</strong>:
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-4 bg-surface-900 border border-surface-800 rounded-lg p-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-900/50 text-yellow-400 flex items-center justify-center font-bold text-sm">1</span>
                <div>
                  <h3 className="text-white font-semibold">First Strike</h3>
                  <p className="text-surface-400 text-sm">The infringing content is removed and the user receives a formal warning notification. The infringement is recorded on the user&apos;s account.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-surface-900 border border-surface-800 rounded-lg p-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-900/50 text-orange-400 flex items-center justify-center font-bold text-sm">2</span>
                <div>
                  <h3 className="text-white font-semibold">Second Strike</h3>
                  <p className="text-surface-400 text-sm">The infringing content is removed and the user&apos;s account is temporarily suspended for a period determined at our discretion. The user receives a final warning.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-surface-900 border border-surface-800 rounded-lg p-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-900/50 text-red-400 flex items-center justify-center font-bold text-sm">3</span>
                <div>
                  <h3 className="text-white font-semibold">Third Strike</h3>
                  <p className="text-surface-400 text-sm">The user&apos;s account is permanently terminated. All content associated with the account may be removed. The user is prohibited from creating new accounts.</p>
                </div>
              </div>
            </div>

            <p className="text-surface-400 text-sm mt-4">
              Strikes may be removed if a counter-notification is successful or if the original takedown is withdrawn by the claimant. Strikes expire after 12 months from the date of issuance.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Safe Harbor</h2>
            <p className="text-surface-300 mb-4">
              Screenplay Studio operates as a service provider under the safe harbor provisions of the DMCA (17 U.S.C. § 512). We do not monitor or review all content uploaded by users prior to its publication. We rely on copyright holders to notify us of alleged infringement.
            </p>
            <p className="text-surface-300">
              Upon receiving a valid DMCA takedown notice, we will act expeditiously to remove or disable access to the allegedly infringing material. We do not make legal determinations about the validity of copyright claims — we follow the statutory procedures outlined in the DMCA.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Timeline</h2>
            <p className="text-surface-300 mb-4">
              We are committed to handling all DMCA matters promptly. The following is our standard timeline:
            </p>

            <div className="overflow-x-auto rounded-lg border border-surface-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-900">
                  <tr>
                    <th className="px-4 py-3 text-surface-300 font-semibold border-b border-surface-800">Action</th>
                    <th className="px-4 py-3 text-surface-300 font-semibold border-b border-surface-800">Timeline</th>
                    <th className="px-4 py-3 text-surface-300 font-semibold border-b border-surface-800">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  <tr className="bg-surface-950">
                    <td className="px-4 py-3 text-white font-medium">Acknowledgment</td>
                    <td className="px-4 py-3 text-surface-300">Within 24 hours</td>
                    <td className="px-4 py-3 text-surface-400">We acknowledge receipt of the takedown notice and confirm that it is being reviewed.</td>
                  </tr>
                  <tr className="bg-surface-900">
                    <td className="px-4 py-3 text-white font-medium">Action on Takedown</td>
                    <td className="px-4 py-3 text-surface-300">Within 72 hours</td>
                    <td className="px-4 py-3 text-surface-400">If the notice is valid, the infringing content is removed or access is disabled. The affected user is notified.</td>
                  </tr>
                  <tr className="bg-surface-950">
                    <td className="px-4 py-3 text-white font-medium">Counter-Notification Review</td>
                    <td className="px-4 py-3 text-surface-300">10–14 business days</td>
                    <td className="px-4 py-3 text-surface-400">After receiving a valid counter-notification, we wait 10–14 business days before restoring the content, unless the original complainant files a court action.</td>
                  </tr>
                  <tr className="bg-surface-900">
                    <td className="px-4 py-3 text-white font-medium">Content Restoration</td>
                    <td className="px-4 py-3 text-surface-300">After waiting period</td>
                    <td className="px-4 py-3 text-surface-400">If no court action is filed during the waiting period, the content is restored and access is re-enabled.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">International Takedowns</h2>
            <p className="text-surface-300 mb-4">
              While the DMCA is a United States statute, Screenplay Studio recognizes and respects international copyright protections. We accept takedown requests for works protected under international copyright laws and treaties, including but not limited to:
            </p>
            <ul className="list-disc list-inside text-surface-300 space-y-2 mb-4">
              <li>The Berne Convention for the Protection of Literary and Artistic Works</li>
              <li>The WIPO Copyright Treaty</li>
              <li>The EU Copyright Directive (Directive 2019/790)</li>
              <li>National copyright laws of the country where the work was created</li>
            </ul>
            <p className="text-surface-300">
              For international takedown requests, please follow the same procedure as outlined above for DMCA notices. Include any relevant documentation of your copyright ownership or authorization under your country&apos;s laws. We will evaluate all international requests in good faith and take appropriate action.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-4">Contact</h2>
            <p className="text-surface-300 mb-4">
              For all DMCA-related inquiries, notifications, and counter-notifications, please contact:
            </p>
            <div className="bg-surface-900 border border-surface-800 rounded-lg p-6">
              <dl className="space-y-3 text-surface-300">
                <div>
                  <dt className="text-surface-500 text-sm">DMCA Notices &amp; Counter-Notifications</dt>
                  <dd>
                    <a href="mailto:dmca@screenplaystudio.fun" className="text-red-400 hover:text-red-300 font-mono">
                      dmca@screenplaystudio.fun
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-surface-500 text-sm">General Copyright Questions</dt>
                  <dd>
                    <a href="mailto:legal@screenplaystudio.fun" className="text-red-400 hover:text-red-300 font-mono">
                      legal@screenplaystudio.fun
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-surface-500 text-sm">Related Policies</dt>
                  <dd className="space-x-4">
                    <Link href="/legal/terms" className="text-red-400 hover:text-red-300">
                      Terms of Service
                    </Link>
                    <Link href="/legal/acceptable-use" className="text-red-400 hover:text-red-300">
                      Acceptable Use Policy
                    </Link>
                    <Link href="/legal/content-policy" className="text-red-400 hover:text-red-300">
                      Content Policy
                    </Link>
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
