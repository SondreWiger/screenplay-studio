'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { SubNav } from '@/components/shell/SubNav';

const LEGAL_NAV = [
  { href: '/legal', label: 'Legal Center' },
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/cookies', label: 'Cookie Policy' },
  { href: '/legal/community-guidelines', label: 'Community Guidelines' },
  { href: '/legal/acceptable-use', label: 'Acceptable Use' },
  { href: '/legal/content-policy', label: 'Content Policy' },
  { href: '/legal/copyright', label: 'Copyright Policy' },
  { href: '/legal/dmca', label: 'DMCA & Takedowns' },
  { href: '/legal/data-processing', label: 'Data Processing' },
  { href: '/legal/security', label: 'Security' },
  { href: '/legal/opensource-killswitch', label: 'Open-Source Kill Switch' },
  { href: '/legal/blog', label: 'Legal Updates' },
  { href: '/legal/creator-terms', label: 'Creator Affiliate Terms' },
  { href: '/legal/translation-guidelines', label: 'Translation Guidelines' },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  return (
    <AppShell>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 md:py-10 lg:flex-row lg:gap-12">
        <SubNav
          id="legal"
          title="Legal center"
          groups={[{
            items: LEGAL_NAV.map((item) => ({
              ...item,
              active: pathname === item.href || (item.href !== '/legal' && pathname.startsWith(item.href)),
            })),
          }]}
          footer={
            <div className="space-y-1.5 text-[11px]">
              <p className="uppercase tracking-wide text-surface-500">Last updated</p>
              <p className="text-surface-400">February 2026</p>
              <p className="mt-3 uppercase tracking-wide text-surface-500">Questions?</p>
              <a href="mailto:legal@screenplaystudio.fun" className="text-brand-400 hover:text-brand-300">legal@screenplaystudio.fun</a>
              <p className="mt-4 uppercase tracking-wide text-surface-500">Developed by</p>
              <a href="https://development.northem.no/" target="_blank" rel="noopener noreferrer" className="block font-semibold text-surface-300 hover:text-white">Northem Development</a>
              <p className="text-surface-500">Made with ♥ in Norway</p>
            </div>
          }
        />
        <div className="min-w-0 flex-1 pb-16">{children}</div>
      </div>
    </AppShell>
  );
}
