# Production-Ready DJ Mixing Platform

## Overview

This is a fully functional DJ mixing application with real audio processing, Web Audio API integration, and production-ready features.

## Key Features

### Real Audio Processing
- **FFmpeg Integration**: Real audio file analysis using fluent-ffmpeg
- **Waveform Generation**: Extracts actual waveform data from audio files
- **BPM Detection**: Analyzes tempo from audio files
- **Key Detection**: Estimates Camelot key from audio
- **Energy Calculation**: Real energy scoring based on audio features

### Web Audio API Integration
- **Real-time EQ**: 3-band EQ (Low, Mid, High) with actual audio filtering
- **Volume Control**: Independent volume per deck with gain nodes
- **Crossfader**: Real crossfader mixing between decks
- **Master Volume**: Master output control
- **Audio Effects**: All effects process actual audio in real-time

### DJ Mixer Controls
All controls are fully functional:
- **Play/Pause/Stop**: Controls actual audio playback
- **Cue**: Returns to start position
- **Seek**: Click waveform to seek
- **Volume Faders**: Real-time volume adjustment
- **EQ Knobs**: Real-time frequency filtering
- **Crossfader**: Smooth transitions between decks
- **Master Volume**: Controls overall output

## Architecture

### Audio Manager (`lib/audio-manager.ts`)
- Singleton pattern for global audio context
- Web Audio API node graph per deck
- Real-time effect processing
- Crossfader implementation

### Audio Analysis (`lib/audio-analysis.ts`)
- FFmpeg-based audio processing
- Real waveform extraction
- BPM and key detection
- Feature vector generation

### Storage System (`lib/storage.ts`)
- File-based storage
- Content deduplication
- Manifest tracking
- Feature storage

## Setup

### Prerequisites
- Node.js 18+
- FFmpeg installed (via @ffmpeg-installer/ffmpeg)

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## Usage

### Uploading Tracks
1. Go to `/analyze` page
2. Upload an audio file (MP3, WAV, FLAC, M4A)
3. Wait for analysis to complete
4. Track appears in library

### Mixing
1. Load tracks into Deck A or Deck B from library
2. Use playback controls (Play, Pause, Stop, Cue)
3. Adjust volume faders
4. Use EQ knobs for frequency control
5. Use crossfader to mix between decks
6. Adjust master volume

### All Controls Work
- **Deck Controls**: Play, Pause, Stop, Cue, Seek
- **Volume Faders**: Real-time volume adjustment
- **EQ Knobs**: Low, Mid, High frequency control
- **Crossfader**: Smooth deck transitions
- **Master Volume**: Overall output control

## API Endpoints

- `POST /api/upload` - Upload audio files
- `GET /api/tracks` - List all tracks
- `GET /api/tracks/[id]` - Get track details
- `GET /api/audio/[id]` - Stream audio file
- `POST /api/candidates` - Generate transitions
- `POST /api/search` - Similarity search
- `GET /api/stats` - Library statistics

## Technical Details

### Web Audio API Graph
```
HTMLAudioElement (Howler.js)
  → MediaElementSourceNode
  → Low Filter (BiquadFilterNode)
  → Mid Filter (BiquadFilterNode)
  → High Filter (BiquadFilterNode)
  → Volume Gain (GainNode)
  → Crossfader Gain (GainNode)
  → Deck Gain (GainNode)
  → Master Gain (GainNode)
  → AudioContext.destination
```

### EQ Settings
- **Low**: Lowshelf filter at 200Hz
- **Mid**: Peaking filter at 1000Hz
- **High**: Highshelf filter at 5000Hz
- Range: -12dB to +12dB

### Crossfader
- Range: -100 (all Deck A) to +100 (all Deck B)
- Smooth gain transitions
- Real-time mixing

## Production Considerations

### Audio Processing
- Currently uses FFmpeg for analysis
- For better BPM/key detection, integrate:
  - librosa (Python) via API
  - Essentia (C++) via bindings
  - Web Audio API for client-side analysis

### Performance
- Audio processing happens server-side
- Web Audio API effects are client-side
- Consider Web Workers for heavy processing

### Storage
- Currently file-based
- For production, use:
  - S3/Cloud Storage for files
  - Database for manifests
  - CDN for audio streaming

### Queue System
- Currently in-memory
- For production, use:
  - Redis with BullMQ
  - RabbitMQ
  - AWS SQS

## Testing

All mixer controls are functional:
1. Load a track on Deck A
2. Play the track
3. Adjust volume fader - audio volume changes
4. Adjust EQ knobs - frequency response changes
5. Load track on Deck B
6. Use crossfader - audio mixes between decks
7. All controls respond in real-time

## Notes

- Audio files are processed server-side
- Web Audio API handles real-time effects
- All controls directly affect audio output
- No mock data - everything is real

