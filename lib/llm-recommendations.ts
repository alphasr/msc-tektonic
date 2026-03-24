// LLM-Enhanced Recommendations
// Adds context-aware scoring and natural language explanations to recommendations

import { getLLMService, LLMMessage } from './llm-service';
import { recommendTracks, TrackRecommendation } from './recommendations';
import { getManifest } from './storage';
import { Track } from '@/types';

export interface EnhancedRecommendation extends TrackRecommendation {
  explanation?: string;
  contextScore?: number;
  llmEnhanced?: boolean;
}

export interface RecommendationContext {
  currentTrackId: string;
  currentPosition?: number;
  userPreferences?: {
    genre?: string[];
    energyPreference?: 'low' | 'medium' | 'high' | 'building';
    mood?: string;
    style?: string;
  };
  recentTracks?: string[];
}

/**
 * Enhance recommendations with LLM context and explanations
 */
export async function enhanceRecommendationsWithLLM(
  recommendations: TrackRecommendation[],
  context: RecommendationContext
): Promise<EnhancedRecommendation[]> {
  const llmService = getLLMService();

  // If LLM is not available, return recommendations without enhancement
  if (!llmService.isAvailable()) {
    return recommendations.map((rec) => ({
      ...rec,
      llmEnhanced: false,
    }));
  }

  try {
    // Get current track metadata
    const currentManifest = await getManifest(context.currentTrackId);
    if (!currentManifest?.summary) {
      return recommendations.map((rec) => ({
        ...rec,
        llmEnhanced: false,
      }));
    }

    const currentTrack = {
      title: currentManifest.title || 'Unknown',
      artist: currentManifest.artist || 'Unknown',
      bpm: currentManifest.summary.tempo_bpm,
      key: currentManifest.summary.key,
      energy: currentManifest.summary.energy,
    };

    // Build context for LLM
    const contextDescription = buildContextDescription(currentTrack, context);

    // Enhance each recommendation
    const enhanced: EnhancedRecommendation[] = [];

    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < recommendations.length; i += batchSize) {
      const batch = recommendations.slice(i, i + batchSize);
      const batchEnhanced = await Promise.all(
        batch.map((rec) =>
          enhanceSingleRecommendation(
            rec,
            currentTrack,
            contextDescription,
            llmService
          )
        )
      );
      enhanced.push(...batchEnhanced);
    }

    return enhanced;
  } catch (error) {
    console.error('Error enhancing recommendations with LLM:', error);
    // Fallback to original recommendations
    return recommendations.map((rec) => ({
      ...rec,
      llmEnhanced: false,
    }));
  }
}

async function enhanceSingleRecommendation(
  recommendation: TrackRecommendation,
  currentTrack: {
    title: string;
    artist: string;
    bpm: number;
    key: string;
    energy: number;
  },
  contextDescription: string,
  llmService: ReturnType<typeof getLLMService>
): Promise<EnhancedRecommendation> {
  try {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are an expert DJ assistant. Analyze track recommendations and provide:
1. A brief explanation (1-2 sentences) of why this track works well
2. A context score (0-1) considering musical flow, energy progression, and mixing style
3. Focus on harmonic compatibility, tempo matching, energy transitions, and musical coherence.

Be concise and technical but accessible.`,
      },
      {
        role: 'user',
        content: `Current track: "${currentTrack.title}" by ${
          currentTrack.artist
        }
- BPM: ${currentTrack.bpm}
- Key: ${currentTrack.key}
- Energy: ${currentTrack.energy}/10

Recommended track: "${recommendation.track.title}" by ${
          recommendation.track.artist
        }
- BPM: ${recommendation.track.bpm}
- Key: ${recommendation.track.key}
- Energy: ${recommendation.track.energy}/10
- Compatibility scores:
  * Harmonic: ${recommendation.scores.harmonic.toFixed(2)}
  * Tempo: ${recommendation.scores.tempo.toFixed(2)}
  * Energy: ${recommendation.scores.energy.toFixed(2)}
  * Texture: ${recommendation.scores.texture.toFixed(2)}
  * Overall: ${recommendation.score.toFixed(2)}

Context: ${contextDescription}

Provide:
1. Explanation: [brief explanation]
2. Context Score: [0.0-1.0]`,
      },
    ];

    const response = await llmService.chat(messages);
    const content = response.content;

    // Parse response
    const explanationMatch = content.match(/Explanation:\s*(.+?)(?:\n|$)/i);
    const scoreMatch = content.match(/Context Score:\s*([0-9.]+)/i);

    const explanation =
      explanationMatch?.[1]?.trim() ||
      `Compatible track with ${
        recommendation.scores.harmonic > 0.7 ? 'strong harmonic' : 'good'
      } match and ${
        recommendation.scores.energy > 0.7
          ? 'smooth energy'
          : 'complementary energy'
      } transition.`;

    const contextScore = scoreMatch?.[1]
      ? parseFloat(scoreMatch[1])
      : recommendation.score;

    return {
      ...recommendation,
      explanation,
      contextScore,
      llmEnhanced: true,
    };
  } catch (error) {
    console.error('Error enhancing single recommendation:', error);
    return {
      ...recommendation,
      llmEnhanced: false,
    };
  }
}

function buildContextDescription(
  currentTrack: {
    title: string;
    artist: string;
    bpm: number;
    key: string;
    energy: number;
  },
  context: RecommendationContext
): string {
  let description = `Currently playing "${currentTrack.title}" by ${currentTrack.artist} at ${currentTrack.bpm} BPM in key ${currentTrack.key} with energy level ${currentTrack.energy}/10.`;

  if (context.currentPosition !== undefined) {
    description += ` Position in track: ${Math.floor(
      context.currentPosition
    )}s.`;
  }

  if (context.userPreferences) {
    const prefs = context.userPreferences;
    if (prefs.energyPreference) {
      description += ` User prefers ${prefs.energyPreference} energy tracks.`;
    }
    if (prefs.genre && prefs.genre.length > 0) {
      description += ` Preferred genres: ${prefs.genre.join(', ')}.`;
    }
    if (prefs.mood) {
      description += ` Desired mood: ${prefs.mood}.`;
    }
  }

  return description;
}

/**
 * Get LLM-enhanced recommendations with fallback to standard algorithm
 */
export async function getEnhancedRecommendations(
  sourceTrackId: string,
  context: RecommendationContext,
  options: {
    limit?: number;
    minScore?: number;
    excludeTrackIds?: string[];
    useLLM?: boolean;
  } = {}
): Promise<EnhancedRecommendation[]> {
  const { useLLM = true, ...recOptions } = options;

  // Get base recommendations
  const baseRecommendations = await recommendTracks(sourceTrackId, recOptions);

  // Enhance with LLM if requested and available
  if (useLLM) {
    try {
      return await enhanceRecommendationsWithLLM(baseRecommendations, context);
    } catch (error) {
      console.error(
        'LLM enhancement failed, using base recommendations:',
        error
      );
      return baseRecommendations.map((rec) => ({
        ...rec,
        llmEnhanced: false,
      }));
    }
  }

  return baseRecommendations.map((rec) => ({
    ...rec,
    llmEnhanced: false,
  }));
}
