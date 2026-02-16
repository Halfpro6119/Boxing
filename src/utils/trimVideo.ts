import { getFFmpeg } from './ffmpeg';

const INPUT_NAME = 'trim_input';
const OUTPUT_NAME = 'trim_output.mp4';

function getInputFilename(blob: Blob): string {
  const type = blob.type?.toLowerCase() ?? '';
  if (type.includes('webm') || type.includes('matroska')) return 'trim_input.webm';
  if (type.includes('mp4') || type.includes('quicktime') || type.includes('x-m4v')) return 'trim_input.mp4';
  return 'trim_input.webm';
}

async function ensureCleanFs(ffmpeg: Awaited<ReturnType<typeof getFFmpeg>>): Promise<void> {
  for (const name of [INPUT_NAME, 'trim_input.webm', 'trim_input.mp4', OUTPUT_NAME]) {
    try {
      await ffmpeg.deleteFile(name);
    } catch {
      /* ignore */
    }
  }
}

export interface TrimProgress {
  progress: number;
  time?: number;
}

/**
 * Trim a video to the specified start and end times.
 * Returns a new Blob (MP4) containing only the selected range.
 */
export async function trimVideo(
  blob: Blob,
  startSeconds: number,
  endSeconds: number,
  onProgress?: (p: TrimProgress) => void
): Promise<Blob> {
  if (blob.size === 0) throw new Error('Video is empty');
  if (startSeconds >= endSeconds) throw new Error('Start must be before end');
  if (startSeconds < 0) throw new Error('Start time cannot be negative');

  const ffmpeg = await getFFmpeg();
  await ensureCleanFs(ffmpeg);

  const inputName = getInputFilename(blob);
  const data = new Uint8Array(await blob.arrayBuffer());
  await ffmpeg.writeFile(inputName, data);

  const duration = endSeconds - startSeconds;
  const sharedArgs = ['-avoid_negative_ts', 'make_zero', '-fflags', '+genpts'];

  // -ss before -i = fast seek (input seeking)
  // -to = end time relative to -ss
  const isWebM = inputName.endsWith('.webm');
  const webmPresets = [
    [
      ...sharedArgs,
      '-ss',
      String(startSeconds),
      '-i',
      inputName,
      '-to',
      String(duration),
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '28',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      OUTPUT_NAME,
    ],
    [
      ...sharedArgs,
      '-ss',
      String(startSeconds),
      '-i',
      inputName,
      '-to',
      String(duration),
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '28',
      '-an',
      '-movflags',
      '+faststart',
      OUTPUT_NAME,
    ],
  ];
  const mp4TrimArgs = [
    ...sharedArgs,
    '-ss',
    String(startSeconds),
    '-i',
    inputName,
    '-to',
    String(duration),
    '-c',
    'copy',
    OUTPUT_NAME,
  ];

  const progressHandler = ({ progress, time }: { progress?: number; time?: number }) => {
    onProgress?.({ progress: progress ?? 0, time });
  };
  ffmpeg.on('progress', progressHandler);

  try {
    if (isWebM) {
      let lastErr: unknown;
      for (const args of webmPresets) {
        try {
          await ffmpeg.exec(args);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          await ensureCleanFs(ffmpeg);
          await ffmpeg.writeFile(inputName, data);
        }
      }
      if (lastErr) throw lastErr;
    } else {
      await ffmpeg.exec(mp4TrimArgs);
    }
    const output = await ffmpeg.readFile(OUTPUT_NAME);
    if (!output || (output as Uint8Array).length === 0) {
      throw new Error('Trim produced empty output');
    }
    return new Blob([output], { type: 'video/mp4' });
  } finally {
    ffmpeg.off('progress', progressHandler);
    await ensureCleanFs(ffmpeg);
  }
}
