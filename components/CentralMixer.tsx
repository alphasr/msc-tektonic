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

function LevelMeter({ level, mounted }: { level: number; mounted: boolean }) {
  const bars = Math.floor(level / 10)
  const meterData = Array(10).fill(0).map((_, i) => i < bars)

  return (
    <div className="flex flex-col-reverse gap-[1px] w-2">
      {mounted ? (
        meterData.map((active, i) => (
          <div
            key={i}
            className={cn(
              "w-full h-[3px] rounded-[1px] transition-all duration-75",
              i < 6 ? "bg-emerald-500" : i < 8 ? "bg-amber-400" : "bg-red-500",
              active ? "opacity-100" : "opacity-15"
            )}
          />
        ))
      ) : (
        Array(10).fill(0).map((_, i) => (
          <div key={i} className="w-full h-[3px] rounded-[1px] opacity-15 bg-muted-foreground" />
        ))
      )}
    </div>
  )
}

function ChannelStrip({
  label,
  color,
  eq,
  volume,
  level,
  mounted,
  onEQChange,
  onVolumeChange,
}: {
  label: string
  color: "deck-a" | "deck-b" | "muted-foreground"
  eq: { low: number; mid: number; high: number }
  volume: number
  level: number
  mounted: boolean
  onEQChange: (band: "low" | "mid" | "high", value: number) => void
  onVolumeChange: (volume: number) => void
}) {
  const formatDB = (value: number) => {
    return value >= 0 ? `+${value.toFixed(0)}` : value.toFixed(0)
  }

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      {/* Channel Label */}
      <div className={cn(
        "text-[9px] font-bold tracking-[0.15em] uppercase",
        color === "deck-a" ? "text-deck-a" : color === "deck-b" ? "text-deck-b" : "text-muted-foreground"
      )}>
        {label}
      </div>

      {/* EQ Section - 3 horizontal rows */}
      <div className="w-full space-y-1 bg-background/30 rounded-md p-1.5 border border-white/[0.03]">
        {(["high", "mid", "low"] as const).map((band) => (
          <div key={band} className="flex items-center gap-1.5">
            <span className="text-[8px] text-muted-foreground w-4 text-right uppercase font-medium">
              {band === "high" ? "Hi" : band === "mid" ? "Md" : "Lo"}
            </span>
            <Slider
              value={[eq[band]]}
              onValueChange={([value]) => onEQChange(band, value)}
              min={-12}
              max={12}
              step={0.5}
              className="flex-1"
            />
            <span className="text-[7px] font-mono text-muted-foreground/60 w-5 text-right">
              {formatDB(eq[band])}
            </span>
          </div>
        ))}
      </div>

      {/* Volume Fader + Level Meter */}
      <div className="flex items-center gap-1.5 flex-1 min-h-0 w-full justify-center py-1">
        <LevelMeter level={level} mounted={mounted} />
        <div className="flex flex-col items-center gap-0.5">
          <Slider
            orientation="vertical"
            value={[volume]}
            onValueChange={([value]) => onVolumeChange(value)}
            min={0}
            max={100}
            step={0.5}
            className="h-[80px]"
          />
          <span className="text-[8px] font-mono text-muted-foreground/60">
            {formatDB(volume - 50)}
          </span>
        </div>
        <LevelMeter level={level} mounted={mounted} />
      </div>
    </div>
  )
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
    setLevelMeters({
      deckA: Math.max(0, Math.min(100, deckA.volume + (Math.random() * 20 - 10))),
      master: Math.max(0, Math.min(100, masterVolume + (Math.random() * 20 - 10))),
      deckB: Math.max(0, Math.min(100, deckB.volume + (Math.random() * 20 - 10))),
    })

    const interval = setInterval(() => {
      setLevelMeters({
        deckA: Math.max(0, Math.min(100, deckA.volume + (Math.random() * 20 - 10))),
        master: Math.max(0, Math.min(100, masterVolume + (Math.random() * 20 - 10))),
        deckB: Math.max(0, Math.min(100, deckB.volume + (Math.random() * 20 - 10))),
      })
    }, 100)

    return () => clearInterval(interval)
  }, [deckA.volume, deckB.volume, masterVolume])

  const formatPercent = (value: number) => `${Math.round(value)}%`

  return (
    <div className="flex flex-col h-full p-2 rounded-xl border bg-card/40 backdrop-blur-md shadow-2xl overflow-hidden border-white/5">
      {/* Header */}
      <div className="flex-shrink-0 text-center border-b border-white/5 pb-1.5 mb-1.5">
        <h2 className="text-[9px] font-bold tracking-[0.2em] text-muted-foreground uppercase">Mixer</h2>
      </div>

      {/* Channel Strips */}
      <div className="flex-1 min-h-0 flex gap-1.5 overflow-hidden">
        {/* Deck A Channel */}
        <ChannelStrip
          label="A"
          color="deck-a"
          eq={deckA.eq}
          volume={deckA.volume}
          level={levelMeters.deckA}
          mounted={mounted}
          onEQChange={onDeckAEQChange}
          onVolumeChange={onDeckAVolumeChange}
        />

        {/* Divider */}
        <div className="w-px bg-white/5 self-stretch my-1 flex-shrink-0" />

        {/* Master Channel */}
        <ChannelStrip
          label="M"
          color="muted-foreground"
          eq={{ low: 0, mid: 0, high: 0 }}
          volume={masterVolume}
          level={levelMeters.master}
          mounted={mounted}
          onEQChange={() => {}} 
          onVolumeChange={onMasterVolumeChange}
        />

        {/* Divider */}
        <div className="w-px bg-white/5 self-stretch my-1 flex-shrink-0" />

        {/* Deck B Channel */}
        <ChannelStrip
          label="B"
          color="deck-b"
          eq={deckB.eq}
          volume={deckB.volume}
          level={levelMeters.deckB}
          mounted={mounted}
          onEQChange={onDeckBEQChange}
          onVolumeChange={onDeckBVolumeChange}
        />
      </div>

      {/* Crossfader */}
      <div className="flex-shrink-0 pt-2 mt-1 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-bold text-deck-a tracking-wider">A</span>
          <div className="flex-1">
            <Slider
              value={[crossfader]}
              onValueChange={([value]) => onCrossfaderChange(value)}
              min={-100}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
          <span className="text-[8px] font-bold text-deck-b tracking-wider">B</span>
        </div>
        <div className="text-[8px] text-center mt-0.5 text-muted-foreground/50">
          {crossfader < -5 ? `← A ${formatPercent(Math.abs(crossfader))}` : crossfader > 5 ? `B ${formatPercent(crossfader)} →` : "Center"}
        </div>
      </div>
    </div>
  )
}
