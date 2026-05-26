/**
 * ML Manager - Coordinates real-time feature extraction and LLM enrichment
 * Runs at 60fps to provide AI-enhanced segment suggestions
 */

import {
  AudioFeatures,
  LLMPrediction,
  MixHistoryEntry,
  MLPerformanceMetrics,
} from '@/types';
import { getAudioManager } from './audio-manager';

type FeatureCallback = (features: AudioFeatures) => void;
type PredictionCallback = (prediction: LLMPrediction | null) => void;

export class MLManager {
  private worker: Worker | null = null;
  private audioManager: ReturnType<typeof getAudioManager>;
  private rafId: number | null = null;
  private isRunning: boolean = false;

  // Callbacks
  private featureCallbacks: Set<FeatureCallback> = new Set();
  private predictionCallbacks: Set<PredictionCallback> = new Set();

  // State
  private currentFeatures: Map<'A' | 'B', AudioFeatures | null> = new Map([
    ['A', null],
    ['B', null],
  ]);
  private mixHistory: MixHistoryEntry[] = [];
  private currentPrediction: LLMPrediction | null = null;

  // Performance tracking
  private metrics: MLPerformanceMetrics = {
    frameRate: 60,
    avgInferenceTime: 0,
    workerBacklog: 0,
    cpuUsage: 0,
    degradationLevel: 'none',
  };
  private frameTimestamps: number[] = [];
  private lastLLMCall: number = 0;
  private llmCallInterval: number = 2000; // Call LLM every 2 seconds

  constructor() {
    this.audioManager = getAudioManager();
    this.initializeWorker();
  }

  /**
   * Initialize feature extraction worker
   */
  private initializeWorker(): void {
    try {
      // Note: In Next.js, we need to use dynamic import for workers
      this.worker = new Worker(
        new URL('./workers/feature-extraction.worker.ts', import.meta.url),
        { type: 'module' },
      );

      this.worker.onmessage = (event) => {
        const message = event.data;

        switch (message.type) {
          case 'initialized':
            console.log('✅ Feature extraction worker initialized');
            break;

          case 'ready':
            console.log('✅ Feature extraction worker configured');
            break;

          case 'features':
            const features = message.features as AudioFeatures;
            this.currentFeatures.set(features.deckId, features);

            // Broadcast to callbacks
            this.featureCallbacks.forEach((cb) => cb(features));
            break;

          case 'error':
            console.error('Worker error:', message.error);
            break;
        }
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
      };

      // Configure worker with audio context sample rate
      // Use default sample rate since audioContext is private
      this.worker.postMessage({
        type: 'config',
        sampleRate: 44100,
      });
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      // Fallback: will use synchronous feature extraction
    }
  }

  /**
   * Start real-time feature extraction loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.rafId = requestAnimationFrame(this.extractionLoop.bind(this));
    console.log('✅ ML Manager started - extracting features at 60fps');
  }

  /**
   * Stop feature extraction loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Main extraction loop - runs at 60fps
   */
  private extractionLoop(): void {
    if (!this.isRunning) return;

    const now = performance.now();

    // Track frame rate
    this.frameTimestamps.push(now);
    if (this.frameTimestamps.length > 60) {
      this.frameTimestamps.shift();
    }
    this.updateMetrics();

    // Extract features from both decks
    ['A', 'B'].forEach((deckId) => {
      const deck = this.audioManager.getDeck(deckId as 'A' | 'B');
      if (deck && deck.isPlaying()) {
        this.extractFeaturesFromDeck(deckId as 'A' | 'B', deck);
      }
    });

    // Schedule next frame
    this.rafId = requestAnimationFrame(this.extractionLoop.bind(this));
  }

