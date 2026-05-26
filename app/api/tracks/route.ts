import { NextResponse } from 'next/server';
import { loadManifests } from '@/lib/storage';
import { Track } from '@/types';

export async function GET() {
  try {
    const manifests = await loadManifests();
    console.log('Loaded manifests:', Object.keys(manifests).length);

    // Convert to array and format as Track objects for frontend
    const allManifests = Object.values(manifests);
    const readyManifests = allManifests.filter(
      (manifest) => manifest.status === 'ready' && manifest.summary
    );
    console.log('Ready manifests:', readyManifests.length);

    const tracks: Track[] = await Promise.all(
      readyManifests.map(async (manifest) => {
        // Load real waveform from features
        let waveform: number[] = [];
        try {
          const { loadFeatures } = await import('@/lib/analysis');
          const features = await loadFeatures(manifest.track_id);
          if (features.waveform && features.waveform.length > 0) {
            waveform = features.waveform;
          } else {
            // If waveform not available, try to generate from audio file
            // For now, return empty array - waveform will be generated during analysis
            waveform = [];
          }
        } catch (error) {
          // If features not loaded, return empty - will be generated
          waveform = [];
        }

        return {
          id: manifest.track_id,
          title: manifest.title || 'Unknown',
          artist: manifest.artist || 'Unknown',
          bpm: manifest.summary!.tempo_bpm,
          key: manifest.summary!.key,
          energy: manifest.summary!.energy,
          duration: manifest.summary!.duration,
          tags: manifest.source === 'spotify' ? ['spotify'] : [],
          phrases: manifest.summary!.phrases,
          audioUrl: manifest.spotify_preview_url,
          waveform,
        };
      })
    );

    console.log('Returning tracks:', tracks.length);
    return NextResponse.json(tracks);
  } catch (error) {
    console.error('Failed to load tracks:', error);
    return NextResponse.json(
      {
        error: 'Failed to load tracks',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
