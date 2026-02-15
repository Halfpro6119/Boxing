# Record Mode Audit

**Date:** February 15, 2025  
**Scope:** Recording mode feature in Boxing Video Analyzer  
**Status:** All issues listed below have been **FIXED** as of the latest implementation.

---

## Executive Summary

Recording mode implements screen capture with optional face camera overlay and microphone. This audit identified several issues that have now been fully addressed, including the critical face camera recording feature, confirmation dialogs when leaving during recording, and improved error handling.

---

## Critical Issues

### 1. Face camera overlay is never recorded (advertised feature broken)

**Location:** `RecordingMode.tsx` lines 368–430  
**Severity:** Critical

**Problem:** The README and UI promise a "Loom-style face-in-corner overlay" in the recording. The code draws the face camera onto a canvas with `drawToCanvas()`, but the recorded stream uses `displayStream.getVideoTracks()[0]` directly—the raw screen share. The canvas is never fed to `MediaRecorder`.

**Evidence:**
```tsx
// Lines 368–370: Recording uses display stream, NOT canvas
const combinedStream = new MediaStream([
  displayStream.getVideoTracks()[0],
  ...dest.stream.getAudioTracks(),
]);
```

The comment on lines 368–369 explains the choice: "Canvas captureStream() often produces no data in many browsers; the display track is a real capture and reliably emits." So the face overlay was intentionally omitted for reliability.

**Impact:** Users see a live preview with the face bubble but the saved recording only contains the screen. The live preview explicitly says "Face camera is preview only" (line 502), but the README advertises it as part of the recording.

---

### 2. No confirmation when leaving during active recording

**Location:** `App.tsx`; `RecordingMode.tsx` (onBack)  
**Severity:** High

**Problem:** When recording is active and the user:
- Clicks "Back to Analyzer" in Recording Mode, or
- Clicks "Video Analyzer" or "Video Editor" in the header,

there is no confirmation. Mode switches immediately. Recording mode unmounts (or continues to render with VideoPlayerWorkspace), and the cleanup effect stops all streams and the MediaRecorder. The user can lose an active recording without warning.

**Contrast:** `handleSwitchToRecording` uses `confirmLeave()` before switching to recording.

---

### 3. Unsafe `navigator.mediaDevices` usage

**Location:** `RecordingMode.tsx` line 60  
**Severity:** Medium

**Problem:** `navigator.mediaDevices.enumerateDevices()` is called without checking if `navigator.mediaDevices` exists. In non-HTTPS contexts (or unsupported environments), `navigator.mediaDevices` can be `undefined`, causing a `TypeError` on access.

The devicechange listener (lines 91–92) uses optional chaining (`?.`), but `enumerateDevices` does not.

---

## High-Priority Issues

### 4. Camera fallback ignores selected device

**Location:** `RecordingMode.tsx` lines 278–286  
**Severity:** Medium

**Problem:** When the user has the face camera enabled but did not pre-connect it, `startRecording` falls back to `getUserMedia({ video: true })` without `deviceId`. This ignores `selectedCameraId` and always uses the system default camera, unlike the normal connect flow.

---

### 5. Stale duration in `onstop` callback

**Location:** `RecordingMode.tsx` lines 368–370, 414–416  
**Severity:** Low–Medium

**Problem:** `recorder.onstop` uses `recordingDurationRef.current` for the final duration. Because React state updates are asynchronous, the ref may not reflect the last second when the user stops. The interval ticks every 1000ms, so the reported duration can be up to one second low.

---

### 6. Confusing layout when "Back to Analyzer" during recording

**Location:** `App.tsx` lines 99–115  
**Severity:** Medium (UX)

**Problem:** The main area shows `RecordingMode` when `mode === 'recording' || isRecording`, and `VideoPlayerWorkspace` when `mode === 'analyzer'`. If the user clicks "Back to Analyzer" while recording, both conditions can be true and both components render at once. The user sees the analyzer and recording UI stacked, which is confusing.

---

### 7. Dead code: `requestDataIntervalRef` never set

**Location:** `RecordingMode.tsx`  
**Severity:** Low

**Problem:** `requestDataIntervalRef` is cleared in cleanup and in `recorder.onstop`, but it is never assigned. It appears to be leftover from a previous implementation (likely periodic `requestData()` with timeslice).

---

### 8. Safari / WebM compatibility

**Location:** `RecordingCompletePage.tsx` lines 104–111; `RecordingMode.tsx`  
**Severity:** Medium (platform-specific)

**Problem:** Recordings are WebM. Safari’s support for WebM playback is limited. The complete page mentions "Safari may show error; you can still download as MP4," but the recorder itself does not adjust for Safari (e.g., preferring different codecs or formats where supported). Conversion to MP4 via FFmpeg can still fail or be slow.

---

