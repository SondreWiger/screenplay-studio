'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, LoadingPage } from '@/components/ui';

// ============================================================
// Company Invitation Acceptance — /company/invite/[token]
// Allows users to accept invitations via a direct link (email or shared)
// Works even if the notification was missed or never created.
// ============================================================

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [invitation, setInvitation] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'success' | 'error' | 'login'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchInvitation();
  }, [params.token, user]);

  const fetchInvitation = async () => {
    const supabase = createClient();

    // Fetch invitation by token (use service-level access via RPC to bypass RLS)
    const { data, error } = await supabase
      .rpc('get_invitation_by_token', { p_token: params.token });

    if (error || !data) {
      // Fallback: try direct query (works if user is already a company admin)
      const { data: inv } = await supabase
        .from('company_invitations')
        .select('*, company:companies(name, logo_url, brand_color, slug)')
        .eq('token', params.token)
        .maybeSingle();

      if (!inv) {
        setStatus('error');
        setErrorMsg('This invitation link is invalid or has been revoked.');
        return;
      }

      setInvitation(inv);
      setCompany(inv.company);

      if (inv.accepted) {
        setStatus('success');
        return;
      }

      if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
        setStatus('error');
        setErrorMsg('This invitation has expired. Ask your admin to send a new one.');
        return;
      }

      if (!user) {
        setStatus('login');
        return;
      }

      setStatus('ready');
      return;
    }

    // RPC returned data
    const inv = data;
    setInvitation(inv);
    setCompany(inv.company);

    if (inv.accepted) {
      setStatus('success');
      return;
    }

    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      setStatus('error');
      setErrorMsg('This invitation has expired. Ask your admin to send a new one.');
      return;
    }

    if (!user) {
      setStatus('login');
      return;
    }

    setStatus('ready');
  };

  const handleAccept = async () => {
    if (!user || !invitation) return;
    setStatus('accepting');

    const supabase = createClient();
    const { data, error } = await supabase.rpc('accept_company_invitation', {
      p_invitation_id: invitation.id,
    });

    if (error) {
      setStatus('error');
      setErrorMsg(error.message || 'Failed to accept invitation.');
      return;
    }

    setStatus('success');
  };

  const handleDecline = async () => {
    if (!invitation) return;
    const supabase = createClient();
    // Mark as expired instead of deleting (avoids RLS issues)
    await supabase.rpc('decline_company_invitation', { p_invitation_id: invitation.id });
    router.push('/dashboard');
  };

  if (authLoading) return <LoadingPage />;

  if (status === 'loading') return <LoadingPage />;

  if (status === 'login') {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          {company?.logo_url ? (
            <img src={company.logo_url} alt="" className="h-12 w-auto mx-auto mb-4" />
          ) : company ? (
            <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: company.brand_color || '#3B82F6' }}>
              {company.name?.[0] || '?'}
            </div>
          ) : null}
          <h1 className="text-xl font-bold text-white mb-2">You're Invited!</h1>
          <p className="text-surface-400 mb-1">
            <span className="text-white font-semibold">{company?.name || 'A company'}</span> has invited you to join as{' '}
            <span className="capitalize text-brand-400">{invitation?.role || 'member'}</span>.
          </p>
          <p className="text-sm text-surface-500 mb-6">Sign in or create an account to accept this invitation.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push(`/auth/login?redirect=/company/invite/${params.token}`)}>
              Sign In
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/auth/register?redirect=/company/invite/${params.token}`)}>
              Create Account
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-white mb-2">Invitation Unavailable</h1>
          <p className="text-sm text-surface-400 mb-6">{errorMsg}</p>
          <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-white mb-2">Welcome to {company?.name || 'the team'}!</h1>
          <p className="text-sm text-surface-400 mb-6">
            You've joined as <span className="capitalize text-brand-400 font-medium">{invitation?.role || 'member'}</span>.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push(company?.slug ? `/company/${company.slug}` : '/company')}>
              Go to Company
            </Button>
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>Dashboard</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Ready to accept
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center">
        {company?.logo_url ? (
          <img src={company.logo_url} alt="" className="h-12 w-auto mx-auto mb-4" />
        ) : company ? (
          <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: company.brand_color || '#3B82F6' }}>
            {company.name?.[0] || '?'}
          </div>
        ) : null}

        <h1 className="text-xl font-bold text-white mb-2">Join {company?.name || 'Company'}</h1>
        <p className="text-surface-400 mb-1">
          You've been invited to join as <span className="capitalize text-brand-400 font-medium">{invitation?.role || 'member'}</span>.
        </p>
        <p className="text-xs text-surface-500 mb-6">
          Invited to: <span className="text-surface-300">{invitation?.email}</span>
        </p>

        <div className="flex gap-3 justify-center">
          <Button onClick={handleAccept} loading={status === 'accepting'}>Accept Invitation</Button>
          <Button variant="ghost" onClick={handleDecline}>Decline</Button>
        </div>
      </Card>
    </div>
  );
}
