"use client"

import { useState, useEffect } from "react"
import Navigation from "@/components/Navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, FileAudio, RefreshCw, Activity, Clock, Music, Zap, Hash } from "lucide-react"
import { Track } from "@/types"
import { getCamelotColor } from "@/lib/utils"

export default function AnalyzePage() {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loadingTracks, setLoadingTracks] = useState(true)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)

  useEffect(() => {
    fetchTracks()
  }, [])

  const fetchTracks = async () => {
    setLoadingTracks(true)
    try {
      const response = await fetch('/api/tracks')
      if (response.ok) {
        const data = await response.json()
        setTracks(data)
      }
    } catch (error) {
      console.error('Failed to fetch tracks:', error)
    } finally {
      setLoadingTracks(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleAnalyze = async () => {
    if (!selectedFile) return
    
    try {
      const formData = new FormData()
      formData.append("audio_file", selectedFile)
      if (selectedFile.name) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "")
        formData.append("title", nameWithoutExt)
      }
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(`Track uploaded! Track ID: ${data.track_id}\nStatus: ${data.status}\nAnalysis will begin shortly.`)
        setSelectedFile(null)
        setTimeout(fetchTracks, 2000) // refresh tracks a bit after upload starts
      } else {
        const error = await response.json()
        alert(`Upload failed: ${error.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Upload error:", error)
      alert("Failed to upload track. Please try again.")
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <div className="flex-1 container mx-auto p-4 md:p-8 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* UPLOAD SECTION */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload & Analyze</CardTitle>
                <CardDescription>
                  Upload a new track to analyze BPM, key, energy, and structure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                    dragActive ? "border-primary bg-primary/10" : "border-muted"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                  <p className="mb-2">Drag and drop your audio file here</p>
                  <p className="text-sm text-muted-foreground mb-4">or</p>
                  <div>
                    <Input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileInput}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("file-upload")?.click()}
                    >
                      Browse Files
                    </Button>
                  </div>
                  {selectedFile && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-primary">
                      <FileAudio className="w-4 h-4" />
                      <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                    </div>
                  )}
                </div>
                
                {selectedFile && (
                  <Button className="mt-4 w-full" onClick={handleAnalyze}>
                    Start Analysis
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Analyzed Tracks</CardTitle>
                  <CardDescription>
                    Your previously analyzed music library
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchTracks} disabled={loadingTracks}>
                  <RefreshCw className={`w-4 h-4 ${loadingTracks ? "animate-spin" : ""}`} />
                </Button>
              </CardHeader>
              <CardContent className="max-h-[500px] overflow-y-auto p-0">
                {tracks.length > 0 ? (
                  <div className="divide-y divide-border">
                    {tracks.map(track => (
                      <div 
                        key={track.id}
                        className={`p-4 flex items-center justify-between cursor-pointer hover:bg-card/50 transition-colors ${selectedTrack?.id === track.id ? 'bg-primary/5 border-l-4 border-primary' : ''}`}
                        onClick={() => setSelectedTrack(track)}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            <Music className="w-5 h-5 text-primary" />
                          </div>
                          <div className="truncate">
                            <p className="font-medium truncate text-sm">{track.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{track.artist || 'Unknown Artist'}</p>
                          </div>
                        </div>
                        <div className="flex gap-3 shrink-0 px-2 text-xs text-muted-foreground items-center">
                          <span className="w-12 text-right whitespace-nowrap" title="Tempo">{track.bpm} <span className="text-[10px]">BPM</span></span>
                          <span className="w-8 text-center font-bold px-1.5 py-0.5 rounded text-white shadow-sm" style={{ backgroundColor: getCamelotColor(track.key) }} title="Key">{track.key}</span>
                          <span className="w-8 text-center whitespace-nowrap" title="Energy">E: {track.energy.toFixed(1)}</span>
                          <span className="w-10 text-right whitespace-nowrap" title="Duration">{formatDuration(track.duration)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    {loadingTracks ? "Loading tracks..." : "No analyzed tracks found. Upload some music!"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ANALYSIS DISPLAY SECTION */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Song Analysis details</CardTitle>
                <CardDescription>
                  {selectedTrack ? "Detailed metrics for the selected track" : "Select a track from the library to view analysis"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedTrack ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold">{selectedTrack.title}</h2>
                      <p className="text-muted-foreground">{selectedTrack.artist}</p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Tempo Card */}
                      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card to-card/50 p-5 shadow-sm">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                          <Activity className="w-16 h-16" />
                        </div>
                        <div className="font-semibold mb-2 text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                          <Activity className="w-3 h-3 text-primary" /> Tempo
                        </div>
                        <div className="text-3xl font-black tracking-tighter">{selectedTrack.bpm} <span className="text-sm font-medium tracking-normal text-muted-foreground">BPM</span></div>
                      </div>

                      {/* Key Card */}
                      <div 
                        className="relative overflow-hidden rounded-xl border p-5 shadow-sm text-white"
                        style={{ 
                          background: `linear-gradient(135deg, ${getCamelotColor(selectedTrack.key)} 0%, ${getCamelotColor(selectedTrack.key)}88 100%)`
                        }}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-20 text-black">
                          <Hash className="w-16 h-16" />
                        </div>
                        <div className="font-semibold mb-2 text-[10px] uppercase tracking-widest flex items-center gap-1.5 opacity-90">
                          <Music className="w-3 h-3" /> Camelot Key
                        </div>
                        <div className="text-3xl font-black tracking-tighter drop-shadow-md">{selectedTrack.key}</div>
                      </div>

                      {/* Energy Card */}
                      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card to-card/50 p-5 shadow-sm">
                        <div className="absolute -bottom-2 -right-2 p-3 opacity-10 text-orange-500">
                          <Zap className="w-20 h-20" />
                        </div>
                        <div className="font-semibold mb-2 text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-orange-500" /> Energy
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black tracking-tighter">{selectedTrack.energy.toFixed(1)}</span>
                          <span className="text-sm font-medium text-muted-foreground">/ 10</span>
                        </div>
                        <div className="w-full h-1 bg-muted mt-3 rounded-full overflow-hidden">
                           <div className="h-full bg-orange-500 rounded-full" style={{ width: `${selectedTrack.energy * 10}%` }} />
                        </div>
                      </div>

                      {/* Duration Card */}
                      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card to-card/50 p-5 shadow-sm">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                          <Clock className="w-16 h-16" />
                        </div>
                        <div className="font-semibold mb-2 text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-blue-500" /> Duration
                        </div>
                        <div className="text-3xl font-black tracking-tighter">{formatDuration(selectedTrack.duration)}</div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Track Structure ({selectedTrack.phrases} Phrases)</h3>
                        <div className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded font-semibold border border-primary/20">AI ANALYZED</div>
                      </div>
                      
                      <div className="w-full h-36 bg-background rounded-xl flex items-center justify-center border-2 border-muted overflow-hidden relative shadow-inner p-1">
                         {selectedTrack.waveform && selectedTrack.waveform.length > 0 ? (
                           <div className="flex items-end h-full w-full gap-[2px]">
                             {selectedTrack.waveform.map((val, i) => (
                               <div key={i} className="bg-primary hover:bg-primary/80 transition-colors rounded-t-sm w-full" style={{ height: `${Math.max(4, val * 100)}%` }} />
                             ))}
                           </div>
                         ) : (
                           <div className="flex items-end h-full w-full gap-[2px] opacity-70">
                             {Array.from({ length: 80 }).map((_, i) => {
                               // Generate a fake waveform envelope that rises, stays high, and falls based on the phrase count and energy.
                               const progress = i / 80;
                               const baseHeight = 20;
                               const energyMulti = selectedTrack.energy * 5;
                               let envelope = 0;
                               
                               if (progress < 0.1) envelope = progress * 10; // intro build
                               else if (progress > 0.9) envelope = (1 - progress) * 10; // outro fade
                               else envelope = 1.0 + (Math.sin(progress * Math.PI * 4) * 0.2); // body variation
                               
                               const noise = Math.random() * 20;
                               const h = Math.min(100, Math.max(5, (baseHeight + energyMulti * envelope) + noise));
                               
                               return <div key={i} className="bg-primary/60 rounded-t-sm w-full transition-all" style={{ height: `${h}%` }} />
                             })}
                           </div>
                         )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-3 text-center">
                        The AI engine has mapped {selectedTrack.phrases} distinct phrasing blocks available for intelligent auto-transitioning.
                      </p>
                    </div>

                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground opacity-50">
                    <Music className="w-16 h-16 mb-4" />
                    <p>No track selected</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  )
}
