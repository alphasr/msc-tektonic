"use client"

import { useState, useEffect, useRef } from "react"
import { Slider } from "@/components/ui/slider"
import { DeckState } from "@/types"
import { cn } from "@/lib/utils"
import { getAudioManager } from "@/lib/audio-manager"

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
  onAutoTransition: () => void
}

interface LevelMeters {
  deckA: number
  master: number
  deckB: number
}

interface KillState {
  low: boolean
  mid: boolean
  high: boolean
}

function VUMeter({ level, isActive }: { level: number; isActive: boolean }) {
  const segments = 12
  const active = Math.round((level / 100) * segments)

  return (
    <div className="flex flex-col-reverse gap-[1.5px] w-2">
      {Array.from({ length: segments }, (_, i) => {
        const lit = isActive && i < active
        const color = i < 7 ? '#22c55e' : i < 10 ? '#f59e0b' : '#ef4444'
        return (
          <div
            key={i}
            className="w-full rounded-[1px] transition-all duration-75"
            style={{
              height: '3px',
              backgroundColor: lit ? color : 'rgba(255,255,255,0.07)',
              boxShadow: lit && i >= 10 ? `0 0 4px ${color}` : 'none',
            }}
          />
        )
      })}
    </div>
  )
}

function EQBand({
  label,
  band,
  value,
  killed,
  onValueChange,
  onKillToggle,
}: {
  label: string
  band: 'low' | 'mid' | 'high'
  value: number
  killed: boolean
  onValueChange: (v: number) => void
  onKillToggle: () => void
}) {
  const formatDB = (v: number) => (v >= 0 ? `+${v.toFixed(0)}` : v.toFixed(0))

  return (
    <div className="flex items-center gap-1.5">
      {/* Kill button */}
      <button
        onClick={onKillToggle}
        title={killed ? `Un-kill ${label}` : `Kill ${label} (hold to cut)`}
        className={cn(
          "w-5 h-5 rounded text-[8px] font-black border transition-all flex-shrink-0",
          killed
            ? "bg-red-500/30 border-red-500/60 text-red-400 shadow-[0_0_6px_-1px_rgba(239,68,68,0.5)]"
            : "border-white/[0.06] text-muted-foreground/50 hover:border-white/20 hover:text-foreground"
        )}
      >
        K
      </button>
      <span className="text-[8px] text-muted-foreground w-4 text-right uppercase">
        {label}
      </span>
      <Slider
        value={[killed ? -12 : value]}
        onValueChange={([v]) => !killed && onValueChange(v)}
        min={-12}
        max={12}
        step={0.5}
        disabled={killed}
        className={cn("flex-1", killed && "opacity-30")}
      />
      <span className="text-[7px] font-mono text-muted-foreground/50 w-5 text-right tabular-nums">
        {killed ? '––' : formatDB(value)}
      </span>
    </div>
  )
}

