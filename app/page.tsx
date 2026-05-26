'use client';

import { useState, useEffect, useRef } from 'react';
import Navigation from '@/components/Navigation';
import StatusBar from '@/components/StatusBar';
import Deck, { LoopState } from '@/components/Deck';
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
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const INITIAL_DECK_STATE: DeckState = {
  track: null,
  isPlaying: false,
  currentTime: 0,
  volume: 50,
  eq: { low: 0, mid: 0, high: 0 },
  rate: 1.0,
};

const INITIAL_LOOP: LoopState = { start: null, end: null, active: false };

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);

  const [mixerState, setMixerState] = useState<MixerState>({
    deckA: { ...INITIAL_DECK_STATE },
    deckB: { ...INITIAL_DECK_STATE },
    crossfader: 0,
    masterVolume: 50,
    masterDeck: null,
  });

  const [tracks, setTracks] = useState<Track[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: 'operational',
    database: 'operational',
    storage: 'degraded',
    analysis: 'operational',
    latency: 4.8,
  });

  // ── Hot cue state (4 pads per deck) ──
  const [hotCuesA, setHotCuesAState] = useState<(number | null)[]>([null, null, null, null]);
  const [hotCuesB, setHotCuesBState] = useState<(number | null)[]>([null, null, null, null]);
  const hotCuesARef = useRef<(number | null)[]>([null, null, null, null]);
  const hotCuesBRef = useRef<(number | null)[]>([null, null, null, null]);

  const setHotCuesA = (updater: ((p: (number | null)[]) => (number | null)[]) | (number | null)[]) => {
    setHotCuesAState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      hotCuesARef.current = next;
      return next;
    });
  };
  const setHotCuesB = (updater: ((p: (number | null)[]) => (number | null)[]) | (number | null)[]) => {
    setHotCuesBState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      hotCuesBRef.current = next;
      return next;
    });
  };

  // ── Loop state (with refs for interval access) ──
  const [loopA, setLoopAState] = useState<LoopState>(INITIAL_LOOP);
  const [loopB, setLoopBState] = useState<LoopState>(INITIAL_LOOP);
  const loopARef = useRef<LoopState>(INITIAL_LOOP);
  const loopBRef = useRef<LoopState>(INITIAL_LOOP);

  const setLoopA = (updater: LoopState | ((p: LoopState) => LoopState)) => {
    setLoopAState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      loopARef.current = next;
      return next;
    });
  };
  const setLoopB = (updater: LoopState | ((p: LoopState) => LoopState)) => {
    setLoopBState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      loopBRef.current = next;
      return next;
    });
  };

  const audioManagerRef = useRef<AudioManager | null>(null);
  const deckARef = useRef<ReturnType<AudioManager['createDeck']> | null>(null);
  const deckBRef = useRef<ReturnType<AudioManager['createDeck']> | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const midiControllerRef = useRef<ReturnType<typeof getMIDIController> | null>(null);
  const lastUserActionRef = useRef<number>(0);

  // Live mode state
  const [liveMode, setLiveMode] = useState<'manual' | 'live'>('manual');

  const playlistManagerRef = useRef<PlaylistManager | null>(null);
  const autoTransitionRef = useRef<AutoTransitionManager | null>(null);

  // ── Initialize ──
  useEffect(() => {
    audioManagerRef.current = getAudioManager();
    deckARef.current = audioManagerRef.current.createDeck('A');
    deckBRef.current = audioManagerRef.current.createDeck('B');
    playlistManagerRef.current = new PlaylistManager();

    midiControllerRef.current = getMIDIController();
    midiControllerRef.current.initialize().then((success) => {
      if (success) {
        setTimeout(() => {
          if (midiControllerRef.current?.getInitialized()) setupMIDIHandlers();
        }, 200);
      }
    });

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      deckARef.current?.dispose();
      deckARef.current = null;
      deckBRef.current?.dispose();
      deckBRef.current = null;
      midiControllerRef.current?.dispose();
      midiControllerRef.current = null;
      autoTransitionRef.current?.stop();
      autoTransitionRef.current = null;
      stopPreview();
    };
  }, []);

  useEffect(() => { setIsMounted(true); }, []);

  // ── Transport handlers ──
  const handlePlay = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) return;
    setMixerState(prev => {
      if (!prev[deckKey].track) return prev;
      return { ...prev, [deckKey]: { ...prev[deckKey], isPlaying: true } };
    });
    lastUserActionRef.current = Date.now();
    deckRef.play();
  };

  const handlePause = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) return;
    lastUserActionRef.current = Date.now();
    deckRef.pause();
    setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], isPlaying: false } }));
  };

  const handleStop = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) return;
    lastUserActionRef.current = Date.now();
    deckRef.stop();
    setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], isPlaying: false, currentTime: 0 } }));
  };

  const handleCue = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) return;
    lastUserActionRef.current = Date.now();
    deckRef.seek(0);
    deckRef.pause();
    setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], isPlaying: false, currentTime: 0 } }));
  };

  const handleSetMasterDeck = (deck: 'A' | 'B') => {
    setMixerState(prev => ({ ...prev, masterDeck: prev.masterDeck === deck ? null : deck }));
  };

  const handleSync = (deck: 'A' | 'B') => {
    setMixerState(prev => {
      let master = prev.masterDeck;
      if (!master) master = deck === 'A' ? 'B' : 'A';
      if (master === deck) return prev;
      const src = deck === 'A' ? prev.deckA : prev.deckB;
      const tgt = master === 'A' ? prev.deckA : prev.deckB;
      if (!src.track || !tgt.track) return prev;
      const targetBpm = tgt.track.bpm * (tgt.rate ?? 1.0);
      const newRate = targetBpm / src.track.bpm;
      const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
      deckRef?.setRate(newRate);
      return { ...prev, [deck === 'A' ? 'deckA' : 'deckB']: { ...(deck === 'A' ? prev.deckA : prev.deckB), rate: newRate } };
    });
  };

  const handleRateChange = (deck: 'A' | 'B', newRate: number) => {
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    deckRef?.setRate(newRate);
    setMixerState(prev => ({ ...prev, [deck === 'A' ? 'deckA' : 'deckB']: { ...(deck === 'A' ? prev.deckA : prev.deckB), rate: newRate } }));
  };

  const handleSeek = (deck: 'A' | 'B', time: number) => {
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    deckRef?.seek(time);
    setMixerState(prev => ({ ...prev, [deck === 'A' ? 'deckA' : 'deckB']: { ...(deck === 'A' ? prev.deckA : prev.deckB), currentTime: time } }));
  };

  // ── Hot cue handlers ──
  const handleHotCuePress = (deck: 'A' | 'B', index: number) => {
    const cues = deck === 'A' ? hotCuesARef.current : hotCuesBRef.current;
    const setCues = deck === 'A' ? setHotCuesA : setHotCuesB;
    if (cues[index] !== null) {
      // Trigger: jump to cue
      handleSeek(deck, cues[index]!);
    } else {
      // Set: store current position
      const currentTime = deck === 'A'
        ? (deckARef.current?.getCurrentTime() ?? mixerState.deckA.currentTime)
        : (deckBRef.current?.getCurrentTime() ?? mixerState.deckB.currentTime);
      setCues(prev => prev.map((c, i) => i === index ? currentTime : c) as (number | null)[]);
    }
  };

  const handleHotCueClear = (deck: 'A' | 'B', index: number) => {
    const setCues = deck === 'A' ? setHotCuesA : setHotCuesB;
    setCues(prev => prev.map((c, i) => i === index ? null : c) as (number | null)[]);
  };

  // ── Loop handlers ──
  const handleLoopIn = (deck: 'A' | 'B') => {
    const currentTime = deck === 'A'
      ? (deckARef.current?.getCurrentTime() ?? mixerState.deckA.currentTime)
      : (deckBRef.current?.getCurrentTime() ?? mixerState.deckB.currentTime);
    const setLoop = deck === 'A' ? setLoopA : setLoopB;
    setLoop(prev => ({ ...prev, start: currentTime, end: null, active: false }));
  };

  const handleLoopOut = (deck: 'A' | 'B') => {
    const currentTime = deck === 'A'
      ? (deckARef.current?.getCurrentTime() ?? mixerState.deckA.currentTime)
      : (deckBRef.current?.getCurrentTime() ?? mixerState.deckB.currentTime);
    const setLoop = deck === 'A' ? setLoopA : setLoopB;
    setLoop(prev => {
      if (prev.start === null || currentTime <= prev.start) return prev;
      return { start: prev.start, end: currentTime, active: true };
    });
  };

  const handleLoopToggle = (deck: 'A' | 'B') => {
    const setLoop = deck === 'A' ? setLoopA : setLoopB;
    setLoop(prev => {
      if (prev.start === null || prev.end === null) return prev;
      return { ...prev, active: !prev.active };
    });
  };

  const handleLoopHalve = (deck: 'A' | 'B') => {
    const setLoop = deck === 'A' ? setLoopA : setLoopB;
    setLoop(prev => {
      if (prev.start === null || prev.end === null) return prev;
      return { ...prev, end: prev.start + (prev.end - prev.start) / 2 };
    });
  };

  const handleLoopDouble = (deck: 'A' | 'B') => {
    const setLoop = deck === 'A' ? setLoopA : setLoopB;
    setLoop(prev => {
      if (prev.start === null || prev.end === null) return prev;
      return { ...prev, end: prev.start + (prev.end - prev.start) * 2 };
    });
  };

  // ── Auto transition ──
  const handleAutoTransition = async () => {
    const snapshot = await new Promise<MixerState>((resolve) => {
      setMixerState(prev => { resolve(prev); return prev; });
    });

    const activeDeck = snapshot.crossfader <= 0 ? 'A' : 'B';
    const targetDeck = activeDeck === 'A' ? 'B' : 'A';
    const targetDeckKey = targetDeck === 'A' ? 'deckA' : 'deckB';
    const activeDeckKey = activeDeck === 'A' ? 'deckA' : 'deckB';
    const activeTrack = snapshot[activeDeckKey].track;
    const targetTrack = snapshot[targetDeckKey].track;

    if (!targetTrack || !activeTrack) return;

    const targetDeckRef = targetDeck === 'A' ? deckARef.current : deckBRef.current;

    try {
      const activeCurrentTime = activeDeck === 'A'
        ? (deckARef.current?.getCurrentTime() ?? 0)
        : (deckBRef.current?.getCurrentTime() ?? 0);
      const res = await fetch(
        `/api/segments/suggest?${new URLSearchParams({
          trackId: activeTrack.id,
          position: activeCurrentTime.toString(),
          targetTrackId: targetTrack.id,
          limit: '1',
        })}`
      );
      if (res.ok) {
        const data = await res.json();
        const best = data.suggestions[0];
        if (best?.trackId === targetTrack.id && targetDeckRef) {
          targetDeckRef.seek(best.position);
          handleSync(targetDeck);
        }
      }
    } catch {}

    if (targetDeckRef && !snapshot[targetDeckKey].isPlaying) {
      lastUserActionRef.current = Date.now();
      targetDeckRef.play();
      setMixerState(prev => ({ ...prev, [targetDeckKey]: { ...prev[targetDeckKey], isPlaying: true } }));
    }

    const duration = 4000;
    const steps = 40;
    const startFader = snapshot.crossfader;
    const targetFader = activeDeck === 'A' ? 100 : -100;
    let step = 0;

    const tid = setInterval(() => {
      step++;
      if (step >= steps) {
        clearInterval(tid);
        const activeRef = activeDeck === 'A' ? deckARef.current : deckBRef.current;
        activeRef?.pause();
        setMixerState(prev => ({
          ...prev,
          crossfader: targetFader,
          [activeDeckKey]: { ...prev[activeDeckKey], isPlaying: false },
        }));
        audioManagerRef.current?.setCrossfader(targetFader);
      } else {
        const blend = 0.5 - 0.5 * Math.cos((step / steps) * Math.PI);
        const val = startFader + (targetFader - startFader) * blend;
        setMixerState(prev => ({ ...prev, crossfader: val }));
        audioManagerRef.current?.setCrossfader(val);
      }
    }, duration / steps);
  };

  // ── MIDI setup ──
  const setupMIDIHandlers = () => {
    const midi = midiControllerRef.current;
    if (!midi?.getInitialized()) return;

    // Deck A transport
    midi.on('deckA_play', () => handlePlay('A'));
    midi.on('deckA_pause', () => handlePause('A'));
    midi.on('deckA_stop', () => handleStop('A'));
    midi.on('deckA_cue', () => handleCue('A'));
    // Deck B transport
    midi.on('deckB_play', () => handlePlay('B'));
    midi.on('deckB_pause', () => handlePause('B'));
    midi.on('deckB_stop', () => handleStop('B'));
    midi.on('deckB_cue', () => handleCue('B'));

    // Volume / EQ – deck A
    midi.on('deckA_volume', v => {
      setMixerState(prev => ({ ...prev, deckA: { ...prev.deckA, volume: v } }));
      deckARef.current?.setVolume(v);
    });
    midi.on('deckA_low', v => setMixerState(prev => {
      const s = { ...prev, deckA: { ...prev.deckA, eq: { ...prev.deckA.eq, low: v } } };
      deckARef.current?.setEQ(s.deckA.eq); return s;
    }));
    midi.on('deckA_mid', v => setMixerState(prev => {
      const s = { ...prev, deckA: { ...prev.deckA, eq: { ...prev.deckA.eq, mid: v } } };
      deckARef.current?.setEQ(s.deckA.eq); return s;
    }));
    midi.on('deckA_high', v => setMixerState(prev => {
      const s = { ...prev, deckA: { ...prev.deckA, eq: { ...prev.deckA.eq, high: v } } };
      deckARef.current?.setEQ(s.deckA.eq); return s;
    }));
    // Volume / EQ – deck B
    midi.on('deckB_volume', v => {
      setMixerState(prev => ({ ...prev, deckB: { ...prev.deckB, volume: v } }));
      deckBRef.current?.setVolume(v);
    });
    midi.on('deckB_low', v => setMixerState(prev => {
      const s = { ...prev, deckB: { ...prev.deckB, eq: { ...prev.deckB.eq, low: v } } };
      deckBRef.current?.setEQ(s.deckB.eq); return s;
    }));
    midi.on('deckB_mid', v => setMixerState(prev => {
      const s = { ...prev, deckB: { ...prev.deckB, eq: { ...prev.deckB.eq, mid: v } } };
      deckBRef.current?.setEQ(s.deckB.eq); return s;
    }));
    midi.on('deckB_high', v => setMixerState(prev => {
      const s = { ...prev, deckB: { ...prev.deckB, eq: { ...prev.deckB.eq, high: v } } };
      deckBRef.current?.setEQ(s.deckB.eq); return s;
    }));

    // Mixer
    midi.on('crossfader', v => {
      setMixerState(prev => ({ ...prev, crossfader: v }));
      audioManagerRef.current?.setCrossfader(v);
    });
    midi.on('masterVolume', v => {
      setMixerState(prev => ({ ...prev, masterVolume: v }));
      audioManagerRef.current?.setMasterVolume(v);
    });

    // Jogwheels
    midi.on('jogwheelA', v => {
      if (deckARef.current?.isPlaying()) {
        deckARef.current.seek(Math.max(0, deckARef.current.getCurrentTime() + v * 0.1));
      }
    });
    midi.on('jogwheelB', v => {
      if (deckBRef.current?.isPlaying()) {
        deckBRef.current.seek(Math.max(0, deckBRef.current.getCurrentTime() + v * 0.1));
      }
    });

    // Hot cues — wired to real handlers via refs (stale-closure-safe)
    midi.on('deckA_hotcue1', () => handleHotCuePress('A', 0));
    midi.on('deckA_hotcue2', () => handleHotCuePress('A', 1));
    midi.on('deckA_hotcue3', () => handleHotCuePress('A', 2));
    midi.on('deckA_hotcue4', () => handleHotCuePress('A', 3));
    midi.on('deckB_hotcue1', () => handleHotCuePress('B', 0));
    midi.on('deckB_hotcue2', () => handleHotCuePress('B', 1));
    midi.on('deckB_hotcue3', () => handleHotCuePress('B', 2));
    midi.on('deckB_hotcue4', () => handleHotCuePress('B', 3));

    // Loop controls — wired to real handlers via refs
    midi.on('deckA_loopIn', () => handleLoopIn('A'));
    midi.on('deckA_loopOut', () => handleLoopOut('A'));
    midi.on('deckA_loopRel', () => handleLoopToggle('A'));
    midi.on('deckA_loop2x', () => handleLoopDouble('A'));
    midi.on('deckA_loop4x', () => handleLoopDouble('A'));
    midi.on('deckA_loop8x', () => handleLoopDouble('A'));
    midi.on('deckB_loopIn', () => handleLoopIn('B'));
    midi.on('deckB_loopOut', () => handleLoopOut('B'));
    midi.on('deckB_loopRel', () => handleLoopToggle('B'));
    midi.on('deckB_loop2x', () => handleLoopDouble('B'));
    midi.on('deckB_loop4x', () => handleLoopDouble('B'));
    midi.on('deckB_loop8x', () => handleLoopDouble('B'));

    // Tempo fader / SYNC / MASTER
    midi.on('jogwheelRateA', rate => handleRateChange('A', rate));
    midi.on('jogwheelRateB', rate => handleRateChange('B', rate));
    midi.on('deckA_sync_hw', () => handleSync('A'));
    midi.on('deckB_sync_hw', () => handleSync('B'));
    midi.on('deckA_master_hw', () => handleSetMasterDeck('A'));
    midi.on('deckB_master_hw', () => handleSetMasterDeck('B'));
  };

  useEffect(() => {
    if (midiControllerRef.current?.getInitialized()) setupMIDIHandlers();
  }, []);

  // ── Data fetching ──
  useEffect(() => {
    fetchTracks();
    fetchSystemStatus();
    const iv = setInterval(fetchTracks, 30000);
    return () => clearInterval(iv);
  }, []);

  // ── Progress tracking & loop monitoring ──
  useEffect(() => {
    const isAnyPlaying = mixerState.deckA.isPlaying || mixerState.deckB.isPlaying;
    if (isAnyPlaying) {
      startProgressTracking();
    } else {
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

  const startProgressTracking = () => {
    if (progressInterval.current) clearInterval(progressInterval.current);

    progressInterval.current = setInterval(() => {
      setMixerState(prev => {
        let aUpdates: Partial<DeckState> | null = null;
        let bUpdates: Partial<DeckState> | null = null;
        const now = Date.now();

        if (deckARef.current) {
          const t = deckARef.current.getCurrentTime();
          if (Math.abs(t - prev.deckA.currentTime) > 0.05) aUpdates = { currentTime: t };
          if (now - lastUserActionRef.current > 300) {
            const playing = deckARef.current.isPlaying();
            if (playing !== prev.deckA.isPlaying) aUpdates = { ...(aUpdates ?? {}), isPlaying: playing };
          }
          if (prev.deckA.track && t >= prev.deckA.track.duration - 0.1 && prev.deckA.isPlaying) {
            aUpdates = { ...(aUpdates ?? {}), isPlaying: false, currentTime: 0 };
            deckARef.current.stop();
          }
          // Loop monitoring
          const la = loopARef.current;
          if (la.active && la.start !== null && la.end !== null && t >= la.end) {
            deckARef.current.seek(la.start);
          }
        }

        if (deckBRef.current) {
          const t = deckBRef.current.getCurrentTime();
          if (Math.abs(t - prev.deckB.currentTime) > 0.05) bUpdates = { currentTime: t };
          if (now - lastUserActionRef.current > 300) {
            const playing = deckBRef.current.isPlaying();
            if (playing !== prev.deckB.isPlaying) bUpdates = { ...(bUpdates ?? {}), isPlaying: playing };
          }
          if (prev.deckB.track && t >= prev.deckB.track.duration - 0.1 && prev.deckB.isPlaying) {
            bUpdates = { ...(bUpdates ?? {}), isPlaying: false, currentTime: 0 };
            deckBRef.current.stop();
          }
          // Loop monitoring
          const lb = loopBRef.current;
          if (lb.active && lb.start !== null && lb.end !== null && t >= lb.end) {
            deckBRef.current.seek(lb.start);
          }
        }

        if (!aUpdates && !bUpdates) return prev;
        return {
          ...prev,
          deckA: aUpdates ? { ...prev.deckA, ...aUpdates } : prev.deckA,
          deckB: bUpdates ? { ...prev.deckB, ...bUpdates } : prev.deckB,
        };
      });
    }, 50);
  };

  // ── Apply audio changes ──
  useEffect(() => {
    deckARef.current?.setVolume(mixerState.deckA.volume);
    deckBRef.current?.setVolume(mixerState.deckB.volume);
  }, [mixerState.deckA.volume, mixerState.deckB.volume]);

  useEffect(() => {
    deckARef.current?.setEQ(mixerState.deckA.eq);
    deckBRef.current?.setEQ(mixerState.deckB.eq);
  }, [mixerState.deckA.eq, mixerState.deckB.eq]);

  useEffect(() => {
    audioManagerRef.current?.setCrossfader(mixerState.crossfader);
  }, [mixerState.crossfader]);

  useEffect(() => {
    audioManagerRef.current?.setMasterVolume(mixerState.masterVolume);
  }, [mixerState.masterVolume]);

  // ── Track loading ──
  const loadTrack = async (track: Track, deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) { alert(`Deck ${deck} is not ready. Please refresh.`); return; }

    try {
      if (deckRef.isPlaying()) deckRef.stop();
      deckRef.off('end'); deckRef.off('play'); deckRef.off('pause'); deckRef.off('stop');

      setMixerState(prev => ({
        ...prev,
        [deckKey]: { ...prev[deckKey], track, currentTime: 0, isPlaying: false, rate: 1.0 },
      }));

      // Reset loops and hot cues for this deck
      if (deck === 'A') {
        setLoopA(INITIAL_LOOP);
        setHotCuesA([null, null, null, null]);
      } else {
        setLoopB(INITIAL_LOOP);
        setHotCuesB([null, null, null, null]);
      }

      await deckRef.load(track.audioUrl ?? `/api/audio/${track.id}`);

      deckRef.on('play', () => setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], isPlaying: true } })));
      deckRef.on('pause', () => setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], isPlaying: false } })));
      deckRef.on('stop', () => setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], isPlaying: false, currentTime: 0 } })));
      deckRef.on('end', () => setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], isPlaying: false, currentTime: 0 } })));

      setMixerState(prev => {
        const ds = prev[deckKey];
        deckRef.setVolume(ds.volume);
        deckRef.setEQ(ds.eq);
        return prev;
      });
    } catch (error: any) {
      alert(`Failed to load "${track.title}": ${error?.message ?? 'Unknown error'}`);
      setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], track: null, isPlaying: false, currentTime: 0 } }));
    }
  };

  const handleEject = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const deckRef = deck === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) return;
    deckRef.off('end');
    deckRef.stop();
    deckRef.dispose();

    const newDeck = audioManagerRef.current?.createDeck(deck) ?? null;
    if (deck === 'A') deckARef.current = newDeck;
    else deckBRef.current = newDeck;

    if (deck === 'A') { setLoopA(INITIAL_LOOP); setHotCuesA([null, null, null, null]); }
    else { setLoopB(INITIAL_LOOP); setHotCuesB([null, null, null, null]); }

    setMixerState(prev => {
      const pd = prev[deckKey];
      newDeck?.setVolume(pd.volume);
      newDeck?.setEQ(pd.eq);
      return { ...prev, [deckKey]: { track: null, isPlaying: false, currentTime: 0, volume: pd.volume, eq: { ...pd.eq }, rate: 1.0 } };
    });
  };

  // ── Fetch helpers ──
  const fetchTracks = async () => {
    try {
      const r = await fetch('/api/tracks');
      if (r.ok) setTracks(await r.json());
      else setTracks([]);
    } catch { setTracks([]); }
  };

  const fetchSystemStatus = async () => {
    try {
      const r = await fetch('/api/status');
      setSystemStatus(await r.json());
    } catch {}
  };

  // ── Live mode helpers ──
  const handleAddSegment = (seg: SegmentSuggestion) => playlistManagerRef.current?.addSegment(seg);

  const getCurrentTrackInfo = () => {
    if (mixerState.deckA.isPlaying && mixerState.deckA.track)
      return { trackId: mixerState.deckA.track.id, position: mixerState.deckA.currentTime, isPlaying: true };
    if (mixerState.deckB.isPlaying && mixerState.deckB.track)
      return { trackId: mixerState.deckB.track.id, position: mixerState.deckB.currentTime, isPlaying: true };
    return {
      trackId: mixerState.deckA.track?.id ?? mixerState.deckB.track?.id ?? null,
      position: mixerState.deckA.currentTime || mixerState.deckB.currentTime || 0,
      isPlaying: false,
    };
  };

  const handlePreviewSegment = async (seg: SegmentSuggestion) => {
    const info = getCurrentTrackInfo();
    if (info.trackId && info.isPlaying) {
      await previewTransition(info.trackId, seg.trackId, info.position, seg.position).catch(console.error);
    } else {
      await previewSegment(seg).catch(console.error);
    }
  };

  const handlePlaySegment = async (seg: PlaylistSegment) => {
    let target: 'A' | 'B' = 'A';
    if (mixerState.deckA.isPlaying) target = 'B';
    else if (mixerState.deckB.isPlaying) target = 'A';
    else if (!mixerState.deckA.track) target = 'A';
    else if (!mixerState.deckB.track) target = 'B';

    const deckRef = target === 'A' ? deckARef.current : deckBRef.current;
    if (!deckRef) return;

    const track = tracks.find(t => t.id === seg.trackId);
    if (!track) { alert(`Track not found: ${seg.trackId}`); return; }

    try {
      if (deckRef.isPlaying()) deckRef.stop();
      const deckKey = target === 'A' ? 'deckA' : 'deckB';
      setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], track, currentTime: seg.startTime, isPlaying: false } }));
      await deckRef.load(track.audioUrl ?? `/api/audio/${track.id}`);
      const ds = target === 'A' ? mixerState.deckA : mixerState.deckB;
      deckRef.setVolume(ds.volume);
      deckRef.setEQ(ds.eq);
      deckRef.play(seg.startTime);
      setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], isPlaying: true } }));

      const monitor = setInterval(() => {
        if (deckRef.getCurrentTime() >= seg.endTime) {
          deckRef.pause();
          clearInterval(monitor);
          setMixerState(prev => ({ ...prev, [deckKey]: { ...prev[deckKey], isPlaying: false, currentTime: seg.endTime } }));
        }
      }, 100);
      setTimeout(() => clearInterval(monitor), (seg.endTime - seg.startTime) * 1000 + 1000);
    } catch (err: any) {
      alert(`Failed to play segment: ${err?.message ?? 'Unknown error'}`);
    }
  };

  const handlePlayPlaylist = async (pl: Playlist) => {
    if (!audioManagerRef.current || !playlistManagerRef.current) return;
    deckARef.current?.stop();
    deckBRef.current?.stop();
    autoTransitionRef.current?.stop();
    autoTransitionRef.current = new AutoTransitionManager(playlistManagerRef.current, audioManagerRef.current);
    try {
      await autoTransitionRef.current.startPlaylist(pl);
      setLiveMode('live');
    } catch (err) { alert('Failed to start playlist: ' + (err as Error).message); }
  };

  const getActiveKey = () => {
    if (mixerState.deckA.isPlaying && mixerState.deckA.track) return mixerState.deckA.track.key;
    if (mixerState.deckB.isPlaying && mixerState.deckB.track) return mixerState.deckB.track.key;
    if (mixerState.deckA.track) return mixerState.deckA.track.key;
    if (mixerState.deckB.track) return mixerState.deckB.track.key;
    return undefined;
  };

  const currentTrackInfo = getCurrentTrackInfo();

  if (!isMounted) {
    return (
      <div className='h-screen bg-background flex items-center justify-center'>
        <div className='text-foreground/60 text-sm tracking-widest uppercase'>Loading…</div>
      </div>
    );
  }

  return (
    <div className='h-screen bg-background flex flex-col overflow-hidden'>
      <Navigation />
      <StatusBar status={systemStatus} onRetry={fetchSystemStatus} />

      {/* Compact mode + live controls bar */}
      <div className='flex-shrink-0 border-b border-white/[0.04] bg-background/40 px-3 py-1 flex items-center gap-3'>
        <div className='flex rounded border border-white/[0.06] overflow-hidden'>
          {(['manual', 'live'] as const).map(m => (
            <button
              key={m}
              onClick={() => setLiveMode(m)}
              className={cn(
                'px-3 py-0.5 text-[9px] font-black tracking-widest uppercase transition-colors',
                liveMode === m
                  ? m === 'live'
                    ? 'bg-deck-b/15 text-deck-b'
                    : 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/50 hover:text-foreground',
              )}
            >
              {m === 'live' ? '▶ Live Playlist' : 'Manual'}
            </button>
          ))}
        </div>
        {liveMode === 'live' && playlistManagerRef.current && (
          <span className='text-[9px] text-muted-foreground/50'>
            {playlistManagerRef.current.getPlaylist().segments.length} segments queued
          </span>
        )}
      </div>

      <div className='flex-1 overflow-hidden min-h-0 flex flex-col'>
        <PanelGroup direction='vertical' className='flex-1'>
          {/* Top: Decks + Mixer */}
          <Panel defaultSize={65} minSize={40} className='min-h-0 p-2 pb-0'>
            <div className='h-full'>
              <PanelGroup direction='horizontal' className='h-full'>
                {/* Live mode: Segment suggestions panel */}
                {liveMode === 'live' && (
                  <>
                    <Panel defaultSize={18} minSize={14} className='min-w-0 overflow-hidden'>
                      <SegmentSuggestions
                        currentTrackId={currentTrackInfo.trackId}
                        currentPosition={currentTrackInfo.position}
                        isPlaying={currentTrackInfo.isPlaying}
                        onAddSegment={handleAddSegment}
                        onPreviewSegment={handlePreviewSegment}
                        playlistSegmentIds={
                          playlistManagerRef.current
                            ? playlistManagerRef.current.getPlaylist().segments.map(s => `${s.trackId}_${s.startTime}`)
                            : []
                        }
                      />
                    </Panel>
                    <PanelResizeHandle className='w-1.5 bg-white/[0.03] mx-0.5 rounded-full hover:bg-primary/20 transition-colors cursor-col-resize' />
                  </>
                )}

                {/* Deck A */}
                <Panel defaultSize={liveMode === 'live' ? 20 : 33} minSize={20} className='min-w-0 overflow-hidden flex flex-col'>
                  <Deck
                    deck={mixerState.deckA}
                    deckName='A'
                    isMaster={mixerState.masterDeck === 'A'}
                    hotCues={hotCuesA}
                    loop={loopA}
                    onPlay={() => handlePlay('A')}
                    onPause={() => handlePause('A')}
                    onStop={() => handleStop('A')}
                    onCue={() => handleCue('A')}
                    onLoadTrack={() => {}}
                    onEject={() => handleEject('A')}
                    onSeek={t => handleSeek('A', t)}
                    onSetMaster={() => handleSetMasterDeck('A')}
                    onSync={() => handleSync('A')}
                    onRateChange={r => handleRateChange('A', r)}
                    onHotCuePress={i => handleHotCuePress('A', i)}
                    onHotCueClear={i => handleHotCueClear('A', i)}
                    onLoopIn={() => handleLoopIn('A')}
                    onLoopOut={() => handleLoopOut('A')}
                    onLoopToggle={() => handleLoopToggle('A')}
                    onLoopHalve={() => handleLoopHalve('A')}
                    onLoopDouble={() => handleLoopDouble('A')}
                  />
                </Panel>

                <PanelResizeHandle className='w-1.5 bg-border hover:bg-primary/20 transition-colors cursor-col-resize' />

                {/* Central Mixer */}
                <Panel defaultSize={liveMode === 'live' ? 20 : 34} minSize={18} className='min-w-0 overflow-hidden flex flex-col'>
                  <CentralMixer
                    deckA={mixerState.deckA}
                    deckB={mixerState.deckB}
                    masterVolume={mixerState.masterVolume}
                    crossfader={mixerState.crossfader}
                    onDeckAVolumeChange={v => {
                      deckARef.current?.setVolume(v);
                      setMixerState(prev => ({ ...prev, deckA: { ...prev.deckA, volume: v } }));
                    }}
                    onDeckBVolumeChange={v => {
                      deckBRef.current?.setVolume(v);
                      setMixerState(prev => ({ ...prev, deckB: { ...prev.deckB, volume: v } }));
                    }}
                    onMasterVolumeChange={v => {
                      audioManagerRef.current?.setMasterVolume(v);
                      setMixerState(prev => ({ ...prev, masterVolume: v }));
                    }}
                    onCrossfaderChange={v => {
                      audioManagerRef.current?.setCrossfader(v);
                      setMixerState(prev => ({ ...prev, crossfader: v }));
                    }}
                    onDeckAEQChange={(band, v) => setMixerState(prev => ({ ...prev, deckA: { ...prev.deckA, eq: { ...prev.deckA.eq, [band]: v } } }))}
                    onDeckBEQChange={(band, v) => setMixerState(prev => ({ ...prev, deckB: { ...prev.deckB, eq: { ...prev.deckB.eq, [band]: v } } }))}
                    onAutoTransition={handleAutoTransition}
                  />
                </Panel>

                <PanelResizeHandle className='w-1.5 bg-border hover:bg-primary/20 transition-colors cursor-col-resize' />

                {/* Deck B */}
                <Panel defaultSize={liveMode === 'live' ? 20 : 33} minSize={20} className='min-w-0 overflow-hidden flex flex-col'>
                  <Deck
                    deck={mixerState.deckB}
                    deckName='B'
                    isMaster={mixerState.masterDeck === 'B'}
                    hotCues={hotCuesB}
                    loop={loopB}
                    onPlay={() => handlePlay('B')}
                    onPause={() => handlePause('B')}
                    onStop={() => handleStop('B')}
                    onCue={() => handleCue('B')}
                    onLoadTrack={() => {}}
                    onEject={() => handleEject('B')}
                    onSeek={t => handleSeek('B', t)}
                    onSetMaster={() => handleSetMasterDeck('B')}
                    onSync={() => handleSync('B')}
                    onRateChange={r => handleRateChange('B', r)}
                    onHotCuePress={i => handleHotCuePress('B', i)}
                    onHotCueClear={i => handleHotCueClear('B', i)}
                    onLoopIn={() => handleLoopIn('B')}
                    onLoopOut={() => handleLoopOut('B')}
                    onLoopToggle={() => handleLoopToggle('B')}
                    onLoopHalve={() => handleLoopHalve('B')}
                    onLoopDouble={() => handleLoopDouble('B')}
                  />
                </Panel>

                {/* Live mode: Playlist builder panel */}
                {liveMode === 'live' && playlistManagerRef.current && (
                  <>
                    <PanelResizeHandle className='w-1.5 bg-white/[0.03] mx-0.5 rounded-full hover:bg-primary/20 transition-colors cursor-col-resize' />
                    <Panel defaultSize={18} minSize={14} className='min-w-0 overflow-hidden'>
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

          <PanelResizeHandle className='h-1.5 bg-white/[0.03] my-0.5 mx-2 rounded-full hover:bg-primary/20 transition-colors cursor-row-resize' />

          {/* Bottom: Library + AI panels */}
          <Panel defaultSize={35} minSize={20} className='min-h-0 px-2 pb-2'>
            <div className='h-full rounded-xl border border-white/[0.04] bg-card/25 backdrop-blur-md overflow-hidden'>
              <Tabs defaultValue='library' className='h-full flex flex-col'>
                <TabsList className='w-full h-7 rounded-none border-b border-white/[0.04] flex-shrink-0 bg-transparent gap-0'>
                  {[
                    { value: 'library', label: 'Library' },
                    { value: 'ai-search', label: 'AI Search' },
                    { value: 'recommendations', label: 'Recommendations' },
                  ].map(t => (
                    <TabsTrigger
                      key={t.value}
                      value={t.value}
                      className='text-[9px] px-3 h-6 font-bold tracking-wide uppercase data-[state=active]:text-primary data-[state=active]:bg-primary/10'
                    >
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value='library' className='flex-1 mt-0 min-h-0 overflow-hidden'>
                  <TrackLibrary
                    tracks={tracks}
                    onLoadTrack={loadTrack}
                    onRefresh={fetchTracks}
                    currentKey={getActiveKey()}
                  />
                </TabsContent>
                <TabsContent value='ai-search' className='flex-1 mt-0 min-h-0 overflow-hidden'>
                  <NaturalLanguageQuery
                    onLoadTrack={loadTrack}
                    currentTrackId={mixerState.deckA.track?.id ?? mixerState.deckB.track?.id}
                  />
                </TabsContent>
                <TabsContent value='recommendations' className='flex-1 mt-0 min-h-0 overflow-hidden'>
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
