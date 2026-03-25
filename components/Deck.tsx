"use client"

import { useState, useRef } from "react"
import { Play, Pause, Square, RotateCcw, Repeat, Zap, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeckState } from "@/types"
import { cn, getCamelotColor } from "@/lib/utils"

interface DeckProps {
  deck: DeckState
  deckName: "A" | "B"
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onCue: () => void
  onLoadTrack: () => void
  onEject: () => void
  onSeek: (time: number) => void
}

export default function Deck({
  deck,
  deckName,
  onPlay,
  onPause,
  onStop,
  onCue,
  onLoadTrack,
  onEject,
  onSeek,
}: DeckProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const isDeckA = deckName === "A"

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getRemainingTime = () => {
    if (!deck.track) return "—"
    const remaining = deck.track.duration - deck.currentTime
    return `-${formatTime(remaining)}`
  }

  const generateWaveform = () => {
    if (!deck.track || !deck.track.waveform || deck.track.waveform.length === 0) {
      return Array(80).fill(0.3)
    }
    return deck.track.waveform
  }

  const waveform = generateWaveform()
  const progress = deck.track ? (deck.currentTime / deck.track.duration) * 100 : 0

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!deck.track || !waveformRef.current) return
    const rect = waveformRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * deck.track.duration
    onSeek(newTime)
  }

  const sections = ["Intro", "Verse", "Chorus", "Bridge", "Outro"]
  const currentSection = deck.track ? sections[Math.floor((deck.currentTime / deck.track.duration) * sections.length)] : null

  const accentColor = isDeckA ? "deck-a" : "deck-b"

  return (
    <div className={cn(
      "flex flex-col h-full p-2.5 rounded-xl border overflow-hidden backdrop-blur-md shadow-2xl transition-all",
      isDeckA
        ? "bg-card/40 border-deck-a/10"
        : "bg-card/40 border-deck-b/10"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            deck.isPlaying ? "animate-pulse" : "opacity-40",
            isDeckA ? "bg-deck-a shadow-[0_0_6px_var(--deck-a)]" : "bg-deck-b shadow-[0_0_6px_var(--deck-b)]"
          )} />
          <h2 className={cn(
            "text-[10px] font-bold tracking-[0.15em]",
            isDeckA ? "text-deck-a" : "text-deck-b"
          )}>
            DECK {deckName}
          </h2>
        </div>
        {deck.track && (
          <div className={cn(
            "text-[8px] px-1.5 py-0.5 rounded-full border font-medium",
            deck.isPlaying
              ? isDeckA ? "border-deck-a/30 text-deck-a bg-deck-a/10" : "border-deck-b/30 text-deck-b bg-deck-b/10"
              : "border-white/10 text-muted-foreground"
          )}>
            {deck.isPlaying ? "PLAYING" : "PAUSED"}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {deck.track ? (
          <>
            {/* Track Info */}
            <div className="mb-1.5 flex-shrink-0">
              <h3 className="text-[11px] font-semibold truncate leading-tight">{deck.track.title}</h3>
              <div className="text-[10px] text-muted-foreground truncate">{deck.track.artist}</div>
              <div className="flex gap-1.5 mt-1 items-center flex-wrap">
                <span className="text-[9px] font-mono bg-background/60 px-1.5 py-0.5 rounded border border-white/5">
                  {deck.track.bpm} <span className="text-[7px] text-muted-foreground/60">BPM</span>
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm"
                  style={{ backgroundColor: getCamelotColor(deck.track.key) }}
                >
                  {deck.track.key}
                </span>
                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5 text-amber-500"/>
                  {deck.track.energy.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Time Display */}
            <div className="flex justify-between text-[10px] font-mono mb-1 flex-shrink-0 text-muted-foreground">
              <span>{formatTime(deck.currentTime)}</span>
              <span className="opacity-60">{getRemainingTime()}</span>
            </div>

            {/* Waveform */}
            <div className="mb-1 flex-shrink-0">
              <div
                ref={waveformRef}
                className="h-14 w-full bg-background/40 rounded-lg cursor-pointer relative overflow-hidden border border-white/[0.03] shadow-inner"
                onClick={handleWaveformClick}
              >
                <div className="absolute inset-0 flex items-end px-0.5">
                  {waveform.map((height, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 mx-[0.5px] rounded-t-sm transition-colors duration-150",
                        i < (progress / 100) * waveform.length
                          ? isDeckA ? "bg-deck-a/80" : "bg-deck-b/80"
                          : "bg-white/10"
                      )}
                      style={{ height: `${Math.max(height * 90, 4)}%` }}
                    />
                  ))}
                </div>
                {/* Playhead */}
                <div
                  className={cn(
                    "absolute top-0 bottom-0 w-[2px] z-10 transition-[left] duration-75",
                    isDeckA ? "bg-deck-a shadow-[0_0_6px_var(--deck-a)]" : "bg-deck-b shadow-[0_0_6px_var(--deck-b)]"
                  )}
                  style={{ left: `${progress}%` }}
                />
              </div>
              {/* Section markers */}
              <div className="flex justify-between text-[8px] mt-0.5 px-0.5">
                {sections.map((section) => (
                  <span
                    key={section}
                    className={cn(
                      "transition-opacity",
                      currentSection === section
                        ? isDeckA ? "text-deck-a font-bold" : "text-deck-b font-bold"
                        : "text-muted-foreground/40"
                    )}
                  >
                    {section}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col justify-center items-center text-center">
            <div className={cn(
              "w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center mb-2",
              isDeckA ? "border-deck-a/20 text-deck-a/30" : "border-deck-b/20 text-deck-b/30"
            )}>
              <Play className="w-4 h-4 ml-0.5" />
            </div>
            <div className="text-[10px] text-muted-foreground/50 font-medium tracking-wide">NO TRACK LOADED</div>
            <div className="text-[8px] text-muted-foreground/30 mt-0.5">Double-click library to load</div>
          </div>
        )}

        {/* Transport Controls */}
        <div className="mt-auto flex-shrink-0 space-y-1 pt-1.5 border-t border-white/5">
          {/* Main Controls */}
          <div className="flex gap-1">
            <Button
              onClick={deck.isPlaying ? onPause : onPlay}
              size="sm"
              className={cn(
                "flex-1 h-9 rounded-lg transition-all duration-200 border",
                deck.isPlaying && isDeckA
                  ? "bg-deck-a/15 text-deck-a border-deck-a/40 shadow-[0_0_15px_-3px_var(--deck-a)] hover:bg-deck-a/25"
                  : deck.isPlaying && !isDeckA
                  ? "bg-deck-b/15 text-deck-b border-deck-b/40 shadow-[0_0_15px_-3px_var(--deck-b)] hover:bg-deck-b/25"
                  : "bg-card/60 hover:bg-muted border-white/5"
              )}
            >
              {deck.isPlaying
                ? <Pause className="w-4 h-4 fill-current" />
                : <Play className="w-4 h-4 ml-0.5 fill-current" />
              }
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCue}
              className="h-9 w-9 p-0 rounded-lg border-white/5 bg-card/60 hover:bg-muted"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onStop}
              className="h-9 w-9 p-0 rounded-lg border-white/5 bg-card/60 hover:bg-muted"
            >
              <Square className="w-3 h-3" />
            </Button>
          </div>

          {/* Secondary Controls */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEject}
              className="h-6 text-[9px] flex-1 px-1 text-muted-foreground/60 hover:text-foreground"
            >
              <SkipForward className="w-2.5 h-2.5 mr-0.5" />
              Eject
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[9px] flex-1 px-1 text-muted-foreground/60 hover:text-foreground"
            >
              <Repeat className="w-2.5 h-2.5 mr-0.5" />
              Loop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[9px] flex-1 px-1 text-muted-foreground/60 hover:text-foreground"
            >
              <Zap className="w-2.5 h-2.5 mr-0.5" />
              Cues
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
