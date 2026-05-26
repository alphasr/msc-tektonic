// API endpoint for real-time segment suggestions
import { NextRequest, NextResponse } from 'next/server';
import { searchSimilar } from '@/lib/candidates';
import { getManifest } from '@/lib/storage';
import { SegmentSuggestion } from '@/types';
import { loadFeatures, keyScore as calcKeyScore } from '@/lib/analysis';
import { frequencyCompatibilityScore } from '@/lib/frequency-analysis';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const trackId = searchParams.get('trackId');
    const position = parseFloat(searchParams.get('position') || '0');
    const scope = (searchParams.get('scope') || 'phrase') as 'bar' | 'phrase';
    const limit = parseInt(searchParams.get('limit') || '15');
    const minScore = parseFloat(searchParams.get('minScore') || '0.5');
    const strictKey = searchParams.get('strictKey') === 'true';
    const trackIdStr = trackId || undefined;
    const excludeTrackId = searchParams.get('excludeTrackId') || trackIdStr; // Exclude current track by default
    const targetTrackId = searchParams.get('targetTrackId'); // Explicit target track

    if (!trackId) {
      return NextResponse.json(
        { error: 'trackId is required' },
        { status: 400 },
      );
    }

    // Get current track manifest for metadata
    const currentManifest = await getManifest(trackId);
    if (!currentManifest?.summary) {
      return NextResponse.json(
        { error: 'Current track not found or not analyzed' },
        { status: 404 },
      );
    }

    const currentSummary = currentManifest.summary;
    const currentFeatures = await loadFeatures(trackId);

    // Search for similar segments across all tracks in library
    // Exclude only the currently playing track
    const similarSegments = await searchSimilar(
      trackId,
      position,
      scope,
      targetTrackId ? 500 : limit * 2, // get a lot if filtering by target
      excludeTrackId,
    );

    // Build segment suggestions with full metadata
    const suggestions: SegmentSuggestion[] = [];

    for (const segment of similarSegments) {
      // If a specific target track was requested, filter out everything else
      if (targetTrackId && segment.track_id !== targetTrackId) continue;

      if (segment.score < minScore) continue;

      const trackManifest = await getManifest(segment.track_id);
      if (!trackManifest?.summary) continue;

      const trackSummary = trackManifest.summary;
      const trackFeatures = await loadFeatures(segment.track_id);

      // Calculate segment duration (default to phrase length)
      const segmentDuration =
        scope === 'phrase'
          ? trackSummary.duration / trackSummary.phrases
          : (trackSummary.duration / trackSummary.bars) * 4; // 4 bars

      // Calculate end time
      const endTime = Math.min(
        segment.position + segmentDuration,
        trackSummary.duration,
      );

      // Calculate compatibility scores
      const actualKeyScore = calcKeyScore(currentSummary.key, trackSummary.key);
      const keyScore = actualKeyScore;

      if (strictKey && keyScore < 0.5) continue; // Skip incompatible keys when strict Mode is on
      const tempoScore =
        Math.abs(trackSummary.tempo_bpm - currentSummary.tempo_bpm) <= 10
          ? 1.0
          : 0.5;
      const energyScore =
        1 - Math.abs(trackSummary.energy - currentSummary.energy) / 10;

      // Frequency compatibility
      let frequencyScore = 0.5;
      if (
        currentFeatures.phraseFrequencies &&
        trackFeatures.phraseFrequencies
      ) {
        const currentPhraseIndex = Math.floor(
          (position / currentSummary.duration) *
            currentFeatures.phraseFrequencies.length,
        );
        const segmentPhraseIndex = Math.floor(
          (segment.position / trackSummary.duration) *
            trackFeatures.phraseFrequencies.length,
        );

        const currentFreq =
          currentFeatures.phraseFrequencies[currentPhraseIndex]?.profile;
        const segmentFreq =
          trackFeatures.phraseFrequencies[segmentPhraseIndex]?.profile;

        if (currentFreq && segmentFreq) {
          frequencyScore = frequencyCompatibilityScore(
            currentFreq,
            segmentFreq,
          );
        }
      }

      // Timing score (prefer segments that start at phrase boundaries)
      const timingScore = 0.7; // Default, could be enhanced

      // Contour similarity (already in segment.score)
      const contourScore = segment.score;

      // Overall score (algorithmic baseline)
      const algorithmicScore =
        0.25 * keyScore +
        0.2 * tempoScore +
        0.15 * energyScore +
        0.15 * frequencyScore +
        0.1 * timingScore +
        0.15 * contourScore;

      // ML score will be added client-side via LLM enrichment
      // For now, use algorithmic score as baseline
      const overallScore = algorithmicScore;

      if (overallScore >= minScore) {
        // Extract waveform segment if available
        let waveformSegment: number[] | undefined;
        if (trackFeatures.waveform && trackFeatures.waveform.length > 0) {
          const waveformStart = Math.floor(
            (segment.position / trackSummary.duration) *
              trackFeatures.waveform.length,
          );
          const waveformEnd = Math.floor(
            (endTime / trackSummary.duration) * trackFeatures.waveform.length,
          );
          waveformSegment = trackFeatures.waveform.slice(
            waveformStart,
            waveformEnd,
          );
        }

        suggestions.push({
          trackId: segment.track_id,
          trackTitle: trackManifest.title || 'Unknown',
          trackArtist: trackManifest.artist || 'Unknown',
          position: segment.position,
          duration: endTime - segment.position,
          score: overallScore,
          scores: {
            key: keyScore,
            tempo: tempoScore,
            energy: energyScore,
            frequency: frequencyScore,
            timing: timingScore,
            contour: contourScore,
          },
          waveform: waveformSegment,
        });
      }
    }

    // Sort by score and limit results
    suggestions.sort((a, b) => b.score - a.score);
    const limitedSuggestions = suggestions.slice(0, limit);

    return NextResponse.json({
      suggestions: limitedSuggestions,
      currentTrack: {
        id: trackId,
        title: currentManifest.title,
        artist: currentManifest.artist,
        position,
      },
    });
  } catch (error: any) {
    console.error('Error fetching segment suggestions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch segment suggestions' },
      { status: 500 },
    );
  }
}
