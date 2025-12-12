// MIDI Controller Integration for DJ Mixer
// Maps MIDI CC and Note messages to mixer controls

export interface MIDIMapping {
  // Deck A Controls
  deckA_play?: number // Note
  deckA_pause?: number // Note
  deckA_stop?: number // Note
  deckA_cue?: number // Note
  deckA_volume?: number // CC
  deckA_low?: number // CC
  deckA_mid?: number // CC
  deckA_high?: number // CC
  deckA_hotcue1?: number // Note
  deckA_hotcue2?: number // Note
  deckA_hotcue3?: number // Note
  deckA_hotcue4?: number // Note
  deckA_loopIn?: number // Note
  deckA_loopOut?: number // Note
  deckA_loopRel?: number // Note
  deckA_loop2x?: number // Note
  deckA_loop4x?: number // Note
  deckA_loop8x?: number // Note
  deckA_jogwheel?: number // CC or Pitch Bend
  
  // Deck B Controls
  deckB_play?: number // Note
  deckB_pause?: number // Note
  deckB_stop?: number // Note
  deckB_cue?: number // Note
  deckB_volume?: number // CC
  deckB_low?: number // CC
  deckB_mid?: number // CC
  deckB_high?: number // CC
  deckB_hotcue1?: number // Note
  deckB_hotcue2?: number // Note
  deckB_hotcue3?: number // Note
  deckB_hotcue4?: number // Note
  deckB_loopIn?: number // Note
  deckB_loopOut?: number // Note
  deckB_loopRel?: number // Note
  deckB_loop2x?: number // Note
  deckB_loop4x?: number // Note
  deckB_loop8x?: number // Note
  deckB_jogwheel?: number // CC or Pitch Bend
  
  // Mixer Controls
  crossfader?: number // CC
  masterVolume?: number // CC
  gainA?: number // CC
  gainB?: number // CC
  
  // Effects (if available)
  fx1?: number // CC
  fx2?: number // CC
  fx3?: number // CC
}

export type MIDIControlCallback = (value: number, control: string) => void

export class MIDIController {
  private access: MIDIAccess | null = null
  private inputs: MIDIInput[] = []
  private callbacks: Map<string, MIDIControlCallback[]> = new Map()
  private mapping: MIDIMapping = {}
  private isInitialized = false
  private unmappedCCs: Set<string> = new Set() // Track unmapped CCs to reduce log spam
  private startTime: number = Date.now() // Track initialization time for debug logging

  // Default mapping (Traktor-style)
  // Numark Party Mix MKII uses different CC numbers - will be auto-detected
  private defaultMapping: MIDIMapping = {
    // Deck A - Numark Party Mix MKII typical mapping
    deckA_play: 0x24, // Note 36 (C2) - Play button
    deckA_pause: 0x25, // Note 37 (C#2) - Pause button
    deckA_stop: 0x26, // Note 38 (D2) - Stop button
    deckA_cue: 0x27, // Note 39 (D#2) - Cue button
    deckA_volume: 0x01, // CC 1 - Volume fader (may vary)
    deckA_low: 0x0A, // CC 10 - Low EQ
    deckA_mid: 0x0B, // CC 11 - Mid EQ
    deckA_high: 0x0C, // CC 12 - High EQ
    
    // Deck B - Numark Party Mix MKII typical mapping
    deckB_play: 0x2C, // Note 44 (E2) - Play button
    deckB_pause: 0x2D, // Note 45 (F2) - Pause button
    deckB_stop: 0x2E, // Note 46 (F#2) - Stop button
    deckB_cue: 0x2F, // Note 47 (G2) - Cue button
    deckB_volume: 0x02, // CC 2 - Volume fader (may vary)
    deckB_low: 0x0D, // CC 13 - Low EQ
    deckB_mid: 0x0E, // CC 14 - Mid EQ
    deckB_high: 0x0F, // CC 15 - High EQ
    
    // Mixer
    crossfader: 0x10, // CC 16 - Crossfader
    masterVolume: 0x11, // CC 17 - Master volume
  }

