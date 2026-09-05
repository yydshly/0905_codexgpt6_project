# 人物运动验收记录

2026-09-06（Asia/Shanghai）。截图来自实际 Three.js 页面；视频为浏览器真实编码并下载的文件。

## 连续流程

最终 **13 / 13 通过**，无跳过、无重试通过；完整名称、状态、资产散列见 [acceptance.json](acceptance.json)。从 GitHub Pages 的仓库子路径执行：

```powershell
$env:GUIDE_EVIDENCE_DIR='docs/motion-guide-evidence'
npx playwright test --config playwright.pages.config.ts tests/guide.spec.ts tests/guide-motion.spec.ts tests/publish.spec.ts
node scripts/measure-guide.mjs
```

实际执行：打开默认作品 → 修改第二段时长和配色 → 撤销重做 → 播放暂停与拖动 → 保存 → 刷新精确恢复 → JSON 下载、重新导入 → 导出视频 → 打开下载文件 → 比较同帧 → 播放到结尾。见 [journey.json](journey.json)。

坐姿专项：修改第三段时长、撤销重做、查看坐下 / 坐姿 / 站起、重复定位得到相同骨骼姿势、保存刷新、v3 保留原段落后手动添加坐姿、交换顺序、移动和旋转真实椅子、阻挡时禁用播放和视频导出、错误目标拒绝导入、动作文件加载失败保留 JSON。见 [motion-checks.json](motion-checks.json)。

初次专项测试因 Playwright 对 range 输入的浮点字符串格式校验失败；改为重复点击真实姿势按钮后重跑完整 13 项，全部通过。未把测试脚本失败当成产品成功跳过。

## 可检查的成果

- [实际导出 MP4](xiaohe-guide.mp4)：**26.5 秒、1280×720、30 fps、H.264、无音轨**，14,061,255 字节，编码 22.79 秒。独立 HTTP 页面打开下载文件、seek、播放到结束，video.error 为空。
- [对应导览 JSON](verified-guide.json)：包含完整房间、作品、角色和三个段落，可继续编辑。
- [个人 IP 独立网站包](xiaohe-guide.website.zip)：所选角色及动作 GLB 均在包内；在隔离存储、`/demo/` 子路径实际验证播放和作品链接。
- [旧角色网站包](legacy-avatar.website.zip)：v2 迁移后保留旧角色，不混入新角色资源。
- [网站记录](website.json)、[骨骼与加载记录](adult-avatar.json)、[文件散列](files.json)。

视频与预览在 1.5、5.5、13、20、25 秒比较同帧，覆盖坐姿和起身。缩至 160×90 后 RGB 平均绝对差为 1.30–1.62/255，保留编码、分辨率与抗锯齿差异，不要求压缩后像素完全相同。

默认新建示例为 28 秒；视频测试将第二段改为 6.5 秒，故视频和对应 JSON 为 26.5 秒。坐姿专项另将第三段改为 10 秒，部分截图显示 26 秒。这些是不同测试中的真实编辑结果。

## 实际截图

| 文件 | 内容 |
| --- | --- |
| [默认 1440×900](01-guide-default-1440x900.png) | 书房与三段时间轴 |
| [坐下 1440×900](motion-enter-1440x900.png) | 屈膝、前倾、座椅接触 |
| [坐姿 1440×900](motion-hold-1440x900.png) | 坐垫、双脚和手册 |
| [站起 1440×900](motion-exit-1440x900.png) | 收起手册后的起身 |
| [近景 1280×800](motion-seated-close-1280x800.png) | 坐姿与界面可用性 |
| [旋转椅子 1280×800](motion-rotated-chair-1280x800.png) | 对齐新位置和 70° 朝向 |
| [俯视](08-room-overhead.png) / [另一侧](09-room-alternate-angle.png) | 空间关系 |
| [下载视频实际打开](05-downloaded-guide-opened.png) | 文件重新播放 |
| [独立网站](06-independent-guide-website.png) | 无作者存档运行 |

## 环境与测量

Windows 11，Node.js 22.15.0，Chrome 152.0.7977.82，Playwright 1.62.1，Three.js 0.180.0。使用真实 Chrome headless、DPR 1、Intel UHD Graphics / ANGLE / Direct3D11。视口覆盖 1440×900 和 1280×800；访客网站另检查 390px 宽度无横向溢出，不等于手机编辑器验收。

| 测量 | 本机结果 |
| --- | --- |
| 冷上下文本地页面就绪 | 1.79 秒 |
| 稳定播放窗口 | 2.0025 秒 |
| 场景重绘 | 60 帧，29.96 fps（导览上限 30 fps） |
| JS 渲染提交 | 平均 2.57 ms，P95 3.30 ms |
| 画布 | 996×560，DPR 1 |
| 暂停 600 ms | 0 次额外重绘 |
| 页面异常 | 0 |

[performance.json](performance.json) 保留原始数据。提交时间不是纯 GPU 耗时；本地加载不是线上下载保证；单机测量不代表所有设备。

## 已知边界

- 仍是风格化骨骼动画，近景手指接触、衣袖和转身落脚有简化；没有衣物动力学或本人动作采集。外观模型本轮未改。
- 坐姿只适配现有弧背工作椅，不含沙发、床、任意外部椅子。地毯用平面高度近似，不做逐足地形或完整人体碰撞。
- Safari、Firefox、手机端编码未执行。本轮导出只验证 H.264/MP4；WebM 在运行时检测后可选，本轮未另外导出验证。
- 本地回归为导览、坐姿、作品网站发布三套测试；其余房间、短片、工程管理测试本轮未在本机重跑。GitHub 工作流独立执行，以实际状态为准。
- 独立分支未合并、未部署至线上主站；验收浏览器未覆盖用户原本地存档。

实现、用法与动作来源见 [MOTION-GUIDE.md](../MOTION-GUIDE.md)。
