'use client';

import { useRef, useEffect } from 'react';
import { Play, Pause, Square, SkipForward, Zap, Music } from 'lucide-react';
import { DeckState } from '@/types';
import { cn, getCamelotColor } from '@/lib/utils';
import { getAudioManager } from '@/lib/audio-manager';

export const HOT_CUE_COLORS = [
  '#ff6a00',
  '#0078ff',
  '#00cc44',
  '#ffcc00',
] as const;

export interface LoopState {
  start: number | null;
  end: number | null;
  active: boolean;
}

interface DeckProps {
  deck: DeckState;
  deckName: 'A' | 'B';
  isMaster: boolean;
  hotCues: (number | null)[];
  loop: LoopState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onCue: () => void;
  onLoadTrack: () => void;
  onEject: () => void;
  onSeek: (time: number) => void;
  onSetMaster: () => void;
  onSync: () => void;
  onRateChange?: (rate: number) => void;
  onHotCuePress: (index: number) => void;
  onHotCueClear: (index: number) => void;
  onLoopIn: () => void;
  onLoopOut: () => void;
  onLoopToggle: () => void;
  onLoopHalve: () => void;
  onLoopDouble: () => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function Deck({
  deck,
  deckName,
  isMaster,
  hotCues,
  loop,
  onPlay,
  onPause,
  onStop,
  onCue,
  onEject,
  onSeek,
  onSetMaster,
  onSync,
  onRateChange,
  onHotCuePress,
  onHotCueClear,
  onLoopIn,
  onLoopOut,
  onLoopToggle,
  onLoopHalve,
  onLoopDouble,
}: DeckProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDeckA = deckName === 'A';

  const getRemainingTime = () => {
    if (!deck.track) return '—';
    return `-${formatTime(deck.track.duration - deck.currentTime)}`;
  };

  const generateWaveform = () => {
    if (!deck.track?.waveform?.length) return Array(80).fill(0.3);
    const raw = deck.track.waveform;
    const max = Math.max(...raw, 0.01);
    return raw.map((h) => h / max);
  };

  const waveform = generateWaveform();
  const progress = deck.track
    ? (deck.currentTime / deck.track.duration) * 100
    : 0;

  // Live spectrum visualizer
  useEffect(() => {
    if (!deck.isPlaying || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const audioManager = getAudioManager();
    let animId: number;

    const draw = () => {
      animId = requestAnimationFrame(draw);
      const freqData = audioManager.getFrequencyData(deckName);
      if (freqData) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const numBars = freqData.length;
        const barW = canvas.width / numBars;
        for (let i = 0; i < numBars; i++) {
          const barH = (freqData[i] / 255) * canvas.height;
          const r = barH > 10 ? 255 : 0;
          const g = i < numBars / 2 ? 0 : 255;
          const b = Math.max(0, 255 - i * 5);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(i * barW, canvas.height - barH, barW - 1, barH);
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [deck.isPlaying, deckName]);

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!deck.track || !waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Account for scaleX transform on inner div
    const visibleWidth = rect.width / deck.rate;
    const percentage = Math.min(1, x / visibleWidth);
    onSeek(percentage * deck.track.duration);
  };

  const accentVar = isDeckA ? 'var(--deck-a)' : 'var(--deck-b)';
  const deckBorderClass = isDeckA ? 'border-deck-a/15' : 'border-deck-b/15';

  const loopEnabled = loop.start !== null && loop.end !== null;

  return (
    <div
      className={cn(
        'flex flex-col h-full p-2 rounded-xl border overflow-hidden backdrop-blur-md shadow-xl',
        'bg-card/40',
        deckBorderClass,
      )}
    >
      {/* Header */}
      <div className='flex items-center justify-between mb-1.5 flex-shrink-0'>
        <div className='flex items-center gap-2'>
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              deck.isPlaying && 'playing-dot',
            )}
            style={{
              backgroundColor: accentVar,
              boxShadow: deck.isPlaying ? `0 0 6px ${accentVar}` : 'none',
              opacity: deck.isPlaying ? 1 : 0.35,
            }}
          />
          <h2
            className='text-[10px] font-black tracking-[0.2em]'
            style={{ color: accentVar }}
          >
            DECK {deckName}
          </h2>
        </div>
        {deck.track && (
          <div
            className='text-[8px] px-1.5 py-0.5 rounded-full border font-bold tracking-wide'
            style={
              deck.isPlaying
                ? {
                    borderColor: `${accentVar}55`,
                    color: accentVar,
                    backgroundColor: `${accentVar}15`,
                  }
                : {
                    borderColor: 'rgba(255,255,255,0.08)',
                    color: 'var(--muted-foreground)',
                  }
            }
          >
            {deck.isPlaying ? 'PLAYING' : 'READY'}
          </div>
        )}
      </div>

      <div className='flex-1 min-h-0 flex flex-col gap-1'>
        {deck.track ? (
          <>
            {/* Track info */}
            <div className='flex-shrink-0 flex gap-2 items-start'>
              {/* Album art thumbnail */}
              {deck.track.albumArt ? (
                <img
                  src={deck.track.albumArt}
                  alt={deck.track.title}
                  className='w-10 h-10 rounded object-cover flex-shrink-0 border border-white/10'
                />
              ) : (
                <div className='w-10 h-10 rounded flex-shrink-0 bg-white/5 border border-white/10 flex items-center justify-center'>
                  <Music className='w-4 h-4 text-foreground/20' />
                </div>
              )}
              <div className='min-w-0 flex-1'>
                <h3 className='text-[11px] font-semibold truncate leading-tight'>
                  {deck.track.title}
                </h3>
                <div className='text-[9px] text-muted-foreground truncate'>
                  {deck.track.artist}
                </div>
                <div className='flex gap-1 mt-1 items-center flex-wrap'>
                  {/* BPM */}
                  <span
                    className={cn(
                      'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                      deck.rate !== 1.0
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-background/40 border-white/10 text-foreground/70',
                    )}
                  >
                    {(deck.track.bpm * deck.rate).toFixed(1)}
                    <span className='text-[7px] ml-0.5 opacity-50'>BPM</span>
                  </span>

                  {/* Key */}
                  <span
                    className='text-[9px] font-bold px-1.5 py-0.5 rounded text-white'
                    style={{ backgroundColor: getCamelotColor(deck.track.key) }}
                  >
                    {deck.track.key}
                  </span>

                  {/* Energy */}
                  <span className='text-[9px] text-muted-foreground flex items-center gap-0.5'>
                    <Zap className='w-2.5 h-2.5 text-amber-500' />
                    {deck.track.energy.toFixed(1)}
                  </span>

                  {/* Master button */}
                  <button
                    onClick={onSetMaster}
                    className={cn(
                      'text-[8px] font-bold px-1.5 py-0.5 rounded border transition-all ml-auto',
                      isMaster
                        ? isDeckA
                          ? 'bg-deck-a/20 text-deck-a border-deck-a/50 shadow-[0_0_6px_-1px_var(--deck-a)]'
                          : 'bg-deck-b/20 text-deck-b border-deck-b/50 shadow-[0_0_6px_-1px_var(--deck-b)]'
                        : 'bg-transparent border-white/10 text-muted-foreground hover:bg-white/5',
                    )}
                  >
                    MASTER
                  </button>
                </div>
              </div>
            </div>

            {/* Time display */}
            <div className='flex justify-between text-[10px] font-mono flex-shrink-0 text-muted-foreground'>
              <span className='text-foreground/80'>
                {formatTime(deck.currentTime)}
              </span>
              <span className='opacity-50'>{getRemainingTime()}</span>
            </div>

            {/* Spectrum visualizer */}
            <div className='h-5 w-full flex-shrink-0 opacity-75 border-b border-white/[0.03]'>
              <canvas
                ref={canvasRef}
                width={200}
                height={20}
                className='w-full h-full'
              />
            </div>

            {/* Waveform */}
            <div className='flex-shrink-0'>
              <div
                ref={waveformRef}
                className='h-16 w-full bg-background/40 rounded cursor-pointer relative overflow-hidden border border-white/[0.04]'
                onClick={handleWaveformClick}
              >
                {/* Waveform bars */}
                <div
                  className='absolute inset-0 flex items-center px-0.5 gap-[1px]'
                  style={{
                    transform: `scaleX(${1 / deck.rate})`,
                    transformOrigin: 'left',
                  }}
                >
                  {waveform.map((h, i) => {
                    const isPlayed = i < (progress / 100) * waveform.length;
                    let r = 0,
                      g = 0,
                      b = 0;
                    if (h > 0.65) {
                      r = 255;
                      g = Math.floor(255 * (1 - h));
                      b = 50;
                    } else if (h > 0.35) {
                      r = Math.floor(255 * h);
                      g = 220;
                      b = 0;
                    } else {
                      r = 0;
                      g = Math.floor(255 * h * 2);
                      b = 255;
                    }
                    const outerColor = `rgba(${r},${g},${b},${isPlayed ? 0.3 : 0.08})`;
                    const innerColor = `rgba(${r},${g},${b},${isPlayed ? 0.9 : 0.25})`;
                    return (
                      <div
                        key={i}
                        className='flex-1 h-full flex items-center justify-center relative'
                      >
                        <div
                          className='absolute w-full rounded-[1px]'
                          style={{
                            height: `${Math.max(h * 95, 2)}%`,
                            backgroundColor: outerColor,
                          }}
                        />
                        <div
                          className='absolute w-full rounded-[1px]'
                          style={{
                            height: `${Math.max(Math.pow(h, 1.5) * 72, 2)}%`,
                            backgroundColor: innerColor,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Loop region overlay */}
                {loopEnabled && deck.track && (
                  <div
                    className='absolute top-0 bottom-0 z-[5] opacity-20'
                    style={{
                      left: `${(loop.start! / deck.track.duration) * 100}%`,
                      width: `${((loop.end! - loop.start!) / deck.track.duration) * 100}%`,
                      backgroundColor: accentVar,
                    }}
                  />
                )}

                {/* Loop boundary markers */}
                {loop.start !== null && deck.track && (
                  <div
                    className='absolute top-0 bottom-0 w-[2px] z-[8]'
                    style={{
                      left: `${(loop.start / deck.track.duration) * 100}%`,
                      backgroundColor: '#00ff88',
                      opacity: 0.9,
                    }}
                  />
                )}
                {loop.end !== null && deck.track && (
                  <div
                    className='absolute top-0 bottom-0 w-[2px] z-[8]'
                    style={{
                      left: `${(loop.end / deck.track.duration) * 100}%`,
                      backgroundColor: '#00ff88',
                      opacity: 0.9,
                    }}
                  />
                )}

                {/* Hot cue markers */}
                {deck.track &&
                  hotCues.map((cue, i) =>
                    cue !== null ? (
                      <div
                        key={i}
                        className='absolute top-0 bottom-0 w-[1.5px] z-10'
                        style={{
                          left: `${(cue / deck.track!.duration) * 100}%`,
                          backgroundColor: HOT_CUE_COLORS[i],
                          boxShadow: `0 0 3px ${HOT_CUE_COLORS[i]}`,
                        }}
                      />
                    ) : null,
                  )}

                {/* Playhead */}
                <div
                  className='absolute top-0 bottom-0 w-[2px] z-20'
                  style={{
                    left: `${progress / deck.rate}%`,
                    backgroundColor: accentVar,
                    boxShadow: `0 0 6px ${accentVar}`,
                  }}
                />
              </div>

              {/* Section markers */}
              <div className='flex justify-between text-[8px] mt-0.5 px-0.5'>
                {['Intro', 'Verse', 'Chorus', 'Bridge', 'Outro'].map((s) => {
                  const sectionIdx = Math.floor(
                    (deck.currentTime / deck.track!.duration) * 5,
                  );
                  const sections = [
                    'Intro',
                    'Verse',
                    'Chorus',
                    'Bridge',
                    'Outro',
                  ];
                  const isCurrent = sections[sectionIdx] === s;
                  return (
                    <span
                      key={s}
                      className={
                        isCurrent ? 'font-bold' : 'text-muted-foreground/30'
                      }
                      style={isCurrent ? { color: accentVar } : {}}
                    >
                      {s}
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className='flex-1 flex flex-col justify-center items-center text-center'>
            <div
              className='w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center mb-2'
              style={{ borderColor: `${accentVar}30`, color: `${accentVar}40` }}
            >
              <Play className='w-4 h-4 ml-0.5' />
            </div>
            <div className='text-[10px] text-muted-foreground/40 font-medium tracking-wide'>
              NO TRACK LOADED
            </div>
            <div className='text-[8px] text-muted-foreground/25 mt-0.5'>
              Double-click library row to load
            </div>
          </div>
        )}

        {/* ─── Transport controls ─── */}
        <div className='mt-auto flex-shrink-0 space-y-1 pt-1.5 border-t border-white/[0.04]'>
          {/* Main transport row */}
          <div className='flex gap-1'>
            {/* Play/Pause */}
            <button
              onClick={deck.isPlaying ? onPause : onPlay}
              className={cn(
                'flex-1 h-9 rounded border flex items-center justify-center transition-all font-bold',
                deck.isPlaying
                  ? isDeckA
                    ? 'bg-deck-a/15 text-deck-a border-deck-a/40 shadow-[0_0_12px_-3px_var(--deck-a)]'
                    : 'bg-deck-b/15 text-deck-b border-deck-b/40 shadow-[0_0_12px_-3px_var(--deck-b)]'
                  : 'bg-card/60 border-white/[0.07] text-foreground/70 hover:bg-white/10 hover:border-white/15',
              )}
            >
              {deck.isPlaying ? (
                <Pause className='w-4 h-4 fill-current' />
              ) : (
                <Play className='w-4 h-4 ml-0.5 fill-current' />
              )}
            </button>

            {/* CUE */}
            <button
              onClick={onCue}
              title='Return to cue point (start)'
              className='h-9 w-10 rounded border border-white/[0.07] bg-card/60 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400 text-muted-foreground text-[9px] font-black tracking-wider transition-all flex items-center justify-center'
            >
              CUE
            </button>

            {/* SYNC */}
            <button
              onClick={onSync}
              className={cn(
                'h-9 px-2.5 rounded border text-[9px] font-black tracking-wider transition-all',
                deck.rate !== 1.0
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-card/60 border-white/[0.07] text-muted-foreground hover:bg-white/10',
              )}
            >
              SYNC
            </button>
          </div>

          {/* Hot cue pads row */}
          <div className='flex gap-0.5'>
            {HOT_CUE_COLORS.map((color, i) => {
              const cue = hotCues[i];
              const isSet = cue !== null;
              return (
                <button
                  key={i}
                  onClick={() => onHotCuePress(i)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onHotCueClear(i);
                  }}
                  title={
                    isSet
                      ? `Hot Cue ${i + 1}: ${formatTime(cue!)} — right-click to clear`
                      : `Set Hot Cue ${i + 1}`
                  }
                  className={cn(
                    'flex-1 rounded py-1 border transition-all text-center',
                    isSet ? '' : 'border-white/[0.06] hover:border-white/15',
                  )}
                  style={
                    isSet
                      ? {
                          backgroundColor: `${color}22`,
                          borderColor: `${color}60`,
                          boxShadow: `0 0 6px -2px ${color}`,
                        }
                      : {}
                  }
                >
                  <div
                    className='text-[9px] font-black leading-none'
                    style={
                      isSet ? { color } : { color: 'rgba(255,255,255,0.25)' }
                    }
                  >
                    {i + 1}
                  </div>
                  {isSet && (
                    <div
                      className='text-[7px] font-mono leading-tight mt-0.5'
                      style={{ color }}
                    >
                      {formatTime(cue!)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Loop controls row */}
          <div className='flex gap-0.5 items-stretch'>
            <button
              onClick={onLoopIn}
              disabled={!deck.track}
              className={cn(
                'flex-1 h-6 rounded border text-[9px] font-bold tracking-wider transition-all',
                loop.start !== null
                  ? 'bg-green-500/15 border-green-500/40 text-green-400'
                  : 'border-white/[0.06] text-muted-foreground/60 hover:border-white/15 hover:text-foreground disabled:opacity-30',
              )}
            >
              IN
            </button>
            <button
              onClick={onLoopOut}
              disabled={!deck.track || loop.start === null}
              className={cn(
                'flex-1 h-6 rounded border text-[9px] font-bold tracking-wider transition-all',
                loop.end !== null
                  ? 'bg-green-500/15 border-green-500/40 text-green-400'
                  : 'border-white/[0.06] text-muted-foreground/60 hover:border-white/15 hover:text-foreground disabled:opacity-30',
              )}
            >
              OUT
            </button>
            <button
              onClick={onLoopHalve}
              disabled={!loopEnabled}
              className='flex-1 h-6 rounded border border-white/[0.06] text-muted-foreground/60 hover:border-white/15 hover:text-foreground text-[9px] font-bold transition-all disabled:opacity-30'
            >
              ÷2
            </button>
            <button
              onClick={onLoopDouble}
              disabled={!loopEnabled}
              className='flex-1 h-6 rounded border border-white/[0.06] text-muted-foreground/60 hover:border-white/15 hover:text-foreground text-[9px] font-bold transition-all disabled:opacity-30'
            >
              ×2
            </button>
            <button
              onClick={onLoopToggle}
              disabled={!loopEnabled}
              className={cn(
                'flex-[1.5] h-6 rounded border text-[9px] font-black tracking-wider transition-all disabled:opacity-30',
                loop.active
                  ? 'bg-green-500/20 border-green-500/50 text-green-400 shadow-[0_0_8px_-2px_#00ff88]'
                  : 'border-white/[0.06] text-muted-foreground/60 hover:border-white/15 hover:text-foreground',
              )}
            >
              {loop.active ? 'LOOP ●' : 'LOOP'}
            </button>
          </div>

          {/* Pitch fader */}
          <div className='flex items-center gap-1.5'>
            <button
              className='text-[8px] w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors'
              onClick={() => onRateChange?.(1.0)}
              title='Reset pitch'
            >
              R
            </button>
            <input
              type='range'
              min='0.84'
              max='1.16'
              step='0.001'
              value={deck.rate}
              onChange={(e) => onRateChange?.(parseFloat(e.target.value))}
              className='flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-ew-resize [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-[2px] [&::-webkit-slider-thumb]:cursor-ew-resize'
            />
            <span
              className={cn(
                'text-[9px] w-9 text-right font-mono tabular-nums',
                deck.rate !== 1.0
                  ? 'text-amber-400'
                  : 'text-muted-foreground/50',
              )}
            >
              {deck.rate > 1 ? '+' : ''}
              {((deck.rate - 1) * 100).toFixed(1)}%
            </span>
          </div>

          {/* Eject */}
          <div className='flex gap-1'>
            <button
              onClick={onEject}
              className='flex-1 h-5 flex items-center justify-center gap-1 text-[9px] text-muted-foreground/40 hover:text-foreground transition-colors rounded border border-transparent hover:border-white/[0.06]'
            >
              <SkipForward className='w-2.5 h-2.5' />
              Eject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
