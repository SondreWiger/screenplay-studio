import { NextResponse } from 'next/server';
import { isCinderraCallback, signCinderraAssertion } from '@/lib/cinderra';
import { currentUser, errorResponse } from '../shared';

/**
 * POST /api/cinderra/sso  { state, redirect_uri }
 *
 * "Log in with Screenplay Studio" on Cinderra: the signed-in user agreed on
 * /oauth/cinderra, so hand back where to send the browser — Cinderra's
 * callback with a two-minute signed assertion of who they are.
 *
 * A POST from our own page rather than a GET redirect, so another site cannot
 * sign a visitor in to Cinderra just by linking them here.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const state = typeof body?.state === 'string' ? body.state : '';
  const redirectUri = typeof body?.redirect_uri === 'string' ? body.redirect_uri : '';
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(state) || !isCinderraCallback(redirectUri)) {
    return NextResponse.json({ error: 'This sign-in link is not valid' }, { status: 400 });
  }

  const me = await currentUser();
  if ('error' in me) return me.error;

  try {
    const assertion = signCinderraAssertion({ userId: me.user.id, name: me.name, avatarUrl: me.avatarUrl, state });
    const target = new URL(redirectUri);
    target.searchParams.set('state', state);
    target.searchParams.set('assertion', assertion);
    return NextResponse.json({ redirect: target.toString() });
  } catch (err) {
    return errorResponse(err, 'Could not sign you in to Cinderra');
  }
}
