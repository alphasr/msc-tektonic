// Segment Preview System - Handles audio preview for segments
import { Howl } from 'howler';
import { SegmentSuggestion } from '@/types';

let currentPreview: Howl | null = null;
let currentPreviewA: Howl | null = null;
let currentPreviewB: Howl | null = null;
let previewTimers: ReturnType<typeof setTimeout>[] = [];

function clearPreviewTimers(): void {
  previewTimers.forEach(clearTimeout);
  previewTimers = [];
}

/**
 * Preview a segment by playing ~15 seconds of audio
 */
export function previewSegment(segment: SegmentSuggestion): Promise<void> {
  return new Promise((resolve, reject) => {
    // Stop any existing preview
    stopPreview();

    try {
      const PREVIEW_DURATION = 15; // seconds

      // Note: the API ignores start/duration and returns the full file —
      // seeking and duration enforcement happen client-side below
      const audioUrl = `/api/audio/${segment.trackId}?start=${segment.position}&duration=${PREVIEW_DURATION}`;

      const sound = new Howl({
        src: [audioUrl],
        html5: true,
        volume: 0.7,
        onend: () => {
          currentPreview = null;
          resolve();
        },
        onloaderror: (_id: number, error: unknown) => {
          console.error('Preview load error:', error);
          currentPreview = null;
          reject(error);
        },
        onplayerror: (_id: number, error: unknown) => {
          console.error('Preview play error:', error);
          currentPreview = null;
          reject(error);
        },
      });

      currentPreview = sound;

      // Seek once playback has actually started — an immediate seek after
      // play() can be reset when the HTML5 element spins up
      if (segment.position > 0) {
        sound.once('play', () => sound.seek(segment.position));
      }
      sound.play();

      // The server returns the full file, so cut the preview off ourselves
      previewTimers.push(
        setTimeout(() => {
          if (currentPreview === sound) {
            stopPreview();
            resolve();
          }
        }, PREVIEW_DURATION * 1000)
      );
    } catch (error) {
      console.error('Failed to create preview:', error);
      reject(error);
    }
  });
}

export function stopPreview(): void {
  clearPreviewTimers();
  if (currentPreview) {
    currentPreview.stop();
    currentPreview.unload();
    currentPreview = null;
  }
  if (currentPreviewA) {
    currentPreviewA.stop();
    currentPreviewA.unload();
    currentPreviewA = null;
  }
  if (currentPreviewB) {
    currentPreviewB.stop();
    currentPreviewB.unload();
    currentPreviewB = null;
  }
}

/**
 * Check if a preview is currently playing
 */
export function isPreviewing(): boolean {
  return (
    (currentPreview !== null && currentPreview.playing()) ||
    (currentPreviewA !== null && currentPreviewA.playing()) ||
    (currentPreviewB !== null && currentPreviewB.playing())
  );
}

/**
 * Preview a transition between two tracks:
 * 8s of track A → 4s crossfade → ~6s of track B (18s total).
 */
export function previewTransition(
  trackAId: string,
  trackBId: string,
  fromPos: number,
  toPos: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    stopPreview();

    try {
      const startA = Math.max(0, fromPos - 8); // Start 8s before transition
      const A_WINDOW = 12_000; // A plays 8s solo + 4s fade-out
      const TOTAL = 18_000; // B fades in at 8s and runs ~10s

      const audioUrlA = `/api/audio/${trackAId}?start=${startA}&duration=12`;
      const audioUrlB = `/api/audio/${trackBId}?start=${toPos}&duration=10`;

      const soundA = new Howl({
        src: [audioUrlA],
        html5: true,
        volume: 0.8,
        onloaderror: (_id: number, error: unknown) => reject(error),
        onplayerror: (_id: number, error: unknown) => reject(error),
      });

      const soundB = new Howl({
        src: [audioUrlB],
        html5: true,
        volume: 0.0,
        onloaderror: (_id: number, error: unknown) => reject(error),
        onplayerror: (_id: number, error: unknown) => reject(error),
      });

      currentPreviewA = soundA;
      currentPreviewB = soundB;

      if (startA > 0) {
        soundA.once('play', () => soundA.seek(startA));
      }
      soundA.play();

      // At 8s, fade A out and bring B in
      previewTimers.push(
        setTimeout(() => {
          if (currentPreviewA !== soundA) return;
          soundA.fade(0.8, 0, 4000);
          if (toPos > 0) {
            soundB.once('play', () => soundB.seek(toPos));
          }
          soundB.play();
          soundB.fade(0, 0.8, 4000);
        }, 8000)
      );

      // A's window is over once the fade completes (server sends the full file)
      previewTimers.push(
        setTimeout(() => {
          if (currentPreviewA === soundA) {
            soundA.stop();
            soundA.unload();
            currentPreviewA = null;
          }
        }, A_WINDOW)
      );

      // End of the whole preview
      previewTimers.push(
        setTimeout(() => {
          if (currentPreviewB === soundB) {
            stopPreview();
          }
          resolve();
        }, TOTAL)
      );
    } catch (error) {
      console.error('Failed to create transition preview:', error);
      reject(error);
    }
  });
}
