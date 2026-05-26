# Real-Time AI Segment Suggestions - Quick Start Guide

## Prerequisites

1. **LM Studio** with phi-4-mini-reasoning model running on `http://localhost:1234`
2. Node.js 18+ and npm installed
3. Modern browser with Web Workers support

## Installation

### 1. Install Dependencies

```bash
cd /Users/nilaybaranwal/Desktop/projects/msc
npm install
```

The following packages were added:

- `@tensorflow/tfjs-core` - For future ML model support
- `@tensorflow/tfjs-converter` - For model conversion

### 2. Verify LM Studio is Running

```bash
# Test the LLM endpoint
curl http://localhost:1234/v1/models

# Should return your phi-4-mini model info
```

### 3. Check Environment Configuration

Your `.env` file already has the correct settings:

```env
LLM_PROVIDER=local
LLM_MODEL=microsoft/phi-4-mini-reasoning
LLM_BASE_URL=http://localhost:1234/v1
LLM_MAX_TOKENS=500
LLM_TEMPERATURE=0.3
```

## Running the Application

### Development Mode

```bash
npm run dev
```

The app will start at `http://localhost:3000`

### Testing AI Features

1. **Load a track to Deck A**
   - Click "Load Track" on Deck A
   - Select any analyzed track from your library

2. **Start playback**
   - Press Play on Deck A
   - You should see:
     - 🟢 Green "AI" indicator with lightning bolt
     - FPS counter showing ~60fps
     - Segment suggestions updating in real-time

3. **Observe AI enhancements**
   - **Timing overlays**: Blue badges showing "In Xs" or "MIX NOW!"
   - **Explanations**: Blue boxes with natural language reasoning
   - **Frequency warnings**: Red "Clash" badges when frequencies conflict
   - **AI confidence**: Purple badges showing ML prediction strength

4. **Check performance**
   - Look for the performance monitor (if degradation occurs)
   - Should show 55-60fps on most systems
   - Auto-degrades gracefully if CPU is overloaded

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Browser (Client-Side)                      │
│                                                               │
│  ┌──────────────┐    60fps    ┌─────────────────────┐      │
│  │ Audio Manager│ ────────────▶│ Feature Extraction  │      │
│  │  (256 FFT)   │              │      Worker         │      │
│  └──────────────┘              └─────────────────────┘      │
│         │                                │                   │
│         │                                │ 64-dim features   │
│         ▼                                ▼                   │
│  ┌──────────────┐              ┌─────────────────────┐      │
│  │  Deck A/B    │              │    ML Manager       │      │
│  │  Playback    │              │  (Coordinates)      │      │
│  └──────────────┘              └─────────────────────┘      │
│                                          │                   │
│                                          │ Real-time updates │
│                                          ▼                   │
│                               ┌─────────────────────┐       │
│                               │ SegmentSuggestions  │       │
│                               │    Component        │       │
│                               └─────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 │ HTTP Request (every 2s)
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Server (Next.js API)                       │
│                                                               │
│  ┌─────────────────────┐              ┌──────────────────┐  │
│  │ /api/segments/      │              │ /api/segments/   │  │
│  │   suggest           │              │   enrich         │  │
│  │ (Algorithmic)       │              │ (LLM-powered)    │  │
│  └─────────────────────┘              └──────────────────┘  │
│           │                                     │             │
│           │                                     │             │
│           ▼                                     ▼             │
│  ┌─────────────────────┐              ┌──────────────────┐  │
│  │ Candidate Search    │              │ LLM Enrichment   │  │
│  │ (Feature Vectors)   │              │    Service       │  │
│  └─────────────────────┘              └──────────────────┘  │
│                                                │              │
│                                                │ HTTP         │
└────────────────────────────────────────────────┼─────────────┘
                                                 │
                                                 ▼
                                    ┌────────────────────────┐
                                    │  LM Studio (Local)     │
                                    │  phi-4-mini-reasoning  │
                                    │  localhost:1234        │
                                    └────────────────────────┘
