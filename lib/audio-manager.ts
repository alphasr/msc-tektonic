// Production-ready audio manager with Web Audio API
// Handles real-time effects, EQ, volume, and crossfader

import { Howl } from "howler"

export interface EQSettings {
  low: number // -12 to +12 dB
  mid: number // -12 to +12 dB
  high: number // -12 to +12 dB
}

export class AudioManager {
  private audioContext: AudioContext
  private masterGain: GainNode
  private deckA: DeckAudio | null = null
  private deckB: DeckAudio | null = null
  private crossfaderValue: number = 0
  private disposed: boolean = false

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.masterGain = this.audioContext.createGain()
    this.masterGain.connect(this.audioContext.destination)
    this.masterGain.gain.value = 0.5 // Default master volume
  }

  createDeck(id: "A" | "B"): DeckAudio {
    // Check if AudioContext is still valid
    if (this.audioContext.state === "closed") {
      // Recreate AudioContext if it was closed
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.connect(this.audioContext.destination)
      this.masterGain.gain.value = 0.5
      this.disposed = false
    }
    
    if (id === "A" && this.deckA) {
      this.deckA.dispose()
    }
    if (id === "B" && this.deckB) {
      this.deckB.dispose()
    }

    const deck = new DeckAudio(this.audioContext, this.masterGain, id)
    
    if (id === "A") {
      this.deckA = deck
    } else {
      this.deckB = deck
    }

    this.updateCrossfader()
    return deck
  }

  setCrossfader(value: number) {
    this.crossfaderValue = value
    this.updateCrossfader()
  }

  setMasterVolume(volume: number) {
    this.masterGain.gain.value = volume / 100
  }

  private updateCrossfader() {
    if (this.deckA && this.deckB) {
      if (this.crossfaderValue < 0) {
        // Fade to A
        const aGain = 1.0
        const bGain = (100 + this.crossfaderValue) / 100
        this.deckA.setCrossfaderGain(aGain)
        this.deckB.setCrossfaderGain(bGain)
      } else if (this.crossfaderValue > 0) {
        // Fade to B
        const aGain = (100 - this.crossfaderValue) / 100
        const bGain = 1.0
        this.deckA.setCrossfaderGain(aGain)
        this.deckB.setCrossfaderGain(bGain)
      } else {
        // Center
        this.deckA.setCrossfaderGain(1.0)
        this.deckB.setCrossfaderGain(1.0)
      }
    }
  }

  dispose() {
    if (this.disposed) return // Already disposed
    
    if (this.deckA) {
      this.deckA.dispose()
      this.deckA = null
    }
    if (this.deckB) {
      this.deckB.dispose()
      this.deckB = null
    }
    
    // Only close AudioContext if it's not already closed
    if (this.audioContext.state !== "closed") {
      this.audioContext.close().catch((error) => {
        // Ignore errors if context is already closing/closed
        console.warn("Error closing AudioContext:", error)
      })
    }
    
    this.disposed = true
  }
}

class DeckAudio {
  private audioContext: AudioContext
  private masterGain: GainNode
  private howl: Howl | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private lowFilter: BiquadFilterNode
  private midFilter: BiquadFilterNode
  private highFilter: BiquadFilterNode
  private volumeGain: GainNode
  private crossfaderGain: GainNode
  private deckGain: GainNode
  private deckId: "A" | "B"

  constructor(audioContext: AudioContext, masterGain: GainNode, deckId: "A" | "B") {
    this.audioContext = audioContext
    this.masterGain = masterGain
    this.deckId = deckId

    // Create filter chain
    this.lowFilter = audioContext.createBiquadFilter()
    this.lowFilter.type = "lowshelf"
    this.lowFilter.frequency.value = 200
    this.lowFilter.gain.value = 0

    this.midFilter = audioContext.createBiquadFilter()
    this.midFilter.type = "peaking"
    this.midFilter.frequency.value = 1000
    this.midFilter.Q.value = 1
    this.midFilter.gain.value = 0

    this.highFilter = audioContext.createBiquadFilter()
    this.highFilter.type = "highshelf"
    this.highFilter.frequency.value = 5000
    this.highFilter.gain.value = 0

    // Create gain nodes
    this.volumeGain = audioContext.createGain()
    this.crossfaderGain = audioContext.createGain()
    this.deckGain = audioContext.createGain()

    // Connect: filters -> volume -> crossfader -> deck -> master
    this.lowFilter.connect(this.midFilter)
    this.midFilter.connect(this.highFilter)
    this.highFilter.connect(this.volumeGain)
    this.volumeGain.connect(this.crossfaderGain)
    this.crossfaderGain.connect(this.deckGain)
    this.deckGain.connect(masterGain)

    // Set initial values
    this.volumeGain.gain.value = 0.5
    this.crossfaderGain.gain.value = 1.0
    this.deckGain.gain.value = 1.0
  }

