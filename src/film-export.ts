import { FPS, sampleFilm, totalDuration, type FilmProject } from './film-model';
import type { StudyScene } from './scene';

export interface ExportFormat { id: 'avc' | 'vp9' | 'vp8'; label: string; extension: string; mime: string; codec: string }
const FORMATS: ExportFormat[] = [
  { id: 'avc', label: 'MP4 · H.264', extension: 'mp4', mime: 'video/mp4', codec: 'avc1.42001f' },
  { id: 'vp9', label: 'WebM · VP9', extension: 'webm', mime: 'video/webm', codec: 'vp09.00.10.08' },
  { id: 'vp8', label: 'WebM · VP8', extension: 'webm', mime: 'video/webm', codec: 'vp8' },
];
export async function detectExportFormats(): Promise<ExportFormat[]> {
  if (!isSecureContext || typeof VideoEncoder === 'undefined') return [];
  const { canEncodeVideo, Quality } = await import('mediabunny');
  const supported = await Promise.all(FORMATS.map(async f => {
    try { return await canEncodeVideo(f.id, { width: 1280, height: 720, quality: new Quality({ bitrate: 5_000_000 }), fullCodecString: f.codec, latencyMode: 'quality' }); } catch { return false; }
  }));
  return FORMATS.filter((_, i) => supported[i]);
}

export async function encodeFilm(scene: StudyScene, project: FilmProject, format: ExportFormat, signal: AbortSignal, progress: (frame: number, frames: number) => void) {
  const { Output, BufferTarget, Mp4OutputFormat, WebMOutputFormat, CanvasSource, Quality } = await import('mediabunny');
  const capture = scene.captureSession(1280, 720);
  const output = new Output({ target: new BufferTarget(), format: format.id === 'avc' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat() });
  const frames = Math.round(totalDuration(project) * FPS);
  try {
    const source = new CanvasSource(scene.renderer.domElement, { codec: format.id, fullCodecString: format.codec, quality: new Quality({ bitrate: 5_000_000 }), latencyMode: 'quality', keyFrameInterval: 1 });
    output.addVideoTrack(source, { frameRate: FPS });
    output.setMetadataTags({ title: project.name });
    await output.start();
    for (let frame = 0; frame < frames; frame++) {
      signal.throwIfAborted();
      const frameStarted=performance.now();
      const sample = sampleFilm(project, frame / FPS);
      capture.render(sample.camera);
      signal.throwIfAborted();
      await source.add(frame / FPS, 1 / FPS, { keyFrame: frame === 0 || sample.progress === 0 });
      progress(frame + 1, frames);
      // A zero-delay task alone can starve browser input during software GPU readback.
      // Slow frames leave a real input/paint window; timestamps and pixels stay unchanged.
      await new Promise<void>(r => setTimeout(r, performance.now()-frameStarted>100?50:0));
    }
    signal.throwIfAborted();
    await output.finalize();
    signal.throwIfAborted();
    if (!output.target.buffer?.byteLength) throw new Error('编码没有生成有效文件，请尝试另一种格式。');
    return new Blob([output.target.buffer], { type: format.mime });
  } catch (error) { await output.cancel().catch(() => {}); throw error; }
  finally { capture.close(); }
}
