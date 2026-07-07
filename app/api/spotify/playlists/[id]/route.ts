import { NextRequest, NextResponse } from 'next/server';
import {
  getPlaylistTracksFromItems,
  getAudioFeatures,
  refreshAccessToken,
  spotifyKeyToCamelot,
  SpotifyTrackItem,
  SpotifyAudioFeatures,
} from '@/lib/spotify';
import { cookies } from 'next/headers';

async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
  const expiresAt = Number(cookieStore.get('spotify_expires_at')?.value || 0);
  if (!refreshToken) return null;
  if (accessToken && Date.now() < expiresAt - 60000) return accessToken;
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
    return newTokens.access_token;
  } catch {
    return null;
  }
}

export interface EnrichedSpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string | null;
  durationMs: number;
  previewUrl: string | null;
  spotifyUrl: string;
  bpm: number;
  key: string; // Camelot notation e.g. "8B"
  energy: number; // 0-10 scaled
  popularity: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: 'Not authenticated', authenticated: false },
      { status: 401 },
    );
  }

  try {
    // Single-step: full TrackObject is embedded in PlaylistTrackObject.item per the
    // Spotify OpenAPI schema — no second call to the deprecated GET /tracks needed.
    const validTracks = await getPlaylistTracksFromItems(token, id);
    console.log(
      `[spotify/playlists] fetched ${validTracks.length} tracks for playlist ${id}`,
    );

    // Audio features API is deprecated (403 for new apps) — returns empty gracefully
    const audioFeatures = await getAudioFeatures(
      token,
      validTracks.map((t) => t.id),
    );
    const featuresMap = new Map<string, SpotifyAudioFeatures>(
      audioFeatures.map((f) => [f.id, f]),
    );

    const enriched: EnrichedSpotifyTrack[] = validTracks.map((track) => {
      const features = featuresMap.get(track.id);
      return {
        id: track.id,
        name: track.name,
        artist: (track.artists ?? []).map((a) => a.name).join(', '),
        album: track.album?.name ?? '',
        // Use smallest available image (Spotify returns sorted largest-first)
        albumArt:
          (
            track.album?.images?.[track.album.images.length - 1] ??
            track.album?.images?.[0]
          )?.url ?? null,
        durationMs: track.duration_ms,
        previewUrl: track.preview_url,
        spotifyUrl: track.external_urls?.spotify ?? '',
        bpm: features ? Math.round(features.tempo) : 0,
        key: features ? spotifyKeyToCamelot(features.key, features.mode) : '?',
        energy: features ? Math.round(features.energy * 10) : 0,
        popularity: track.popularity ?? 0,
      };
    });

    return NextResponse.json({ tracks: enriched });
  } catch (err: any) {
    console.error(
      '[spotify/playlists] Failed to fetch tracks:',
      err?.message,
      err?.stack,
    );
    return NextResponse.json(
      {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 },
    );
  }
}
