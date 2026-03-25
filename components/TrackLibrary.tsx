'use client';

import React, { useState, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Track } from '@/types';
import { cn } from '@/lib/utils';

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

export default function TrackLibrary({
  tracks,
  onLoadTrack,
  onRefresh,
  currentKey,
}: TrackLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [bpmFilter, setBpmFilter] = useState(false);
  const [keyFilter, setKeyFilter] = useState(false);
  const [energyFilter, setEnergyFilter] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // Debug: log tracks when they change
  useEffect(() => {
    console.log('TrackLibrary received tracks:', tracks.length);
    if (tracks.length > 0) {
      console.log('First track:', tracks[0]);
    } else {
      console.log('No tracks received. Check API endpoint /api/tracks');
    }
  }, [tracks]);

  const filteredTracks = tracks.filter((track) => {
    if (
      searchQuery &&
      !track.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !track.artist.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !track.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      ) &&
      !track.key.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (bpmFilter && (track.bpm < 120 || track.bpm > 130)) return false;
    if (energyFilter && track.energy < 7) return false;
    if (keyFilter && currentKey && !isKeyCompatible(currentKey, track.key)) return false;
    return true;
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className='flex flex-col h-full overflow-hidden'>
      <div className='flex-1 flex flex-col p-1.5 min-h-0 overflow-hidden'>
        {/* Header */}
        <div className='mb-1.5 flex-shrink-0 flex items-center justify-between'>
          <div>
            <h2 className='text-xs font-semibold mb-0.5'>Track Library</h2>
            <p className='text-[10px] text-muted-foreground'>
              Double-click to load
            </p>
          </div>
          <Button
            variant='ghost'
            size='sm'
            className='h-6 w-6 p-0'
            onClick={onRefresh}
          >
            <RefreshCw className='w-3 h-3' />
          </Button>
        </div>

        {/* Search and Filters */}
        <div className='mb-1.5 flex-shrink-0 space-y-1'>
          <div className='relative'>
            <Search className='absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground' />
            <Input
              placeholder='Search...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-7 h-6 text-[10px]'
            />
          </div>
          <div className='flex gap-1 flex-wrap'>
            <Button
              variant={bpmFilter ? 'default' : 'outline'}
              size='sm'
              className='h-5 text-[10px] px-2'
              onClick={() => setBpmFilter(!bpmFilter)}
            >
              BPM
            </Button>
            <Button
              variant={keyFilter ? 'default' : 'outline'}
              size='sm'
              className='h-5 text-[10px] px-2'
              onClick={() => setKeyFilter(!keyFilter)}
            >
              Key
            </Button>
            <Button
              variant={energyFilter ? 'default' : 'outline'}
              size='sm'
              className='h-5 text-[10px] px-2'
              onClick={() => setEnergyFilter(!energyFilter)}
            >
              Energy
            </Button>
          </div>
        </div>

        <div
          className='flex-1 overflow-y-auto min-h-0 relative'
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {filteredTracks.length > 0 ? (
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5'>
              {filteredTracks.map((track) => (
                <div
                  key={track.id}
                  className={cn(
                    'group p-2 rounded-lg border bg-card/40 backdrop-blur-md hover:bg-card/60 hover:border-white/10 border-white/5 cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl',
                    selectedTrack?.id === track.id &&
                      'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                  )}
                  onClick={() => setSelectedTrack(track)}
                  onDoubleClick={() => onLoadTrack(track, 'A')}
                >
                  {/* Title and Artist */}
                  <div className='mb-1.5'>
                    <div className='text-[11px] font-medium truncate mb-0.5 text-foreground'>
                      {track.title}
                    </div>
                    <div className='text-[10px] text-muted-foreground truncate'>
                      {track.artist}
                    </div>
                  </div>

                  {/* Track Details Grid */}
                  <div className='grid grid-cols-2 gap-x-2 gap-y-1 mb-1.5 text-[10px]'>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>BPM</span>
                      <span className='font-mono font-medium'>{track.bpm}</span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>Key</span>
                      <span className='font-mono font-medium'>{track.key}</span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>Dur</span>
                      <span className='font-mono font-medium'>
                        {formatDuration(track.duration)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>E</span>
                      <div className='flex items-center gap-1'>
                        <span className='font-medium text-[9px]'>
                          {track.energy.toFixed(1)}
                        </span>
                        <div className='w-8 h-0.5 bg-muted rounded-full overflow-hidden'>
                          <div
                            className='h-full bg-primary/80 transition-all'
                            style={{
                              width: `${Math.min(track.energy * 10, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className='flex gap-1 pt-1 border-t border-border/50'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='flex-1 h-5 text-[10px] font-medium text-deck-a hover:text-deck-a hover:bg-deck-a/10 px-1'
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadTrack(track, 'A');
                      }}
                    >
                      A
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='flex-1 h-5 text-[10px] font-medium text-deck-b hover:text-deck-b hover:bg-deck-b/10 px-1'
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadTrack(track, 'B');
                      }}
                    >
                      B
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='absolute inset-0 flex items-center justify-center text-center py-12'>
              <div>
                <div className='text-sm font-medium mb-2 text-foreground'>
                  No tracks found
                </div>
                <div className='text-xs text-muted-foreground'>
                  {tracks.length === 0
                    ? 'No tracks available. Upload tracks in the Analyze page.'
                    : 'Adjust filters to see more results.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
