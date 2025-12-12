export interface Track {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  energy: number;
  duration: number;
  tags: string[];
  phrases: number;
  audioUrl?: string;
  waveform: number[]; // Real waveform data from analysis
}

export interface DeckState {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  eq: {
    low: number;
    mid: number;
    high: number;
  };
}

export interface MixerState {
  deckA: DeckState;
  deckB: DeckState;
  crossfader: number; // -100 to 100
  masterVolume: number;
}

export interface PhraseSegment {
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
  start: number;
  end: number;
  energy: number;
}

export interface TransitionCandidate {
  from_position: number; // phrase end in track A
  to_position: number; // phrase start in track B
  score: number;
  scores: {
    key: number;
    energy: number;
    timing: number;
    contour: number;
    tempo: number;
  };
}

export interface SystemStatus {
  backend: 'operational' | 'degraded' | 'outage';
  database: 'operational' | 'degraded' | 'outage';
  storage: 'operational' | 'degraded' | 'outage';
  analysis: 'operational' | 'degraded' | 'outage';
  latency?: number;
}

export interface Stats {
  totalTracks: number;
  storageUsed: number;
  averageDuration: number;
  totalDuration: number;
  averageTempo: number;
  averagePhrases: number;
  shortestTrack: Track | null;
  longestTrack: Track | null;
  tracksWithTitles: number;
  averageFileSize: number;
  directoryBreakdown: Record<string, number>;
  recentTracks: Track[];
}

