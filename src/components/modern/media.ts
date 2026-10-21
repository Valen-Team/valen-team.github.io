export type MediaKind = 'image' | 'video';
export type Attachment = {kind: MediaKind; name: string; preview: string; image: string; video?: string; objectUrl?: string; size?: number};
export const imageAccept = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
export const videoAccept = '.mp4,.webm,video/mp4,video/webm';
export class MediaError extends Error {
  constructor(public code: 'format' | 'size' | 'decode' | 'timeout') {super(code);}
}
export function fileKind(file: Pick<File, 'name' | 'size' | 'type'>): MediaKind {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const image = ['jpg', 'jpeg', 'png', 'webp'].includes(extension || '');
  const video = ['mp4', 'webm'].includes(extension || '');
  if ((!image && !video) || (file.type && !(image ? ['image/jpeg', 'image/png', 'image/webp'] : ['video/mp4', 'video/webm']).includes(file.type))) throw new MediaError('format');
  if (file.size > (image ? 3 : 20) * 1024 * 1024) throw new MediaError('size');
  return image ? 'image' : 'video';
}
function eventOnce(target: HTMLVideoElement | HTMLImageElement, event: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {clearTimeout(timer); target.removeEventListener(event, success); target.removeEventListener('error', failure); signal.removeEventListener('abort', abort); error ? reject(error) : resolve();};
    const success = () => finish();
    const failure = () => finish(new MediaError('decode'));
    const abort = () => finish(new DOMException('Aborted', 'AbortError'));
    const timer = window.setTimeout(() => finish(new MediaError('timeout')), 20000);
    target.addEventListener(event, success, {once: true}); target.addEventListener('error', failure, {once: true}); signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) abort();
  });
}
function jpeg(source: CanvasImageSource, width: number, height: number): string {
  if (!width || !height) throw new MediaError('decode');
  const scale = Math.min(1, 1024 / Math.max(width, height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d'); if (!context) throw new MediaError('decode');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.86);
}
export async function readAttachment(file: File, signal: AbortSignal): Promise<Attachment> {
  const kind = fileKind(file); const url = URL.createObjectURL(file);
  try {
    if (kind === 'image') {
      const img = new Image(); const loaded = eventOnce(img, 'load', signal); img.src = url; await loaded;
      const image = jpeg(img, img.naturalWidth, img.naturalHeight);
      return {kind, name: file.name, preview: url, image, objectUrl: url, size: file.size};
    }
    const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto';
    try {
      const loaded = eventOnce(video, 'loadeddata', signal); video.src = url; await loaded;
      if (!Number.isFinite(video.duration) || video.duration <= 0) throw new MediaError('decode');
      const middle = video.duration / 2;
      if (middle > 0.01) {const seeked = eventOnce(video, 'seeked', signal); video.currentTime = middle; await seeked;}
      const image = jpeg(video, video.videoWidth, video.videoHeight);
      return {kind, name: file.name, preview: image, image, video: url, objectUrl: url, size: file.size};
    } finally {video.removeAttribute('src'); video.load();}
  } catch (e) {URL.revokeObjectURL(url); throw e;}
}
