// Spotify Web API helper — token management and typed API wrappers

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;

export const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
].join(' ');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix ms
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifySimplifiedPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  tracks: { total: number };
  owner: { display_name: string };
  public: boolean | null;
}

export interface SpotifySimplifiedArtist {
  id: string;
  name: string;
  uri: string;
  href: string;
  external_urls: { spotify: string };
}

export interface SpotifySimplifiedAlbum {
  id: string;
  name: string;
  uri: string;
  href: string;
  images: SpotifyImage[]; // widest first per schema
  release_date: string;
  album_type: 'album' | 'single' | 'compilation';
  external_urls: { spotify: string };
}

export interface SpotifyTrackItem {
  id: string;
  name: string;
  type: 'track';
  uri: string;
  href: string;
  artists: SpotifySimplifiedArtist[];
  album: SpotifySimplifiedAlbum;
  duration_ms: number;
  explicit: boolean;
  is_local: boolean;
  external_urls: { spotify: string };
  /** @deprecated */
  preview_url: string | null;
  /** @deprecated */
  popularity: number;
}

export interface SpotifyAudioFeatures {
  id: string;
  tempo: number;          // BPM
  key: number;            // Pitch class 0-11
  mode: number;           // 0=minor, 1=major
  energy: number;         // 0-1
  danceability: number;   // 0-1
  valence: number;        // 0-1
  duration_ms: number;
  time_signature: number;
}

export interface SpotifyPlaylistTrack {
  // Schema: `item` is current; `track` is deprecated: true
  item: SpotifyTrackItem | null;
  /** @deprecated use `item` */
  track?: SpotifyTrackItem | null;
  added_at: string;
}

// ─── Camelot wheel key mapping ───────────────────────────────────────────────

const CAMELOT_MAP: Record<string, string> = {
  '0_1': '8B', '1_1': '3B', '2_1': '10B', '3_1': '5B',
  '4_1': '12B', '5_1': '7B', '6_1': '2B', '7_1': '9B',
  '8_1': '4B', '9_1': '11B', '10_1': '6B', '11_1': '1B',
  '0_0': '5A', '1_0': '12A', '2_0': '7A', '3_0': '2A',
  '4_0': '9A', '5_0': '4A', '6_0': '11A', '7_0': '6A',
  '8_0': '1A', '9_0': '8A', '10_0': '3A', '11_0': '10A',
};

export function spotifyKeyToCamelot(key: number, mode: number): string {
  return CAMELOT_MAP[`${key}_${mode}`] || '?';
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export function getSpotifyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: 'false',
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token exchange failed: ${err}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token refresh failed: ${err}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

// ─── API wrappers ─────────────────────────────────────────────────────────────

async function spotifyFetch(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify API error ${res.status}: ${err}`);
  }
  return res.json();
}

// spotifyFetch variant that returns null on non-critical errors (e.g. 403 deprecated endpoints)
async function spotifyFetchOptional(path: string, accessToken: string): Promise<any | null> {
  try {
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 403 || res.status === 404) return null;
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Spotify API error ${res.status}: ${err}`);
    }
    return res.json();
  } catch {
    return null;
  }
}

export async function getUserPlaylists(
  accessToken: string
): Promise<SpotifySimplifiedPlaylist[]> {
  const playlists: SpotifySimplifiedPlaylist[] = [];
  let url: string | null = '/me/playlists?limit=50';

  while (url) {
    const data = await spotifyFetch(url, accessToken);
    // Normalize: newer Spotify API returns `items: { href, total }` instead of `tracks: { total }`
    playlists.push(...data.items.map((p: any) => ({
      ...p,
      tracks: p.tracks ?? p.items ?? { total: 0 },
    })));
    // Handle full next URL vs relative path
    url = data.next
      ? data.next.replace('https://api.spotify.com/v1', '')
      : null;
  }

  return playlists;
}

// Step 1: get track IDs from the playlist.
// - /tracks endpoint is deprecated (403 for new apps) → use /items (limit max = 50 per docs)
// - Spotify docs: response uses `item` field (not the deprecated `track` field)
// - No `fields` param: the nested fields spec on the track|episode union causes 403
// - No `additional_types`: omitting it means only tracks are returned by default
export async function getPlaylistTrackIds(
  accessToken: string,
  playlistId: string
): Promise<string[]> {
  const ids: string[] = [];
  let url: string | null = `/playlists/${playlistId}/items?limit=50`;

  while (url) {
    const data = await spotifyFetch(url, accessToken);
    const rawItems: any[] = data.items ?? [];
    if (rawItems.length > 0) {
      // Log first item shape once for debugging
      const sample = rawItems[0];
      console.log('[getPlaylistTrackIds] sample item keys:', sample ? Object.keys(sample) : 'null');
      if (sample) console.log('[getPlaylistTrackIds] item field:', !!sample.item, 'track field:', !!sample.track);
    }
    for (const raw of rawItems) {
      if (!raw) continue; // null = removed/unavailable track slot
      // New API: `item` field; deprecated API: `track` field
      const t = raw.item ?? raw.track;
      if (t?.id && t?.type !== 'episode') {
        ids.push(t.id);
      }
    }
    url = data.next
      ? data.next.replace('https://api.spotify.com/v1', '')
      : null;
  }

  return ids;
}

// Step 2: fetch full track objects by ID using GET /tracks (max 50 per request).
// This is the recommended approach per Spotify docs for getting complete track data.
export async function getTracksById(
  accessToken: string,
  trackIds: string[]
): Promise<SpotifyTrackItem[]> {
  const tracks: SpotifyTrackItem[] = [];

  for (let i = 0; i < trackIds.length; i += 50) {
    const chunk = trackIds.slice(i, i + 50);
    const data = await spotifyFetch(`/tracks?ids=${chunk.join(',')}`, accessToken);
    if (data?.tracks) {
      tracks.push(...data.tracks.filter(Boolean));
    }
  }

  return tracks;
}

// Convenience wrapper — kept for callers that expect SpotifyPlaylistTrack[].
export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<SpotifyPlaylistTrack[]> {
  const ids = await getPlaylistTrackIds(accessToken, playlistId);
  const tracks = await getTracksById(accessToken, ids);
  return tracks.map((t) => ({ item: t, added_at: '' }));
}

// NOTE: /audio-features was deprecated by Spotify in Nov 2024.
// New apps get a 403 — we return an empty array gracefully so playlist tracks
// still load without BPM/key data.
export async function getAudioFeatures(
  accessToken: string,
  trackIds: string[]
): Promise<SpotifyAudioFeatures[]> {
  const features: SpotifyAudioFeatures[] = [];

  for (let i = 0; i < trackIds.length; i += 100) {
    const chunk = trackIds.slice(i, i + 100);
    const data = await spotifyFetchOptional(
      `/audio-features?ids=${chunk.join(',')}`,
      accessToken
    );
    if (data?.audio_features) {
      features.push(...data.audio_features.filter(Boolean));
    }
  }

  return features;
}

// ─── Config check ─────────────────────────────────────────────────────────────

export function isSpotifyConfigured(): boolean {
  return !!(
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET &&
    process.env.SPOTIFY_REDIRECT_URI
  );
}
