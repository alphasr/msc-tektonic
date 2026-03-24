'use client';

import { useState, useEffect } from 'react';
import {
  Trash2,
  Play,
  Save,
  Download,
  Upload,
  X,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PlaylistManager } from '@/lib/playlist-manager';
import { PlaylistSegment, Playlist } from '@/types';
import {
  savePlaylist,
  loadPlaylist,
  getPlaylistList,
  exportPlaylistAsFile,
  importPlaylistFromFile,
} from '@/lib/playlist-storage';
import { cn } from '@/lib/utils';
import AIPlaylistGenerator from '@/components/AIPlaylistGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PlaylistBuilderProps {
  playlistManager: PlaylistManager;
  onPlayPlaylist: (playlist: Playlist) => void;
  onSegmentSelect?: (segment: PlaylistSegment) => void;
}

export default function PlaylistBuilder({
  playlistManager,
  onPlayPlaylist,
  onSegmentSelect,
}: PlaylistBuilderProps) {
  const [playlist, setPlaylist] = useState<Playlist>(
    playlistManager.getPlaylist()
  );
  const [playlistName, setPlaylistName] = useState(playlist.name);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'ai-generator'>(
    'builder'
  );

  useEffect(() => {
    const unsubscribe = playlistManager.onUpdate((updatedPlaylist) => {
      setPlaylist(updatedPlaylist);
      setPlaylistName(updatedPlaylist.name);
    });

    return unsubscribe;
  }, [playlistManager]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRemoveSegment = (segmentId: string) => {
    playlistManager.removeSegment(segmentId);
  };

  const handleClearPlaylist = () => {
    if (confirm('Clear entire playlist?')) {
      playlistManager.clear();
    }
  };

  const handleSavePlaylist = () => {
    playlistManager.setName(playlistName);
    const updated = playlistManager.getPlaylist();
    if (savePlaylist(updated)) {
      alert('Playlist saved!');
    } else {
      alert('Failed to save playlist');
    }
  };

  const handleExportPlaylist = () => {
    playlistManager.setName(playlistName);
    const updated = playlistManager.getPlaylist();
    exportPlaylistAsFile(updated);
  };

  const handleImportPlaylist = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const imported = await importPlaylistFromFile(file);
        if (imported) {
          playlistManager.import(JSON.stringify(imported));
          alert('Playlist imported!');
        } else {
          alert('Failed to import playlist');
        }
      }
    };
    input.click();
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const segment = playlist.segments[draggedIndex];
      playlistManager.moveSegment(segment.id, dropIndex);
    }
    setDraggedIndex(null);
  };

  const totalDuration = playlist.segments.reduce(
    (sum, seg) => sum + seg.duration,
    0
  );

  const handleAIPlaylistGenerated = (generatedPlaylist: Playlist) => {
    // Import the generated playlist into the playlist manager
    playlistManager.import(JSON.stringify(generatedPlaylist));
    setActiveTab('builder');
  };

  return (
    <Card className='h-full flex flex-col'>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between mb-2'>
          <CardTitle className='text-sm font-bold'>Playlist Builder</CardTitle>
          <div className='flex gap-1'>
            <Button
              variant='ghost'
              size='sm'
              className='h-6 w-6 p-0'
              onClick={handleImportPlaylist}
              title='Import playlist'
            >
              <Upload className='w-3 h-3' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='h-6 w-6 p-0'
              onClick={handleExportPlaylist}
              title='Export playlist'
            >
              <Download className='w-3 h-3' />
            </Button>
          </div>
        </div>
        <div className='flex gap-2'>
          <Input
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            placeholder='Playlist name'
            className='h-7 text-xs'
          />
          <Button
            variant='outline'
            size='sm'
            className='h-7 text-xs'
            onClick={handleSavePlaylist}
          >
            <Save className='w-3 h-3 mr-1' />
            Save
          </Button>
        </div>
        <CardDescription className='text-xs flex items-center justify-between mt-2'>
          <span>{playlist.segments.length} segments</span>
          <span>Total: {formatTime(totalDuration)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className='flex-1 flex flex-col min-h-0 overflow-hidden'>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'builder' | 'ai-generator')}
          className='flex-1 flex flex-col min-h-0'
        >
          <TabsList className='w-full h-7 rounded-none border-b flex-shrink-0 mb-2'>
            <TabsTrigger value='builder' className='text-[10px] px-3 h-6'>
              Builder
            </TabsTrigger>
            <TabsTrigger value='ai-generator' className='text-[10px] px-3 h-6'>
              AI Generator
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value='builder'
            className='flex-1 mt-0 min-h-0 overflow-y-auto space-y-2'
          >
            {playlist.segments.length === 0 ? (
              <div className='text-center py-8 text-sm text-muted-foreground'>
                No segments in playlist
                <br />
                <span className='text-xs'>Add segments from suggestions</span>
              </div>
            ) : (
              <>
                <div className='flex justify-end mb-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-7 text-xs'
                    onClick={handleClearPlaylist}
                  >
                    <Trash2 className='w-3 h-3 mr-1' />
                    Clear All
                  </Button>
                  <Button
                    variant='default'
                    size='sm'
                    className='h-7 text-xs ml-2'
                    onClick={() => onPlayPlaylist(playlist)}
                  >
                    <Play className='w-3 h-3 mr-1' />
                    Play
                  </Button>
                </div>
                {playlist.segments.map((segment, index) => (
                  <div
                    key={segment.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    className={cn(
                      'border rounded-lg p-2 cursor-pointer transition-all',
                      'hover:bg-accent',
                      draggedIndex === index && 'opacity-50'
                    )}
                    onClick={() => onSegmentSelect?.(segment)}
                  >
                    <div className='flex items-start gap-2'>
                      <GripVertical className='w-4 h-4 text-muted-foreground mt-0.5' />
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center justify-between mb-1'>
                          <div className='flex-1 min-w-0'>
                            <div className='text-xs font-semibold truncate'>
                              {segment.trackTitle}
                            </div>
                            <div className='text-xs text-muted-foreground truncate'>
                              {segment.trackArtist}
                            </div>
                          </div>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-5 w-5 p-0'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSegment(segment.id);
                            }}
                          >
                            <X className='w-3 h-3' />
                          </Button>
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {formatTime(segment.startTime)} -{' '}
                          {formatTime(segment.endTime)}
                          <span className='mx-1'>•</span>
                          {formatTime(segment.duration)}
                          {segment.transitionPoint && (
                            <>
                              <span className='mx-1'>•</span>
                              Transition: {formatTime(
                                segment.transitionPoint
                              )}{' '}
                              before end
                            </>
                          )}
                        </div>
                        <div className='flex gap-2 mt-1 text-xs'>
                          <span className='text-muted-foreground'>
                            Key: {Math.round(segment.scores.key * 100)}%
                          </span>
                          <span className='text-muted-foreground'>
                            Tempo: {Math.round(segment.scores.tempo * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </TabsContent>
          <TabsContent
            value='ai-generator'
            className='flex-1 mt-0 min-h-0 overflow-hidden'
          >
            <AIPlaylistGenerator
              onPlaylistGenerated={handleAIPlaylistGenerated}
              onPlayPlaylist={onPlayPlaylist}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
