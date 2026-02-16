import { getFFmpeg, preloadFFmpeg } from './ffmpeg';

export { preloadFFmpeg };

const sharedArgs = ['-avoid_negative_ts', 'make_zero', '-fflags', '+genpts'];

async function ensureCleanFs(ffmpeg: Awaited<ReturnType<typeof getFFmpeg>>): Promise<void> {
  try {
    await ffmpeg.deleteFile('input.webm');
  } catch {
    /* ignore */
  }
  try {
    await ffmpeg.deleteFile('output.mp4');
  } catch {
    /* ignore */
  }
}

export async function convertWebmToMp4(blob: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  await ensureCleanFs(ffmpeg);
  const data = new Uint8Array(await blob.arrayBuffer());
  if (data.length === 0) throw new Error('Recording is empty');
  await ffmpeg.writeFile('input.webm', data);
  const presets = [
    [...sharedArgs, '-i', 'input.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-movflags', '+faststart', 'output.mp4'],
    [...sharedArgs, '-i', 'input.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-an', '-movflags', '+faststart', 'output.mp4'],
    [...sharedArgs, '-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', 'output.mp4'],
    [...sharedArgs, '-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-an', '-movflags', '+faststart', 'output.mp4'],
    [...sharedArgs, '-i', 'input.webm', '-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'aac', '-movflags', '+faststart', 'output.mp4'],
    [...sharedArgs, '-i', 'input.webm', '-c:v', 'mpeg4', '-q:v', '5', '-an', '-movflags', '+faststart', 'output.mp4'],
    ['-i', 'input.webm', '-c:v', 'mpeg4', '-q:v', '8', '-an', '-movflags', '+faststart', 'output.mp4'],
  ];
  let lastErr: unknown;
  for (const args of presets) {
    try {
      await ffmpeg.exec(args);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      await ensureCleanFs(ffmpeg);
      await ffmpeg.writeFile('input.webm', data);
    }
  }
  try {
    if (lastErr) throw lastErr;
    const output = await ffmpeg.readFile('output.mp4');
    if (!output || (output as Uint8Array).length === 0) throw new Error('Conversion produced empty output');
    return new Blob([output], { type: 'video/mp4' });
  } finally {
    await ensureCleanFs(ffmpeg);
  }
}
