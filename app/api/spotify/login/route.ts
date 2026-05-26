import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyAuthUrl, isSpotifyConfigured } from '@/lib/spotify';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(_req: NextRequest) {
  if (!isSpotifyConfigured()) {
    return NextResponse.json(
      { error: 'Spotify not configured. Add SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI to .env' },
      { status: 503 }
    );
  }

  // Generate a random state to protect against CSRF
  const state = crypto.randomBytes(16).toString('hex');

  const cookieStore = await cookies();
  cookieStore.set('spotify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const authUrl = getSpotifyAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
