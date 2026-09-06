import { guideAvatars } from './guide-avatars';
import { unzipSync, strToU8, zip } from 'fflate';
import { createSitePackage } from './site-export';
import { parseGuideProject, type GuideProject } from './guide-model';
import { MAX_JSON_BYTES } from './model';

export async function createGuideSitePackage(raw: GuideProject) {
  const guide = parseGuideProject(raw);
  const base = await createSitePackage(guide.project);
  const files = unzipSync(new Uint8Array(await base.arrayBuffer()));
  const avatarFile = guideAvatars[guide.guide.avatar].file;
  const avatar = await fetch(import.meta.env.BASE_URL + 'site-kit/assets/' + avatarFile);
  if (!avatar.ok) throw new Error('角色模型文件暂不可用，请重新构建发布模板。');
  const avatarBytes = new Uint8Array(await avatar.arrayBuffer());
  if (avatarBytes.byteLength < 20 || new DataView(avatarBytes.buffer).getUint32(0, true) !== 0x46546c67) throw new Error('角色模型文件无效，未生成网站包。');
  files['assets/' + avatarFile] = avatarBytes;
  const motion = await fetch(import.meta.env.BASE_URL + 'site-kit/assets/guide-motion-v1.glb');
  if (!motion.ok) throw new Error('动作文件暂不可用，请重新构建发布模板。');
  const motionBytes = new Uint8Array(await motion.arrayBuffer());
  if (motionBytes.byteLength < 20 || new DataView(motionBytes.buffer).getUint32(0, true) !== 0x46546c67) throw new Error('动作文件无效，未生成网站包。');
  files['assets/guide-motion-v1.glb'] = motionBytes;
  // Reuse the publisher's privacy filtering: only bound, public works leave the editor.
  guide.project = JSON.parse(new TextDecoder().decode(files['project.json']));
  guide.playhead = 0; guide.selected = 0;
  files['project.json'] = strToU8(JSON.stringify(guide, null, 2));
  if (files['project.json'].byteLength > MAX_JSON_BYTES) throw new Error('导览工程超过 6 MB，请减少照片或封面。');
  files['导览说明.txt'] = strToU8('这是 3D 角色导览网站（工程封装 v1，角色设置 v5）。房间、作品、角色设置和最多三个动作段落全部来自 project.json。访客无需编辑器、本地存档或登录。解压后通过 HTTP(S) 服务器打开，或按部署说明发布到 GitHub Pages。\n\n点击播放可观看完整导览；点击书籍或屏幕标记会从对应段落起点播放，再打开作品详情。段落跳转是时间轴定位；目前不支持从任意姿态连续转场。坐下段落会走到所选椅子前，转身、坐下阅读并站起；被家具挡住时会提示，需在编辑器调整椅子。直接查看作品可跳过动作。角色阅读的是随身手册，不会从桌面取走书本。\n\n尊重系统减少动态效果设置：点击物品直接查看作品。默认不自动播放，无声音；不会自动打开外部链接。鸣人形象由 ronildo.facanha 制作，按 CC BY 4.0 标注；这是已有动漫角色，不能视为自有个人 IP。鸣人设置支持自然行走与忍者跑；移动方式也保存在 project.json。鸣人的面部是原作者绘制的固定表情贴图。其他青年角色以 18 岁青年为设计基准。鸣人的头发、服装、手部、贴图和描边来自 ronildo.facanha。统一动作骨架及行走、跑步、坐下、坐姿、站起片段来自 Quaternius CC0 资源；本项目适配招呼、拿书与双臂后展。个人 IP 样版另制头脸、发型、眼镜、外衬衫与表情；旧版角色保留原有头脸资源。修改和归属见 LICENSES.txt。网站只附带 project.json 中所选的角色 GLB，资源位于 assets/，不依赖外部模型服务。网站不提供编辑器或保存功能。');
  const bytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => zip(files, { level: 6 }, (error, result) => error ? reject(error) : resolve(result)));
  return new Blob([bytes], { type: 'application/zip' });
}
