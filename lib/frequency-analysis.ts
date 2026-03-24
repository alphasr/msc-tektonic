// Frequency Band Analysis for DJ Mixing
// Extracts low, mid, and high frequency content from audio

import { FrequencyProfile } from '@/types';

// Frequency band definitions for DJ mixing
const LOW_FREQ_MAX = 250; // Hz - Bass frequencies
const MID_FREQ_MIN = 250; // Hz
const MID_FREQ_MAX = 8000; // Hz - Mid frequencies
const HIGH_FREQ_MIN = 8000; // Hz - High frequencies

/**
 * Calculate frequency profile from audio samples using FFT
 */
export function calculateFrequencyProfile(
  samples: number[],
  sampleRate: number
): FrequencyProfile {
  if (samples.length === 0) {
    return { low: 0, mid: 0, high: 0 };
  }

  // Use a simple FFT implementation
  // For better performance, we'll use windowed FFT
  const fftSize = Math.pow(2, Math.floor(Math.log2(samples.length)) || 12); // Power of 2, min 4096
  const windowedSamples = applyWindow(samples.slice(0, fftSize));

  // Perform FFT
  const fft = performFFT(windowedSamples);

  // Calculate frequency resolution
  const freqResolution = sampleRate / fftSize;

  // Calculate energy in each frequency band
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;
  let totalEnergy = 0;

  for (let i = 0; i < fft.length / 2; i++) {
    const frequency = i * freqResolution;
    const magnitude = Math.sqrt(
      fft[i].real * fft[i].real + fft[i].imag * fft[i].imag
    );
    const energy = magnitude * magnitude;

    totalEnergy += energy;

    if (frequency < LOW_FREQ_MAX) {
      lowEnergy += energy;
    } else if (frequency >= MID_FREQ_MIN && frequency < MID_FREQ_MAX) {
      midEnergy += energy;
    } else if (frequency >= HIGH_FREQ_MIN) {
      highEnergy += energy;
    }
  }

  // Normalize to 0-1 range
  if (totalEnergy === 0) {
    return { low: 0, mid: 0, high: 0 };
  }

  return {
    low: Math.min(1, lowEnergy / totalEnergy),
    mid: Math.min(1, midEnergy / totalEnergy),
    high: Math.min(1, highEnergy / totalEnergy),
  };
}

/**
 * Apply Hann window to reduce spectral leakage
 */
function applyWindow(samples: number[]): number[] {
  const windowed: number[] = [];
  const N = samples.length;

  for (let i = 0; i < N; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed.push(samples[i] * window);
  }

  return windowed;
}

/**
 * Simple FFT implementation (Cooley-Tukey algorithm)
 */
interface Complex {
  real: number;
  imag: number;
}

function performFFT(samples: number[]): Complex[] {
  const N = samples.length;

  // Base case
  if (N <= 1) {
    return samples.map((s) => ({ real: s, imag: 0 }));
  }

  // Ensure N is power of 2
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(N)));
  const padded = [...samples];
  while (padded.length < nextPowerOf2) {
    padded.push(0);
  }

  return fftRecursive(padded.map((s) => ({ real: s, imag: 0 })));
}

function fftRecursive(x: Complex[]): Complex[] {
  const N = x.length;

  if (N <= 1) {
    return x;
  }

  // Divide
  const even: Complex[] = [];
  const odd: Complex[] = [];

  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) {
      even.push(x[i]);
    } else {
      odd.push(x[i]);
    }
  }

  // Conquer
  const evenFFT = fftRecursive(even);
  const oddFFT = fftRecursive(odd);

  // Combine
  const result: Complex[] = [];

  for (let k = 0; k < N / 2; k++) {
    const angle = (-2 * Math.PI * k) / N;
    const twiddle = {
      real: Math.cos(angle),
      imag: Math.sin(angle),
    };

    const t = {
      real: twiddle.real * oddFFT[k].real - twiddle.imag * oddFFT[k].imag,
      imag: twiddle.real * oddFFT[k].imag + twiddle.imag * oddFFT[k].real,
    };

    result[k] = {
      real: evenFFT[k].real + t.real,
      imag: evenFFT[k].imag + t.imag,
    };

    result[k + N / 2] = {
      real: evenFFT[k].real - t.real,
      imag: evenFFT[k].imag - t.imag,
    };
  }

  return result;
}

/**
 * Extract frequency profiles for multiple time segments
 */
export function extractFrequencyProfiles(
  samples: number[],
  sampleRate: number,
  segmentCount: number
): FrequencyProfile[] {
  const profiles: FrequencyProfile[] = [];
  const samplesPerSegment = Math.floor(samples.length / segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const start = i * samplesPerSegment;
    const end = Math.min(start + samplesPerSegment, samples.length);
    const segmentSamples = samples.slice(start, end);

    const profile = calculateFrequencyProfile(segmentSamples, sampleRate);
    profiles.push(profile);
  }

  return profiles;
}

/**
 * Calculate frequency compatibility score between two profiles
 * Returns 0-1 score where 1 is perfect match
 */
export function frequencyCompatibilityScore(
  profileA: FrequencyProfile,
  profileB: FrequencyProfile
): number {
  // Calculate similarity for each band
  const lowSim = 1 - Math.abs(profileA.low - profileB.low);
  const midSim = 1 - Math.abs(profileA.mid - profileB.mid);
  const highSim = 1 - Math.abs(profileA.high - profileB.high);

  // Weighted average (mids are most important for mixing)
  // Low: 30%, Mid: 50%, High: 20%
  const score = 0.3 * lowSim + 0.5 * midSim + 0.2 * highSim;

  return Math.max(0, Math.min(1, score));
}

/**
 * Check if frequency bands can be mixed using DJ techniques
 */
export function canMixFrequencyBands(
  profileA: FrequencyProfile,
  profileB: FrequencyProfile,
  technique: 'cut' | 'blend' | 'overlap' = 'blend'
): boolean {
  const compatibility = frequencyCompatibilityScore(profileA, profileB);

  switch (technique) {
    case 'cut':
      // For cutting, we need complementary bands (one high, one low in same band)
      // This allows cutting one track's band and bringing in the other
      return compatibility > 0.3;

    case 'blend':
      // For blending, bands should be somewhat similar
      return compatibility > 0.5;

    case 'overlap':
      // For overlapping, bands should be very similar
      return compatibility > 0.7;

    default:
      return compatibility > 0.5;
  }
}
