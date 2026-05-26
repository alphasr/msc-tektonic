import { NextRequest, NextResponse } from 'next/server';
import { getUserPlaylists, refreshAccessToken, SpotifySimplifiedPlaylist } from '@/lib/spotify';
import { cookies } from 'next/headers';

async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
  const expiresAt = Number(cookieStore.get('spotify_expires_at')?.value || 0);

  if (!refreshToken) return null;

  // Token still valid (with 60s buffer)
  if (accessToken && Date.now() < expiresAt - 60000) {
    return accessToken;
  }

  // Refresh the token
  try {
    const newTokens = await refreshAccessToken(refreshToken);
    cookieStore.set('spotify_access_token', newTokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600,
      path: '/',
    });
    cookieStore.set('spotify_expires_at', String(newTokens.expires_at), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    if (newTokens.refresh_token !== refreshToken) {
      cookieStore.set('spotify_refresh_token', newTokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });
    }
    return newTokens.access_token;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated with Spotify', authenticated: false }, { status: 401 });
  }

  try {
    const playlists = await getUserPlaylists(token);
    return NextResponse.json({ playlists, authenticated: true });
  } catch (err: any) {
    console.error('Failed to fetch Spotify playlists:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
