// LLM-Powered Track Tagging
// Generates genre, mood, and style tags for tracks

import { getLLMService, LLMMessage, extractJSONFromLLMResponse } from './llm-service';
import { getManifest } from './storage';

export interface TrackTags {
  genres: string[];
  moods: string[];
  styles: string[];
  instruments?: string[];
  energyLevel?: 'low' | 'medium' | 'high';
  description?: string;
}

/**
 * Generate tags for a track using LLM
 */
export async function generateTrackTags(trackId: string): Promise<TrackTags> {
  const llmService = getLLMService();

  if (!llmService.isAvailable()) {
    return {
      genres: [],
      moods: [],
      styles: [],
    };
  }

  try {
    const manifest = await getManifest(trackId);
    if (!manifest?.summary) {
      throw new Error('Track manifest not found');
    }

    const summary = manifest.summary;
    const metadata = {
      title: manifest.title || 'Unknown',
      artist: manifest.artist || 'Unknown',
      bpm: summary.tempo_bpm,
      key: summary.key,
      energy: summary.energy,
      duration: summary.duration,
    };

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `Analyze a music track and generate tags.

Return JSON:
{
  "genres": ["genre1", "genre2"],
  "moods": ["mood1", "mood2"],
  "styles": ["style1", "style2"],
  "instruments": ["instrument1", "instrument2"] (optional),
  "energyLevel": "low" | "medium" | "high",
  "description": "brief description of the track"
}`,
      },
      {
        role: 'user',
        content: `Track: "${metadata.title}" by ${metadata.artist}
- BPM: ${metadata.bpm}
- Key: ${metadata.key}
- Energy: ${metadata.energy}/10
- Duration: ${Math.floor(metadata.duration)}s

Generate tags for this track.`,
      },
    ];

    const response = await llmService.chat(messages);
    const content = response.content;

    const jsonString = extractJSONFromLLMResponse(content);

    if (jsonString) {
      const parsed = JSON.parse(jsonString);
      return parsed as TrackTags;
    }

    // Fallback
    return {
      genres: [],
      moods: [],
      styles: [],
      energyLevel:
        metadata.energy < 4 ? 'low' : metadata.energy < 7 ? 'medium' : 'high',
    };
  } catch (error) {
    console.error('Error generating track tags:', error);
    return {
      genres: [],
      moods: [],
      styles: [],
    };
  }
}

/**
 * Batch generate tags for multiple tracks
 */
export async function batchGenerateTags(
  trackIds: string[]
): Promise<Map<string, TrackTags>> {
  const results = new Map<string, TrackTags>();

  // Process in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < trackIds.length; i += batchSize) {
    const batch = trackIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (trackId) => {
        try {
          const tags = await generateTrackTags(trackId);
          return { trackId, tags };
        } catch (error) {
          console.error(`Error generating tags for ${trackId}:`, error);
          return { trackId, tags: { genres: [], moods: [], styles: [] } };
        }
      })
    );

    batchResults.forEach(({ trackId, tags }) => {
      results.set(trackId, tags);
    });

    // Small delay between batches
    if (i + batchSize < trackIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
