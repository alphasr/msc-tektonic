/**
 * LLM Enrichment Service for Real-time Segment Suggestions
 * Uses local phi-4-mini model to provide intelligent predictions and explanations
 */

import { AudioFeatures, LLMPrediction, MixHistoryEntry } from '@/types';

interface LLMEnrichmentRequest {
  currentTrackId: string;
  currentPosition: number;
  currentFeatures: AudioFeatures;
  candidateSegments: Array<{
    trackId: string;
    trackTitle: string;
    trackArtist: string;
    position: number;
    score: number;
    features?: {
      bpm: number;
      key: string;
      energy: number;
      low: number;
      mid: number;
      high: number;
    };
  }>;
  mixHistory?: MixHistoryEntry[];
  deckAFeatures?: AudioFeatures;
  deckBFeatures?: AudioFeatures;
}

interface LLMEnrichmentResponse {
  predictions: LLMPrediction;
  processingTime: number;
}

export class LLMEnrichmentService {
  private baseURL: string;
  private model: string;
  private cache: Map<string, { data: LLMPrediction; timestamp: number }>;
  private cacheTTL: number = 3000; // 3 seconds cache
  private requestQueue: Promise<LLMEnrichmentResponse> | null = null;

  constructor() {
    this.baseURL = process.env.LLM_BASE_URL || 'http://localhost:1234/v1';
    this.model = process.env.LLM_MODEL || 'microsoft/phi-4-mini-reasoning';
    this.cache = new Map();
  }

  /**
   * Get LLM-enriched predictions for segment suggestions
   * Batches requests to avoid overwhelming the local model
   */
  async enrichPredictions(
    request: LLMEnrichmentRequest,
  ): Promise<LLMPrediction> {
    // Check cache
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // Wait for any pending request to complete (avoid parallel LLM calls)
    if (this.requestQueue) {
      try {
        await this.requestQueue;
      } catch {
        // Ignore errors from previous request
      }
    }

    // Create new request
    this.requestQueue = this.makeEnrichmentRequest(request);

    try {
      const response = await this.requestQueue;

      // Cache result
      this.cache.set(cacheKey, {
        data: response.predictions,
        timestamp: Date.now(),
      });

      // Clean old cache entries
      this.cleanCache();

      return response.predictions;
    } finally {
      this.requestQueue = null;
    }
  }

