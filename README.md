# Boxing Video Analyzer

A full-featured boxing video analysis website where you can import videos, add annotations, and record Loom-style screen captures with face camera.

## Features

### Video Analyzer Mode
- **Import video**: Upload a local video file (MP4, WebM, MOV) or paste a YouTube URL
- **Custom video player**: Pause, play, and scrub through the timeline
- **Annotation tools**:
  - **Arrow** – Point to specific moments
  - **Circle** – Highlight areas
  - **Rectangle** – Draw boxes
  - **Draw** – Freehand drawing
  - **Text** – Add text labels
- **Duration control**: Each annotation has a duration (in seconds) – adjust how long it stays visible
- **Download annotated video**: Export the video with all annotations baked in (local files only)

### Recording Mode
- **Screen capture**: Record your screen
- **Face camera bubble**: Optional Loom-style face-in-corner overlay (baked into the recording)
- **Microphone**: Optional audio from your mic
- **Download recording**: Save as WebM or MP4 (MP4 recommended for Safari)

**Tip**: To record the analyzer with annotations, open the analyzer in one tab, switch to Recording Mode, and share that tab when starting the recording.

## Getting Started

```bash
npm install
npm run dev
```

This starts both the Vite dev server (frontend) and the Express API server (backend). Open [http://localhost:5173](http://localhost:5173) in your browser.

**YouTube extraction** requires the backend server. The app uses `youtube-dl-exec` (which bundles yt-dlp) to extract video streams from YouTube URLs for fast native playback. If extraction fails (e.g. "Failed to extract video"), try:
1. **Load as embed instead** – works without extraction (no annotated export)
2. **Update yt-dlp** – run `./node_modules/youtube-dl-exec/bin/yt-dlp.exe --update-to nightly` (Windows) or `./node_modules/youtube-dl-exec/bin/yt-dlp --update-to nightly` (Mac/Linux)

## Build

```bash
npm run build
npm run preview
```

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- YouTube IFrame API
- MediaRecorder API (screen + camera + mic)
- Canvas API (annotations)
