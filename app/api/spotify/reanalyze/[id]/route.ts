import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import {
  getManifest,
  saveManifest,
  getFeaturesDir,
  TrackSummary,
} from '@/lib/storage';
import {
  getAudioAnalysis,
  audioAnalysisToSummary,
  getAudioFeatures,
  audioFeaturesToSummary,
  refreshAccessToken,
} from '@/lib/spotify';

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
 * POST /api/spotify/reanalyze/[id]
 * Re-fetches Spotify audio analysis for an already-imported track by its internal track_id.
 * Extracts the Spotify track ID from the manifest's spotify_url or content_digest field.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: track_id } = await params;

  const token = await getValidToken();
  if (!token) {
    return NextResponse.json(
      { error: 'Not authenticated with Spotify' },
      { status: 401 },
    );
  }

  const manifest = await getManifest(track_id);
  if (!manifest) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 });
  }

  // Extract Spotify track ID from spotify_url or content_digest
  let spotifyId: string | null = null;

  if (manifest.spotify_url) {
    // e.g. "https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P"
    const m = manifest.spotify_url.match(/track\/([A-Za-z0-9]+)/);
    if (m) spotifyId = m[1];
  }

  if (!spotifyId && manifest.content_digest?.startsWith('spotify_')) {
    spotifyId = manifest.content_digest.replace('spotify_', '');
  }

  if (!spotifyId) {
    return NextResponse.json(
      { error: 'Cannot determine Spotify track ID from manifest' },
      { status: 422 },
    );
  }

  const analysis = await getAudioAnalysis(token, spotifyId);

  let summary: TrackSummary | undefined;
  let waveform: number[] | undefined;

  if (analysis) {
    ({ summary, waveform } = audioAnalysisToSummary(analysis));
  } else {
    // /audio-analysis is deprecated — try /audio-features
    const featuresArr = await getAudioFeatures(token, [spotifyId]);
    const features = featuresArr[0] ?? null;
    if (features) {
      ({ summary, waveform } = audioFeaturesToSummary(features));
    } else {
      // Both Spotify audio endpoints are unavailable (fully deprecated).
      // Stage 4: fetch basic track metadata for duration and preview URL
      const SAMPLES = 200;
      let durationSec = manifest.summary?.duration ?? 0;
      let previewUrl: string | null = manifest.spotify_preview_url ?? null;
      try {
        const trackRes = await fetch(
          `https://api.spotify.com/v1/tracks/${spotifyId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (trackRes.ok) {
          const trackData = await trackRes.json();
          durationSec = (trackData.duration_ms ?? 0) / 1000 || durationSec;
          previewUrl = (trackData.preview_url as string | null) ?? previewUrl;
        }
      } catch {
        // ignore
      }

      // Stage 5: analyse the 30-second preview clip for real BPM / key / energy
      if (previewUrl) {
        try {
          const { analyzePreviewUrl } = await import('@/lib/preview-analyzer');
          const pa = await analyzePreviewUrl(previewUrl);
          if (pa) {
            summary = {
              tempo_bpm: pa.tempo_bpm,
              key: pa.key,
              energy: pa.energy,
              duration: durationSec,
              phrases: 0,
              bars: 0,
            };
            // Flat waveform approximation from the detected energy level
            waveform = new Array<number>(SAMPLES).fill(pa.energy / 10);
          }
        } catch {
          // Preview analysis failed — fall through to stub
        }
      }

      if (!summary) {
        // No analysis data obtainable — keep the existing summary rather than
        // overwriting it with a stub.
        if (manifest.summary) {
          manifest.updated_at = new Date().toISOString();
          await saveManifest(manifest);
          return NextResponse.json({
            success: true,
            summary: manifest.summary,
            warning:
              'Spotify audio endpoints are unavailable and preview analysis failed; existing summary retained',
          });
        }

        // Stage 6: stub fallback when no analysis data is available
        summary = {
          tempo_bpm: 0,
          key: '?',
          energy: 0,
          duration: durationSec,
          phrases: 0,
          bars: 0,
        };
        waveform = new Array<number>(SAMPLES).fill(0);
      }
    }
  }

  // Persist waveform
  const featDir = getFeaturesDir(track_id);
  await fs.mkdir(featDir, { recursive: true });
  await fs.writeFile(
    path.join(featDir, 'waveform.json'),
    JSON.stringify(waveform ?? []),
    'utf-8',
  );

  // Update manifest
  manifest.summary = summary!;
  manifest.updated_at = new Date().toISOString();
  await saveManifest(manifest);

  return NextResponse.json({ success: true, summary: summary! });
}
