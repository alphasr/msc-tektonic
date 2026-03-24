// Real audio analysis using ffmpeg and audio processing

import { TrackSummary, getFeaturesDir } from './storage';
import { promises as fs } from 'fs';
import path from 'path';
import { analyzeAudioFile } from './audio-analysis';

// Real audio analysis
export async function analyzeTrack(
  track_id: string,
  file_path: string
): Promise<TrackSummary> {
  try {
    // Analyze audio file
    const features = await analyzeAudioFile(file_path);

    const summary: TrackSummary = {
      tempo_bpm: features.tempo_bpm,
      key: features.key,
      energy: features.energy,
      duration: features.duration,
      phrases: features.phrases,
      bars: features.bars,
    };

    // Save features with real waveform and frequency profiles
    await saveFeatures(
      track_id,
      summary,
      features.waveform,
      features.barFrequencies,
      features.phraseFrequencies
    );

    return summary;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}

// Save feature vectors with real data
async function saveFeatures(
  track_id: string,
  summary: TrackSummary,
  waveform: number[],
  barFrequencies?: import('@/types').FrequencyProfile[],
  phraseFrequencies?: import('@/types').FrequencyProfile[]
) {
  const featuresDir = getFeaturesDir(track_id);
  await fs.mkdir(featuresDir, { recursive: true });

  // Generate feature vectors based on actual audio analysis
  // Bar-level features: extract from waveform segments
  const barVecs = generateBarVectors(waveform, summary.bars);

  // Phrase-level features: aggregate bar features
  const phraseVecs = generatePhraseVectors(barVecs, summary.phrases);

  // Save as JSON (in production, use .npz files)
  await fs.writeFile(
    path.join(featuresDir, 'bar_vecs.json'),
    JSON.stringify(barVecs)
  );

  await fs.writeFile(
    path.join(featuresDir, 'phrase_vecs.json'),
    JSON.stringify(phraseVecs)
  );

  await fs.writeFile(
    path.join(featuresDir, 'summary.json'),
    JSON.stringify(summary)
  );

  // Save waveform for frontend
  await fs.writeFile(
    path.join(featuresDir, 'waveform.json'),
    JSON.stringify(waveform)
  );

  // Save frequency profiles
  if (barFrequencies && barFrequencies.length > 0) {
    const barFreqData = barFrequencies.map((profile, index) => ({
      barIndex: index,
      profile,
      timestamp: (index / summary.bars) * summary.duration,
    }));
    await fs.writeFile(
      path.join(featuresDir, 'bar_frequencies.json'),
      JSON.stringify({ bars: barFreqData })
    );
  }

  if (phraseFrequencies && phraseFrequencies.length > 0) {
    const phraseFreqData = phraseFrequencies.map((profile, index) => ({
      phraseIndex: index,
      profile,
      timestamp: (index / summary.phrases) * summary.duration,
    }));
    await fs.writeFile(
      path.join(featuresDir, 'phrase_frequencies.json'),
      JSON.stringify({ phrases: phraseFreqData })
    );
  }
}

// Generate bar-level feature vectors from waveform
function generateBarVectors(waveform: number[], barCount: number): number[][] {
  const barsPerSample = Math.floor(waveform.length / barCount);
  const vectors: number[][] = [];

  for (let i = 0; i < barCount; i++) {
    const start = i * barsPerSample;
    const end = Math.min(start + barsPerSample, waveform.length);
    const barSamples = waveform.slice(start, end);

    // Extract features: RMS, peak, variance, spectral centroid approximation
    const rms = Math.sqrt(
      barSamples.reduce((sum, v) => sum + v * v, 0) / barSamples.length
    );
    const peak = Math.max(...barSamples);
    const mean = barSamples.reduce((sum, v) => sum + v, 0) / barSamples.length;
    const variance =
      barSamples.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
      barSamples.length;

    // Create 128-dim vector (pad with derived features)
    const vector = [
      rms,
      peak,
      mean,
      variance,
      ...barSamples.slice(0, 124).map((v) => v * 0.5 + 0.5), // Normalize to 0-1
    ].slice(0, 128);

    vectors.push(vector);
  }

  return vectors;
}

// Generate phrase-level feature vectors from bar vectors
function generatePhraseVectors(
  barVecs: number[][],
  phraseCount: number
): number[][] {
  const barsPerPhrase = Math.floor(barVecs.length / phraseCount);
  const vectors: number[][] = [];

  for (let i = 0; i < phraseCount; i++) {
    const start = i * barsPerPhrase;
    const end = Math.min(start + barsPerPhrase, barVecs.length);
    const phraseBars = barVecs.slice(start, end);

    // Aggregate: mean pooling
    const meanVec = new Array(128).fill(0);
    phraseBars.forEach((bar) => {
      bar.forEach((val, idx) => {
        meanVec[idx] += val;
      });
    });
    const pooled = meanVec.map((val) => val / phraseBars.length);

    // Add energy and texture features
    const energy = pooled.slice(0, 10).reduce((sum, v) => sum + v, 0) / 10;
    const texture =
      pooled.slice(10, 20).reduce((sum, v) => sum + Math.abs(v - 0.5), 0) / 10;

    // Create 256-dim vector
    const vector = [
      ...pooled,
      energy,
      texture,
      ...new Array(256 - pooled.length - 2).fill(0),
    ].slice(0, 256);

    vectors.push(vector);
  }

  return vectors;
}

// Energy scoring formula
export function calculateEnergy(
  tempo_bpm: number,
  transient_density: number,
  rms: number
): number {
  const tempo_norm = (tempo_bpm - 100) / 20;
  const density_norm = transient_density / 10; // Normalize to 0-1
  const rms_norm = (rms - 0.5) / 0.5; // Normalize to 0-1

  const energy = 0.5 + 0.5 * tempo_norm + 0.3 * density_norm + 0.2 * rms_norm;
  return Math.max(1, Math.min(10, energy));
}

// Key compatibility check
export function isKeyCompatible(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB) return false;
  return keyScore(keyA, keyB) > 0;
}

