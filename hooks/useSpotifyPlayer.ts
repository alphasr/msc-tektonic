"use client";

import { useState, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

export interface SpotifyPlayerState {
  isReady: boolean;
  isPlaying: boolean;
  isPremiumRequired: boolean;
  currentTrackUri: string | null;
  deviceId: string | null;
  /** Playback position of the current track in seconds */
  position: number;
}

const INITIAL_STATE: SpotifyPlayerState = {
  isReady: false,
  isPlaying: false,
  isPremiumRequired: false,
  currentTrackUri: null,
  deviceId: null,
  position: 0,
};

/**
 * Extract a playable Spotify URI from an open.spotify.com track URL.
 * Handles ?si= params and locale segments (/intl-de/track/…).
 */
export function spotifyUrlToUri(url: string | null | undefined): string | null {
  const match = url?.match(/track\/([A-Za-z0-9]+)/);
  return match ? `spotify:track:${match[1]}` : null;
}

export function useSpotifyPlayer() {
  const [state, setState] = useState<SpotifyPlayerState>(INITIAL_STATE);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let scriptEl: HTMLScriptElement | null = null;
    let cancelled = false;

    // Fetch a valid access token from the server (refreshed if near expiry)
    const fetchToken = async (): Promise<string | null> => {
      try {
        const res = await fetch("/api/spotify/token");
        const data = await res.json();
        return data.token ?? null;
      } catch {
        console.warn("[SpotifyPlayer] Could not fetch token");
        return null;
      }
    };

    const initPlayer = async () => {
      const token = await fetchToken();
      if (!token || cancelled) return;

      const player = new window.Spotify.Player({
        name: "TEKTONIC DJ",
        // The SDK re-invokes this whenever it needs a fresh token (they expire
        // hourly), so fetch one each time instead of capturing the initial token.
        getOAuthToken: (cb: (t: string) => void) => {
          fetchToken().then((t) => {
            if (t) cb(t);
          });
        },
        volume: 0.8,
      });

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        console.log("[SpotifyPlayer] Ready, device_id:", device_id);
        setState((s) => ({ ...s, isReady: true, deviceId: device_id }));
      });

      player.addListener("not_ready", () => {
        setState((s) => ({ ...s, isReady: false }));
      });

      player.addListener(
        "initialization_error",
        ({ message }: { message: string }) => {
          console.error("[SpotifyPlayer] Init error:", message);
        },
      );

      player.addListener(
        "authentication_error",
        ({ message }: { message: string }) => {
          console.error("[SpotifyPlayer] Auth error:", message);
        },
      );

      player.addListener("account_error", () => {
        // Spotify Premium is required for the Web Playback SDK
        setState((s) => ({ ...s, isPremiumRequired: true }));
        console.warn("[SpotifyPlayer] Spotify Premium required");
      });

      player.addListener("player_state_changed", (s: any) => {
        if (!s) return;
        setState((prev) => ({
          ...prev,
          isPlaying: !s.paused,
          currentTrackUri: s.track_window?.current_track?.uri ?? null,
          position: (s.position ?? 0) / 1000,
        }));
      });

      const connected = await player.connect();
      if (cancelled) {
        player.disconnect();
        return;
      }
      if (connected) {
        playerRef.current = player;
      }
    };

    if (typeof window !== "undefined") {
      if (window.Spotify) {
        initPlayer();
      } else {
        window.onSpotifyWebPlaybackSDKReady = initPlayer;
        scriptEl = document.createElement("script");
        scriptEl.src = "https://sdk.scdn.co/spotify-player.js";
        scriptEl.async = true;
        document.body.appendChild(scriptEl);
      }
    }

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
      if (scriptEl && document.body.contains(scriptEl)) {
        document.body.removeChild(scriptEl);
      }
    };
  }, []);

  // The SDK only pushes state on discrete events (play/pause/track change),
  // so poll position while playing to keep deck progress bars in sync.
  useEffect(() => {
    if (!state.isPlaying) return;
    const interval = setInterval(async () => {
      const s = await playerRef.current?.getCurrentState();
      if (!s) return;
      setState((prev) => ({ ...prev, position: (s.position ?? 0) / 1000 }));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isPlaying]);

  /** Play a track by its Spotify URI (e.g. "spotify:track:xxxxxx") */
  const playTrack = useCallback(
    async (spotifyUri: string): Promise<boolean> => {
      if (!state.deviceId) return false;
      try {
        const res = await fetch("/api/spotify/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uri: spotifyUri, device_id: state.deviceId }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [state.deviceId],
  );

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    playerRef.current?.resume();
  }, []);

  const togglePlay = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  /** Seek within the current track (seconds) */
  const seek = useCallback((positionSeconds: number) => {
    playerRef.current?.seek(positionSeconds * 1000);
    setState((prev) => ({ ...prev, position: positionSeconds }));
  }, []);

  return { ...state, playTrack, pause, resume, togglePlay, seek };
}

export type SpotifyPlayerControls = ReturnType<typeof useSpotifyPlayer>;
