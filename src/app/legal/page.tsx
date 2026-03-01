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
