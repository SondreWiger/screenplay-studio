import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Content Licenses Explained — Screenplay Studio',
  description: 'A plain-English guide to script and creative work licenses: Creative Commons, All Rights Reserved, Public Domain, and more.',
};

// ============================================================
// /licenses — Public page explaining content licenses
// ============================================================

const categories = [
  {
    id: 'traditional',
    title: 'Traditional Copyright',
    color: '#8888aa',
    icon: '©',
    licenses: [
      {
        id: 'all-rights-reserved',
        name: 'All Rights Reserved',
        tag: 'Full Protection',
        tagColor: 'bg-surface-700 text-surface-300',
        summary: 'Standard copyright. No one can copy, distribute, perform, or adapt your work without your explicit permission.',
        details: [
          { label: 'Can share?', value: 'No — not without permission' },
          { label: 'Can remix?', value: 'No' },
          { label: 'Commercial use?', value: 'No — permission required' },
          { label: 'Credit required?', value: 'N/A' },
        ],
        usedWhen: 'You\'re pitching to studios, submitting to competitions, or circulating drafts to a controlled audience. This is the default for most professional screenwriting.',
        badge: '© ARR',
      },
      {
        id: 'confidential',
        name: 'Confidential — Do Not Distribute',
        tag: 'Restricted',
        tagColor: 'bg-red-950 text-red-400',
        summary: 'Not for distribution beyond the intended recipient. No sharing, copying, or storing beyond what\'s needed for review.',
        details: [
          { label: 'Can share?', value: 'No — internal only' },
          { label: 'Can remix?', value: 'No' },
          { label: 'Commercial use?', value: 'No' },
          { label: 'Credit required?', value: 'N/A' },
        ],
        usedWhen: 'Early-stage development materials, financing documents, commissioned drafts, or anything you\'re sending to a finite controlled group.',
        badge: '🔒 CONFIDENTIAL',
      },
      {
        id: 'nda',
        name: 'Under NDA',
        tag: 'Legally Binding',
        tagColor: 'bg-amber-950 text-amber-400',
        summary: 'Access requires a signed Non-Disclosure Agreement. Recipients are legally bound to keep the content confidential.',
        details: [
          { label: 'Can share?', value: 'Only with NDA signatories' },
          { label: 'Can remix?', value: 'No' },
          { label: 'Commercial use?', value: 'Governed by NDA terms' },
          { label: 'Credit required?', value: 'N/A' },
        ],
        usedWhen: 'IP-sensitive concepts, pre-green-light scripts at larger studios, or any context where you need legal teeth on confidentiality.',
        badge: '📋 NDA',
      },
      {
        id: 'wga-registered',
        name: 'WGA Registered',
        tag: 'Timestamped',
        tagColor: 'bg-blue-950 text-blue-400',
        summary: 'Your script is registered with the Writers Guild of America. This creates a timestamped record of your authorship — it does NOT restrict or grant any rights.',
        details: [
          { label: 'Can share?', value: 'Yes (governed by copyright)' },
          { label: 'Rights granted?', value: 'None — it\'s a record' },
          { label: 'Proves authorship?', value: 'Yes — useful in disputes' },
          { label: 'Replaces copyright?', value: 'No' },
        ],
        usedWhen: 'You want a timestamped record before wide circulation, useful if authorship is ever disputed. Often combined with All Rights Reserved.',
        badge: '📝 WGA',
      },
    ],
  },
  {
    id: 'cc-free',
    title: 'Creative Commons — Free to Use',
    color: '#22c55e',
    icon: 'CC',
    description: 'These licenses let others use your work freely, with minimal conditions. Great for writers who want their work in the world.',
    licenses: [
      {
        id: 'cc0',
        name: 'CC0 — Public Domain Dedication',
        tag: '✓ Free to use',
        tagColor: 'bg-green-900/50 text-green-400 border border-green-800',
        summary: 'You waive all copyright. Anyone can do anything with your work — adapt, sell, republish — with zero conditions.',
        details: [
          { label: 'Can share?', value: '✓ Yes, freely' },
          { label: 'Can remix?', value: '✓ Yes, even commercially' },
          { label: 'Commercial use?', value: '✓ Yes' },
          { label: 'Credit required?', value: 'Not required (though appreciated)' },
        ],
        usedWhen: 'Writing samples, open-source educational scripts, or when you actively want maximum exposure and reuse.',
        badge: 'CC0',
        ccUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      },
      {
        id: 'cc-by',
        name: 'CC BY — Attribution',
        tag: '✓ Free with credit',
        tagColor: 'bg-green-900/50 text-green-400 border border-green-800',
        summary: 'Anyone can use, share, adapt, even commercially — as long as they give you credit.',
        details: [
          { label: 'Can share?', value: '✓ Yes' },
          { label: 'Can remix?', value: '✓ Yes' },
          { label: 'Commercial use?', value: '✓ Yes' },
          { label: 'Credit required?', value: '✓ Yes — your name must appear' },
        ],
        usedWhen: 'Portfolio work, educational scripts you want widely adapted, open writing. The most permissive CC license that still requires credit.',
        badge: 'CC BY',
        ccUrl: 'https://creativecommons.org/licenses/by/4.0/',
      },
      {
        id: 'cc-by-sa',
        name: 'CC BY-SA — Attribution + ShareAlike',
        tag: '✓ Free (copyleft)',
        tagColor: 'bg-green-900/50 text-green-400 border border-green-800',
        summary: 'Free to use and adapt with credit — but any derivative work must carry the same CC BY-SA license (copyleft).',
        details: [
          { label: 'Can share?', value: '✓ Yes' },
          { label: 'Can remix?', value: '✓ Yes — but same license applies' },
          { label: 'Commercial use?', value: '✓ Yes' },
          { label: 'Credit required?', value: '✓ Yes' },
        ],
        usedWhen: 'Community-built stories, collaborative worlds, or anywhere you want a "viral" licensing structure that keeps derivatives open.',
        badge: 'CC BY-SA',
        ccUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      },
    ],
  },
  {
    id: 'cc-restricted',
    title: 'Creative Commons — Restricted Use',
    color: '#f97316',
    icon: 'CC',
    description: 'These licenses allow some sharing but restrict commercial use, remixes, or both. You keep more control.',
    licenses: [
      {
        id: 'cc-by-nc',
        name: 'CC BY-NC — NonCommercial',
        tag: 'Non-commercial only',
        tagColor: 'bg-orange-950 text-orange-400 border border-orange-900',
        summary: 'Free for anyone to share and adapt with credit — but only for non-commercial purposes. Commercial use requires your permission.',
        details: [
          { label: 'Can share?', value: '✓ Yes (non-commercial)' },
          { label: 'Can remix?', value: '✓ Yes (non-commercial)' },
          { label: 'Commercial use?', value: '✗ Requires permission' },
          { label: 'Credit required?', value: '✓ Yes' },
        ],
        usedWhen: 'Academic scripts, festival-only submissions, or work you\'re happy for students/educators to use but want to monetise yourself.',
        badge: 'CC BY-NC',
        ccUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
      },
      {
        id: 'cc-by-nc-sa',
        name: 'CC BY-NC-SA',
        tag: 'Non-commercial + ShareAlike',
        tagColor: 'bg-orange-950 text-orange-400 border border-orange-900',
        summary: 'Non-commercial use only, with credit. Derivatives must use the same license.',
        details: [
          { label: 'Can share?', value: '✓ Yes (non-commercial)' },
          { label: 'Can remix?', value: '✓ Yes (same license, non-commercial)' },
          { label: 'Commercial use?', value: '✗ Requires permission' },
          { label: 'Credit required?', value: '✓ Yes' },
        ],
        usedWhen: 'Works you want to circulate freely in creative/educational communities, while keeping commercial rights to yourself.',
        badge: 'CC BY-NC-SA',
        ccUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      },
      {
        id: 'cc-by-nd',
        name: 'CC BY-ND — NoDerivatives',
        tag: 'Share unchanged only',
        tagColor: 'bg-orange-950 text-orange-400 border border-orange-900',
        summary: 'Others can share your work as-is with credit, but cannot make adaptations or derivative works.',
        details: [
          { label: 'Can share?', value: '✓ Yes (unchanged)' },
          { label: 'Can remix?', value: '✗ Not allowed' },
          { label: 'Commercial use?', value: '✓ Yes (but unchanged)' },
          { label: 'Credit required?', value: '✓ Yes' },
        ],
        usedWhen: 'Finished scripts you\'re happy to distribute widely (press kits, portfolios) but don\'t want adapted.',
        badge: 'CC BY-ND',
        ccUrl: 'https://creativecommons.org/licenses/by-nd/4.0/',
      },
      {
        id: 'cc-by-nc-nd',
        name: 'CC BY-NC-ND — Most Restrictive CC',
        tag: 'Share unchanged, non-commercial',
        tagColor: 'bg-orange-950 text-orange-400 border border-orange-900',
        summary: 'The most restrictive Creative Commons license. Others can only share your original, unchanged work for non-commercial purposes, with credit.',
        details: [
          { label: 'Can share?', value: '✓ Yes (unchanged, non-commercial)' },
          { label: 'Can remix?', value: '✗ Not allowed' },
          { label: 'Commercial use?', value: '✗ Not allowed' },
          { label: 'Credit required?', value: '✓ Yes' },
        ],
        usedWhen: 'Works that are effectively "read-only" — you want visibility but full control over commercial exploitation and adaptations.',
        badge: 'CC BY-NC-ND',
        ccUrl: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
      },
    ],
  },
];

