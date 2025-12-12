# TEKTONIC - DJ Mixing Platform

A professional-grade DJ mixing application built with Next.js, featuring comprehensive track analysis, mixing capabilities, and an intuitive interface.

## Features

### Main Dashboard
- **Dual-Deck Interface**: Independent playback controls for Deck A and Deck B
- **Central Mixer**: 3-band EQ, volume faders, crossfader, and master controls
- **Track Library**: Search, filter, and load tracks with BPM, key, and energy information
- **Energy & Phrase Analytics**: Visualize track structure and energy levels
- **Real-time Status**: System health monitoring and connection status

### Additional Pages
- **Track Analysis** (`/analyze`): Upload and analyze tracks for BPM, key, energy, and structure
- **Mix Candidates** (`/candidates`): Generate transition candidates between tracks
- **Similarity Search** (`/search`): Find similar segments across your library
- **Statistics** (`/stats`): View library statistics and metrics
- **System Status** (`/status`): Monitor service health and performance

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality UI components
- **Howler.js** - Audio playback library
- **Radix UI** - Accessible component primitives

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
├── app/
│   ├── api/              # Mock API endpoints
│   ├── analyze/          # Track analysis page
│   ├── candidates/       # Mix candidates page
│   ├── search/           # Similarity search page
│   ├── stats/            # Statistics page
│   ├── status/           # System status page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Main dashboard
│   └── globals.css       # Global styles and theme
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── Deck.tsx          # Deck component
│   ├── CentralMixer.tsx  # Mixer component
│   ├── TrackLibrary.tsx  # Library component
│   ├── EnergyAnalytics.tsx # Analytics component
│   ├── Navigation.tsx    # Navigation bar
│   └── StatusBar.tsx     # Status bar
├── lib/
│   └── utils.ts          # Utility functions
└── types/
    └── index.ts          # TypeScript type definitions
```

## Mock API Endpoints

The application includes mock API endpoints for development:

- `GET /api/tracks` - Get all tracks
- `GET /api/status` - Get system status
- `GET /api/stats` - Get library statistics
- `POST /api/candidates` - Generate transition candidates
- `POST /api/search` - Similarity search
- `GET /api/audio/[id]` - Stream audio (placeholder)

## Theme

The application uses a custom dark theme with:
- **Primary**: Purple (#a855f7)
- **Secondary**: Pink (#ec4899)
- **Accent**: Red (#ef4444)
- **Deck A**: Purple theme
- **Deck B**: Red theme

## Features in Detail

### Deck Controls
- Play/Pause/Stop
- Cue (return to start)
- Sync (tempo matching)
- Loop functionality
- Hot cues support
- Waveform visualization
- Section indicators (Intro, Verse, Chorus, Bridge, Outro)

### Mixer Features
- Individual deck volume controls
- Master volume control
- Crossfader
- 3-band EQ per deck (Low, Mid, High)
- Master FX section
- Real-time level meters

### Track Library
- Search by title, artist, tag, or key
- Filter by BPM range, energy level, key compatibility
- Double-click to load tracks
- Explicit load buttons for each deck

### Analytics
- Color-coded phrase segments
- Energy visualization
- Zoom/brush controls
- Linked to playback

## Notes

- Audio playback uses Howler.js with HTML5 audio support
- Mock endpoints return sample data for development
- The application is designed for desktop use with a responsive layout
- All components are built with accessibility in mind

## License

MIT
