'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { TransitionCandidate, Track } from '@/types';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { previewTransition, stopPreview } from '@/lib/segment-preview';
import { Play, Square } from 'lucide-react';

export default function CandidatesPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [fromTrack, setFromTrack] = useState('');
  const [toTracks, setToTracks] = useState<string[]>([]);
  const [fromSearchQuery, setFromSearchQuery] = useState('');
  const [k, setK] = useState(5);
  const [mode, setMode] = useState('both');
  const [scope, setScope] = useState('phrase');
  const [transitionLocation, setTransitionLocation] = useState('standard');
  const [strictKey, setStrictKey] = useState(false);
  const [candidates, setCandidates] = useState<TransitionCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [previewingIndex, setPreviewingIndex] = useState<number | null>(null);

  // Fetch available tracks
  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const response = await fetch('/api/tracks');
        if (response.ok) {
          const data = await response.json();
          setTracks(data);
        }
      } catch (error) {
        console.error('Failed to fetch tracks:', error);
      } finally {
        setLoadingTracks(false);
      }
    };
    fetchTracks();
  }, []);

  const handleGenerate = async () => {
    if (!fromTrack || toTracks.length === 0) return;
    setLoading(true);
    try {
      // Generate candidates for the first selected "To Track"
      const toTrack = toTracks[0];
      const response = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromTrack, toTrack, k, mode, scope, strictKey, transitionLocation }),
      });
      const data = await response.json();
      setCandidates(data);
    } catch (error) {
      console.error('Failed to generate candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter tracks for search
  const filteredFromTracks = tracks.filter((track) => {
    if (!fromSearchQuery) return true;
    const query = fromSearchQuery.toLowerCase();
    return (
      track.title.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query) ||
      track.key.toLowerCase().includes(query) ||
      track.bpm.toString().includes(query)
    );
  });

  // Filter "To Tracks" - exclude "From Track"
  const availableToTracks = tracks.filter((track) => track.id !== fromTrack);

  // Convert tracks to MultiSelect options
  const toTrackOptions: MultiSelectOption[] = availableToTracks.map(
    (track) => ({
      value: track.id,
      label: track.title,
      description: `${track.artist} • BPM: ${track.bpm} • Key: ${
        track.key
      } • Energy: ${track.energy} • Duration: ${formatDuration(
        track.duration
      )}${track.phrases ? ` • Phrases: ${track.phrases}` : ''}`,
    })
  );

  const getSelectedFromTrack = tracks.find((t) => t.id === fromTrack);
  const selectedToTracks = tracks.filter((t) => toTracks.includes(t.id));

  return (
    <div className='min-h-screen bg-background'>
      <Navigation />
      <div className='container mx-auto p-8'>
        <Card>
          <CardHeader>
            <CardTitle>Mix Candidates</CardTitle>
            <CardDescription>
              Generate transition candidates between two tracks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTracks ? (
              <div className='text-center py-8 text-muted-foreground'>
                Loading tracks...
              </div>
            ) : tracks.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                <p className='mb-2'>No tracks available</p>
                <p className='text-sm'>
                  Upload tracks in the Analyze page to generate mix candidates
                </p>
              </div>
            ) : (
              <>
                <div className='grid grid-cols-2 gap-4 mb-4'>
                  <div>
                    <label className='text-sm font-medium mb-2 block'>
                      From Track
                    </label>
                    <Select value={fromTrack} onValueChange={setFromTrack}>
                      <SelectTrigger>
                        <SelectValue placeholder='Select a track to mix from'>
                          {getSelectedFromTrack
                            ? `${getSelectedFromTrack.title} - ${getSelectedFromTrack.artist}`
                            : 'Select a track'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <div className='p-2 border-b'>
                          <div className='relative'>
                            <Search className='absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                            <Input
                              placeholder='Search tracks...'
                              value={fromSearchQuery}
                              onChange={(e) =>
                                setFromSearchQuery(e.target.value)
                              }
                              className='pl-8 h-8 text-sm'
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className='max-h-[300px] overflow-auto'>
                          {filteredFromTracks.length > 0 ? (
                            filteredFromTracks.map((track) => (
                              <SelectItem
                                key={track.id}
                                value={track.id}
                                className='py-2'
                              >
                                <div className='flex flex-col gap-0.5'>
                                  <span className='font-medium text-sm'>
                                    {track.title}
                                  </span>
                                  <span className='text-xs text-muted-foreground'>
                                    {track.artist} • {track.bpm} BPM •{' '}
                                    {track.key}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <div className='p-4 text-center text-sm text-muted-foreground'>
                              No tracks found
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                    {getSelectedFromTrack && (
                      <div className='mt-2 text-xs text-muted-foreground p-2 bg-muted rounded'>
                        <div className='font-medium'>
                          {getSelectedFromTrack.title}
                        </div>
                        <div>{getSelectedFromTrack.artist}</div>
                        <div className='mt-1'>
                          BPM: {getSelectedFromTrack.bpm} • Key:{' '}
                          {getSelectedFromTrack.key} • Energy:{' '}
                          {getSelectedFromTrack.energy}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className='text-sm font-medium mb-2 block'>
                      To Track
                    </label>
                    <MultiSelect
                      options={toTrackOptions}
                      selected={toTracks}
                      onChange={setToTracks}
                      placeholder='Select tracks to mix to...'
                      searchPlaceholder='Search tracks...'
                      emptyMessage={
                        availableToTracks.length === 0
                          ? 'No tracks available (excluding From Track)'
                          : 'No tracks found matching your search'
                      }
                      renderOption={(option, isSelected) => {
                        const track = tracks.find((t) => t.id === option.value);
                        if (!track) return <div>{option.label}</div>;
                        return (
                          <>
                            <div className='font-medium text-sm mb-0.5'>
                              {track.title}
                            </div>
                            <div className='text-xs text-muted-foreground mb-1'>
                              {track.artist}
                            </div>
                            <div className='text-xs text-muted-foreground'>
                              BPM: {track.bpm} • Key: {track.key} • Energy:{' '}
                              {track.energy} • Duration:{' '}
                              {formatDuration(track.duration)}
                              {track.phrases && ` • Phrases: ${track.phrases}`}
                            </div>
                          </>
                        );
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            <div className='grid grid-cols-3 gap-4 mb-4'>
              <div>
                <label className='text-sm font-medium mb-2 block'>
                  Number of Candidates (k)
                </label>
                <Input
                  type='number'
                  min={1}
                  max={20}
                  value={k}
                  onChange={(e) => setK(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className='text-sm font-medium mb-2 block'>
                  Scoring Mode
                </label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='both'>Both (Sneak + Impact)</SelectItem>
                    <SelectItem value='sneak'>Sneak transitions</SelectItem>
                    <SelectItem value='impact'>Impact transitions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className='text-sm font-medium mb-2 block'>
                  Transition Location
                </label>
                <Select value={transitionLocation} onValueChange={setTransitionLocation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='standard'>Standard (Outro to Intro)</SelectItem>
                    <SelectItem value='anywhere'>Anywhere (Mashup/Mid-song)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className='text-sm font-medium mb-2 block'>
                  Analysis Scope
                </label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='bar'>Bar level</SelectItem>
                    <SelectItem value='phrase'>Phrase level</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-center">
                <label className="text-sm font-medium mb-2 block min-h-[20px]"></label>
                <div className="flex items-center gap-2 h-10 border rounded-md px-3 bg-card mt-auto">
                  <input
                    type="checkbox"
                    id="strictKey"
                    checked={strictKey}
                    onChange={(e) => setStrictKey(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <label htmlFor="strictKey" className="text-sm font-medium cursor-pointer">
                    Strict Key Matching
                  </label>
                </div>
              </div>
            </div>

            {getSelectedFromTrack && selectedToTracks.length > 0 && (
              <div className='mb-4 p-4 bg-muted/50 rounded-lg border'>
                <h4 className='text-sm font-semibold mb-2'>
                  Track Compatibility Preview
                </h4>
                <div className='grid grid-cols-2 gap-4 text-sm'>
                  {selectedToTracks.map((selectedToTrack, idx) => (
                    <div key={selectedToTrack.id} className='space-y-3'>
                      <div className='text-xs font-semibold text-muted-foreground mb-2'>
                        To Track #{idx + 1}: {selectedToTrack.title}
                      </div>
                      <div className='grid grid-cols-2 gap-2'>
                        <div>
                          <div className='text-muted-foreground mb-1 text-xs'>
                            BPM Difference
                          </div>
                          <div
                            className={cn(
                              'font-mono text-sm',
                              Math.abs(
                                getSelectedFromTrack.bpm - selectedToTrack.bpm
                              ) <= 5
                                ? 'text-green-500'
                                : Math.abs(
                                    getSelectedFromTrack.bpm -
                                      selectedToTrack.bpm
                                  ) <= 10
                                ? 'text-yellow-500'
                                : 'text-orange-500'
                            )}
                          >
                            {Math.abs(
                              getSelectedFromTrack.bpm - selectedToTrack.bpm
                            )}{' '}
                            BPM
                          </div>
                        </div>
                        <div>
                          <div className='text-muted-foreground mb-1 text-xs'>
                            Energy Difference
                          </div>
                          <div
                            className={cn(
                              'font-mono text-sm',
                              Math.abs(
                                getSelectedFromTrack.energy -
                                  selectedToTrack.energy
                              ) <= 1
                                ? 'text-green-500'
                                : Math.abs(
                                    getSelectedFromTrack.energy -
                                      selectedToTrack.energy
                                  ) <= 2
                                ? 'text-yellow-500'
                                : 'text-orange-500'
                            )}
                          >
                            {Math.abs(
                              getSelectedFromTrack.energy -
                                selectedToTrack.energy
                            ).toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div className='text-muted-foreground mb-1 text-xs'>
                            Key Compatibility
                          </div>
                          <div className='font-mono text-sm'>
                            {getSelectedFromTrack.key} → {selectedToTrack.key}
                          </div>
                        </div>
                        <div>
                          <div className='text-muted-foreground mb-1 text-xs'>
                            Total Duration
                          </div>
                          <div className='font-mono text-sm'>
                            {formatDuration(
                              getSelectedFromTrack.duration +
                                selectedToTrack.duration
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={
                loading || !fromTrack || toTracks.length === 0 || loadingTracks
              }
            >
              {loading ? 'Generating...' : 'Generate Candidates'}
            </Button>

            {candidates.length > 0 && (
              <div className='mt-8'>
                <h3 className='text-lg font-semibold mb-4'>Results</h3>
                <div className='space-y-4'>
                  {candidates.map((candidate, i) => {
                    const fromTrackInfo = getSelectedFromTrack;
                    const toTrackInfo = selectedToTracks[0]; // First selected "To Track"

                    return (
                      <Card key={i}>
                        <CardContent className='p-4'>
                          <div className='flex items-center justify-between mb-2'>
                            <div className='text-lg font-semibold'>
                              Candidate #{i + 1}
                            </div>
                            <div
                              className={cn(
                                'text-2xl font-bold',
                                getScoreColor(candidate.score)
                              )}
                            >
                              {(candidate.score * 100).toFixed(1)}%
                            </div>
                          </div>

                          {/* Track Information */}
                          <div className='mb-4 p-3 bg-muted/50 rounded-lg border'>
                            <div className='grid grid-cols-2 gap-4'>
                              <div>
                                <div className='text-xs font-medium text-muted-foreground mb-1'>
                                  From Track
                                </div>
                                {fromTrackInfo ? (
                                  <>
                                    <div className='text-sm font-semibold'>
                                      {fromTrackInfo.title}
                                    </div>
                                    <div className='text-xs text-muted-foreground'>
                                      {fromTrackInfo.artist}
                                    </div>
                                  </>
                                ) : (
                                  <div className='text-sm text-muted-foreground'>
                                    Unknown
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className='text-xs font-medium text-muted-foreground mb-1'>
                                  To Track
                                </div>
                                {toTrackInfo ? (
                                  <>
                                    <div className='text-sm font-semibold'>
                                      {toTrackInfo.title}
                                    </div>
                                    <div className='text-xs text-muted-foreground'>
                                      {toTrackInfo.artist}
                                    </div>
                                  </>
                                ) : (
                                  <div className='text-sm text-muted-foreground'>
                                    Unknown
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className='grid grid-cols-2 gap-4 mb-4'>
                            <div>
                              <div className='text-sm text-muted-foreground'>
                                From Position
                              </div>
                              <div className='font-mono text-sm'>
                                {formatTime(
                                  (candidate as any).from_position ?? 0
                                )}
                              </div>
                            </div>
                            <div>
                              <div className='text-sm text-muted-foreground'>
                                To Position
                              </div>
                              <div className='font-mono text-sm'>
                                {formatTime(
                                  (candidate as any).to_position ??
                                    (candidate as any).toPosition ??
                                    0
                                )}
                              </div>
                            </div>
                          </div>
                          <div className='grid grid-cols-4 gap-2 text-sm'>
                            <div>
                              <div className='text-muted-foreground'>Key</div>
                              <div
                                className={getScoreColor(
                                  (candidate.scores as any).key ?? 0
                                )}
                              >
                                {(
                                  ((candidate.scores as any).key ?? 0) * 100
                                ).toFixed(0)}
                                %
                              </div>
                            </div>
                            <div>
                              <div className='text-muted-foreground'>
                                Energy
                              </div>
                              <div
                                className={getScoreColor(
                                  (candidate.scores as any).energy ??
                                    candidate.scores.tempo ??
                                    0
                                )}
                              >
                                {(
                                  ((candidate.scores as any).energy ??
                                    candidate.scores.tempo ??
                                    0) * 100
                                ).toFixed(0)}
                                %
                              </div>
                            </div>
                            <div>
                              <div className='text-muted-foreground'>
                                Timing
                              </div>
                              <div
                                className={getScoreColor(
                                  (candidate.scores as any).timing ??
                                    (candidate.scores as any).phase ??
                                    0
                                )}
                              >
                                {(
                                  ((candidate.scores as any).timing ??
                                    (candidate.scores as any).phase ??
                                    0) * 100
                                ).toFixed(0)}
                                %
                              </div>
                            </div>
                            <div>
                              <div className='text-muted-foreground'>
                                Contour
                              </div>
                              <div
                                className={getScoreColor(
                                  (candidate.scores as any).contour ??
                                    (candidate.scores as any).texture ??
                                    0
                                )}
                              >
                                {(
                                  ((candidate.scores as any).contour ??
                                    (candidate.scores as any).texture ??
                                    0) * 100
                                ).toFixed(0)}
                                %
                              </div>
                            </div>
                            {(candidate.scores as any).tempo && (
                              <div>
                                <div className='text-muted-foreground'>
                                  Tempo
                                </div>
                                <div
                                  className={getScoreColor(
                                    (candidate.scores as any).tempo
                                  )}
                                >
                                  {(
                                    (candidate.scores as any).tempo * 100
                                  ).toFixed(0)}
                                  %
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className='mt-6 pt-4 border-t flex justify-end gap-3'>
                            <Button 
                              variant={previewingIndex === i ? 'destructive' : 'default'}
                              onClick={() => {
                                if (previewingIndex === i) {
                                  stopPreview();
                                  setPreviewingIndex(null);
                                } else {
                                  setPreviewingIndex(i);
                                  previewTransition(
                                    fromTrackInfo!.id, 
                                    toTrackInfo!.id, 
                                    (candidate as any).from_position ?? 0, 
                                    (candidate as any).to_position ?? (candidate as any).toPosition ?? 0
                                  ).finally(() => setPreviewingIndex(null));
                                }
                              }}
                              className='flex items-center gap-2'
                            >
                              {previewingIndex === i ? (
                                <>
                                  <Square className="w-4 h-4" /> Stop Preview
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4" /> Preview Mix
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