  load(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.howl) {
        this.howl.unload()
        this.howl = null
      }
      if (this.sourceNode) {
        this.sourceNode.disconnect()
        this.sourceNode = null
      }

      console.log(`Loading audio from: ${url}`)

      this.howl = new Howl({
        src: [url],
        html5: true,
        format: ["mp3", "wav", "ogg", "m4a", "flac"],
        preload: true,
        onload: () => {
          console.log(`✅ Audio loaded successfully: ${url}`)
          // Connect to Web Audio API after first play
          const connectAudio = () => {
            if (!this.sourceNode && this.howl) {
              // Access Howler's internal audio node
              const howlAny = this.howl as any
              if (howlAny._sounds && howlAny._sounds[0]) {
                const sound = howlAny._sounds[0]
                const htmlAudio = sound._node as HTMLAudioElement

                if (htmlAudio) {
                  try {
                    this.sourceNode = this.audioContext.createMediaElementSource(htmlAudio)
                    this.sourceNode.connect(this.lowFilter)
                    console.log(`✅ Audio connected to Web Audio API`)
                  } catch (error) {
                    // Already connected, ignore
                    console.warn("Audio source already connected:", error)
                  }
                }
              }
            }
          }
          
          // Try to connect on first play
          if (this.howl) {
            this.howl.once("play", connectAudio)
          }
          resolve()
        },
        onloaderror: (id: number, error: any) => {
          console.error(`❌ Failed to load audio from ${url}:`, error)
          reject(new Error(`Failed to load audio: ${error || "Unknown error"}`))
        },
        onplayerror: (id: number, error: any) => {
          console.error(`❌ Play error for ${url}:`, error)
          reject(new Error(`Play error: ${error || "Unknown error"}`))
        },
      })
    })
  }

  play() {
    if (this.howl) {
      this.howl.play()
    }
  }

  pause() {
    if (this.howl) {
      this.howl.pause()
    }
  }

  stop() {
    if (this.howl) {
      this.howl.stop()
    }
  }

  seek(time: number) {
    if (this.howl) {
      this.howl.seek(time)
    }
  }

  getCurrentTime(): number {
    if (this.howl) {
      return (this.howl.seek() as number) || 0
    }
    return 0
  }

  getDuration(): number {
    if (this.howl) {
      return this.howl.duration() || 0
    }
    return 0
  }

  isPlaying(): boolean {
    return this.howl ? this.howl.playing() : false
  }

  setVolume(volume: number) {
    // Volume: 0-100 -> 0-1
    this.volumeGain.gain.value = volume / 100
  }

  setEQ(eq: EQSettings) {
    this.lowFilter.gain.value = eq.low
    this.midFilter.gain.value = eq.mid
    this.highFilter.gain.value = eq.high
  }

  setCrossfaderGain(gain: number) {
    this.crossfaderGain.gain.value = gain
  }

  on(event: string, callback: () => void) {
    if (this.howl) {
      this.howl.on(event, callback)
    }
  }

  off(event: string, callback?: () => void) {
    if (this.howl) {
      this.howl.off(event, callback)
    }
  }

  dispose() {
    if (this.howl) {
      this.howl.unload()
      this.howl = null
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }
  }
}

// Singleton instance
let audioManagerInstance: AudioManager | null = null

export function getAudioManager(): AudioManager {
  // If instance exists but is disposed, create a new one
  if (audioManagerInstance && (audioManagerInstance as any).disposed) {
    audioManagerInstance = null
  }
  
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager()
  }
  return audioManagerInstance
}

