# 小禾 · 18 岁青年角色升级

2026-09-06，独立分支 `codex/character-guide`，相对于 `7de09b1` 的增量。以 18 岁成年青年为设计基准，采用短发、圆领上衣、深色长裤和浅色鞋的风格化青年创作者形象。此处的年龄是角色设定，不是对真人年龄的识别。本分支未合并或部署到主站。

## 打开与使用

```sh
git switch codex/character-guide
npm ci
npm run dev
# http://127.0.0.1:5173/?workspace=guide
```

运行需要 Node.js 22.12+ 和支持 WebGL 2 的桌面浏览器。正常启动不需要 Blender、不需要素材站账号或 API。角色文件已经包含在源码中。

- 点击「角色近景」检查脸部、衣服和手部；可拖动观察侧面。「恢复导览镜头」回到当前时间对应的作品构图，播放也会恢复导览镜头。
- 点击播放或拖动播放头，观看携带手册、行走、阅读和屏幕介绍。上衣颜色、角色名字、段落顺序及时间仍可编辑。
- 原有撤销重做、本地保存、刷新恢复、JSON、视频、独立网站包及作品入口保留。默认 2 段、16 秒，默认暂停。
- 近景属于临时观察，不改工程、不替换导出镜头。视频仍由同一导览采样器逐帧生成。

## 相对上一版的变化

上一版用球、胶囊和分段关节组合角色。当前改为 **67 个骨骼、17 个蒙皮网格**的连续人体与服装，接入来源明确的基础动作。

| 项目 | 当前实现 |
| --- | --- |
| 造型 | 收窄基础体型、调整头身关系和下颌、深棕短发；制作上衣、长裤、鞋子及领口细节；约 1.76 m 的成年身高 |
| 面部 | 眼部关节跟随注意目标、眨眼 morph、轻微表情目标；头部随阅读和介绍变化 |
| 行走 | 使用骨骼动画，以路径行进距离驱动步态；保留避开静态家具的路径规划，按最低鞋底补偿落地 |
| 阅读 | 手册持续携带，从合拢过渡到展开；双臂使用两节骨骼 IK，手腕随持书位置调整；确定性翻页 |
| 介绍 | 根据当前绑定屏幕的真实位置调整手势和视线；微调机位，减小人物和标记的重叠 |
| 可重复性 | 每次从原始姿态和动画关键帧采样，再应用 IK、表情和地面补偿。无随机数或逐次累积姿态 |
| 加载失败 | 显示加载失败信息，禁用播放与视频导出，仍可保存或下载 JSON；不会导出一个缺少人物的“成功视频” |

## 数据迁移与发布

外层 `ideal-study-guide / version: 1` 和本地键名保持不变；内部升级为 `guide.version: 2`、`guide.avatar: creator-18-v1`。解析旧 `guide.version: 1` 时补充新版角色标识，保留名字、配色、房间、作品关联、段落、顺序与播放位置。只有点击保存才写回本地；未知角色版本拒绝导入。原版 Plan、FilmProject 和工程库版本没有改动。

编辑器用 Vite 的散列 GLB 地址，导览网站包用随包的 `assets/creator-18.glb`。不请求外部模型服务。普通个人作品网站包不带角色文件；共用运行时只有打开导览工程才请求模型。网站包仍可解压并部署到根路径或 GitHub Pages 仓库子路径。

单独的角色 GLB 包含人体、服装、骨骼、表情目标和基础待机/行走动画。阅读、介绍、持书、导航及作品点击需要配套的 `adult-character.ts`、`guide-model.ts` 和导览运行时；不能把单个 GLB 当作完整的可执行导览工程。原房间的 GLB 导出保持原有范围。

## 资源来源与修改记录