  constructor(mapping?: MIDIMapping) {
    this.mapping = { ...this.defaultMapping, ...mapping }
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true

    try {
      if (!navigator.requestMIDIAccess) {
        console.warn("Web MIDI API not supported in this browser")
        return false
      }

      this.access = await navigator.requestMIDIAccess({ sysex: false })
      this.setupInputs()

      this.access.onstatechange = () => {
        this.setupInputs()
      }

      this.isInitialized = true
      console.log(`MIDI Controller initialized with ${this.inputs.length} input(s)`)
      return true
    } catch (error) {
      console.error("Failed to initialize MIDI:", error)
      return false
    }
  }

  private setupInputs() {
    if (!this.access) return

    this.inputs = []
    const inputIterator = this.access.inputs.values()

    for (const input of inputIterator) {
      input.onmidimessage = (event: Event) => {
        this.handleMIDIMessage(event)
      }
      this.inputs.push(input)
      console.log(`🎹 MIDI Input: ${input.name} (${input.manufacturer || "Unknown"})`)
      console.log(`🎹 MIDI Input state: ${input.state}`)
    }
    
    if (this.inputs.length === 0) {
      console.warn("⚠️ No MIDI inputs found!")
    } else {
      console.log(`✅ ${this.inputs.length} MIDI input(s) ready - try moving faders or pressing buttons!`)
    }
  }

  private handleMIDIMessage(event: Event) {
    try {
      const midiEvent = event as any
      if (!midiEvent || !midiEvent.data) {
        console.warn("Invalid MIDI event:", event)
        return
      }
      
      const [status, data1, data2] = midiEvent.data
      const messageType = status & 0xf0
      const channel = status & 0x0f

      // Debug logging for unmapped controls (reduced spam)
      // Log all messages for first 10 seconds to help identify controls
      const shouldLog = Date.now() - (this as any).startTime < 10000
      if (shouldLog && messageType === 0xb0) {
        console.log(`🎹 MIDI: type=0x${messageType.toString(16).padStart(2, '0')} ch=${channel} CC=${data1} value=${data2}`)
      }

      // Note On/Off (0x90-0x9F)
      if (messageType === 0x90 || messageType === 0x80) {
        const note = data1
        const velocity = messageType === 0x90 ? data2 : 0
        
        // Map notes to controls (with channel awareness)
        this.mapNoteToControl(note, velocity > 0, channel)
      }
      
      // Control Change (0xB0-0xBF)
      else if (messageType === 0xb0) {
        const cc = data1
        const value = data2
        
        // Map CC to controls (with channel awareness)
        this.mapCCToControl(cc, value, channel)
      }
      
      // Pitch Bend (0xE0-0xEF) - for jogwheels
      else if (messageType === 0xe0) {
        const lsb = data1
        const msb = data2
        const value = ((msb << 7) | lsb) - 8192 // -8192 to 8191, center at 0
        
        console.log(`MIDI Pitch Bend: channel=${channel} value=${value}`)
        // Map to jogwheel based on channel
        if (channel === 0) {
          this.triggerCallback("jogwheelA", value / 8192) // Normalize to -1 to 1
        } else if (channel === 1) {
          this.triggerCallback("jogwheelB", value / 8192)
        }
      }
    } catch (error) {
      console.error("Error handling MIDI message:", error)
    }
  }

