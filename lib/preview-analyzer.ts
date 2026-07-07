/**
 * Analyzes a Spotify 30-second preview URL to extract tempo, key, and energy
 * without relying on deprecated Spotify audio-analysis or audio-features endpoints.
 *
 * Pipeline:
 *   1. Download the MP3 preview (fetch with 20 s timeout)
 *   2. Decode to raw mono float32 PCM at 44 100 Hz via the bundled ffmpeg binary
 *   3. BPM  — Beatroot algorithm via the `music-tempo` package
 *   4. Key  — Goertzel-based chromagram + Krumhansl-Schmuckler key profiles
 *   5. Energy — RMS amplitude scaled to 0-10
 */

import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { spotifyKeyToCamelot } from './spotify';

const SAMPLE_RATE = 44100; // must match music-tempo's implicit assumption

/** Fundamental frequencies for C2 through B2 (one per pitch class). */
const BASE_FREQS = [
  65.41, 69.3, 73.42, 77.78, 82.41, 87.31, 92.5, 98.0, 103.83, 110.0, 116.54,
  123.47,
];

/** Krumhansl-Schmuckler key profiles. */
const KS_MAJOR = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const KS_MINOR = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

export interface PreviewAnalysis {
  tempo_bpm: number;
  key: string; // Camelot notation e.g. "8B" — matches the rest of the app
  energy: number; // 0–10 scale
}

/**
 * Goertzel algorithm — computes the squared DFT magnitude at a single
 * target frequency without needing a full FFT.
 */
function goertzel(
  samples: Float32Array,
  targetFreq: number,
  sampleRate: number,
): number {
  const omega = (2 * Math.PI * targetFreq) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let s1 = 0,
    s2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - s1 * s2 * coeff;
}

/**
 * Builds a 12-bin chroma vector (C=0 … B=11) by summing Goertzel energy
 * across five octaves (C2-B6), then normalises to [0, 1].
 */
function computeChroma(samples: Float32Array, sampleRate: number): number[] {
  const chroma = new Array<number>(12).fill(0);
  for (let note = 0; note < 12; note++) {
    for (let octave = 0; octave < 5; octave++) {
      const freq = BASE_FREQS[note] * Math.pow(2, octave);
      if (freq >= sampleRate / 2) break; // above Nyquist
      chroma[note] += goertzel(samples, freq, sampleRate);
    }
  }
  const maxVal = Math.max(...chroma);
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= maxVal;
  }
  return chroma;
}

/** Pearson correlation between two equal-length arrays. */
function pearsonCorr(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0,
    va = 0,
    vb = 0;
  for (let i = 0; i < n; i++) {
    const ra = a[i] - ma,
      rb = b[i] - mb;
    num += ra * rb;
    va += ra * ra;
    vb += rb * rb;
  }
  return va === 0 || vb === 0 ? 0 : num / Math.sqrt(va * vb);
}

/**
 * Krumhansl-Schmuckler key-finding: rotates the chroma vector to every
 * root position and picks the major/minor profile with the highest correlation.
 * Returns the key in Camelot notation (e.g. "8B").
 */
function detectKey(chroma: number[]): string {
  let bestKey = 0,
    bestMode = 'maj',
    bestCorr = -Infinity;
  for (let root = 0; root < 12; root++) {
    const rotated = [...chroma.slice(root), ...chroma.slice(0, root)];
    const maj = pearsonCorr(rotated, KS_MAJOR);
    const min = pearsonCorr(rotated, KS_MINOR);
    if (maj > bestCorr) {
      bestCorr = maj;
      bestKey = root;
      bestMode = 'maj';
    }
    if (min > bestCorr) {
      bestCorr = min;
      bestKey = root;
      bestMode = 'min';
    }
  }
  return spotifyKeyToCamelot(bestKey, bestMode === 'maj' ? 1 : 0);
}

/**
 * RMS amplitude of the audio, mapped to a 0-10 energy scale.
 * Typical normalised audio RMS sits between 0.05 and 0.30, so the
 * multiplier of 35 maps that range to roughly 1.75-10.5 (clamped to 10).
 */
function computeEnergy(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.min(10, Math.sqrt(sum / samples.length) * 35);
}

/**
 * Download and analyse a Spotify 30-second preview MP3.
 * Returns `null` if the URL is unreachable or analysis fails for any reason.
 */
export async function analyzePreviewUrl(
  previewUrl: string,
): Promise<PreviewAnalysis | null> {
  const ts = Date.now();
  const tmpMp3 = path.join(os.tmpdir(), `sp_pre_${ts}.mp3`);
  const tmpPcm = path.join(os.tmpdir(), `sp_pre_${ts}.raw`);

  try {
    // 1. Download preview MP3
    const res = await fetch(previewUrl, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 1024) return null; // suspiciously small
    await fs.writeFile(tmpMp3, buf);

    // 2. Decode to raw mono float32 PCM at 44 100 Hz via ffmpeg
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg') as {
      path: string;
    };
    execFileSync(
      ffmpegInstaller.path,
      [
        '-i',
        tmpMp3,
        '-ac',
        '1', // mono
        '-ar',
        String(SAMPLE_RATE),
        '-f',
        'f32le', // raw IEEE 32-bit float little-endian
        '-y',
        tmpPcm,
      ],
      { stdio: 'pipe' },
    );

    // 3. Load PCM into Float32Array
    const pcmBuf = await fs.readFile(tmpPcm);
    const samples = new Float32Array(
      pcmBuf.buffer,
      pcmBuf.byteOffset,
      Math.floor(pcmBuf.byteLength / 4),
    );
    if (samples.length < SAMPLE_RATE) return null; // less than 1 second of audio

    // 4. BPM via Beatroot algorithm (music-tempo)
    // music-tempo assumes 44 100 Hz with hopSize=441 (= 10 ms/frame), so
    // using SAMPLE_RATE = 44100 matches its internal timeStep default of 0.01 s.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MusicTempo = require('music-tempo') as new (
      data: Float32Array | number[],
    ) => { tempo: number | string };
    const mt = new MusicTempo(samples);
    const tempo_bpm = Math.round(Number(mt.tempo) || 0);

    // 5. RMS energy scaled 0-10
    const energy = computeEnergy(samples);

    // 6. Key detection via chromagram + Krumhansl-Schmuckler
    const chroma = computeChroma(samples, SAMPLE_RATE);
    const key = detectKey(chroma);

    return { tempo_bpm, key, energy };
  } catch {
    return null;
  } finally {
    await fs.unlink(tmpMp3).catch(() => {});
    await fs.unlink(tmpPcm).catch(() => {});
  }
}
