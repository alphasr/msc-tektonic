"use client"

import React, { useState, useEffect } from "react"
import { Search, RefreshCw, Sparkles, Music2, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Track } from "@/types"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"

interface TrackRecommendation {
  track: Track
  score: number
  scores: {
    harmonic: number
    tempo: number
    energy: number
    texture: number
    phrase: number
    overall: number
  }
  bestTransition?: {
    fromPosition: number
    toPosition: number
    score: number
  }
  similarSegments?: Array<{
    position: number
    score: number
    type: "bar" | "phrase"
  }>
}

interface TrackLibraryProps {
  tracks: Track[]
  onLoadTrack: (track: Track, deck: "A" | "B") => void
  onRefresh: () => void
}

export default function TrackLibrary({ tracks, onLoadTrack, onRefresh }: TrackLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [bpmFilter, setBpmFilter] = useState(false)
  const [keyFilter, setKeyFilter] = useState(false)
  const [energyFilter, setEnergyFilter] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [recommendations, setRecommendations] = useState<TrackRecommendation[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [activeTab, setActiveTab] = useState<"library" | "recommendations">("library")

  // Debug: log tracks when they change
  useEffect(() => {
    console.log("TrackLibrary received tracks:", tracks.length)
    if (tracks.length > 0) {
      console.log("First track:", tracks[0])
    }
  }, [tracks])

  // Fetch recommendations when track is selected
  useEffect(() => {
    if (selectedTrack) {
      fetchRecommendations(selectedTrack.id)
      // Auto-switch to recommendations tab when track is selected and recommendations are loaded
      if (recommendations.length > 0) {
        setActiveTab("recommendations")
      }
    } else {
      setRecommendations([])
      setShowRecommendations(false)
      setActiveTab("library")
    }
  }, [selectedTrack])

  // Switch to recommendations tab when recommendations are loaded
  useEffect(() => {
    if (selectedTrack && recommendations.length > 0 && activeTab === "library") {
      // Don't auto-switch, let user choose
    }
  }, [recommendations])

  const fetchRecommendations = async (trackId: string) => {
    setLoadingRecommendations(true)
    try {
      const response = await fetch(`/api/recommendations?trackId=${trackId}&limit=8`)
      if (response.ok) {
        const data = await response.json()
        setRecommendations(data)
        setShowRecommendations(true)
      }
    } catch (error) {
      console.error("Failed to fetch recommendations:", error)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-500"
    if (score >= 0.6) return "text-yellow-500"
    return "text-orange-500"
  }

  const filteredTracks = tracks.filter((track) => {
    if (searchQuery && !track.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !track.artist.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !track.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) &&
        !track.key.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (bpmFilter && (track.bpm < 120 || track.bpm > 130)) return false
    if (energyFilter && track.energy < 7) return false
    return true
  })

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex flex-col h-full rounded-lg border bg-card overflow-hidden">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "library" | "recommendations")} className="h-full flex flex-col">
        <TabsList className="w-full h-8 rounded-none border-b flex-shrink-0">
          <TabsTrigger value="library" className="text-xs px-3 h-7">
            Library
          </TabsTrigger>
          <TabsTrigger 
            value="recommendations" 
            className="text-xs px-3 h-7"
            disabled={!selectedTrack}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Recommendations {selectedTrack && recommendations.length > 0 && `(${recommendations.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="flex-1 flex flex-col p-1.5 !mt-0 min-h-0 overflow-hidden">
          <div className="mb-1 flex-shrink-0">
            <h2 className="text-xs font-bold mb-0.5">Track Library</h2>
            <p className="text-[10px] text-muted-foreground">
              Click to select • Double-click to load into Deck A
            </p>
          </div>

      <div className="mb-0.5 flex-shrink-0">
        <div className="relative mb-1">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
        <div className="flex gap-1 flex-wrap mb-1">
          <Button variant="outline" size="sm" className="h-6 text-xs px-2">Connect</Button>
          <Button variant="outline" size="sm" className="h-6 text-xs px-2">Browser</Button>
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button
            variant={bpmFilter ? "default" : "outline"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setBpmFilter(!bpmFilter)}
          >
            BPM
          </Button>
          <Button
            variant={keyFilter ? "default" : "outline"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setKeyFilter(!keyFilter)}
          >
            Key
          </Button>
          <Button
            variant={energyFilter ? "default" : "outline"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setEnergyFilter(!energyFilter)}
          >
            Energy
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs px-2">Tags</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {filteredTracks.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background border-b z-10">
              <tr>
                <th className="text-left p-1 text-[10px] font-semibold">TITLE</th>
                <th className="text-left p-1 text-[10px] font-semibold">ARTIST</th>
                <th className="text-left p-1 text-[10px] font-semibold">BPM</th>
                <th className="text-left p-1 text-[10px] font-semibold">KEY</th>
                <th className="text-left p-1 text-[10px] font-semibold">ENERGY</th>
                <th className="text-left p-1 text-[10px] font-semibold">DURATION</th>
                <th className="text-center p-1 text-[10px] font-semibold">LOAD A</th>
                <th className="text-center p-1 text-[10px] font-semibold">LOAD B</th>
              </tr>
            </thead>
            <tbody>
              {filteredTracks.map((track) => (
                <tr
                  key={track.id}
                  className={cn(
                    "border-b hover:bg-muted/50 cursor-pointer",
                    selectedTrack?.id === track.id && "bg-primary/10"
                  )}
                  onClick={() => setSelectedTrack(track)}
                  onDoubleClick={() => onLoadTrack(track, "A")}
                >
                  <td className="p-1 truncate max-w-[150px]">{track.title}</td>
                  <td className="p-1 truncate max-w-[120px]">{track.artist}</td>
                  <td className="p-1">{track.bpm}</td>
                  <td className="p-1">{track.key}</td>
                  <td className="p-1">{track.energy}</td>
                  <td className="p-1">{formatDuration(track.duration)}</td>
                  <td className="p-1 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-deck-a hover:text-deck-a hover:bg-deck-a/10 h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onLoadTrack(track, "A")
                      }}
                    >
                      A
                    </Button>
                  </td>
                  <td className="p-1 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-deck-b hover:text-deck-b hover:bg-deck-b/10 h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onLoadTrack(track, "B")
                      }}
                    >
                      B
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-xs">
            <div>No tracks found</div>
            <div className="text-[10px] mt-1">
              {tracks.length === 0 
                ? "No tracks available. Upload tracks in the Analyze page."
                : "Adjust filters or connect a streaming library to see more results."}
            </div>
          </div>
        )}
      </div>

          <div className="mt-1 text-xs text-muted-foreground flex-shrink-0">
            <div className="text-[10px]">Click to select for recommendations • Double-click to load</div>
          </div>

          <Button variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={onRefresh}>
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </TabsContent>

        <TabsContent value="recommendations" className="flex-1 p-1.5 !mt-0 min-h-0 overflow-auto data-[state=active]:block data-[state=inactive]:hidden">
          {selectedTrack && (
            <div className="space-y-2">
              <div className="mb-2">
                <h3 className="text-xs font-bold mb-1">Selected Track</h3>
                <div className="text-[10px] bg-muted p-2 rounded">
                  <div className="font-semibold">{selectedTrack.title}</div>
                  <div className="text-muted-foreground">{selectedTrack.artist}</div>
                  <div className="text-muted-foreground mt-1">
                    BPM: {selectedTrack.bpm} • Key: {selectedTrack.key} • Energy: {selectedTrack.energy}
                  </div>
                </div>
              </div>

              {loadingRecommendations ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Loading recommendations...
                </div>
              ) : recommendations.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold">Recommended Tracks</h3>
                  {recommendations.map((rec, idx) => (
                    <Card key={rec.track.id} className="p-2">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs truncate">{rec.track.title}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{rec.track.artist}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            BPM: {rec.track.bpm} • Key: {rec.track.key} • Energy: {rec.track.energy}
                          </div>
                        </div>
                        <div className="ml-2 text-right">
                          <div className={cn("text-xs font-bold", getScoreColor(rec.score))}>
                            {(rec.score * 100).toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">Match</div>
                        </div>
                      </div>

                      {/* Score breakdown */}
                      <div className="space-y-1 mb-2">
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="w-16">Harmonic:</span>
                          <Progress value={rec.scores.harmonic * 100} className="h-1.5 flex-1" />
                          <span className="w-8 text-right">{(rec.scores.harmonic * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="w-16">Tempo:</span>
                          <Progress value={rec.scores.tempo * 100} className="h-1.5 flex-1" />
                          <span className="w-8 text-right">{(rec.scores.tempo * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="w-16">Energy:</span>
                          <Progress value={rec.scores.energy * 100} className="h-1.5 flex-1" />
                          <span className="w-8 text-right">{(rec.scores.energy * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      {/* Best transition point */}
                      {rec.bestTransition && (
                        <div className="text-[10px] bg-muted/50 p-1.5 rounded mb-2">
                          <div className="font-semibold mb-1">Best Transition Point</div>
                          <div className="text-muted-foreground">
                            From: {formatTime(rec.bestTransition.fromPosition)} → To: {formatTime(rec.bestTransition.toPosition)}
                          </div>
                          <div className="text-muted-foreground">
                            Similarity: {(rec.bestTransition.score * 100).toFixed(0)}%
                          </div>
                        </div>
                      )}

                      {/* Similar segments */}
                      {rec.similarSegments && rec.similarSegments.length > 0 && (
                        <div className="text-[10px]">
                          <div className="font-semibold mb-1">Similar Segments ({rec.similarSegments.length})</div>
                          <div className="flex flex-wrap gap-1">
                            {rec.similarSegments.map((seg, i) => (
                              <div
                                key={i}
                                className="bg-primary/10 px-1.5 py-0.5 rounded text-[9px]"
                                title={`${formatTime(seg.position)} - ${(seg.score * 100).toFixed(0)}% match`}
                              >
                                {formatTime(seg.position)} ({(seg.score * 100).toFixed(0)}%)
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Load buttons */}
                      <div className="flex gap-1 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-6 text-xs"
                          onClick={() => onLoadTrack(rec.track, "A")}
                        >
                          Load A
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-6 text-xs"
                          onClick={() => onLoadTrack(rec.track, "B")}
                        >
                          Load B
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  No recommendations found. Try selecting a different track.
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