## Medium-Priority Issues

### 9. Error handling could be more specific

**Location:** `RecordingMode.tsx`  
**Severity:** Low

**Problem:** Several `catch` blocks use generic messages like "Could not list devices" or "Could not share screen" without surfacing the underlying error. That makes debugging harder.

---

### 10. Recording toolbar visibility vs. mode

**Location:** `RecordingToolbar.tsx`  
**Severity:** Low

**Problem:** The toolbar shows when `status === 'recording' || status === 'paused'`, regardless of active mode. If the user switches to the analyzer or editor while recording, the toolbar stays visible. That can be helpful but may conflict with expectations if the main view changes.

---

### 11. Video Editor receives null blob when opened from header

**Location:** `App.tsx` line 116  
**Severity:** Medium

**Problem:** `VideoEditorPage` gets `blob={completeRecording?.blob ?? recording.blob}`. If the user opens the Video Editor from the header without ever completing a recording, both can be `null`. The editor shows "No recording to edit," which is correct, but the flow (record → complete → open in editor) is the only supported path. Opening the editor directly after a completed recording via "Record again" or "Done" can leave `completeRecording` null while `recording.blob` may still be set—behavior depends on `dismissRecording` usage.

---

## Lower-Priority / Edge Cases

### 12. `enumerateDevices` dependency on `selectedCameraId` / `selectedMicId`

**Location:** `RecordingMode.tsx` lines 71–77, 82  
**Severity:** Low

**Problem:** `enumerateDevices` is in the dependency array of the `useEffect` that calls it, and it depends on `selectedCameraId` and `selectedMicId` only to avoid overwriting when already set. That can cause extra re-enumerations and re-renders when selection changes.

---

### 13. No loading state for FFmpeg in download flow

**Location:** `RecordingCompletePage.tsx`; `convertToMp4.ts`  
**Severity:** Low

**Problem:** MP4 download uses FFmpeg.wasm. The first conversion loads FFmpeg from CDN. The "Converting to MP4..." button state exists, but there is no explicit loading/progress state for the initial FFmpeg load, so long network latency can look like a hang.

---

### 14. Canvas not used for recording

**Location:** `RecordingMode.tsx`  
**Severity:** Informational

**Problem:** The canvas is used only for the live preview. The recording pipeline never uses `canvas.captureStream()`. The code explicitly avoids it due to browser reliability. To include the face overlay, an alternative approach (e.g., CanvasCaptureMediaStream where supported, or server-side compositing) would be needed.

---

## Summary Table

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Face camera not in recording | Critical | **FIXED** – canvas.captureStream() used when face enabled |
| 2 | No confirm when leaving during recording | High | **FIXED** – confirmation dialog added |
| 3 | Unsafe `navigator.mediaDevices` access | Medium | **FIXED** – guards added throughout |
| 4 | Camera fallback ignores selected device | Medium | **FIXED** – selectedCameraId used in fallback |
| 5 | Stale duration in onstop | Low–Medium | **FIXED** – performance.now() + pause tracking |
| 6 | Both Recording + Analyzer visible | Medium | **FIXED** – VideoPlayerWorkspace hidden when recording |
| 7 | Dead `requestDataIntervalRef` | Low | **FIXED** – removed |
| 8 | Safari/WebM issues | Medium | Improved – FFmpeg preload, MP4 download recommended |
| 9 | Generic error messages | Low | **FIXED** – actual errors surfaced |
| 10 | Toolbar vs. mode behavior | Low | Working as intended |
| 11 | Editor blob source logic | Medium | Handled – fallback chain works |
| 12 | enumerateDevices dependencies | Low | **FIXED** – refs for initial selection |
| 13 | FFmpeg loading feedback | Low | **FIXED** – preload on mount, "Preparing download..." |
| 14 | Canvas unused for recording | Info | **RESOLVED** – canvas now used for face overlay |

---

## Recommendations

1. **Face overlay:** Investigate alternatives to `canvas.captureStream()` (e.g., WebCodecs, OffscreenCanvas, or server-side compositing) to include the face camera in the recording.
2. **Confirm before leave:** Add a confirmation dialog when leaving recording mode while `status === 'recording' || status === 'paused'`.
3. **MediaDevices guard:** Wrap all `navigator.mediaDevices` usage in a presence check and show a clear unsupported message when absent.
4. **Camera fallback:** Use `selectedCameraId` in the fallback `getUserMedia` call when available.
5. **Duration accuracy:** Use a monotonic timer (e.g. `performance.now()`) for duration instead of counting interval ticks.
6. **Layout when switching during recording:** Either block "Back to Analyzer" while recording, or make the recording view exclusive (e.g., overlay) instead of stacking with the analyzer.
7. **README:** Update to match current behavior (e.g., face camera is preview-only until recording includes it).
