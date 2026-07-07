import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshAccessToken } from '@/lib/spotify';

async function getValidToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
  const expiresAt = Number(cookieStore.get('spotify_expires_at')?.value ?? 0);

  if (accessToken && Date.now() < expiresAt - 60_000) return accessToken;
  if (!refreshToken) return null;

  try {
    const newTokens = await refreshAccessToken(refreshToken);
    return newTokens.access_token;
  } catch {
    return null;
  }
}

/**
 * POST /api/spotify/play
 * Body: { uri: string; device_id: string }
 * Triggers playback of a Spotify track URI on the given Web Playback SDK device.
 */
export async function POST(req: NextRequest) {
  const token = await getValidToken();
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let uri: string, device_id: string;
  try {
    ({ uri, device_id } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!uri || !device_id) {
    return NextResponse.json(
      { error: 'Missing uri or device_id' },
      { status: 400 },
    );
  }

  const res = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device_id)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [uri] }),
    },
  );

  if (res.status === 204 || res.ok) {
    return NextResponse.json({ success: true });
  }

  const errBody = await res.text();
  return NextResponse.json({ error: errBody }, { status: res.status });
}
