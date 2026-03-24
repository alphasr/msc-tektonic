'use client';

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Track, DeckState, SegmentSuggestion } from '@/types';
import { cn } from '@/lib/utils';
import { RefreshCw, Loader2, Search, Sparkles } from 'lucide-react';
import RecommendationExplanation from '@/components/RecommendationExplanation';

interface TrackRecommendationsProps {
  deckA: DeckState;
  deckB: DeckState;
  tracks: Track[];
  onLoadTrack?: (track: Track, deck: 'A' | 'B') => void;
}

export default function TrackRecommendations({
  deckA,
  deckB,
  tracks,
  onLoadTrack,
}: TrackRecommendationsProps) {
  const [activeTab, setActiveTab] = useState<'deckA' | 'deckB'>('deckA');
  const [segmentSuggestions, setSegmentSuggestions] = useState<
    SegmentSuggestion[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [strictKey, setStrictKey] = useState(false);
  const mountedRef = useRef(true);
  const lastFetchRef = useRef<{ trackId: string; position: number } | null>(
    null
  );

  // Track component mount/unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const targetDeck = activeTab === 'deckA' ? deckA : deckB;
  const oppositeDeck = activeTab === 'deckA' ? deckB : deckA;
  
  let sourceTrack = targetDeck.track;
  let sourcePosition = targetDeck.currentTime;
  let isEmptyTarget = false;
  
  if (!sourceTrack && oppositeDeck.track) {
    sourceTrack = oppositeDeck.track;
    sourcePosition = oppositeDeck.currentTime;
    isEmptyTarget = true;
  }

  const isPlaying = targetDeck.isPlaying || (isEmptyTarget && oppositeDeck.isPlaying);

  // Fetch segment recommendations when track or position changes significantly
  useEffect(() => {
    if (!mountedRef.current) return;

    if (sourceTrack && sourcePosition >= 0) {
      // Only fetch if track changed or position changed significantly (more than 5 seconds)
      const lastFetch = lastFetchRef.current;
      const shouldFetch =
        !lastFetch ||
        lastFetch.trackId !== sourceTrack.id ||
        Math.abs(lastFetch.position - sourcePosition) > 5;

      if (shouldFetch) {
        lastFetchRef.current = {
          trackId: sourceTrack.id,
          position: sourcePosition,
        };
        fetchSegmentRecommendations(sourceTrack.id, sourcePosition);
      }
    } else {
      setSegmentSuggestions([]);
      lastFetchRef.current = null;
    }
  }, [sourceTrack?.id, activeTab]);

  // Auto-update recommendations when playing (debounced)
  useEffect(() => {
    if (!mountedRef.current) return;
    if (!isPlaying || !sourceTrack) return;

    const interval = setInterval(() => {
      if (!mountedRef.current) return;

      const trackToCheck = isEmptyTarget ? oppositeDeck.track : targetDeck.track;
      const posToCheck = isEmptyTarget ? oppositeDeck.currentTime : targetDeck.currentTime;

      if (trackToCheck && posToCheck >= 0) {
        const lastFetch = lastFetchRef.current;
        const shouldFetch =
          !lastFetch ||
          lastFetch.trackId !== trackToCheck.id ||
          Math.abs(lastFetch.position - posToCheck) > 5;

        if (shouldFetch) {
          lastFetchRef.current = {
            trackId: trackToCheck.id,
            position: posToCheck,
          };
          fetchSegmentRecommendations(trackToCheck.id, posToCheck);
        }
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isPlaying, sourceTrack?.id, activeTab, isEmptyTarget]);

  const fetchSegmentRecommendations = async (
    trackId: string,
    position: number
  ) => {
    // Prevent state updates if component is unmounting
    if (!mountedRef.current) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        trackId,
        position: position.toString(),
        scope: 'phrase',
        limit: '15',
        minScore: '0.5',
        excludeTrackId: trackId, // Exclude the currently playing track
        strictKey: strictKey.toString(),
      });

      const response = await fetch(`/api/segments/suggest?${params}`);
      if (response.ok) {
        const data = await response.json();
        // Only update if component is still mounted
        if (mountedRef.current) {
          setSegmentSuggestions(data.suggestions || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch segment recommendations:', error);
      if (mountedRef.current) {
        setSegmentSuggestions([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatScore = (score: number) => {
    return Math.round(score * 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter suggestions by search query
  const filteredSuggestions = segmentSuggestions.filter((suggestion) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      suggestion.trackTitle.toLowerCase().includes(query) ||
      suggestion.trackArtist.toLowerCase().includes(query)
    );
  });

  return (
    <div className='flex flex-col h-full overflow-hidden'>
      <div className='mb-1 flex-shrink-0 flex items-center justify-between'>
        <div>
          <h2 className='text-xs font-bold mb-0.5'>Segment Recommendations</h2>
          <p className='text-[10px] text-muted-foreground'>
            Compatible segments based on current playback position
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] flex items-center gap-1 cursor-pointer" title="Only suggest tracks with matching musical keys">
            <input 
              type="checkbox" 
              checked={strictKey} 
              onChange={(e) => {
                setStrictKey(e.target.checked);
                if (sourceTrack) {
                  lastFetchRef.current = null; // force refetch
                  fetchSegmentRecommendations(sourceTrack.id, sourcePosition);
                }
              }} 
            />
            Strict Key
          </label>
        </div>
        {sourceTrack && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() =>
              sourceTrack &&
              fetchSegmentRecommendations(sourceTrack.id, sourcePosition)
            }
            disabled={loading}
            className='h-6 w-6 p-0'
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </Button>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'deckA' | 'deckB')}
        className='flex-1 flex flex-col min-h-0 overflow-hidden'
      >
        <TabsList className='grid w-full grid-cols-2 mb-1 flex-shrink-0 h-7'>
          <TabsTrigger
            value='deckA'
            className={cn(
              activeTab === 'deckA' && 'text-deck-a',
              'text-[10px]'
            )}
          >
            Deck A
          </TabsTrigger>
          <TabsTrigger
            value='deckB'
            className={cn(
              activeTab === 'deckB' && 'text-deck-b',
              'text-[10px]'
            )}
          >
            Deck B
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value={activeTab}
          className='flex-1 flex flex-col mt-0 min-h-0 overflow-hidden'
        >
          {!sourceTrack ? (
            <div className='flex-1 flex items-center justify-center text-muted-foreground'>
              <div className='text-center text-[10px]'>
                <div>No track loaded</div>
                <div className='text-[9px] mt-1'>
                  Load a track to see segment recommendations
                </div>
              </div>
            </div>
          ) : (
            <>
              {isEmptyTarget && (
                <div className="bg-primary/10 border border-primary/20 rounded px-2 py-1 mb-2 text-[10px] text-primary flex items-center gap-1.5 flex-shrink-0 mx-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Suggesting tracks to load into Deck {activeTab === 'deckA' ? 'A' : 'B'} based on playing Deck {activeTab === 'deckA' ? 'B' : 'A'}</span>
                </div>
              )}
              {/* Search */}
              <div className='mb-1.5 flex-shrink-0 px-1'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground' />
                  <Input
                    placeholder='Search recommendations...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='pl-8 h-7 text-xs bg-background'
                  />
                </div>
              </div>

              {loading ? (
                <div className='flex-1 flex items-center justify-center'>
                  <Loader2 className='w-4 h-4 animate-spin text-muted-foreground' />
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className='flex-1 flex items-center justify-center text-muted-foreground'>
                  <div className='text-center text-[10px]'>
                    <div>No segment recommendations found</div>
                    {searchQuery && (
                      <div className='text-[9px] mt-1'>
                        Try a different search term
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className='flex-1 overflow-y-auto space-y-1 pr-1 min-h-0'
                  style={{ maxHeight: '100%' }}
                >
                  {filteredSuggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.trackId}_${suggestion.position}_${index}`}
                      className='p-1.5 rounded border bg-muted/50 hover:bg-muted transition-colors'
                    >
                      <div className='flex items-start justify-between gap-2 mb-1'>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-1'>
                            <div className='text-[10px] font-semibold truncate flex-1'>
                              {suggestion.trackTitle}
                            </div>
                            <RecommendationExplanation
                              scores={suggestion.scores}
                              className='flex-shrink-0'
                            />
                          </div>
                          <div className='text-[9px] text-muted-foreground truncate'>
                            {suggestion.trackArtist}
                          </div>
                        </div>
                        <div
                          className={cn(
                            'text-[10px] font-bold flex-shrink-0',
                            getScoreColor(suggestion.score)
                          )}
                        >
                          {formatScore(suggestion.score)}%
                        </div>
                      </div>

                      <div className='flex items-center gap-2 mb-1.5 text-[9px] text-muted-foreground'>
                        <span>Segment: {formatTime(suggestion.position)}</span>
                        <span>•</span>
                        <span>Duration: {formatTime(suggestion.duration)}</span>
                      </div>

                      <div className='grid grid-cols-3 gap-1 mb-1.5 text-[8px]'>
                        <div>
                          <div className='text-muted-foreground'>Key</div>
                          <div className={getScoreColor(suggestion.scores.key)}>
                            {formatScore(suggestion.scores.key)}%
                          </div>
                        </div>
                        <div>
                          <div className='text-muted-foreground'>Tempo</div>
                          <div
                            className={getScoreColor(suggestion.scores.tempo)}
                          >
                            {formatScore(suggestion.scores.tempo)}%
                          </div>
                        </div>
                        <div>
                          <div className='text-muted-foreground'>Energy</div>
                          <div
                            className={getScoreColor(suggestion.scores.energy)}
                          >
                            {formatScore(suggestion.scores.energy)}%
                          </div>
                        </div>
                      </div>

                      <div className='flex gap-1 mt-2'>
                        <Button
                          variant={isEmptyTarget ? "default" : "outline"}
                          size='sm'
                          onClick={() => {
                            const track = tracks.find(
                              (t) => t.id === suggestion.trackId
                            );
                            if (track && onLoadTrack) {
                              onLoadTrack(
                                track,
                                activeTab === 'deckA' ? 'A' : 'B'
                              );
                              // Note: User will need to manually seek to suggestion.position
                            }
                          }}
                          className='text-[9px] h-6 px-2 flex-1 relative overflow-hidden group'
                        >
                          <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform"/>
                          <span className="relative font-bold">Load to {activeTab === 'deckA' ? 'Deck A' : 'Deck B'}</span>
                        </Button>
                        {!isEmptyTarget && (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              const track = tracks.find(
                                (t) => t.id === suggestion.trackId
                              );
                              if (track && onLoadTrack) {
                                onLoadTrack(
                                  track,
                                  activeTab === 'deckA' ? 'B' : 'A'
                                );
                              }
                            }}
                            className='text-[9px] h-6 px-2 flex-1'
                          >
                            Load to {activeTab === 'deckA' ? 'Deck B' : 'Deck A'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
