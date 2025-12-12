"use client"

import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { DeckState } from "@/types"
import { cn } from "@/lib/utils"

interface CentralMixerProps {
  deckA: DeckState
  deckB: DeckState
  masterVolume: number
  crossfader: number
  onDeckAVolumeChange: (volume: number) => void
  onDeckBVolumeChange: (volume: number) => void
  onMasterVolumeChange: (volume: number) => void
  onCrossfaderChange: (value: number) => void
  onDeckAEQChange: (band: "low" | "mid" | "high", value: number) => void
  onDeckBEQChange: (band: "low" | "mid" | "high", value: number) => void
}

export default function CentralMixer({
  deckA,
  deckB,
  masterVolume,
  crossfader,
  onDeckAVolumeChange,
  onDeckBVolumeChange,
  onMasterVolumeChange,
  onCrossfaderChange,
  onDeckAEQChange,
  onDeckBEQChange,
}: CentralMixerProps) {
  const [levelMeters, setLevelMeters] = useState({
    deckA: 0,
    master: 0,
    deckB: 0,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Initialize level meters based on volume, with some variation
    setLevelMeters({
      deckA: Math.max(0, Math.min(100, deckA.volume + (Math.random() * 20 - 10))),
      master: Math.max(0, Math.min(100, masterVolume + (Math.random() * 20 - 10))),
      deckB: Math.max(0, Math.min(100, deckB.volume + (Math.random() * 20 - 10))),
    })

    // Update level meters periodically to simulate audio levels
    const interval = setInterval(() => {
      setLevelMeters({
        deckA: Math.max(0, Math.min(100, deckA.volume + (Math.random() * 20 - 10))),
        master: Math.max(0, Math.min(100, masterVolume + (Math.random() * 20 - 10))),
        deckB: Math.max(0, Math.min(100, deckB.volume + (Math.random() * 20 - 10))),
      })
    }, 100)

    return () => clearInterval(interval)
  }, [deckA.volume, deckB.volume, masterVolume])

  const formatDB = (value: number) => {
    return value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1)
  }

  const formatPercent = (value: number) => {
    return `${Math.round(value)}%`
  }

  const getLevelMeter = (level: number) => {
    const bars = Math.floor(level / 10)
    return Array(12).fill(0).map((_, i) => i < bars)
  }

  return (
    <div className="flex flex-col h-full p-1.5 rounded-lg border bg-card overflow-hidden">
      <div className="mb-1 flex-shrink-0">
        <h2 className="text-xs font-bold">CENTRAL MIXER</h2>
        <p className="text-[9px] text-muted-foreground">3-band EQ, FX & metering</p>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-1.5 min-h-0 mb-1 overflow-hidden">
        {/* Deck A EQ */}
        <div className="flex flex-col items-center min-w-0 overflow-hidden">
          <div className="text-[9px] font-semibold mb-0.5 text-deck-a">DECK A</div>
          <div className="flex flex-col gap-0.5 flex-1 justify-center min-h-0">
            <div className="flex flex-col items-center">
              <div className="text-[9px] mb-0.5 text-muted-foreground">Hi</div>
              <Slider
                orientation="vertical"
                value={[deckA.eq.high]}
                onValueChange={([value]) => onDeckAEQChange("high", value)}
                min={-12}
                max={12}
                step={0.5}
                className="h-16"
              />
            </div>
            <div className="flex flex-col items-center">
              <div className="text-[9px] mb-0.5 text-muted-foreground">Mid</div>
              <Slider
                orientation="vertical"
                value={[deckA.eq.mid]}
                onValueChange={([value]) => onDeckAEQChange("mid", value)}
                min={-12}
                max={12}
                step={0.5}
                className="h-16"
              />
            </div>
            <div className="flex flex-col items-center">
              <div className="text-[9px] mb-0.5 text-muted-foreground">Low</div>
              <Slider
                orientation="vertical"
                value={[deckA.eq.low]}
                onValueChange={([value]) => onDeckAEQChange("low", value)}
                min={-12}
                max={12}
                step={0.5}
                className="h-16"
              />
            </div>
          </div>
        </div>

        {/* Master FX */}
        <div className="flex flex-col items-center min-w-0 overflow-hidden">
          <div className="text-[9px] font-semibold mb-0.5">MASTER</div>
          <div className="flex flex-col gap-0.5 flex-1 justify-center min-h-0">
            <div className="flex flex-col items-center">
              <div className="text-[9px] mb-0.5 text-muted-foreground">Send</div>
              <Slider
                orientation="vertical"
                value={[50]}
                min={0}
                max={100}
                step={1}
                className="h-16"
              />
            </div>
            <div className="flex flex-col items-center">
              <div className="text-[9px] mb-0.5 text-muted-foreground">FX</div>
              <Slider
                orientation="vertical"
                value={[50]}
                min={0}
                max={100}
                step={1}
                className="h-16"
              />
            </div>
          </div>
        </div>

        {/* Deck B EQ */}
        <div className="flex flex-col items-center min-w-0 overflow-hidden">
          <div className="text-[9px] font-semibold mb-0.5 text-deck-b">DECK B</div>
          <div className="flex flex-col gap-0.5 flex-1 justify-center min-h-0">
            <div className="flex flex-col items-center">
              <div className="text-[9px] mb-0.5 text-muted-foreground">Hi</div>
              <Slider
                orientation="vertical"
                value={[deckB.eq.high]}
                onValueChange={([value]) => onDeckBEQChange("high", value)}
                min={-12}
                max={12}
                step={0.5}
                className="h-16"
              />
            </div>
            <div className="flex flex-col items-center">
              <div className="text-[9px] mb-0.5 text-muted-foreground">Mid</div>
              <Slider
                orientation="vertical"
                value={[deckB.eq.mid]}
                onValueChange={([value]) => onDeckBEQChange("mid", value)}
                min={-12}
                max={12}
                step={0.5}
                className="h-16"
              />
            </div>
            <div className="flex flex-col items-center">
              <div className="text-[9px] mb-0.5 text-muted-foreground">Low</div>
              <Slider
                orientation="vertical"
                value={[deckB.eq.low]}
                onValueChange={([value]) => onDeckBEQChange("low", value)}
                min={-12}
                max={12}
                step={0.5}
                className="h-16"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Volume Faders */}
      <div className="grid grid-cols-3 gap-1.5 mb-1 flex-shrink-0 overflow-hidden">
        <div className="flex flex-col items-center min-w-0">
          <div className="text-[9px] mb-0.5 text-deck-a font-medium">A</div>
          <div className="flex-1 flex flex-col items-center justify-end min-h-[80px]">
            <Slider
              orientation="vertical"
              value={[deckA.volume]}
              onValueChange={([value]) => onDeckAVolumeChange(value)}
              min={0}
              max={100}
              step={0.1}
              className="h-24"
            />
            <div className="text-[9px] mt-0.5 text-muted-foreground">{formatDB(deckA.volume - 50)}</div>
            <div className="flex gap-0.5 mt-0.5">
              {mounted ? (
                getLevelMeter(levelMeters.deckA).map((active, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-3 rounded-sm",
                      i < 8 ? "bg-green-500" : i < 10 ? "bg-yellow-500" : "bg-red-500",
                      !active && "opacity-30"
                    )}
                  />
                ))
              ) : (
                Array(12).fill(0).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-3 rounded-sm opacity-30",
                      i < 8 ? "bg-green-500" : i < 10 ? "bg-yellow-500" : "bg-red-500"
                    )}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center min-w-0">
          <div className="text-[9px] mb-0.5 font-medium">M</div>
          <div className="flex-1 flex flex-col items-center justify-end min-h-[80px]">
            <Slider
              orientation="vertical"
              value={[masterVolume]}
              onValueChange={([value]) => onMasterVolumeChange(value)}
              min={0}
              max={100}
              step={0.1}
              className="h-24"
            />
            <div className="text-[9px] mt-0.5 text-muted-foreground">{formatDB(masterVolume - 50)}</div>
            <div className="flex gap-0.5 mt-0.5">
              {mounted ? (
                getLevelMeter(levelMeters.master).map((active, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-3 rounded-sm",
                      i < 8 ? "bg-green-500" : i < 10 ? "bg-yellow-500" : "bg-red-500",
                      !active && "opacity-30"
                    )}
                  />
                ))
              ) : (
                Array(12).fill(0).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-3 rounded-sm opacity-30",
                      i < 8 ? "bg-green-500" : i < 10 ? "bg-yellow-500" : "bg-red-500"
                    )}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center min-w-0">
          <div className="text-[9px] mb-0.5 text-deck-b font-medium">B</div>
          <div className="flex-1 flex flex-col items-center justify-end min-h-[80px]">
            <Slider
              orientation="vertical"
              value={[deckB.volume]}
              onValueChange={([value]) => onDeckBVolumeChange(value)}
              min={0}
              max={100}
              step={0.1}
              className="h-24"
            />
            <div className="text-[9px] mt-0.5 text-muted-foreground">{formatDB(deckB.volume - 50)}</div>
            <div className="flex gap-0.5 mt-0.5">
              {mounted ? (
                getLevelMeter(levelMeters.deckB).map((active, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-3 rounded-sm",
                      i < 8 ? "bg-green-500" : i < 10 ? "bg-yellow-500" : "bg-red-500",
                      !active && "opacity-30"
                    )}
                  />
                ))
              ) : (
                Array(12).fill(0).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-3 rounded-sm opacity-30",
                      i < 8 ? "bg-green-500" : i < 10 ? "bg-yellow-500" : "bg-red-500"
                    )}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Crossfader */}
      <div className="flex-shrink-0">
        <div className="text-[9px] mb-0.5 text-center text-muted-foreground">Crossfader</div>
        <Slider
          value={[crossfader]}
          onValueChange={([value]) => onCrossfaderChange(value)}
          min={-100}
          max={100}
          step={1}
          className="w-full"
        />
        <div className="text-[9px] text-center mt-0.5 text-muted-foreground">
          {crossfader < 0 ? `A ${formatPercent(Math.abs(crossfader))}` : crossfader > 0 ? `B ${formatPercent(crossfader)}` : "Center"}
        </div>
      </div>
    </div>
  )
}

