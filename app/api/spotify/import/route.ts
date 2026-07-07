import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import {
  initStorage,
  saveFile,
  saveManifest,
  generateTrackId,
  calculateDigest,
  getManifest,
  getFeaturesDir,
} from '@/lib/storage';
import { getAudioAnalysis, audioAnalysisToSummary } from '@/lib/spotify';

// Register storage
initStorage();

export interface ImportTrack {
  id: string; // Spotify track ID
  name: string;
  artist: string;
  previewUrl: string | null;
  bpm: number; // 0 if unavailable
  key: string; // '?' if unavailable
  energy: number; // 0-10 scaled
  durationMs: number;
  albumArt: string | null;
  spotifyUrl: string;
}

export interface ImportResult {
  spotify_id: string;
  track_id: string | null;
  status: 'queued' | 'ready' | 'skipped' | 'error';
  reason?: string;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value ?? null;

    const body = await req.json();
    const tracks: ImportTrack[] = body.tracks;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { error: 'No tracks provided' },
        { status: 400 },
      );
    }

    const results: ImportResult[] = await Promise.all(
      tracks.map((track) => importTrack(track, accessToken)),
    );

    const queued = results.filter((r) => r.status === 'queued').length;
    const ready = results.filter((r) => r.status === 'ready').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const errored = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({ results, queued, ready, skipped, errored });
  } catch (err: any) {
    console.error('[spotify/import] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function importTrack(
  track: ImportTrack,
  accessToken: string | null,
): Promise<ImportResult> {
  try {
    if (track.previewUrl) {
      return await importWithPreview(track, accessToken);
    } else {
      return await importMetadataOnly(track, accessToken);
    }
  } catch (err: any) {
    console.error(`[spotify/import] Failed for ${track.id}:`, err);
    return {
      spotify_id: track.id,
      track_id: null,
      status: 'error',
      reason: err.message,
    };
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Calls getAudioAnalysis and returns a summary + waveform; falls back to metadata placeholders. */
async function fetchAnalysis(
  accessToken: string | null,
  spotifyId: string,
  fallbackBpm: number,
  fallbackKey: string,
  fallbackEnergy: number,
  durationMs: number,
): Promise<{
  summary: ReturnType<typeof audioAnalysisToSummary>['summary'];
  waveform: number[] | null;
}> {
  if (accessToken) {
    const analysis = await getAudioAnalysis(accessToken, spotifyId);
    if (analysis) {
      const result = audioAnalysisToSummary(analysis);
      return result;
    }
    console.warn(
      `[spotify/import] getAudioAnalysis returned null for ${spotifyId} (endpoint may be deprecated for this app tier)`,
    );
  }
  return {
    summary: {
      tempo_bpm: fallbackBpm || 0,
      key: fallbackKey || '?',
      energy: fallbackEnergy || 0,
      duration: Math.round(durationMs / 1000),
      phrases: 0,
      bars: 0,
    },
    waveform: null,
  };
}

/** Saves a waveform array to the features directory. No-op if waveform is null. */
async function saveAnalysisFiles(
  track_id: string,
  waveform: number[] | null,
): Promise<void> {
  if (!waveform) return;
  const featDir = getFeaturesDir(track_id);
  await fs.mkdir(featDir, { recursive: true });
  await fs.writeFile(
    path.join(featDir, 'waveform.json'),
    JSON.stringify(waveform),
    'utf-8',
  );
}

async function importWithPreview(
  track: ImportTrack,
  accessToken: string | null,
): Promise<ImportResult> {
  // Download the 30s preview MP3 from Spotify's CDN
  const res = await fetch(track.previewUrl!);
  if (!res.ok) {
    throw new Error(`Failed to download preview (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  const contentDigest = calculateDigest(buffer);
  const track_id = generateTrackId(
    track.artist,
    track.name,
    buffer.byteLength,
    contentDigest,
  );

  const existing = await getManifest(track_id);
  if (existing) {
    // Re-analyze if the stored analysis is just placeholder zeros
    const isStale =
      !existing.summary ||
      existing.summary.tempo_bpm === 0 ||
      existing.summary.key === '?';
    if (isStale && accessToken) {
      const { summary, waveform } = await fetchAnalysis(
        accessToken,
        track.id,
        track.bpm,
        track.key,
        track.energy,
        track.durationMs,
      );
      if (summary.tempo_bpm > 0 || summary.key !== '?') {
        await saveAnalysisFiles(track_id, waveform);
        existing.summary = summary;
        existing.album_art_url =
          existing.album_art_url ?? track.albumArt ?? undefined;
        existing.spotify_url =
          existing.spotify_url ?? (track.spotifyUrl || undefined);
        existing.updated_at = new Date().toISOString();
        await saveManifest(existing);
        return { spotify_id: track.id, track_id, status: 'ready' };
      }
    }
    return {
      spotify_id: track.id,
      track_id,
      status: 'skipped',
      reason: 'already imported',
    };
  }

  const filePath = await saveFile(track_id, buffer, 'mp3');

  const { summary, waveform } = await fetchAnalysis(
    accessToken,
    track.id,
    track.bpm,
    track.key,
    track.energy,
    track.durationMs,
  );
  await saveAnalysisFiles(track_id, waveform);

  const manifest = {
    track_id,
    status: 'ready' as const,
    artist: track.artist,
    title: track.name,
    file_size: buffer.byteLength,
    file_path: filePath,
    content_digest: contentDigest,
    source: 'spotify' as const,
    spotify_preview_url: track.previewUrl!,
    album_art_url: track.albumArt ?? undefined,
    spotify_url: track.spotifyUrl || undefined,
    summary,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await saveManifest(manifest);

  return { spotify_id: track.id, track_id, status: 'ready' };
}

async function importMetadataOnly(
  track: ImportTrack,
  accessToken: string | null,
): Promise<ImportResult> {
  // No audio — create a manifest using Spotify Audio Analysis API for real data
  const contentDigest = `spotify_${track.id}`;
  const track_id = generateTrackId(
    track.artist,
    track.name,
    track.durationMs,
    contentDigest,
  );

  const existing = await getManifest(track_id);
  if (existing) {
    // Re-analyze if the stored analysis is just placeholder zeros
    const isStale =
      !existing.summary ||
      existing.summary.tempo_bpm === 0 ||
      existing.summary.key === '?';
    if (isStale && accessToken) {
      const { summary, waveform } = await fetchAnalysis(
        accessToken,
        track.id,
        track.bpm,
        track.key,
        track.energy,
        track.durationMs,
      );
      if (summary.tempo_bpm > 0 || summary.key !== '?') {
        await saveAnalysisFiles(track_id, waveform);
        existing.summary = summary;
        existing.album_art_url =
          existing.album_art_url ?? track.albumArt ?? undefined;
        existing.spotify_url =
          existing.spotify_url ?? (track.spotifyUrl || undefined);
        existing.updated_at = new Date().toISOString();
        await saveManifest(existing);
        return { spotify_id: track.id, track_id, status: 'ready' };
      }
    }
    return {
      spotify_id: track.id,
      track_id,
      status: 'skipped',
      reason: 'already imported',
    };
  }

  const { summary, waveform } = await fetchAnalysis(
    accessToken,
    track.id,
    track.bpm,
    track.key,
    track.energy,
    track.durationMs,
  );
  await saveAnalysisFiles(track_id, waveform);

  const manifest = {
    track_id,
    status: 'ready' as const,
    artist: track.artist,
    title: track.name,
    file_size: 0,
    file_path: '',
    content_digest: contentDigest,
    source: 'spotify' as const,
    spotify_preview_url: undefined,
    album_art_url: track.albumArt ?? undefined,
    spotify_url: track.spotifyUrl || undefined,
    summary,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await saveManifest(manifest);

  return { spotify_id: track.id, track_id, status: 'ready' };
}
