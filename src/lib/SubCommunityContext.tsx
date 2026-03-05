'use client';
import { createContext, useContext } from 'react';
import type { SubCommunity, SubCommunityMember } from '@/lib/types';

export interface SubCommunityCtx {
  community: SubCommunity;
  membership: SubCommunityMember | null;
  isMod: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  canPost: boolean;
  refetch: () => void;
}

export const SubCommunityContext = createContext<SubCommunityCtx | null>(null);

export function useSubCommunity() {
  const ctx = useContext(SubCommunityContext);
  if (!ctx) throw new Error('useSubCommunity must be used inside SubCommunityLayout');
  return ctx;
}