function ChannelStrip({
  label,
  color,
  eq,
  volume,
  kills,
  level,
  isPlaying,
  onEQChange,
  onVolumeChange,
  onKillToggle,
}: {
  label: string
  color: 'deck-a' | 'deck-b' | 'muted'
  eq: { low: number; mid: number; high: number }
  volume: number
  kills: KillState
  level: number
  isPlaying: boolean
  onEQChange: (band: 'low' | 'mid' | 'high', value: number) => void
  onVolumeChange: (v: number) => void
  onKillToggle: (band: 'low' | 'mid' | 'high') => void
}) {
  const labelColor =
    color === 'deck-a'
      ? 'text-deck-a'
      : color === 'deck-b'
      ? 'text-deck-b'
      : 'text-muted-foreground'

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <div className={cn("text-[9px] font-black tracking-[0.2em] uppercase", labelColor)}>{label}</div>

      {/* EQ */}
      {color !== 'muted' && (
        <div className="w-full space-y-0.5 bg-background/30 rounded p-1 border border-white/[0.04]">
          {(['high', 'mid', 'low'] as const).map(band => (
            <EQBand
              key={band}
              label={band === 'high' ? 'Hi' : band === 'mid' ? 'Md' : 'Lo'}
              band={band}
              value={eq[band]}
              killed={kills[band]}
              onValueChange={v => onEQChange(band, v)}
              onKillToggle={() => onKillToggle(band)}
            />
          ))}
        </div>
      )}

      {/* Volume fader + meters */}
      <div className="flex items-center gap-1.5 flex-1 min-h-0 w-full justify-center py-1">
        <VUMeter level={level} isActive={isPlaying} />
        <div className="flex flex-col items-center gap-0.5">
          <Slider
            orientation="vertical"
            value={[volume]}
            onValueChange={([v]) => onVolumeChange(v)}
            min={0}
            max={100}
            step={0.5}
            className="h-[70px]"
          />
          <span className="text-[7px] font-mono text-muted-foreground/40 tabular-nums">
            {volume >= 50 ? `+${(volume - 50).toFixed(0)}` : (volume - 50).toFixed(0)}
          </span>
        </div>
        <VUMeter level={level} isActive={isPlaying} />
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
  onAutoTransition,
}: CentralMixerProps) {
  const [levels, setLevels] = useState<LevelMeters>({ deckA: 0, master: 0, deckB: 0 })
  const [killsA, setKillsA] = useState<KillState>({ low: false, mid: false, high: false })
  const [killsB, setKillsB] = useState<KillState>({ low: false, mid: false, high: false })

  // Track pre-kill EQ values so we can restore them
  const preKillEQ = useRef({
    deckA: { low: 0, mid: 0, high: 0 },
    deckB: { low: 0, mid: 0, high: 0 },
  })

  // Real level meters from audio engine
  useEffect(() => {
    const audioManager = getAudioManager()

    const getLevel = (freqData: Uint8Array | null, isPlaying: boolean, vol: number): number => {
      if (!isPlaying) return 0
      if (!freqData || freqData.length === 0) return vol * 0.8
      let sum = 0
      for (let i = 0; i < freqData.length; i++) sum += freqData[i]
      const avg = sum / freqData.length / 255
      // Scale by volume setting
      return Math.min(100, avg * (vol / 50) * 100)
    }

    let animId: number
    const update = () => {
      const fA = audioManager.getFrequencyData('A')
      const fB = audioManager.getFrequencyData('B')
      const lA = getLevel(fA, deckA.isPlaying, deckA.volume)
      const lB = getLevel(fB, deckB.isPlaying, deckB.volume)
      const lM = (deckA.isPlaying || deckB.isPlaying)
        ? Math.max(lA, lB) * (masterVolume / 100)
        : 0
      setLevels({ deckA: lA, master: lM, deckB: lB })
      animId = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(animId)
  }, [deckA.isPlaying, deckB.isPlaying, deckA.volume, deckB.volume, masterVolume])

  const handleKillToggle = (deck: 'A' | 'B', band: 'low' | 'mid' | 'high') => {
    const kills = deck === 'A' ? killsA : killsB
    const setKills = deck === 'A' ? setKillsA : setKillsB
    const onEQChange = deck === 'A' ? onDeckAEQChange : onDeckBEQChange
    const currentEQ = deck === 'A' ? deckA.eq : deckB.eq
    const deckKey = deck === 'A' ? 'deckA' : 'deckB'

    if (!kills[band]) {
      // Kill: save current, set to -12
      preKillEQ.current[deckKey][band] = currentEQ[band]
      onEQChange(band, -12)
    } else {
      // Un-kill: restore saved value
      onEQChange(band, preKillEQ.current[deckKey][band])
    }
    setKills(prev => ({ ...prev, [band]: !prev[band] }))
  }

  const crossFaderLabel = () => {
    if (crossfader < -5) return `← A ${Math.abs(crossfader).toFixed(0)}%`
    if (crossfader > 5) return `B ${crossfader.toFixed(0)}% →`
    return 'CENTER'
  }

  return (
    <div className="flex flex-col h-full p-2 rounded-xl border bg-card/40 backdrop-blur-md shadow-xl overflow-hidden border-white/[0.05]">
      {/* Header */}
      <div className="flex-shrink-0 text-center border-b border-white/[0.04] pb-1 mb-1.5">
        <h2 className="text-[8px] font-black tracking-[0.25em] text-muted-foreground/70 uppercase">MIXER</h2>
      </div>

      {/* Channel strips */}
      <div className="flex-1 min-h-0 flex gap-1 overflow-hidden">
        <ChannelStrip
          label="A"
          color="deck-a"
          eq={deckA.eq}
          volume={deckA.volume}
          kills={killsA}
          level={levels.deckA}
          isPlaying={deckA.isPlaying}
          onEQChange={onDeckAEQChange}
          onVolumeChange={onDeckAVolumeChange}
          onKillToggle={band => handleKillToggle('A', band)}
        />

        <div className="w-px bg-white/[0.04] self-stretch my-0.5 flex-shrink-0" />

        {/* Master — no EQ strip, just volume */}
        <ChannelStrip
          label="M"
          color="muted"
          eq={{ low: 0, mid: 0, high: 0 }}
          volume={masterVolume}
          kills={{ low: false, mid: false, high: false }}
          level={levels.master}
          isPlaying={deckA.isPlaying || deckB.isPlaying}
          onEQChange={() => {}}
          onVolumeChange={onMasterVolumeChange}
          onKillToggle={() => {}}
        />

        <div className="w-px bg-white/[0.04] self-stretch my-0.5 flex-shrink-0" />

        <ChannelStrip
          label="B"
          color="deck-b"
          eq={deckB.eq}
          volume={deckB.volume}
          kills={killsB}
          level={levels.deckB}
          isPlaying={deckB.isPlaying}
          onEQChange={onDeckBEQChange}
          onVolumeChange={onDeckBVolumeChange}
          onKillToggle={band => handleKillToggle('B', band)}
        />
      </div>

      {/* Crossfader */}
      <div className="flex-shrink-0 pt-1.5 mt-1 border-t border-white/[0.04] space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-black text-deck-a tracking-wide w-3">A</span>
          <div className="flex-1">
            <Slider
              value={[crossfader]}
              onValueChange={([v]) => onCrossfaderChange(v)}
              min={-100}
              max={100}
              step={1}
            />
          </div>
          <span className="text-[8px] font-black text-deck-b tracking-wide w-3 text-right">B</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[8px] text-muted-foreground/40 font-mono tabular-nums">{crossFaderLabel()}</span>
          <button
            onClick={onAutoTransition}
            className="text-[8px] font-black tracking-widest px-3 py-1 rounded border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 text-white transition-all"
          >
            AUTO MIX
          </button>
        </div>
      </div>
    </div>
  )
}
