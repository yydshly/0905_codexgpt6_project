import { unzipSync, strToU8, zip } from 'fflate';
import { createSitePackage } from './site-export';
import { parseGuideProject, type GuideProject } from './guide-model';
import { MAX_JSON_BYTES } from './model';

export async function createGuideSitePackage(raw: GuideProject) {
  const guide = parseGuideProject(raw);
  const base = await createSitePackage(guide.project);
  const files = unzipSync(new Uint8Array(await base.arrayBuffer()));
  // Reuse the publisher's privacy filtering: only bound, public works leave the editor.
  guide.project = JSON.parse(new TextDecoder().decode(files['project.json']));
  guide.playhead = 0; guide.selected = 0;
  files['project.json'] = strToU8(JSON.stringify(guide, null, 2));
  if (files['project.json'].byteLength > MAX_JSON_BYTES) throw new Error('导览工程超过 6 MB，请减少照片或封面。');
  files['导览说明.txt'] = strToU8('这是角色导览 v1 原型网站。房间、作品、角色设置和两个动作段落全部来自 project.json。访客无需编辑器、本地存档或登录。解压后通过 HTTP(S) 服务器打开，或按部署说明发布到 GitHub Pages。\n\n点击播放可观看完整导览；点击书籍或屏幕标记会从对应段落起点播放，再打开作品详情。段落跳转是时间轴定位；目前不支持从任意姿态连续转场。直接查看作品可跳过动作。角色阅读的是随身手册，不会从桌面取走书本。\n\n尊重系统减少动态效果设置：点击物品直接查看作品。默认不自动播放，无声音；不会自动打开外部链接。角色与动作由本项目程序制作，无外部角色资产。网站不提供编辑器或保存功能。');
  const bytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => zip(files, { level: 6 }, (error, result) => error ? reject(error) : resolve(result)));
  return new Blob([bytes], { type: 'application/zip' });
}
