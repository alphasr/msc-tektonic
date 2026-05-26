import { NextRequest, NextResponse } from 'next/server';
import {
  initStorage,
  saveFile,
  saveManifest,
  generateTrackId,
  calculateDigest,
  getManifest,
} from '@/lib/storage';
import { analyzeQueue } from '@/lib/queue';

// Register the analysis worker handler
initStorage();
import '@/lib/worker';

export interface ImportTrack {
  id: string;           // Spotify track ID
  name: string;
  artist: string;
  previewUrl: string | null;
  bpm: number;          // 0 if unavailable
  key: string;          // '?' if unavailable
  energy: number;       // 0-10 scaled
  durationMs: number;
}

export interface ImportResult {
  spotify_id: string;
  track_id: string | null;
  status: 'queued' | 'ready' | 'skipped' | 'error';
  reason?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tracks: ImportTrack[] = body.tracks;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks provided' }, { status: 400 });
    }

    const results: ImportResult[] = await Promise.all(
      tracks.map((track) => importTrack(track))
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

async function importTrack(track: ImportTrack): Promise<ImportResult> {
  try {
    if (track.previewUrl) {
      return await importWithPreview(track);
    } else {
      return await importMetadataOnly(track);
    }
  } catch (err: any) {
    console.error(`[spotify/import] Failed for ${track.id}:`, err);
    return { spotify_id: track.id, track_id: null, status: 'error', reason: err.message };
  }
}

async function importWithPreview(track: ImportTrack): Promise<ImportResult> {
  // Download the 30s preview MP3 from Spotify's CDN (server-to-CDN, no CORS)
  const res = await fetch(track.previewUrl!);
  if (!res.ok) {
    throw new Error(`Failed to download preview (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  const contentDigest = calculateDigest(buffer);
  const track_id = generateTrackId(track.artist, track.name, buffer.byteLength, contentDigest);

  // Deduplicate — use getManifest directly to handle spotify metadata-only entries too
  const existing = await getManifest(track_id);
  if (existing) {
    return { spotify_id: track.id, track_id, status: 'skipped', reason: 'already imported' };
  }

  const filePath = await saveFile(track_id, buffer, 'mp3');

  const manifest = {
    track_id,
    status: 'queued' as const,
    artist: track.artist,
    title: track.name,
    file_size: buffer.byteLength,
    file_path: filePath,
    content_digest: contentDigest,
    source: 'spotify' as const,
    spotify_preview_url: track.previewUrl!,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await saveManifest(manifest);
  await analyzeQueue.publish('analyze', { track_id, path: filePath });

  return { spotify_id: track.id, track_id, status: 'queued' };
}

async function importMetadataOnly(track: ImportTrack): Promise<ImportResult> {
  // No audio — create a manifest directly using Spotify metadata as analysis summary
  const contentDigest = `spotify_${track.id}`;
  const track_id = generateTrackId(track.artist, track.name, track.durationMs, contentDigest);

  const existing = await getManifest(track_id);
  if (existing) {
    return { spotify_id: track.id, track_id, status: 'skipped', reason: 'already imported' };
  }

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
    summary: {
      tempo_bpm: track.bpm || 0,
      key: track.key === '?' ? '?' : track.key,
      energy: track.energy || 0,
      duration: Math.round(track.durationMs / 1000),
      phrases: 0,
      bars: 0,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await saveManifest(manifest);

  return { spotify_id: track.id, track_id, status: 'ready' };
}
