"use client"

import { useState, useEffect, useRef } from "react"
import Navigation from "@/components/Navigation"
import StatusBar from "@/components/StatusBar"
import Deck from "@/components/Deck"
import CentralMixer from "@/components/CentralMixer"
import TrackLibrary from "@/components/TrackLibrary"
import EnergyAnalytics from "@/components/EnergyAnalytics"
import { Track, DeckState, MixerState, SystemStatus } from "@/types"
import { getAudioManager, AudioManager } from "@/lib/audio-manager"
import { getMIDIController } from "@/lib/midi-controller"

export default function Home() {
  const [mixerState, setMixerState] = useState<MixerState>({
    deckA: {
      track: null,
      isPlaying: false,
      currentTime: 0,
      volume: 50,
      eq: { low: 0, mid: 0, high: 0 },
    },
    deckB: {
      track: null,
      isPlaying: false,
      currentTime: 0,
      volume: 50,
      eq: { low: 0, mid: 0, high: 0 },
    },
    crossfader: 0,
    masterVolume: 50,
  })

  const [tracks, setTracks] = useState<Track[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: "operational",
    database: "operational",
    storage: "degraded",
    analysis: "operational",
    latency: 4.8,
  })

  const audioManagerRef = useRef<AudioManager | null>(null)
  const deckARef = useRef<ReturnType<AudioManager["createDeck"]> | null>(null)
  const deckBRef = useRef<ReturnType<AudioManager["createDeck"]> | null>(null)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const midiControllerRef = useRef<ReturnType<typeof getMIDIController> | null>(null)

  // Initialize audio manager and MIDI controller
  useEffect(() => {
    audioManagerRef.current = getAudioManager()
    deckARef.current = audioManagerRef.current.createDeck("A")
    deckBRef.current = audioManagerRef.current.createDeck("B")

    // Initialize MIDI controller
    midiControllerRef.current = getMIDIController()
    midiControllerRef.current.initialize().then((success) => {
      if (success) {
        console.log("MIDI controller connected")
        // Setup handlers after a short delay to ensure function is defined
        setTimeout(() => {
          if (midiControllerRef.current && midiControllerRef.current.getInitialized()) {
            setupMIDIHandlers()
          }
        }, 200)
      } else {
        console.warn("MIDI controller not available")
      }
    })

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }
      // Don't dispose audio manager on unmount - it's a singleton
      // Only dispose decks if needed
      if (deckARef.current) {
        deckARef.current.dispose()
        deckARef.current = null
      }
      if (deckBRef.current) {
        deckBRef.current.dispose()
        deckBRef.current = null
      }
      if (midiControllerRef.current) {
        midiControllerRef.current.dispose()
        midiControllerRef.current = null
      }
    }
  }, [])

  // Handler functions (must be defined before MIDI setup)
  const handlePlay = (deck: "A" | "B") => {
    const deckRef = deck === "A" ? deckARef.current : deckBRef.current
    if (deckRef) {
      deckRef.play()
      setMixerState((prev) => ({
        ...prev,
        [deck === "A" ? "deckA" : "deckB"]: {
          ...prev[deck === "A" ? "deckA" : "deckB"],
          isPlaying: true,
        },
      }))
    }
  }

  const handlePause = (deck: "A" | "B") => {
    const deckRef = deck === "A" ? deckARef.current : deckBRef.current
    if (deckRef) {
      deckRef.pause()
      setMixerState((prev) => ({
        ...prev,
        [deck === "A" ? "deckA" : "deckB"]: {
          ...prev[deck === "A" ? "deckA" : "deckB"],
          isPlaying: false,
        },
      }))
    }
  }

  const handleStop = (deck: "A" | "B") => {
    const deckRef = deck === "A" ? deckARef.current : deckBRef.current
    if (deckRef) {
      deckRef.stop()
      setMixerState((prev) => ({
        ...prev,
        [deck === "A" ? "deckA" : "deckB"]: {
          ...prev[deck === "A" ? "deckA" : "deckB"],
          isPlaying: false,
          currentTime: 0,
        },
      }))
    }
  }

  const handleCue = (deck: "A" | "B") => {
    const deckRef = deck === "A" ? deckARef.current : deckBRef.current
    if (deckRef) {
      deckRef.seek(0)
      deckRef.pause()
      setMixerState((prev) => ({
        ...prev,
        [deck === "A" ? "deckA" : "deckB"]: {
          ...prev[deck === "A" ? "deckA" : "deckB"],
          isPlaying: false,
          currentTime: 0,
        },
      }))
    }
  }

  // Setup MIDI event handlers (defined after handler functions)
  const setupMIDIHandlers = () => {
    if (!midiControllerRef.current || !midiControllerRef.current.getInitialized()) {
      console.warn("MIDI not initialized yet, cannot setup handlers")
      return
    }

    const midi = midiControllerRef.current
    console.log("Setting up MIDI handlers...")

    // Deck A controls
    const handleDeckAPlay = () => handlePlay("A")
    const handleDeckAPause = () => handlePause("A")
    const handleDeckAStop = () => handleStop("A")
    const handleDeckACue = () => handleCue("A")
    const handleDeckAVolume = (value: number) => {
      setMixerState((prev) => ({
        ...prev,
        deckA: { ...prev.deckA, volume: value },
      }))
      if (deckARef.current) {
        deckARef.current.setVolume(value)
      }
    }
    const handleDeckALow = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckA: { ...prev.deckA, eq: { ...prev.deckA.eq, low: value } },
        }
        if (deckARef.current) {
          deckARef.current.setEQ(newState.deckA.eq)
        }
        return newState
      })
    }
    const handleDeckAMid = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckA: { ...prev.deckA, eq: { ...prev.deckA.eq, mid: value } },
        }
        if (deckARef.current) {
          deckARef.current.setEQ(newState.deckA.eq)
        }
        return newState
      })
    }
    const handleDeckAHigh = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckA: { ...prev.deckA, eq: { ...prev.deckA.eq, high: value } },
        }
        if (deckARef.current) {
          deckARef.current.setEQ(newState.deckA.eq)
        }
        return newState
      })
    }

    // Deck B controls
    const handleDeckBPlay = () => handlePlay("B")
    const handleDeckBPause = () => handlePause("B")
    const handleDeckBStop = () => handleStop("B")
    const handleDeckBCue = () => handleCue("B")
    const handleDeckBVolume = (value: number) => {
      setMixerState((prev) => ({
        ...prev,
        deckB: { ...prev.deckB, volume: value },
      }))
      if (deckBRef.current) {
        deckBRef.current.setVolume(value)
      }
    }
    const handleDeckBLow = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckB: { ...prev.deckB, eq: { ...prev.deckB.eq, low: value } },
        }
        if (deckBRef.current) {
          deckBRef.current.setEQ(newState.deckB.eq)
        }
        return newState
      })
    }
    const handleDeckBMid = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckB: { ...prev.deckB, eq: { ...prev.deckB.eq, mid: value } },
        }
        if (deckBRef.current) {
          deckBRef.current.setEQ(newState.deckB.eq)
        }
        return newState
      })
    }
    const handleDeckBHigh = (value: number) => {
      setMixerState((prev) => {
        const newState = {
          ...prev,
          deckB: { ...prev.deckB, eq: { ...prev.deckB.eq, high: value } },
        }
        if (deckBRef.current) {
          deckBRef.current.setEQ(newState.deckB.eq)
        }
        return newState
      })
    }

    // Mixer controls
    const handleCrossfader = (value: number) => {
      setMixerState((prev) => ({ ...prev, crossfader: value }))
      if (audioManagerRef.current) {
        audioManagerRef.current.setCrossfader(value)
      }
    }
    const handleMasterVolume = (value: number) => {
      setMixerState((prev) => ({ ...prev, masterVolume: value }))
      if (audioManagerRef.current) {
        audioManagerRef.current.setMasterVolume(value)
      }
    }

    // Jogwheel controls
    const handleJogwheelA = (value: number) => {
      if (deckARef.current && deckARef.current.isPlaying()) {
        const currentTime = deckARef.current.getCurrentTime()
        const newTime = currentTime + value * 0.1
        deckARef.current.seek(Math.max(0, newTime))
      }
    }
    const handleJogwheelB = (value: number) => {
      if (deckBRef.current && deckBRef.current.isPlaying()) {
        const currentTime = deckBRef.current.getCurrentTime()
        const newTime = currentTime + value * 0.1
        deckBRef.current.seek(Math.max(0, newTime))
      }
    }

    // Hot Cue handlers (placeholder - can be extended later)
    const handleHotCue = (deck: "A" | "B", cueNumber: number) => {
      console.log(`🎯 Hot Cue ${cueNumber} pressed on Deck ${deck}`)
      // TODO: Implement hot cue functionality
      // This would set/trigger cue points at specific positions
    }

    // Loop handlers (placeholder - can be extended later)
    const handleLoop = (deck: "A" | "B", loopType: string) => {
      console.log(`🔁 Loop ${loopType} on Deck ${deck}`)
      // TODO: Implement loop functionality
      // This would create/manage loops at current position
    }

    // Register all handlers
    // Transport controls
    midi.on("deckA_play", handleDeckAPlay)
    midi.on("deckA_pause", handleDeckAPause)
    midi.on("deckA_stop", handleDeckAStop)
    midi.on("deckA_cue", handleDeckACue)
    midi.on("deckB_play", handleDeckBPlay)
    midi.on("deckB_pause", handleDeckBPause)
    midi.on("deckB_stop", handleDeckBStop)
    midi.on("deckB_cue", handleDeckBCue)
    
    // Volume and EQ
    midi.on("deckA_volume", handleDeckAVolume)
    midi.on("deckA_low", handleDeckALow)
    midi.on("deckA_mid", handleDeckAMid)
    midi.on("deckA_high", handleDeckAHigh)
    midi.on("deckB_volume", handleDeckBVolume)
    midi.on("deckB_low", handleDeckBLow)
    midi.on("deckB_mid", handleDeckBMid)
    midi.on("deckB_high", handleDeckBHigh)
    
    // Mixer
    midi.on("crossfader", handleCrossfader)
    midi.on("masterVolume", handleMasterVolume)
    
    // Jogwheels
    midi.on("jogwheelA", handleJogwheelA)
    midi.on("jogwheelB", handleJogwheelB)
    
    // Hot Cues
    midi.on("deckA_hotcue1", () => handleHotCue("A", 1))
    midi.on("deckA_hotcue2", () => handleHotCue("A", 2))
    midi.on("deckA_hotcue3", () => handleHotCue("A", 3))
    midi.on("deckA_hotcue4", () => handleHotCue("A", 4))
    midi.on("deckB_hotcue1", () => handleHotCue("B", 1))
    midi.on("deckB_hotcue2", () => handleHotCue("B", 2))
    midi.on("deckB_hotcue3", () => handleHotCue("B", 3))
    midi.on("deckB_hotcue4", () => handleHotCue("B", 4))
    
    // Loops
    midi.on("deckA_loopIn", () => handleLoop("A", "In"))
    midi.on("deckA_loopOut", () => handleLoop("A", "Out"))
    midi.on("deckA_loopRel", () => handleLoop("A", "Rel"))
    midi.on("deckA_loop2x", () => handleLoop("A", "2x"))
    midi.on("deckA_loop4x", () => handleLoop("A", "4x"))
    midi.on("deckA_loop8x", () => handleLoop("A", "8x"))
    midi.on("deckB_loopIn", () => handleLoop("B", "In"))
    midi.on("deckB_loopOut", () => handleLoop("B", "Out"))
    midi.on("deckB_loopRel", () => handleLoop("B", "Rel"))
    midi.on("deckB_loop2x", () => handleLoop("B", "2x"))
    midi.on("deckB_loop4x", () => handleLoop("B", "4x"))
    midi.on("deckB_loop8x", () => handleLoop("B", "8x"))
    
    console.log("✅ All MIDI handlers registered successfully!")
  }

  // Also try to setup on mount if already initialized
  useEffect(() => {
    if (midiControllerRef.current && midiControllerRef.current.getInitialized()) {
      setupMIDIHandlers()
    }
  }, [])

  useEffect(() => {
    fetchTracks()
    fetchSystemStatus()

    const interval = setInterval(() => {
      fetchTracks()
    }, 30000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    updateProgress()
  }, [mixerState.deckA.isPlaying, mixerState.deckB.isPlaying])

  const fetchTracks = async () => {
    try {
      const response = await fetch("/api/tracks")
      if (response.ok) {
        const data = await response.json()
        console.log("Fetched tracks:", data.length, "tracks")
        setTracks(data)
      } else {
        console.error("Failed to fetch tracks: HTTP", response.status)
        const errorData = await response.json().catch(() => ({}))
        console.error("Error details:", errorData)
        setTracks([])
      }
    } catch (error) {
      console.error("Failed to fetch tracks:", error)
      setTracks([])
    }
  }

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch("/api/status")
      const data = await response.json()
      setSystemStatus(data)
    } catch (error) {
      console.error("Failed to fetch status:", error)
    }
  }

  const updateProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current)
    }

    progressInterval.current = setInterval(() => {
      setMixerState((prev) => {
        const newState = { ...prev }
        if (deckARef.current) {
          newState.deckA.isPlaying = deckARef.current.isPlaying()
          newState.deckA.currentTime = deckARef.current.getCurrentTime()
        }
        if (deckBRef.current) {
          newState.deckB.isPlaying = deckBRef.current.isPlaying()
          newState.deckB.currentTime = deckBRef.current.getCurrentTime()
        }
        return newState
      })
    }, 100)
  }

  const loadTrack = async (track: Track, deck: "A" | "B") => {
    const deckRef = deck === "A" ? deckARef.current : deckBRef.current
    if (!deckRef) {
      console.error(`Deck ${deck} not initialized`)
      alert(`Deck ${deck} is not ready. Please refresh the page.`)
      return
    }

    try {
      console.log(`Loading track "${track.title}" into Deck ${deck}...`)
      
      // Update state immediately to show loading
      setMixerState((prev) => ({
        ...prev,
        [deck === "A" ? "deckA" : "deckB"]: {
          ...prev[deck === "A" ? "deckA" : "deckB"],
          track,
          currentTime: 0,
          isPlaying: false,
        },
      }))

      const audioUrl = `/api/audio/${track.id}`
      await deckRef.load(audioUrl)
      
      // Set up event handlers
      deckRef.on("end", () => {
        setMixerState((prev) => ({
          ...prev,
          [deck === "A" ? "deckA" : "deckB"]: {
            ...prev[deck === "A" ? "deckA" : "deckB"],
            isPlaying: false,
            currentTime: 0,
          },
        }))
      })

      // Apply current settings
      const deckState = deck === "A" ? mixerState.deckA : mixerState.deckB
      deckRef.setVolume(deckState.volume)
      deckRef.setEQ(deckState.eq)

      console.log(`✅ Track "${track.title}" loaded successfully into Deck ${deck}`)
    } catch (error: any) {
      console.error(`❌ Failed to load track on deck ${deck}:`, error)
      const errorMessage = error?.message || "Unknown error"
      alert(`Failed to load track "${track.title}": ${errorMessage}\n\nMake sure the track has been analyzed and the audio file exists.`)
      
      // Clear the track from state on error
      setMixerState((prev) => ({
        ...prev,
        [deck === "A" ? "deckA" : "deckB"]: {
          ...prev[deck === "A" ? "deckA" : "deckB"],
          track: null,
          isPlaying: false,
          currentTime: 0,
        },
      }))
    }
  }

  const handleEject = (deck: "A" | "B") => {
    const deckRef = deck === "A" ? deckARef.current : deckBRef.current
    if (deckRef) {
      deckRef.dispose()
      if (deck === "A") {
        deckARef.current = audioManagerRef.current?.createDeck("A") || null
      } else {
        deckBRef.current = audioManagerRef.current?.createDeck("B") || null
      }
      setMixerState((prev) => ({
        ...prev,
        [deck === "A" ? "deckA" : "deckB"]: {
          track: null,
          isPlaying: false,
          currentTime: 0,
          volume: prev[deck === "A" ? "deckA" : "deckB"].volume,
          eq: prev[deck === "A" ? "deckA" : "deckB"].eq,
        },
      }))
    }
  }

  const handleSeek = (deck: "A" | "B", time: number) => {
    const deckRef = deck === "A" ? deckARef.current : deckBRef.current
    if (deckRef) {
      deckRef.seek(time)
      setMixerState((prev) => ({
        ...prev,
        [deck === "A" ? "deckA" : "deckB"]: {
          ...prev[deck === "A" ? "deckA" : "deckB"],
          currentTime: time,
        },
      }))
    }
  }

  // Apply volume changes
  useEffect(() => {
    if (deckARef.current) {
      deckARef.current.setVolume(mixerState.deckA.volume)
    }
    if (deckBRef.current) {
      deckBRef.current.setVolume(mixerState.deckB.volume)
    }
  }, [mixerState.deckA.volume, mixerState.deckB.volume])

  // Apply EQ changes
  useEffect(() => {
    if (deckARef.current) {
      deckARef.current.setEQ(mixerState.deckA.eq)
    }
    if (deckBRef.current) {
      deckBRef.current.setEQ(mixerState.deckB.eq)
    }
  }, [mixerState.deckA.eq, mixerState.deckB.eq])

  // Apply crossfader
  useEffect(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setCrossfader(mixerState.crossfader)
    }
  }, [mixerState.crossfader])

  // Apply master volume
  useEffect(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setMasterVolume(mixerState.masterVolume)
    }
  }, [mixerState.masterVolume])

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Navigation />
      <StatusBar status={systemStatus} onRetry={fetchSystemStatus} />
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full flex flex-col gap-1.5 p-1.5">
          {/* Top Row: Decks and Mixer */}
          <div className="flex-1 grid grid-cols-3 gap-1.5 min-h-0 overflow-hidden">
            <div className="min-w-0 overflow-hidden">
              <Deck
                deck={mixerState.deckA}
                deckName="A"
                onPlay={() => handlePlay("A")}
                onPause={() => handlePause("A")}
                onStop={() => handleStop("A")}
                onCue={() => handleCue("A")}
                onLoadTrack={() => {}}
                onEject={() => handleEject("A")}
                onSeek={(time) => handleSeek("A", time)}
              />
            </div>
            <div className="min-w-0 overflow-hidden">
              <CentralMixer
                deckA={mixerState.deckA}
                deckB={mixerState.deckB}
                masterVolume={mixerState.masterVolume}
                crossfader={mixerState.crossfader}
                onDeckAVolumeChange={(volume) =>
                  setMixerState((prev) => ({
                    ...prev,
                    deckA: { ...prev.deckA, volume },
                  }))
                }
                onDeckBVolumeChange={(volume) =>
                  setMixerState((prev) => ({
                    ...prev,
                    deckB: { ...prev.deckB, volume },
                  }))
                }
                onMasterVolumeChange={(volume) =>
                  setMixerState((prev) => ({ ...prev, masterVolume: volume }))
                }
                onCrossfaderChange={(value) =>
                  setMixerState((prev) => ({ ...prev, crossfader: value }))
                }
                onDeckAEQChange={(band, value) =>
                  setMixerState((prev) => ({
                    ...prev,
                    deckA: {
                      ...prev.deckA,
                      eq: { ...prev.deckA.eq, [band]: value },
                    },
                  }))
                }
                onDeckBEQChange={(band, value) =>
                  setMixerState((prev) => ({
                    ...prev,
                    deckB: {
                      ...prev.deckB,
                      eq: { ...prev.deckB.eq, [band]: value },
                    },
                  }))
                }
              />
            </div>
            <div className="min-w-0 overflow-hidden">
              <Deck
                deck={mixerState.deckB}
                deckName="B"
                onPlay={() => handlePlay("B")}
                onPause={() => handlePause("B")}
                onStop={() => handleStop("B")}
                onCue={() => handleCue("B")}
                onLoadTrack={() => {}}
                onEject={() => handleEject("B")}
                onSeek={(time) => handleSeek("B", time)}
              />
            </div>
          </div>
          {/* Bottom Row: Library and Analytics */}
          <div className="grid grid-cols-2 gap-1.5 h-[240px] flex-shrink-0 overflow-hidden">
            <div className="min-w-0 min-h-0 overflow-hidden">
              <TrackLibrary tracks={tracks} onLoadTrack={loadTrack} onRefresh={fetchTracks} />
            </div>
            <div className="min-w-0 min-h-0 overflow-hidden">
              <EnergyAnalytics deckA={mixerState.deckA} deckB={mixerState.deckB} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
