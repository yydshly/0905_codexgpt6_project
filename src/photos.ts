import type { Plan } from './model';

const images = new Map<string, HTMLImageElement>();
export function photoImage(data: string) { return images.get(data); }
async function decode(data: string) {
  const image = new Image(); image.src = data;
  try { await image.decode(); } catch { throw new Error('照片无法解码，请使用有效的 JPG、PNG 或 WebP 图片。'); }
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 8192 || image.naturalHeight > 8192) throw new Error('照片尺寸过大，请使用边长不超过 8192 像素的图片。');
  return image;
}
export async function preparePhotos(plan: Plan) {
  const pending = new Map<string, HTMLImageElement>();
  for (const data of new Set([...plan.objects.flatMap(o => o.photo ? [o.photo] : []),...plan.portfolio.projects.flatMap(w=>w.cover?[w.cover]:[])])) {
    if (images.has(data)) continue;
    const image = await decode(data);
    if(image.naturalWidth>1024||image.naturalHeight>1024)throw new Error('工程照片须为应用处理后的 1024 像素以内图片。');
    pending.set(data,image);
  }
  pending.forEach((image,data)=>images.set(data,image));
}
export function prunePhotos(plan:Plan) {
  const active=new Set(plan.objects.flatMap(o=>o.photo?[o.photo]:[]));
  for(const key of images.keys())if(!active.has(key))images.delete(key);
}
export async function readPhoto(file: File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('请选择不超过 8 MB 的 JPG、PNG 或 WebP 图片。');
  const url=URL.createObjectURL(file);
  try {
    const image=await decode(url),canvas=document.createElement('canvas');
    const scale=Math.min(1,1024/Math.max(image.naturalWidth,image.naturalHeight));
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f0e9d9';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    let quality=.86,data=canvas.toDataURL('image/jpeg',quality);
    while(data.length>450000&&quality>.35){quality-=.1;data=canvas.toDataURL('image/jpeg',quality);}
    if(data.length>450000)throw new Error('照片内容过大，请选择更小的图片。');
    images.set(data,await decode(data));return data;
  } finally { URL.revokeObjectURL(url); }
}
