// MIDI Controller Integration for DJ Mixer
// Maps MIDI CC and Note messages to mixer controls

import { DetectedController, MIDIMapping } from '@/types';
import { detectController, detectAllControllers } from './controller-detector';
import { loadControllerDatabase } from './controller-database';
import { getDriverInfo, checkDriverStatus } from './driver-detector';

// Re-export MIDIMapping for backward compatibility
export type { MIDIMapping };

export type MIDIControlCallback = (value: number, control: string) => void;

export class MIDIController {
  private access: MIDIAccess | null = null;
  private inputs: MIDIInput[] = [];
  private callbacks: Map<string, MIDIControlCallback[]> = new Map();
  private mapping: MIDIMapping = {};
  private isInitialized = false;
  private unmappedCCs: Set<string> = new Set(); // Track unmapped CCs to reduce log spam
  private startTime: number = Date.now(); // Track initialization time for debug logging
  private detectedControllers: DetectedController[] = [];
  private detectionCallbacks: ((controllers: DetectedController[]) => void)[] =
    [];

  // Default mapping (Traktor-style)
  // Numark Party Mix MKII uses different CC numbers - will be auto-detected
  private defaultMapping: MIDIMapping = {
    // Deck A - Numark Party Mix MKII typical mapping
    deckA_play: 0x24, // Note 36 (C2) - Play button
    deckA_pause: 0x25, // Note 37 (C#2) - Pause button
    deckA_stop: 0x26, // Note 38 (D2) - Stop button
    deckA_cue: 0x27, // Note 39 (D#2) - Cue button
    deckA_volume: 0x01, // CC 1 - Volume fader (may vary)
    deckA_low: 0x0a, // CC 10 - Low EQ
    deckA_mid: 0x0b, // CC 11 - Mid EQ
    deckA_high: 0x0c, // CC 12 - High EQ

    // Deck B - Numark Party Mix MKII typical mapping
    deckB_play: 0x2c, // Note 44 (E2) - Play button
    deckB_pause: 0x2d, // Note 45 (F2) - Pause button
    deckB_stop: 0x2e, // Note 46 (F#2) - Stop button
    deckB_cue: 0x2f, // Note 47 (G2) - Cue button
    deckB_volume: 0x02, // CC 2 - Volume fader (may vary)
    deckB_low: 0x0d, // CC 13 - Low EQ
    deckB_mid: 0x0e, // CC 14 - Mid EQ
    deckB_high: 0x0f, // CC 15 - High EQ

    // Mixer
    crossfader: 0x10, // CC 16 - Crossfader
    masterVolume: 0x11, // CC 17 - Master volume
  };

