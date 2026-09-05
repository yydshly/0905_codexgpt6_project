# 家具、照片与二次开发验收

2026-09-05，独立分支 `codex/reusable-study`，基线 `b360242`。本轮实际执行，不以编译或源码阅读代替操作。运行与接入方式见 [REUSE.md](REUSE.md)。

## 已完成的浏览器操作

| 流程 | 结果与证据 |
|---|---|
| 旧 v1 房间 → 相框选择 → 沿墙拖动 → 撤销 / 重做 → 改尺寸 / 画框 → 上传照片 | 通过。墙面 X / Y 双向同步，拖动只有一条历史，Z 固定背墙，镜头不随物件拖动变化 |
| 照片保存 → 刷新 → JSON 下载 → 新浏览器页面导入 | 通过。完整工程相等；照片 JPEG 数据包含于工程；损坏照片、损坏 JSON 图片拒绝且保留工程 |
| 相框与整屋 GLB → 文件下载 → 独立查看器实际解码 | 通过。纹理嵌于 bufferView、无需外部 URL；独立查看器不使用本项目建模代码。损坏 GLB 保留已加载模型 |
| 沙发与床 → 添加 → 旋转 15° → 移动 → 材质 → 移除 / 撤销 / 重做 | 通过。检查两种桌面窗口，以及默认 / 俯视 / 近景 / 深夜；床与沙发按需添加，默认场景不拥挤 |
| 照片房间 → 短片 → 保存 / 刷新 → 工程下载 | 通过。相同物件数据进入短片；v3 工程保留嵌入照片 |
| 旧短片 v2 → 新 v3 保存 / 刷新 | 通过。镜头、播放头及旧物件保留，scene 升级为 v2，原存储值逐字不变 |
| 宿主网页 → iframe 光照 / 材质 / 定位 / 播放 / 暂停 / JSON 导入 | 通过。真实 postMessage 控制；错误工程保留当前数据，非允许来源消息被忽略，不读写本地存储 |
| 原房间与短片能力回归 | 原 17 项全部通过。全量 20 项运行通过后，GLB 光照方向修正又通过 3 项定向回归；追加旧 v2 短片迁移 1 项通过 |

修复了实际截图发现的生产构建 CSS 丢失：主入口中连续动态 import 被打包合并，错误使用最后一条路由的 CSS 依赖。改为独立 loader 函数，并对产品接入示例的 grid 与视口内控件增加检查。

## 实际交付文件

- [照片房间 / 1440×900](reuse-evidence/01-photo-room-1440x900.png)
- [独立 GLB 查看器 / 1280×800](reuse-evidence/02-exported-glb-1280x800.png)
- [沙发 / 1280×800](reuse-evidence/03-sofa-1280x800.png)
- [床 / 1280×800](reuse-evidence/04-bed-1280x800.png)
- [真实宿主网页 / 1440×900](reuse-evidence/05-product-integration-1440x900.png)
- [整屋 GLB](reuse-evidence/study-room.glb)、[单件相框 GLB](reuse-evidence/wall-photo.glb)
- [房间 v2 JSON](reuse-evidence/reusable-room.json)、[带照片短片 v3 JSON](reuse-evidence/reusable-film.json)
- [本轮短片回归 MP4](reuse-evidence/film-regression.mp4)：H.264、1280×720、30 fps、10.2 秒、306 帧、6,180,011 字节。浏览器实际打开下载文件、定位三处画面并播放至结束；ffprobe 复核帧数与元数据。

机器记录：[照片 / GLB](reuse-evidence/photo-and-glb.json)、[家具与渲染测量](reuse-evidence/furniture.json)、[宿主集成](reuse-evidence/integration.json)、[短片回归](reuse-evidence/film-regression.json)、[短片帧时与编码](reuse-evidence/film-performance.json)。本轮视频对应原短片回归工程；带照片的 JSON / GLB 是另一条明确分开的验收流程。

## 环境与性能

- Windows 11 家庭中文版 build 26200；Intel i9-13980HX、16 GB RAM；实际 WebGL 为 Intel UHD / ANGLE D3D11。
- Chrome 152.0.7977.82，Playwright 1.62.1，headless，DPR 1；桌面 1440×900、1280×800。
- Node 22.15.0、npm 10.9.2、TypeScript 5.9.2、Vite 7.3.6、Three.js 0.180.0。`npm audit --audit-level=high`：0 漏洞。
- 生产 root 地址 `http://127.0.0.1:4173/`；启动 `npm run build && npm run preview`。开发入口 `http://127.0.0.1:5173/`。
- 本轮完整 20 项运行约 1.9 分钟。默认短片就绪 649 ms，281 个 rAF 样本平均 10.47 ms、P95 16.6 ms，暂停后 1 秒新增渲染 0 次。这是当前 headless 环境的观察，不是所有机器的帧率保证。
- 共享 Three.js chunk 约 569 kB 未压缩，构建仍提示超过 500 kB；GLB 导出器约 36.8 kB，单独动态加载。没有新增第三方依赖。

## 慢速环境修正与兼容边界

前一分支的 GitHub Actions `33949187559` 已结束失败，不能用本机测试替代它。本轮修正：视频逐帧向事件循环让出执行权，使慢速 GPU 上的取消输入不再等待三个画面；暂停测试先回到开头，避免慢速点击跨过片尾；完整 10.2 秒主流程在 CI 中允许更长编码时间。额外 VP9 / VP8 格式探针在 CI 中通过真实编辑器改成 3 秒、90 帧，明确与本地默认 10 秒、300 帧分开命名。未改变产品导出的默认尺寸、帧率或采样器。

GitHub Pages 子路径 http://127.0.0.1:4174/0905_codexgpt6_project/ 的 4 项复用与迁移测试通过，含整屋 / 单件 GLB、JSON 与 iframe 路由。命令：npx playwright test --config playwright.pages.config.ts tests/reuse.spec.ts。实际统计与产物哈希见 reuse-evidence/acceptance.json。

本分支云端运行 https://github.com/yydshly/0905_codexgpt6_project/actions/runs/33950790993 尚在执行，收尾时填入结论，不宣称已通过。

已知限制：完整手机编辑、其他浏览器、真实跨域宿主、React / Vue 生产应用、原生 WebView、Blender / Unity / Unreal 均未在本轮实测。GLB 的照明、bump 与后期不能保证和网页一致；照片限制在背墙，最多 3 个；手动移动可造成家具相交，未增加物理 / CAD。浏览器配额不足时会提示失败，JSON 是备份途径。账号、云同步、付费发布、npm 包发布均未实施。
