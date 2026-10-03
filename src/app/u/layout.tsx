import { CommunityShell } from '@/components/community/CommunityShell';

// Public profiles are part of the community site.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CommunityShell>{children}</CommunityShell>;
}
