"use client";

import {
  SpotifyPlayerControls,
  spotifyUrlToUri,
} from "@/hooks/useSpotifyPlayer";
import { Track } from "@/types";

interface Props {
  /** Track currently loaded in either deck that has a spotifyUrl */
  currentTrack?: Track | null;
  /** Shared player instance owned by the page — one SDK device per session */
  player: SpotifyPlayerControls;
}

/**
 * A small status bar that shows the Spotify Web Playback SDK state and allows
 * playing the currently loaded deck track via the full Spotify stream.
 */
export default function SpotifyMiniPlayer({ currentTrack, player }: Props) {
  const {
    isReady,
    isPlaying,
    isPremiumRequired,
    currentTrackUri,
    deviceId,
    playTrack,
    togglePlay,
  } = player;

  if (isPremiumRequired) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-yellow-500/80">
        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden>
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
        <span>Spotify Premium required for in-app playback</span>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-foreground/30">
        <div className="w-1.5 h-1.5 rounded-full bg-foreground/20 animate-pulse" />
        <span>Spotify Player initializing…</span>
      </div>
    );
  }

  const spotifyUri = spotifyUrlToUri(currentTrack?.spotifyUrl);

  const isCurrentlyPlaying = spotifyUri
    ? currentTrackUri === spotifyUri && isPlaying
    : isPlaying;

  return (
    <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-foreground/60">
      {/* Spotify logo mark */}
      <svg
        viewBox="0 0 24 24"
        className="w-3 h-3 fill-[#1DB954] flex-shrink-0"
        aria-hidden
      >
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>

      <span className="text-[#1DB954]/80">Player ready</span>
      <span className="text-foreground/20">·</span>
      <span className="font-mono text-foreground/30">
        {deviceId?.slice(0, 8)}…
      </span>

      {spotifyUri && (
        <>
          <span className="text-foreground/20">·</span>
          <button
            onClick={() => {
              if (isCurrentlyPlaying) {
                togglePlay();
              } else {
                playTrack(spotifyUri);
              }
            }}
            className="flex items-center gap-1 text-[#1DB954] hover:text-[#1DB954]/80 transition-colors"
            title={
              isCurrentlyPlaying
                ? "Pause Spotify stream"
                : `Play "${currentTrack?.title}" on Spotify`
            }
          >
            {isCurrentlyPlaying ? (
              <svg
                viewBox="0 0 24 24"
                className="w-3 h-3 fill-current"
                aria-hidden
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="w-3 h-3 fill-current"
                aria-hidden
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            <span>{isCurrentlyPlaying ? "Pause" : "Play full track"}</span>
          </button>
        </>
      )}
    </div>
  );
}
