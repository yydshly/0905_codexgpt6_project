# 自然步行优化验收 · 2026-09-06

本次在 `codex/anime-character` 上修正自然步行与预览流畅度，基线提交为 `a147579`。沿用 ronildo.facanha 的鸣人模型和 Quaternius 的基础动作；没有重做模型、发型、贴图或面部，也没有替换旧角色文件。

## 改动与原因

- 预览原来将时间取整到 30 帧。现在按每个显示帧的连续时间计算角色和镜头，文字每 100 毫秒刷新，暂停后立即同步时间显示。视频仍使用同一个采样器以 30 fps 编码。
- 自然步行按实际路程规划左右落脚点，支撑阶段锁定脚踝，抬脚约 6 厘米，结束时补齐最后一步。身体的起停速度平滑变化，手持书本的手臂随身体小幅摆动。
- 导入角色有非均匀缩放，原世界坐标下的腿部旋转计算产生脚踝抖动。现在在骨架坐标中求解腿部；重心按腿长适度下沉，避免支撑腿过伸。
- 步行完成腿部约束后，不再通过移动整个角色来修正脚底。其他动作保留脚底校正，但只检查预先选好的鞋底顶点；转身依次抬脚，地毯边缘高度平滑过渡。
- 保存保留连续播放头的精确时间。工程结构仍为外层 v1、角色设置 v5，v1–v4 迁移和旧角色外观保留。

关键代码：`src/guide-gait.ts`、`src/guide-model.ts`、`src/adult-character.ts`、`src/guide-view.ts`。这些运行逻辑包含在独立网站包中；单独复制 GLB 的 Walk 片段不包含本次脚步约束。

## 真实操作与交付物

在 GitHub Pages 仓库子路径构建下，16 项真实浏览器用例通过，0 跳过、0 失败。见 [browser-results.json](browser-results.json)。

完整流程：打开默认角色导览 → 修改第二段时长和配色、名字 → 撤销重做 → 播放暂停、拖动播放头 → 保存刷新 → JSON 导出并重新导入 → 实际生成视频 → 下载后在独立页面打开 → 五个时间点对比 → 播放到结束。

- [实际导出 MP4](xiaohe-guide.mp4)：26.5 秒、1280×720、30 fps、H.264、无音轨，17,207,052 字节。生成耗时 27.84 秒；下载文件完整播放结束，无解码错误。文件名沿用验收脚本，工程中的角色名字也由测试修改。
- [完整流程记录](journey.json)：1.5、5.5、13、20、25 秒，预览与解码视频的全画面平均像素差异为 1.44–1.78 / 255。
- [角色区域比对](avatar-frame-check.json)：四个时间点的头部／上身差异为 3.70–5.11 / 255；切换旧角色作为反例时差异为 21.58–23.37，确认导出的是当前角色和动作。
- [可编辑工程](verified-guide.json)、[独立网页 ZIP](xiaohe-guide.website.zip)、[网页验证](website.json)：保留作品链接、署名与移动设置，脱离编辑器可运行。网站包与编辑器同一时间的自然步行姿态额外进行精确比对。
- [实际播放头操作](walk-browser-checks.json)：82 次通过界面取得的姿态，85 对支撑脚采样通过 1 毫米漂移阈值；任意跳转后姿态一致；连续时间暂停、保存刷新后时间和全部骨骼姿态一致。
- [坐起检查](motion-checks.json)：椅子改变位置／朝向后的坐姿、脚底接触、坐下与站起、受阻保护均通过。旧角色、旧版本、失败保存、无编码、无 WebGL 降级也在本轮浏览器验收中检查。

## 视觉检查

以下是实际 Three.js 页面截图，未使用设计稿替代。检查 1440×900、1280×800、侧面、背面、近景、俯视与三种光照；时间轴和操作按钮可用。左侧设置面板需要滚动，这是既有布局。

![1440×900 步行](walk-room-1440x900.png)
![1280×800 步行](walk-room-1280x800.png)
![实际坐姿](motion-seated-close-1280x800.png)

`walk-studio-*.png` 是同一角色加载器和同一时间采样器在检查用地面上的实际 3D 渲染，用于看清双腿；检查场景不是产品的导出场景。真实书房视频来自页面里的导出按钮。

## 测量环境与结果

Windows、Node.js 22.15.0、Chrome 152.0.7977.82，Intel UHD Graphics / ANGLE Direct3D11。隔离的无头浏览器、1440×900，画布 996×560，像素倍率 1。未模拟弱网或移动设备；以下不代表用户嵌入式浏览器进程或其他硬件的固定帧率。

| 同一 5.5 秒测量方法 | 原版 | 修正后 |
| --- | ---: | ---: |
| 实际场景渲染帧率 | 30.00 fps | 68.94 fps |
| 帧间隔 P95 | 33.5 ms | 16.8 ms |
| 60 Hz 网格的 240 次请求中，重复的采样时间 | 119 | 0 |
| 前 4 秒中，相邻样本的根部地面校正最大变化 | 16.82 mm | 0.52 mm |

记录见 [pacing-comparison.json](pacing-comparison.json)。统计通过每个动画帧读取场景实际渲染计数，丢弃开头两次间隔；不把浏览器空转的动画回调当作渲染帧。另一次两秒测量为 71.26 fps，JS 渲染提交均值 3.58 ms、P95 5.20 ms，暂停 600 毫秒内 0 次渲染，见 [performance.json](performance.json)。JS 提交耗时不是独立 GPU 耗时。

[gait-measurements.json](gait-measurements.json) 汇总完整 28 秒、60 Hz 的 1,681 个骨骼采样，逐帧数据在 [gait-frames.csv](gait-frames.csv)。574 对相邻步行支撑采样的脚踝漂移处于数值误差范围；实际鞋底顶点相对规划地面的最小间隙为 0.98–3.38 毫米，没有测得支撑脚底穿入规划地面。此指标只评价已检查路线的步行阶段，不代表所有自定义路线、转身或坐起阶段都已做脚掌锁定。

## 复现

```powershell
npm ci
npm run dev
# 浏览器打开 http://127.0.0.1:5173/?workspace=guide，选择「自然行走」。

# 另一个终端运行；使用独立浏览器数据，不覆盖用户工程。
$env:GUIDE_EVIDENCE_DIR='test-results/walk-review'
npx playwright test --config playwright.pages.config.ts tests/guide.spec.ts tests/guide-motion.spec.ts tests/naruto.spec.ts tests/walk.spec.ts tests/publish.spec.ts
node scripts/review-walk.mjs
node scripts/measure-guide.mjs
node scripts/verify-guide-avatar-export.mjs
```

## 限制

- 仍然是低模角色与通用基础动作的运行时适配。固定表情、服装权重、手指动作和大角度转身仍达不到动漫电影的人物表演质量。本轮没有新增面部、布料、头发或动作捕捉资产。
- 修正后仍测得一次约 79 毫秒的长帧；负载和显卡会影响流畅度，不承诺每台机器稳定 60 fps。
- 导出视频仍为 30 fps；编码格式由浏览器实际检测。此次实际验证 H.264 MP4；Safari、Firefox、真实手机及其他编码格式未在本轮重新验证。
- 自定义房间路径仍采用现有简化通行区域，没有完整人体碰撞或复杂足部接触模拟。模型 GLB 和共享动作 GLB 的 SHA-256 未变，见 [artifact-hashes.json](artifact-hashes.json)。
- 本轮提交在独立角色分支，不代表已部署到 main 的 GitHub Pages。