  constructor(mapping?: MIDIMapping) {
    this.mapping = { ...this.defaultMapping, ...mapping };
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      if (!navigator.requestMIDIAccess) {
        console.warn('Web MIDI API not supported in this browser');
        return false;
      }

      // Load controller database first
      await loadControllerDatabase();

      this.access = await navigator.requestMIDIAccess({ sysex: false });
      await this.setupInputs();

      this.access.onstatechange = () => {
        this.setupInputs();
      };

      this.isInitialized = true;
      console.log(
        `MIDI Controller initialized with ${this.inputs.length} input(s)`
      );

      // Detect controllers after setup
      await this.detectControllers();

      return true;
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
      return false;
    }
  }

  private async setupInputs() {
    if (!this.access) return;

    this.inputs = [];
    const inputIterator = this.access.inputs.values();

    for (const input of inputIterator) {
      input.onmidimessage = (event: Event) => {
        this.handleMIDIMessage(event);
      };
      this.inputs.push(input);
      console.log(
        `🎹 MIDI Input: ${input.name} (${input.manufacturer || 'Unknown'})`
      );
      console.log(`🎹 MIDI Input state: ${input.state}`);
    }

    if (this.inputs.length === 0) {
      console.warn('⚠️ No MIDI inputs found!');
    } else {
      console.log(
        `✅ ${this.inputs.length} MIDI input(s) ready - try moving faders or pressing buttons!`
      );
    }
  }

  /**
   * Detect all connected controllers and apply mappings
   */
  async detectControllers(): Promise<DetectedController[]> {
    if (this.inputs.length === 0) {
      this.detectedControllers = [];
      return [];
    }

    // Detect all controllers
    this.detectedControllers = detectAllControllers(this.inputs);

    // Apply mapping from first detected controller (or use default)
    if (this.detectedControllers.length > 0) {
      const primaryController = this.detectedControllers[0];
      console.log(
        `🎯 Detected controller: ${primaryController.name} (${primaryController.manufacturer}) - Confidence: ${primaryController.confidence}`
      );

      // Load custom mapping from localStorage if exists
      const customMapping = this.loadCustomMapping(primaryController.id);
      if (customMapping) {
        this.setMapping(customMapping);
        console.log(`📝 Applied custom mapping for ${primaryController.name}`);
      } else {
        this.setMapping(primaryController.mapping);
        console.log(`✅ Applied default mapping for ${primaryController.name}`);
      }

      // Check driver status
      const driverStatus = checkDriverStatus(primaryController.id);
      if (driverStatus === 'needed') {
        const driverInfo = getDriverInfo(primaryController.id);
        if (driverInfo) {
          console.warn(
            `⚠️ Driver may be required for ${primaryController.name}`
          );
          console.warn(`   Instructions: ${driverInfo.instructions.join(' ')}`);
        }
      }
    } else {
      console.log(`ℹ️ No known controller detected, using default mapping`);
    }

    // Notify listeners
    this.notifyDetectionListeners();

    return this.detectedControllers;
  }

  /**
   * Get detected controllers
   */
  getDetectedControllers(): DetectedController[] {
    return [...this.detectedControllers];
  }

  /**
   * Set controller profile and apply its mapping
   */
  setControllerProfile(controllerId: string): boolean {
    const controller = this.detectedControllers.find(
      (c) => c.id === controllerId
    );
    if (!controller) {
      console.warn(
        `Controller ${controllerId} not found in detected controllers`
      );
      return false;
    }

    const customMapping = this.loadCustomMapping(controllerId);
    this.setMapping(customMapping || controller.mapping);
    return true;
  }

  /**
   * Register callback for controller detection events
   */
  onDetection(callback: (controllers: DetectedController[]) => void) {
    this.detectionCallbacks.push(callback);
  }

  /**
   * Remove detection callback
   */
  offDetection(callback: (controllers: DetectedController[]) => void) {
    const index = this.detectionCallbacks.indexOf(callback);
    if (index > -1) {
      this.detectionCallbacks.splice(index, 1);
    }
  }

  private notifyDetectionListeners() {
    this.detectionCallbacks.forEach((callback) => {
      try {
        callback(this.detectedControllers);
      } catch (error) {
        console.error('Error in detection callback:', error);
      }
    });
  }

  /**
   * Load custom mapping from localStorage
   */
  private loadCustomMapping(controllerId: string): MIDIMapping | null {
    if (typeof window === 'undefined') return null;

    try {
      const key = `midi_custom_mapping_${controllerId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load custom mapping:', error);
    }

    return null;
  }

  /**
   * Save custom mapping to localStorage
   */
  saveCustomMapping(controllerId: string, mapping: Partial<MIDIMapping>): void {
    if (typeof window === 'undefined') return;

    try {
      const key = `midi_custom_mapping_${controllerId}`;
      const currentMapping = this.mapping;
      const customMapping = { ...currentMapping, ...mapping };
      localStorage.setItem(key, JSON.stringify(customMapping));
      console.log(`💾 Saved custom mapping for ${controllerId}`);
    } catch (error) {
      console.error('Failed to save custom mapping:', error);
    }
  }

  private learnModeActive: boolean = false;
  private learnModeCallback:
    | ((type: 'note' | 'cc', value: number, channel: number) => void)
    | null = null;

  setLearnMode(
    active: boolean,
    callback?: (type: 'note' | 'cc', value: number, channel: number) => void
  ) {
    this.learnModeActive = active;
    this.learnModeCallback = callback || null;
  }

  private handleMIDIMessage(event: Event) {
    try {
      const midiEvent = event as any;
      if (!midiEvent || !midiEvent.data) {
        console.warn('Invalid MIDI event:', event);
        return;
      }

      const [status, data1, data2] = midiEvent.data;
      const messageType = status & 0xf0;
      const channel = status & 0x0f;

      // If learn mode is active, capture the message
      if (this.learnModeActive && this.learnModeCallback) {
        if (messageType === 0x90 || messageType === 0x80) {
          // Note message
          if (data2 > 0) {
            // Only on note on
            this.learnModeCallback('note', data1, channel);
            return; // Don't process normally in learn mode
          }
        } else if (messageType === 0xb0) {
          // CC message
          this.learnModeCallback('cc', data1, channel);
          return; // Don't process normally in learn mode
        }
      }

      // Debug logging for unmapped controls (reduced spam)
      // Log all messages for first 10 seconds to help identify controls
      const shouldLog = Date.now() - (this as any).startTime < 10000;
      if (shouldLog && messageType === 0xb0) {
        console.log(
          `🎹 MIDI: type=0x${messageType
            .toString(16)
            .padStart(2, '0')} ch=${channel} CC=${data1} value=${data2}`
        );
      }

      // Note On/Off (0x90-0x9F)
      if (messageType === 0x90 || messageType === 0x80) {
        const note = data1;
        const velocity = messageType === 0x90 ? data2 : 0;

        // Map notes to controls (with channel awareness)
        this.mapNoteToControl(note, velocity > 0, channel);
      }

      // Control Change (0xB0-0xBF)
      else if (messageType === 0xb0) {
        const cc = data1;
        const value = data2;

        // Map CC to controls (with channel awareness)
        this.mapCCToControl(cc, value, channel);
      }

      // Pitch Bend (0xE0-0xEF) - for jogwheels
      else if (messageType === 0xe0) {
        const lsb = data1;
        const msb = data2;
        const value = ((msb << 7) | lsb) - 8192; // -8192 to 8191, center at 0

        console.log(`MIDI Pitch Bend: channel=${channel} value=${value}`);
        // Map to jogwheel based on channel
        if (channel === 0) {
          this.triggerCallback('jogwheelA', value / 8192); // Normalize to -1 to 1
        } else if (channel === 1) {
          this.triggerCallback('jogwheelB', value / 8192);
        }
      }
    } catch (error) {
      console.error('Error handling MIDI message:', error);
    }
  }

  private mapNoteToControl(
    note: number,
    pressed: boolean,
    channel: number = 0
  ) {
    if (!pressed) return; // Only trigger on press, not release

    const noteKey = `${channel}-${note}`;

    // For channel-aware controllers (like XDJ-RR), try channel-prefixed lookup first
    // XDJ-RR: channel 0 = Deck 1, channel 1 = Deck 2
    const channelPrefix = channel === 0 ? 'deckA' : channel === 1 ? 'deckB' : null;
    let mappedControl: [string, number] | undefined;

    if (channelPrefix) {
      // Try to find a channel-specific match first (e.g. deckA_play on note 11, ch0)
      mappedControl = Object.entries(this.mapping).find(([key, value]) =>
        value === note && key.startsWith(channelPrefix)
      ) as [string, number] | undefined;
    }

    // Fallback to channel-agnostic lookup
    if (!mappedControl) {
      mappedControl = Object.entries(this.mapping).find(([key, value]) => value === note) as [string, number] | undefined;
    }

    if (mappedControl) {
      const [controlName] = mappedControl;
      this.triggerCallback(controlName, 1);
    } else {
      // Log unmapped notes (only once per unique note)
      if (!this.unmappedCCs.has(noteKey)) {
        this.unmappedCCs.add(noteKey);
        console.log(`⚠️ Note ${note} (ch ${channel}) not mapped yet for this controller`);
      }
    }
  }

  private mapCCToControl(cc: number, value: number, channel: number = 0) {
    const normalizedValue = value / 127; // 0-1
    const ccKey = `${channel}-${cc}`;

    // Channel-aware lookup (XDJ-RR: ch0=DeckA, ch1=DeckB)
    const channelPrefix = channel === 0 ? 'deckA' : channel === 1 ? 'deckB' : null;
    let mappedControl: [string, number] | undefined;

    if (channelPrefix) {
      mappedControl = Object.entries(this.mapping).find(([key, val]) =>
        val === cc && key.startsWith(channelPrefix)
      ) as [string, number] | undefined;
    }

    // Fallback to generic lookup
    if (!mappedControl) {
      mappedControl = Object.entries(this.mapping).find(([key, val]) => val === cc) as [string, number] | undefined;
    }

    if (mappedControl) {
      const [controlName] = mappedControl;

      // XDJ-RR tempo fader: CC 0 → pitch rate (0=+16%, 64=0%, 127=-16% — Pioneer inverts tempo)
      if (controlName.includes('tempo')) {
        // Pioneer tempo fader is inverted: 0 = max speed, 127 = min speed
        // Center (64) = 0%, full range ±16% (0.84–1.16)
        const centeredNorm = (64 - value) / 64; // +1 to -1
        const rate = 1.0 + centeredNorm * 0.16;
        const deckLetter = controlName.startsWith('deckA') ? 'A' : 'B';
        this.triggerCallback(`jogwheelRate${deckLetter}`, rate);
      }
      // Sync / Master buttons from hardware
      else if (controlName.includes('_sync')) {
        const deckLetter = controlName.startsWith('deckA') ? 'A' : 'B';
        this.triggerCallback(`deck${deckLetter}_sync_hw`, 1);
      }
      else if (controlName.includes('_master')) {
        const deckLetter = controlName.startsWith('deckA') ? 'A' : 'B';
        this.triggerCallback(`deck${deckLetter}_master_hw`, 1);
      }
      // Volume / Gain faders
      else if (controlName.includes('volume') || controlName.includes('masterVolume') || controlName.includes('gain')) {
        this.triggerCallback(controlName, normalizedValue * 100);
      }
      // EQ knobs
      else if (controlName.includes('low') || controlName.includes('mid') || controlName.includes('high')) {
        this.triggerCallback(controlName, (normalizedValue - 0.5) * 24);
      }
      // Crossfader
      else if (controlName === 'crossfader') {
        this.triggerCallback(controlName, (normalizedValue - 0.5) * 200);
      }
      else {
        this.triggerCallback(controlName, normalizedValue);
      }
    } else {
      // Unmapped - log for debugging
      if (!this.unmappedCCs.has(ccKey)) {
        this.unmappedCCs.add(ccKey);
        console.log(`⚠️ CC ${cc} (ch ${channel}) not mapped yet - value=${value}`);
      }
    }
  }

  private triggerCallback(control: string, value: number) {
    const callbacks = this.callbacks.get(control) || [];
    callbacks.forEach((callback) => callback(value, control));
  }

  // Register callback for a control
  on(control: string, callback: MIDIControlCallback) {
    if (!this.callbacks.has(control)) {
      this.callbacks.set(control, []);
    }
    this.callbacks.get(control)!.push(callback);
  }

  // Remove callback
  off(control: string, callback: MIDIControlCallback) {
    const callbacks = this.callbacks.get(control);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Update mapping
  setMapping(mapping: Partial<MIDIMapping>) {
    this.mapping = { ...this.mapping, ...mapping };
  }

  // Get available MIDI inputs
  getInputs(): MIDIInput[] {
    return [...this.inputs];
  }

  // Check if initialized
  getInitialized(): boolean {
    return this.isInitialized;
  }

  // Dispose
  dispose() {
    this.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
    this.inputs = [];
    this.callbacks.clear();
    this.detectionCallbacks = [];
    this.detectedControllers = [];
    this.isInitialized = false;
  }
}

// Singleton instance
let midiControllerInstance: MIDIController | null = null;

export function getMIDIController(mapping?: MIDIMapping): MIDIController {
  if (!midiControllerInstance) {
    midiControllerInstance = new MIDIController(mapping);
  }
  return midiControllerInstance;
}
