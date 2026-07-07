import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshAccessToken } from '@/lib/spotify';

/**
 * GET /api/spotify/token
 * Returns a valid Spotify access token for use in the Web Playback SDK.
 * Refreshes the token if it is about to expire.
 */
export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
  const expiresAt = Number(cookieStore.get('spotify_expires_at')?.value ?? 0);

  if (!refreshToken) {
    return NextResponse.json({ token: null });
  }

  // Return current token if valid for at least another 60 s
  if (accessToken && Date.now() < expiresAt - 60_000) {
    return NextResponse.json({ token: accessToken });
  }

  try {
    const newTokens = await refreshAccessToken(refreshToken);

    const res = NextResponse.json({ token: newTokens.access_token });
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    res.cookies.set('spotify_access_token', newTokens.access_token, {
      ...cookieOpts,
      maxAge: 3600,
    });
    res.cookies.set('spotify_refresh_token', newTokens.refresh_token, {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.set('spotify_expires_at', String(newTokens.expires_at), {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.json({ token: null });
  }
}