export default function LicensesPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070710' }}>
      {/* Header */}
      <div className="border-b border-surface-800/60 sticky top-0 z-10 backdrop-blur-xl" style={{ backgroundColor: 'rgba(7,7,16,0.92)' }}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="w-8 h-8 bg-[#FF5F1F] rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0">
            SS
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white">Content Licenses Explained</h1>
            <p className="text-xs text-surface-500 hidden sm:block">A plain-English guide to script and creative work licensing</p>
          </div>
          <Link href="/dashboard" className="text-xs text-surface-500 hover:text-white transition-colors">
            ← Back to app
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
        {/* Intro */}
        <div>
          <p className="text-surface-300 leading-relaxed max-w-2xl">
            When you share a script through Screenplay Studio, you can attach a license that tells recipients exactly
            what they can and cannot do with your work. This page explains every option in plain English.
          </p>
          <p className="text-surface-500 text-sm mt-3">
            Note: Screenplay Studio does not provide legal advice. For binding agreements, consult an entertainment lawyer.
          </p>
        </div>

        {/* Quick reference table */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">Quick Reference</h2>
          <div className="overflow-x-auto rounded-xl border border-surface-800/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800/60" style={{ backgroundColor: 'rgba(15,15,28,0.8)' }}>
                  <th className="text-left px-4 py-3 text-surface-400 font-medium w-48">License</th>
                  <th className="px-3 py-3 text-surface-400 font-medium text-center">Share</th>
                  <th className="px-3 py-3 text-surface-400 font-medium text-center">Remix</th>
                  <th className="px-3 py-3 text-surface-400 font-medium text-center">Commercial</th>
                  <th className="px-3 py-3 text-surface-400 font-medium text-center">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/40">
                {[
                  { name: 'All Rights Reserved', share: false, remix: false, commercial: false, credit: false },
                  { name: 'Confidential', share: false, remix: false, commercial: false, credit: false },
                  { name: 'Under NDA', share: 'NDA only', remix: false, commercial: 'NDA', credit: false },
                  { name: 'WGA Registered', share: true, remix: true, commercial: true, credit: false, note: 'Just a record' },
                  { name: 'CC0 — Public Domain', share: true, remix: true, commercial: true, credit: false },
                  { name: 'CC BY', share: true, remix: true, commercial: true, credit: true },
                  { name: 'CC BY-SA', share: true, remix: 'Same license', commercial: true, credit: true },
                  { name: 'CC BY-NC', share: true, remix: true, commercial: false, credit: true },
                  { name: 'CC BY-NC-SA', share: true, remix: 'Same license', commercial: false, credit: true },
                  { name: 'CC BY-ND', share: true, remix: false, commercial: true, credit: true },
                  { name: 'CC BY-NC-ND', share: true, remix: false, commercial: false, credit: true },
                ].map((row) => (
                  <tr key={row.name} className="hover:bg-surface-900/40 transition-colors">
                    <td className="px-4 py-2.5 text-surface-200 font-medium">{row.name}</td>
                    {(['share', 'remix', 'commercial', 'credit'] as const).map((col) => {
                      const v = row[col];
                      const isTrue = v === true;
                      const isFalse = v === false;
                      return (
                        <td key={col} className="px-3 py-2.5 text-center">
                          {isTrue ? (
                            <span className="text-green-400 font-bold">✓</span>
                          ) : isFalse ? (
                            <span className="text-red-400/70">✗</span>
                          ) : (
                            <span className="text-amber-400 text-xs">{v}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Categories */}
        {categories.map((cat) => (
          <section key={cat.id}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                style={{ backgroundColor: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.color}44` }}
              >
                {cat.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{cat.title}</h2>
                {cat.description && <p className="text-sm text-surface-400 mt-0.5">{cat.description}</p>}
              </div>
            </div>

            <div className="space-y-4">
              {cat.licenses.map((lic) => (
                <div key={lic.id} className="rounded-xl border border-surface-800/60 overflow-hidden" style={{ backgroundColor: 'rgba(15,15,28,0.6)' }}>
                  <div className="px-5 py-4 border-b border-surface-800/60 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${lic.tagColor}`}>{lic.tag}</span>
                      <h3 className="text-sm font-bold text-white">{lic.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <code className="text-[10px] font-mono bg-surface-800 text-surface-300 px-2 py-0.5 rounded">{lic.badge}</code>
                      {(lic as any).ccUrl && (
                        <a
                          href={(lic as any).ccUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#FF5F1F] hover:underline"
                        >
                          Official ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    <p className="text-surface-300 text-sm leading-relaxed">{lic.summary}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {lic.details.map((d) => (
                        <div key={d.label} className="rounded-lg bg-surface-900/60 px-3 py-2.5">
                          <p className="text-[10px] text-surface-500 font-medium mb-0.5">{d.label}</p>
                          <p className="text-xs text-surface-200">{d.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 rounded-lg bg-surface-900/40 border border-surface-800/40 px-3 py-2.5">
                      <span className="text-[#FF5F1F] text-xs mt-0.5 shrink-0">→</span>
                      <p className="text-xs text-surface-400 leading-relaxed"><span className="text-surface-300 font-medium">Use when:</span> {lic.usedWhen}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Footer */}
        <div className="border-t border-surface-800/60 pt-8 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-surface-500">
                Creative Commons licenses are maintained by the{' '}
                <a href="https://creativecommons.org" target="_blank" rel="noopener noreferrer" className="text-[#FF5F1F] hover:underline">
                  Creative Commons organization
                </a>
                . WGA registration info at{' '}
                <a href="https://www.wga.org/contracts/registration" target="_blank" rel="noopener noreferrer" className="text-[#FF5F1F] hover:underline">
                  wga.org
                </a>
                .
              </p>
            </div>
            <Link href="/legal/copyright" className="text-xs text-surface-500 hover:text-surface-300">
              Copyright Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
