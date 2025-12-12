# MIDI Controller Setup Guide

## Overview

The DJ mixer now supports MIDI controllers! Connect your physical DJ mixer/controller and control the application directly.

## Supported Controls

### Deck A
- **Play** - Note C4 (0x90)
- **Pause** - Note C#4 (0x91)
- **Stop** - Note D4 (0x92)
- **Cue** - Note D#4 (0x93)
- **Volume** - CC 7 (0-100)
- **Low EQ** - CC 10 (-12 to +12 dB)
- **Mid EQ** - CC 11 (-12 to +12 dB)
- **High EQ** - CC 12 (-12 to +12 dB)

### Deck B
- **Play** - Note E4 (0x94)
- **Pause** - Note F4 (0x95)
- **Stop** - Note F#4 (0x96)
- **Cue** - Note G4 (0x97)
- **Volume** - CC 8 (0-100)
- **Low EQ** - CC 13 (-12 to +12 dB)
- **Mid EQ** - CC 14 (-12 to +12 dB)
- **High EQ** - CC 15 (-12 to +12 dB)

### Mixer
- **Crossfader** - CC 16 (-100 to +100)
- **Master Volume** - CC 17 (0-100)

### Jogwheels
- **Jogwheel A** - Pitch Bend Channel 0
- **Jogwheel B** - Pitch Bend Channel 1

## Default MIDI Mapping

The default mapping follows a Traktor-style layout:

```
Deck A:
  Play: Note C4
  Pause: Note C#4
  Stop: Note D4
  Cue: Note D#4
  Volume: CC 7
  Low EQ: CC 10
  Mid EQ: CC 11
  High EQ: CC 12

Deck B:
  Play: Note E4
  Pause: Note F4
  Stop: Note F#4
  Cue: Note G4
  Volume: CC 8
  Low EQ: CC 13
  Mid EQ: CC 14
  High EQ: CC 15

Mixer:
  Crossfader: CC 16
  Master Volume: CC 17
```

## Custom Mapping

You can customize the MIDI mapping by modifying the `MIDIMapping` interface in `lib/midi-controller.ts`:

```typescript
const customMapping: MIDIMapping = {
  deckA_play: 0x36, // Custom note
  deckA_volume: 0x07, // Custom CC
  // ... etc
}

const midi = getMIDIController(customMapping)
```

## Browser Support

- **Chrome/Edge**: Full Web MIDI API support ✅
- **Firefox**: Not supported ❌
- **Safari**: Not supported ❌

## Setup Instructions

1. **Connect your MIDI controller** via USB
2. **Open the application** in Chrome or Edge
3. **Allow MIDI access** when prompted by the browser
4. **Check console** for "MIDI controller connected" message
5. **Start mixing!** All controls should work immediately

## Troubleshooting

### Controller not detected
- Check browser console for errors
- Ensure browser supports Web MIDI API (Chrome/Edge)
- Verify MIDI device is connected and recognized by OS
- Try refreshing the page

### Controls not working
- Check MIDI mapping matches your controller
- Verify MIDI messages are being sent (use MIDI monitor)
- Check browser console for MIDI message logs
- Try customizing the mapping

### Latency issues
- Use USB connection (not Bluetooth)
- Close other applications using MIDI
- Check audio buffer settings

## Testing MIDI Input

Open browser console and you should see:
```
MIDI Input: [Your Controller Name] ([Manufacturer])
MIDI controller connected
```

When you press buttons or move faders, MIDI messages are processed automatically.

## Customizing for Your Controller

If your controller uses different CC/Note numbers:

1. Identify your controller's MIDI mapping (check manual or use MIDI monitor)
2. Update the `defaultMapping` in `lib/midi-controller.ts`
3. Or pass custom mapping to `getMIDIController(customMapping)`

## Common Controller Mappings

### Pioneer DDJ-400
- Uses standard MIDI CC mapping
- May need to set controller to "MIDI" mode

### Traktor Kontrol S2/S4
- Uses standard MIDI CC mapping
- Works out of the box

### Numark Mixtrack
- Uses standard MIDI CC mapping
- May need custom mapping for some controls

## Notes

- MIDI messages are processed in real-time
- All controls update the UI immediately
- Audio processing happens through Web Audio API
- No additional drivers needed (uses Web MIDI API)