  private mapNoteToControl(note: number, pressed: boolean, channel: number = 0) {
    if (!pressed) return // Only trigger on press, not release

    // Numark Party Mix MKII Complete Mapping
    // Channel 0 = Deck A, Channel 1 = Deck B
    
    // ===== DECK A (Channel 0) =====
    if (channel === 0) {
      // Transport Controls (typical Numark mapping)
      if (note === 36) { // C2
        console.log("✅ Deck A Play")
        this.triggerCallback("deckA_play", 1)
        return
      }
      if (note === 37) { // C#2
        console.log("✅ Deck A Pause")
        this.triggerCallback("deckA_pause", 1)
        return
      }
      if (note === 38) { // D2
        console.log("✅ Deck A Stop")
        this.triggerCallback("deckA_stop", 1)
        return
      }
      if (note === 39) { // D#2
        console.log("✅ Deck A Cue")
        this.triggerCallback("deckA_cue", 1)
        return
      }
      // Hot Cues (typically pads 1-4)
      if (note === 40) { // E2
        this.triggerCallback("deckA_hotcue1", 1)
        return
      }
      if (note === 41) { // F2
        this.triggerCallback("deckA_hotcue2", 1)
        return
      }
      if (note === 42) { // F#2
        this.triggerCallback("deckA_hotcue3", 1)
        return
      }
      if (note === 43) { // G2
        this.triggerCallback("deckA_hotcue4", 1)
        return
      }
      // Loop Controls
      if (note === 48) { // C3
        this.triggerCallback("deckA_loopIn", 1)
        return
      }
      if (note === 49) { // C#3
        this.triggerCallback("deckA_loopOut", 1)
        return
      }
      if (note === 50) { // D3
        this.triggerCallback("deckA_loopRel", 1)
        return
      }
      if (note === 51) { // D#3
        this.triggerCallback("deckA_loop2x", 1)
        return
      }
      if (note === 52) { // E3
        this.triggerCallback("deckA_loop4x", 1)
        return
      }
      if (note === 53) { // F3
        this.triggerCallback("deckA_loop8x", 1)
        return
      }
      // Note 6 on channel 0 (from your logs)
      if (note === 6) {
        console.log("✅ Deck A Button (Note 6)")
        this.triggerCallback("deckA_cue", 1)
        return
      }
    }
    
    // ===== DECK B (Channel 1) =====
    if (channel === 1) {
      // Transport Controls
      if (note === 44) { // E2
        console.log("✅ Deck B Play")
        this.triggerCallback("deckB_play", 1)
        return
      }
      if (note === 45) { // F2
        console.log("✅ Deck B Pause")
        this.triggerCallback("deckB_pause", 1)
        return
      }
      if (note === 46) { // F#2
        console.log("✅ Deck B Stop")
        this.triggerCallback("deckB_stop", 1)
        return
      }
      if (note === 47) { // G2
        console.log("✅ Deck B Cue")
        this.triggerCallback("deckB_cue", 1)
        return
      }
      // Hot Cues
      if (note === 48) { // C3
        this.triggerCallback("deckB_hotcue1", 1)
        return
      }
      if (note === 49) { // C#3
        this.triggerCallback("deckB_hotcue2", 1)
        return
      }
      if (note === 50) { // D3
        this.triggerCallback("deckB_hotcue3", 1)
        return
      }
      if (note === 51) { // D#3
        this.triggerCallback("deckB_hotcue4", 1)
        return
      }
      // Loop Controls
      if (note === 52) { // E3
        this.triggerCallback("deckB_loopIn", 1)
        return
      }
      if (note === 53) { // F3
        this.triggerCallback("deckB_loopOut", 1)
        return
      }
      if (note === 54) { // F#3
        this.triggerCallback("deckB_loopRel", 1)
        return
      }
      if (note === 55) { // G3
        this.triggerCallback("deckB_loop2x", 1)
        return
      }
      if (note === 56) { // G#3
        this.triggerCallback("deckB_loop4x", 1)
        return
      }
      if (note === 57) { // A3
        this.triggerCallback("deckB_loop8x", 1)
        return
      }
      // Note 6 on channel 1 (from your logs)
      if (note === 6) {
        console.log("✅ Deck B Button (Note 6)")
        this.triggerCallback("deckB_cue", 1)
        return
      }
    }

    // Fallback to mapping-based lookup
    if (note === this.mapping.deckA_play) {
      this.triggerCallback("deckA_play", 1)
    } else if (note === this.mapping.deckA_pause) {
      this.triggerCallback("deckA_pause", 1)
    } else if (note === this.mapping.deckA_stop) {
      this.triggerCallback("deckA_stop", 1)
    } else if (note === this.mapping.deckA_cue) {
      this.triggerCallback("deckA_cue", 1)
    } else if (note === this.mapping.deckB_play) {
      this.triggerCallback("deckB_play", 1)
    } else if (note === this.mapping.deckB_pause) {
      this.triggerCallback("deckB_pause", 1)
    } else if (note === this.mapping.deckB_stop) {
      this.triggerCallback("deckB_stop", 1)
    } else if (note === this.mapping.deckB_cue) {
      this.triggerCallback("deckB_cue", 1)
    } else {
      // Log unmapped notes (only once per unique note)
      const noteKey = `${channel}-${note}`
      if (!this.unmappedCCs.has(noteKey)) {
        this.unmappedCCs.add(noteKey)
        console.log(`⚠️ Note ${note} (ch ${channel}) not mapped yet`)
      }
    }
  }

