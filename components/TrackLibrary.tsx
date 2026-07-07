'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Track } from '@/types';
import { cn, getCamelotColor } from '@/lib/utils';

const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox='0 0 24 24' fill='currentColor'>
    <path d='M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z' />
  </svg>
);

type SortKey = 'title' | 'artist' | 'bpm' | 'key' | 'duration' | 'energy';
type SortDir = 'asc' | 'desc';

interface TrackLibraryProps {
  tracks: Track[];
  onLoadTrack: (track: Track, deck: 'A' | 'B') => void;
  onRefresh: () => void;
  currentKey?: string;
}

function isKeyCompatible(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  const numA = parseInt(keyA);
  const numB = parseInt(keyB);
  const letterA = keyA.slice(-1);
  const letterB = keyB.slice(-1);
  if (numA === numB && letterA !== letterB) return true;
  if (letterA === letterB) {
    let diff = Math.abs(numA - numB);
    if (diff === 11) diff = 1;
    if (diff === 10) diff = 2;
    if (diff === 1 || diff === 2) return true;
  }
  if (letterA !== letterB) {
    let diff = Math.abs(numA - numB);
    if (diff > 6) diff = 12 - diff;
    if (diff === 3) return true;
  }
  return false;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackLibrary({
  tracks,
  onLoadTrack,
  onRefresh,
  currentKey,
}: TrackLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [keyFilter, setKeyFilter] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab] = useState<'library'>('library');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [lastClick, setLastClick] = useState<{
    id: string;
    time: number;
  } | null>(null);

  useEffect(() => {
    if (tracks.length > 0) {
      // quiet diagnostic - keep existing behavior
    }
  }, [tracks]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = tracks
    .filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !t.artist.toLowerCase().includes(q) &&
          !t.key.toLowerCase().includes(q) &&
          !t.tags.some((tag) => tag.toLowerCase().includes(q))
        )
          return false;
      }
      if (keyFilter && currentKey && !isKeyCompatible(currentKey, t.key))
        return false;
      return true;
    })
    .sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'title':
          va = a.title.toLowerCase();
          vb = b.title.toLowerCase();
          break;
        case 'artist':
          va = a.artist.toLowerCase();
          vb = b.artist.toLowerCase();
          break;
        case 'bpm':
          va = a.bpm;
          vb = b.bpm;
          break;
        case 'key':
          va = a.key;
          vb = b.key;
          break;
        case 'duration':
          va = a.duration;
          vb = b.duration;
          break;
        case 'energy':
          va = a.energy;
          vb = b.energy;
          break;
        default:
          va = a.title;
          vb = b.title;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const handleRowClick = (track: Track) => {
    const now = Date.now();
    if (lastClick && lastClick.id === track.id && now - lastClick.time < 400) {
      onLoadTrack(track, 'A');
    } else {
      setSelectedId(track.id);
    }
    setLastClick({ id: track.id, time: now });
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return <ArrowUpDown className='w-2.5 h-2.5 opacity-25' />;
    return sortDir === 'asc' ? (
      <ArrowUp className='w-2.5 h-2.5 text-primary' />
    ) : (
      <ArrowDown className='w-2.5 h-2.5 text-primary' />
    );
  };

  const Th = ({
    col,
    label,
    className,
  }: {
    col: SortKey;
    label: string;
    className?: string;
  }) => (
    <th
      className={cn(
        'px-2 py-1 text-left text-[9px] font-semibold tracking-wider uppercase text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap',
        className,
      )}
      onClick={() => handleSort(col)}
    >
      <div className='flex items-center gap-1'>
        {label}
        <SortIcon col={col} />
      </div>
    </th>
  );

  return (
    <div className='flex flex-col h-full overflow-hidden'>
      <div className='flex-1 flex flex-col px-2 pt-1.5 pb-1 min-h-0 gap-1.5 overflow-hidden'>
        {/* Controls row */}
        <div className='flex-shrink-0 flex items-center gap-1.5'>
          <div className='relative flex-1 min-w-0'>
            <Search className='absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-muted-foreground' />
            <Input
              placeholder='Search tracks, artists, keys...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-6 h-6 text-[10px] bg-background/40'
            />
          </div>
          <button
            onClick={() => setKeyFilter((f) => !f)}
            title={
              keyFilter
                ? 'Disable harmonic filter'
                : 'Filter harmonically compatible keys'
            }
            className={cn(
              'h-6 px-2 rounded border text-[9px] font-bold tracking-wide uppercase transition-colors flex-shrink-0',
              keyFilter && currentKey
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'border-white/[0.06] text-muted-foreground hover:text-foreground hover:border-white/20',
            )}
          >
            ♪ Key
          </button>
          <Button
            variant='ghost'
            size='sm'
            className='h-6 w-6 p-0 flex-shrink-0'
            onClick={onRefresh}
            title='Refresh library'
          >
            <RefreshCw className='w-3 h-3' />
          </Button>
          <Link
            href='/spotify'
            className='h-6 flex items-center gap-1 px-1.5 rounded border border-[#1DB954]/20 text-[#1DB954]/70 hover:text-[#1DB954] hover:border-[#1DB954]/40 hover:bg-[#1DB954]/[0.06] transition-all flex-shrink-0'
            title='Browse Spotify'
          >
            <SpotifyIcon className='w-2.5 h-2.5' />
          </Link>
        </div>

        {/* Library table */}
        {activeTab === 'library' && (
          <div className='flex-1 min-h-0 overflow-hidden flex flex-col'>
            <div className='text-[9px] text-muted-foreground/40 px-1 mb-0.5 flex-shrink-0'>
              {filtered.length} / {tracks.length} tracks
              {keyFilter && currentKey && (
                <span className='ml-2 text-primary/60'>
                  ♪ harmonic filter active
                </span>
              )}
            </div>

            <div
              className='flex-1 overflow-y-auto min-h-0'
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {tracks.length === 0 ? (
                <div className='flex items-center justify-center h-full'>
                  <div className='text-center'>
                    <div className='text-sm font-medium mb-1 text-foreground/60'>
                      No tracks
                    </div>
                    <div className='text-[10px] text-muted-foreground/50'>
                      Upload tracks via the Analyze page.
                    </div>
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className='flex items-center justify-center h-full'>
                  <div className='text-center'>
                    <div className='text-sm font-medium mb-1 text-foreground/60'>
                      No matches
                    </div>
                    <div className='text-[10px] text-muted-foreground/50'>
                      Adjust your search or filters.
                    </div>
                  </div>
                </div>
              ) : (
                <table className='w-full border-collapse'>
                  <thead
                    className='sticky top-0 z-10'
                    style={{ background: 'var(--card)' }}
                  >
                    <tr className='border-b border-white/[0.04]'>
                      <Th col='title' label='Title' />
                      <Th col='artist' label='Artist' />
                      <Th col='bpm' label='BPM' className='text-right w-14' />
                      <Th col='key' label='Key' className='w-12' />
                      <Th
                        col='duration'
                        label='Time'
                        className='text-right w-14'
                      />
                      <Th col='energy' label='Nrg' className='w-16' />
                      <th className='px-1 py-1 w-14 text-[9px] font-semibold text-muted-foreground'>
                        Load
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((track, idx) => {
                      const isSelected = selectedId === track.id;
                      const isCompatible =
                        keyFilter && currentKey
                          ? isKeyCompatible(currentKey, track.key)
                          : false;
                      const energyColor =
                        track.energy > 7
                          ? '#e8334a'
                          : track.energy > 4
                            ? '#ff9500'
                            : '#1ac8e8';

                      return (
                        <tr
                          key={track.id}
                          onClick={() => handleRowClick(track)}
                          className={cn(
                            'cursor-pointer border-b border-white/[0.025] group select-none transition-colors',
                            isSelected
                              ? 'bg-primary/[0.08]'
                              : idx % 2 === 0
                                ? 'hover:bg-white/[0.025]'
                                : 'bg-white/[0.012] hover:bg-white/[0.03]',
                            isCompatible && !isSelected && 'bg-primary/[0.04]',
                          )}
                        >
                          {/* Title (with thumbnail) */}
                          <td className='px-2 py-[4px] max-w-[180px]'>
                            <div className='flex items-center gap-1.5 min-w-0'>
                              {/* Album art thumbnail */}
                              {track.albumArt ? (
                                <img
                                  src={track.albumArt}
                                  alt=''
                                  className='w-5 h-5 rounded flex-shrink-0 object-cover border border-white/10'
                                />
                              ) : (
                                <div className='w-5 h-5 rounded flex-shrink-0 bg-white/5 border border-white/10' />
                              )}
                              <span className='text-[11px] font-medium truncate text-foreground/90 group-hover:text-foreground'>
                                {track.title}
                              </span>
                              {track.tags?.includes('spotify') && (
                                <SpotifyIcon className='w-2.5 h-2.5 text-[#1DB954]/70 flex-shrink-0' />
                              )}
                            </div>
                          </td>

                          {/* Artist */}
                          <td className='px-2 py-[4px] max-w-[130px]'>
                            <div className='text-[10px] text-muted-foreground truncate'>
                              {track.artist}
                            </div>
                          </td>

                          {/* BPM */}
                          <td className='px-2 py-[4px] text-right'>
                            <span className='text-[10px] font-mono text-foreground/75'>
                              {track.bpm}
                            </span>
                          </td>

                          {/* Key */}
                          <td className='px-2 py-[4px]'>
                            <span
                              className='text-[9px] font-bold px-1.5 py-[2px] rounded text-white'
                              style={{
                                backgroundColor: getCamelotColor(track.key),
                              }}
                            >
                              {track.key}
                            </span>
                          </td>

                          {/* Duration */}
                          <td className='px-2 py-[4px] text-right'>
                            <span className='text-[10px] font-mono text-muted-foreground'>
                              {formatDuration(track.duration)}
                            </span>
                          </td>

                          {/* Energy bar */}
                          <td className='px-2 py-[4px]'>
                            <div className='flex items-center gap-1'>
                              <div className='w-10 h-1 bg-white/10 rounded-full overflow-hidden'>
                                <div
                                  className='h-full rounded-full transition-all'
                                  style={{
                                    width: `${Math.min(track.energy * 10, 100)}%`,
                                    backgroundColor: energyColor,
                                  }}
                                />
                              </div>
                              <span className='text-[9px] font-mono text-muted-foreground/60 w-5 text-right'>
                                {track.energy.toFixed(1)}
                              </span>
                            </div>
                          </td>

                          {/* Load A/B */}
                          <td className='px-1 py-[4px]'>
                            <div
                              className={cn(
                                'flex gap-0.5 transition-opacity',
                                isSelected
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100',
                              )}
                            >
                              <button
                                className='text-[9px] font-bold px-1.5 py-0.5 rounded bg-deck-a/20 text-deck-a hover:bg-deck-a/35 transition-colors'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLoadTrack(track, 'A');
                                }}
                              >
                                A
                              </button>
                              <button
                                className='text-[9px] font-bold px-1.5 py-0.5 rounded bg-deck-b/20 text-deck-b hover:bg-deck-b/35 transition-colors'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLoadTrack(track, 'B');
                                }}
                              >
                                B
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
