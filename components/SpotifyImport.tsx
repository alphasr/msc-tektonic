'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Track } from '@/types';
import { cn } from '@/lib/utils';

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: { url: string; width?: number | null; height?: number | null }[];
  tracks: { total: number };
  owner: { display_name: string };
}

interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string | null;
  durationMs: number;
  previewUrl: string | null;
  spotifyUrl: string;
  bpm: number;
  key: string;
  energy: number;
  popularity: number;
}

interface SpotifyImportProps {
  localTracks: Track[];
  onLoadTrack: (track: Track, deck: 'A' | 'B') => void;
}

// Spotify returns images sorted by width descending — pick smallest for thumbnails
function smallestImage(images: { url: string; width?: number | null }[]): string | null {
  if (!images.length) return null;
  return images[images.length - 1].url;
}

// Pick closest to 160px for headers
function headerImage(images: { url: string; width?: number | null }[]): string | null {
  if (!images.length) return null;
  const sorted = [...images].sort(
    (a, b) => Math.abs((a.width ?? 9999) - 160) - Math.abs((b.width ?? 9999) - 160)
  );
  return sorted[0].url;
}

function matchToLocal(spotify: SpotifyTrack, localTracks: Track[]): Track | null {
  const spName = spotify.name.toLowerCase().trim();
  const spArtist = spotify.artist.toLowerCase().trim();
  return (
    localTracks.find((t) => {
      const tName = t.title.toLowerCase().trim();
      const tArtist = t.artist.toLowerCase().trim();
      return (
        (tName.includes(spName) || spName.includes(tName)) &&
        (tArtist.includes(spArtist.split(',')[0].trim()) || spArtist.includes(tArtist))
      );
    }) ?? null
  );
}

// Convert a Spotify track to the app's Track type so it can be loaded to a deck.
// Uses previewUrl as the audio source (30 s clip); waveform is empty so the deck
// renders a flat line rather than crashing.
function toAppTrack(t: SpotifyTrack): Track {
  return {
    id: `spotify_${t.id}`,
    title: t.name,
    artist: t.artist,
    bpm: t.bpm,
    key: t.key,
    energy: t.energy,
    duration: Math.round(t.durationMs / 1000),
    tags: ['spotify'],
    phrases: 0,
    audioUrl: t.previewUrl ?? undefined,
    waveform: [],
  };
}

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

const SpotifyLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export default function SpotifyImport({ localTracks, onLoadTrack }: SpotifyImportProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify_connected'))
      window.history.replaceState({}, '', window.location.pathname);
    if (params.get('spotify_error')) {
      setError(decodeURIComponent(params.get('spotify_error')!));
      window.history.replaceState({}, '', window.location.pathname);
    }
    checkStatus();
  }, []);

  async function checkStatus() {
    setIsChecking(true);
    try {
      const res = await fetch('/api/spotify/status');
      const data = await res.json();
      setIsConnected(data.authenticated);
      if (data.authenticated) loadPlaylists();
    } catch {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  }

  async function loadPlaylists() {
    setIsLoadingPlaylists(true);
    setError(null);
    try {
      const res = await fetch('/api/spotify/playlists');
      if (res.status === 401) { setIsConnected(false); return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlaylists(data.playlists || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingPlaylists(false);
    }
  }

  async function openPlaylist(playlist: SpotifyPlaylist) {
    setSelectedPlaylist(playlist);
    setTracks([]);
    setIsLoadingTracks(true);
    setError(null);
    stopPreview();
    try {
      const res = await fetch(`/api/spotify/playlists/${playlist.id}`);
      if (res.status === 401) { setIsConnected(false); return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTracks(data.tracks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingTracks(false);
    }
  }

  async function handleDisconnect() {
    await fetch('/api/spotify/logout', { method: 'POST' });
    setIsConnected(false);
    setPlaylists([]);
    setSelectedPlaylist(null);
    setTracks([]);
    stopPreview();
  }

  function togglePreview(track: SpotifyTrack) {
    if (!track.previewUrl) return;
    if (previewingId === track.id) { stopPreview(); return; }
    stopPreview();
    const audio = new Audio(track.previewUrl);
    audio.volume = 0.7;
    audio.play().catch(console.error);
    audio.onended = () => setPreviewingId(null);
    audioRef.current = audio;
    setPreviewingId(track.id);
  }

  function stopPreview() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPreviewingId(null);
  }

  function loadToDeck(track: SpotifyTrack, deck: 'A' | 'B') {
    stopPreview();
    const local = matchToLocal(track, localTracks);
    onLoadTrack(local ?? toAppTrack(track), deck);
  }

  // ── Loading spinner ─────────────────────────────────────────────────────────
  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-[#1DB954] animate-spin" />
      </div>
    );
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20 flex items-center justify-center">
          <SpotifyLogo className="w-8 h-8 text-[#1DB954]" />
        </div>
        <div>
          <h3 className="text-[13px] font-bold mb-1.5 tracking-tight">Connect to Spotify</h3>
          <p className="text-[10px] text-muted-foreground max-w-[220px] leading-relaxed">
            Browse your playlists and load any track onto a deck. Matched local tracks play in full; others use the 30 s preview.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-[10px] text-red-400 bg-red-400/10 px-3 py-2 rounded-lg border border-red-400/20 max-w-[260px]">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {error}
          </div>
        )}
        <a
          href="/api/spotify/login"
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-[12px] font-bold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-lg shadow-[#1DB954]/25"
        >
          <SpotifyLogo className="w-4 h-4" />
          Connect with Spotify
        </a>
      </div>
    );
  }

  // ── Track list (inside a playlist) ─────────────────────────────────────────
  if (selectedPlaylist) {
    const cover = headerImage(selectedPlaylist.images);
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Playlist header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-white/[0.06]">
          <button
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
            onClick={() => { setSelectedPlaylist(null); setTracks([]); stopPreview(); }}
          >
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          {cover && (
            <img
              src={cover}
              alt=""
              className="w-7 h-7 rounded object-cover flex-shrink-0 shadow"
              loading="lazy"
              width={28}
              height={28}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold truncate">{selectedPlaylist.name}</div>
            <div className="text-[9px] text-muted-foreground">
              {isLoadingTracks ? 'Loading…' : `${tracks.length} tracks`}
              {selectedPlaylist.owner?.display_name && (
                <span className="ml-1 opacity-50">· {selectedPlaylist.owner.display_name}</span>
              )}
            </div>
          </div>
          <SpotifyLogo className="w-3 h-3 text-[#1DB954] flex-shrink-0 opacity-60" />
        </div>

        {error && (
          <div className="flex-shrink-0 mx-2 mt-1 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-400/10 px-2 py-1.5 rounded-lg border border-red-400/20">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Tracks */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoadingTracks ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Loader2 className="w-4 h-4 text-[#1DB954] animate-spin" />
              <div className="text-[9px] text-muted-foreground">Fetching tracks…</div>
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground">
              No tracks found
            </div>
          ) : (
            tracks.map((track, idx) => {
              const local = matchToLocal(track, localTracks);
              const isPreviewing = previewingId === track.id;
              const isHovered = hoveredId === track.id;
              const canPreview = !!track.previewUrl;

              return (
                <div
                  key={track.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-[5px] transition-colors cursor-default',
                    isPreviewing ? 'bg-[#1DB954]/[0.07]' : 'hover:bg-white/[0.035]'
                  )}
                  onMouseEnter={() => setHoveredId(track.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Track # / play */}
                  <div className="w-4 flex-shrink-0 flex items-center justify-center">
                    {isPreviewing ? (
                      <button onClick={stopPreview} className="text-[#1DB954]">
                        <Pause className="w-2.5 h-2.5" />
                      </button>
                    ) : isHovered && canPreview ? (
                      <button onClick={() => togglePreview(track)} className="text-white/70 hover:text-white">
                        <Play className="w-2.5 h-2.5" />
                      </button>
                    ) : (
                      <span className={cn(
                        'text-[8px] font-mono text-center w-full',
                        isPreviewing ? 'text-[#1DB954]' : 'text-muted-foreground/40'
                      )}>
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Album art 32×32 */}
                  <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-white/[0.05]">
                    {track.albumArt ? (
                      <img
                        src={track.albumArt}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        width={32}
                        height={32}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-3 h-3 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Title + artist */}
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-[10px] font-medium truncate leading-tight',
                      isPreviewing ? 'text-[#1DB954]' : 'text-foreground/90'
                    )}>
                      {track.name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-muted-foreground truncate">{track.artist}</span>
                      {local && (
                        <span className="text-[7px] font-bold text-emerald-400/80 bg-emerald-400/10 px-1 py-px rounded flex-shrink-0">
                          LOCAL
                        </span>
                      )}
                    </div>
                  </div>

                  {/* BPM + key (shown when not hovered) */}
                  {!isHovered && (
                    <div className="flex flex-col items-end gap-px flex-shrink-0 w-8">
                      {track.bpm > 0 && (
                        <span className="text-[7px] font-mono text-muted-foreground/50">{track.bpm}</span>
                      )}
                      {track.key !== '?' && (
                        <span className="text-[7px] font-mono text-muted-foreground/50">{track.key}</span>
                      )}
                    </div>
                  )}

                  {/* Duration */}
                  <div className="text-[9px] font-mono text-muted-foreground/40 w-7 text-right flex-shrink-0">
                    {fmtMs(track.durationMs)}
                  </div>

                  {/* Actions — slide in on hover */}
                  <div className={cn(
                    'flex items-center gap-1 flex-shrink-0 transition-all duration-150',
                    isHovered || isPreviewing ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
                  )}>
                    <button
                      className="w-[18px] h-[18px] rounded text-[7px] font-bold bg-[var(--deck-a)]/15 hover:bg-[var(--deck-a)]/30 text-[var(--deck-a)] border border-[var(--deck-a)]/20 transition-colors"
                      onClick={() => loadToDeck(track, 'A')}
                      title={local ? 'Load to Deck A (local file)' : 'Load to Deck A (30s preview)'}
                    >A</button>
                    <button
                      className="w-[18px] h-[18px] rounded text-[7px] font-bold bg-[var(--deck-b)]/15 hover:bg-[var(--deck-b)]/30 text-[var(--deck-b)] border border-[var(--deck-b)]/20 transition-colors"
                      onClick={() => loadToDeck(track, 'B')}
                      title={local ? 'Load to Deck B (local file)' : 'Load to Deck B (30s preview)'}
                    >B</button>
                    <a
                      href={track.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-[18px] h-[18px] rounded flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] text-muted-foreground hover:text-white transition-colors"
                      title="Open in Spotify"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-2 h-2" />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── Playlist list ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <SpotifyLogo className="w-3.5 h-3.5 text-[#1DB954]" />
          <span className="text-[10px] font-bold text-[#1DB954] tracking-wide">Your Library</span>
          {!isLoadingPlaylists && playlists.length > 0 && (
            <span className="text-[9px] text-muted-foreground/60">{playlists.length}</span>
          )}
        </div>
        <button
          onClick={handleDisconnect}
          className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-white/[0.07]"
        >
          <LogOut className="w-2.5 h-2.5" />
          Sign out
        </button>
      </div>

      {error && (
        <div className="flex-shrink-0 mx-2 mt-1.5 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-400/10 px-2 py-1.5 rounded-lg border border-red-400/20">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoadingPlaylists ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Loader2 className="w-4 h-4 text-[#1DB954] animate-spin" />
            <div className="text-[9px] text-muted-foreground">Loading your playlists…</div>
          </div>
        ) : playlists.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground">
            No playlists found
          </div>
        ) : (
          playlists.map((playlist) => {
            const thumb = smallestImage(playlist.images);
            return (
              <button
                key={playlist.id}
                onClick={() => openPlaylist(playlist)}
                className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/[0.04] transition-colors group text-left"
              >
                {/* 36×36 thumbnail */}
                <div className="w-9 h-9 flex-shrink-0 rounded overflow-hidden bg-white/[0.05] shadow-sm">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      width={36}
                      height={36}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-4 h-4 text-muted-foreground/25" />
                    </div>
                  )}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold truncate text-foreground/85 group-hover:text-white transition-colors">
                    {playlist.name}
                  </div>
                  <div className="text-[9px] text-muted-foreground/60 truncate">
                    Playlist · {playlist.tracks.total} songs
                  </div>
                </div>

                <ChevronRight className="w-3 h-3 text-muted-foreground/25 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