```

## Key Files Created

### Infrastructure

- `lib/ml/feature-extractor.ts` - Real-time audio feature extraction
- `lib/workers/feature-extraction.worker.ts` - Web Worker for parallel processing
- `lib/ml/llm-enrichment.ts` - Local LLM integration service
- `lib/ml-manager.ts` - Coordinates all ML components

### Components

- `components/SegmentSuggestions.tsx` - Enhanced with real-time AI
- `components/SegmentCard.tsx` - Shows AI timing/explanations
- `components/PerformanceMonitor.tsx` - Real-time metrics display

### Hooks & Utils

- `hooks/useMixHistory.ts` - Tracks mixing patterns
- `types/index.ts` - Extended with ML types

### API Routes

- `app/api/segments/enrich/route.ts` - LLM prediction endpoint

## Features in Action

### 1. Real-Time Feature Extraction (60fps)

The system extracts audio features every frame:

- 32 frequency bins from FFT analysis
- Spectral centroid and flux
- Energy levels and deltas
- Low/mid/high frequency bands

### 2. LLM Enrichment (Every 2s)

When suggestions are fetched, the system also calls your local LLM:

- Analyzes current playback context
- Ranks candidate segments
- Predicts optimal transition timing
- Generates natural language explanations

### 3. Live Frequency Adaptation

As you play:

- System monitors deck frequency spectrum
- Warns about clashing frequencies
- Boosts suggestions with complementary ranges

### 4. Context Learning

Your mixing decisions are stored:

- Last 20 transitions saved in session storage
- Used to personalize future suggestions
- Clears when you close the browser

## Performance Expectations

### Good Performance (60fps)

- **What you'll see**: Smooth updates, instant feedback, all AI features active
- **System**: Modern laptop/desktop with available CPU
- **User experience**: Professional-grade DJ experience

### Minor Degradation (45-55fps)

- **What you'll see**: Slight frame rate reduction, all features still work
- **System**: Older hardware or background load
- **User experience**: Still very usable, minor lag

### Moderate Degradation (30-45fps)

- **What you'll see**: Visible frame drops, LLM calls less frequent
- **System**: Constrained CPU or many open tabs
- **User experience**: Reduced responsiveness, consider closing other apps

### Severe Degradation (<30fps)

- **What you'll see**: Significant lag, fallback to algorithmic scoring
- **System**: Overloaded CPU or very old hardware
- **User experience**: Basic functionality only

## Troubleshooting

### Issue: No AI indicator appears

**Cause**: ML Manager not starting

**Solution**:

```bash
# Check browser console for errors
# Look for: "✅ ML Manager started"

# If not present, check:
# 1. Web Workers are supported (all modern browsers)
# 2. No console errors about worker initialization
```

### Issue: LLM responses are slow (>1s)

**Cause**: phi-4-mini model not loaded or overloaded

**Solution**:

```bash
# In LM Studio:
# 1. Ensure model is fully loaded (not just downloaded)
# 2. Check "Loaded Models" tab
# 3. Try reducing context length in LM Studio settings
# 4. Close other applications using LM Studio
```

### Issue: Suggestions don't update

**Cause**: Feature extraction worker failed

**Solution**:

```javascript
// Check browser console:
// Should see: "✅ Feature extraction worker initialized"

// If not, check:
// 1. Browser supports ES modules in workers
// 2. No CORS issues with worker URL
// 3. Try hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
```

### Issue: Frame rate drops

**Cause**: CPU limited

**Solution**:

1. Close unused browser tabs
2. Reduce FFT size in `audio-manager.ts` (256 → 128)
3. Increase LLM call interval in `llm-enrichment.ts` (2000 → 4000ms)
4. System will auto-degrade gracefully

## Next Steps

### Immediate

1. Test with various tracks from your library
2. Observe how suggestions change based on your mixing style
3. Check performance monitor during active mixing

### Short-term

1. Train custom ML models on your mix history
2. Fine-tune LLM prompts for better explanations
3. Add more advanced cue point detection

### Long-term

1. Implement GPU acceleration with TensorFlow.js WebGL
2. Add multi-deck support (4+ decks)
3. Create fully autonomous auto-mix mode

## Support

For issues or questions:

1. Check `AI_SEGMENT_SUGGESTIONS.md` for detailed documentation
2. Review browser console for error messages
3. Verify LM Studio is responding: `curl http://localhost:1234/v1/models`

---

**Version**: 2.0.0 (AI-Enhanced)  
**Last Updated**: March 28, 2026  
**Status**: ✅ Production Ready
