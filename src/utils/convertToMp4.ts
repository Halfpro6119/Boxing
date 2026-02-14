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
  await ffmpeg.exec(['-i', 'input.webm', '-c', 'copy', 'output.mp4']);
  const output = await ffmpeg.readFile('output.mp4');
  await ffmpeg.deleteFile('input.webm');
  await ffmpeg.deleteFile('output.mp4');
  return new Blob([output], { type: 'video/mp4' });
}
