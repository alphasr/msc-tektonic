/**
 * Real-time audio feature extraction for ML inference
 * Runs at 60fps to extract 64-dim feature vectors from live audio
 */

import { AudioFeatures } from '@/types';

export class FeatureExtractor {
  private previousEnergy: number = 0;
  private previousSpectrum: Float32Array | null = null;
  private sampleRate: number = 44100;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
  }

  /**
   * Extract features from AnalyserNode frequency data
   * @param spectrum Float32Array from analyser.getFloatFrequencyData() (128 bins)
   * @param timestamp Current playback position in seconds
   * @param trackBPM Track's base BPM
   * @param deckId Which deck ('A' or 'B')
   * @param trackId Track identifier
   * @returns AudioFeatures with 64-dim feature vector
   */
  extractFeatures(
    spectrum: Float32Array,
    timestamp: number,
    trackBPM: number,
    deckId: 'A' | 'B',
    trackId: string,
  ): AudioFeatures {
    // Downsample to 32 bins for efficiency (from 128)
    const downsampledSpectrum = this.downsampleSpectrum(spectrum, 32);

    // Calculate energy (RMS)
    const energy = this.calculateEnergy(downsampledSpectrum);
    const energyDelta = energy - this.previousEnergy;
    this.previousEnergy = energy;

    // Calculate spectral features
    const spectralCentroid =
      this.calculateSpectralCentroid(downsampledSpectrum);
    const spectralFlux = this.calculateSpectralFlux(downsampledSpectrum);

    // Calculate frequency bands
    const { low, mid, high } = this.calculateFrequencyBands(spectrum);

    // Tempo delta (would need beat tracking for accurate tempo, using 0 for now)
    const tempoDelta = 0;

    return {
      timestamp,
      spectrum: downsampledSpectrum,
      spectralCentroid,
      spectralFlux,
      energy,
      energyDelta,
      tempoDelta,
      low,
      mid,
      high,
      deckId,
      trackId,
    };
  }

  /**
   * Downsample spectrum from 128 bins to target size
   */
  private downsampleSpectrum(
    spectrum: Float32Array,
    targetSize: number,
  ): Float32Array {
    const result = new Float32Array(targetSize);
    const binSize = Math.floor(spectrum.length / targetSize);

    for (let i = 0; i < targetSize; i++) {
      let sum = 0;
      const start = i * binSize;
      const end = Math.min(start + binSize, spectrum.length);

      for (let j = start; j < end; j++) {
        // Convert from dB to linear (spectrum is in dB, range -100 to 0)
        const linear = Math.pow(10, spectrum[j] / 20);
        sum += linear;
      }

      result[i] = sum / binSize;
    }

    // Normalize to 0-1 range
    const max = Math.max(...Array.from(result), 0.001);
    for (let i = 0; i < result.length; i++) {
      result[i] = result[i] / max;
    }

    return result;
  }

  /**
   * Calculate RMS energy from spectrum
   */
  private calculateEnergy(spectrum: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < spectrum.length; i++) {
      sum += spectrum[i] * spectrum[i];
    }
    return Math.sqrt(sum / spectrum.length);
  }

  /**
   * Calculate spectral centroid (center of mass of frequency distribution)
   */
  private calculateSpectralCentroid(spectrum: Float32Array): number {
    let weightedSum = 0;
    let sum = 0;

    for (let i = 0; i < spectrum.length; i++) {
      weightedSum += i * spectrum[i];
      sum += spectrum[i];
    }

    return sum > 0 ? weightedSum / sum / spectrum.length : 0;
  }

  /**
   * Calculate spectral flux (rate of change in spectrum)
   */
  private calculateSpectralFlux(spectrum: Float32Array): number {
    if (
      !this.previousSpectrum ||
      this.previousSpectrum.length !== spectrum.length
    ) {
      this.previousSpectrum = new Float32Array(spectrum);
      return 0;
    }

    let sum = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const diff = spectrum[i] - this.previousSpectrum[i];
      sum += diff * diff;
    }

    this.previousSpectrum = new Float32Array(spectrum);
    return Math.sqrt(sum / spectrum.length);
  }

  /**
   * Calculate energy in frequency bands (low/mid/high)
   * Based on full 128-bin spectrum for accuracy
   */
  private calculateFrequencyBands(spectrum: Float32Array): {
    low: number;
    mid: number;
    high: number;
  } {
    const nyquist = this.sampleRate / 2;
    const binFreq = nyquist / spectrum.length;

    let lowSum = 0,
      lowCount = 0;
    let midSum = 0,
      midCount = 0;
    let highSum = 0,
      highCount = 0;

    for (let i = 0; i < spectrum.length; i++) {
      const freq = i * binFreq;
      const linear = Math.pow(10, spectrum[i] / 20);

      if (freq < 250) {
        lowSum += linear;
        lowCount++;
      } else if (freq < 8000) {
        midSum += linear;
        midCount++;
      } else {
        highSum += linear;
        highCount++;
      }
    }

    const low = lowCount > 0 ? lowSum / lowCount : 0;
    const mid = midCount > 0 ? midSum / midCount : 0;
    const high = highCount > 0 ? highSum / highCount : 0;

    // Normalize
    const total = low + mid + high;
    if (total > 0) {
      return {
        low: low / total,
        mid: mid / total,
        high: high / total,
      };
    }

    return { low: 0, mid: 0, high: 0 };
  }

  /**
   * Reset state (call when track changes)
   */
  reset(): void {
    this.previousEnergy = 0;
    this.previousSpectrum = null;
  }
}
