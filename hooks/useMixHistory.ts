/**
 * Mix History Tracker Hook
 * Tracks segment selections to learn user's mixing preferences
 */

import { useEffect, useState } from 'react';
import { MixHistoryEntry, AudioFeatures } from '@/types';

const STORAGE_KEY = 'msc_mix_history';
const MAX_HISTORY_SIZE = 20;

// Load initial history from session storage
function loadInitialHistory(): MixHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as MixHistoryEntry[];
    }
  } catch (error) {
    console.error('Failed to load mix history:', error);
  }
  return [];
}

export function useMixHistory() {
  const [history, setHistory] = useState<MixHistoryEntry[]>(loadInitialHistory);

  // Save history to session storage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save mix history:', error);
    }
  }, [history]);

  /**
   * Add a mix transition to history
   */
  const addMix = (
    fromTrackId: string,
    fromPosition: number,
    toTrackId: string,
    toPosition: number,
    features: AudioFeatures,
    userSelected: boolean = true,
  ) => {
    const entry: MixHistoryEntry = {
      timestamp: Date.now(),
      fromTrackId,
      fromPosition,
      toTrackId,
      toPosition,
      features,
      userSelected,
    };

    setHistory((prev) => {
      const newHistory = [...prev, entry];
      // Keep only last N entries
      if (newHistory.length > MAX_HISTORY_SIZE) {
        return newHistory.slice(-MAX_HISTORY_SIZE);
      }
      return newHistory;
    });
  };

  /**
   * Clear all history
   */
  const clearHistory = () => {
    setHistory([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  /**
   * Get recent history (last N entries)
   */
  const getRecent = (count: number = 10): MixHistoryEntry[] => {
    return history.slice(-count);
  };

  /**
   * Get history for a specific track
   */
  const getForTrack = (trackId: string): MixHistoryEntry[] => {
    return history.filter(
      (entry) => entry.fromTrackId === trackId || entry.toTrackId === trackId,
    );
  };

  return {
    history,
    addMix,
    clearHistory,
    getRecent,
    getForTrack,
  };
}
