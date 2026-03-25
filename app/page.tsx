'use client';

import { useState, useEffect, useRef } from 'react';
import Navigation from '@/components/Navigation';
import StatusBar from '@/components/StatusBar';
import Deck from '@/components/Deck';
import CentralMixer from '@/components/CentralMixer';
import TrackLibrary from '@/components/TrackLibrary';
import TrackRecommendations from '@/components/TrackRecommendations';
import NaturalLanguageQuery from '@/components/NaturalLanguageQuery';
import {
  Track,
  DeckState,
  MixerState,
  SystemStatus,
  SegmentSuggestion,
  Playlist,
  PlaylistSegment,
} from '@/types';
import { getAudioManager, AudioManager } from '@/lib/audio-manager';
import { getMIDIController } from '@/lib/midi-controller';
import { PlaylistManager } from '@/lib/playlist-manager';
import { AutoTransitionManager } from '@/lib/auto-transition';
import SegmentSuggestions from '@/components/SegmentSuggestions';
import PlaylistBuilder from '@/components/PlaylistBuilder';
import { previewSegment, stopPreview, previewTransition } from '@/lib/segment-preview';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [mixerState, setMixerState] = useState<MixerState>({
    deckA: {
      track: null,
      isPlaying: false,
      currentTime: 0,
      volume: 50,
      eq: { low: 0, mid: 0, high: 0 },
    },
    deckB: {
      track: null,
      isPlaying: false,
      currentTime: 0,
      volume: 50,
      eq: { low: 0, mid: 0, high: 0 },
    },
    crossfader: 0,
    masterVolume: 50,
  });

  const [tracks, setTracks] = useState<Track[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: 'operational',
    database: 'operational',
    storage: 'degraded',
    analysis: 'operational',
    latency: 4.8,
  });

  const audioManagerRef = useRef<AudioManager | null>(null);
  const deckARef = useRef<ReturnType<AudioManager['createDeck']> | null>(null);
  const deckBRef = useRef<ReturnType<AudioManager['createDeck']> | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const midiControllerRef = useRef<ReturnType<typeof getMIDIController> | null>(
    null
  );

  // Live mode state
  const [liveMode, setLiveMode] = useState<'manual' | 'live'>('manual');

  const playlistManagerRef = useRef<PlaylistManager | null>(null);
  const autoTransitionRef = useRef<AutoTransitionManager | null>(null);

  // Initialize audio manager and MIDI controller
  useEffect(() => {
    audioManagerRef.current = getAudioManager();
    deckARef.current = audioManagerRef.current.createDeck('A');
    deckBRef.current = audioManagerRef.current.createDeck('B');

    // Initialize playlist manager
    playlistManagerRef.current = new PlaylistManager();

    // Initialize MIDI controller
    midiControllerRef.current = getMIDIController();
    midiControllerRef.current.initialize().then((success) => {
      if (success) {
        console.log('MIDI controller connected');
        // Setup handlers after a short delay to ensure function is defined
        setTimeout(() => {
          if (
            midiControllerRef.current &&
            midiControllerRef.current.getInitialized()
          ) {
            setupMIDIHandlers();
          }
        }, 200);
      } else {
        console.warn('MIDI controller not available');
      }
    });

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      // Don't dispose audio manager on unmount - it's a singleton
      // Only dispose decks if needed
      if (deckARef.current) {
        deckARef.current.dispose();
        deckARef.current = null;
      }
      if (deckBRef.current) {
        deckBRef.current.dispose();
        deckBRef.current = null;
      }
      if (midiControllerRef.current) {
        midiControllerRef.current.dispose();
        midiControllerRef.current = null;
      }
      if (autoTransitionRef.current) {
        autoTransitionRef.current.stop();
        autoTransitionRef.current = null;
      }
      stopPreview();
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Timestamp of last user-initiated play/pause/stop action.
  // The progress interval will NOT override isPlaying state for 200ms after a user action,
  // preventing the race where the audio engine hasn't processed the command yet.
  const lastUserActionRef = useRef<number>(0);

  // Handler functions (must be defined before MIDI setup)
  const handlePlay = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) return;

    // Read current state synchronously to check for track
    setMixerState((prev) => {
      if (!prev[deckKey].track) {
        console.warn(`Cannot play: No track loaded on deck ${deck}`);
        return prev;
      }
      return {
        ...prev,
        [deckKey]: { ...prev[deckKey], isPlaying: true },
      };
    });

    // Side effect OUTSIDE the updater
    lastUserActionRef.current = Date.now();
    deckRef.play();
  };

  const handlePause = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) return;

    // Side effect first, then update state
    lastUserActionRef.current = Date.now();
    deckRef.pause();
    setMixerState((prev) => ({
      ...prev,
      [deckKey]: { ...prev[deckKey], isPlaying: false },
    }));
  };

  const handleStop = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (deckRef) {
      lastUserActionRef.current = Date.now();
      deckRef.stop();
      setMixerState((prev) => ({
        ...prev,
        [deckKey]: {
          ...prev[deckKey],
          isPlaying: false,
          currentTime: 0,
        },
      }));
    }
  };

  const handleCue = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (deckRef) {
      lastUserActionRef.current = Date.now();
      deckRef.seek(0);
      deckRef.pause();
      setMixerState((prev) => ({
        ...prev,
        [deckKey]: {
          ...prev[deckKey],
          isPlaying: false,
          currentTime: 0,
        },
      }));
    }
  };

  // Setup MIDI event handlers (defined after handler functions)
  const setupMIDIHandlers = () => {
    if (
      !midiControllerRef.current ||
      !midiControllerRef.current.getInitialized()
    ) {
      console.warn('MIDI not initialized yet, cannot setup handlers');
      return;
    }

    const midi = midiControllerRef.current;
    console.log('Setting up MIDI handlers...');

    // Deck A controls
    const handleDeckAPlay = () => handlePlay('A');
    const handleDeckAPause = () => handlePause('A');
    const handleDeckAStop = () => handleStop('A');
    const handleDeckACue = () => handleCue('A');
    const handleDeckAVolume = (value: number) => {
      setMixerState((prev) => ({
        ...prev,
        deckA: { ...prev.deckA, volume: value },
      }));
      if (deckARef.current) {
        deckARef.current.setVolume(value);
      }
    };
    const handleDeckALow = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckA: { ...prev.deckA, eq: { ...prev.deckA.eq, low: value } },
        };
        if (deckARef.current) {
          deckARef.current.setEQ(newState.deckA.eq);
        }
        return newState;
      });
    };
    const handleDeckAMid = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckA: { ...prev.deckA, eq: { ...prev.deckA.eq, mid: value } },
        };
        if (deckARef.current) {
          deckARef.current.setEQ(newState.deckA.eq);
        }
        return newState;
      });
    };
    const handleDeckAHigh = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckA: { ...prev.deckA, eq: { ...prev.deckA.eq, high: value } },
        };
        if (deckARef.current) {
          deckARef.current.setEQ(newState.deckA.eq);
        }
        return newState;
      });
    };

    // Deck B controls
    const handleDeckBPlay = () => handlePlay('B');
    const handleDeckBPause = () => handlePause('B');
    const handleDeckBStop = () => handleStop('B');
    const handleDeckBCue = () => handleCue('B');
    const handleDeckBVolume = (value: number) => {
      setMixerState((prev) => ({
        ...prev,
        deckB: { ...prev.deckB, volume: value },
      }));
      if (deckBRef.current) {
        deckBRef.current.setVolume(value);
      }
    };
    const handleDeckBLow = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckB: { ...prev.deckB, eq: { ...prev.deckB.eq, low: value } },
        };
        if (deckBRef.current) {
          deckBRef.current.setEQ(newState.deckB.eq);
        }
        return newState;
      });
    };
    const handleDeckBMid = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckB: { ...prev.deckB, eq: { ...prev.deckB.eq, mid: value } },
        };
        if (deckBRef.current) {
          deckBRef.current.setEQ(newState.deckB.eq);
        }
        return newState;
      });
    };
    const handleDeckBHigh = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckB: { ...prev.deckB, eq: { ...prev.deckB.eq, high: value } },
        };
        if (deckBRef.current) {
          deckBRef.current.setEQ(newState.deckB.eq);
        }
        return newState;
      });
    };

    // Mixer controls
    const handleCrossfader = (value: number) => {
      setMixerState((prev) => ({ ...prev, crossfader: value }));
      if (audioManagerRef.current) {
        audioManagerRef.current.setCrossfader(value);
      }
    };
    const handleMasterVolume = (value: number) => {
      setMixerState((prev) => ({ ...prev, masterVolume: value }));
      if (audioManagerRef.current) {
        audioManagerRef.current.setMasterVolume(value);
      }
    };

    // Jogwheel controls
    const handleJogwheelA = (value: number) => {
      if (deckARef.current && deckARef.current.isPlaying()) {
        const currentTime = deckARef.current.getCurrentTime();
        const newTime = currentTime + value * 0.1;
        deckARef.current.seek(Math.max(0, newTime));
      }
    };
    const handleJogwheelB = (value: number) => {
      if (deckBRef.current && deckBRef.current.isPlaying()) {
        const currentTime = deckBRef.current.getCurrentTime();
        const newTime = currentTime + value * 0.1;
        deckBRef.current.seek(Math.max(0, newTime));
      }
    };

    // Hot Cue handlers (placeholder - can be extended later)
    const handleHotCue = (deck: 'A' | 'B', cueNumber: number) => {
      console.log(`🎯 Hot Cue ${cueNumber} pressed on Deck ${deck}`);
      // TODO: Implement hot cue functionality
      // This would set/trigger cue points at specific positions
    };

    // Loop handlers (placeholder - can be extended later)
    const handleLoop = (deck: 'A' | 'B', loopType: string) => {
      console.log(`🔁 Loop ${loopType} on Deck ${deck}`);
      // TODO: Implement loop functionality
      // This would create/manage loops at current position
    };

    // Register all handlers
    // Transport controls
    midi.on('deckA_play', handleDeckAPlay);
    midi.on('deckA_pause', handleDeckAPause);
    midi.on('deckA_stop', handleDeckAStop);
    midi.on('deckA_cue', handleDeckACue);
    midi.on('deckB_play', handleDeckBPlay);
    midi.on('deckB_pause', handleDeckBPause);
    midi.on('deckB_stop', handleDeckBStop);
    midi.on('deckB_cue', handleDeckBCue);

    // Volume and EQ
    midi.on('deckA_volume', handleDeckAVolume);
    midi.on('deckA_low', handleDeckALow);
    midi.on('deckA_mid', handleDeckAMid);
    midi.on('deckA_high', handleDeckAHigh);
    midi.on('deckB_volume', handleDeckBVolume);
    midi.on('deckB_low', handleDeckBLow);
    midi.on('deckB_mid', handleDeckBMid);
    midi.on('deckB_high', handleDeckBHigh);

    // Mixer
    midi.on('crossfader', handleCrossfader);
    midi.on('masterVolume', handleMasterVolume);

    // Jogwheels
    midi.on('jogwheelA', handleJogwheelA);
    midi.on('jogwheelB', handleJogwheelB);

    // Hot Cues
    midi.on('deckA_hotcue1', () => handleHotCue('A', 1));
    midi.on('deckA_hotcue2', () => handleHotCue('A', 2));
    midi.on('deckA_hotcue3', () => handleHotCue('A', 3));
    midi.on('deckA_hotcue4', () => handleHotCue('A', 4));
    midi.on('deckB_hotcue1', () => handleHotCue('B', 1));
    midi.on('deckB_hotcue2', () => handleHotCue('B', 2));
    midi.on('deckB_hotcue3', () => handleHotCue('B', 3));
    midi.on('deckB_hotcue4', () => handleHotCue('B', 4));

    // Loops
    midi.on('deckA_loopIn', () => handleLoop('A', 'In'));
    midi.on('deckA_loopOut', () => handleLoop('A', 'Out'));
    midi.on('deckA_loopRel', () => handleLoop('A', 'Rel'));
    midi.on('deckA_loop2x', () => handleLoop('A', '2x'));
    midi.on('deckA_loop4x', () => handleLoop('A', '4x'));
    midi.on('deckA_loop8x', () => handleLoop('A', '8x'));
    midi.on('deckB_loopIn', () => handleLoop('B', 'In'));
    midi.on('deckB_loopOut', () => handleLoop('B', 'Out'));
    midi.on('deckB_loopRel', () => handleLoop('B', 'Rel'));
    midi.on('deckB_loop2x', () => handleLoop('B', '2x'));
    midi.on('deckB_loop4x', () => handleLoop('B', '4x'));
    midi.on('deckB_loop8x', () => handleLoop('B', '8x'));

    console.log('✅ All MIDI handlers registered successfully!');
  };

  // Also try to setup on mount if already initialized
  useEffect(() => {
    if (
      midiControllerRef.current &&
      midiControllerRef.current.getInitialized()
    ) {
      setupMIDIHandlers();
    }
  }, []);

  useEffect(() => {
    fetchTracks();
    fetchSystemStatus();

    const interval = setInterval(() => {
      fetchTracks();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Start progress tracking when any deck starts playing
  useEffect(() => {
    const isAnyPlaying =
      mixerState.deckA.isPlaying || mixerState.deckB.isPlaying;
    if (isAnyPlaying) {
      updateProgress();
    } else {
      // Clear interval when nothing is playing
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };
  }, [mixerState.deckA.isPlaying, mixerState.deckB.isPlaying]);

  const fetchTracks = async () => {
    try {
      const response = await fetch('/api/tracks');
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched tracks:', data.length, 'tracks');
        setTracks(data);
      } else {
        console.error('Failed to fetch tracks: HTTP', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
        setTracks([]);
      }
    } catch (error) {
      console.error('Failed to fetch tracks:', error);
      setTracks([]);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setSystemStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  const updateProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressInterval.current = setInterval(() => {
      // Don't override isPlaying state within 200ms of a user action
      // (the audio engine may not have processed the command yet)
      const isInDebounceWindow = Date.now() - lastUserActionRef.current < 200;

      setMixerState((prev) => {
        let deckAUpdates: Partial<DeckState> | null = null;
        let deckBUpdates: Partial<DeckState> | null = null;

        if (deckARef.current) {
          const actualCurrentTime = deckARef.current.getCurrentTime();

          // Only sync isPlaying from audio engine if NOT in debounce window
          if (!isInDebounceWindow) {
            const actualIsPlaying = deckARef.current.isPlaying();
            if (actualIsPlaying !== prev.deckA.isPlaying) {
              deckAUpdates = { ...(deckAUpdates || {}), isPlaying: actualIsPlaying };
            }
          }

          if (Math.abs(actualCurrentTime - prev.deckA.currentTime) > 0.05) {
            deckAUpdates = { ...(deckAUpdates || {}), currentTime: actualCurrentTime };
          }
          // Auto-stop at end of track
          if (prev.deckA.track && actualCurrentTime >= prev.deckA.track.duration - 0.1 && prev.deckA.isPlaying) {
            deckAUpdates = { ...(deckAUpdates || {}), isPlaying: false, currentTime: 0 };
            deckARef.current.stop();
          }
        }
        if (deckBRef.current) {
          const actualCurrentTime = deckBRef.current.getCurrentTime();

          if (!isInDebounceWindow) {
            const actualIsPlaying = deckBRef.current.isPlaying();
            if (actualIsPlaying !== prev.deckB.isPlaying) {
              deckBUpdates = { ...(deckBUpdates || {}), isPlaying: actualIsPlaying };
            }
          }

          if (Math.abs(actualCurrentTime - prev.deckB.currentTime) > 0.05) {
            deckBUpdates = { ...(deckBUpdates || {}), currentTime: actualCurrentTime };
          }
          if (prev.deckB.track && actualCurrentTime >= prev.deckB.track.duration - 0.1 && prev.deckB.isPlaying) {
            deckBUpdates = { ...(deckBUpdates || {}), isPlaying: false, currentTime: 0 };
            deckBRef.current.stop();
          }
        }

        if (!deckAUpdates && !deckBUpdates) return prev;

        return {
          ...prev,
          deckA: deckAUpdates ? { ...prev.deckA, ...deckAUpdates } : prev.deckA,
          deckB: deckBUpdates ? { ...prev.deckB, ...deckBUpdates } : prev.deckB,
        };
      });
    }, 50);
  };

  const loadTrack = async (track: Track, deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) {
      console.error(`Deck ${deck} not initialized`);
      alert(`Deck ${deck} is not ready. Please refresh the page.`);
      return;
    }

    try {
      console.log(`Loading track "${track.title}" into Deck ${deck}...`);

      // Stop current playback before loading new track
      if (deckRef.isPlaying()) {
        deckRef.stop();
      }

      // Clear previous event handlers to prevent leaks
      deckRef.off('end');

      // Update state immediately to show loading
      setMixerState((prev) => ({
        ...prev,
        [deckKey]: {
          ...prev[deckKey],
          track,
          currentTime: 0,
          isPlaying: false,
        },
      }));

      const audioUrl = `/api/audio/${track.id}`;
      await deckRef.load(audioUrl);

      // Set up event handler for track end
      deckRef.on('end', () => {
        setMixerState((prev) => ({
          ...prev,
          [deckKey]: {
            ...prev[deckKey],
            isPlaying: false,
            currentTime: 0,
          },
        }));
      });

      // Apply current volume and EQ using functional updater to read fresh state
      setMixerState((prev) => {
        const currentDeckState = prev[deckKey];
        deckRef.setVolume(currentDeckState.volume);
        deckRef.setEQ(currentDeckState.eq);
        return prev; // No state change, just read
      });

      console.log(
        `✅ Track "${track.title}" loaded successfully into Deck ${deck}`
      );
    } catch (error: any) {
      console.error(`❌ Failed to load track on deck ${deck}:`, error);
      const errorMessage = error?.message || 'Unknown error';
      alert(
        `Failed to load track "${track.title}": ${errorMessage}\n\nMake sure the track has been analyzed and the audio file exists.`
      );

      // Clear the track from state on error
      setMixerState((prev) => ({
        ...prev,
        [deckKey]: {
          ...prev[deckKey],
          track: null,
          isPlaying: false,
          currentTime: 0,
        },
      }));
    }
  };

  const handleEject = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (deckRef) {
      // Clear event handlers before disposing
      deckRef.off('end');
      deckRef.stop();
      deckRef.dispose();

      // Recreate the deck audio instance
      const newDeck = audioManagerRef.current?.createDeck(deck) || null;
      if (deck === 'A') {
        deckARef.current = newDeck;
      } else {
        deckBRef.current = newDeck;
      }

      // Preserve volume and EQ, clear track
      setMixerState((prev) => {
        const prevDeck = prev[deckKey];
        // Apply preserved settings to new deck instance
        if (newDeck) {
          newDeck.setVolume(prevDeck.volume);
          newDeck.setEQ(prevDeck.eq);
        }
        return {
          ...prev,
          [deckKey]: {
            track: null,
            isPlaying: false,
            currentTime: 0,
            volume: prevDeck.volume,
            eq: { ...prevDeck.eq },
          },
        };
      });
    }
  };

  const handleSeek = (deck: 'A' | 'B', time: number) => {
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (deckRef) {
      deckRef.seek(time);
      setMixerState((prev) => ({
        ...prev,
        [deck === 'A' ? 'deckA' : 'deckB']: {
          ...prev[deck === 'A' ? 'deckA' : 'deckB'],
          currentTime: time,
        },
      }));
    }
  };

  // Apply volume changes
  useEffect(() => {
    if (deckARef.current) {
      deckARef.current.setVolume(mixerState.deckA.volume);
    }
    if (deckBRef.current) {
      deckBRef.current.setVolume(mixerState.deckB.volume);
    }
  }, [mixerState.deckA.volume, mixerState.deckB.volume]);

  // Apply EQ changes
  useEffect(() => {
    if (deckARef.current) {
      deckARef.current.setEQ(mixerState.deckA.eq);
    }
    if (deckBRef.current) {
      deckBRef.current.setEQ(mixerState.deckB.eq);
    }
  }, [mixerState.deckA.eq, mixerState.deckB.eq]);

  // Apply crossfader
  useEffect(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setCrossfader(mixerState.crossfader);
    }
  }, [mixerState.crossfader]);

  // Apply master volume
  useEffect(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setMasterVolume(mixerState.masterVolume);
    }
  }, [mixerState.masterVolume]);

  // Live mode handlers
  const handleAddSegment = (segment: SegmentSuggestion) => {
    if (playlistManagerRef.current) {
      playlistManagerRef.current.addSegment(segment);
    }
  };

  const handlePreviewSegment = async (segment: SegmentSuggestion) => {
    try {
      const trackInfo = getCurrentTrackForSuggestions();
      // If a track is actively playing, perform a full crossfade transition preview!
      if (trackInfo.trackId && trackInfo.isPlaying) {
        await previewTransition(
          trackInfo.trackId, 
          segment.trackId, 
          trackInfo.position, 
          segment.position
        );
      } else {
        // Otherwise, just preview the single segment
        await previewSegment(segment);
      }
    } catch (error) {
      console.error("Preview failed:", error);
    }
  };

  // Handle playing a segment from playlist builder
  const handlePlaySegment = async (segment: PlaylistSegment) => {
    // Find an empty deck or the one that's not playing
    let targetDeck: 'A' | 'B' = 'A';
    if (mixerState.deckA.track && mixerState.deckA.isPlaying) {
      targetDeck = 'B';
    } else if (mixerState.deckB.track && mixerState.deckB.isPlaying) {
      targetDeck = 'A';
    } else if (!mixerState.deckA.track) {
      targetDeck = 'A';
    } else if (!mixerState.deckB.track) {
      targetDeck = 'B';
    }

    const deckRef = targetDeck === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) {
      console.error(`Deck ${targetDeck} not initialized`);
      alert(`Deck ${targetDeck} is not ready. Please refresh the page.`);
      return;
    }

    try {
      // Find the track object
      const track = tracks.find((t) => t.id === segment.trackId);
      if (!track) {
        alert(`Track not found: ${segment.trackId}`);
        return;
      }

      // Stop the deck first if it's playing
      if (deckRef.isPlaying()) {
        deckRef.stop();
      }

      // Update state to show loading
      setMixerState((prev) => ({
        ...prev,
        [targetDeck === 'A' ? 'deckA' : 'deckB']: {
          ...prev[targetDeck === 'A' ? 'deckA' : 'deckB'],
          track,
          currentTime: segment.startTime,
          isPlaying: false,
        },
      }));

      // Load the track
      const audioUrl = `/api/audio/${track.id}`;
      await deckRef.load(audioUrl);

      // Seek to segment start time
      deckRef.seek(segment.startTime);

      // Apply current settings
      const deckState =
        targetDeck === 'A' ? mixerState.deckA : mixerState.deckB;
      deckRef.setVolume(deckState.volume);
      deckRef.setEQ(deckState.eq);

      // Set up end handler to stop at segment end
      const handleSegmentEnd = () => {
        if (deckRef) {
          deckRef.pause();
          deckRef.seek(segment.endTime);
          setMixerState((prev) => ({
            ...prev,
            [targetDeck === 'A' ? 'deckA' : 'deckB']: {
              ...prev[targetDeck === 'A' ? 'deckA' : 'deckB'],
              isPlaying: false,
              currentTime: segment.endTime,
            },
          }));
          deckRef.off('end', handleSegmentEnd);
        }
      };

      deckRef.on('end', handleSegmentEnd);

      // Play the segment
      deckRef.play();

      // Update state to show playing
      setMixerState((prev) => ({
        ...prev,
        [targetDeck === 'A' ? 'deckA' : 'deckB']: {
          ...prev[targetDeck === 'A' ? 'deckA' : 'deckB'],
          isPlaying: true,
        },
      }));

      // Monitor playback to stop at segment end (backup in case 'end' event doesn't fire)
      const segmentEndMonitor = setInterval(() => {
        if (deckRef) {
          const currentTime = deckRef.getCurrentTime();
          if (currentTime >= segment.endTime) {
            deckRef.pause();
            deckRef.seek(segment.endTime);
            clearInterval(segmentEndMonitor);
            setMixerState((prev) => ({
              ...prev,
              [targetDeck === 'A' ? 'deckA' : 'deckB']: {
                ...prev[targetDeck === 'A' ? 'deckA' : 'deckB'],
                isPlaying: false,
                currentTime: segment.endTime,
              },
            }));
            deckRef.off('end', handleSegmentEnd);
          }
        }
      }, 100);

      // Clean up monitor after segment duration
      const segmentDuration = (segment.endTime - segment.startTime) * 1000;
      setTimeout(() => {
        clearInterval(segmentEndMonitor);
        deckRef.off('end', handleSegmentEnd);
      }, segmentDuration + 1000);
    } catch (error: any) {
      console.error(`Failed to play segment on deck ${targetDeck}:`, error);
      alert(
        `Failed to play segment: ${
          error?.message || 'Unknown error'
        }\n\nMake sure the track has been analyzed and the audio file exists.`
      );
    }
  };

  const handlePlayPlaylist = async (playlist: Playlist) => {
    if (!audioManagerRef.current || !playlistManagerRef.current) return;

    // Stop any current playback
    if (deckARef.current) deckARef.current.stop();
    if (deckBRef.current) deckBRef.current.stop();

    // Create auto-transition manager
    if (autoTransitionRef.current) {
      autoTransitionRef.current.stop();
    }

    autoTransitionRef.current = new AutoTransitionManager(
      playlistManagerRef.current,
      audioManagerRef.current
    );

    try {
      await autoTransitionRef.current.startPlaylist(playlist);
      setLiveMode('live');
    } catch (error) {
      console.error('Failed to start playlist:', error);
      alert('Failed to start playlist: ' + (error as Error).message);
    }
  };

  // Get currently playing track for segment suggestions
  const getCurrentTrackForSuggestions = (): {
    trackId: string | null;
    position: number;
    isPlaying: boolean;
  } => {
    if (mixerState.deckA.isPlaying && mixerState.deckA.track) {
      return {
        trackId: mixerState.deckA.track.id,
        position: mixerState.deckA.currentTime,
        isPlaying: true,
      };
    }
    if (mixerState.deckB.isPlaying && mixerState.deckB.track) {
      return {
        trackId: mixerState.deckB.track.id,
        position: mixerState.deckB.currentTime,
        isPlaying: true,
      };
    }
    return {
      trackId: mixerState.deckA.track?.id || mixerState.deckB.track?.id || null,
      position:
        mixerState.deckA.currentTime || mixerState.deckB.currentTime || 0,
      isPlaying: false,
    };
  };

  const currentTrackInfo = getCurrentTrackForSuggestions();

  if (!isMounted) {
    return (
      <div className='h-screen bg-background flex items-center justify-center'>
        <div className='text-foreground'>Loading DJ Platform...</div>
      </div>
    );
  }

  const getActiveKey = () => {
    if (mixerState.deckA.isPlaying && mixerState.deckA.track) return mixerState.deckA.track.key;
    if (mixerState.deckB.isPlaying && mixerState.deckB.track) return mixerState.deckB.track.key;
    if (mixerState.deckA.track) return mixerState.deckA.track.key;
    if (mixerState.deckB.track) return mixerState.deckB.track.key;
    return undefined;
  };

  return (
    <div className='h-screen bg-background flex flex-col overflow-hidden'>
      <Navigation />
      <StatusBar status={systemStatus} onRetry={fetchSystemStatus} />

      {/* Live Mode Toggle */}
      <div className='border-b border-white/5 bg-background/50 backdrop-blur-md px-4 py-2'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <Label className='text-sm font-semibold'>Mode:</Label>
            <RadioGroup
              value={liveMode}
              onValueChange={(value) => setLiveMode(value as 'manual' | 'live')}
              className='flex gap-4'
            >
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='manual' id='manual' />
                <Label htmlFor='manual' className='text-sm cursor-pointer'>
                  Manual
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='live' id='live' />
                <Label htmlFor='live' className='text-sm cursor-pointer'>
                  Live Playlist
                </Label>
              </div>
            </RadioGroup>
          </div>
          {liveMode === 'live' && playlistManagerRef.current && (
            <div className='text-xs text-muted-foreground'>
              {playlistManagerRef.current.getPlaylist().segments.length}{' '}
              segments in playlist
            </div>
          )}
        </div>
      </div>

      <div className='flex-1 overflow-hidden min-h-0 flex flex-col'>
        <PanelGroup direction='vertical' className='flex-1'>
          <Panel defaultSize={65} minSize={40} className='min-h-0 p-2 pb-0'>
          <div className='h-full'>
            <PanelGroup direction='horizontal' className='h-full'>
              {/* Segment Suggestions (Live Mode) */}
              {liveMode === 'live' && (
                <>
                  <Panel
                    defaultSize={20}
                    minSize={15}
                    className='min-w-0 overflow-hidden'
                  >
                    <SegmentSuggestions
                      currentTrackId={currentTrackInfo.trackId}
                      currentPosition={currentTrackInfo.position}
                      isPlaying={currentTrackInfo.isPlaying}
                      onAddSegment={handleAddSegment}
                      onPreviewSegment={handlePreviewSegment}
                      playlistSegmentIds={
                        playlistManagerRef.current
                          ? playlistManagerRef.current
                              .getPlaylist()
                              .segments.map(
                                (s) => `${s.trackId}_${s.startTime}`
                              )
                          : []
                      }
                    />
                  </Panel>
                  <PanelResizeHandle className='w-1.5 bg-white/5 mx-1 rounded-full hover:bg-primary/20 transition-colors cursor-col-resize' />
                </>
              )}

              <Panel
                defaultSize={liveMode === 'live' ? 20 : 33.33}
                minSize={15}
                className='min-w-0 overflow-hidden'
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <Deck
                  deck={mixerState.deckA}
                  deckName='A'
                  onPlay={() => handlePlay('A')}
                  onPause={() => handlePause('A')}
                  onStop={() => handleStop('A')}
                  onCue={() => handleCue('A')}
                  onLoadTrack={() => {}}
                  onEject={() => handleEject('A')}
                  onSeek={(time) => handleSeek('A', time)}
                />
              </Panel>
              <PanelResizeHandle className='w-1.5 bg-border hover:bg-primary/20 transition-colors cursor-col-resize' />
              <Panel
                defaultSize={liveMode === 'live' ? 20 : 33.33}
                minSize={15}
                className='min-w-0 overflow-hidden'
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <CentralMixer
                  deckA={mixerState.deckA}
                  deckB={mixerState.deckB}
                  masterVolume={mixerState.masterVolume}
                  crossfader={mixerState.crossfader}
                  onDeckAVolumeChange={(volume) =>
                    setMixerState((prev) => ({
                      ...prev,
                      deckA: { ...prev.deckA, volume },
                    }))
                  }
                  onDeckBVolumeChange={(volume) =>
                    setMixerState((prev) => ({
                      ...prev,
                      deckB: { ...prev.deckB, volume },
                    }))
                  }
                  onMasterVolumeChange={(volume) =>
                    setMixerState((prev) => ({ ...prev, masterVolume: volume }))
                  }
                  onCrossfaderChange={(value) =>
                    setMixerState((prev) => ({ ...prev, crossfader: value }))
                  }
                  onDeckAEQChange={(band, value) =>
                    setMixerState((prev) => ({
                      ...prev,
                      deckA: {
                        ...prev.deckA,
                        eq: { ...prev.deckA.eq, [band]: value },
                      },
                    }))
                  }
                  onDeckBEQChange={(band, value) =>
                    setMixerState((prev) => ({
                      ...prev,
                      deckB: {
                        ...prev.deckB,
                        eq: { ...prev.deckB.eq, [band]: value },
                      },
                    }))
                  }
                />
              </Panel>
              <PanelResizeHandle className='w-1.5 bg-border hover:bg-primary/20 transition-colors cursor-col-resize' />
              <Panel
                defaultSize={liveMode === 'live' ? 20 : 33.33}
                minSize={15}
                className='min-w-0 overflow-hidden'
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <Deck
                  deck={mixerState.deckB}
                  deckName='B'
                  onPlay={() => handlePlay('B')}
                  onPause={() => handlePause('B')}
                  onStop={() => handleStop('B')}
                  onCue={() => handleCue('B')}
                  onLoadTrack={() => {}}
                  onEject={() => handleEject('B')}
                  onSeek={(time) => handleSeek('B', time)}
                />
              </Panel>

              {/* Playlist Builder (Live Mode) */}
              {liveMode === 'live' && playlistManagerRef.current && (
                <>
                  <PanelResizeHandle className='w-1.5 bg-white/5 mx-1 rounded-full hover:bg-primary/20 transition-colors cursor-col-resize' />
                  <Panel
                    defaultSize={20}
                    minSize={15}
                    className='min-w-0 overflow-hidden'
                  >
                    <PlaylistBuilder
                      playlistManager={playlistManagerRef.current}
                      onPlayPlaylist={handlePlayPlaylist}
                      onSegmentSelect={handlePlaySegment}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </div>
          </Panel>
          <PanelResizeHandle className='h-1.5 bg-white/5 my-0.5 mx-2 rounded-full hover:bg-primary/20 transition-colors cursor-row-resize' />
          {/* Bottom Row: Library and Recommendations */}
          <Panel defaultSize={35} minSize={20} className='min-h-0 px-2 pb-2'>
            <div className='h-full rounded-xl border border-white/5 bg-card/30 backdrop-blur-md overflow-hidden'>
              <Tabs defaultValue='library' className='h-full flex flex-col'>
                <TabsList className='w-full h-8 rounded-none border-b border-white/5 flex-shrink-0 bg-transparent'>
                  <TabsTrigger
                    value='library'
                    className='text-[10px] px-3 h-6'
                  >
                    Library
                  </TabsTrigger>
                  <TabsTrigger
                    value='ai-search'
                    className='text-[10px] px-3 h-6'
                  >
                    AI Search
                  </TabsTrigger>
                  <TabsTrigger
                    value='recommendations'
                    className='text-[10px] px-3 h-6'
                  >
                    Recommendations
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value='library'
                  className='flex-1 mt-0 min-h-0 overflow-hidden'
                >
                  <TrackLibrary
                    tracks={tracks}
                    onLoadTrack={loadTrack}
                    onRefresh={fetchTracks}
                    currentKey={getActiveKey()}
                  />
                </TabsContent>
                <TabsContent
                  value='ai-search'
                  className='flex-1 mt-0 min-h-0 overflow-hidden'
                >
                  <NaturalLanguageQuery
                    onLoadTrack={loadTrack}
                    currentTrackId={
                      mixerState.deckA.track?.id ||
                      mixerState.deckB.track?.id ||
                      undefined
                    }
                  />
                </TabsContent>
                <TabsContent
                  value='recommendations'
                  className='flex-1 mt-0 min-h-0 overflow-hidden'
                >
                  <TrackRecommendations
                    deckA={mixerState.deckA}
                    deckB={mixerState.deckB}
                    tracks={tracks}
                    onLoadTrack={loadTrack}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