  private mapCCToControl(cc: number, value: number, channel: number = 0) {
    const normalizedValue = value / 127 // 0-1

    // Numark Party Mix MKII Complete CC Mapping
    // Channel 0 = Deck A, Channel 1 = Deck B
    
    // ===== DECK A (Channel 0) =====
    if (channel === 0) {
      // CC 28 = Deck A Volume Fader (confirmed from your logs)
      if (cc === 28) {
        const volume = normalizedValue * 100
        this.triggerCallback("deckA_volume", volume)
        return
      }
      // Typical Numark EQ mappings
      if (cc === 10) { // Low EQ
        this.triggerCallback("deckA_low", (normalizedValue - 0.5) * 24)
        return
      }
      if (cc === 11) { // Mid EQ
        this.triggerCallback("deckA_mid", (normalizedValue - 0.5) * 24)
        return
      }
      if (cc === 12) { // High EQ
        this.triggerCallback("deckA_high", (normalizedValue - 0.5) * 24)
        return
      }
      // Gain/Trim
      if (cc === 13) {
        this.triggerCallback("gainA", normalizedValue * 100)
        return
      }
      // Jogwheel (if sent as CC)
      if (cc === 14 || cc === 15) {
        const jogValue = (normalizedValue - 0.5) * 2 // -1 to 1
        this.triggerCallback("jogwheelA", jogValue)
        return
      }
    }
    
    // ===== DECK B (Channel 1) =====
    if (channel === 1) {
      // CC 6 = Deck B Button (value 1 or 127 = pressed, from your logs)
      if (cc === 6) {
        if (value === 1 || value === 127) {
          this.triggerCallback("deckB_cue", 1)
        }
        return
      }
      // CC 28 might be Deck B volume (check if it exists)
      if (cc === 28) {
        const volume = normalizedValue * 100
        this.triggerCallback("deckB_volume", volume)
        return
      }
      // Typical Numark EQ mappings
      if (cc === 13) { // Low EQ
        this.triggerCallback("deckB_low", (normalizedValue - 0.5) * 24)
        return
      }
      if (cc === 14) { // Mid EQ
        this.triggerCallback("deckB_mid", (normalizedValue - 0.5) * 24)
        return
      }
      if (cc === 15) { // High EQ
        this.triggerCallback("deckB_high", (normalizedValue - 0.5) * 24)
        return
      }
      // Gain/Trim
      if (cc === 16) {
        this.triggerCallback("gainB", normalizedValue * 100)
        return
      }
      // Jogwheel (if sent as CC)
      if (cc === 17 || cc === 18) {
        const jogValue = (normalizedValue - 0.5) * 2 // -1 to 1
        this.triggerCallback("jogwheelB", jogValue)
        return
      }
    }
    
    // ===== MIXER CONTROLS =====
    // Crossfader - try multiple common mappings (works on any channel)
    // Numark Party Mix MKII crossfader might be on different CC
    if (cc === 16) {
      // CC 16 is the most common for crossfader (works on any channel)
      const crossfaderValue = (normalizedValue - 0.5) * 200 // -100 to +100
      console.log(`✅ Crossfader (CC 16, ch ${channel}) = ${crossfaderValue.toFixed(1)}`)
      this.triggerCallback("crossfader", crossfaderValue)
      return
    }
    // Also check CC 7 (common for crossfader on some Numark controllers)
    if (cc === 7) {
      const crossfaderValue = (normalizedValue - 0.5) * 200
      console.log(`✅ Crossfader (CC 7, ch ${channel}) = ${crossfaderValue.toFixed(1)}`)
      this.triggerCallback("crossfader", crossfaderValue)
      return
    }
    // CC 8 is also sometimes used for crossfader
    if (cc === 8) {
      const crossfaderValue = (normalizedValue - 0.5) * 200
      console.log(`✅ Crossfader (CC 8, ch ${channel}) = ${crossfaderValue.toFixed(1)}`)
      this.triggerCallback("crossfader", crossfaderValue)
      return
    }
    // CC 29 might be crossfader (since CC 28 is Deck A volume)
    if (cc === 29) {
      const crossfaderValue = (normalizedValue - 0.5) * 200
      console.log(`✅ Crossfader (CC 29, ch ${channel}) = ${crossfaderValue.toFixed(1)}`)
      this.triggerCallback("crossfader", crossfaderValue)
      return
    }
    // Master Volume (typically CC 17)
    if (cc === 17 && channel === 0) {
      console.log(`✅ Master Volume = ${(normalizedValue * 100).toFixed(1)}%`)
      this.triggerCallback("masterVolume", normalizedValue * 100)
      return
    }
    
    // ===== FALLBACK TO MAPPING =====
    if (cc === this.mapping.deckA_volume) {
      this.triggerCallback("deckA_volume", normalizedValue * 100)
      return
    }
    if (cc === this.mapping.deckA_low) {
      this.triggerCallback("deckA_low", (normalizedValue - 0.5) * 24)
      return
    }
    if (cc === this.mapping.deckA_mid) {
      this.triggerCallback("deckA_mid", (normalizedValue - 0.5) * 24)
      return
    }
    if (cc === this.mapping.deckA_high) {
      this.triggerCallback("deckA_high", (normalizedValue - 0.5) * 24)
      return
    }
    if (cc === this.mapping.deckB_volume) {
      this.triggerCallback("deckB_volume", normalizedValue * 100)
      return
    }
    if (cc === this.mapping.deckB_low) {
      this.triggerCallback("deckB_low", (normalizedValue - 0.5) * 24)
      return
    }
    if (cc === this.mapping.deckB_mid) {
      this.triggerCallback("deckB_mid", (normalizedValue - 0.5) * 24)
      return
    }
    if (cc === this.mapping.deckB_high) {
      this.triggerCallback("deckB_high", (normalizedValue - 0.5) * 24)
      return
    }
    if (cc === this.mapping.crossfader) {
      const crossfaderValue = (normalizedValue - 0.5) * 200
      this.triggerCallback("crossfader", crossfaderValue)
      return
    }
    if (cc === this.mapping.masterVolume) {
      this.triggerCallback("masterVolume", normalizedValue * 100)
      return
    }
    
    // Unmapped - log for debugging (only once per unique CC to reduce spam)
    const ccKey = `${channel}-${cc}`
    if (!this.unmappedCCs.has(ccKey)) {
      this.unmappedCCs.add(ccKey)
      console.log(`⚠️ CC ${cc} (ch ${channel}) not mapped yet - value=${value}`)
    }
  }

