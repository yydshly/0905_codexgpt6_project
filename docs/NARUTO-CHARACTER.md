# 鸣人角色接入

本轮直接使用作者公开分享的鸣人模型，不再用程序拼装的青年头像冒充鸣人。新建导览默认选择「鸣人 · 动漫角色」；旧存档保留原有角色，左侧「角色形象」可切换。

## 运行与操作

Windows / Node.js 22：在仓库目录运行 `npm ci`、`npm run dev`，打开 `http://127.0.0.1:5173/?workspace=guide`。左侧设置中选择「移动方式 → 忍者跑 · 双臂后展」，点击播放。选择第三段后，「看坐下／看坐姿／看站起」可以定位相应动作。滚动左侧面板可看到全部设置，底部时间轴始终保留。

默认移动方式为「自然行走」。步行使用按路程计算的左右落脚点、低抬脚和支撑脚约束；身体重心按腿长调整，转身时依次抬脚。预览按显示帧的连续时间更新，视频仍按 30 fps 对同一个动作采样。暂停时的精确时间会随工程保存，刷新恢复不会再取整到相邻视频帧。运行测量与最新视频见 [步行优化验收](walk-refinement-evidence/README.md)。

`npm run build:pages` 生成 GitHub Pages 仓库子路径版本；角色 GLB 使用本地资源，不依赖素材网站运行。网页已有保存、历史、JSON、视频和独立网站包导出入口。

## 素材来源与改动

| 部分 | 来源与归属 |
| --- | --- |
| 鸣人模型、服装、头发、UV 贴图、内翻描边壳 | **ronildo.facanha**：[Naruto & Sasuke Low Poly + Rig + Texture](https://sketchfab.com/3d-models/naruto-sasuke-low-poly-rig-texture-b650b60a7bbd4f11b05a435e65116168)。作者页面标记 **CC BY 4.0**，公开提供 [原始项目文件夹](https://drive.google.com/drive/folders/1shRpOCStbGUtf4AFzzhWPDbuy6DxO61b)。本项目只使用其中 Naruto，不分发 Sasuke。 |
| 动作骨架、Idle / Walk / Jog、Sitting Enter / Idle / Exit | Quaternius Universal Animation Library Standard，CC0；沿用本项目已有资源。原包 Anim_Naruto 是战斗待机，不应声称它包含全部导览动作。 |
| 本项目新增工作 | 修复 FBX 的失效贴图路径；将 Rigify 权重合并并适配统一骨架；保留作者的几何、UV、服装和描边；分离脚底接触检查；添加按距离采样的忍者跑、双臂后展、介绍前招手；适配已有阅读、坐起、转身和网站发布流程。 |

模型许可与 Naruto 角色本身的权利是不同事项。CC BY 模型标注不能证明 Naruto 角色的商业使用授权；这不是自有个人 IP。后续个人品牌正式发布应使用获得相应授权的角色或原创角色。来源、许可链接、修改说明随网站包的 LICENSES.txt 一起分发。

## 数据和复用

- 新角色 ID：`naruto-author-01-v1`，资源 `src/assets/guide/naruto-author-01.glb`。旧的三个角色文件没有替换。
- 工程外层版本仍为 1；角色设置升级为 **5**，新增 `movement: "walk" | "ninja"`。读取 v1–v4 时补充 `walk`，保留原房间、角色、名字与段落；非法移动方式不覆盖当前方案。
- `sampleGuide` 根据同一工程计算路径、速度、步态相位；`createGuideCharacter` 按绝对时间计算动画与 IK。播放、拖动、视频、访客网页共用此路径，不存在另做的导出演示。
- 独立网站包包含当前所选角色与共享坐起动作文件，保留作品关联与移动方式。网站包的运行文件包含招手、拿书、椅子对齐和忍者跑姿态适配。
- 单独加载角色 GLB 可得到 Idle、Walk、Run 三个骨骼片段；坐起片段在共享 `guide-motion-v1.glb` 中。拿书、招手、路径和椅子对齐属于运行逻辑，不能只复制一个 GLB 就得到完整导览。
- 本次步行修正没有修改 GLB、贴图和工程版本；`guide-gait.ts` 的落脚规划与 `adult-character.ts` 的腿部求解属于网页运行逻辑。使用导出的网站包即可带走这些改进；只加载原 GLB 的 Walk 片段不会自动获得脚步约束。
- 可编辑 Blender 源文件：`docs/anime-character/source/naruto-adapted.blend`。制作脚本：`scripts/build-naruto-avatar.py`。重建需将作者公开 ZIP 解压至 `.scratch/assets/naruto-author`，并保留已有 Quaternius Standard 资源。

## 本版边界

这是已有作者的低模动漫资源接入，非电影级重制。脸部使用作者 128×128 的 `smiling.png` 固定表情，没有眨眼、口型、视线骨骼或面部表演；近距离能看到纹理分辨率与几何棱角。没有战斗编排、忍术、配音、布料或发丝模拟。跑步腿部使用外部 Jog 动作，后展手臂与招手由本项目适配；没有声称动作源自火影动画制作方。

真实运行证据、视频、设备与测量结果见 `naruto-guide-evidence/`。手机端可查看，但首轮完整编辑与性能验收以桌面 Chrome 为准。