  /**
   * Make actual LLM request
   */
  private async makeEnrichmentRequest(
    request: LLMEnrichmentRequest,
  ): Promise<LLMEnrichmentResponse> {
    const requestStartTime = Date.now();
    const prompt = this.buildPrompt(request);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert DJ AI assistant analyzing audio features and suggesting optimal track transitions. Provide concise, actionable insights focused on mixing technique.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.3, // Lower temperature for more consistent predictions
        }),
      });

      if (!response.ok) {
        throw new Error(
          `LLM API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const predictions = this.parseResponse(content, request);
      const processingTime = Date.now() - requestStartTime;

      return {
        predictions,
        processingTime,
      };
    } catch (error) {
      console.error('LLM enrichment error:', error);

      // Return fallback predictions on error
      return {
        predictions: this.getFallbackPredictions(request),
        processingTime: Date.now() - requestStartTime,
      };
    }
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(request: LLMEnrichmentRequest): string {
    const {
      currentFeatures,
      candidateSegments,
      mixHistory,
      deckAFeatures,
      deckBFeatures,
    } = request;

    let prompt = `Current playback state at ${currentFeatures.timestamp.toFixed(1)}s:
- Energy: ${currentFeatures.energy.toFixed(2)}
- Energy trend: ${currentFeatures.energyDelta > 0 ? 'rising' : currentFeatures.energyDelta < 0 ? 'falling' : 'stable'}
- Frequency distribution: Low ${(currentFeatures.low * 100).toFixed(0)}%, Mid ${(currentFeatures.mid * 100).toFixed(0)}%, High ${(currentFeatures.high * 100).toFixed(0)}%
- Spectral flux: ${currentFeatures.spectralFlux.toFixed(3)}

Top candidate segments for mixing:
${candidateSegments
  .slice(0, 5)
  .map(
    (
      seg,
      i,
    ) => `${i + 1}. "${seg.trackTitle}" by ${seg.trackArtist} at ${seg.position.toFixed(1)}s
   - Score: ${(seg.score * 100).toFixed(0)}%
   - BPM: ${seg.features?.bpm || 'unknown'}, Key: ${seg.features?.key || 'unknown'}
   - Energy: ${seg.features?.energy || 'unknown'}
   - Frequency: Low ${((seg.features?.low || 0) * 100).toFixed(0)}%, Mid ${((seg.features?.mid || 0) * 100).toFixed(0)}%, High ${((seg.features?.high || 0) * 100).toFixed(0)}%`,
  )
  .join('\n')}

`;

    if (mixHistory && mixHistory.length > 0) {
      prompt += `Recent mix history (last ${Math.min(3, mixHistory.length)} transitions):
${mixHistory
  .slice(-3)
  .map(
    (h, i) =>
      `${i + 1}. ${h.fromTrackId} → ${h.toTrackId} at ${h.timestamp.toFixed(1)}s`,
  )
  .join('\n')}

`;
    }

    if (deckAFeatures && deckBFeatures) {
      prompt += `Both decks playing:
- Deck A: Energy ${deckAFeatures.energy.toFixed(2)}, Low ${(deckAFeatures.low * 100).toFixed(0)}%
- Deck B: Energy ${deckBFeatures.energy.toFixed(2)}, Low ${(deckBFeatures.low * 100).toFixed(0)}%

`;
    }

    prompt += `Analyze and provide:
1. Which of the top 3 candidates would create the best transition? Consider energy flow, frequency complementarity, and musical compatibility.
2. When should the DJ start the mix? (in seconds from now)
3. Brief explanation of why this works musically (1-2 sentences)
4. Energy trend assessment: is energy rising, falling, or stable?
5. Practical mixing advice (1 sentence)

Format as JSON:
{
  "bestCandidate": 1-5,
  "optimalTransitionTime": <seconds>,
  "reasoning": "<explanation>",
  "energyTrend": "rising|falling|stable",
  "mixingAdvice": "<advice>",
  "contextBoosts": {"trackId1": 1.2, "trackId2": 0.8}
}`;

    return prompt;
  }

  /**
   * Parse LLM response into structured prediction
   */
  private parseResponse(
    content: string,
    request: LLMEnrichmentRequest,
  ): LLMPrediction {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const bestCandidateIndex = (parsed.bestCandidate || 1) - 1;
      const bestCandidate = request.candidateSegments[bestCandidateIndex];

      const prediction: LLMPrediction = {
        timestamp: Date.now(),
        trackId: request.currentTrackId,
        position: request.currentPosition,
        suggestedSegments: bestCandidate
          ? [
              {
                trackId: bestCandidate.trackId,
                position: bestCandidate.position,
                confidence: 0.8,
                optimalTransitionTime: parsed.optimalTransitionTime || 8,
                reasoning: parsed.reasoning || 'Good musical compatibility',
              },
            ]
          : [],
        contextBoosts: new Map(Object.entries(parsed.contextBoosts || {})),
        transitionExplanation: parsed.reasoning || 'Smooth energy transition',
        energyTrend: parsed.energyTrend || 'stable',
        mixingAdvice:
          parsed.mixingAdvice || 'Mix smoothly on the phrase boundary',
      };

      return prediction;
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      return this.getFallbackPredictions(request);
    }
  }

  /**
   * Generate fallback predictions when LLM fails
   */
  private getFallbackPredictions(request: LLMEnrichmentRequest): LLMPrediction {
    const topCandidate = request.candidateSegments[0];

    return {
      timestamp: Date.now(),
      trackId: request.currentTrackId,
      position: request.currentPosition,
      suggestedSegments: topCandidate
        ? [
            {
              trackId: topCandidate.trackId,
              position: topCandidate.position,
              confidence: 0.5,
              optimalTransitionTime: 8,
              reasoning:
                'Algorithmically matched based on BPM and key compatibility',
            },
          ]
        : [],
      contextBoosts: new Map(),
      transitionExplanation: 'Using algorithmic compatibility scoring',
      energyTrend:
        request.currentFeatures.energyDelta > 0.01
          ? 'rising'
          : request.currentFeatures.energyDelta < -0.01
            ? 'falling'
            : 'stable',
      mixingAdvice: 'Standard phrase-boundary transition recommended',
    };
  }

  /**
   * Generate cache key from request
   */
  private getCacheKey(request: LLMEnrichmentRequest): string {
    const candidateIds = request.candidateSegments
      .slice(0, 5)
      .map((c) => `${c.trackId}_${c.position.toFixed(0)}`)
      .join(',');

    return `${request.currentTrackId}_${request.currentPosition.toFixed(0)}_${candidateIds}`;
  }

  /**
   * Clean old cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTTL * 2) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let instance: LLMEnrichmentService | null = null;

export function getLLMEnrichmentService(): LLMEnrichmentService {
  if (!instance) {
    instance = new LLMEnrichmentService();
  }
  return instance;
}
