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
  // Real-time AI enhancements
  mlScore?: number; // ML-predicted compatibility score
  optimalTransitionTime?: number; // Seconds remaining until optimal mix point
  explanation?: string; // Natural language explanation from LLM
  frequencyConflict?: number; // 0-1, how much this clashes with current deck
  cuePoint?: number; // Beat-aligned entry point (adjusted from position)
}

// Real-time ML Feature Vector (64-dim extracted every frame)
export interface AudioFeatures {
  timestamp: number; // Playback position in seconds
  // Frequency spectrum (32 bins from FFT)
  spectrum: Float32Array; // 32 frequency bins (0-1 normalized)
  // Derived features
  spectralCentroid: number; // Center of mass of spectrum
  spectralFlux: number; // Rate of change in spectrum
  energy: number; // RMS energy
  energyDelta: number; // Change in energy from previous frame
  tempoDelta: number; // Deviation from track BPM
  // Frequency bands
  low: number; // <250Hz energy
  mid: number; // 250-8000Hz energy
  high: number; // >8000Hz energy
  // Context
  deckId: 'A' | 'B';
  trackId: string;
}

// LLM Prediction from local phi-4-mini
export interface LLMPrediction {
  timestamp: number;
  trackId: string;
  position: number;
  // Predictions
  suggestedSegments: Array<{
    trackId: string;
    position: number;
    confidence: number; // 0-1
    optimalTransitionTime: number; // Seconds until best mix point
    reasoning: string;
  }>;
  // Context boost multipliers
  contextBoosts: Map<string, number>; // trackId -> boost (0.5-2.0)
  // Explanations
  transitionExplanation: string;
  energyTrend: 'rising' | 'falling' | 'stable';
  mixingAdvice: string;
}

// Mix History for context learning
export interface MixHistoryEntry {
  timestamp: number;
  fromTrackId: string;
  fromPosition: number;
  toTrackId: string;
  toPosition: number;
  features: AudioFeatures;
  userSelected: boolean; // vs auto-suggested
}

// Performance monitoring
export interface MLPerformanceMetrics {
  frameRate: number; // Current fps
  avgInferenceTime: number; // ms per frame
  workerBacklog: number; // Queued frames
  cpuUsage: number; // Estimated %
  degradationLevel: 'none' | 'minor' | 'moderate' | 'severe';
}
