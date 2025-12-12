"use client"

import { useState, useEffect, useRef } from "react"
import { Play, Pause, Square, SkipBack, SkipForward, RotateCcw, Repeat, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Track, DeckState } from "@/types"
import { cn } from "@/lib/utils"

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
  const [isDragging, setIsDragging] = useState(false)
  const waveformRef = useRef<HTMLDivElement>(null)
  const isDeckA = deckName === "A"
  const deckColor = isDeckA ? "purple" : "red"

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getRemainingTime = () => {
    if (!deck.track) return "—"
    const remaining = deck.track.duration - deck.currentTime
    return `~${formatTime(remaining)}`
  }

  const generateWaveform = () => {
    if (!deck.track || !deck.track.waveform || deck.track.waveform.length === 0) {
      // Return flat waveform if not available
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

  return (
    <div className={cn(
      "flex flex-col h-full p-1.5 rounded-lg border overflow-hidden",
      isDeckA ? "bg-deck-a-bg border-deck-a/20" : "bg-deck-b-bg border-deck-b/20"
    )}>
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <h2 className={cn(
          "text-xs font-bold",
          isDeckA ? "text-deck-a" : "text-deck-b"
        )}>
          DECK {deckName}
        </h2>
        {deck.track && (
          <Button variant="ghost" size="sm" className="text-xs h-6 px-2">
            Standby
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {deck.track ? (
          <>
            <div className="mb-1 flex-shrink-0">
              <h3 className="text-xs font-semibold truncate">{deck.track.title}</h3>
              <div className="text-[10px] text-muted-foreground">
                <div className="truncate">{deck.track.artist}</div>
                <div className="flex gap-1.5 mt-0.5 text-[9px]">
                  <span>{deck.track.bpm} BPM</span>
                  <span>Key {deck.track.key}</span>
                  <span>E{deck.track.energy}</span>
                </div>
              </div>
            </div>

            <div className="mb-1 flex gap-2 text-[10px] flex-shrink-0">
              <span>Elapsed {formatTime(deck.currentTime)}</span>
              <span>Remaining {getRemainingTime()}</span>
            </div>

            <div className="mb-1 flex-shrink-0">
              <div
                ref={waveformRef}
                className="h-12 w-full bg-muted rounded cursor-pointer relative overflow-hidden"
                onClick={handleWaveformClick}
              >
                <div className="absolute inset-0 flex items-center">
                  {waveform.map((height, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 mx-0.5 rounded-sm transition-all",
                        i < (progress / 100) * waveform.length
                          ? isDeckA ? "bg-deck-a" : "bg-deck-b"
                          : "bg-muted-foreground/30"
                      )}
                      style={{ height: `${height * 100}%` }}
                    />
                  ))}
                </div>
                {deck.isPlaying && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                    style={{ left: `${progress}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[9px] mt-0.5">
                {sections.map((section, i) => (
                  <span
                    key={section}
                    className={cn(
                      currentSection === section && "font-bold",
                      isDeckA ? "text-deck-a" : "text-deck-b"
                    )}
                  >
                    {section}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 flex-shrink-0">
              <div className="text-sm font-semibold mb-1">No track loaded</div>
              <div className="text-xs text-muted-foreground">
                <div>Artist —</div>
                <div className="flex gap-2 mt-0.5 text-[10px]">
                  <span>BPM —</span>
                  <span>Key —</span>
                  <span>E—</span>
                </div>
              </div>
            </div>
            <div className="mb-2 flex gap-2 text-xs flex-shrink-0">
              <span>Elapsed 00:00</span>
              <span>Remaining —</span>
            </div>
            <div className="h-16 w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded mb-2 flex items-center justify-center text-muted-foreground flex-shrink-0">
              <div className="text-center text-xs">
                <div>No waveform available</div>
                <div className="text-[10px] mt-0.5">Load a track to begin</div>
              </div>
            </div>
          </>
        )}

        <div className="mt-auto flex-shrink-0 space-y-0.5">
          <div className="flex gap-0.5">
            <Button
              onClick={deck.isPlaying ? onPause : onPlay}
              size="sm"
              className={cn(
                "flex-1 h-7",
                isDeckA ? "bg-deck-a hover:bg-deck-a/90" : "bg-deck-b hover:bg-deck-b/90"
              )}
            >
              {deck.isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </Button>
            <Button variant="outline" size="sm" onClick={onCue} className="h-7 w-7 p-0">
              <RotateCcw className="w-2.5 h-2.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onStop} className="h-7 w-7 p-0">
              <Square className="w-2.5 h-2.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0">
              <Zap className="w-2.5 h-2.5" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full h-6 text-[10px]"
            onClick={onLoadTrack}
          >
            Load Track
          </Button>

          <div className="flex gap-0.5">
            <Button variant="ghost" size="sm" onClick={onEject} className="h-5 text-[9px] flex-1 px-1">
              Eject
            </Button>
            <Button variant="ghost" size="sm" className="h-5 text-[9px] flex-1 px-1">
              <Repeat className="w-2 h-2 mr-0.5" />
              Loop
            </Button>
            <Button variant="ghost" size="sm" className="h-5 text-[9px] flex-1 px-1">
              <Zap className="w-2 h-2 mr-0.5" />
              Cues
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

