// LLM Explanation Generator
// Generates human-readable explanations for recommendations and transitions

import { getLLMService, LLMMessage } from './llm-service';
import { TrackRecommendation } from './recommendations';
import { TransitionCandidate } from '@/types';

/**
 * Generate explanation for a track recommendation
 */
export async function explainRecommendation(
  recommendation: TrackRecommendation,
  currentTrack: {
    title: string;
    artist: string;
    bpm: number;
    key: string;
    energy: number;
  }
): Promise<string> {
  const llmService = getLLMService();

  if (!llmService.isAvailable()) {
    return generateBasicExplanation(recommendation, currentTrack);
  }

  try {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          'Generate a brief, technical explanation (1-2 sentences) for why a track is recommended for mixing.',
      },
      {
        role: 'user',
        content: `Current: "${currentTrack.title}" (${currentTrack.bpm} BPM, ${
          currentTrack.key
        }, Energy ${currentTrack.energy}/10)
Recommended: "${recommendation.track.title}" (${
          recommendation.track.bpm
        } BPM, ${recommendation.track.key}, Energy ${
          recommendation.track.energy
        }/10)
Scores: Harmonic ${recommendation.scores.harmonic.toFixed(
          2
        )}, Tempo ${recommendation.scores.tempo.toFixed(
          2
        )}, Energy ${recommendation.scores.energy.toFixed(2)}`,
      },
    ];

    const response = await llmService.chat(messages);
    return response.content.trim();
  } catch (error) {
    console.error('Error generating explanation:', error);
    return generateBasicExplanation(recommendation, currentTrack);
  }
}

function generateBasicExplanation(
  recommendation: TrackRecommendation,
  currentTrack: {
    title: string;
    artist: string;
    bpm: number;
    key: string;
    energy: number;
  }
): string {
  const parts: string[] = [];

  if (recommendation.scores.harmonic > 0.7) {
    parts.push('strong harmonic compatibility');
  }
  if (recommendation.scores.tempo > 0.7) {
    parts.push('good tempo match');
  }
  if (recommendation.scores.energy > 0.7) {
    parts.push('smooth energy transition');
  }

  if (parts.length === 0) {
    return 'Compatible track with good mixing potential.';
  }

  return `Recommended for ${parts.join(', ')}.`;
}

/**
 * Generate explanation for a transition point
 */
export async function explainTransition(
  candidate: TransitionCandidate,
  trackA: { title: string; artist: string },
  trackB: { title: string; artist: string }
): Promise<string> {
  const llmService = getLLMService();

  if (!llmService.isAvailable()) {
    return `Transition from "${trackA.title}" at ${Math.floor(
      candidate.from_position
    )}s to "${trackB.title}" at ${Math.floor(
      candidate.to_position
    )}s. Score: ${candidate.score.toFixed(2)}`;
  }

  try {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          'Explain why a specific transition point is recommended (1 sentence).',
      },
      {
        role: 'user',
        content: `Transition: "${trackA.title}" → "${trackB.title}"
From position: ${Math.floor(candidate.from_position)}s
To position: ${Math.floor(candidate.to_position)}s
Scores: Key ${candidate.scores.key.toFixed(
          2
        )}, Energy ${candidate.scores.energy.toFixed(
          2
        )}, Tempo ${candidate.scores.tempo.toFixed(2)}`,
      },
    ];

    const response = await llmService.chat(messages);
    return response.content.trim();
  } catch (error) {
    console.error('Error generating transition explanation:', error);
    return `Transition point with score ${candidate.score.toFixed(2)}`;
  }
}
