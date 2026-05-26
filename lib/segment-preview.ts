// Segment Preview System - Handles audio preview for segments
import { SegmentSuggestion } from '@/types';

let currentPreview: any = null;
let currentPreviewA: any = null;
let currentPreviewB: any = null;

/**
 * Preview a segment by playing 10-15 seconds of audio
 */
export function previewSegment(segment: SegmentSuggestion): Promise<void> {
  return new Promise((resolve, reject) => {
    // Stop any existing preview
    stopPreview();

    try {
      // Create audio URL with time range
      // Note: This requires server-side support for range requests
      const audioUrl = `/api/audio/${segment.trackId}?start=${segment.position}&duration=15`;

      const { Howl } = require('howler');
      const sound = new Howl({
        src: [audioUrl],
        html5: true,
        volume: 0.7,
        onend: () => {
          currentPreview = null;
          resolve();
        },
        onerror: (id: number, error: any) => {
          console.error('Preview error:', error);
          currentPreview = null;
          reject(error);
        },
      });

      currentPreview = sound;
      sound.play();
      
      // Seek to segment position if it's not at 0
      // We do this after play() because the backend returns the full file
      if (segment.position > 0) {
        sound.seek(segment.position);
      }
    } catch (error) {
      console.error('Failed to create preview:', error);
      reject(error);
    }
  });
}

export function stopPreview(): void {
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
  return (currentPreview !== null && currentPreview.playing()) || 
         (currentPreviewA !== null && currentPreviewA.playing()) || 
         (currentPreviewB !== null && currentPreviewB.playing());
}

/**
 * Preview a transition between two tracks
 */
export function previewTransition(trackAId: string, trackBId: string, fromPos: number, toPos: number): Promise<void> {
  return new Promise((resolve, reject) => {
    stopPreview();

    try {
      const { Howl } = require('howler');
      
      const startA = Math.max(0, fromPos - 8); // Start 8s before transition
      const durationA = 12; // Let it run a bit past transition
      
      const audioUrlA = `/api/audio/${trackAId}?start=${startA}&duration=${durationA}`;
      const audioUrlB = `/api/audio/${trackBId}?start=${toPos}&duration=10`;

      const soundA = new Howl({
        src: [audioUrlA],
        html5: true,
        volume: 0.8,
        onend: () => {
          if (!currentPreviewB || !currentPreviewB.playing()) resolve();
        },
        onerror: (id: number, error: any) => reject(error)
      });

      const soundB = new Howl({
        src: [audioUrlB],
        html5: true,
        volume: 0.0,
        onend: () => {
          resolve();
        },
        onerror: (id: number, error: any) => reject(error)
      });

      currentPreviewA = soundA;
      currentPreviewB = soundB;

      soundA.play();
      if (startA > 0) {
        soundA.seek(startA);
      }

      // At 8s mark, start fading A out and play B fading in
      setTimeout(() => {
        if (currentPreviewA === soundA) {
          soundA.fade(0.8, 0, 4000); // 4-second fade out
          soundB.play();
          if (toPos > 0) {
            soundB.seek(toPos);
          }
          soundB.fade(0, 0.8, 4000); // 4-second fade in
        }
      }, 8000);

    } catch (error) {
      console.error('Failed to create transition preview:', error);
      reject(error);
    }
  });
}
