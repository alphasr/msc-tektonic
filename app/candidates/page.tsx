"use client"

import { useState, useEffect } from "react"
import Navigation from "@/components/Navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { TransitionCandidate, Track } from "@/types"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"

export default function CandidatesPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [fromTrack, setFromTrack] = useState("")
  const [toTrack, setToTrack] = useState("")
  const [fromSearchQuery, setFromSearchQuery] = useState("")
  const [toSearchQuery, setToSearchQuery] = useState("")
  const [k, setK] = useState(5)
  const [mode, setMode] = useState("both")
  const [scope, setScope] = useState("phrase")
  const [candidates, setCandidates] = useState<TransitionCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTracks, setLoadingTracks] = useState(true)

  // Fetch available tracks
  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const response = await fetch("/api/tracks")
        if (response.ok) {
          const data = await response.json()
          setTracks(data)
        }
      } catch (error) {
        console.error("Failed to fetch tracks:", error)
      } finally {
        setLoadingTracks(false)
      }
    }
    fetchTracks()
  }, [])

  const handleGenerate = async () => {
    if (!fromTrack || !toTrack) return
    setLoading(true)
    try {
      const response = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromTrack, toTrack, k, mode, scope }),
      })
      const data = await response.json()
      setCandidates(data)
    } catch (error) {
      console.error("Failed to generate candidates:", error)
    } finally {
      setLoading(false)
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
    return "text-red-500"
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Filter tracks for search
  const filteredFromTracks = tracks.filter((track) => {
    if (!fromSearchQuery) return true
    const query = fromSearchQuery.toLowerCase()
    return (
      track.title.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query) ||
      track.key.toLowerCase().includes(query) ||
      track.bpm.toString().includes(query)
    )
  })

  const filteredToTracks = tracks.filter((track) => {
    if (!toSearchQuery) return true
    const query = toSearchQuery.toLowerCase()
    return (
      track.title.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query) ||
      track.key.toLowerCase().includes(query) ||
      track.bpm.toString().includes(query)
    )
  })

  const getSelectedFromTrack = tracks.find((t) => t.id === fromTrack)
  const getSelectedToTrack = tracks.find((t) => t.id === toTrack)

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Mix Candidates</CardTitle>
            <CardDescription>
              Generate transition candidates between two tracks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTracks ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading tracks...
              </div>
            ) : tracks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-2">No tracks available</p>
                <p className="text-sm">Upload tracks in the Analyze page to generate mix candidates</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">From Track</label>
                    <Select value={fromTrack} onValueChange={setFromTrack}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a track to mix from">
                          {getSelectedFromTrack
                            ? `${getSelectedFromTrack.title} - ${getSelectedFromTrack.artist}`
                            : "Select a track"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="Search tracks..."
                              value={fromSearchQuery}
                              onChange={(e) => setFromSearchQuery(e.target.value)}
                              className="pl-8 h-8 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="max-h-[300px] overflow-auto">
                          {filteredFromTracks.length > 0 ? (
                            filteredFromTracks.map((track) => (
                              <SelectItem key={track.id} value={track.id} className="py-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-sm">{track.title}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {track.artist} • {track.bpm} BPM • {track.key}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No tracks found
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                    {getSelectedFromTrack && (
                      <div className="mt-2 text-xs text-muted-foreground p-2 bg-muted rounded">
                        <div className="font-medium">{getSelectedFromTrack.title}</div>
                        <div>{getSelectedFromTrack.artist}</div>
                        <div className="mt-1">
                          BPM: {getSelectedFromTrack.bpm} • Key: {getSelectedFromTrack.key} • Energy: {getSelectedFromTrack.energy}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">To Track</label>
                    <Select value={toTrack} onValueChange={setToTrack}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a track to mix to">
                          {getSelectedToTrack
                            ? `${getSelectedToTrack.title} - ${getSelectedToTrack.artist}`
                            : "Select a track"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="Search tracks..."
                              value={toSearchQuery}
                              onChange={(e) => setToSearchQuery(e.target.value)}
                              className="pl-8 h-8 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="max-h-[300px] overflow-auto">
                          {filteredToTracks.length > 0 ? (
                            filteredToTracks.map((track) => (
                              <SelectItem key={track.id} value={track.id} className="py-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-sm">{track.title}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {track.artist} • {track.bpm} BPM • {track.key}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No tracks found
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                    {getSelectedToTrack && (
                      <div className="mt-2 text-xs text-muted-foreground p-2 bg-muted rounded">
                        <div className="font-medium">{getSelectedToTrack.title}</div>
                        <div>{getSelectedToTrack.artist}</div>
                        <div className="mt-1">
                          BPM: {getSelectedToTrack.bpm} • Key: {getSelectedToTrack.key} • Energy: {getSelectedToTrack.energy}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Number of Candidates (k)</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={k}
                  onChange={(e) => setK(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Scoring Mode</label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both (Sneak + Impact)</SelectItem>
                    <SelectItem value="sneak">Sneak transitions</SelectItem>
                    <SelectItem value="impact">Impact transitions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Analysis Scope</label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar level</SelectItem>
                    <SelectItem value="phrase">Phrase level</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {getSelectedFromTrack && getSelectedToTrack && (
              <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
                <h4 className="text-sm font-semibold mb-2">Track Compatibility Preview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">BPM Difference</div>
                    <div className={cn(
                      "font-mono text-lg",
                      Math.abs(getSelectedFromTrack.bpm - getSelectedToTrack.bpm) <= 5 ? "text-green-500" :
                      Math.abs(getSelectedFromTrack.bpm - getSelectedToTrack.bpm) <= 10 ? "text-yellow-500" :
                      "text-orange-500"
                    )}>
                      {Math.abs(getSelectedFromTrack.bpm - getSelectedToTrack.bpm)} BPM
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Energy Difference</div>
                    <div className={cn(
                      "font-mono text-lg",
                      Math.abs(getSelectedFromTrack.energy - getSelectedToTrack.energy) <= 1 ? "text-green-500" :
                      Math.abs(getSelectedFromTrack.energy - getSelectedToTrack.energy) <= 2 ? "text-yellow-500" :
                      "text-orange-500"
                    )}>
                      {Math.abs(getSelectedFromTrack.energy - getSelectedToTrack.energy).toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Key Compatibility</div>
                    <div className="font-mono text-lg">
                      {getSelectedFromTrack.key} → {getSelectedToTrack.key}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Total Duration</div>
                    <div className="font-mono text-lg">
                      {formatDuration(getSelectedFromTrack.duration + getSelectedToTrack.duration)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Button onClick={handleGenerate} disabled={loading || !fromTrack || !toTrack || loadingTracks}>
              {loading ? "Generating..." : "Generate Candidates"}
            </Button>

            {candidates.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Results</h3>
                <div className="space-y-4">
                  {candidates.map((candidate, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-lg font-semibold">
                            Candidate #{i + 1}
                          </div>
                          <div className={cn("text-2xl font-bold", getScoreColor(candidate.score))}>
                            {(candidate.score * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="text-sm text-muted-foreground">From Position</div>
                            <div className="font-mono">
                              {formatTime((candidate as any).from_position ?? candidate.fromPosition ?? 0)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">To Position</div>
                            <div className="font-mono">
                              {formatTime((candidate as any).to_position ?? candidate.toPosition ?? 0)}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div>
                            <div className="text-muted-foreground">Key</div>
                            <div className={getScoreColor((candidate.scores as any).key ?? 0)}>
                              {(((candidate.scores as any).key ?? 0) * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Energy</div>
                            <div className={getScoreColor((candidate.scores as any).energy ?? candidate.scores.tempo ?? 0)}>
                              {(((candidate.scores as any).energy ?? candidate.scores.tempo ?? 0) * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Timing</div>
                            <div className={getScoreColor((candidate.scores as any).timing ?? candidate.scores.phase ?? 0)}>
                              {(((candidate.scores as any).timing ?? candidate.scores.phase ?? 0) * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Contour</div>
                            <div className={getScoreColor((candidate.scores as any).contour ?? candidate.scores.texture ?? 0)}>
                              {(((candidate.scores as any).contour ?? candidate.scores.texture ?? 0) * 100).toFixed(0)}%
                            </div>
                          </div>
                          {(candidate.scores as any).tempo && (
                            <div>
                              <div className="text-muted-foreground">Tempo</div>
                              <div className={getScoreColor((candidate.scores as any).tempo)}>
                                {((candidate.scores as any).tempo * 100).toFixed(0)}%
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

