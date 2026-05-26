/**
 * Web Worker for real-time audio feature extraction
 * Runs independently from main thread to prevent UI blocking
 */

import { FeatureExtractor } from '../ml/feature-extractor';

// Worker message types
interface ExtractMessage {
  type: 'extract';
  spectrum: Float32Array;
  timestamp: number;
  trackBPM: number;
  deckId: 'A' | 'B';
  trackId: string;
}

interface ResetMessage {
  type: 'reset';
}

interface ConfigMessage {
  type: 'config';
  sampleRate: number;
}

type WorkerMessage = ExtractMessage | ResetMessage | ConfigMessage;

// Initialize feature extractor
let extractor = new FeatureExtractor(44100);

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'config':
      extractor = new FeatureExtractor(message.sampleRate);
      self.postMessage({ type: 'ready' });
      break;

    case 'reset':
      extractor.reset();
      self.postMessage({ type: 'reset_complete' });
      break;

    case 'extract':
      try {
        const features = extractor.extractFeatures(
          message.spectrum,
          message.timestamp,
          message.trackBPM,
          message.deckId,
          message.trackId,
        );

        // Post features back to main thread
        self.postMessage({
          type: 'features',
          features,
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      break;

    default:
      self.postMessage({
        type: 'error',
        error: `Unknown message type: ${(message as WorkerMessage).type}`,
      });
  }
};

// Signal worker is ready
self.postMessage({ type: 'initialized' });

export {};