  /**
   * Extract features from a specific deck
   */
  private extractFeaturesFromDeck(
    deckId: 'A' | 'B',
    deck: {
      getFrequencyDataFloat: () => Float32Array;
      getCurrentTime: () => number;
      isPlaying?: () => boolean;
    },
  ): void {
    try {
      const spectrum = deck.getFrequencyDataFloat();
      const timestamp = deck.getCurrentTime();

      // Get track info (would need to be passed in from parent component)
      // For now, using placeholder
      const trackBPM = 128;
      const trackId = `deck-${deckId}`;

      if (this.worker) {
        // Send to worker for async processing
        this.worker.postMessage({
          type: 'extract',
          spectrum: spectrum.slice(), // Clone to avoid shared buffer issues
          timestamp,
          trackBPM,
          deckId,
          trackId,
        });
      } else {
        // Fallback: synchronous extraction (not recommended for production)
        // Would need to import FeatureExtractor directly
        console.warn('Worker not available, skipping feature extraction');
      }
    } catch (error) {
      console.error('Feature extraction error:', error);
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    if (this.frameTimestamps.length < 2) return;

    const timeSpan =
      this.frameTimestamps[this.frameTimestamps.length - 1] -
      this.frameTimestamps[0];
    this.metrics.frameRate =
      (this.frameTimestamps.length - 1) / (timeSpan / 1000);

    // Determine degradation level based on frame rate
    if (this.metrics.frameRate >= 55) {
      this.metrics.degradationLevel = 'none';
    } else if (this.metrics.frameRate >= 25) {
      this.metrics.degradationLevel = 'minor';
    } else if (this.metrics.frameRate >= 12) {
      this.metrics.degradationLevel = 'moderate';
    } else {
      this.metrics.degradationLevel = 'severe';
    }
  }

  /**
   * Get current audio features for a deck
   */
  getFeatures(deckId: 'A' | 'B'): AudioFeatures | null {
    return this.currentFeatures.get(deckId) || null;
  }

  /**
   * Get latest LLM prediction
   */
  getPrediction(): LLMPrediction | null {
    return this.currentPrediction;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): MLPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Subscribe to feature updates
   */
  onFeatures(callback: FeatureCallback): () => void {
    this.featureCallbacks.add(callback);
    return () => this.featureCallbacks.delete(callback);
  }

  /**
   * Subscribe to prediction updates
   */
  onPrediction(callback: PredictionCallback): () => void {
    this.predictionCallbacks.add(callback);
    return () => this.predictionCallbacks.delete(callback);
  }

  /**
   * Add entry to mix history
   */
  addMixHistoryEntry(entry: MixHistoryEntry): void {
    this.mixHistory.push(entry);

    // Keep only last 20 entries
    if (this.mixHistory.length > 20) {
      this.mixHistory.shift();
    }
  }

  /**
   * Get mix history
   */
  getMixHistory(): MixHistoryEntry[] {
    return [...this.mixHistory];
  }

  /**
   * Clear mix history
   */
  clearMixHistory(): void {
    this.mixHistory = [];
  }

  /**
   * Request LLM enrichment for current state
   * This is called less frequently (every 2s) to avoid overloading the local LLM
   */
  async requestLLMEnrichment(): Promise<LLMPrediction | null> {
    const now = Date.now();

    // Throttle LLM calls
    if (now - this.lastLLMCall < this.llmCallInterval) {
      return this.currentPrediction;
    }

    this.lastLLMCall = now;

    try {
      // This would call the LLM enrichment service
      // For now, return null (will be implemented in the API route)
      return null;
    } catch (error) {
      console.error('LLM enrichment error:', error);
      return null;
    }
  }

  /**
   * Reset state (e.g., when track changes)
   */
  reset(deckId?: 'A' | 'B'): void {
    if (deckId) {
      this.currentFeatures.set(deckId, null);
      if (this.worker) {
        this.worker.postMessage({ type: 'reset' });
      }
    } else {
      this.currentFeatures.clear();
      this.currentFeatures.set('A', null);
      this.currentFeatures.set('B', null);
      if (this.worker) {
        this.worker.postMessage({ type: 'reset' });
      }
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.stop();

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.featureCallbacks.clear();
    this.predictionCallbacks.clear();
    this.currentFeatures.clear();
    this.mixHistory = [];
  }
}

// Singleton instance
let instance: MLManager | null = null;

export function getMLManager(): MLManager {
  if (!instance) {
    instance = new MLManager();
  }
  return instance;
}

/**
 * Hook for React components to use ML Manager
 */
export function useMLManager() {
  return getMLManager();
}
