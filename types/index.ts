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
  rate: number;
}

export interface MixerState {
  deckA: DeckState;
  deckB: DeckState;
  crossfader: number; // -100 to 100
  masterVolume: number;
  masterDeck: 'A' | 'B' | null;
}

export interface PhraseSegment {
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
  start: number;
  end: number;
  energy: number;
}

export interface FrequencyProfile {
  low: number; // Energy in < 250 Hz band (0-1)
  mid: number; // Energy in 250-8000 Hz band (0-1)
  high: number; // Energy in > 8000 Hz band (0-1)
}

export interface BarFrequencyData {
  barIndex: number;
  profile: FrequencyProfile;
  timestamp: number;
}

export interface PhraseFrequencyData {
  phraseIndex: number;
  profile: FrequencyProfile;
  timestamp: number;
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
    frequency: number; // NEW: Frequency compatibility score
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

// MIDI Controller Detection Types

// MIDI Mapping interface (moved here to avoid circular dependency)
export interface MIDIMapping {
  // Deck A Controls
  deckA_play?: number; // Note
  deckA_pause?: number; // Note
  deckA_stop?: number; // Note
  deckA_cue?: number; // Note
  deckA_volume?: number; // CC
  deckA_low?: number; // CC
  deckA_mid?: number; // CC
  deckA_high?: number; // CC
  deckA_hotcue1?: number; // Note
  deckA_hotcue2?: number; // Note
  deckA_hotcue3?: number; // Note
  deckA_hotcue4?: number; // Note
  deckA_loopIn?: number; // Note
  deckA_loopOut?: number; // Note
  deckA_loopRel?: number; // Note
  deckA_loop2x?: number; // Note
  deckA_loop4x?: number; // Note
  deckA_loop8x?: number; // Note
  deckA_jogwheel?: number; // CC or Pitch Bend

  // Deck B Controls
  deckB_play?: number; // Note
  deckB_pause?: number; // Note
  deckB_stop?: number; // Note
  deckB_cue?: number; // Note
  deckB_volume?: number; // CC
  deckB_low?: number; // CC
  deckB_mid?: number; // CC
  deckB_high?: number; // CC
  deckB_hotcue1?: number; // Note
  deckB_hotcue2?: number; // Note
  deckB_hotcue3?: number; // Note
  deckB_hotcue4?: number; // Note
  deckB_loopIn?: number; // Note
  deckB_loopOut?: number; // Note
  deckB_loopRel?: number; // Note
  deckB_loop2x?: number; // Note
  deckB_loop4x?: number; // Note
  deckB_loop8x?: number; // Note
  deckB_jogwheel?: number; // CC or Pitch Bend

  // Mixer Controls
  crossfader?: number; // CC
  masterVolume?: number; // CC
  gainA?: number; // CC
  gainB?: number; // CC

  // Effects (if available)
  fx1?: number; // CC
  fx2?: number; // CC
  fx3?: number; // CC
}

export interface DriverInfo {
  required: boolean;
  os: 'windows' | 'macos' | 'linux' | 'all';
  downloadUrl?: string;
  instructions: string[];
  classCompliant: boolean;
}

export interface ControllerDefinition {
  id: string;
  name: string;
  manufacturer: string;
  namePatterns: string[];
  mapping: MIDIMapping;
  drivers: {
    windows?: DriverInfo;
    macos?: DriverInfo;
    linux?: DriverInfo;
  };
}

export interface DetectedController {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  confidence: 'high' | 'medium' | 'low';
  mapping: MIDIMapping;
  driverInfo?: DriverInfo;
  deviceId?: string;
}

export type DriverStatus = 'installed' | 'needed' | 'unknown' | 'not_required';

// Playlist and Segment Types
export interface PlaylistSegment {
  id: string;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  startTime: number; // Start position in track (seconds)
  endTime: number; // End position in track (seconds)
  duration: number; // Calculated duration
  transitionPoint?: number; // Where to start transition (seconds before end)
  scores: {
    key: number;
    tempo: number;
    energy: number;
    frequency: number;
  };
  order: number; // Position in playlist
}

export interface Playlist {
  id: string;
  name: string;
  segments: PlaylistSegment[];
  createdAt: string;
  totalDuration: number;
  generationMetadata?: {
    reasoning?: string;
    [key: string]: any;
  };
}

export interface SegmentSuggestion {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  position: number; // Start position in track (seconds)
  duration: number; // Suggested segment duration (seconds)
  score: number; // Overall compatibility score
  scores: {
    key: number;
    tempo: number;
    energy: number;
    frequency: number;
    timing: number;
    contour: number;
  };
  waveform?: number[]; // Waveform preview for segment
}
