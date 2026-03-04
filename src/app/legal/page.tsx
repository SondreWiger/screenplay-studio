import Link from 'next/link';

const legalPages = [
  {
    title: 'Terms of Service',
    href: '/legal/terms',
    description: 'The rules and conditions that govern your use of Screenplay Studio.',
  },
  {
    title: 'Privacy Policy',
    href: '/legal/privacy',
    description: 'How we collect, use, and protect your personal information.',
  },
  {
    title: 'Cookie Policy',
    href: '/legal/cookies',
    description: 'Information about the cookies and tracking technologies we use.',
  },
  {
    title: 'Community Guidelines',
    href: '/legal/community-guidelines',
    description: 'How to be a great member of the Screenplay Studio community.',
  },
  {
    title: 'Acceptable Use',
    href: '/legal/acceptable-use',
    description: 'Guidelines for responsible and permitted use of our platform.',
  },
  {
    title: 'Content Policy',
    href: '/legal/content-policy',
    description: 'Standards for content created and shared on the platform.',
  },
  {
    title: 'Copyright Policy',
    href: '/legal/copyright',
    description: 'How intellectual property rights are handled on Screenplay Studio.',
  },
  {
    title: 'DMCA & Takedowns',
    href: '/legal/dmca',
    description: 'Our process for handling copyright infringement claims and takedown requests.',
  },
  {
    title: 'Data Processing',
    href: '/legal/data-processing',
    description: 'Details on how we process data on behalf of our users and partners.',
  },
  {
    title: 'Security',
    href: '/legal/security',
    description: 'Our security practices and commitment to keeping your data safe.',
  },
];

const quickFacts = [
  { label: 'Data stored in EU' },
  { label: 'GDPR compliant' },
  { label: 'No AI training on your content' },
  { label: 'You own your scripts' },
];

export default function LegalCenterPage() {
  return (
    <div>
      {/* Hero */}
      <section className="pb-10">
        <h1 className="text-3xl font-black text-white tracking-tight sm:text-4xl">Legal Center</h1>
        <p className="mt-4 text-base text-surface-400 leading-relaxed max-w-2xl">
          Transparency matters to us. Browse our policies and legal documents to understand
          how Screenplay Studio operates and safeguards your rights.
        </p>

        {/* Quick Facts */}
        <div className="flex flex-wrap gap-2 mt-6">
          {quickFacts.map((fact) => (
            <span
              key={fact.label}
              className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1 text-xs font-medium text-red-400"
            >
              {fact.label}
            </span>
          ))}
        </div>
      </section>

      <div className="h-px bg-surface-800/60" />

      {/* Legal Pages Grid */}
      <section className="py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {legalPages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="group rounded-lg border border-surface-800/60 bg-surface-900/40 p-5 transition-all duration-200 hover:border-red-500/20 hover:bg-surface-900/70"
            >
              <h2 className="text-[15px] font-semibold text-white group-hover:text-red-400 transition-colors">{page.title}</h2>
              <p className="mt-1.5 text-[13px] text-surface-500 leading-relaxed">{page.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="h-px bg-surface-800/60" />

      {/* Legal Updates */}
      <section className="py-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Legal Updates</h2>
            <p className="mt-1 text-sm text-surface-500">
              Stay informed about policy changes and legal updates.
            </p>
          </div>
          <Link
            href="/legal/blog"
            className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            View all &rarr;
          </Link>
        </div>
      </section>

      <div className="h-px bg-surface-800/60" />

      {/* Northem / Company attribution */}
      <section className="py-10">
        <div
          className="rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: 'rgba(255,95,31,0.04)', border: '1px solid rgba(255,95,31,0.12)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-widest text-white/30 mb-1">Platform Operator</p>
            <a
              href="https://development.northem.no/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-semibold text-white hover:text-[#FF5F1F] transition-colors"
            >
              Northem Development
            </a>
            <p className="mt-1 text-sm text-white/40 leading-relaxed">
              Screenplay Studio is developed and operated by Northem Development, a Norwegian software
              development company. All legal obligations, data processing, and service responsibilities
              described in these documents are held by Northem Development.
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-start sm:items-end gap-2">
            <a
              href="https://development.northem.no/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: '#FF5F1F' }}
            >
              development.northem.no
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <span className="text-[11px] text-white/25">Made with ♥ in Norway</span>
          </div>
        </div>
      </section>

      <div className="h-px bg-surface-800/60" />

      {/* Contact */}
      <section className="py-10">
        <h2 className="text-lg font-semibold text-white">Questions?</h2>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-xl">
          If you have any questions about our policies or legal documents, reach out to our legal team.
          We aim to respond within 5 business days.
        </p>
        <a
          href="mailto:legal@screenplaystudio.fun"
          className="mt-3 inline-block text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
        >
          legal@screenplaystudio.fun
        </a>
      </section>
    </div>
  );
}
