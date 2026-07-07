// Spotify Web API helper — token management and typed API wrappers

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;

export const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
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
  tempo: number; // BPM
  key: number; // Pitch class 0-11
  mode: number; // 0=minor, 1=major
  energy: number; // 0-1
  danceability: number; // 0-1
  valence: number; // 0-1
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
  '0_1': '8B',
  '1_1': '3B',
  '2_1': '10B',
  '3_1': '5B',
  '4_1': '12B',
  '5_1': '7B',
  '6_1': '2B',
  '7_1': '9B',
  '8_1': '4B',
  '9_1': '11B',
  '10_1': '6B',
  '11_1': '1B',
  '0_0': '5A',
  '1_0': '12A',
  '2_0': '7A',
  '3_0': '2A',
  '4_0': '9A',
  '5_0': '4A',
  '6_0': '11A',
  '7_0': '6A',
  '8_0': '1A',
  '9_0': '8A',
  '10_0': '3A',
  '11_0': '10A',
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

export async function exchangeCodeForTokens(
  code: string,
): Promise<SpotifyTokens> {
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

export async function refreshAccessToken(
  refreshToken: string,
): Promise<SpotifyTokens> {
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
async function spotifyFetchOptional(
  path: string,
  accessToken: string,
): Promise<any | null> {
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

// ─── Audio Analysis ───────────────────────────────────────────────────────────

export interface SpotifyAudioAnalysisSegment {
  start: number;
  duration: number;
  confidence: number;
  loudness_start: number;
  loudness_max: number;
  loudness_max_time: number;
  loudness_end: number;
  pitches: number[];
  timbre: number[];
}

export interface SpotifyAudioAnalysis {
  track: {
    duration: number;
    tempo: number;
    tempo_confidence: number;
    key: number; // 0-11; -1 = no key detected
    mode: number; // 0=minor, 1=major
    mode_confidence: number;
    key_confidence: number;
    loudness: number; // dB, typically -60..0
    end_of_fade_in: number;
    start_of_fade_out: number;
    time_signature: number;
    time_signature_confidence: number;
  };
  bars: Array<{ start: number; duration: number; confidence: number }>;
  beats: Array<{ start: number; duration: number; confidence: number }>;
  sections: Array<{
    start: number;
    duration: number;
    confidence: number;
    loudness: number;
    tempo: number;
    key: number;
    mode: number;
    time_signature: number;
  }>;
  segments: SpotifyAudioAnalysisSegment[];
  tatums: Array<{ start: number; duration: number; confidence: number }>;
}

/** GET /audio-analysis/{id}. Returns null on 403/404 (deprecated for some app tiers). */
export async function getAudioAnalysis(
  accessToken: string,
  trackId: string,
): Promise<SpotifyAudioAnalysis | null> {
  return spotifyFetchOptional(`/audio-analysis/${trackId}`, accessToken);
}

/**
 * Build a minimal track summary and flat waveform from audio features.
 * Used as a fallback when /audio-analysis is unavailable.
 */
export function audioFeaturesToSummary(features: SpotifyAudioFeatures): {
  summary: {
    tempo_bpm: number;
    key: string;
    energy: number;
    duration: number;
    phrases: number;
    bars: number;
  };
  waveform: number[];
} {
  const key =
    features.key >= 0 ? spotifyKeyToCamelot(features.key, features.mode) : '?';
  const energy = Math.max(0, Math.min(10, features.energy * 10));
  const SAMPLES = 200;
  const waveform = new Array<number>(SAMPLES).fill(
    Math.max(0, Math.min(1, features.energy)),
  );
  return {
    summary: {
      tempo_bpm: Math.round(features.tempo),
      key,
      energy,
      duration: features.duration_ms / 1000,
      phrases: 0,
      bars: 0,
    },
    waveform,
  };
}

/**
 * Convert a SpotifyAudioAnalysis into a track summary and 200-sample waveform.
 * Waveform is derived from segment loudness_max values (0-1 normalised amplitude).
 */
export function audioAnalysisToSummary(analysis: SpotifyAudioAnalysis): {
  summary: {
    tempo_bpm: number;
    key: string;
    energy: number;
    duration: number;
    phrases: number;
    bars: number;
  };
  waveform: number[];
} {
  const { track, bars, sections, segments } = analysis;

  const key = track.key >= 0 ? spotifyKeyToCamelot(track.key, track.mode) : '?';
  // Map overall loudness dB (-60..0) → 0-10 energy scale
  const energy = Math.max(0, Math.min(10, ((track.loudness + 60) / 60) * 10));

  // Build 200-sample waveform from per-segment loudness_max
  const SAMPLES = 200;
  const waveform = new Array<number>(SAMPLES).fill(0);
  if (segments.length > 0 && track.duration > 0) {
    for (const seg of segments) {
      const idx = Math.floor((seg.start / track.duration) * SAMPLES);
      if (idx >= 0 && idx < SAMPLES) {
        const amp = Math.max(0, (seg.loudness_max + 60) / 60);
        waveform[idx] = Math.max(waveform[idx], amp);
      }
    }
    const maxAmp = Math.max(...waveform, 0.01);
    for (let i = 0; i < SAMPLES; i++) waveform[i] = waveform[i] / maxAmp;
  }

  return {
    summary: {
      tempo_bpm: Math.round(track.tempo),
      key,
      energy: Math.round(energy * 10) / 10,
      duration: track.duration,
      phrases: sections.length,
      bars: bars.length,
    },
    waveform,
  };
}

export async function getUserPlaylists(
  accessToken: string,
): Promise<SpotifySimplifiedPlaylist[]> {
  const playlists: SpotifySimplifiedPlaylist[] = [];
  let url: string | null = '/me/playlists?limit=50';

  while (url) {
    const data = await spotifyFetch(url, accessToken);
    // Normalize: newer Spotify API returns `items: { href, total }` instead of `tracks: { total }`
    playlists.push(
      ...data.items.map((p: any) => ({
        ...p,
        tracks: p.tracks ?? p.items ?? { total: 0 },
      })),
    );
    // Handle full next URL vs relative path
    url = data.next
      ? data.next.replace('https://api.spotify.com/v1', '')
      : null;
  }

  return playlists;
}

// Fetch full track objects directly from GET /playlists/{id}/items (limit 50 per page).
// - Each PlaylistTrackObject already contains the full TrackObject in the `item` field
//   (or the deprecated `track` field) per the Spotify OpenAPI schema — no second call needed.
// - Avoids the deprecated GET /tracks endpoint (new apps get 403, same as /audio-features).
// - No `fields` param: the nested union spec causes 403 on some app tiers.
// - No `additional_types`: default behaviour returns only tracks; episodes are filtered below.
export async function getPlaylistTracksFromItems(
  accessToken: string,
  playlistId: string,
): Promise<SpotifyTrackItem[]> {
  const tracks: SpotifyTrackItem[] = [];
  let url: string | null = `/playlists/${playlistId}/items?limit=50`;

  while (url) {
    const data = await spotifyFetch(url, accessToken);
    const rawItems: any[] = data.items ?? [];

    for (const raw of rawItems) {
      if (!raw) continue; // null slot = track removed from Spotify
      // `item` is the current field; `track` is the deprecated alias — both hold TrackObject
      const t = raw.item ?? raw.track;
      if (t?.id && t?.type === 'track') {
        tracks.push(t as SpotifyTrackItem);
      }
    }

    url = data.next
      ? data.next.replace('https://api.spotify.com/v1', '')
      : null;
  }

  return tracks;
}

// Convenience wrapper — kept for callers that expect SpotifyPlaylistTrack[].
export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string,
): Promise<SpotifyPlaylistTrack[]> {
  const tracks = await getPlaylistTracksFromItems(accessToken, playlistId);
  return tracks.map((t) => ({ item: t, added_at: '' }));
}

// NOTE: /audio-features was deprecated by Spotify in Nov 2024.
// New apps get a 403 — we return an empty array gracefully so playlist tracks
// still load without BPM/key data.
export async function getAudioFeatures(
  accessToken: string,
  trackIds: string[],
): Promise<SpotifyAudioFeatures[]> {
  const features: SpotifyAudioFeatures[] = [];

  for (let i = 0; i < trackIds.length; i += 100) {
    const chunk = trackIds.slice(i, i + 100);
    const data = await spotifyFetchOptional(
      `/audio-features?ids=${chunk.join(',')}`,
      accessToken,
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
