// Auto-Transition System - Handles automatic transitions between playlist segments
import { PlaylistManager } from './playlist-manager';
import { PlaylistSegment, Playlist } from '@/types';
import { AudioManager } from './audio-manager';

export interface AutoTransitionConfig {
  crossfadeDuration: number; // seconds
  preloadTime: number; // seconds before end to start loading next
  transitionStartTime: number; // seconds before end to start crossfade
}

const DEFAULT_CONFIG: AutoTransitionConfig = {
  crossfadeDuration: 4,
  preloadTime: 8,
  transitionStartTime: 5,
};

export class AutoTransitionManager {
  private playlistManager: PlaylistManager;
  private audioManager: AudioManager;
  private config: AutoTransitionConfig;
  private currentSegmentId: string | null = null;
  private currentDeck: 'A' | 'B' = 'A';
  private isTransitioning = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private listeners: ((event: TransitionEvent) => void)[] = [];

  constructor(
    playlistManager: PlaylistManager,
    audioManager: AudioManager,
    config?: Partial<AutoTransitionConfig>
  ) {
    this.playlistManager = playlistManager;
    this.audioManager = audioManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start playing a playlist with auto-transitions
   */
  async startPlaylist(playlist: Playlist): Promise<void> {
    if (playlist.segments.length === 0) {
      throw new Error('Playlist is empty');
    }

    // Start with first segment
    const firstSegment = playlist.segments[0];
    await this.playSegment(firstSegment, 'A');
    this.currentSegmentId = firstSegment.id;
    this.currentDeck = 'A';

    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Play a segment on a specific deck
   */
  private async playSegment(
    segment: PlaylistSegment,
    deck: 'A' | 'B'
  ): Promise<void> {
    const deckInstance = this.audioManager.getDeck(deck);

    if (!deckInstance) {
      throw new Error(`Deck ${deck} not available`);
    }

    // Load and play segment
    // Note: The audio API returns full file, client will handle seeking
    const audioUrl = `/api/audio/${segment.trackId}?start=${segment.startTime}&end=${segment.endTime}`;
    await deckInstance.load(audioUrl);

    // Seek to start time if segment doesn't start at 0
    if (segment.startTime > 0) {
      deckInstance.seek(segment.startTime);
    }

    deckInstance.setVolume(deck === this.currentDeck ? 100 : 0);
    deckInstance.play();

    this.emitEvent({
      type: 'segment_started',
      segment,
      deck,
    });
  }

  /**
   * Start monitoring playback for transitions
   */
  private startMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = setInterval(() => {
      this.checkTransition();
    }, 1000); // Check every second
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Check if transition is needed
   */
  private async checkTransition(): Promise<void> {
    if (!this.currentSegmentId || this.isTransitioning) return;

    const currentSegment = this.playlistManager.getSegment(
      this.currentSegmentId
    );
    if (!currentSegment) return;

    const deckInstance = this.audioManager.getDeck(this.currentDeck);
    if (!deckInstance) return;

    const currentTime = deckInstance.getCurrentTime();
    // Calculate remaining time in segment
    const segmentElapsed = currentTime - currentSegment.startTime;
    const remainingTime = Math.max(0, currentSegment.duration - segmentElapsed);

    // Preload next segment
    if (remainingTime <= this.config.preloadTime) {
      const nextSegment = this.playlistManager.getNextSegment(
        this.currentSegmentId
      );
      if (nextSegment) {
        const nextDeck = this.currentDeck === 'A' ? 'B' : 'A';
        try {
          await this.playSegment(nextSegment, nextDeck);
          this.emitEvent({
            type: 'segment_preloaded',
            segment: nextSegment,
            deck: nextDeck,
          });
        } catch (error) {
          console.error('Failed to preload next segment:', error);
        }
      }
    }

    // Start transition
    if (
      remainingTime <= this.config.transitionStartTime &&
      !this.isTransitioning
    ) {
      await this.executeTransition();
    }

    // Check if segment ended
    if (remainingTime <= 0) {
      await this.handleSegmentEnd();
    }
  }

  /**
   * Execute crossfade transition
   */
  private async executeTransition(): Promise<void> {
    if (this.isTransitioning) return;

    const currentSegment = this.playlistManager.getSegment(
      this.currentSegmentId!
    );
    if (!currentSegment) return;

    const nextSegment = this.playlistManager.getNextSegment(
      this.currentSegmentId!
    );
    if (!nextSegment) {
      // No more segments
      this.stopMonitoring();
      this.emitEvent({
        type: 'playlist_ended',
      });
      return;
    }

    this.isTransitioning = true;
    const nextDeck = this.currentDeck === 'A' ? 'B' : 'A';

    this.emitEvent({
      type: 'transition_started',
      fromSegment: currentSegment,
      toSegment: nextSegment,
    });

    // Perform crossfade
    const currentDeckInstance = this.audioManager.getDeck(this.currentDeck);
    const nextDeckInstance = this.audioManager.getDeck(nextDeck);

    if (!currentDeckInstance || !nextDeckInstance) {
      this.isTransitioning = false;
      return;
    }

    // Crossfade over transition duration
    const steps = 20; // Number of fade steps
    const stepDuration = (this.config.crossfadeDuration * 1000) / steps;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const currentVolume = Math.max(0, 100 * (1 - progress));
      const nextVolume = 100 * progress;

      currentDeckInstance.setVolume(currentVolume);
      nextDeckInstance.setVolume(nextVolume);

      if (i < steps) {
        await new Promise((resolve) => setTimeout(resolve, stepDuration));
      }
    }

    // Stop current deck
    currentDeckInstance.stop();

    // Update state
    this.currentSegmentId = nextSegment.id;
    this.currentDeck = nextDeck;
    this.isTransitioning = false;

    this.emitEvent({
      type: 'transition_completed',
      segment: nextSegment,
      deck: nextDeck,
    });
  }

  /**
   * Handle segment end
   */
  private async handleSegmentEnd(): Promise<void> {
    const nextSegment = this.playlistManager.getNextSegment(
      this.currentSegmentId!
    );
    if (!nextSegment) {
      // Playlist ended
      this.stopMonitoring();
      this.emitEvent({
        type: 'playlist_ended',
      });
      return;
    }

    // If transition didn't complete, do it now
    if (!this.isTransitioning) {
      await this.executeTransition();
    }
  }

  /**
   * Register event listener
   */
  onEvent(callback: (event: TransitionEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: TransitionEvent): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in transition event listener:', error);
      }
    });
  }

  /**
   * Stop auto-transition
   */
  stop(): void {
    this.stopMonitoring();
    this.currentSegmentId = null;
    this.isTransitioning = false;
  }
}

export type TransitionEvent =
  | { type: 'segment_started'; segment: PlaylistSegment; deck: 'A' | 'B' }
  | { type: 'segment_preloaded'; segment: PlaylistSegment; deck: 'A' | 'B' }
  | {
      type: 'transition_started';
      fromSegment: PlaylistSegment;
      toSegment: PlaylistSegment;
    }
  | { type: 'transition_completed'; segment: PlaylistSegment; deck: 'A' | 'B' }
  | { type: 'playlist_ended' };