// Key score (0-1)
export function keyScore(keyA: string, keyB: string): number {
  if (!keyA || !keyB) return 0.0;
  if (keyA === keyB) return 1.0;

  const numA = parseInt(keyA);
  const numB = parseInt(keyB);
  const letterA = keyA.slice(-1);
  const letterB = keyB.slice(-1);

  // Relative Major/Minor (8A -> 8B)
  if (numA === numB && letterA !== letterB) return 0.8;

  // Same letter (minor to minor, or major to major)
  if (letterA === letterB) {
    let diff = Math.abs(numA - numB);
    if (diff === 11) diff = 1; // Wrap around 12 to 1
    if (diff === 10) diff = 2; // Wrap around 11 to 1, 12 to 2

    if (diff === 1) return 0.8; // Adjacent on wheel
    if (diff === 2) return 0.6; // Energy Boost (+2 on wheel)
  }

  // Same root note (A Minor -> A Major) -> 8A to 11B (diff = 3, letter change)
  if (letterA !== letterB) {
    let diff = Math.abs(numA - numB);
    if (diff > 6) diff = 12 - diff; // Wrap around distance
    if (diff === 3) return 0.5; // Mood shift (Parallel scale)
  }

  return 0.0;
}

// Energy score (0-1)
export function energyScore(energyA: number, energyB: number): number {
  const diff = Math.abs(energyA - energyB);
  return 1 - Math.min(diff, 3) / 3;
}

// Load features
export async function loadFeatures(track_id: string): Promise<{
  barVecs: number[][];
  phraseVecs: number[][];
  summary: TrackSummary;
  waveform?: number[];
  barFrequencies?: import('@/types').BarFrequencyData[];
  phraseFrequencies?: import('@/types').PhraseFrequencyData[];
}> {
  const featuresDir = getFeaturesDir(track_id);

  try {
    const barVecs = JSON.parse(
      await fs.readFile(path.join(featuresDir, 'bar_vecs.json'), 'utf-8')
    );
    const phraseVecs = JSON.parse(
      await fs.readFile(path.join(featuresDir, 'phrase_vecs.json'), 'utf-8')
    );
    const summary = JSON.parse(
      await fs.readFile(path.join(featuresDir, 'summary.json'), 'utf-8')
    );

    // Try to load waveform if available
    let waveform: number[] | undefined;
    try {
      const waveformData = await fs.readFile(
        path.join(featuresDir, 'waveform.json'),
        'utf-8'
      );
      waveform = JSON.parse(waveformData);
    } catch {
      // Waveform not available, will be undefined
    }

    // Try to load frequency profiles if available
    let barFrequencies: import('@/types').BarFrequencyData[] | undefined;
    try {
      const barFreqData = await fs.readFile(
        path.join(featuresDir, 'bar_frequencies.json'),
        'utf-8'
      );
      const parsed = JSON.parse(barFreqData);
      barFrequencies = parsed.bars || [];
    } catch {
      // Frequency data not available
    }

    let phraseFrequencies: import('@/types').PhraseFrequencyData[] | undefined;
    try {
      const phraseFreqData = await fs.readFile(
        path.join(featuresDir, 'phrase_frequencies.json'),
        'utf-8'
      );
      const parsed = JSON.parse(phraseFreqData);
      phraseFrequencies = parsed.phrases || [];
    } catch {
      // Frequency data not available
    }

    return {
      barVecs,
      phraseVecs,
      summary,
      waveform,
      barFrequencies,
      phraseFrequencies,
    };
  } catch (error) {
    throw new Error(
      `Features not found for track ${track_id}, error: ${error}`
    );
  }
}

// Cosine similarity
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
