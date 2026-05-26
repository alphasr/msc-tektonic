---
name: ui-overhaul-2026-05
description: May 2026 UI overhaul — table library, hot cues, loop controls, EQ kills, real VU meters
metadata:
  type: project
---

Comprehensive overhaul of TEKTONIC UI (2026-05-26) based on Serato/Pioneer/rekordbox UX patterns.

**What changed:**
- `TrackLibrary`: rewrote as table view (Title/Artist/BPM/Key/Duration/Energy/Load A·B). Sortable headers, harmonic key filter, hover-reveal A/B load buttons.
- `Deck`: added 4 hot cue pads (orange/blue/green/yellow), loop controls (IN/OUT/÷2/×2/LOOP toggle), waveform overlays for loop region + cue markers. Removed stub "Loop"/"Cues" buttons.
- `CentralMixer`: EQ kill-switch buttons per band (K button, saves/restores pre-kill value), real VU meters via `requestAnimationFrame` + `getFrequencyData()` instead of Math.random().
- `StatusBar`: reduced from tall card to 24px thin bar.
- `Navigation`: 40px compact bar, fixed duplicate Settings icon (Status now uses Server icon), removed redundant props.
- `globals.css`: refined color palette, thinner scrollbars, added `playing-dot` animation class, hot cue color variables.
- `page.tsx`: hot cue state (hotCuesA/B + refs for MIDI stale-closure-safety), loop state (loopA/B + refs for interval access), loop monitoring in progress interval (seeks back to loop.start when playhead hits loop.end), MIDI handlers wired to real hot-cue/loop functions.

**Key design decisions:**
- Hot cue pads: single-click empty = SET, single-click set = TRIGGER, right-click = CLEAR (matches Serato).
- Loop state uses refs alongside React state so the 50ms progress interval reads fresh values without stale closures.
- EQ kill pre-kill values stored in `preKillEQ` ref inside CentralMixer; restores on un-kill.
- Library double-click detection is time-based (< 400ms between same-row clicks) to avoid a native `onDoubleClick` + propagation conflict.
- Waveform click math uses `rect.width / deck.rate` for the effective width — this is correct because the waveform bars are `scaleX(1/rate)` transformed.

**Why:** Referenced Serato DJ Pro, rekordbox, and Traktor Pro patterns — library is always a list/table in pro software, never cards; hot cue pads and loop controls are standard on all major platforms.
