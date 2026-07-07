'use client';

import { useState, useEffect, useRef } from 'react';
import Navigation from '@/components/Navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Upload,
  FileAudio,
  RefreshCw,
  Activity,
  Clock,
  Music,
  Zap,
  Hash,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  AlertCircle,
  Download,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Track } from '@/types';
import { getCamelotColor } from '@/lib/utils';
import { cn } from '@/lib/utils';

// ── Spotify mini types ─────────────────────────────────────────────────────

interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string; width?: number | null }[];
  tracks: { total: number };
  owner: { display_name: string };
}

interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  albumArt: string | null;
  durationMs: number;
  previewUrl: string | null;
  spotifyUrl: string;
  bpm: number;
  key: string;
  energy: number;
}

const SpotifyLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox='0 0 24 24' fill='currentColor'>
    <path d='M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z' />
  </svg>
);

function smallImg(
  images: { url: string; width?: number | null }[],
): string | null {
  if (!images.length) return null;
  return images[images.length - 1].url;
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// ── Spotify mini picker ────────────────────────────────────────────────────

function SpotifyMiniPicker({ onImportDone }: { onImportDone: () => void }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [openPlaylist, setOpenPlaylist] = useState<SpotifyPlaylist | null>(
    null,
  );
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importDone, setImportDone] = useState<{
    queued: number;
    ready: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/spotify/status')
      .then((r) => r.json())
      .then((d) => {
        setIsConnected(d.authenticated);
        if (d.authenticated) loadPlaylists();
      })
      .catch(() => setIsConnected(false))
      .finally(() => setIsChecking(false));
  }, []);

  async function loadPlaylists() {
    setIsLoadingPlaylists(true);
    const data = await fetch('/api/spotify/playlists').then((r) => r.json());
    if (!data.error) setPlaylists(data.playlists || []);
    setIsLoadingPlaylists(false);
  }

  async function openPl(pl: SpotifyPlaylist) {
    setOpenPlaylist(pl);
    setTracks([]);
    setSelected(new Set());
    setIsLoadingTracks(true);
    const data = await fetch(`/api/spotify/playlists/${pl.id}`).then((r) =>
      r.json(),
    );
    if (!data.error) setTracks(data.tracks || []);
    setIsLoadingTracks(false);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setIsImporting(true);
    const tracksToImport = tracks
      .filter((t) => selected.has(t.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.artist,
        previewUrl: t.previewUrl,
        bpm: t.bpm,
        key: t.key,
        energy: t.energy,
        durationMs: t.durationMs,
        albumArt: t.albumArt,
        spotifyUrl: t.spotifyUrl,
      }));
    try {
      const res = await fetch('/api/spotify/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: tracksToImport }),
      });
      const data = await res.json();
      setImportDone({ queued: data.queued, ready: data.ready });
      setSelected(new Set());
      setTimeout(onImportDone, 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsImporting(false);
    }
  }

  if (isChecking)
    return (
      <div className='flex items-center justify-center h-32'>
        <Loader2 className='w-5 h-5 text-[#1DB954] animate-spin' />
      </div>
    );

  if (!isConnected)
    return (
      <div className='flex flex-col items-center justify-center gap-4 py-8 text-center'>
        <SpotifyLogo className='w-10 h-10 text-[#1DB954]/40' />
        <p className='text-sm text-muted-foreground'>
          Connect Spotify to import tracks for analysis
        </p>
        <a
          href='/api/spotify/login'
          className='flex items-center gap-2 px-4 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold transition-all hover:scale-[1.02]'
        >
          <SpotifyLogo className='w-3.5 h-3.5' />
          Connect Spotify
        </a>
      </div>
    );

  if (importDone)
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-8 text-center'>
        <div className='w-12 h-12 rounded-full bg-[#1DB954]/15 flex items-center justify-center'>
          <Check className='w-6 h-6 text-[#1DB954]' />
        </div>
        <div>
          <p className='text-sm font-bold text-[#1DB954]'>Import started!</p>
          <p className='text-xs text-muted-foreground mt-0.5'>
            {importDone.queued > 0 &&
              `${importDone.queued} tracks being analyzed`}
            {importDone.ready > 0 &&
              (importDone.queued > 0 ? ' · ' : '') +
                `${importDone.ready} added instantly`}
          </p>
        </div>
        <p className='text-[10px] text-muted-foreground/50'>
          Refreshing library…
        </p>
      </div>
    );

  // playlist list
  if (!openPlaylist)
    return (
      <div className='space-y-1'>
        <p className='text-[10px] text-muted-foreground px-1 mb-2'>
          Select a playlist to import tracks
        </p>
        {isLoadingPlaylists ? (
          <div className='flex items-center justify-center h-20'>
            <Loader2 className='w-4 h-4 text-[#1DB954] animate-spin' />
          </div>
        ) : (
          playlists.map((pl) => {
            const thumb = smallImg(pl.images);
            return (
              <button
                key={pl.id}
                onClick={() => openPl(pl)}
                className='w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.05] transition-colors group text-left'
              >
                <div className='w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-white/[0.05]'>
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=''
                      className='w-full h-full object-cover'
                      loading='lazy'
                      width={32}
                      height={32}
                    />
                  ) : (
                    <Music className='w-4 h-4 text-muted-foreground/25 m-2' />
                  )}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='text-xs font-medium truncate text-foreground/80 group-hover:text-white'>
                    {pl.name}
                  </div>
                  <div className='text-[9px] text-muted-foreground/50'>
                    {pl.tracks.total} songs
                  </div>
                </div>
                <ChevronRight className='w-3 h-3 text-muted-foreground/25 group-hover:text-muted-foreground/60 flex-shrink-0' />
              </button>
            );
          })
        )}
      </div>
    );

  // track list inside playlist
  const allSel = tracks.length > 0 && selected.size === tracks.length;
  return (
    <div className='space-y-2'>
      {/* header */}
      <div className='flex items-center gap-2'>
        <button
          onClick={() => {
            setOpenPlaylist(null);
            setTracks([]);
            setSelected(new Set());
          }}
          className='w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 transition-colors'
        >
          <ChevronLeft className='w-3.5 h-3.5 text-muted-foreground' />
        </button>
        <span className='text-xs font-semibold truncate flex-1'>
          {openPlaylist.name}
        </span>
        <button
          onClick={() =>
            allSel
              ? setSelected(new Set())
              : setSelected(new Set(tracks.map((t) => t.id)))
          }
          className='text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 text-muted-foreground hover:text-white hover:border-white/20 transition-all flex-shrink-0'
        >
          {allSel ? 'None' : 'All'}
        </button>
      </div>

      {error && (
        <div className='flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 px-2 py-1.5 rounded border border-red-400/20'>
          <AlertCircle className='w-3 h-3' />
          {error}
        </div>
      )}

      {/* track rows */}
      <div className='max-h-[300px] overflow-y-auto space-y-0.5'>
        {isLoadingTracks ? (
          <div className='flex items-center justify-center h-20'>
            <Loader2 className='w-4 h-4 text-[#1DB954] animate-spin' />
          </div>
        ) : (
          tracks.map((track, idx) => {
            const isSel = selected.has(track.id);
            return (
              <div
                key={track.id}
                onClick={() => toggle(track.id)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
                  isSel ? 'bg-[#1DB954]/[0.07]' : 'hover:bg-white/[0.03]',
                )}
              >
                <button
                  className={cn(
                    'flex-shrink-0 transition-colors',
                    isSel ? 'text-[#1DB954]' : 'text-muted-foreground/30',
                  )}
                >
                  {isSel ? (
                    <CheckSquare className='w-3.5 h-3.5' />
                  ) : (
                    <Square className='w-3.5 h-3.5' />
                  )}
                </button>
                <div className='w-7 h-7 flex-shrink-0 rounded overflow-hidden bg-white/[0.05]'>
                  {track.albumArt ? (
                    <img
                      src={track.albumArt}
                      alt=''
                      className='w-full h-full object-cover'
                      loading='lazy'
                      width={28}
                      height={28}
                    />
                  ) : (
                    <Music className='w-3 h-3 text-muted-foreground/30 m-2' />
                  )}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='text-[10px] font-medium truncate'>
                    {track.name}
                  </div>
                  <div className='text-[9px] text-muted-foreground/60 truncate'>
                    {track.artist}
                  </div>
                </div>
                <span className='text-[9px] font-mono text-muted-foreground/40 flex-shrink-0'>
                  {fmtMs(track.durationMs)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={selected.size === 0 || isImporting}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2 rounded-full text-xs font-bold transition-all mt-2',
          selected.size > 0 && !isImporting
            ? 'bg-[#1DB954] hover:bg-[#1ed760] text-black hover:scale-[1.01]'
            : 'bg-white/[0.05] text-muted-foreground cursor-not-allowed',
        )}
      >
        {isImporting ? (
          <>
            <Loader2 className='w-3 h-3 animate-spin' /> Importing…
          </>
        ) : (
          <>
            <Download className='w-3 h-3' /> Import{' '}
            {selected.size > 0 ? `${selected.size} tracks` : ''} to Library
          </>
        )}
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const [uploadTab, setUploadTab] = useState<'file' | 'spotify'>('file');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const handleReanalyze = async () => {
    if (!selectedTrack) return;
    setReanalyzing(true);
    try {
      const res = await fetch(`/api/spotify/reanalyze/${selectedTrack.id}`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchTracks();
        // Refresh selectedTrack with updated data
        const updated = (await fetch('/api/tracks').then((r) =>
          r.json(),
        )) as Track[];
        const refreshed = updated.find((t) => t.id === selectedTrack.id);
        if (refreshed) setSelectedTrack(refreshed);
      }
    } catch {
    } finally {
      setReanalyzing(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    setLoadingTracks(true);
    try {
      const response = await fetch('/api/tracks');
      if (response.ok) setTracks(await response.json());
    } catch {
    } finally {
      setLoadingTracks(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setSelectedFile(e.dataTransfer.files[0]);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('audio_file', selectedFile);
      formData.append('title', selectedFile.name.replace(/\.[^/.]+$/, ''));
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        setSelectedFile(null);
        setTimeout(fetchTracks, 2000);
      } else {
        const err = await response.json();
        alert(`Upload failed: ${err.error || 'Unknown error'}`);
      }
    } catch {
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, '0')}`;

  return (
    <div className='min-h-screen flex flex-col bg-background'>
      <Navigation />
      <div className='flex-1 container mx-auto p-4 md:p-8 overflow-y-auto'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
          {/* ── LEFT COLUMN: import section ─────────────────────────────── */}
          <div className='space-y-6'>
            <Card>
              <CardHeader className='pb-3'>
                {/* Tab switcher */}
                <div className='flex items-center gap-1 mb-2'>
                  <button
                    onClick={() => setUploadTab('file')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      uploadTab === 'file'
                        ? 'bg-primary/15 text-primary border border-primary/25'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent',
                    )}
                  >
                    <Upload className='w-3 h-3' />
                    Upload File
                  </button>
                  <button
                    onClick={() => setUploadTab('spotify')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      uploadTab === 'spotify'
                        ? 'bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/25'
                        : 'text-[#1DB954]/50 hover:text-[#1DB954] hover:bg-[#1DB954]/[0.05] border border-transparent',
                    )}
                  >
                    <SpotifyLogo className='w-3 h-3' />
                    From Spotify
                  </button>
                </div>
                <CardTitle className='text-base'>
                  {uploadTab === 'file'
                    ? 'Upload & Analyze'
                    : 'Import from Spotify'}
                </CardTitle>
                <CardDescription>
                  {uploadTab === 'file'
                    ? 'Upload an audio file to analyze BPM, key, energy, and structure'
                    : 'Select tracks from your Spotify playlists to import and analyze'}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {uploadTab === 'file' ? (
                  <>
                    <div
                      className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${dragActive ? 'border-primary bg-primary/10' : 'border-muted'}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <Upload className='w-10 h-10 mx-auto mb-4 text-muted-foreground' />
                      <p className='mb-2'>Drag and drop your audio file here</p>
                      <p className='text-sm text-muted-foreground mb-4'>or</p>
                      <div>
                        <Input
                          type='file'
                          accept='audio/*'
                          onChange={(e) =>
                            e.target.files?.[0] &&
                            setSelectedFile(e.target.files[0])
                          }
                          className='hidden'
                          id='file-upload'
                        />
                        <Button
                          type='button'
                          variant='outline'
                          onClick={() =>
                            document.getElementById('file-upload')?.click()
                          }
                        >
                          Browse Files
                        </Button>
                      </div>
                      {selectedFile && (
                        <div className='mt-4 flex items-center justify-center gap-2 text-sm text-primary'>
                          <FileAudio className='w-4 h-4' />
                          <span className='truncate max-w-[200px]'>
                            {selectedFile.name}
                          </span>
                        </div>
                      )}
                    </div>
                    {selectedFile && (
                      <Button
                        className='mt-4 w-full'
                        onClick={handleAnalyze}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />{' '}
                            Uploading…
                          </>
                        ) : (
                          'Start Analysis'
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <SpotifyMiniPicker
                    onImportDone={() => {
                      fetchTracks();
                      setUploadTab('file');
                    }}
                  />
                )}
              </CardContent>
            </Card>

            {/* ── Analyzed tracks list ───────────────────────────────────── */}
            <Card>
              <CardHeader className='flex flex-row items-center justify-between'>
                <div>
                  <CardTitle>Analyzed Tracks</CardTitle>
                  <CardDescription>Your music library</CardDescription>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={fetchTracks}
                  disabled={loadingTracks}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loadingTracks ? 'animate-spin' : ''}`}
                  />
                </Button>
              </CardHeader>
              <CardContent className='max-h-[500px] overflow-y-auto p-0'>
                {tracks.length > 0 ? (
                  <div className='divide-y divide-border'>
                    {tracks.map((track) => (
                      <div
                        key={track.id}
                        className={`p-4 flex items-center justify-between cursor-pointer hover:bg-card/50 transition-colors ${selectedTrack?.id === track.id ? 'bg-primary/5 border-l-4 border-primary' : ''}`}
                        onClick={() => setSelectedTrack(track)}
                      >
                        <div className='flex items-center gap-3 overflow-hidden'>
                          <div className='w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0 relative'>
                            <Music className='w-5 h-5 text-primary' />
                            {track.tags?.includes('spotify') && (
                              <div className='absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1DB954] flex items-center justify-center shadow'>
                                <SpotifyLogo className='w-2.5 h-2.5 text-black' />
                              </div>
                            )}
                          </div>
                          <div className='truncate'>
                            <p className='font-medium truncate text-sm'>
                              {track.title}
                            </p>
                            <p className='text-xs text-muted-foreground truncate'>
                              {track.artist || 'Unknown Artist'}
                            </p>
                          </div>
                        </div>
                        <div className='flex gap-3 shrink-0 px-2 text-xs text-muted-foreground items-center'>
                          <span className='w-12 text-right whitespace-nowrap'>
                            {track.bpm} <span className='text-[10px]'>BPM</span>
                          </span>
                          <span
                            className='w-8 text-center font-bold px-1.5 py-0.5 rounded text-white shadow-sm'
                            style={{
                              backgroundColor: getCamelotColor(track.key),
                            }}
                          >
                            {track.key}
                          </span>
                          <span className='w-8 text-center whitespace-nowrap'>
                            E: {track.energy.toFixed(1)}
                          </span>
                          <span className='w-10 text-right whitespace-nowrap'>
                            {formatDuration(track.duration)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='p-8 text-center text-muted-foreground'>
                    {loadingTracks
                      ? 'Loading tracks...'
                      : 'No analyzed tracks found. Upload music or import from Spotify!'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT COLUMN: analysis detail ─────────────────────────── */}
          <div>
            <Card className='h-full'>
              <CardHeader>
                <CardTitle>Song Analysis</CardTitle>
                <CardDescription>
                  {selectedTrack
                    ? 'Detailed metrics for the selected track'
                    : 'Select a track to view analysis'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedTrack ? (
                  <div className='space-y-6'>
                    <div>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <h2 className='text-2xl font-bold'>
                          {selectedTrack.title}
                        </h2>
                        {selectedTrack.tags?.includes('spotify') && (
                          <span className='flex items-center gap-1 text-[10px] font-bold text-[#1DB954] bg-[#1DB954]/10 px-2 py-0.5 rounded-full border border-[#1DB954]/20'>
                            <SpotifyLogo className='w-2.5 h-2.5' /> SPOTIFY
                          </span>
                        )}
                        {(selectedTrack.bpm === 0 ||
                          selectedTrack.key === '?') && (
                          <button
                            onClick={handleReanalyze}
                            disabled={reanalyzing}
                            className='ml-auto flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50'
                            title='Fetch real analysis data from Spotify'
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${reanalyzing ? 'animate-spin' : ''}`}
                            />
                            {reanalyzing ? 'Refreshing…' : 'Refresh Analysis'}
                          </button>
                        )}
                      </div>
                      <p className='text-muted-foreground'>
                        {selectedTrack.artist}
                      </p>
                    </div>

                    <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
                      <div className='relative overflow-hidden rounded-xl border bg-gradient-to-br from-card to-card/50 p-5 shadow-sm'>
                        <div className='absolute top-0 right-0 p-3 opacity-10'>
                          <Activity className='w-16 h-16' />
                        </div>
                        <div className='font-semibold mb-2 text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5'>
                          <Activity className='w-3 h-3 text-primary' /> Tempo
                        </div>
                        <div className='text-3xl font-black tracking-tighter'>
                          {selectedTrack.bpm}{' '}
                          <span className='text-sm font-medium tracking-normal text-muted-foreground'>
                            BPM
                          </span>
                        </div>
                      </div>

                      <div
                        className='relative overflow-hidden rounded-xl border p-5 shadow-sm text-white'
                        style={{
                          background: `linear-gradient(135deg, ${getCamelotColor(selectedTrack.key)} 0%, ${getCamelotColor(selectedTrack.key)}88 100%)`,
                        }}
                      >
                        <div className='absolute top-0 right-0 p-3 opacity-20 text-black'>
                          <Hash className='w-16 h-16' />
                        </div>
                        <div className='font-semibold mb-2 text-[10px] uppercase tracking-widest flex items-center gap-1.5 opacity-90'>
                          <Music className='w-3 h-3' /> Camelot Key
                        </div>
                        <div className='text-3xl font-black tracking-tighter drop-shadow-md'>
                          {selectedTrack.key}
                        </div>
                      </div>

                      <div className='relative overflow-hidden rounded-xl border bg-gradient-to-br from-card to-card/50 p-5 shadow-sm'>
                        <div className='absolute -bottom-2 -right-2 p-3 opacity-10 text-orange-500'>
                          <Zap className='w-20 h-20' />
                        </div>
                        <div className='font-semibold mb-2 text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5'>
                          <Zap className='w-3 h-3 text-orange-500' /> Energy
                        </div>
                        <div className='flex items-baseline gap-1'>
                          <span className='text-3xl font-black tracking-tighter'>
                            {selectedTrack.energy.toFixed(1)}
                          </span>
                          <span className='text-sm font-medium text-muted-foreground'>
                            / 10
                          </span>
                        </div>
                        <div className='w-full h-1 bg-muted mt-3 rounded-full overflow-hidden'>
                          <div
                            className='h-full bg-orange-500 rounded-full'
                            style={{ width: `${selectedTrack.energy * 10}%` }}
                          />
                        </div>
                      </div>

                      <div className='relative overflow-hidden rounded-xl border bg-gradient-to-br from-card to-card/50 p-5 shadow-sm'>
                        <div className='absolute top-0 right-0 p-3 opacity-10'>
                          <Clock className='w-16 h-16' />
                        </div>
                        <div className='font-semibold mb-2 text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5'>
                          <Clock className='w-3 h-3 text-blue-500' /> Duration
                        </div>
                        <div className='text-3xl font-black tracking-tighter'>
                          {formatDuration(selectedTrack.duration)}
                        </div>
                      </div>
                    </div>

                    <div className='pt-6'>
                      <div className='flex items-center justify-between mb-4'>
                        <h3 className='text-sm font-bold uppercase tracking-widest text-foreground'>
                          Track Structure ({selectedTrack.phrases} Phrases)
                        </h3>
                        <div className='text-[10px] bg-primary/10 text-primary px-2 py-1 rounded font-semibold border border-primary/20'>
                          AI ANALYZED
                        </div>
                      </div>
                      <div className='w-full h-36 bg-background rounded-xl flex items-center justify-center border-2 border-muted overflow-hidden relative shadow-inner p-1'>
                        {selectedTrack.waveform?.length > 0 ? (
                          <div className='flex items-end h-full w-full gap-[2px]'>
                            {selectedTrack.waveform.map((val, i) => (
                              <div
                                key={i}
                                className='bg-primary hover:bg-primary/80 transition-colors rounded-t-sm w-full'
                                style={{ height: `${Math.max(4, val * 100)}%` }}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className='flex items-end h-full w-full gap-[2px] opacity-70'>
                            {Array.from({ length: 80 }).map((_, i) => {
                              const progress = i / 80;
                              const energyMulti = selectedTrack.energy * 5;
                              let envelope =
                                progress < 0.1
                                  ? progress * 10
                                  : progress > 0.9
                                    ? (1 - progress) * 10
                                    : 1.0 +
                                      Math.sin(progress * Math.PI * 4) * 0.2;
                              const h = Math.min(
                                100,
                                Math.max(
                                  5,
                                  20 +
                                    energyMulti * envelope +
                                    Math.random() * 20,
                                ),
                              );
                              return (
                                <div
                                  key={i}
                                  className='bg-primary/60 rounded-t-sm w-full'
                                  style={{ height: `${h}%` }}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p className='text-[11px] text-muted-foreground mt-3 text-center'>
                        {selectedTrack.phrases > 0
                          ? `The AI engine has mapped ${selectedTrack.phrases} distinct phrasing blocks for intelligent auto-transitioning.`
                          : 'No phrase data available — track imported from Spotify metadata only.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className='flex flex-col items-center justify-center h-64 text-muted-foreground opacity-50'>
                    <Music className='w-16 h-16 mb-4' />
                    <p>No track selected</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