  private triggerCallback(control: string, value: number) {
    const callbacks = this.callbacks.get(control) || []
    callbacks.forEach((callback) => callback(value, control))
  }

  // Register callback for a control
  on(control: string, callback: MIDIControlCallback) {
    if (!this.callbacks.has(control)) {
      this.callbacks.set(control, [])
    }
    this.callbacks.get(control)!.push(callback)
  }

  // Remove callback
  off(control: string, callback: MIDIControlCallback) {
    const callbacks = this.callbacks.get(control)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  // Update mapping
  setMapping(mapping: Partial<MIDIMapping>) {
    this.mapping = { ...this.mapping, ...mapping }
  }

  // Get available MIDI inputs
  getInputs(): MIDIInput[] {
    return [...this.inputs]
  }

  // Check if initialized
  getInitialized(): boolean {
    return this.isInitialized
  }

  // Dispose
  dispose() {
    this.inputs.forEach((input) => {
      input.onmidimessage = null
    })
    this.inputs = []
    this.callbacks.clear()
    this.isInitialized = false
  }
}

// Singleton instance
let midiControllerInstance: MIDIController | null = null

export function getMIDIController(mapping?: MIDIMapping): MIDIController {
  if (!midiControllerInstance) {
    midiControllerInstance = new MIDIController(mapping)
  }
  return midiControllerInstance
}

