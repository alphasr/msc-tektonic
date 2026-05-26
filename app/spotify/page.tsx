'use client';

import { useState, useEffect, useRef } from 'react';
import Navigation from '@/components/Navigation';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ExternalLink,
  AlertCircle,
  Loader2,
  LogOut,
  CheckSquare,
  Square,
  Download,
  Check,
  Music,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: { url: string; width?: number | null }[];
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

interface ImportResult {
  spotify_id: string;
  track_id: string | null;
  status: 'queued' | 'ready' | 'skipped' | 'error';
  reason?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function smallImg(images: { url: string; width?: number | null }[]): string | null {
  if (!images.length) return null;
  return images[images.length - 1].url;
}

function medImg(images: { url: string; width?: number | null }[]): string | null {
  if (!images.length) return null;
  const sorted = [...images].sort(
    (a, b) => Math.abs((a.width ?? 9999) - 300) - Math.abs((b.width ?? 9999) - 300)
  );
  return sorted[0].url;
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

const SpotifyLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function SpotifyPage() {
  const [isChecking, setIsChecking] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

  // Expanded playlist view
  const [openPlaylist, setOpenPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  // Selection
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());

  // Preview audio
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    queued: number; ready: number; skipped: number; errored: number; total: number;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify_connected') || params.get('spotify_error')) {
      window.history.replaceState({}, '', window.location.pathname);
      if (params.get('spotify_error'))
        setError(decodeURIComponent(params.get('spotify_error')!));
    }
    checkStatus();
  }, []);

  // ── Auth ────────────────────────────────────────────────────────────────────

  async function checkStatus() {
    setIsChecking(true);
    try {
      const data = await fetch('/api/spotify/status').then((r) => r.json());
      setIsConnected(data.authenticated);
      if (data.authenticated) loadPlaylists();
    } catch {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  }

  async function handleDisconnect() {
    await fetch('/api/spotify/logout', { method: 'POST' });
    setIsConnected(false);
    setPlaylists([]);
    setOpenPlaylist(null);
    setPlaylistTracks([]);
    setSelectedTracks(new Set());
    stopPreview();
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  async function loadPlaylists() {
    setIsLoadingPlaylists(true);
    setError(null);
    try {
      const data = await fetch('/api/spotify/playlists').then((r) => r.json());
      if (data.error) throw new Error(data.error);
      setPlaylists(data.playlists || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingPlaylists(false);
    }
  }

  async function loadTracks(playlist: SpotifyPlaylist) {
    setOpenPlaylist(playlist);
    setPlaylistTracks([]);
    setSelectedTracks(new Set());
    setIsLoadingTracks(true);
    stopPreview();
    try {
      const data = await fetch(`/api/spotify/playlists/${playlist.id}`).then((r) => r.json());
      if (data.error) throw new Error(data.error);
      setPlaylistTracks(data.tracks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingTracks(false);
    }
  }

  // ── Selection ───────────────────────────────────────────────────────────────

  function toggleTrack(id: string) {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedTracks(new Set(playlistTracks.map((t) => t.id)));
  }

  function selectNone() {
    setSelectedTracks(new Set());
  }

  // ── Preview ─────────────────────────────────────────────────────────────────

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

  // ── Import ──────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (selectedTracks.size === 0) return;
    setIsImporting(true);
    setImportResults(null);
    stopPreview();

    const tracksToImport = playlistTracks
      .filter((t) => selectedTracks.has(t.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.artist,
        previewUrl: t.previewUrl,
        bpm: t.bpm,
        key: t.key,
        energy: t.energy,
        durationMs: t.durationMs,
      }));

    try {
      const res = await fetch('/api/spotify/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: tracksToImport }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImportResults({
        queued: data.queued,
        ready: data.ready,
        skipped: data.skipped,
        errored: data.errored,
        total: tracksToImport.length,
      });
      setSelectedTracks(new Set());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsImporting(false);
    }
  }

  // ── Render: not connected ────────────────────────────────────────────────────

  if (!isChecking && !isConnected) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20 flex items-center justify-center">
            <SpotifyLogo className="w-10 h-10 text-[#1DB954]" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight mb-2">Connect Spotify</h1>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Browse your playlists, select tracks, and import them into your TEKTONIC library for analysis and mixing.
            </p>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20 max-w-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <a
            href="/api/spotify/login"
            className="flex items-center gap-3 px-6 py-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[#1DB954]/30"
          >
            <SpotifyLogo className="w-5 h-5" />
            Connect with Spotify
          </a>
        </div>
      </div>
    );
  }

  if (isChecking) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#1DB954] animate-spin" />
        </div>
      </div>
    );
  }

  const selectedCount = selectedTracks.size;
  const allSelected = playlistTracks.length > 0 && selectedCount === playlistTracks.length;

  // ── Render: connected ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 40px)' }}>
        {/* ── Left panel: playlist list ──────────────────────────────────────── */}
        <div className={cn(
          'flex flex-col border-r border-white/[0.06] bg-background',
          openPlaylist ? 'hidden md:flex w-72 flex-shrink-0' : 'flex flex-1 md:w-80 md:flex-none'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <SpotifyLogo className="w-4 h-4 text-[#1DB954]" />
              <span className="font-bold text-sm">Your Library</span>
              {!isLoadingPlaylists && playlists.length > 0 && (
                <span className="text-xs text-muted-foreground/60">{playlists.length}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadPlaylists}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/[0.06] transition-colors text-muted-foreground hover:text-white"
                title="Refresh playlists"
              >
                <RefreshCw className={cn('w-3 h-3', isLoadingPlaylists && 'animate-spin')} />
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/[0.06]"
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-3 mt-2 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-400/10 px-2 py-1.5 rounded-lg border border-red-400/20">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Playlist list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoadingPlaylists ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <Loader2 className="w-5 h-5 text-[#1DB954] animate-spin" />
                <div className="text-xs text-muted-foreground">Loading playlists…</div>
              </div>
            ) : playlists.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No playlists found</div>
            ) : (
              playlists.map((playlist) => {
                const isOpen = openPlaylist?.id === playlist.id;
                const thumb = smallImg(playlist.images);
                return (
                  <button
                    key={playlist.id}
                    onClick={() => loadTracks(playlist)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 transition-colors group text-left',
                      isOpen ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                    )}
                  >
                    <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-white/[0.05] shadow-sm">
                      {thumb ? (
                        <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" width={40} height={40} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4 text-muted-foreground/25" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        'text-xs font-semibold truncate transition-colors',
                        isOpen ? 'text-white' : 'text-foreground/80 group-hover:text-white'
                      )}>
                        {playlist.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60">
                        {playlist.tracks.total} songs
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      'w-3.5 h-3.5 flex-shrink-0 transition-colors',
                      isOpen ? 'text-[#1DB954]' : 'text-muted-foreground/25 group-hover:text-muted-foreground/50'
                    )} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right panel: track list ────────────────────────────────────────── */}
        {openPlaylist ? (
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Playlist header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
              <button
                className="md:hidden w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                onClick={() => { setOpenPlaylist(null); setPlaylistTracks([]); stopPreview(); }}
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Cover art */}
              {(() => {
                const img = medImg(openPlaylist.images);
                return img ? (
                  <img src={img} alt="" className="w-12 h-12 rounded shadow-lg flex-shrink-0" loading="lazy" width={48} height={48} />
                ) : (
                  <div className="w-12 h-12 rounded bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                    <Music className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                );
              })()}

              <div className="flex-1 min-w-0">
                <h2 className="font-black text-base truncate">{openPlaylist.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {isLoadingTracks ? 'Loading…' : `${playlistTracks.length} tracks`}
                  {openPlaylist.owner?.display_name && (
                    <span className="ml-1.5 opacity-50">· {openPlaylist.owner.display_name}</span>
                  )}
                </p>
              </div>

              {/* Select all / none */}
              {!isLoadingTracks && playlistTracks.length > 0 && (
                <button
                  onClick={allSelected ? selectNone : selectAll}
                  className={cn(
                    'text-[10px] font-bold px-2.5 py-1 rounded border transition-all flex-shrink-0',
                    allSelected
                      ? 'bg-[#1DB954]/15 border-[#1DB954]/30 text-[#1DB954]'
                      : 'border-white/10 text-muted-foreground hover:text-white hover:border-white/20'
                  )}
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            {/* Import results banner */}
            {importResults && (
              <div className="flex-shrink-0 mx-4 mt-2 flex items-center gap-3 bg-[#1DB954]/10 border border-[#1DB954]/25 px-3 py-2 rounded-xl text-[11px]">
                <Check className="w-4 h-4 text-[#1DB954] flex-shrink-0" />
                <span className="text-[#1DB954] font-semibold">Import started</span>
                <span className="text-muted-foreground">
                  {importResults.queued > 0 && `${importResults.queued} analyzing`}
                  {importResults.ready > 0 && (importResults.queued > 0 ? `, ` : '') + `${importResults.ready} added instantly`}
                  {importResults.skipped > 0 && ` · ${importResults.skipped} already in library`}
                  {importResults.errored > 0 && ` · ${importResults.errored} failed`}
                </span>
                <button
                  onClick={() => setImportResults(null)}
                  className="ml-auto text-muted-foreground/50 hover:text-muted-foreground"
                >✕</button>
              </div>
            )}

            {/* Track list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {isLoadingTracks ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2">
                  <Loader2 className="w-5 h-5 text-[#1DB954] animate-spin" />
                  <div className="text-xs text-muted-foreground">Fetching tracks…</div>
                </div>
              ) : playlistTracks.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No tracks</div>
              ) : (
                playlistTracks.map((track, idx) => {
                  const isSelected = selectedTracks.has(track.id);
                  const isPreviewing = previewingId === track.id;
                  const isHovered = hoveredId === track.id;
                  const canPreview = !!track.previewUrl;

                  return (
                    <div
                      key={track.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 transition-colors cursor-default group',
                        isSelected ? 'bg-[#1DB954]/[0.06]' : isPreviewing ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'
                      )}
                      onMouseEnter={() => setHoveredId(track.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleTrack(track.id)}
                        className={cn(
                          'w-4 h-4 flex-shrink-0 flex items-center justify-center rounded transition-all',
                          isSelected ? 'text-[#1DB954]' : 'text-muted-foreground/30 hover:text-muted-foreground'
                        )}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>

                      {/* Track # / play */}
                      <div className="w-5 flex-shrink-0 flex items-center justify-center">
                        {isPreviewing ? (
                          <button onClick={stopPreview} className="text-[#1DB954]">
                            <Pause className="w-3 h-3" />
                          </button>
                        ) : isHovered && canPreview ? (
                          <button onClick={() => togglePreview(track)} className="text-white/60 hover:text-white">
                            <Play className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[9px] font-mono text-muted-foreground/30 text-center w-full">
                            {idx + 1}
                          </span>
                        )}
                      </div>

                      {/* Album art */}
                      <div className="w-9 h-9 flex-shrink-0 rounded overflow-hidden bg-white/[0.05] shadow-sm">
                        {track.albumArt ? (
                          <img src={track.albumArt} alt="" className="w-full h-full object-cover" loading="lazy" width={36} height={36} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-3.5 h-3.5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Title + artist */}
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          'text-xs font-medium truncate',
                          isPreviewing ? 'text-[#1DB954]' : 'text-foreground/90'
                        )}>
                          {track.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground truncate">{track.artist}</span>
                          {!canPreview && (
                            <span className="text-[8px] text-muted-foreground/40 flex-shrink-0 border border-white/10 px-1 rounded">no preview</span>
                          )}
                        </div>
                      </div>

                      {/* Album (hidden on small) */}
                      <div className="hidden lg:block flex-1 min-w-0 max-w-[160px]">
                        <span className="text-[10px] text-muted-foreground/50 truncate block">{track.album}</span>
                      </div>

                      {/* BPM + key */}
                      <div className="hidden sm:flex flex-col items-end gap-0.5 w-12 flex-shrink-0">
                        {track.bpm > 0 && <span className="text-[9px] font-mono text-muted-foreground/50">{track.bpm} BPM</span>}
                        {track.key !== '?' && <span className="text-[9px] font-mono text-muted-foreground/50">{track.key}</span>}
                      </div>

                      {/* Duration */}
                      <div className="text-[10px] font-mono text-muted-foreground/40 w-9 text-right flex-shrink-0">
                        {fmtMs(track.durationMs)}
                      </div>

                      {/* Open in Spotify link */}
                      <a
                        href={track.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-white hover:bg-white/[0.08] transition-all flex-shrink-0',
                          isHovered ? 'opacity-100' : 'opacity-0'
                        )}
                        title="Open in Spotify"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  );
                })
              )}
            </div>

            {/* Import footer bar */}
            {playlistTracks.length > 0 && (
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-background/80 backdrop-blur-sm">
                <div className="text-xs text-muted-foreground">
                  {selectedCount > 0 ? (
                    <span className="text-[#1DB954] font-semibold">{selectedCount} selected</span>
                  ) : (
                    <span>Select tracks to import</span>
                  )}
                  {selectedCount > 0 && (
                    <span className="ml-2 text-muted-foreground/50">
                      · {playlistTracks.filter((t) => selectedTracks.has(t.id) && t.previewUrl).length} with audio preview
                    </span>
                  )}
                </div>

                <button
                  onClick={handleImport}
                  disabled={selectedCount === 0 || isImporting}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all',
                    selectedCount > 0 && !isImporting
                      ? 'bg-[#1DB954] hover:bg-[#1ed760] text-black hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#1DB954]/20'
                      : 'bg-white/[0.06] text-muted-foreground cursor-not-allowed'
                  )}
                >
                  {isImporting ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Importing…</>
                  ) : (
                    <><Download className="w-3 h-3" /> Import to Library{selectedCount > 0 ? ` (${selectedCount})` : ''}</>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Empty state when no playlist is open on desktop */
          <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-3 text-center">
            <SpotifyLogo className="w-12 h-12 text-[#1DB954]/20" />
            <p className="text-sm text-muted-foreground/50">Select a playlist to browse tracks</p>
          </div>
        )}
      </div>
    </div>
  );
}
