// Playlist Management System
import { Playlist, PlaylistSegment, SegmentSuggestion } from '@/types';

export class PlaylistManager {
  private playlist: Playlist;
  private listeners: ((playlist: Playlist) => void)[] = [];

  constructor(playlist?: Playlist) {
    if (playlist) {
      this.playlist = playlist;
    } else {
      this.playlist = {
        id: `playlist_${Date.now()}`,
        name: 'New Playlist',
        segments: [],
        createdAt: new Date().toISOString(),
        totalDuration: 0,
      };
    }
  }

  // Add segment to playlist
  addSegment(suggestion: SegmentSuggestion): PlaylistSegment {
    const segment: PlaylistSegment = {
      id: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      trackId: suggestion.trackId,
      trackTitle: suggestion.trackTitle,
      trackArtist: suggestion.trackArtist,
      startTime: suggestion.position,
      endTime: suggestion.position + suggestion.duration,
      duration: suggestion.duration,
      transitionPoint: Math.max(5, suggestion.duration * 0.1), // 10% before end, min 5 seconds
      scores: suggestion.scores,
      order: this.playlist.segments.length,
    };

    this.playlist.segments.push(segment);
    this.updateTotalDuration();
    this.notifyListeners();
    return segment;
  }

  // Remove segment from playlist
  removeSegment(segmentId: string): boolean {
    const index = this.playlist.segments.findIndex((s) => s.id === segmentId);
    if (index === -1) return false;

    this.playlist.segments.splice(index, 1);
    this.reorderSegments();
    this.updateTotalDuration();
    this.notifyListeners();
    return true;
  }

  // Reorder segments (after removal or drag-drop)
  reorderSegments(): void {
    this.playlist.segments.forEach((segment, index) => {
      segment.order = index;
    });
    this.notifyListeners();
  }

  // Move segment to new position
  moveSegment(segmentId: string, newOrder: number): boolean {
    const index = this.playlist.segments.findIndex((s) => s.id === segmentId);
    if (index === -1) return false;

    const segment = this.playlist.segments[index];
    this.playlist.segments.splice(index, 1);
    this.playlist.segments.splice(newOrder, 0, segment);
    this.reorderSegments();
    this.notifyListeners();
    return true;
  }

  // Update segment times
  updateSegmentTimes(
    segmentId: string,
    startTime: number,
    endTime: number
  ): boolean {
    const segment = this.playlist.segments.find((s) => s.id === segmentId);
    if (!segment) return false;

    segment.startTime = startTime;
    segment.endTime = endTime;
    segment.duration = endTime - startTime;
    this.updateTotalDuration();
    this.notifyListeners();
    return true;
  }

  // Clear playlist
  clear(): void {
    this.playlist.segments = [];
    this.updateTotalDuration();
    this.notifyListeners();
  }

  // Get current playlist
  getPlaylist(): Playlist {
    return { ...this.playlist };
  }

  // Get segment by ID
  getSegment(segmentId: string): PlaylistSegment | undefined {
    return this.playlist.segments.find((s) => s.id === segmentId);
  }

  // Get next segment (for auto-transition)
  getNextSegment(currentSegmentId?: string): PlaylistSegment | null {
    if (this.playlist.segments.length === 0) return null;

    if (!currentSegmentId) {
      return this.playlist.segments[0];
    }

    const currentIndex = this.playlist.segments.findIndex(
      (s) => s.id === currentSegmentId
    );
    if (
      currentIndex === -1 ||
      currentIndex >= this.playlist.segments.length - 1
    ) {
      return null;
    }

    return this.playlist.segments[currentIndex + 1];
  }

  // Calculate transition point between two segments
  calculateTransitionPoint(
    currentSegment: PlaylistSegment,
    nextSegment: PlaylistSegment
  ): { startTransition: number; completeTransition: number } {
    // Start transition 5-10 seconds before current segment ends
    const transitionStart = Math.max(
      currentSegment.endTime - (currentSegment.transitionPoint || 5),
      currentSegment.startTime
    );

    // Complete transition at current segment end
    const transitionComplete = currentSegment.endTime;

    return {
      startTransition: transitionStart,
      completeTransition: transitionComplete,
    };
  }

  // Update total duration
  private updateTotalDuration(): void {
    this.playlist.totalDuration = this.playlist.segments.reduce(
      (sum, segment) => sum + segment.duration,
      0
    );
  }

  // Set playlist name
  setName(name: string): void {
    this.playlist.name = name;
    this.notifyListeners();
  }

  // Register listener for playlist changes
  onUpdate(callback: (playlist: Playlist) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners
  private notifyListeners(): void {
    this.listeners.forEach((callback) => {
      try {
        callback(this.getPlaylist());
      } catch (error) {
        console.error('Error in playlist listener:', error);
      }
    });
  }

  // Export playlist as JSON
  export(): string {
    return JSON.stringify(this.playlist, null, 2);
  }

  // Import playlist from JSON
  import(json: string): boolean {
    try {
      const imported = JSON.parse(json) as Playlist;
      this.playlist = imported;
      this.reorderSegments();
      this.updateTotalDuration();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Failed to import playlist:', error);
      return false;
    }
  }
}
