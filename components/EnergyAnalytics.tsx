"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Track, DeckState } from "@/types"
import { cn } from "@/lib/utils"

interface EnergyAnalyticsProps {
  deckA: DeckState
  deckB: DeckState
}

export default function EnergyAnalytics({ deckA, deckB }: EnergyAnalyticsProps) {
  const [activeTab, setActiveTab] = useState("deckA")
  const [zoom, setZoom] = useState([17, 64])

  const getPhraseSegments = (track: Track | null) => {
    if (!track) return []
    const segments = [
      { type: "intro" as const, start: 0, end: 30, energy: 3 },
      { type: "verse" as const, start: 30, end: 90, energy: 5 },
      { type: "chorus" as const, start: 90, end: 150, energy: 8 },
      { type: "bridge" as const, start: 150, end: 210, energy: 6 },
      { type: "outro" as const, start: 210, end: track.duration, energy: 4 },
    ]
    return segments
  }

  const getSegmentColor = (type: string) => {
    switch (type) {
      case "intro":
        return "bg-purple-500"
      case "verse":
        return "bg-purple-700"
      case "chorus":
        return "bg-green-600"
      case "bridge":
        return "bg-green-400"
      case "outro":
        return "bg-green-300"
      default:
        return "bg-gray-500"
    }
  }

  const currentTrack = activeTab === "deckA" ? deckA.track : deckB.track
  const segments = getPhraseSegments(currentTrack)

  return (
    <div className="flex flex-col h-full p-1.5 rounded-lg border bg-card overflow-hidden">
      <div className="mb-1 flex-shrink-0">
        <h2 className="text-xs font-bold mb-0.5">Energy & Phrase Analytics</h2>
        <p className="text-[10px] text-muted-foreground">
          Visualize structure and cue points for transitions.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 mb-1 flex-shrink-0 h-7">
          <TabsTrigger value="deckA" className={cn(activeTab === "deckA" && "text-deck-a", "text-[10px]")}>
            Deck A
          </TabsTrigger>
          <TabsTrigger value="deckB" className={cn(activeTab === "deckB" && "text-deck-b", "text-[10px]")}>
            Deck B
          </TabsTrigger>
          <TabsTrigger value="master" className="text-[10px]">Master</TabsTrigger>
        </TabsList>

        <div className="flex gap-1 mb-1 flex-shrink-0">
          <Button variant="outline" size="sm" className="text-[10px] h-6 px-2">Linked</Button>
          <Button variant="outline" size="sm" className="text-[10px] h-6 px-2">Grid</Button>
          <Button variant="outline" size="sm" className="text-[10px] h-6 px-2">Reset</Button>
        </div>

        <TabsContent value={activeTab} className="flex-1 flex flex-col mt-0 min-h-0 overflow-hidden">
          {currentTrack ? (
            <>
              <div className="flex-1 bg-muted rounded p-1.5 mb-1 relative overflow-hidden min-h-0">
                <div className="flex items-end h-full gap-0.5">
                  {segments.map((segment, i) => {
                    const width = ((segment.end - segment.start) / currentTrack.duration) * 100
                    const height = (segment.energy / 10) * 100
                    return (
                      <div
                        key={i}
                        className={cn("rounded-t", getSegmentColor(segment.type))}
                        style={{
                          width: `${width}%`,
                          height: `${height}%`,
                        }}
                        title={`${segment.type}: ${Math.floor(segment.start)}s - ${Math.floor(segment.end)}s`}
                      />
                    )
                  })}
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-muted-foreground px-1">
                  {[0, 90, 180, 270, currentTrack.duration].map((time, i) => {
                    const mins = Math.floor(time / 60)
                    const secs = Math.floor(time % 60)
                    return (
                      <span key={i}>
                        {mins}:{secs.toString().padStart(2, "0")}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="mb-1 flex-shrink-0">
                <div className="text-[10px] mb-0.5">Zoom / Brush</div>
                <Slider
                  value={zoom}
                  onValueChange={setZoom}
                  min={1}
                  max={64}
                  step={1}
                  className="w-full"
                />
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  Bars {zoom[0]}-{zoom[1]}
                </div>
              </div>

              <div className="flex gap-2 text-[9px] flex-wrap flex-shrink-0">
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Intro</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-purple-700" />
                  <span>Verse</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-green-600" />
                  <span>Chorus</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span>Bridge</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-green-300" />
                  <span>Outro</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-0.5 h-3 bg-white" />
                  <span>Energy</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span>Cues</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center text-[10px]">
                <div>No track loaded</div>
                <div className="text-[9px] mt-1">Load a track to see analytics</div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

