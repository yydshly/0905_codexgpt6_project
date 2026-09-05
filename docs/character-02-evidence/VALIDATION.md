# 个人 IP 02 · 实际验收

2026-09-06（Asia/Shanghai）。本目录为最终模型的真实运行、导出和源文件检查结果。过程中修正了头顶体积过高、后脑及侧额头皮穿出、领口变形；迭代期间的文件由最终模型的完整重测结果替换。视觉与浏览器验收分别执行。

## 环境与操作

Windows 11、Chrome 152.0.7977.82、Node 22.15.0、Three.js 0.180.0、Vite 7.3.6、Playwright 1.62.1、Blender 4.5.3 LTS。使用 headless Chrome、隔离存储和本地 HTTP，在 Pages 仓库子路径 /0905_codexgpt6_project/ 测试；不是公开主站线上验收。

验证命令（PowerShell）：

~~~powershell
$env:GUIDE_EVIDENCE_DIR='docs/character-02-evidence'
npx playwright test --config playwright.pages.config.ts tests/guide.spec.ts tests/guide-motion.spec.ts tests/publish.spec.ts
# 启动 npm run dev 后分别运行：
node scripts/review-personal-avatar.mjs
node scripts/measure-guide.mjs
node scripts/verify-guide-avatar-export.mjs
~~~

最终 **14/14 通过，0 跳过、0 重试后通过、0 失败，用时 154.4 秒**。[机器可读测试记录](acceptance-results.json)。覆盖：

1. 打开默认 02 → 修改第二段为 6.5 秒、上衣配色和标题 → 播放/暂停与拖动 → 撤销重做 → 保存 → 刷新，工程数据一致。
2. 导出 JSON → 修改后重新导入；损坏 JSON、未知版本、错误物件与未知角色被拒绝，当前工程与存储保持完整。
3. 实际导出 MP4 → 下载 → 独立 HTTP 播放器打开 → 播放到结尾 → 对照同一时间点的预览。
4. 网站 ZIP 中的角色 GLB 与仓库最终资产逐字节相同，不包含未选择的旧模型；独立打开、作品入口与访客播放可用。
5. 01 的 v4 存档导入与刷新保持旧外观，切到 02 仅改变编号，撤销重做与保存刷新一致。旧基础青年与 v1/v2/v3 迁移继续验证。
6. 坐下、坐姿阅读和站起；椅子移动/旋转后髋部对齐、双脚接触及重复时间采样；阻挡座椅和缺失动作文件明确失败。
7. 加载期间锁定修改，覆盖加载失败、存储配额失败、取消导出、无编码器与无 WebGL。
8. 原有作品发布回归，全部 11 类物件整体仍可关联和点击。

其余房间、普通镜头短片及工程库完整套件本轮未在本机重跑；历史通过结果不作为本轮重测。

## 视觉检查

检查 1440×900、1280×800，以及独立人物 1000×1000。访客网页另有 390×844 的溢出/播放检查，不等同于手机完整编辑验收。

- character-before/front/three-quarter/side/back/above/full.png：同一角色加载器，中性背景和检查镜头；核查头脸、发底、鬓角、后发、镜框、全身与衣领，均为真实 Three.js 画面。
- 01..03：实际书房默认、阅读和介绍。两种桌面尺寸面板与时间轴可用，无横向溢出。
- 07..09、11..15：人物/房间多角度、正侧面、白昼/黄昏/深夜。
- motion-*：坐下、坐姿、站起和旋转座椅。最终后脑已无早期迭代的头皮穿出。
- 04..06：视频结果、下载文件重开和独立网站。

## 导出与一致性

[MP4](xiaohe-guide.mp4)：**26.5 秒，1280×720，30 fps，H.264，无音轨，15,310,161 bytes**。本机编码约 27.69 秒。实际检测支持格式后编码；其他环境可能回退 VP9/VP8 WebM 或明确显示不支持。

下载文件重新打开，解码尺寸和时长正确，播放到结尾，video.error 为空。整幅画面对照 1.5 / 5.5 / 13 / 20 / 25 秒，平均绝对像素误差约 1.31–1.55（0–255 通道值），包括坐姿与站起。人物头部/上身区域另取四帧，误差约 2.11–3.47；换旧角色的负对照约 11.87–13.69。压缩和缩放产生误差，没有宣称视频逐像素无损。[闭环记录](journey.json) · [人物区域复核](avatar-frame-check.json)。

[网站 ZIP](xiaohe-guide.website.zip)包含当前 GLB、原有坐姿文件、工程和运行时，并保留 Quaternius 许可与本轮制作说明。[网站记录](website.json) · [工程 JSON](verified-guide.json)。

## 性能与资产

性能在验收结束后单独测量，无其他自动化浏览器并发。GPU：Intel UHD Graphics，ANGLE / Direct3D11，DPR 1。1440×900 窗口，场景画布 996×560。

| 指标 | 本机实测 |
| --- | --- |
| 空缓存浏览器打开至 ready | 1,751 ms，本地无网络限速 |
| 2,002 ms 窗口内渲染 | 60 帧，约 29.96 fps；导览目标 30 fps |
| JS 渲染提交耗时 | 平均 3.01 ms，P95 3.90 ms |
| 场景三角形 / draw calls | 325,306 / 652，包含房间与后处理 |
| 暂停稳定后 600 ms 内重绘 | 0 |
| 未捕获浏览器错误 | 0 |

提交时间不是纯 GPU 耗时；本地速度和一台机器的帧率不能外推到互联网或所有设备。[性能原始记录](performance.json)。构建通过，仍有既有的大 JS chunk 提示。

新 GLB 7,448,408 bytes，67 骨骼、31 网格、20 材质。独立人物含运行时手册约 230,362 三角形 / 47 draw calls。模型含 Idle_Loop、Walk_Loop；坐姿三个 clip 来自独立文件。Blender 源文件已重新打开，110 独立网格、67 骨骼、两段 NLA 和 Blink / SoftSmile 存在。[源文件检查](blender-source-check.json) · [资产哈希](assets.json)。旧模型与坐姿文件哈希未变。

## 已知限制

这是可用的风格化版本，尚未作为最终个人 IP 美术定稿。发束连接、耳部、皮肤、肩部衣褶及手指仍可精修，极近景能看出程序建模的简化。深夜脸部较暗，沿用房间灯光，没有新增专用人像布光。

没有新增定制动捕、口型、头发/布料物理。基础动画仍为 Quaternius 素材，程序适配场景；单独角色 GLB 不包含运行时手册、完整座椅适配和作品业务。

未执行 Blender GUI 手工编辑验收、其他引擎接入、Safari/Firefox 全流程、手机 GPU 性能或公网部署测试。这些没有记为已完成。