| 外部内容 | 作者、官方来源 | 许可 |
| --- | --- | --- |
| `Superhero_Male_FullBody`、眼睛、眉毛、`Hair_SimpleParted`、皮肤/眼睛/头发贴图 | Quaternius，[Universal Base Characters](https://quaternius.itch.io/universal-base-characters)，下载免费的 Standard 包 | CC0 1.0 |
| `Idle_Loop`、`Walk_Loop` | Quaternius，[Universal Animation Library](https://quaternius.itch.io/universal-animation-library)，下载免费的 Standard 包 | CC0 1.0 |
| 资产加工工具 | [Blender 4.5 LTS](https://www.blender.org/releases/4-5/)，本次使用官方 Windows 4.5.3 便携版 | GPL；仅开发工具，不随网页分发 |

原始人体、发型、贴图和基础动作的质量归属于 Quaternius。**本项目的工作**是体型与材质调整、基础骨骼适配、服装和鞋子加工、UV 接缝焊接与隐藏面清理、眼部骨骼和表情目标、贴图尺寸优化、GLB 打包，以及阅读/介绍动作、手册和产品集成。未购买或使用付费 Source/Pro 包；未使用 AI 图片假装可编辑人物。

原始许可保存在 `src/assets/guide/QUATERNIUS-BASE-LICENSE.txt`、`QUATERNIUS-ANIMATION-LICENSE.txt`；应用与网站包的 `LICENSES.txt` 包含来源说明。模型体积 7,427,696 bytes。

SHA-256：

```text
Universal Base Characters Standard ZIP:
fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40
Universal Animation Library Standard ZIP:
cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724
src/assets/guide/creator-18.glb:
96c330f5fe50609c72525fc70c088af8fd6e253eea21f119e8f7567589c123f7
```

重新加工模型不是运行应用的必要步骤。开发者可将两个免费 Standard 包解压到同一资产目录（保留包目录结构），然后运行：

```sh
blender --background --python scripts/build-guide-avatar.py -- /absolute/path/to/assets
npm run build
```

脚本通过递归文件名找到原始 GLTF/GLB 和发型，修复免费包内两处 normal-map 文件名差异。输出 `src/assets/guide/creator-18.glb`。原始 ZIP 与 Blender 程序不提交到仓库；修改资源后应重新执行浏览器验收。

## 实际验证与证据

最终青年导览套件 **6/6 通过**（GitHub Pages 仓库子路径构建）；共用发布链路 **4/4 通过**。原版其余 35 项此次没有全部重跑，上版 39 项记录仅作为历史证据。

已在真实 Chrome 中完成：默认作品 → 修改第二段时长、名字、上衣配色 → 撤销/重做 → 播放/暂停/拖动 → 本地保存 → 刷新一致 → JSON 导出及重新导入 → 视频生成 → 下载后独立打开并播放到结束。网站 ZIP 在独立存储环境和 `/demo/` 子路径中打开并继续点击作品。另验证旧导览迁移、未知角色拒绝、骨骼姿态重复采样、眨眼、近景恢复、模型加载失败保留 JSON。

新增测试最初因自动化 `fill()` 不接受非整十帧小数的 range 值失败两次；改为浏览器真实方向键逐帧推进后通过。没有把这两次失败记为产品通过。之后为屏幕构图和配色修正重新执行全部 6 个导览测试。

证据在 [adult-guide-evidence](adult-guide-evidence/)，与旧角色证据分开保存：

- 12 张真实运行截图：两种桌面尺寸、阅读、介绍、近景、正面、侧面、俯视、导出回放及独立网站。
- [实际导出 MP4](adult-guide-evidence/xiaohe-guide.mp4)：H.264，1280×720、30 fps、14.5 秒，无音轨；7,414,066 bytes，编码约 13.84 秒。文件重新播放至结尾无错误。
- [独立网站 ZIP](adult-guide-evidence/xiaohe-guide.website.zip) 和 [导览 JSON](adult-guide-evidence/verified-guide.json)。
- [逐帧比对与操作记录](adult-guide-evidence/journey.json)：1.5、5.5、10、13 秒的视频与预览缩至 160×90 后，RGB 平均绝对误差分别约 1.53、1.40、1.38、1.25 / 255；视频有损编码因此不要求像素完全相等。
- [角色与迁移验证](adult-guide-evidence/adult-avatar.json)、[网站验证](adult-guide-evidence/website.json)、[性能](adult-guide-evidence/performance.json)。

实际环境：Windows 11、Chrome 152.0.7977.82（headless 测试）、Playwright 1.62.1、Three.js 0.180.0、Intel UHD / ANGLE D3D11；1440×900 与 1280×800。模型还在 Codex 内置浏览器实际检查。单机测量：约 **29.95 fps**，渲染提交平均 **4.79 ms**、P95 **6.5 ms**，暂停 600 ms 内 0 次额外渲染；默认 1440 窗口中画布约 996×560、DPR 1。新浏览器上下文本地开发服务加载到可操作约 3.41 秒。提交计时不等于独立 GPU 耗时，本地加载不代表公网下载速度。

## 已知限制

- 当前是风格化青年基础版，脸型和衣服仍有低多边形资产的特征；表情、领口及手指细节没有达到定制雕刻与手工动画精修水平。不是照片级数字人，也不保证精确肖似某个真人。
- 目前只编排两个动作。携带的是随身手册，没有从桌面抓取实体书，也没有语音、口型、布料模拟、坐下或自主生活系统。
- 手部 IK 和最低鞋底补偿用于现有房间展示，不是完整全身物理与足部 IK。极近观察或人为拥挤布局仍有手指/服装小穿插风险；无可达路径会阻止播放。
- 角色约 7.1 MiB；首次进入导览需要加载它，弱网和低端设备需要进一步优化。普通作品页不加载模型。
- 此次实际编码验证是 Chrome H.264。其他浏览器/设备及其他编码格式未在本轮全面重测；运行时继续检测实际支持能力，不提供假导出成功提示。
- 分支尚未发布到 GitHub Pages；线上主站仍是原发布版本。CI 结果以对应提交的 GitHub 检查为准。
