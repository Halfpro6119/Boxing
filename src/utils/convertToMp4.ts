import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function convertWebmToMp4(blob: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const data = new Uint8Array(await blob.arrayBuffer());
  await ffmpeg.writeFile('input.webm', data);
  const presets = [
    ['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', 'output.mp4'],
    ['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-an', '-movflags', '+faststart', 'output.mp4'],
    ['-i', 'input.webm', '-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'aac', '-movflags', '+faststart', 'output.mp4'],
    ['-i', 'input.webm', '-c:v', 'mpeg4', '-q:v', '5', '-an', '-movflags', '+faststart', 'output.mp4'],
  ];
  let lastErr: unknown;
  for (const args of presets) {
    try {
      await ffmpeg.exec(args);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  const output = await ffmpeg.readFile('output.mp4');
  await ffmpeg.deleteFile('input.webm');
  await ffmpeg.deleteFile('output.mp4');
  return new Blob([output], { type: 'video/mp4' });
}
