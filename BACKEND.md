# Backend Implementation Guide

## Overview

The backend implements a complete audio analysis pipeline with upload, processing, feature extraction, and candidate generation capabilities.

## Architecture

### Storage Layer (`lib/storage.ts`)
- File-based storage system
- Track manifests stored as JSON
- Content deduplication via SHA-256 hashing
- Track ID generation from metadata + digest

### Queue System (`lib/queue.ts`)
- In-memory queue for development
- Exponential backoff retry logic
- Job processing with error handling
- **Production**: Replace with Redis/RabbitMQ

### Analysis Engine (`lib/analysis.ts`)
- Mock audio analysis (replace with librosa/essentia)
- Feature extraction (bar-level and phrase-level vectors)
- Key estimation (Camelot wheel)
- Energy scoring formula
- Cosine similarity calculations

### Candidate Generation (`lib/candidates.ts`)
- Transition candidate search
- Multi-factor scoring (key, energy, timing, contour)
- Similarity search across library

## API Endpoints

### POST `/api/upload`
Upload audio file for analysis.

**Request:**
- `multipart/form-data`
  - `audio_file` (required): Audio file
  - `artist` (optional): Artist name
  - `title` (optional): Track title

**Response:**
- `202 Accepted`: `{ track_id, status: "queued" }`
- `409 Conflict`: Duplicate track
- `415 Unsupported Media Type`: Invalid format
- `413 Payload Too Large`: File too large (>100MB)
- `500 Internal Server Error`: Storage/queue failure

**Flow:**
1. Validate file type and size
2. Calculate content digest
3. Generate track_id (hash of metadata + digest)
4. Check for duplicates
5. Save file to storage
6. Create manifest with status "queued"
7. Enqueue analysis job
8. Return 202 with track_id

### GET `/api/tracks`
List all analyzed tracks.

**Response:**
```json
[
  {
    "id": "track_id",
    "title": "Track Title",
    "artist": "Artist Name",
    "bpm": 128,
    "key": "8A",
    "energy": 8.5,
    "duration": 300,
    "phrases": 45,
    "tags": [],
    "waveform": [...]
  }
]
```

### GET `/api/tracks/[id]`
Get track manifest by ID.

### GET `/api/tracks/[id]/features`
Get feature vector paths.

**Response:**
```json
{
  "bar_vecs": "/api/tracks/{id}/features/bar_vecs.json",
  "phrase_vecs": "/api/tracks/{id}/features/phrase_vecs.json"
}
```

### POST `/api/candidates`
Generate transition candidates between two tracks.

**Request:**
```json
{
  "fromTrack": "track_id_A",
  "toTrack": "track_id_B",
  "k": 5,
  "mode": "both",
  "scope": "phrase"
}
```

**Response:**
```json
[
  {
    "from_position": 120.5,
    "to_position": 0.0,
    "score": 0.85,
    "scores": {
      "key": 1.0,
      "energy": 0.8,
      "timing": 1.0,
      "contour": 0.7
    }
  }
]
```

### POST `/api/search`
Search for similar segments.

**Request:**
```json
{
  "trackId": "track_id",
  "position": 60.0,
  "scope": "phrase",
  "k": 10
}
```

### GET `/api/stats`
Get library statistics.

**Response:**
```json
{
  "totalTracks": 8,
  "storageUsed": 245760000,
  "averageDuration": 300,
  "totalDuration": 2400,
  "averageTempo": 125.5,
  "averagePhrases": 37,
  ...
}
```

### POST `/api/worker`
Manual worker trigger (for testing).

## Analysis Pipeline

### 1. Upload Service
- Validates file type (MP3, WAV, FLAC, M4A)
- Checks file size (max 100MB)
- Calculates SHA-256 digest
- Generates unique track_id
- Detects duplicates
- Saves to `storage/tracks/{track_id}/audio.{ext}`
- Creates manifest entry
- Enqueues analysis job

### 2. Analysis Worker
- Loads audio file
- Normalizes and downmixes to mono (mock)
- Detects beats and tempo (mock)
- Segments into bars and phrases (mock)
- Extracts features:
  - Bar-level vectors (128-dim)
  - Phrase-level vectors (256-dim)
- Estimates Camelot key
- Calculates energy score
- Saves features to `storage/tracks/{track_id}/features/`
- Updates manifest with summary

### 3. Feature Extraction
**Bar-level:**
- Spectral features (MFCC, chroma, flux, RMS)
- Normalized and projected to fixed dimensions

**Phrase-level:**
- Aggregated bar features
- Attention/mean pooling
- Energy and texture variance

### 4. Key Estimation
- Pitch class profile (PCP) from chroma
- Camelot wheel matching
- Returns key (1A-12B)

### 5. Energy Scoring
Formula:
```
E = clip[1,10](0.5 + 0.5*tempo_norm + 0.3*density + 0.2*rms_norm)
```

Where:
- `tempo_norm = (tempo_bpm - 100) / 20`
- `density = transient_count / max_ref`
- `rms_norm = (rms - mu_rms) / sigma_rms`

### 6. Candidate Generation
Scoring formula:
```
S = 0.35*keyScore + 0.25*energyScore + 0.25*timingScore + 0.15*contourScore
```

Compatibility checks:
- Key compatibility (same/adjacent/neighboring)
- Energy gap ≤ 1.5
- Phrase boundary alignment
- Waveform contour similarity

## Storage Layout

```
storage/
├── manifests.json          # All track manifests
└── tracks/
    └── {track_id}/
        ├── audio.{ext}     # Original audio file
        └── features/
            ├── bar_vecs.json
            ├── phrase_vecs.json
            └── summary.json
```

## Error Handling

### Upload Errors
- **415**: Invalid file format → Reject
- **409**: Duplicate track → Return existing track_id
- **413**: File too large → Reject
- **500**: Storage failure → Rollback file, update manifest

### Analysis Errors
- Retry with exponential backoff (2s, 4s, 8s)
- Max 3 retries
- Update manifest with error status
- Partial recovery: Re-run specific stages if features missing

### Idempotency
- Analysis worker checks `manifest.status === "ready"`
- Skips processing if already complete
- Prevents duplicate work

## Concurrency & Resilience

### Queue Processing
- In-memory queue (dev)
- Automatic retry on failure
- Exponential backoff
- Job deduplication

### Partial Recovery
- Check feature files exist
- Re-run missing stages
- Update manifest incrementally

## Production Considerations

### Replace Mock Components
1. **Audio Processing**: Use `librosa` (Python) or `essentia` (C++)
2. **Queue**: Redis/BullMQ or RabbitMQ
3. **Storage**: S3/Cloud Storage for files
4. **Database**: PostgreSQL for manifests
5. **Worker**: Separate Node.js/Python process

### Scaling
- Horizontal scaling of workers
- Distributed queue (Redis)
- CDN for audio file serving
- Feature vector database (Pinecone/Weaviate)

### Security
- File upload size limits
- Content-type validation
- Virus scanning
- Rate limiting
- Authentication/authorization

## Testing

### Manual Testing
1. Upload audio file via `/api/upload`
2. Check manifest via `/api/tracks/{id}`
3. Wait for analysis (or trigger `/api/worker`)
4. Verify features via `/api/tracks/{id}/features`
5. Generate candidates via `/api/candidates`
6. Search similar segments via `/api/search`

### Integration Testing
- Test upload → analysis → features flow
- Test duplicate detection
- Test error recovery
- Test candidate generation accuracy

