import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

export type CharacterLoadOptions = { signal?: AbortSignal; onStage?: (stage: string) => void };

/** These assets belong to one character instance; never dispose the room's shared assets. */
export function disposeCharacterScene(root: T.Object3D, extra: Iterable<T.BufferGeometry | T.Material | T.Texture> = []) {
  const resources = new Set<T.BufferGeometry | T.Material | T.Texture | T.Skeleton>(extra);
  const bitmaps = new Set<ImageBitmap>();
  root.removeFromParent();
  root.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    resources.add(o.geometry);
    if (o instanceof T.SkinnedMesh) resources.add(o.skeleton);
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof T.Texture) resources.add(value);
    }
  });
  for (const resource of resources) {
    if (resource instanceof T.Texture) {
      const data = resource.source.data;
      for (const image of Array.isArray(data) ? data : [data]) {
        if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) bitmaps.add(image);
      }
    }
    resource.dispose();
  }
  bitmaps.forEach(bitmap => bitmap.close());
}

/** Bound both download and decoding. A late decoder result is released after cancellation. */
export async function loadCharacterGLTF(url: string, label: string, options: CharacterLoadOptions): Promise<GLTF> {
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason ?? new DOMException('已取消角色加载。', 'AbortError'));
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new Error(`${label}加载超过 30 秒，请检查网络后重试。`)), 30000);
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
    if (controller.signal.aborted) rejectAbort();
  });
  const load = async () => {
    controller.signal.throwIfAborted();
    options.onStage?.(`正在下载${label}…`);
    let bytes: ArrayBuffer;
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`${label}下载失败（${response.status}），可重试或换一个角色。`);
      bytes = await response.arrayBuffer();
    } catch (error) {
      controller.signal.throwIfAborted();
      if (error instanceof TypeError) throw new Error(`${label}未能下载，请检查网络连接后重试。`);
      throw error;
    }
    controller.signal.throwIfAborted();
    options.onStage?.(`正在解析${label}…`);
    const gltf = await new GLTFLoader().parseAsync(bytes, new URL('.', new URL(url, location.href)).href);
    if (controller.signal.aborted) { disposeCharacterScene(gltf.scene); controller.signal.throwIfAborted(); }
    return gltf;
  };
  try { return await Promise.race([load(), aborted]); }
  finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', rejectAbort);
  }
}
